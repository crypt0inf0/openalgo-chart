import { useState, useCallback, useEffect, useRef } from 'react';
import { getMultiOptionGreeks } from '../../../services/openalgo';

/**
 * Custom hook for fetching and managing option Greeks data
 * Handles batch API calls, retries, and caching
 */
export function useOptionChainGreeks({
    isOpen,
    optionChain,
    underlying,
    viewMode,
    selectedExpiry,
}) {
    const [greeksData, setGreeksData] = useState(new Map());
    const [greeksLoading, setGreeksLoading] = useState(false);

    // Request tracking refs
    const greeksRequestIdRef = useRef(0);
    const failedGreeksSymbolsRef = useRef(new Set());
    const greeksRetryCountRef = useRef(new Map());
    const MAX_GREEKS_RETRY_COUNT = 3;

    // Helper to increment retry count and check if should block
    const markSymbolFailed = useCallback((symbol) => {
        const currentCount = greeksRetryCountRef.current.get(symbol) || 0;
        const newCount = currentCount + 1;
        greeksRetryCountRef.current.set(symbol, newCount);

        if (newCount >= MAX_GREEKS_RETRY_COUNT) {
            failedGreeksSymbolsRef.current.add(symbol);
            console.log(`[OptionChain] Symbol ${symbol} permanently blocked after ${newCount} failed attempts`);
        } else {
            console.log(`[OptionChain] Symbol ${symbol} failed attempt ${newCount}/${MAX_GREEKS_RETRY_COUNT}`);
        }
    }, []);

    // Batch fetch Greeks
    const fetchGreeks = useCallback(async () => {
        if (!optionChain?.chain?.length) return;

        const requestId = ++greeksRequestIdRef.current;

        // Collect symbols to fetch
        const symbolsToFetch = [];
        optionChain.chain.forEach(row => {
            if (row.ce?.symbol && !greeksData.has(row.ce.symbol) && !failedGreeksSymbolsRef.current.has(row.ce.symbol)) {
                symbolsToFetch.push({ symbol: row.ce.symbol, exchange: underlying.exchange });
            }
            if (row.pe?.symbol && !greeksData.has(row.pe.symbol) && !failedGreeksSymbolsRef.current.has(row.pe.symbol)) {
                symbolsToFetch.push({ symbol: row.pe.symbol, exchange: underlying.exchange });
            }
        });

        if (symbolsToFetch.length === 0) return;

        console.log('[OptionChain] Fetching Greeks for', symbolsToFetch.length, 'options, requestId:', requestId);
        setGreeksLoading(true);

        try {
            const response = await getMultiOptionGreeks(symbolsToFetch);

            if (requestId !== greeksRequestIdRef.current) {
                console.log('[OptionChain] Discarding stale Greeks response');
                return;
            }

            if (response?.data?.length > 0) {
                const newGreeksData = new Map(greeksData);
                const symbolsInResponse = new Set();

                response.data.forEach(item => {
                    if (item.status === 'success' && item.symbol) {
                        newGreeksData.set(item.symbol, {
                            iv: item.implied_volatility,
                            greeks: item.greeks
                        });
                        symbolsInResponse.add(item.symbol);
                        greeksRetryCountRef.current.delete(item.symbol);
                    } else if (item.symbol) {
                        markSymbolFailed(item.symbol);
                        symbolsInResponse.add(item.symbol);
                    }
                });

                // Mark symbols not in response as failed
                symbolsToFetch.forEach(s => {
                    if (!symbolsInResponse.has(s.symbol) && !newGreeksData.has(s.symbol)) {
                        markSymbolFailed(s.symbol);
                    }
                });

                setGreeksData(newGreeksData);
                console.log('[OptionChain] Greeks loaded:', response.summary);
            } else {
                symbolsToFetch.forEach(s => markSymbolFailed(s.symbol));
            }
        } catch (error) {
            console.error('[OptionChain] Greeks API error:', error);
            symbolsToFetch.forEach(s => markSymbolFailed(s.symbol));
        } finally {
            if (requestId === greeksRequestIdRef.current) {
                setGreeksLoading(false);
            }
        }
    }, [optionChain?.chain, underlying?.exchange, greeksData, markSymbolFailed]);

    // Retry failed Greeks
    const retryFailedGreeks = useCallback(async () => {
        if (!optionChain?.chain?.length) return;

        const missingSymbols = [];
        optionChain.chain.forEach(row => {
            if (row.ce?.symbol && !greeksData.has(row.ce.symbol) && !failedGreeksSymbolsRef.current.has(row.ce.symbol)) {
                missingSymbols.push({ symbol: row.ce.symbol, exchange: underlying.exchange });
            }
            if (row.pe?.symbol && !greeksData.has(row.pe.symbol) && !failedGreeksSymbolsRef.current.has(row.pe.symbol)) {
                missingSymbols.push({ symbol: row.pe.symbol, exchange: underlying.exchange });
            }
        });

        if (missingSymbols.length === 0) return;

        console.log('[OptionChain] Retrying', missingSymbols.length, 'missing Greeks...');
        setGreeksLoading(true);

        await new Promise(r => setTimeout(r, 2000));

        const requestId = greeksRequestIdRef.current;
        try {
            const response = await getMultiOptionGreeks(missingSymbols);

            if (requestId !== greeksRequestIdRef.current) return;

            if (response?.data?.length > 0) {
                const newGreeksData = new Map(greeksData);
                const symbolsInResponse = new Set();

                response.data.forEach(item => {
                    if (item.status === 'success' && item.symbol) {
                        newGreeksData.set(item.symbol, {
                            iv: item.implied_volatility,
                            greeks: item.greeks
                        });
                        symbolsInResponse.add(item.symbol);
                        greeksRetryCountRef.current.delete(item.symbol);
                    } else if (item.symbol) {
                        markSymbolFailed(item.symbol);
                        symbolsInResponse.add(item.symbol);
                    }
                });

                missingSymbols.forEach(s => {
                    if (!symbolsInResponse.has(s.symbol) && !newGreeksData.has(s.symbol)) {
                        markSymbolFailed(s.symbol);
                    }
                });

                setGreeksData(newGreeksData);
            } else {
                missingSymbols.forEach(s => markSymbolFailed(s.symbol));
            }
        } catch (error) {
            console.error('[OptionChain] Retry failed:', error);
            missingSymbols.forEach(s => markSymbolFailed(s.symbol));
        } finally {
            if (requestId === greeksRequestIdRef.current) {
                setGreeksLoading(false);
            }
        }
    }, [optionChain?.chain, underlying?.exchange, greeksData, markSymbolFailed]);

    // Trigger Greeks fetch when switching to greeks view
    useEffect(() => {
        if (isOpen && viewMode === 'greeks' && optionChain?.chain?.length > 0) {
            fetchGreeks();
        }
    }, [isOpen, viewMode, optionChain?.chain, fetchGreeks]);

    // Auto-retry missing Greeks
    useEffect(() => {
        if (!isOpen || viewMode !== 'greeks' || greeksLoading || greeksData.size === 0) return;

        const hasMissing = optionChain?.chain?.some(row =>
            (row.ce?.symbol && !greeksData.has(row.ce.symbol) && !failedGreeksSymbolsRef.current.has(row.ce.symbol)) ||
            (row.pe?.symbol && !greeksData.has(row.pe.symbol) && !failedGreeksSymbolsRef.current.has(row.pe.symbol))
        );

        if (hasMissing) {
            const timeoutId = setTimeout(retryFailedGreeks, 500);
            return () => clearTimeout(timeoutId);
        }
    }, [isOpen, viewMode, greeksLoading, greeksData.size, optionChain?.chain, retryFailedGreeks]);

    // Clear Greeks cache on modal close
    useEffect(() => {
        if (!isOpen) {
            greeksRequestIdRef.current++;
            setGreeksData(new Map());
            failedGreeksSymbolsRef.current = new Set();
            greeksRetryCountRef.current = new Map();
        }
    }, [isOpen]);

    // Clear Greeks cache on expiry change
    useEffect(() => {
        greeksRequestIdRef.current++;
        setGreeksData(new Map());
        failedGreeksSymbolsRef.current = new Set();
        greeksRetryCountRef.current = new Map();
    }, [selectedExpiry]);

    return {
        greeksData,
        greeksLoading,
        fetchGreeks,
        retryFailedGreeks,
    };
}

export default useOptionChainGreeks;
