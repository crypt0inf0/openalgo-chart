/**
 * useOptionChainData Hook
 * Shared logic for option chain data fetching with race condition protection
 *
 * Used by: OptionChainModal, OptionChainPicker
 *
 * Features:
 * - Expiry fetching with stale response protection
 * - Option chain fetching with request ID tracking
 * - Loading state management
 * - Error handling
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { getOptionChain, getAvailableExpiries } from '../services/optionChain';
import logger from '../utils/logger';

/**
 * Hook for fetching and managing option chain data
 *
 * @param {Object} options - Configuration options
 * @param {Object} options.underlying - Underlying symbol object { symbol, exchange }
 * @param {number} options.strikeCount - Number of strikes to fetch (default: 15)
 * @param {boolean} options.autoFetch - Auto-fetch when underlying changes (default: true)
 * @returns {Object} Option chain state and handlers
 */
export const useOptionChainData = (options = {}) => {
    const {
        underlying = null,
        strikeCount = 15,
        autoFetch = true
    } = options;

    // State
    const [optionChain, setOptionChain] = useState(null);
    const [availableExpiries, setAvailableExpiries] = useState([]);
    const [selectedExpiry, setSelectedExpiry] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingExpiries, setIsLoadingExpiries] = useState(false);
    const [error, setError] = useState(null);

    // Request tracking refs for stale response protection
    const expiryRequestIdRef = useRef(0);
    const chainRequestIdRef = useRef(0);
    const mountedRef = useRef(true);

    // Track current underlying to detect changes
    const currentUnderlyingRef = useRef(null);

    // Cleanup on unmount
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    /**
     * Fetch available expiries for the underlying
     */
    const fetchExpiries = useCallback(async (symbol, exchange) => {
        if (!symbol || !exchange) {
            logger.warn('[useOptionChainData] fetchExpiries: Missing symbol or exchange');
            return [];
        }

        // Increment request ID and capture current value
        const requestId = ++expiryRequestIdRef.current;

        logger.debug('[useOptionChainData] Fetching expiries for', symbol, 'requestId:', requestId);
        setIsLoadingExpiries(true);
        setError(null);

        try {
            const expiries = await getAvailableExpiries(symbol, exchange);

            // Check if this request is still current and component is mounted
            if (!mountedRef.current || requestId !== expiryRequestIdRef.current) {
                logger.debug('[useOptionChainData] Discarding stale expiry response for', symbol);
                return [];
            }

            setAvailableExpiries(expiries);

            // Auto-select first expiry
            if (expiries.length > 0) {
                setSelectedExpiry(expiries[0]);
            } else {
                setSelectedExpiry(null);
            }

            return expiries;

        } catch (err) {
            if (mountedRef.current && requestId === expiryRequestIdRef.current) {
                logger.error('[useOptionChainData] Failed to fetch expiries:', err);
                setError(err.message || 'Failed to fetch expiries');
                setAvailableExpiries([]);
            }
            return [];

        } finally {
            if (mountedRef.current && requestId === expiryRequestIdRef.current) {
                setIsLoadingExpiries(false);
            }
        }
    }, []);

    /**
     * Fetch option chain for the underlying and expiry
     */
    const fetchOptionChain = useCallback(async (symbol, exchange, expiry, count = strikeCount, forceRefresh = false) => {
        if (!symbol || !exchange || !expiry) {
            logger.warn('[useOptionChainData] fetchOptionChain: Missing required params');
            return null;
        }

        // Increment request ID and capture current value
        const requestId = ++chainRequestIdRef.current;

        logger.debug('[useOptionChainData] Fetching chain for', symbol, expiry, 'requestId:', requestId);
        setIsLoading(true);
        setError(null);

        try {
            const chain = await getOptionChain(symbol, exchange, expiry, count, forceRefresh);

            // Check if this request is still current and component is mounted
            if (!mountedRef.current || requestId !== chainRequestIdRef.current) {
                logger.debug('[useOptionChainData] Discarding stale chain response for', symbol);
                return null;
            }

            if (!chain || !chain.chain) {
                throw new Error('Invalid option chain data');
            }

            setOptionChain(chain);
            return chain;

        } catch (err) {
            if (mountedRef.current && requestId === chainRequestIdRef.current) {
                logger.error('[useOptionChainData] Failed to fetch option chain:', err);
                setError(err.message || 'Failed to fetch option chain');
                setOptionChain(null);
            }
            return null;

        } finally {
            if (mountedRef.current && requestId === chainRequestIdRef.current) {
                setIsLoading(false);
            }
        }
    }, [strikeCount]);

    /**
     * Refresh option chain (fetch with force refresh)
     */
    const refresh = useCallback(async () => {
        if (!underlying?.symbol || !underlying?.exchange || !selectedExpiry) {
            return;
        }
        await fetchOptionChain(
            underlying.symbol,
            underlying.exchange,
            selectedExpiry,
            strikeCount,
            true // forceRefresh
        );
    }, [underlying, selectedExpiry, strikeCount, fetchOptionChain]);

    /**
     * Change expiry and fetch new chain
     */
    const changeExpiry = useCallback(async (newExpiry) => {
        setSelectedExpiry(newExpiry);
        if (underlying?.symbol && underlying?.exchange && newExpiry) {
            await fetchOptionChain(underlying.symbol, underlying.exchange, newExpiry, strikeCount);
        }
    }, [underlying, strikeCount, fetchOptionChain]);

    /**
     * Invalidate current requests (useful when switching symbols)
     */
    const invalidateRequests = useCallback(() => {
        expiryRequestIdRef.current++;
        chainRequestIdRef.current++;
    }, []);

    /**
     * Reset all state
     */
    const reset = useCallback(() => {
        invalidateRequests();
        setOptionChain(null);
        setAvailableExpiries([]);
        setSelectedExpiry(null);
        setIsLoading(false);
        setIsLoadingExpiries(false);
        setError(null);
    }, [invalidateRequests]);

    // Auto-fetch when underlying changes
    useEffect(() => {
        if (!autoFetch || !underlying?.symbol || !underlying?.exchange) {
            return;
        }

        // Check if underlying actually changed
        const currentKey = `${underlying.symbol}-${underlying.exchange}`;
        const prevKey = currentUnderlyingRef.current;

        if (currentKey === prevKey) {
            return;
        }

        currentUnderlyingRef.current = currentKey;

        // Reset state and fetch new data
        setOptionChain(null);
        setAvailableExpiries([]);
        setSelectedExpiry(null);

        fetchExpiries(underlying.symbol, underlying.exchange);

    }, [underlying?.symbol, underlying?.exchange, autoFetch, fetchExpiries]);

    // Auto-fetch chain when expiry changes (after initial load)
    useEffect(() => {
        if (!autoFetch || !underlying?.symbol || !underlying?.exchange || !selectedExpiry) {
            return;
        }

        fetchOptionChain(underlying.symbol, underlying.exchange, selectedExpiry, strikeCount);

    }, [selectedExpiry]); // Only trigger on expiry change, not underlying (that's handled above)

    return {
        // State
        optionChain,
        availableExpiries,
        selectedExpiry,
        isLoading,
        isLoadingExpiries,
        error,

        // Setters (for manual control)
        setOptionChain,
        setAvailableExpiries,
        setSelectedExpiry,
        setError,

        // Actions
        fetchExpiries,
        fetchOptionChain,
        refresh,
        changeExpiry,
        invalidateRequests,
        reset,

        // Request tracking (for advanced use)
        expiryRequestIdRef,
        chainRequestIdRef
    };
};

export default useOptionChainData;
