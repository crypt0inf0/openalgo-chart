/**
 * useOILines Hook
 * Fetches option chain data and calculates Max Call OI, Max Put OI, and Max Pain
 * Auto-refreshes every 5 minutes during market hours
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getOptionChain } from '../services/optionChain';
import { analyzeOptionChain } from '../utils/optionAnalysis';
import { isMarketOpen } from '../services/marketService';

// Refresh interval: 5 minutes
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

// Symbols that support F&O (indices and major stocks)
const FO_INDICES = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX', 'BANKEX'];

// Check if symbol supports options
const isFOSymbol = (symbol) => {
    if (!symbol) return false;
    const upperSymbol = symbol.toUpperCase();
    // Check if it's a known index
    if (FO_INDICES.includes(upperSymbol)) return true;
    // For stocks, we'll attempt to fetch and handle errors gracefully
    return true; // Allow attempt for any symbol
};

// Get underlying symbol for option chain lookup
const getUnderlying = (symbol, exchange) => {
    if (!symbol) return null;
    const upperSymbol = symbol.toUpperCase();

    // Handle index symbols
    if (exchange === 'NSE_INDEX' || exchange === 'BSE_INDEX') {
        // Map display names to option chain underlying names
        const indexMap = {
            'NIFTY 50': 'NIFTY',
            'NIFTY50': 'NIFTY',
            'NIFTY_50': 'NIFTY',
            'BANK NIFTY': 'BANKNIFTY',
            'NIFTY BANK': 'BANKNIFTY',
            'NIFTY_BANK': 'BANKNIFTY',
            'FIN NIFTY': 'FINNIFTY',
            'NIFTY FIN SERVICE': 'FINNIFTY',
            'NIFTY_FIN_SERVICE': 'FINNIFTY',
            'MIDCAP NIFTY': 'MIDCPNIFTY',
            'NIFTY MIDCAP SELECT': 'MIDCPNIFTY',
            'NIFTY_MID_SELECT': 'MIDCPNIFTY',
        };
        return indexMap[upperSymbol] || upperSymbol;
    }

    // For stocks, use as-is
    return upperSymbol;
};

/**
 * Custom hook for fetching and managing OI lines data
 * @param {string} symbol - Current chart symbol
 * @param {string} exchange - Current exchange (NSE, BSE, NSE_INDEX, etc.)
 * @param {boolean} enabled - Whether OI lines feature is enabled
 * @returns {Object} { oiLines, isLoading, error, lastUpdated, refresh }
 */
export function useOILines(symbol, exchange, enabled = true) {
    const [oiLines, setOiLines] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);

    const intervalRef = useRef(null);
    const isMountedRef = useRef(true);

    // Fetch and analyze option chain
    const fetchOIData = useCallback(async () => {
        const underlying = getUnderlying(symbol, exchange);

        if (!underlying || !isFOSymbol(underlying)) {
            setOiLines(null);
            setError('Symbol does not support options');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Determine the F&O exchange for option chain API
            // NSE stocks and indices use NFO, BSE uses BFO
            let foExchange = 'NFO';
            if (exchange === 'BSE_INDEX' || exchange === 'BSE') {
                foExchange = 'BFO';
            }

            console.log('[useOILines] Fetching option chain:', { underlying, foExchange, exchange });

            // Fetch option chain with enough strikes to capture OI levels
            // Note: getOptionChain service handles the underlying/index exchange mapping
            const chainData = await getOptionChain(underlying, foExchange, null, 30);

            if (!isMountedRef.current) return;

            if (!chainData || !chainData.chain || chainData.chain.length === 0) {
                setOiLines(null);
                setError('No option chain data available');
                setIsLoading(false);
                return;
            }

            // Analyze option chain for Max OI and Max Pain
            const analysis = analyzeOptionChain(chainData.chain);

            console.log('[useOILines] Analysis result:', {
                underlying,
                chainLength: chainData.chain.length,
                maxCallOI: analysis.maxCallOI,
                maxPutOI: analysis.maxPutOI,
                maxPain: analysis.maxPain
            });

            setOiLines({
                maxCallOI: analysis.maxCallOI?.strike || null,
                maxCallOIValue: analysis.maxCallOI?.oi || 0,
                maxPutOI: analysis.maxPutOI?.strike || null,
                maxPutOIValue: analysis.maxPutOI?.oi || 0,
                maxPain: analysis.maxPain?.strike || null,
                expiryDate: chainData.expiryDate,
                underlying: chainData.underlying,
                atmStrike: chainData.atmStrike
            });
            setLastUpdated(new Date());
            setError(null);

        } catch (err) {
            if (!isMountedRef.current) return;

            // Handle "no F&O support" error silently (expected for non-F&O stocks)
            if (err.code === 'NO_FO_SUPPORT') {
                console.log('[useOILines] Symbol does not support F&O:', underlying);
                setError('No F&O support');
                setOiLines(null);
            } else {
                console.error('[useOILines] Error fetching OI data:', err);
                setError(err.message || 'Failed to fetch option chain');
                setOiLines(null);
            }
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
            }
        }
    }, [symbol, exchange]);

    // Manual refresh function
    const refresh = useCallback(() => {
        fetchOIData();
    }, [fetchOIData]);

    // Initial fetch and setup auto-refresh
    useEffect(() => {
        isMountedRef.current = true;

        if (!enabled || !symbol) {
            setOiLines(null);
            return;
        }

        // Initial fetch
        fetchOIData();

        // Setup auto-refresh interval
        const setupInterval = async () => {
            // Clear any existing interval
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }

            intervalRef.current = setInterval(async () => {
                // Only refresh during market hours
                const marketOpen = await isMarketOpen('NSE');
                if (marketOpen && isMountedRef.current) {
                    console.log('[useOILines] Auto-refreshing OI data');
                    fetchOIData();
                }
            }, REFRESH_INTERVAL_MS);
        };

        setupInterval();

        // Cleanup
        return () => {
            isMountedRef.current = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [symbol, exchange, enabled, fetchOIData]);

    return {
        oiLines,
        isLoading,
        error,
        lastUpdated,
        refresh
    };
}

export default useOILines;
