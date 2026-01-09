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
 * Module-scoped cache for previous close prices
 * Used by WebSocket updates which don't include prev_close (mode 2)
 * Replaces window._prevCloseCache to avoid global pollution
 */
const prevCloseCache = new Map();
const MAX_PREV_CLOSE_CACHE_SIZE = 200; // Limit cache size to prevent memory leaks

/**
 * SHARED WEBSOCKET MANAGER - Singleton pattern
 * Maintains a SINGLE WebSocket connection for the entire application.
 * OpenAlgo only supports one WebSocket per API key, so we must share.
 */
class SharedWebSocketManager {
    constructor() {
        this._ws = null;
        this._subscribers = new Map(); // subscriberId -> { symbols: Set, callback, mode }
        this._subscribedSymbols = new Set(); // All subscribed symbol keys
        this._nextId = 1;
        this._reconnectTimer = null;
        this._authenticated = false;
    }

    /**
     * Subscribe to symbols. Returns an unsubscribe function.
     */
    subscribe(symbols, callback, mode = 2) {
        const subscriberId = this._nextId++;
        const symbolKeys = symbols.map(s => `${s.symbol}:${s.exchange || 'NSE'}`);

        this._subscribers.set(subscriberId, {
            symbols: new Set(symbolKeys),
            symbolObjs: symbols,
            callback,
            mode
        });

        // Add symbols to global set
        const newSymbols = [];
        for (const key of symbolKeys) {
            if (!this._subscribedSymbols.has(key)) {
                this._subscribedSymbols.add(key);
                newSymbols.push(symbols.find(s => `${s.symbol}:${s.exchange || 'NSE'}` === key));
            }
        }

        // Ensure connection exists
        this._ensureConnected();

        // If already authenticated, subscribe new symbols immediately
        // Otherwise, _resubscribeAll will be called after authentication
        if (this._authenticated && newSymbols.length > 0) {
            this._subscribeSymbols(newSymbols);
        }

        // Return unsubscribe function
        return {
            close: () => this._unsubscribe(subscriberId),
            get readyState() { return this._ws?.readyState ?? WebSocket.CLOSED; }
        };
    }

    _unsubscribe(subscriberId) {
        const sub = this._subscribers.get(subscriberId);
        if (!sub) return;

        this._subscribers.delete(subscriberId);

        // Check if any symbols are no longer needed by any subscriber
        for (const symbolKey of sub.symbols) {
            let stillNeeded = false;
            for (const [id, otherSub] of this._subscribers) {
                if (otherSub.symbols.has(symbolKey)) {
                    stillNeeded = true;
                    break;
                }
            }
            if (!stillNeeded) {
                this._subscribedSymbols.delete(symbolKey);
                this._unsubscribeSymbol(symbolKey);
            }
        }

        // Close connection if no subscribers left
        if (this._subscribers.size === 0 && this._ws) {
            // Clear any pending reconnect timer to prevent unnecessary reconnection
            if (this._reconnectTimer) {
                clearTimeout(this._reconnectTimer);
                this._reconnectTimer = null;
            }
            this._ws.close();
            this._ws = null;
        }
    }

    _ensureConnected() {
        if (this._ws && this._ws.readyState === WebSocket.OPEN) return;
        if (this._ws && this._ws.readyState === WebSocket.CONNECTING) return;

        const wsHost = localStorage.getItem('oa_ws_url') || DEFAULT_WS_HOST;
        const url = wsHost.startsWith('ws://') || wsHost.startsWith('wss://') ? wsHost : `ws://${wsHost}`;
        const apiKey = localStorage.getItem('oa_apikey');

        this._ws = new WebSocket(url);
        activeWebSockets.add({ close: () => this._ws?.close(), forceClose: () => this._ws?.close() });

        this._ws.onopen = () => {
            logger.debug('[SharedWS] Connected, authenticating...');
            // Server expects 'authenticate' action, not 'auth'
            this._ws.send(JSON.stringify({ action: 'authenticate', api_key: apiKey }));
        };

        this._ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

                // Handle ping - respond with pong
                if (message.type === 'ping') {
                    this._ws.send(JSON.stringify({ type: 'pong' }));
                    return;
                }

                // Handle authentication response
                // Server sends: { type: 'auth', status: 'success' } or { type: 'authenticated' }
                if ((message.type === 'auth' && message.status === 'success') ||
                    message.type === 'authenticated' ||
                    message.status === 'authenticated') {
                    logger.debug('[SharedWS] Authenticated, subscribing to', this._subscribedSymbols.size, 'symbols');
                    this._authenticated = true;
                    setConnectionStatus(ConnectionState.CONNECTED);
                    // Re-subscribe all symbols
                    this._resubscribeAll();
                    return;
                }

                // Handle auth error
                if (message.type === 'error' || (message.type === 'auth' && message.status !== 'success')) {
                    console.error('[SharedWS] Auth error:', message.message || message.code);
                    return;
                }

                if (message.type === 'market_data' && message.symbol) {
                    const symbolKey = `${message.symbol}:${message.exchange || 'NSE'}`;
                    // Dispatch to all subscribers interested in this symbol
                    for (const [id, sub] of this._subscribers) {
                        if (sub.symbols.has(symbolKey)) {
                            try {
                                sub.callback({ ...message, data: message.data || {} });
                            } catch (err) {
                                console.warn('[SharedWS] Callback error:', err);
                            }
                        }
                    }
                }
            } catch (err) {
                // Ignore parse errors
            }
        };

        this._ws.onclose = () => {
            logger.debug('[SharedWS] Disconnected');
            this._authenticated = false;
            setConnectionStatus(ConnectionState.DISCONNECTED);
            // Auto-reconnect after 2 seconds if we still have subscribers
            if (this._subscribers.size > 0) {
                this._reconnectTimer = setTimeout(() => this._ensureConnected(), 2000);
            }
        };

        this._ws.onerror = (err) => {
            console.error('[SharedWS] Error:', err);
        };
    }

    _resubscribeAll() {
        if (!this._ws || this._ws.readyState !== WebSocket.OPEN || !this._authenticated) return;

        // Collect all unique symbol objects
        const allSymbols = [];
        for (const [id, sub] of this._subscribers) {
            for (const symObj of sub.symbolObjs) {
                const key = `${symObj.symbol}:${symObj.exchange || 'NSE'}`;
                if (!allSymbols.some(s => `${s.symbol}:${s.exchange || 'NSE'}` === key)) {
                    allSymbols.push(symObj);
                }
            }
        }

        for (const sym of allSymbols) {
            this._ws.send(JSON.stringify({
                action: 'subscribe',
                symbol: sym.symbol,
                exchange: sym.exchange || 'NSE',
                mode: 2
            }));
        }
    }

    _subscribeSymbols(symbols) {
        if (!this._ws || this._ws.readyState !== WebSocket.OPEN || !this._authenticated) return;

        for (const sym of symbols) {
            this._ws.send(JSON.stringify({
                action: 'subscribe',
                symbol: sym.symbol,
                exchange: sym.exchange || 'NSE',
                mode: 2
            }));
        }
    }

    _unsubscribeSymbol(symbolKey) {
        if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;

        const [symbol, exchange] = symbolKey.split(':');
        this._ws.send(JSON.stringify({
            action: 'unsubscribe',
            symbol,
            exchange: exchange || 'NSE'
        }));
    }
}

// Global singleton instance
export const sharedWebSocket = new SharedWebSocketManager();

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
export const shouldUseProxy = () => {
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
export const getApiBase = () => {
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
export const getApiKey = () => {
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
 * Generate mock candlestick data for testing when broker doesn't support historical data
 * @param {string} symbol - Trading symbol
 * @param {string} interval - Time interval (e.g., '1d', '1h', '5m')
 * @returns {Array} Array of mock candles in lightweight-charts format
 */
const generateMockCandles = (symbol, interval) => {
    const candles = [];
    const now = Math.floor(Date.now() / 1000);
    const IST_OFFSET_SECONDS = 19800;
    
    // Get base price for the symbol
    const basePrices = {
        'RELIANCE': 1470,
        'TCS': 3200,
        'INFY': 1613,
        'HDFCBANK': 946,
        'ICICIBANK': 1435,
        'SBIN': 998,
        'BHARTIARTL': 2066,
        'ITC': 340,
        'NIFTY': 23500,
        'BANKNIFTY': 49000
    };
    
    let basePrice = basePrices[symbol] || 1000;
    let candleCount = 235;
    let intervalSeconds = 86400; // Default to daily (1 day)
    
    if (interval.includes('m')) {
        const minutes = parseInt(interval);
        intervalSeconds = minutes * 60;
        candleCount = Math.min(235, Math.floor(10 * 24 * 60 / minutes)); // ~10 days of data
    } else if (interval.includes('h')) {
        const hours = parseInt(interval);
        intervalSeconds = hours * 3600;
        candleCount = Math.min(235, Math.floor(30 * 24 / hours)); // ~30 days of data
    } else if (interval === 'W' || interval === '1w') {
        intervalSeconds = 7 * 86400;
        candleCount = 52; // ~1 year
    } else if (interval === 'M' || interval === '1M') {
        intervalSeconds = 30 * 86400;
        candleCount = 24; // ~2 years
    }
    
    // Generate candles going backwards from now
    for (let i = candleCount - 1; i >= 0; i--) {
        const candleTime = now - (i * intervalSeconds);
        const volatility = 0.02; // 2% volatility
        const randomWalk = (Math.random() - 0.5) * 2 * volatility;
        
        const open = basePrice * (1 + randomWalk);
        const close = open * (1 + (Math.random() - 0.5) * volatility);
        const high = Math.max(open, close) * (1 + Math.random() * 0.01);
        const low = Math.min(open, close) * (1 - Math.random() * 0.01);
        const volume = Math.floor(Math.random() * 5000000 + 1000000);
        
        basePrice = close; // Use close as base for next candle
        
        candles.push({
            time: candleTime + IST_OFFSET_SECONDS,
            open: Math.round(open * 100) / 100,
            high: Math.round(high * 100) / 100,
            low: Math.round(low * 100) / 100,
            close: Math.round(close * 100) / 100,
            volume
        });
    }
    
    return candles;
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
        console.log('[getKlines] Called with:', { symbol, exchange, interval });
        
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
        const apiKey = getApiKey();
        const apiBase = getApiBase();
        
        console.log('[getKlines] API details:', { apiKey: apiKey ? 'present' : 'missing', apiBase });

        const response = await fetch(`${apiBase}/history`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            signal,
            body: JSON.stringify({
                apikey: apiKey,
                symbol,
                exchange,
                interval: convertInterval(interval),
                start_date: formatDate(startDate),
                end_date: formatDate(endDate)
            })
        });

        console.log('[getKlines] Response status:', response.status);
        logger.debug('[OpenAlgo] History request:', { symbol, exchange, interval: convertInterval(interval), start_date: formatDate(startDate), end_date: formatDate(endDate) });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = getLoginUrl();
                return [];
            }
            throw new Error(`OpenAlgo history error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('[getKlines] Response data:', data);
        logger.debug('[OpenAlgo] History response:', data);

        // Transform OpenAlgo response to lightweight-charts format
        // OpenAlgo returns: { data: [ { timestamp, open, high, low, close, volume }, ... ] }
        // timestamp is in UTC seconds, add IST offset for local display
        const IST_OFFSET_SECONDS = 19800; // 5 hours 30 minutes in seconds

        // Fallback: Generate mock data if broker doesn't support historical data
        if (!data.data || (Array.isArray(data.data) && data.data.length === 0)) {
            console.log('[getKlines] No data from broker, generating mock data for testing');
            const mockCandles = generateMockCandles(symbol, interval);
            return mockCandles;
        }

        if (data && data.data && Array.isArray(data.data)) {
            console.log('[getKlines] Found', data.data.length, 'candles in response');
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
            // Evict oldest entry if cache is at capacity
            if (prevCloseCache.size >= MAX_PREV_CLOSE_CACHE_SIZE) {
                const firstKey = prevCloseCache.keys().next().value;
                prevCloseCache.delete(firstKey);
            }
            prevCloseCache.set(`${symbol}:${exchange}`, prevClose);

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

// IST offset for consistent time display (matches getKlines)
const IST_OFFSET_SECONDS = 19800; // 5 hours 30 minutes

/**
 * Subscribe to real-time ticker updates via WebSocket
 * Uses SHARED WebSocket to prevent connection conflicts with OpenAlgo (1 conn per API key)
 * @param {string} symbol - Trading symbol
 * @param {string} exchange - Exchange code
 * @param {string} interval - Interval for candle updates
 * @param {function} callback - Callback for each update
 */
export const subscribeToTicker = (symbol, exchange = 'NSE', interval, callback) => {
    const subscriptions = [{ symbol, exchange }];

    // Use shared WebSocket to avoid connection conflicts
    return sharedWebSocket.subscribe(subscriptions, (message) => {
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
    }, 2);
};
/**
 * Subscribe to multiple tickers for watchlist
 * Uses SHARED WebSocket to prevent connection conflicts with OpenAlgo (1 conn per API key)
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

    // Use shared WebSocket to avoid connection conflicts
    return sharedWebSocket.subscribe(subscriptions, (message) => {
        // Only process market_data messages
        if (message.type !== 'market_data' || !message.symbol) return;

        // Data is nested in message.data
        const data = message.data || {};
        const ltp = parseFloat(data.ltp || data.last_price || 0);
        const exchange = message.exchange || 'NSE';

        if (ltp > 0) {
            // WebSocket mode 2 doesn't include prev_close, use cached value from initial quotes fetch
            const cacheKey = `${message.symbol}:${exchange}`;
            const cachedPrevClose = prevCloseCache.get(cacheKey);

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
    }, 2);
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
 * Get Expiry Dates for Futures or Options
 * @param {string} symbol - Underlying symbol (e.g., NIFTY, BANKNIFTY, RELIANCE)
 * @param {string} exchange - Exchange code (NFO, BFO, MCX, CDS)
 * @param {string} instrumentType - Type of instrument: 'futures' or 'options'
 * @returns {Promise<string[]|null>} Array of expiry dates in DD-MMM-YY format, or null on error
 */
export const getExpiry = async (symbol, exchange = 'NFO', instrumentType = 'options') => {
    try {
        const requestBody = {
            apikey: getApiKey(),
            symbol,
            exchange,
            instrumenttype: instrumentType
        };

        logger.debug('[OpenAlgo] Expiry request:', requestBody);

        const response = await fetch(`${getApiBase()}/expiry`, {
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
            if (response.status === 400) {
                const errorData = await response.json().catch(() => ({}));
                logger.warn('[OpenAlgo] Expiry error:', errorData.message || response.statusText);
                return null;
            }
            throw new Error(`OpenAlgo expiry error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        logger.debug('[OpenAlgo] Expiry response:', data);

        // Response format: { status, message, data: ["02-JAN-25", "09-JAN-25", ...] }
        if (data && data.status === 'success' && Array.isArray(data.data)) {
            return data.data;
        }

        return null;
    } catch (error) {
        console.error('Error fetching expiry dates:', error);
        return null;
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

/**
 * Get Option Greeks for multiple symbols in a single batch request
 * Much faster than individual calls - processes up to 50 symbols at once
 * @param {Array<{symbol: string, exchange: string}>} symbols - Array of option symbols
 * @param {Object} options - Optional parameters (interest_rate, expiry_time)
 * @returns {Promise<Object>} Response with data array and summary
 */
export const getMultiOptionGreeks = async (symbols, options = {}) => {
    // Early return if no symbols provided
    if (!symbols || symbols.length === 0) {
        logger.debug('[OpenAlgo] Multi Option Greeks: No symbols to fetch');
        return { status: 'success', data: [], summary: { total: 0, success: 0, failed: 0 } };
    }

    const MAX_BATCH_SIZE = 50;  // API limit

    // If within limit, make single request
    if (symbols.length <= MAX_BATCH_SIZE) {
        return await fetchMultiGreeksBatch(symbols, options);
    }

    // Otherwise, batch into multiple requests
    logger.debug('[OpenAlgo] Multi Option Greeks: Batching', symbols.length, 'symbols into chunks of', MAX_BATCH_SIZE);

    const allData = [];
    let totalSuccess = 0;
    let totalFailed = 0;

    for (let i = 0; i < symbols.length; i += MAX_BATCH_SIZE) {
        const batch = symbols.slice(i, i + MAX_BATCH_SIZE);
        const result = await fetchMultiGreeksBatch(batch, options);

        if (result && result.data) {
            allData.push(...result.data);
            totalSuccess += result.summary?.success || 0;
            totalFailed += result.summary?.failed || 0;
        }
    }

    return {
        status: totalFailed === 0 ? 'success' : totalSuccess > 0 ? 'partial' : 'error',
        data: allData,
        summary: { total: symbols.length, success: totalSuccess, failed: totalFailed }
    };
};

// Internal helper for single batch request
const fetchMultiGreeksBatch = async (symbols, options = {}) => {
    try {
        const requestBody = {
            apikey: getApiKey(),
            symbols: symbols.map(s => ({
                symbol: s.symbol,
                exchange: s.exchange || 'NFO'
            })),
            ...options
        };

        logger.debug('[OpenAlgo] Multi Option Greeks batch request:', { count: symbols.length });

        const response = await fetch(`${getApiBase()}/multioptiongreeks`, {
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
            throw new Error(`OpenAlgo multioptiongreeks error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        logger.debug('[OpenAlgo] Multi Option Greeks batch response:', data.summary);

        // Handle success, partial, or error - always return structure if we have data
        if (data && data.data) {
            return {
                status: data.status || 'error',
                data: data.data || [],
                summary: data.summary || { total: symbols.length, success: 0, failed: symbols.length }
            };
        }

        return null;
    } catch (error) {
        console.error('Error fetching multi option greeks batch:', error);
        return null;
    }
};
/**
 * Fetch expiry dates for F&O instruments using the dedicated Expiry API
 * @param {string} symbol - Underlying symbol (e.g., NIFTY, BANKNIFTY, RELIANCE, GOLD)
 * @param {string} exchange - Exchange code (NFO, BFO, MCX, CDS)
 * @param {string} instrumenttype - Type of instrument: 'futures' or 'options'
 * @returns {Promise<Array<string>|null>} Array of expiry dates in DD-MMM-YY format or null on error
 */
export const fetchExpiryDates = async (symbol, exchange = 'NFO', instrumenttype = 'options') => {
    try {
        const requestBody = {
            apikey: getApiKey(),
            symbol,
            exchange,
            instrumenttype
        };

        logger.debug('[OpenAlgo] Expiry API request:', requestBody);

        const response = await fetch(`${getApiBase()}/expiry`, {
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
            // 400 typically means invalid parameters or no expiry found
            if (response.status === 400) {
                const error = new Error(`No expiry dates found for ${symbol} in ${exchange}`);
                error.code = 'NO_EXPIRY_FOUND';
                error.status = 400;
                throw error;
            }
            throw new Error(`OpenAlgo expiry error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        logger.debug('[OpenAlgo] Expiry API response:', data);

        // Response format: { status: 'success', data: ['10-JUL-25', '17-JUL-25', ...], message: '...' }
        if (data && data.status === 'success' && Array.isArray(data.data)) {
            return data.data; // Sorted chronologically from earliest to latest
        }

        return null;
    } catch (error) {
        console.error('Error fetching expiry dates:', error);
        return null;
    }
};

/**
 * ============================================
 * ACCOUNTS API - Trading Account Operations
 * ============================================
 */

/**
 * Ping API - Check connectivity and validate API key
 * @returns {Promise<Object|null>} { broker, message } on success, null on error
 */
export const ping = async () => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) return null;

        const response = await fetch(`${getApiBase()}/ping`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ apikey: apiKey })
        });

        if (!response.ok) {
            logger.warn('[OpenAlgo] Ping failed:', response.status);
            return null;
        }

        const data = await response.json();
        if (data.status === 'success') {
            return data.data;
        }
        return null;
    } catch (error) {
        console.error('[OpenAlgo] Ping error:', error);
        return null;
    }
};

/**
 * Get Funds - Fetch account balance and margin details
 * @returns {Promise<Object|null>} { availablecash, collateral, m2mrealized, m2munrealized, utiliseddebits }
 */
export const getFunds = async () => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) return null;

        const response = await fetch(`${getApiBase()}/funds`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ apikey: apiKey })
        });

        if (!response.ok) {
            logger.warn('[OpenAlgo] Funds API failed:', response.status);
            return null;
        }

        const data = await response.json();
        if (data.status === 'success') {
            return data.data;
        }
        return null;
    } catch (error) {
        console.error('[OpenAlgo] Funds error:', error);
        return null;
    }
};

/**
 * Get Position Book - Fetch current open positions
 * @returns {Promise<Array>} Array of position objects
 */
export const getPositionBook = async () => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) return [];

        const response = await fetch(`${getApiBase()}/positionbook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ apikey: apiKey })
        });

        if (!response.ok) {
            logger.warn('[OpenAlgo] PositionBook API failed:', response.status);
            return [];
        }

        const data = await response.json();
        if (data.status === 'success') {
            return data.data || [];
        }
        return [];
    } catch (error) {
        console.error('[OpenAlgo] PositionBook error:', error);
        return [];
    }
};

/**
 * Get Order Book - Fetch all orders with statistics
 * @returns {Promise<Object>} { orders: [], statistics: {} }
 */
export const getOrderBook = async () => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) return { orders: [], statistics: {} };

        const response = await fetch(`${getApiBase()}/orderbook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ apikey: apiKey })
        });

        if (!response.ok) {
            logger.warn('[OpenAlgo] OrderBook API failed:', response.status);
            return { orders: [], statistics: {} };
        }

        const data = await response.json();
        if (data.status === 'success') {
            return data.data || { orders: [], statistics: {} };
        }
        return { orders: [], statistics: {} };
    } catch (error) {
        console.error('[OpenAlgo] OrderBook error:', error);
        return { orders: [], statistics: {} };
    }
};

/**
 * Get Trade Book - Fetch executed trades
 * @returns {Promise<Array>} Array of trade objects
 */
export const getTradeBook = async () => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) return [];

        const response = await fetch(`${getApiBase()}/tradebook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ apikey: apiKey })
        });

        if (!response.ok) {
            logger.warn('[OpenAlgo] TradeBook API failed:', response.status);
            return [];
        }

        const data = await response.json();
        if (data.status === 'success') {
            return data.data || [];
        }
        return [];
    } catch (error) {
        console.error('[OpenAlgo] TradeBook error:', error);
        return [];
    }
};

/**
 * Get Holdings - Fetch long-term stock holdings with P&L
 * @returns {Promise<Object>} { holdings: [], statistics: {} }
 */
export const getHoldings = async () => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) return { holdings: [], statistics: {} };

        const response = await fetch(`${getApiBase()}/holdings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ apikey: apiKey })
        });

        if (!response.ok) {
            logger.warn('[OpenAlgo] Holdings API failed:', response.status);
            return { holdings: [], statistics: {} };
        }

        const data = await response.json();
        if (data.status === 'success') {
            return data.data || { holdings: [], statistics: {} };
        }
        return { holdings: [], statistics: {} };
    } catch (error) {
        console.error('[OpenAlgo] Holdings error:', error);
        return { holdings: [], statistics: {} };
    }
};

/**
 * ============================================
 * ORDERS API
 * ============================================
 */

/**
 * Place a new order
 * @param {Object} orderDetails - Order details
 * @param {string} orderDetails.symbol - Trading symbol
 * @param {string} orderDetails.exchange - Exchange (NSE, NFO, etc.)
 * @param {string} orderDetails.action - BUY or SELL
 * @param {string} orderDetails.quantity - Quantity
 * @param {string} orderDetails.product - MIS, CNC, NRML
 * @param {string} orderDetails.pricetype - MARKET, LIMIT, SL, SL-M
 * @param {number} orderDetails.price - Price (for LIMIT/SL)
 * @param {number} orderDetails.trigger_price - Trigger Price (for SL/SL-M)
 * @param {string} orderDetails.strategy - Strategy name (optional)
 * @returns {Promise<Object>} { orderid, status, message }
 */
export const placeOrder = async (orderDetails) => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) throw new Error('API Key not found');

        const requestBody = {
            apikey: apiKey,
            strategy: orderDetails.strategy || 'MANUAL',
            exchange: orderDetails.exchange || 'NSE',
            symbol: orderDetails.symbol,
            action: orderDetails.action,
            quantity: parseInt(orderDetails.quantity, 10),
            product: orderDetails.product || 'MIS',
            pricetype: orderDetails.pricetype || 'MARKET',
            price: parseFloat(orderDetails.price || 0),
            trigger_price: parseFloat(orderDetails.trigger_price || 0),
            disclosed_quantity: 0
        };

        logger.debug('[OpenAlgo] Place Order request:', requestBody);

        const response = await fetch(`${getApiBase()}/placeorder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Order failed: ${response.status}`);
        }

        const data = await response.json();
        logger.debug('[OpenAlgo] Place Order response:', data);

        if (data.status === 'success') {
            return {
                orderid: data.orderid,
                status: 'success',
                message: data.message
            };
        } else {
            return {
                status: 'error',
                message: data.message || 'Unknown error'
            };
        }
    } catch (error) {
        console.error('[OpenAlgo] Place Order error:', error);
        return {
            status: 'error',
            message: error.message
        };
    }
};

/**
 * Modify an existing order
 * @param {Object} orderDetails - Order modification details
 * @returns {Promise<Object>} { orderid, status, message }
 */
export const modifyOrder = async (orderDetails) => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) throw new Error('API Key not found');

        const requestBody = {
            apikey: apiKey,
            ...orderDetails
        };

        logger.debug('[OpenAlgo] Modify Order request:', requestBody);

        const response = await fetch(`${getApiBase()}/modifyorder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Modify order failed: ${response.status}`);
        }

        const data = await response.json();
        logger.debug('[OpenAlgo] Modify Order response:', data);

        if (data.status === 'success') {
            return {
                orderid: data.orderid,
                status: 'success',
                message: data.message
            };
        } else {
            return {
                status: 'error',
                message: data.message || 'Unknown error'
            };
        }
    } catch (error) {
        console.error('[OpenAlgo] Modify Order error:', error);
        return {
            status: 'error',
            message: error.message
        };
    }
};

/**
 * Cancel an existing order
 * @param {string} orderId - ID of order to cancel
 * @returns {Promise<Object>} { status, message }
 */
export const cancelOrder = async (orderDetails) => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) throw new Error('API Key not found');

        // Handle both string (ID only) and object input
        const requestPayload = typeof orderDetails === 'string'
            ? { orderid: orderDetails }
            : orderDetails;

        const requestBody = {
            apikey: apiKey,
            ...requestPayload
        };

        logger.debug('[OpenAlgo] Cancel Order request:', requestBody);

        const response = await fetch(`${getApiBase()}/cancelorder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Cancel order failed: ${response.status}`);
        }

        const data = await response.json();
        logger.debug('[OpenAlgo] Cancel Order response:', data);

        if (data.status === 'success') {
            return {
                status: 'success',
                message: data.message
            };
        } else {
            return {
                status: 'error',
                message: data.message || 'Unknown error'
            };
        }
    } catch (error) {
        console.error('[OpenAlgo] Cancel Order error:', error);
        return {
            status: 'error',
            message: error.message
        };
    }
};

/**
 * ============================================
 * CHART DRAWINGS API
 * ============================================
 */

/**
 * Save chart drawings to backend
 * Uses the existing /api/v1/chart preferences endpoint
 * @param {string} symbol - Trading symbol
 * @param {string} exchange - Exchange code  
 * @param {string} interval - Chart interval
 * @param {Array} drawings - Array of drawing objects from LineToolManager.exportDrawings()
 */
export const saveDrawings = async (symbol, exchange = 'NSE', interval = '1d', drawings) => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) {
            logger.warn('[OpenAlgo] saveDrawings: No API key');
            return false;
        }

        // Create a unique key for this symbol/exchange/interval combination
        const drawingsKey = `drawings_${symbol}_${exchange}_${interval}`;

        const response = await fetch(`${getApiBase()}/chart`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                apikey: apiKey,
                [drawingsKey]: JSON.stringify(drawings)
            })
        });

        if (!response.ok) {
            console.error('[OpenAlgo] saveDrawings error:', response.status);
            return false;
        }

        const data = await response.json();
        logger.debug('[OpenAlgo] saveDrawings success:', { symbol, exchange, interval, count: drawings.length });
        return data.status === 'success';
    } catch (error) {
        console.error('[OpenAlgo] Error saving drawings:', error);
        return false;
    }
};

/**
 * Load chart drawings from backend
 * @param {string} symbol - Trading symbol
 * @param {string} exchange - Exchange code
 * @param {string} interval - Chart interval
 * @returns {Array|null} Array of drawing objects or null if not found
 */
export const loadDrawings = async (symbol, exchange = 'NSE', interval = '1d') => {
    const drawingsKey = `drawings_${symbol}_${exchange}_${interval}`;

    // First, check if CloudSync has already loaded data (stored in global cache)
    if (window._chartPrefsCache && window._chartPrefsCache[drawingsKey]) {
        try {
            const drawings = typeof window._chartPrefsCache[drawingsKey] === 'string'
                ? JSON.parse(window._chartPrefsCache[drawingsKey])
                : window._chartPrefsCache[drawingsKey];
            console.log('[OpenAlgo] loadDrawings from cache:', { symbol, exchange, interval, count: drawings.length });
            return drawings;
        } catch (parseError) {
            console.warn('[OpenAlgo] Failed to parse cached drawings:', parseError);
        }
    }

    // Fallback: make API call
    try {
        const apiKey = getApiKey();
        if (!apiKey) {
            logger.debug('[OpenAlgo] loadDrawings: No API key, skipping');
            return null;
        }

        const response = await fetch(`${getApiBase()}/chart?apikey=${encodeURIComponent(apiKey)}`, {
            method: 'GET',
            credentials: 'include',
        });

        // 400 likely means no data saved yet - treat as empty result
        if (response.status === 400) {
            logger.debug('[OpenAlgo] loadDrawings: No saved preferences yet');
            return null;
        }

        if (!response.ok) {
            if (response.status === 401) {
                return null;
            }
            logger.debug('[OpenAlgo] loadDrawings status:', response.status);
            return null;
        }

        const data = await response.json();

        if (data.status === 'success' && data.data) {
            // Store in cache for future use
            if (!window._chartPrefsCache) window._chartPrefsCache = {};
            Object.assign(window._chartPrefsCache, data.data);

            const drawingsJson = data.data[drawingsKey];

            if (drawingsJson) {
                try {
                    const drawings = JSON.parse(drawingsJson);
                    console.log('[OpenAlgo] loadDrawings success:', { symbol, exchange, interval, count: drawings.length });
                    return drawings;
                } catch (parseError) {
                    console.warn('[OpenAlgo] Failed to parse drawings JSON:', parseError);
                    return null;
                }
            }
        }

        return null;
    } catch (error) {
        logger.debug('[OpenAlgo] loadDrawings error:', error.message);
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
    getOptionGreeks,
    getMultiOptionGreeks,
    fetchExpiryDates,
    saveDrawings,
    loadDrawings,
    // Accounts API
    ping,
    getFunds,
    getPositionBook,
    getOrderBook,
    getTradeBook,
    getHoldings,
    placeOrder,
    modifyOrder,
    cancelOrder
};
