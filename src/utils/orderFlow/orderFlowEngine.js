/**
 * Order Flow Engine
 * Core calculation algorithms for Order Flow analysis
 */

import { roundToStep, calculatePriceStep } from '../../services/tickDataService';

/**
 * Calculate delta for a footprint
 * @param {Map<number, Object>} footprint - Footprint data from aggregateTicksToFootprint
 * @returns {Object} - Delta statistics
 */
export const calculateDelta = (footprint) => {
    let totalBuyVolume = 0;
    let totalSellVolume = 0;
    let totalBuyTrades = 0;
    let totalSellTrades = 0;

    footprint.forEach(level => {
        totalBuyVolume += level.buyVolume;
        totalSellVolume += level.sellVolume;
        totalBuyTrades += level.buyTrades;
        totalSellTrades += level.sellTrades;
    });

    const delta = totalBuyVolume - totalSellVolume;
    const totalVolume = totalBuyVolume + totalSellVolume;
    const deltaPercent = totalVolume > 0 ? (delta / totalVolume) * 100 : 0;

    return {
        delta,
        deltaPercent,
        totalBuyVolume,
        totalSellVolume,
        totalVolume,
        totalBuyTrades,
        totalSellTrades,
        totalTrades: totalBuyTrades + totalSellTrades,
    };
};

/**
 * Calculate cumulative delta across multiple candles
 * @param {Array<{time: number, delta: number}>} deltas - Array of per-candle deltas
 * @returns {Array<{time: number, delta: number, cumulativeDelta: number}>}
 */
export const calculateCumulativeDelta = (deltas) => {
    let cumulativeDelta = 0;

    return deltas.map(d => {
        cumulativeDelta += d.delta;
        return {
            time: d.time,
            delta: d.delta,
            cumulativeDelta,
        };
    });
};

/**
 * Detect imbalances in footprint using diagonal comparison
 * Compares bid[i] vs ask[i+1] (and vice versa)
 * @param {Map<number, Object>} footprint - Footprint data
 * @param {number} ratio - Minimum ratio for imbalance (default 3)
 * @returns {Array<{price: number, type: 'buy'|'sell', ratio: number}>}
 */
export const detectImbalances = (footprint, ratio = 3) => {
    const imbalances = [];
    const levels = Array.from(footprint.keys()).sort((a, b) => b - a); // High to low

    for (let i = 0; i < levels.length - 1; i++) {
        const currentLevel = footprint.get(levels[i]);
        const nextLevel = footprint.get(levels[i + 1]);

        // Diagonal comparison: ask volume at level i vs bid volume at level i+1
        const askVolume = currentLevel.sellVolume; // Sells at this level (hitting bid)
        const bidVolume = nextLevel.buyVolume; // Buys at next level down (lifting ask)

        // Sell imbalance: asks significantly exceed bids at adjacent level
        if (askVolume > 0 && bidVolume > 0 && askVolume >= bidVolume * ratio) {
            imbalances.push({
                price: levels[i],
                type: 'sell',
                ratio: askVolume / bidVolume,
                volume: askVolume,
            });
            currentLevel.imbalance = 'sell';
        }

        // Buy imbalance: bids significantly exceed asks at adjacent level
        if (bidVolume > 0 && askVolume > 0 && bidVolume >= askVolume * ratio) {
            imbalances.push({
                price: levels[i + 1],
                type: 'buy',
                ratio: bidVolume / askVolume,
                volume: bidVolume,
            });
            nextLevel.imbalance = 'buy';
        }
    }

    return imbalances;
};

/**
 * Find stacked imbalances (consecutive imbalances of same type)
 * These form strong support/resistance zones
 * @param {Array} imbalances - From detectImbalances
 * @param {number} minStack - Minimum number of consecutive imbalances (default 3)
 * @returns {Array<{type: 'buy'|'sell', startPrice: number, endPrice: number, levels: number}>}
 */
export const findStackedImbalances = (imbalances, minStack = 3) => {
    const stacks = [];

    // Sort by price
    const sorted = [...imbalances].sort((a, b) => b.price - a.price);

    let currentStack = null;

    sorted.forEach(imbalance => {
        if (!currentStack || currentStack.type !== imbalance.type) {
            // Save previous stack if valid
            if (currentStack && currentStack.levels >= minStack) {
                stacks.push(currentStack);
            }
            // Start new stack
            currentStack = {
                type: imbalance.type,
                startPrice: imbalance.price,
                endPrice: imbalance.price,
                levels: 1,
                imbalances: [imbalance],
            };
        } else {
            // Extend current stack
            currentStack.endPrice = imbalance.price;
            currentStack.levels += 1;
            currentStack.imbalances.push(imbalance);
        }
    });

    // Don't forget last stack
    if (currentStack && currentStack.levels >= minStack) {
        stacks.push(currentStack);
    }

    return stacks;
};

/**
 * Calculate Point of Control (POC) - price level with highest volume
 * @param {Map<number, Object>} footprint
 * @returns {{price: number, volume: number}}
 */
export const calculatePOC = (footprint) => {
    let pocPrice = 0;
    let pocVolume = 0;

    footprint.forEach((level, price) => {
        const totalVolume = level.buyVolume + level.sellVolume;
        if (totalVolume > pocVolume) {
            pocVolume = totalVolume;
            pocPrice = price;
        }
    });

    return { price: pocPrice, volume: pocVolume };
};

/**
 * Calculate Value Area (VAH, VAL) - price range containing X% of volume
 * @param {Map<number, Object>} footprint
 * @param {number} percent - Percentage of volume (default 70)
 * @returns {{vah: number, val: number, poc: number, volumeInVA: number}}
 */
export const calculateValueArea = (footprint, percent = 70) => {
    // Get POC first
    const poc = calculatePOC(footprint);

    // Calculate total volume
    let totalVolume = 0;
    footprint.forEach(level => {
        totalVolume += level.buyVolume + level.sellVolume;
    });

    // Target volume for value area
    const targetVolume = totalVolume * (percent / 100);

    // Start from POC and expand outward
    const levels = Array.from(footprint.entries())
        .map(([price, data]) => ({
            price,
            volume: data.buyVolume + data.sellVolume,
        }))
        .sort((a, b) => a.price - b.price);

    const pocIndex = levels.findIndex(l => l.price === poc.price);
    if (pocIndex === -1) {
        return { vah: poc.price, val: poc.price, poc: poc.price, volumeInVA: poc.volume };
    }

    let volumeInVA = levels[pocIndex].volume;
    let upperIndex = pocIndex;
    let lowerIndex = pocIndex;

    // Expand outward from POC until target volume reached
    while (volumeInVA < targetVolume && (upperIndex < levels.length - 1 || lowerIndex > 0)) {
        const upperVolume = upperIndex < levels.length - 1 ? levels[upperIndex + 1].volume : 0;
        const lowerVolume = lowerIndex > 0 ? levels[lowerIndex - 1].volume : 0;

        if (upperVolume >= lowerVolume && upperIndex < levels.length - 1) {
            upperIndex++;
            volumeInVA += levels[upperIndex].volume;
        } else if (lowerIndex > 0) {
            lowerIndex--;
            volumeInVA += levels[lowerIndex].volume;
        } else if (upperIndex < levels.length - 1) {
            upperIndex++;
            volumeInVA += levels[upperIndex].volume;
        } else {
            break;
        }
    }

    return {
        vah: levels[upperIndex].price,
        val: levels[lowerIndex].price,
        poc: poc.price,
        volumeInVA,
    };
};

/**
 * Detect High Volume Nodes (HVN) and Low Volume Nodes (LVN)
 * @param {Map<number, Object>} footprint
 * @param {number} hvnThreshold - Percentile for HVN (default 80)
 * @param {number} lvnThreshold - Percentile for LVN (default 20)
 * @returns {{hvn: number[], lvn: number[]}}
 */
export const detectVolumeNodes = (footprint, hvnThreshold = 80, lvnThreshold = 20) => {
    const volumes = [];
    footprint.forEach((level, price) => {
        volumes.push({
            price,
            volume: level.buyVolume + level.sellVolume,
        });
    });

    // Sort by volume to find percentiles
    const sortedVolumes = [...volumes].sort((a, b) => a.volume - b.volume);
    const hvnCutoff = sortedVolumes[Math.floor(sortedVolumes.length * hvnThreshold / 100)]?.volume || 0;
    const lvnCutoff = sortedVolumes[Math.floor(sortedVolumes.length * lvnThreshold / 100)]?.volume || Infinity;

    const hvn = volumes.filter(v => v.volume >= hvnCutoff).map(v => v.price);
    const lvn = volumes.filter(v => v.volume <= lvnCutoff).map(v => v.price);

    return { hvn, lvn };
};

/**
 * Calculate Volume Profile from multiple footprints (composite/session)
 * @param {Array<Map<number, Object>>} footprints - Array of footprint maps
 * @returns {Map<number, Object>} - Aggregated volume profile
 */
export const calculateVolumeProfile = (footprints) => {
    const profile = new Map();

    footprints.forEach(footprint => {
        footprint.forEach((level, price) => {
            if (!profile.has(price)) {
                profile.set(price, {
                    price,
                    buyVolume: 0,
                    sellVolume: 0,
                    delta: 0,
                    trades: 0,
                });
            }

            const p = profile.get(price);
            p.buyVolume += level.buyVolume;
            p.sellVolume += level.sellVolume;
            p.delta = p.buyVolume - p.sellVolume;
            p.trades += level.trades;
        });
    });

    return profile;
};

/**
 * Detect power trades (large volume in short time)
 * @param {Array} ticks - Array of tick data
 * @param {number} volumeThreshold - Minimum volume for power trade
 * @param {number} timeWindowMs - Time window in milliseconds
 * @returns {Array<{time: number, price: number, volume: number, side: 'buy'|'sell'}>}
 */
export const detectPowerTrades = (ticks, volumeThreshold = 100, timeWindowMs = 5000) => {
    const powerTrades = [];

    if (ticks.length === 0) return powerTrades;

    // Sliding window aggregation
    let windowStart = 0;
    let windowVolume = 0;
    let windowBuyVolume = 0;
    let windowSellVolume = 0;
    let windowSumPriceVolume = 0;

    for (let i = 0; i < ticks.length; i++) {
        const tick = ticks[i];

        // Add current tick to window
        windowVolume += tick.volume;
        windowSumPriceVolume += tick.price * tick.volume;
        if (tick.side === 'buy') {
            windowBuyVolume += tick.volume;
        } else {
            windowSellVolume += tick.volume;
        }

        // Remove ticks outside window
        while (windowStart < i && ticks[i].time - ticks[windowStart].time > timeWindowMs) {
            const oldTick = ticks[windowStart];
            windowVolume -= oldTick.volume;
            windowSumPriceVolume -= oldTick.price * oldTick.volume;
            if (oldTick.side === 'buy') {
                windowBuyVolume -= oldTick.volume;
            } else {
                windowSellVolume -= oldTick.volume;
            }
            windowStart++;
        }

        // Check if window exceeds threshold
        if (windowVolume >= volumeThreshold) {
            const avgPrice = windowSumPriceVolume / windowVolume;
            const side = windowBuyVolume >= windowSellVolume ? 'buy' : 'sell';

            powerTrades.push({
                time: tick.time,
                price: avgPrice,
                volume: windowVolume,
                side,
                buyVolume: windowBuyVolume,
                sellVolume: windowSellVolume,
            });

            // Reset window after detecting power trade
            windowStart = i + 1;
            windowVolume = 0;
            windowBuyVolume = 0;
            windowSellVolume = 0;
            windowSumPriceVolume = 0;
        }
    }

    return powerTrades;
};

/**
 * Calculate VWAP for buy side only
 * @param {Array} ticks - Tick data
 * @returns {number}
 */
export const calculateBuyVWAP = (ticks) => {
    let sumPriceVolume = 0;
    let sumVolume = 0;

    ticks.forEach(tick => {
        if (tick.side === 'buy') {
            sumPriceVolume += tick.price * tick.volume;
            sumVolume += tick.volume;
        }
    });

    return sumVolume > 0 ? sumPriceVolume / sumVolume : 0;
};

/**
 * Calculate VWAP for sell side only
 * @param {Array} ticks - Tick data
 * @returns {number}
 */
export const calculateSellVWAP = (ticks) => {
    let sumPriceVolume = 0;
    let sumVolume = 0;

    ticks.forEach(tick => {
        if (tick.side === 'sell') {
            sumPriceVolume += tick.price * tick.volume;
            sumVolume += tick.volume;
        }
    });

    return sumVolume > 0 ? sumPriceVolume / sumVolume : 0;
};

/**
 * Calculate overall VWAP
 * @param {Array} ticks - Tick data
 * @returns {number}
 */
export const calculateVWAP = (ticks) => {
    let sumPriceVolume = 0;
    let sumVolume = 0;

    ticks.forEach(tick => {
        sumPriceVolume += tick.price * tick.volume;
        sumVolume += tick.volume;
    });

    return sumVolume > 0 ? sumPriceVolume / sumVolume : 0;
};

/**
 * Calculate bar statistics for a single candle
 * @param {Map<number, Object>} footprint
 * @param {Array} ticks - Ticks for this candle
 * @returns {Object}
 */
export const calculateBarStats = (footprint, ticks = []) => {
    const deltaStats = calculateDelta(footprint);
    const poc = calculatePOC(footprint);
    const va = calculateValueArea(footprint);

    // Calculate VWAPs if ticks available
    const vwap = calculateVWAP(ticks);
    const buyVwap = calculateBuyVWAP(ticks);
    const sellVwap = calculateSellVWAP(ticks);

    return {
        ...deltaStats,
        poc: poc.price,
        pocVolume: poc.volume,
        vah: va.vah,
        val: va.val,
        vwap,
        buyVwap,
        sellVwap,
    };
};

/**
 * Detect delta divergence (price vs delta moving in opposite directions)
 * @param {Array<{time: number, close: number, delta: number}>} data
 * @returns {Array<{time: number, type: 'bullish'|'bearish'}>}
 */
export const detectDeltaDivergence = (data) => {
    const divergences = [];

    for (let i = 1; i < data.length; i++) {
        const priceChange = data[i].close - data[i - 1].close;
        const deltaChange = data[i].delta - data[i - 1].delta;

        // Bullish divergence: price down but delta up
        if (priceChange < 0 && deltaChange > 0) {
            divergences.push({
                time: data[i].time,
                type: 'bullish',
                priceChange,
                deltaChange,
            });
        }

        // Bearish divergence: price up but delta down
        if (priceChange > 0 && deltaChange < 0) {
            divergences.push({
                time: data[i].time,
                type: 'bearish',
                priceChange,
                deltaChange,
            });
        }
    }

    return divergences;
};

/**
 * Get OI Sense signal based on price and OI changes
 * @param {number} priceChange - Price change percentage
 * @param {number} oiChange - Open Interest change percentage
 * @returns {{signal: string, color: string, description: string}}
 */
export const getOISenseSignal = (priceChange, oiChange) => {
    if (priceChange > 0 && oiChange > 0) {
        return {
            signal: 'longBuildup',
            color: '#4CAF50',
            description: 'Long Buildup - Price and OI increasing',
        };
    }
    if (priceChange < 0 && oiChange > 0) {
        return {
            signal: 'shortBuildup',
            color: '#F44336',
            description: 'Short Buildup - Price down, OI increasing',
        };
    }
    if (priceChange > 0 && oiChange < 0) {
        return {
            signal: 'shortCovering',
            color: '#FF9800',
            description: 'Short Covering - Price up, OI decreasing',
        };
    }
    if (priceChange < 0 && oiChange < 0) {
        return {
            signal: 'longUnwinding',
            color: '#00BCD4',
            description: 'Long Unwinding - Price and OI decreasing',
        };
    }

    return {
        signal: 'neutral',
        color: '#9E9E9E',
        description: 'Neutral - No significant change',
    };
};

export default {
    calculateDelta,
    calculateCumulativeDelta,
    detectImbalances,
    findStackedImbalances,
    calculatePOC,
    calculateValueArea,
    detectVolumeNodes,
    calculateVolumeProfile,
    detectPowerTrades,
    calculateBuyVWAP,
    calculateSellVWAP,
    calculateVWAP,
    calculateBarStats,
    detectDeltaDivergence,
    getOISenseSignal,
};
