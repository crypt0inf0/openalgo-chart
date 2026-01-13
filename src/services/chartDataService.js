/**
 * Chart Data Service
 * Handles OHLC data fetching (klines) and market quotes/depth
 */

import logger from '../utils/logger.js';
import { getApiBase, getLoginUrl, getApiKey, convertInterval } from './apiConfig';

/**
 * Module-scoped cache for previous close prices
 * Used by WebSocket updates which don't include prev_close (mode 2)
 */
const prevCloseCache = new Map();
const MAX_PREV_CLOSE_CACHE_SIZE = 200;

/**
 * Get cached previous close for a symbol
 * Used by WebSocket subscriptions which don't receive prev_close
 * @param {string} symbol - Trading symbol
 * @param {string} exchange - Exchange code
 * @returns {number|undefined} Cached prev_close or undefined
 */
export const getCachedPrevClose = (symbol, exchange = 'NSE') => {
    return prevCloseCache.get(`${symbol}:${exchange}`);
};

/**
 * Set cached previous close for a symbol
 * @param {string} symbol - Trading symbol
 * @param {string} exchange - Exchange code
 * @param {number} prevClose - Previous close price
 */
export const setCachedPrevClose = (symbol, exchange, prevClose) => {
    // Evict oldest entry if cache is at capacity
    if (prevCloseCache.size >= MAX_PREV_CLOSE_CACHE_SIZE) {
        const firstKey = prevCloseCache.keys().next().value;
        prevCloseCache.delete(firstKey);
    }
    prevCloseCache.set(`${symbol}:${exchange}`, prevClose);
};

// IST offset for consistent time display
const IST_OFFSET_SECONDS = 19800; // 5 hours 30 minutes in seconds

/**
 * Get historical OHLC data (klines)
 * @param {string} symbol - Trading symbol (e.g., 'RELIANCE')
 * @param {string} exchange - Exchange code (e.g., 'NSE')
 * @param {string} interval - Interval (e.g., '1d', '1h', '5m')
 * @param {number} limit - Number of candles (default 1000)
 * @param {AbortSignal} signal - Optional abort signal
 */
export const getKlines = async (symbol, exchange = 'NSE', interval = '1d', limit = 1000, signal) => {
    try {
        // Calculate date range (last 2 years for daily, adjust for intraday)
        const endDate = new Date();
        const startDate = new Date();

        // Adjust start date based on interval to ensure enough candles (target: 235+)
        // Indian markets have ~6 trading hours/day (9:15 AM - 3:30 PM)
        if (interval.includes('h')) {
            // Hourly intervals need more days to get 235 candles
            // 4h: ~1.5 bars/day → need 160 days
            // 3h: ~2 bars/day → need 120 days
            // 2h: ~3 bars/day → need 80 days
            // 1h: ~6 bars/day → need 40 days
            // Use 180 days (6 months) to cover all hourly cases
            startDate.setDate(startDate.getDate() - 180);
        } else if (interval.includes('m')) {
            // Minute intervals: many candles per day
            // 1m: ~360 bars/day, 5m: ~72 bars/day, 15m: ~24 bars/day, 30m: ~12 bars/day
            // 10 days is enough for 235 candles (even 30m gets 120 bars in 10 days)
            // Additional data loaded via scroll-back if needed
            startDate.setDate(startDate.getDate() - 10);
        } else if (/^(W|1w|M|1M)$/i.test(interval)) {
            startDate.setFullYear(startDate.getFullYear() - 10); // 10 years for weekly/monthly
        } else {
            startDate.setFullYear(startDate.getFullYear() - 2); // 2 years for daily
        }

        const formatDate = (d) => d.toISOString().split('T')[0];

        const response = await fetch(`${getApiBase()}/history`, {
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
                interval: convertInterval(interval),
                start_date: formatDate(startDate),
                end_date: formatDate(endDate)
            })
        });

        logger.debug('[OpenAlgo] History request:', { symbol, exchange, interval: convertInterval(interval), start_date: formatDate(startDate), end_date: formatDate(endDate) });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = getLoginUrl();
                return [];
            }
            throw new Error(`OpenAlgo history error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        logger.debug('[OpenAlgo] History response:', data);

        // Transform OpenAlgo response to lightweight-charts format
        // OpenAlgo returns: { data: [ { timestamp, open, high, low, close, volume }, ... ] }
        // timestamp is in UTC seconds, add IST offset for local display

        if (data && data.data && Array.isArray(data.data)) {
            const candles = data.data.map(d => {
                // If timestamp is a number, use directly (already in seconds)
                // Otherwise parse date string
                let time;
                if (typeof d.timestamp === 'number') {
                    // Add IST offset to display in Indian Standard Time
                    time = d.timestamp + IST_OFFSET_SECONDS;
                } else if (d.date || d.datetime) {
                    time = new Date(d.date || d.datetime).getTime() / 1000 + IST_OFFSET_SECONDS;
                } else {
                    time = 0;
                }

                return {
                    time,
                    open: parseFloat(d.open),
                    high: parseFloat(d.high),
                    low: parseFloat(d.low),
                    close: parseFloat(d.close),
                    volume: parseFloat(d.volume || 0),
                };
            }).filter(candle =>
                candle.time > 0 && [candle.open, candle.high, candle.low, candle.close].every(value => Number.isFinite(value))
            );

            // Sort by time ascending and remove duplicates (keep the last occurrence for each timestamp)
            candles.sort((a, b) => a.time - b.time);
            const deduped = [];
            const seenTimes = new Set();
            for (let i = candles.length - 1; i >= 0; i--) {
                if (!seenTimes.has(candles[i].time)) {
                    seenTimes.add(candles[i].time);
                    deduped.unshift(candles[i]);
                }
            }
            return deduped;
        }

        return [];
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Error fetching klines:', error);
        }
        return [];
    }
};

/**
 * Get historical OHLC data with explicit date range (for pagination/scroll loading)
 * @param {string} symbol - Trading symbol
 * @param {string} exchange - Exchange code
 * @param {string} interval - Interval
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {AbortSignal} signal - Optional abort signal
 */
export const getHistoricalKlines = async (symbol, exchange = 'NSE', interval = '1d', startDate, endDate, signal) => {
    try {
        const response = await fetch(`${getApiBase()}/history`, {
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
                interval: convertInterval(interval),
                start_date: startDate,
                end_date: endDate
            })
        });

        logger.debug('[OpenAlgo] Historical request:', { symbol, exchange, interval: convertInterval(interval), start_date: startDate, end_date: endDate });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = getLoginUrl();
                return [];
            }
            throw new Error(`OpenAlgo history error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        logger.debug('[OpenAlgo] Historical response:', data);

        // Transform OpenAlgo response to lightweight-charts format

        if (data && data.data && Array.isArray(data.data)) {
            const candles = data.data.map(d => {
                let time;
                if (typeof d.timestamp === 'number') {
                    time = d.timestamp + IST_OFFSET_SECONDS;
                } else if (d.date || d.datetime) {
                    time = new Date(d.date || d.datetime).getTime() / 1000 + IST_OFFSET_SECONDS;
                } else {
                    time = 0;
                }

                return {
                    time,
                    open: parseFloat(d.open),
                    high: parseFloat(d.high),
                    low: parseFloat(d.low),
                    close: parseFloat(d.close),
                    volume: parseFloat(d.volume || 0),
                };
            }).filter(candle =>
                candle.time > 0 && [candle.open, candle.high, candle.low, candle.close].every(value => Number.isFinite(value))
            );

            // Sort by time ascending and remove duplicates (keep the last occurrence for each timestamp)
            candles.sort((a, b) => a.time - b.time);
            const deduped = [];
            const seenTimes = new Set();
            for (let i = candles.length - 1; i >= 0; i--) {
                if (!seenTimes.has(candles[i].time)) {
                    seenTimes.add(candles[i].time);
                    deduped.unshift(candles[i]);
                }
            }
            return deduped;
        }

        return [];
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Error fetching historical klines:', error);
        }
        return [];
    }
};

/**
 * Get 24hr ticker price data
 * @param {string} symbol - Trading symbol
 * @param {string} exchange - Exchange code
 * @param {AbortSignal} signal - Optional abort signal
 */
export const getTickerPrice = async (symbol, exchange = 'NSE', signal) => {
    try {
        const response = await fetch(`${getApiBase()}/quotes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            signal,
            body: JSON.stringify({
                apikey: getApiKey(),
                symbol,
                exchange
            })
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = getLoginUrl();
                return null;
            }
            throw new Error(`OpenAlgo quotes error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        logger.debug('[OpenAlgo] Quotes request:', { symbol, exchange });
        logger.debug('[OpenAlgo] Quotes response:', data);

        // Transform to match Binance response format expected by App.jsx
        // OpenAlgo returns: { data: { ltp, open, high, low, prev_close, ... }, status: 'success' }
        if (data && data.data) {
            const quoteData = data.data;
            const ltp = parseFloat(quoteData.ltp || quoteData.last_price || 0);

            // prev_close can be 0 from some brokers (e.g., Upstox) - need explicit check for valid value
            let prevClose = parseFloat(quoteData.prev_close || quoteData.previous_close || 0);

            // If prev_close is 0 or invalid, fall back to open price (for day's change calculation)
            if (prevClose <= 0) {
                prevClose = parseFloat(quoteData.open || ltp);
                logger.debug('[OpenAlgo] prev_close unavailable, using open as fallback:', prevClose);
            }

            const change = ltp - prevClose;
            const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

            // Cache prev_close for WebSocket updates (WebSocket mode 2 doesn't include prev_close)
            setCachedPrevClose(symbol, exchange, prevClose);

            return {
                lastPrice: ltp.toString(),
                priceChange: change.toFixed(2),
                priceChangePercent: changePercent.toFixed(2),
                symbol: symbol,
                volume: parseFloat(quoteData.volume || 0),
                open: parseFloat(quoteData.open || 0)
            };
        }

        return null;
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Error fetching ticker price:', error);
        }
        return null;
    }
};

/**
 * Get Market Depth (DOM) data
 * Returns 5 best bid/ask levels with prices and quantities
 * @param {string} symbol - Trading symbol (e.g., 'NIFTY31JUL25FUT')
 * @param {string} exchange - Exchange code (e.g., 'NFO', 'NSE')
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Object} Depth data with bids, asks, totals, and market info
 */
export const getDepth = async (symbol, exchange = 'NSE', signal) => {
    try {
        const response = await fetch(`${getApiBase()}/depth`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            signal,
            body: JSON.stringify({
                apikey: getApiKey(),
                symbol,
                exchange
            })
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = getLoginUrl();
                return null;
            }
            throw new Error(`OpenAlgo depth error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        logger.debug('[OpenAlgo] Depth request:', { symbol, exchange });
        logger.debug('[OpenAlgo] Depth response:', data);

        if (data && data.data) {
            const depthData = data.data;
            return {
                // 5 best ask levels (sorted by price ascending - best ask first)
                asks: (depthData.asks || []).map(a => ({
                    price: parseFloat(a.price || 0),
                    quantity: parseInt(a.quantity || 0, 10)
                })),
                // 5 best bid levels (sorted by price descending - best bid first)
                bids: (depthData.bids || []).map(b => ({
                    price: parseFloat(b.price || 0),
                    quantity: parseInt(b.quantity || 0, 10)
                })),
                // Market info
                ltp: parseFloat(depthData.ltp || 0),
                ltq: parseInt(depthData.ltq || 0, 10),
                high: parseFloat(depthData.high || 0),
                low: parseFloat(depthData.low || 0),
                open: parseFloat(depthData.open || 0),
                prevClose: parseFloat(depthData.prev_close || 0),
                volume: parseInt(depthData.volume || 0, 10),
                oi: parseInt(depthData.oi || 0, 10),
                // Total quantities
                totalBuyQty: parseInt(depthData.totalbuyqty || 0, 10),
                totalSellQty: parseInt(depthData.totalsellqty || 0, 10)
            };
        }

        return null;
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Error fetching depth:', error);
        }
        return null;
    }
};

export default {
    getKlines,
    getHistoricalKlines,
    getTickerPrice,
    getDepth,
    getCachedPrevClose,
    setCachedPrevClose
};
