/**
 * Tick Aggregator Module
 * Utilities for footprint calculation and tick statistics
 */

import { getTicksInRange, getTickStore } from '../services/tickStore.js';

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
 * @param {Array} ticks - Array of ticks within the candle period
 * @param {number} priceStep - Price level step size
 * @returns {Map} Map of price level to footprint data
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
 * @returns {Map} Footprint data
 */
export const calculateFootprintForCandle = (symbol, exchange, candleStartTime, candleEndTime, priceStep) => {
    // Convert to milliseconds for tick comparison
    const fromTime = candleStartTime * 1000;
    const toTime = candleEndTime * 1000;

    const ticks = getTicksInRange(symbol, exchange, fromTime, toTime);
    return aggregateTicksToFootprint(ticks, priceStep);
};

/**
 * Get tick statistics for a symbol
 * @param {string} symbol
 * @param {string} exchange
 * @returns {Object} Statistics
 */
export const getTickStats = (symbol, exchange) => {
    const key = `${symbol}:${exchange}`;
    const tickStore = getTickStore();
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
    calculatePriceStep,
    roundToStep,
    aggregateTicksToFootprint,
    calculateFootprintForCandle,
    getTickStats,
};
