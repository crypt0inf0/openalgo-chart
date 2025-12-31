/**
 * useFirstRedCandle Hook
 *
 * Finds the first bearish (red) candle after market open (9:15 AM IST)
 * and returns its high/low as support/resistance levels.
 *
 * Uses 5-minute candle data independently of chart timeframe.
 */

import { useState, useEffect, useRef } from 'react';
import { getHostUrl } from '../services/openalgo';

const getApiKey = () => localStorage.getItem('oa_api_key') || '';

/**
 * Fetch 5-minute candle data for the current trading day
 */
const fetch5MinData = async (symbol, exchange, signal) => {
    const hostUrl = localStorage.getItem('oa_host_url') || 'http://127.0.0.1:5000';
    const isLocalDev = typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const isDefaultHost = hostUrl === 'http://127.0.0.1:5000' || hostUrl === 'http://localhost:5000';

    const apiBase = (isDefaultHost && isLocalDev) ? '/api/v1' : `${hostUrl}/api/v1`;

    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const formatDate = (d) => d.toISOString().split('T')[0];

    const response = await fetch(`${apiBase}/history`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        signal,
        body: JSON.stringify({
            apikey: getApiKey(),
            symbol,
            exchange,
            interval: '5m',
            start_date: formatDate(today),
            end_date: formatDate(today)
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data || [];
};

/**
 * Convert UTC timestamp to IST and check if it's after market open
 * Market opens at 9:15 AM IST
 */
const isAfterMarketOpen = (timestamp) => {
    // Handle both seconds and milliseconds timestamps
    const ts = timestamp > 1e12 ? timestamp : timestamp * 1000;
    const date = new Date(ts);

    // Get IST time (UTC+5:30)
    const istOptions = { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: 'numeric', hour12: false };
    const istTimeStr = date.toLocaleString('en-IN', istOptions);
    const [hours, minutes] = istTimeStr.split(':').map(Number);

    // Market opens at 9:15 AM IST
    return hours > 9 || (hours === 9 && minutes >= 15);
};

/**
 * Find the first red (bearish) candle after market open
 * A red candle has close < open
 */
const findFirstRedCandle = (candles) => {
    if (!candles || candles.length === 0) return null;

    for (const candle of candles) {
        // Skip candles before market open
        if (!isAfterMarketOpen(candle.time)) continue;

        // Check if it's a red candle (bearish: close < open)
        if (candle.close < candle.open) {
            return {
                high: candle.high,
                low: candle.low,
                open: candle.open,
                close: candle.close,
                time: candle.time
            };
        }
    }

    return null;
};

/**
 * Hook to get First Red Candle levels for a symbol
 *
 * @param {string} symbol - Trading symbol
 * @param {string} exchange - Exchange (NSE, NFO, etc.)
 * @param {boolean} enabled - Whether to fetch FRC data
 * @returns {Object} { levels: { high, low }, loading, error }
 */
export const useFirstRedCandle = (symbol, exchange = 'NSE', enabled = true) => {
    const [levels, setLevels] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const abortControllerRef = useRef(null);
    const lastFetchRef = useRef({ symbol: null, exchange: null });

    useEffect(() => {
        // Clear levels immediately when symbol changes
        if (lastFetchRef.current.symbol !== symbol || lastFetchRef.current.exchange !== exchange) {
            setLevels(null);
            setError(null);
        }

        if (!enabled || !symbol) {
            setLevels(null);
            setLoading(false);
            return;
        }

        // Abort any pending request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const fetchFRC = async () => {
            abortControllerRef.current = new AbortController();
            setLoading(true);
            setError(null);

            try {
                const candles = await fetch5MinData(
                    symbol,
                    exchange,
                    abortControllerRef.current.signal
                );

                console.log('[FRC] Fetched candles for', symbol, ':', candles?.length || 0, 'candles');

                // Sort candles by time to ensure correct order
                const sortedCandles = [...candles].sort((a, b) => a.time - b.time);

                if (sortedCandles.length > 0) {
                    console.log('[FRC] First candle:', sortedCandles[0]);
                    console.log('[FRC] Last candle:', sortedCandles[sortedCandles.length - 1]);
                }

                const frc = findFirstRedCandle(sortedCandles);

                if (frc) {
                    console.log('[FRC] Found first red candle:', frc);
                    setLevels({
                        high: frc.high,
                        low: frc.low,
                        time: frc.time
                    });
                } else {
                    console.log('[FRC] No red candle found after market open');
                    setLevels(null);
                }

                lastFetchRef.current = { symbol, exchange };
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('[FRC] Error fetching data:', err);
                    setError(err.message);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchFRC();

        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [symbol, exchange, enabled]);

    return { levels, loading, error };
};

export default useFirstRedCandle;
