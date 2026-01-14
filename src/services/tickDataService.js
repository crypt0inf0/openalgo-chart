/**
 * Tick Data Service for Order Flow Analysis
 * Handles tick-level data subscription, aggregation, and footprint calculation
 */

import logger from '../utils/logger.js';

// Import constants from dedicated module
import {
    WS_MODES,
    DEFAULT_WS_HOST,
    MAX_RECONNECT_ATTEMPTS,
    BASE_RECONNECT_DELAY_MS,
    MAX_RECONNECT_DELAY_MS,
} from './tickConstants.js';

// Re-export WS_MODES for backward compatibility
export { WS_MODES };

// Maximum ticks to keep in memory per symbol (circular buffer)
const MAX_TICKS_IN_MEMORY = 10000;

// Active tick subscriptions
const tickSubscriptions = new Map();

// Tick data storage per symbol
const tickStore = new Map();

/**
 * Get WebSocket URL
 * Auto-detects protocol and uses Vite proxy in development
 */
const getWebSocketUrl = () => {
    const wsHost = localStorage.getItem('oa_ws_url') || DEFAULT_WS_HOST;

    // Check if we're in local development with default WebSocket host
    const isDefaultWsHost = wsHost === DEFAULT_WS_HOST || wsHost === '127.0.0.1:8765' || wsHost === 'localhost:8765';
    const isLocalDev = typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    // Use Vite proxy in development for localhost
    if (isDefaultWsHost && isLocalDev) {
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        return `${protocol}://${window.location.host}/ws`;
    }

    // For custom hosts, auto-detect protocol
    const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const protocol = isSecure ? 'wss' : 'ws';
    return `${protocol}://${wsHost}`;
};

/**
 * Get API Key from localStorage
 */
const getApiKey = () => {
    return localStorage.getItem('oa_apikey') || '';
};

/**
 * Tick data structure
 * @typedef {Object} Tick
 * @property {number} time - Milliseconds timestamp
 * @property {number} price - Trade price
 * @property {number} volume - Trade volume
 * @property {'buy'|'sell'} side - Aggressor side (who lifted offer/hit bid)
 * @property {number} [bid] - Best bid at time of trade
 * @property {number} [ask] - Best ask at time of trade
 */

/**
 * Footprint level data structure
 * @typedef {Object} FootprintLevel
 * @property {number} price - Price level
 * @property {number} buyVolume - Volume from buy aggressors
 * @property {number} sellVolume - Volume from sell aggressors
 * @property {number} delta - buyVolume - sellVolume
 * @property {number} trades - Number of trades at this level
 * @property {number} buyTrades - Number of buy trades
 * @property {number} sellTrades - Number of sell trades
 * @property {'buy'|'sell'|null} imbalance - Imbalance direction if detected
 */

/**
 * Initialize tick store for a symbol
 * @param {string} symbol
 * @param {string} exchange
 */
const initTickStore = (symbol, exchange) => {
    const key = `${symbol}:${exchange}`;
    if (!tickStore.has(key)) {
        tickStore.set(key, {
            ticks: [],
            footprints: new Map(), // Keyed by candle start time
            listeners: new Set(),
        });
    }
    return tickStore.get(key);
};

/**
 * Add a tick to the store (circular buffer)
 * @param {string} symbol
 * @param {string} exchange
 * @param {Tick} tick
 */
const addTick = (symbol, exchange, tick) => {
    const store = initTickStore(symbol, exchange);

    // Add to circular buffer
    store.ticks.push(tick);
    if (store.ticks.length > MAX_TICKS_IN_MEMORY) {
        store.ticks.shift();
    }

    // Notify listeners
    store.listeners.forEach(listener => {
        try {
            listener(tick);
        } catch (error) {
            logger.debug('[TickService] Error in tick listener:', error);
        }
    });
};

/**
 * Get ticks for a symbol within a time range
 * @param {string} symbol
 * @param {string} exchange
 * @param {number} fromTime - Start time in milliseconds
 * @param {number} toTime - End time in milliseconds
 * @returns {Tick[]}
 */
export const getTicksInRange = (symbol, exchange, fromTime, toTime) => {
    const key = `${symbol}:${exchange}`;
    const store = tickStore.get(key);
    if (!store) return [];

    return store.ticks.filter(tick => tick.time >= fromTime && tick.time <= toTime);
};

/**
 * Get all stored ticks for a symbol
 * @param {string} symbol
 * @param {string} exchange
 * @returns {Tick[]}
 */
export const getAllTicks = (symbol, exchange) => {
    const key = `${symbol}:${exchange}`;
    const store = tickStore.get(key);
    return store ? [...store.ticks] : [];
};

/**
 * Add a tick listener for real-time updates
 * @param {string} symbol
 * @param {string} exchange
 * @param {function} listener
 */
export const addTickListener = (symbol, exchange, listener) => {
    const store = initTickStore(symbol, exchange);
    store.listeners.add(listener);

    return () => {
        store.listeners.delete(listener);
    };
};

/**
 * Clear tick data for a symbol
 * @param {string} symbol
 * @param {string} exchange
 */
export const clearTickData = (symbol, exchange) => {
    const key = `${symbol}:${exchange}`;
    tickStore.delete(key);
};

/**
 * Calculate price step (tick size) based on price
 * @param {number} price
 * @returns {number}
 */
export const calculatePriceStep = (price) => {
    if (price < 50) return 0.05;
    if (price < 250) return 0.05;
    if (price < 500) return 0.10;
    if (price < 1000) return 0.25;
    if (price < 5000) return 0.50;
    if (price < 10000) return 1.00;
    return 5.00;
};

/**
 * Round price to nearest price step
 * @param {number} price
 * @param {number} step
 * @returns {number}
 */
export const roundToStep = (price, step) => {
    return Math.round(price / step) * step;
};

/**
 * Aggregate ticks into footprint data for a candle
 * @param {Tick[]} ticks - Array of ticks within the candle period
 * @param {number} priceStep - Price level step size
 * @returns {Map<number, FootprintLevel>} - Map of price level to footprint data
 */
export const aggregateTicksToFootprint = (ticks, priceStep) => {
    const footprint = new Map();

    ticks.forEach(tick => {
        const level = roundToStep(tick.price, priceStep);

        if (!footprint.has(level)) {
            footprint.set(level, {
                price: level,
                buyVolume: 0,
                sellVolume: 0,
                delta: 0,
                trades: 0,
                buyTrades: 0,
                sellTrades: 0,
                imbalance: null,
            });
        }

        const fp = footprint.get(level);
        fp.trades += 1;

        if (tick.side === 'buy') {
            fp.buyVolume += tick.volume;
            fp.buyTrades += 1;
        } else {
            fp.sellVolume += tick.volume;
            fp.sellTrades += 1;
        }

        fp.delta = fp.buyVolume - fp.sellVolume;
    });

    return footprint;
};

/**
 * Calculate footprint for a specific candle time range
 * @param {string} symbol
 * @param {string} exchange
 * @param {number} candleStartTime - Candle start time in seconds (UTC)
 * @param {number} candleEndTime - Candle end time in seconds (UTC)
 * @param {number} priceStep - Price level step size
 * @returns {Map<number, FootprintLevel>}
 */
export const calculateFootprintForCandle = (symbol, exchange, candleStartTime, candleEndTime, priceStep) => {
    // Convert to milliseconds for tick comparison
    const fromTime = candleStartTime * 1000;
    const toTime = candleEndTime * 1000;

    const ticks = getTicksInRange(symbol, exchange, fromTime, toTime);
    return aggregateTicksToFootprint(ticks, priceStep);
};

/**
 * Subscribe to real-time tick data via WebSocket (Mode 3)
 * @param {string} symbol - Trading symbol
 * @param {string} exchange - Exchange code
 * @param {function} callback - Callback for each tick
 * @returns {Object} - WebSocket manager with close() method
 */
export const subscribeToTicks = (symbol, exchange = 'NSE', callback) => {
    const key = `${symbol}:${exchange}`;

    // Initialize store
    const store = initTickStore(symbol, exchange);

    let socket = null;
    let manualClose = false;
    let reconnectAttempts = 0;
    let authenticated = false;
    const maxAttempts = 5;
    const apiKey = getApiKey();

    const sendSubscription = () => {
        if (!socket || socket.readyState !== WebSocket.OPEN || !authenticated) return;

        const subscribeMsg = {
            action: 'subscribe',
            symbol: symbol,
            exchange: exchange,
            mode: WS_MODES.TICK  // Mode 3 for tick data
        };
        logger.debug('[TickService] Subscribing to ticks:', subscribeMsg);
        socket.send(JSON.stringify(subscribeMsg));
    };

    const sendUnsubscription = () => {
        if (!socket || socket.readyState !== WebSocket.OPEN) return;

        const unsubscribeMsg = {
            action: 'unsubscribe',
            symbol: symbol,
            exchange: exchange
        };
        logger.debug('[TickService] Unsubscribing from ticks:', unsubscribeMsg);
        try {
            socket.send(JSON.stringify(unsubscribeMsg));
        } catch (error) {
            logger.debug('[TickService] Error sending unsubscribe:', error);
        }
    };

    const connect = () => {
        const url = getWebSocketUrl();
        authenticated = false;

        try {
            socket = new WebSocket(url);
        } catch (error) {
            console.error('[TickService] Failed to create WebSocket:', error);
            return;
        }

        socket.onopen = () => {
            logger.debug('[TickService] Connected, authenticating...');
            reconnectAttempts = 0;

            const authMsg = {
                action: 'authenticate',
                api_key: apiKey
            };
            socket.send(JSON.stringify(authMsg));
        };

        socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

                // Handle ping
                if (message.type === 'ping') {
                    socket.send(JSON.stringify({ type: 'pong' }));
                    return;
                }

                // Handle authentication response
                if ((message.type === 'auth' && message.status === 'success') ||
                    message.type === 'authenticated' ||
                    message.status === 'authenticated') {
                    logger.debug('[TickService] Authenticated successfully');
                    authenticated = true;
                    sendSubscription();
                    return;
                }

                // Handle auth error
                if (message.type === 'error' || (message.type === 'auth' && message.status !== 'success')) {
                    console.error('[TickService] Error:', message.message || message.code);
                    return;
                }

                // Handle tick data
                // Expected format: { type: 'tick_data', symbol, tick: { time, price, volume, side, bid, ask } }
                // Or fallback to market_data with additional fields
                if (message.type === 'tick_data' && message.symbol === symbol) {
                    const tickData = message.tick || message.data;
                    if (tickData) {
                        const tick = {
                            time: tickData.time || Date.now(),
                            price: parseFloat(tickData.price || tickData.ltp || 0),
                            volume: parseFloat(tickData.volume || tickData.qty || 1),
                            side: tickData.side || (tickData.buyer_initiated ? 'buy' : 'sell'),
                            bid: parseFloat(tickData.bid || 0),
                            ask: parseFloat(tickData.ask || 0),
                        };

                        if (tick.price > 0) {
                            // Store the tick
                            addTick(symbol, exchange, tick);

                            // Call the callback
                            if (callback) {
                                callback(tick);
                            }
                        }
                    }
                }

                // Fallback: Handle market_data messages and infer tick from OHLC changes
                // This is a graceful degradation when true tick data isn't available
                if (message.type === 'market_data' && message.symbol === symbol) {
                    const data = message.data || {};
                    const ltp = parseFloat(data.ltp || data.last_price || 0);
                    const volume = parseFloat(data.volume || data.last_traded_qty || 1);

                    // Infer trade direction from LTP vs bid/ask if available
                    let side = 'buy';
                    if (data.bid && data.ask) {
                        const mid = (parseFloat(data.bid) + parseFloat(data.ask)) / 2;
                        side = ltp >= mid ? 'buy' : 'sell';
                    }

                    if (ltp > 0) {
                        const tick = {
                            time: data.timestamp || Date.now(),
                            price: ltp,
                            volume: volume,
                            side: side,
                            bid: parseFloat(data.bid || 0),
                            ask: parseFloat(data.ask || 0),
                        };

                        addTick(symbol, exchange, tick);

                        if (callback) {
                            callback(tick);
                        }
                    }
                }
            } catch (error) {
                console.error('[TickService] Error parsing message:', error);
            }
        };

        socket.onerror = (error) => {
            console.error('[TickService] Error:', error);
        };

        socket.onclose = (event) => {
            authenticated = false;
            if (manualClose) return;

            if (!event.wasClean && reconnectAttempts < maxAttempts) {
                const delay = Math.min(1000 * 2 ** reconnectAttempts, 10000);
                logger.debug(`[TickService] Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxAttempts})`);
                reconnectAttempts += 1;
                setTimeout(connect, delay);
            }
        };
    };

    connect();

    // Store subscription
    tickSubscriptions.set(key, { socket, close: null });

    // Return managed WebSocket interface
    const managedWs = {
        close: () => {
            manualClose = true;
            tickSubscriptions.delete(key);

            if (socket && socket.readyState === WebSocket.OPEN) {
                sendUnsubscription();
                setTimeout(() => {
                    if (socket && socket.readyState === WebSocket.OPEN) {
                        socket.close();
                    }
                }, 100);
            }
        },

        forceClose: () => {
            manualClose = true;
            tickSubscriptions.delete(key);
            if (socket) {
                try {
                    socket.close();
                } catch (e) {
                    // Ignore
                }
            }
        }
    };

    tickSubscriptions.get(key).close = managedWs.close;

    return managedWs;
};

/**
 * Close all tick subscriptions
 */
export const closeAllTickSubscriptions = () => {
    tickSubscriptions.forEach((sub, key) => {
        try {
            if (sub.close) sub.close();
        } catch (error) {
            logger.debug('[TickService] Error closing subscription:', key, error);
        }
    });
    tickSubscriptions.clear();
};

/**
 * Get tick statistics for a symbol
 * @param {string} symbol
 * @param {string} exchange
 * @returns {Object}
 */
export const getTickStats = (symbol, exchange) => {
    const key = `${symbol}:${exchange}`;
    const store = tickStore.get(key);

    if (!store || store.ticks.length === 0) {
        return {
            tickCount: 0,
            buyVolume: 0,
            sellVolume: 0,
            delta: 0,
            avgPrice: 0,
            minPrice: 0,
            maxPrice: 0,
        };
    }

    let buyVolume = 0;
    let sellVolume = 0;
    let totalPrice = 0;
    let minPrice = Infinity;
    let maxPrice = -Infinity;

    store.ticks.forEach(tick => {
        if (tick.side === 'buy') {
            buyVolume += tick.volume;
        } else {
            sellVolume += tick.volume;
        }
        totalPrice += tick.price * tick.volume;
        minPrice = Math.min(minPrice, tick.price);
        maxPrice = Math.max(maxPrice, tick.price);
    });

    const totalVolume = buyVolume + sellVolume;

    return {
        tickCount: store.ticks.length,
        buyVolume,
        sellVolume,
        delta: buyVolume - sellVolume,
        avgPrice: totalVolume > 0 ? totalPrice / totalVolume : 0,
        minPrice: minPrice === Infinity ? 0 : minPrice,
        maxPrice: maxPrice === -Infinity ? 0 : maxPrice,
    };
};

export default {
    subscribeToTicks,
    getTicksInRange,
    getAllTicks,
    addTickListener,
    clearTickData,
    aggregateTicksToFootprint,
    calculateFootprintForCandle,
    calculatePriceStep,
    roundToStep,
    getTickStats,
    closeAllTickSubscriptions,
    WS_MODES,
};
