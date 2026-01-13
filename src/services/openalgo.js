/**
 * OpenAlgo API Service
 * Handles chart data fetching and WebSocket connections for OpenAlgo backend
 */

import logger from '../utils/logger.js';
import { ConnectionState, setConnectionStatus } from './connectionStatus';
import {
    DEFAULT_HOST,
    DEFAULT_WS_HOST,
    getHostUrl,
    shouldUseProxy,
    getApiBase,
    getLoginUrl,
    getWebSocketUrl,
    checkAuth,
    getApiKey,
    convertInterval
} from './apiConfig';
// Re-export drawings service for backwards compatibility
export { saveDrawings, loadDrawings } from './drawingsService';
// Re-export options API service for backwards compatibility
export { getExpiry, getOptionChain, getOptionGreeks, getMultiOptionGreeks, fetchExpiryDates } from './optionsApiService';
// Re-export instrument service for backwards compatibility
export { searchSymbols, getInstruments, getLotSize, getInstrumentInfo, clearInstrumentCache, getIntervals } from './instrumentService';
// Re-export preferences service for backwards compatibility
export { fetchUserPreferences, saveUserPreferences } from './preferencesService';
// Re-export chart data service for backwards compatibility
export { getKlines, getHistoricalKlines, getTickerPrice, getDepth, getCachedPrevClose } from './chartDataService';

// Re-export config utilities for backwards compatibility
export { getHostUrl, shouldUseProxy, getApiBase, getLoginUrl, checkAuth, getApiKey };

// Import and re-export account services for backwards compatibility
import {
    ping as pingService,
    getFunds as getFundsService,
    getPositionBook as getPositionBookService,
    getOrderBook as getOrderBookService,
    getTradeBook as getTradeBookService,
    getHoldings as getHoldingsService
} from './accountService';
export { pingService as ping, getFundsService as getFunds, getPositionBookService as getPositionBook, getOrderBookService as getOrderBook, getTradeBookService as getTradeBook, getHoldingsService as getHoldings };

// Import and re-export order services for backwards compatibility
import {
    placeOrder as placeOrderService,
    modifyOrder as modifyOrderService,
    cancelOrder as cancelOrderService
} from './orderService';
export { placeOrderService as placeOrder, modifyOrderService as modifyOrder, cancelOrderService as cancelOrder };

/**
 * Global registry of active WebSocket connections
 * Used for cleanup on app exit (beforeunload)
 */
const activeWebSockets = new Set();

// Import getCachedPrevClose for WebSocket subscriptions
import { getCachedPrevClose } from './chartDataService';

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

        const url = `ws://${localStorage.getItem('oa_ws_url') || DEFAULT_WS_HOST}`;
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

        // Warn if API key is missing
        if (!apiKey) {
            console.warn('[WebSocket] No API key found! Set your API key in Settings or run: localStorage.setItem("oa_apikey", "YOUR_KEY")');
        }

        console.log('[WebSocket] Connecting to:', url);

        try {
            socket = new WebSocket(url);
        } catch (error) {
            console.error('[WebSocket] Failed to create WebSocket:', error);
            setConnectionStatus(ConnectionState.DISCONNECTED);
            return;
        }

        socket.onopen = () => {
            console.log('[WebSocket] Connected, authenticating...');
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
                    console.log('[WebSocket] ✓ Authenticated successfully, broker:', message.broker || 'unknown');
                    authenticated = true;
                    setConnectionStatus(ConnectionState.CONNECTED);
                    sendSubscriptions();
                    return;
                }

                // Handle auth error
                if (message.type === 'error' || (message.type === 'auth' && message.status !== 'success')) {
                    console.error('[WebSocket] ✗ Authentication failed:', message.message || message.code || 'Unknown error');
                    setConnectionStatus(ConnectionState.DISCONNECTED);
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

        socket.onerror = () => {
            console.error('[WebSocket] ✗ Connection error - check if OpenAlgo WebSocket server is running on port 8765');
        };

        socket.onclose = (event) => {
            authenticated = false;
            if (manualClose) {
                console.log('[WebSocket] Connection closed');
                setConnectionStatus(ConnectionState.DISCONNECTED);
                return;
            }

            console.warn('[WebSocket] Connection closed unexpectedly, code:', event.code, 'reason:', event.reason || 'none');

            if (!event.wasClean && reconnectAttempts < maxAttempts) {
                const delay = Math.min(1000 * 2 ** reconnectAttempts, 10000);
                console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxAttempts})`);
                setConnectionStatus(ConnectionState.RECONNECTING);
                reconnectAttempts += 1;
                setTimeout(connect, delay);
            } else {
                console.error('[WebSocket] ✗ Max reconnection attempts reached or clean close');
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

// IST offset for consistent time display
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
            const cachedPrevClose = getCachedPrevClose(message.symbol, exchange);

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

// Note: getKlines, getHistoricalKlines, getTickerPrice, getDepth are now in chartDataService.js
// They are re-exported at the top of this file for backwards compatibility

// Note: Options API functions (getExpiry, getOptionChain, getOptionGreeks, getMultiOptionGreeks, fetchExpiryDates)
// are now in optionsApiService.js and re-exported at the top of this file

// Note: saveDrawings and loadDrawings are now in drawingsService.js
// They are re-exported at the top of this file for backwards compatibility

// Note: fetchUserPreferences and saveUserPreferences are now in preferencesService.js
// They are re-exported at the top of this file for backwards compatibility

// Import from instrumentService for default export
import { searchSymbols, getIntervals } from './instrumentService';
// Import from optionsApiService for default export
import { getOptionChain, getOptionGreeks, getMultiOptionGreeks, fetchExpiryDates } from './optionsApiService';
// Import from drawingsService for default export
import { saveDrawings, loadDrawings } from './drawingsService';
// Import from preferencesService for default export
import { fetchUserPreferences, saveUserPreferences } from './preferencesService';
// Import from chartDataService for default export
import { getKlines, getHistoricalKlines, getTickerPrice } from './chartDataService';

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
    ping: pingService,
    getFunds: getFundsService,
    getPositionBook: getPositionBookService,
    getOrderBook: getOrderBookService,
    getTradeBook: getTradeBookService,
    getHoldings: getHoldingsService,
    placeOrder: placeOrderService,
    modifyOrder: modifyOrderService,
    cancelOrder: cancelOrderService
};
