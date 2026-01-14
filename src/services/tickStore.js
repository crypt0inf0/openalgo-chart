/**
 * Tick Store Module
 * Manages tick data storage and listeners
 */

import logger from '../utils/logger.js';

// Maximum ticks to keep in memory per symbol (circular buffer)
const MAX_TICKS_IN_MEMORY = 10000;

// Tick data storage per symbol
const tickStore = new Map();

/**
 * Initialize tick store for a symbol
 * @param {string} symbol
 * @param {string} exchange
 * @returns {Object} Store object
 */
export const initTickStore = (symbol, exchange) => {
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
 * @param {Object} tick - Tick data
 */
export const addTick = (symbol, exchange, tick) => {
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
            logger.debug('[TickStore] Error in tick listener:', error);
        }
    });
};

/**
 * Get ticks for a symbol within a time range
 * @param {string} symbol
 * @param {string} exchange
 * @param {number} fromTime - Start time in milliseconds
 * @param {number} toTime - End time in milliseconds
 * @returns {Array} Ticks in range
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
 * @returns {Array} All ticks
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
 * @returns {function} Unsubscribe function
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
 * Get the raw tick store (for internal use)
 * @returns {Map}
 */
export const getTickStore = () => tickStore;

export default {
    initTickStore,
    addTick,
    getTicksInRange,
    getAllTicks,
    addTickListener,
    clearTickData,
    getTickStore,
    MAX_TICKS_IN_MEMORY,
};
