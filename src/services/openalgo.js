/**
 * OpenAlgo API Service
 * Handles chart data fetching and WebSocket connections for OpenAlgo backend
 */

import logger from '../utils/logger.js';
import { ConnectionState, setConnectionStatus } from './connectionStatus';

const DEFAULT_HOST = 'http://127.0.0.1:5000';
const DEFAULT_WS_HOST = '127.0.0.1:8765';

/**
 * Global registry of active WebSocket connections
 * Used for cleanup on app exit (beforeunload)
 */
const activeWebSockets = new Set();

/**
 * Close all active WebSocket connections
 * Called on beforeunload to ensure proper cleanup
 */
export const closeAllWebSockets = () => {
    logger.debug('[WebSocket] Closing all active connections:', activeWebSockets.size);
    activeWebSockets.forEach(ws => {
        try {
            if (ws && typeof ws.close === 'function') {
                ws.close();
            }
        } catch (error) {
            logger.debug('[WebSocket] Error closing connection:', error);
        }
    });
    activeWebSockets.clear();
};

/**
 * Force close all WebSocket connections without unsubscribe
 * Used for immediate cleanup (e.g., page unload)
 */
export const forceCloseAllWebSockets = () => {
    logger.debug('[WebSocket] Force closing all active connections:', activeWebSockets.size);
    activeWebSockets.forEach(ws => {
        try {
            if (ws && typeof ws.forceClose === 'function') {
                ws.forceClose();
            } else if (ws && typeof ws.close === 'function') {
                ws.close();
            }
        } catch (error) {
            // Ignore errors during force close
        }
    });
    activeWebSockets.clear();
};

/**
 * Get Host URL from localStorage settings or use default
 */
export const getHostUrl = () => {
    return localStorage.getItem('oa_host_url') || DEFAULT_HOST;
};

/**
 * Check if we should use the Vite proxy (when using default localhost settings)
 * This avoids CORS issues during development
 */
const shouldUseProxy = () => {
    const hostUrl = getHostUrl();
    // Use proxy when host is default localhost and we're running on localhost
    const isDefaultHost = hostUrl === DEFAULT_HOST || hostUrl === 'http://localhost:5000' || hostUrl === 'http://127.0.0.1:5000';
    const isLocalDev = typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    return isDefaultHost && isLocalDev;
};

/**
 * Get API Base URL
 * Returns relative path for proxy when in dev mode with default host
 * Returns full URL when using custom host
 */
const getApiBase = () => {
    if (shouldUseProxy()) {
        return '/api/v1';  // Use Vite proxy
    }
    return `${getHostUrl()}/api/v1`;
};

/**
 * Get Login URL
 */
export const getLoginUrl = () => {
    return `${getHostUrl()}/auth/login`;
};

/**
 * Get WebSocket URL from localStorage settings or use default
 */
const getWebSocketUrl = () => {
    const wsHost = localStorage.getItem('oa_ws_url') || DEFAULT_WS_HOST;
    return `ws://${wsHost}`;
};

/**
 * Check if user is authenticated with OpenAlgo
 * OpenAlgo stores API key in localStorage after login
 */
export const checkAuth = async () => {
    try {
        // Check if API key exists in localStorage (set by OpenAlgo after login)
        const apiKey = localStorage.getItem('oa_apikey');

        if (!apiKey || apiKey.trim() === '') {
            // No API key means not logged in
            return false;
        }

        // API key exists, user is authenticated
        return true;
    } catch (error) {
        console.error('Auth check failed:', error);
        return false;
    }
};

/**
 * Get API key from localStorage (set by OpenAlgo after login)
 */
const getApiKey = () => {
    return localStorage.getItem('oa_apikey') || '';
};

/**
 * Convert chart interval to OpenAlgo API format
 * Chart uses: 1d, 1w, 1M
 * OpenAlgo uses: D, W, M for daily/weekly/monthly
 */
const convertInterval = (interval) => {
    const mapping = {
        '1d': 'D',
        '1w': 'W',
        '1M': 'M',
        'D': 'D',
        'W': 'W',
        'M': 'M',
    };
    return mapping[interval] || interval;
};

/**
 * Create managed WebSocket with OpenAlgo protocol support
 * - Authentication on connect
 * - Ping/pong heartbeat handling
 * - Auto-reconnect with re-auth and re-subscribe
 * - Proper unsubscription on close (similar to Python API)
 */
const createManagedWebSocket = (urlBuilder, options) => {
    const { onMessage, subscriptions = [], mode = 2 } = options;

    let socket = null;
    let manualClose = false;
    let reconnectAttempts = 0;
    let authenticated = false;
    const maxAttempts = 5;
    const apiKey = getApiKey();

    const sendSubscriptions = () => {
        if (!socket || socket.readyState !== WebSocket.OPEN || !authenticated) return;

        subscriptions.forEach(sub => {
            const subscribeMsg = {
                action: 'subscribe',
                symbol: sub.symbol,
                exchange: sub.exchange || 'NSE',
                mode: mode
            };
            logger.debug('[WebSocket] Subscribing:', subscribeMsg);
            socket.send(JSON.stringify(subscribeMsg));
        });
    };

    /**
     * Send unsubscribe messages for all subscribed symbols
     * Similar to Python API: client.unsubscribe_ltp(instruments_list)
     */
    const sendUnsubscriptions = () => {
        if (!socket || socket.readyState !== WebSocket.OPEN) return;

        subscriptions.forEach(sub => {
            const unsubscribeMsg = {
                action: 'unsubscribe',
                symbol: sub.symbol,
                exchange: sub.exchange || 'NSE'
            };
            logger.debug('[WebSocket] Unsubscribing:', unsubscribeMsg);
            try {
                socket.send(JSON.stringify(unsubscribeMsg));
            } catch (error) {
                // Ignore errors during unsubscribe (socket might be closing)
                logger.debug('[WebSocket] Error sending unsubscribe (expected during close):', error);
            }
        });
    };

    const connect = () => {
        const url = typeof urlBuilder === 'function' ? urlBuilder() : urlBuilder;
        authenticated = false;
        setConnectionStatus(reconnectAttempts > 0 ? ConnectionState.RECONNECTING : ConnectionState.CONNECTING);

        try {
            socket = new WebSocket(url);
        } catch (error) {
            console.error('[WebSocket] Failed to create WebSocket:', error);
            setConnectionStatus(ConnectionState.DISCONNECTED);
            return;
        }

        socket.onopen = () => {
            logger.debug('[WebSocket] Connected, authenticating...');
            reconnectAttempts = 0;

            // Send authentication message
            const authMsg = {
                action: 'authenticate',
                api_key: apiKey
            };
            logger.debug('[WebSocket] Sending auth:', { action: 'authenticate', api_key: '***' });
            socket.send(JSON.stringify(authMsg));
        };

        socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

                // Log all incoming messages for debugging
                logger.debug('[WebSocket] Received message:', message);

                // Handle ping - respond with pong
                if (message.type === 'ping') {
                    socket.send(JSON.stringify({ type: 'pong' }));
                    return;
                }

                // Handle authentication response
                // Server sends: { type: 'auth', status: 'success', message: '...', broker: '...' }
                if ((message.type === 'auth' && message.status === 'success') ||
                    message.type === 'authenticated' ||
                    message.status === 'authenticated') {
                    logger.debug('[WebSocket] Authenticated successfully, broker:', message.broker);
                    authenticated = true;
                    setConnectionStatus(ConnectionState.CONNECTED);
                    sendSubscriptions();
                    return;
                }

                // Handle auth error
                if (message.type === 'error' || (message.type === 'auth' && message.status !== 'success')) {
                    console.error('[WebSocket] Error:', message.message || message.code);
                    return;
                }

                // Forward market data to callback
                if (onMessage) {
                    onMessage(message);
                }
            } catch (error) {
                console.error('[WebSocket] Error parsing message:', error);
            }
        };

        socket.onerror = (error) => {
            console.error('[WebSocket] Error:', error);
        };

        socket.onclose = (event) => {
            authenticated = false;
            if (manualClose) {
                setConnectionStatus(ConnectionState.DISCONNECTED);
                return;
            }

            if (!event.wasClean && reconnectAttempts < maxAttempts) {
                const delay = Math.min(1000 * 2 ** reconnectAttempts, 10000);
                logger.debug(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxAttempts})`);
                setConnectionStatus(ConnectionState.RECONNECTING);
                reconnectAttempts += 1;
                setTimeout(connect, delay);
            } else {
                setConnectionStatus(ConnectionState.DISCONNECTED);
            }
        };
    };

    connect();

    // Create the managed WebSocket interface
    const managedWs = {
        /**
         * Properly close the WebSocket connection
         * Sends unsubscribe messages for all symbols before closing (like Python API)
         */
        close: () => {
            manualClose = true;
            // Remove from global registry
            activeWebSockets.delete(managedWs);
            if (socket && socket.readyState === WebSocket.OPEN) {
                // Send unsubscribe messages before closing (similar to Python: client.unsubscribe_ltp())
                logger.debug('[WebSocket] Sending unsubscribe messages before close...');
                sendUnsubscriptions();
                // Close the socket after a brief delay to allow unsubscribe messages to be sent
                setTimeout(() => {
                    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
                        socket.close();
                    }
                }, 100);
            } else if (socket && socket.readyState === WebSocket.CONNECTING) {
                socket.close();
            }
        },
        /**
         * Immediately close without sending unsubscribe messages
         * Use this when you need to close quickly (e.g., during page unload)
         */
        forceClose: () => {
            manualClose = true;
            // Remove from global registry
            activeWebSockets.delete(managedWs);
            if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
                socket.close();
            }
        },
        /**
         * Unsubscribe specific symbols without closing the connection
         */
        unsubscribe: (symbols) => {
            if (!socket || socket.readyState !== WebSocket.OPEN) return;

            symbols.forEach(sub => {
                const unsubscribeMsg = {
                    action: 'unsubscribe',
                    symbol: typeof sub === 'string' ? sub : sub.symbol,
                    exchange: typeof sub === 'string' ? 'NSE' : (sub.exchange || 'NSE')
                };
                logger.debug('[WebSocket] Unsubscribing:', unsubscribeMsg);
                try {
                    socket.send(JSON.stringify(unsubscribeMsg));
                } catch (error) {
                    console.error('[WebSocket] Error sending unsubscribe:', error);
                }
            });
        },
        get readyState() {
            return socket ? socket.readyState : WebSocket.CLOSED;
        },
        get isAuthenticated() {
            return authenticated;
        }
    };

    // Register in global WebSocket registry for cleanup on app exit
    activeWebSockets.add(managedWs);
    logger.debug('[WebSocket] Registered in global registry. Total active:', activeWebSockets.size);

    return managedWs;
};

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
        const IST_OFFSET_SECONDS = 19800; // 5 hours 30 minutes in seconds

        if (data && data.data && Array.isArray(data.data)) {
            return data.data.map(d => {
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
            if (!window._prevCloseCache) window._prevCloseCache = {};
            window._prevCloseCache[`${symbol}:${exchange}`] = prevClose;

            return {
                lastPrice: ltp.toString(),
                priceChange: change.toFixed(2),
                priceChangePercent: changePercent.toFixed(2),
                symbol: symbol
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

// IST offset for consistent time display (matches getKlines)
const IST_OFFSET_SECONDS = 19800; // 5 hours 30 minutes

/**
 * Subscribe to real-time ticker updates via WebSocket
 * Uses OpenAlgo WebSocket protocol with mode 2 (Quote) for OHLC data
 * @param {string} symbol - Trading symbol
 * @param {string} exchange - Exchange code
 * @param {string} interval - Interval for candle updates
 * @param {function} callback - Callback for each update
 */
export const subscribeToTicker = (symbol, exchange = 'NSE', interval, callback) => {
    const subscriptions = [{ symbol, exchange }];

    return createManagedWebSocket(
        getWebSocketUrl,
        {
            subscriptions,
            mode: 2, // Quote mode - includes OHLC, volume, etc.
            onMessage: (message) => {
                // Only process market_data messages for our symbol
                if (message.type !== 'market_data' || message.symbol !== symbol) return;

                // Data is nested in message.data
                const data = message.data || {};
                const ltp = parseFloat(data.ltp || data.last_price || 0);

                if (ltp > 0) {
                    // For chart time: use server timestamp if available (to match historical candles)
                    // Add IST offset to match historical data format
                    let time;
                    let brokerTimestamp; // Raw broker timestamp in seconds for time sync

                    if (data.timestamp) {
                        // Server timestamp is in milliseconds, convert to seconds
                        brokerTimestamp = Math.floor(data.timestamp / 1000);
                        time = brokerTimestamp + IST_OFFSET_SECONDS;
                    } else {
                        // Fallback to local time if broker doesn't provide timestamp
                        brokerTimestamp = Math.floor(Date.now() / 1000);
                        time = brokerTimestamp + IST_OFFSET_SECONDS;
                    }

                    // Transform to candle format for chart
                    const candle = {
                        time, // With IST offset for chart display
                        brokerTimestamp, // Raw broker timestamp for UI clock sync
                        open: parseFloat(data.open || ltp),
                        high: parseFloat(data.high || ltp),
                        low: parseFloat(data.low || ltp),
                        close: ltp,
                        volume: parseFloat(data.volume || 0),
                    };

                    logger.debug('[WebSocket] Quote for', symbol, ':', { time: candle.time, brokerTimestamp: candle.brokerTimestamp, ltp });
                    callback(candle);
                }
            }
        }
    );
};
/**
 * Subscribe to multiple tickers for watchlist
 * Uses OpenAlgo WebSocket protocol with mode 2 (Quote)
 * @param {Array<{symbol: string, exchange: string}>} symbols - Array of symbol objects
 * @param {function} callback - Callback for each update
 */
export const subscribeToMultiTicker = (symbols, callback) => {
    if (!symbols || symbols.length === 0) return null;

    // Normalize symbols to array of {symbol, exchange} objects
    const subscriptions = symbols.map(sym => {
        if (typeof sym === 'string') {
            return { symbol: sym, exchange: 'NSE' };
        }
        return { symbol: sym.symbol, exchange: sym.exchange || 'NSE' };
    });

    return createManagedWebSocket(
        getWebSocketUrl,
        {
            subscriptions,
            mode: 2, // Quote mode - includes OHLC, volume, prev_close, etc.
            onMessage: (message) => {
                // Only process market_data messages
                if (message.type !== 'market_data' || !message.symbol) return;

                // Data is nested in message.data
                const data = message.data || {};
                const ltp = parseFloat(data.ltp || data.last_price || 0);
                const exchange = message.exchange || 'NSE';

                if (ltp > 0) {
                    // WebSocket mode 2 doesn't include prev_close, use cached value from initial quotes fetch
                    const cacheKey = `${message.symbol}:${exchange}`;
                    const cachedPrevClose = window._prevCloseCache?.[cacheKey];

                    // Use cached prev_close, fallback to open (if available), then ltp
                    const prevClose = cachedPrevClose || parseFloat(data.open || ltp);
                    const change = ltp - prevClose;
                    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

                    callback({
                        symbol: message.symbol,
                        exchange: exchange, // Include exchange for proper matching
                        last: ltp,
                        open: parseFloat(data.open || prevClose),
                        volume: parseFloat(data.volume || 0),
                        chg: change,
                        chgP: changePercent
                    });
                }
            }
        }
    );
};

/**
 * Search for symbols
 * @param {string} query - Search query
 * @param {string} exchange - Optional exchange filter (NSE, BSE, NFO, MCX, BFO, NSE_INDEX, BSE_INDEX)
 * @param {string} instrumenttype - Optional instrument type filter (EQ, FUT, CE, PE, OPTIDX, etc.)
 */
export const searchSymbols = async (query, exchange, instrumenttype) => {
    try {
        const requestBody = {
            apikey: getApiKey(),
            query
        };

        // Add exchange filter if specified
        if (exchange) {
            requestBody.exchange = exchange;
        }

        // Add instrumenttype filter if specified
        if (instrumenttype) {
            requestBody.instrumenttype = instrumenttype;
        }


        const response = await fetch(`${getApiBase()}/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = getLoginUrl();
                return [];
            }
            throw new Error(`OpenAlgo search error: ${response.status}`);
        }

        const data = await response.json();
        return data.data || data || [];
    } catch (error) {
        console.error('Error searching symbols:', error);
        return [];
    }
};

/**
 * Get available intervals from broker
 * Returns: { seconds: [...], minutes: [...], hours: [...], days: [...], weeks: [...], months: [...] }
 */
export const getIntervals = async () => {
    try {
        const response = await fetch(`${getApiBase()}/intervals`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                apikey: getApiKey()
            })
        });

        if (!response.ok) {
            console.warn('[OpenAlgo] Intervals API returned:', response.status);
            return null;
        }

        const data = await response.json();
        logger.debug('[OpenAlgo] Intervals response:', data);

        // API returns { data: { seconds: [...], minutes: [...], ... }, status: 'success' }
        if (data && data.data && data.status === 'success') {
            return data.data;
        }

        return null;
    } catch (error) {
        console.error('Error fetching intervals:', error);
        return null;
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
        const IST_OFFSET_SECONDS = 19800; // 5 hours 30 minutes in seconds

        if (data && data.data && Array.isArray(data.data)) {
            return data.data.map(d => {
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
 * Fetch all user chart preferences from Cloud Workspace
 * @returns {Promise<{data: Object|null, invalidApiKey: boolean}>} - Result with invalidApiKey flag
 */
export const fetchUserPreferences = async () => {
    try {
        const apiKey = getApiKey();
        const apiBase = getApiBase();

        logger.info('[OpenAlgo] fetchUserPreferences called');
        logger.debug('[OpenAlgo] API Key present:', !!apiKey, 'API Base:', apiBase);

        if (!apiKey) {
            logger.warn('[OpenAlgo] fetchUserPreferences: No API key found');
            return { data: null, invalidApiKey: true };
        }

        const url = `${apiBase}/chart?apikey=${encodeURIComponent(apiKey)}`;
        logger.info('[OpenAlgo] Fetching preferences from:', url);

        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include'
        });

        logger.info('[OpenAlgo] fetchUserPreferences response status:', response.status);

        if (!response.ok) {
            logger.warn('[OpenAlgo] Fetch preferences failed:', response.status, response.statusText);
            // 400, 401, 403 = Invalid API key
            if (response.status === 400 || response.status === 401 || response.status === 403) {
                return { data: null, invalidApiKey: true };
            }
            // Other errors - proceed with local state
            return { data: null, invalidApiKey: false };
        }

        const result = await response.json();
        // Response format: { status: 'success', data: {...prefs...} }
        const data = result.data || result;
        logger.info('[OpenAlgo] fetchUserPreferences received data:', Object.keys(data || {}));
        return { data, invalidApiKey: false };
    } catch (error) {
        logger.error('[OpenAlgo] Error fetching user preferences:', error);
        return { data: null, invalidApiKey: false };
    }
};

/**
 * Save user chart preferences to Cloud Workspace
 * @param {Object} preferences - Dictionary of preferences to save { key: value }
 */
export const saveUserPreferences = async (preferences) => {
    try {
        const apiKey = getApiKey();
        const apiBase = getApiBase();

        logger.info('[OpenAlgo] saveUserPreferences called with keys:', Object.keys(preferences || {}));
        logger.debug('[OpenAlgo] API Key present:', !!apiKey, 'API Base:', apiBase);

        if (!apiKey) {
            logger.warn('[OpenAlgo] saveUserPreferences: No API key found, returning false');
            return false;
        }

        const url = `${apiBase}/chart`;
        logger.info('[OpenAlgo] Saving preferences to:', url);

        // Include apikey in body along with preferences
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ apikey: apiKey, ...preferences })
        });

        logger.info('[OpenAlgo] saveUserPreferences response status:', response.status);

        if (!response.ok) {
            logger.warn('[OpenAlgo] Save preferences failed:', response.status, response.statusText);
            return false;
        }

        logger.info('[OpenAlgo] saveUserPreferences success!');
        return true;
    } catch (error) {
        logger.error('[OpenAlgo] Error saving user preferences:', error);
        return false;
    }
};

/**
 * Get Option Chain for an underlying
 * @param {string} underlying - Underlying symbol (e.g., NIFTY, BANKNIFTY, RELIANCE)
 * @param {string} exchange - Exchange code (NSE_INDEX, NSE, NFO, BSE_INDEX, BSE, BFO)
 * @param {string} expiryDate - Optional expiry date in DDMMMYY format (e.g., 30DEC25)
 * @param {number} strikeCount - Number of strikes above and below ATM (1-100)
 */
export const getOptionChain = async (underlying, exchange = 'NFO', expiryDate = null, strikeCount = 10) => {
    try {
        const requestBody = {
            apikey: getApiKey(),
            underlying,
            exchange,
            strike_count: strikeCount
        };

        // Add expiry_date if specified
        if (expiryDate) {
            requestBody.expiry_date = expiryDate;
        }

        logger.debug('[OpenAlgo] Option Chain request:', requestBody);

        const response = await fetch(`${getApiBase()}/optionchain`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = getLoginUrl();
                return null;
            }
            // 400 typically means the symbol doesn't have F&O trading
            if (response.status === 400) {
                const error = new Error(`Symbol does not support F&O trading`);
                error.code = 'NO_FO_SUPPORT';
                error.status = 400;
                throw error;
            }
            throw new Error(`OpenAlgo optionchain error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        logger.debug('[OpenAlgo] Option Chain response:', data);

        // Response format: { status, underlying, underlying_ltp, expiry_date, atm_strike, chain: [...] }
        if (data && data.status === 'success') {
            return {
                underlying: data.underlying,
                underlyingLTP: parseFloat(data.underlying_ltp || 0),
                underlyingPrevClose: parseFloat(data.underlying_prev_close || 0),
                expiryDate: data.expiry_date,
                atmStrike: parseFloat(data.atm_strike || 0),
                chain: data.chain || []
            };
        }

        return null;
    } catch (error) {
        console.error('Error fetching option chain:', error);
        return null;
    }
};

/**
 * Get Option Greeks for a specific option symbol
 * @param {string} symbol - Option symbol (e.g., NIFTY02DEC2526000CE)
 * @param {string} exchange - Exchange code (NFO, BFO, CDS, MCX)
 * @param {Object} options - Optional parameters (interest_rate, forward_price, etc.)
 */
export const getOptionGreeks = async (symbol, exchange = 'NFO', options = {}) => {
    try {
        const requestBody = {
            apikey: getApiKey(),
            symbol,
            exchange,
            ...options // interest_rate, forward_price, underlying_symbol, underlying_exchange, expiry_time
        };

        logger.debug('[OpenAlgo] Option Greeks request:', requestBody);

        const response = await fetch(`${getApiBase()}/optiongreeks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = getLoginUrl();
                return null;
            }
            throw new Error(`OpenAlgo optiongreeks error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        logger.debug('[OpenAlgo] Option Greeks response:', data);

        // Response includes: symbol, exchange, underlying, strike, option_type, expiry_date,
        // days_to_expiry, spot_price, option_price, implied_volatility, greeks: { delta, gamma, theta, vega, rho }
        if (data && data.status === 'success') {
            return {
                symbol: data.symbol,
                underlying: data.underlying,
                strike: parseFloat(data.strike || 0),
                optionType: data.option_type,
                expiryDate: data.expiry_date,
                daysToExpiry: data.days_to_expiry,
                spotPrice: parseFloat(data.spot_price || 0),
                optionPrice: parseFloat(data.option_price || 0),
                iv: parseFloat(data.implied_volatility || 0),
                greeks: data.greeks || {}
            };
        }

        return null;
    } catch (error) {
        console.error('Error fetching option greeks:', error);
        return null;
    }
};

export default {
    checkAuth,
    getKlines,
    getHistoricalKlines,
    getTickerPrice,
    subscribeToTicker,
    subscribeToMultiTicker,
    searchSymbols,
    getIntervals,
    fetchUserPreferences,
    saveUserPreferences,
    getOptionChain,
    getOptionGreeks
};
