/**
 * Web Worker for Heavy Indicator Calculations
 * Offloads CPU-intensive calculations from the main thread
 *
 * Supported indicators:
 * - TPO (Time Price Opportunity) Profile
 * - Volume Profile
 * - Footprint Chart (future)
 */

// Import indicator calculation functions
// Note: In a Web Worker, we need to inline or use importScripts
// Since we're using Vite module workers, we can use imports

/**
 * TPO Calculation (simplified version for worker)
 * Full implementation is in src/utils/indicators/tpo.js
 */
const BLOCK_SIZE_MAP = {
    '15m': 15,
    '30m': 30,
    '1h': 60,
    '2h': 120,
    '4h': 240
};

const parseBlockSize = (blockSize) => {
    if (typeof blockSize === 'number') return blockSize;
    return BLOCK_SIZE_MAP[blockSize] || 30;
};

const calculateAutoTickSize = (data) => {
    if (!data || data.length === 0) return 1;

    let minPrice = Infinity;
    let maxPrice = 0;

    for (const candle of data) {
        minPrice = Math.min(minPrice, candle.low);
        maxPrice = Math.max(maxPrice, candle.high);
    }

    const avgPrice = (minPrice + maxPrice) / 2;
    const range = maxPrice - minPrice;

    let tickSize;
    if (avgPrice < 10) tickSize = 0.05;
    else if (avgPrice < 50) tickSize = 0.1;
    else if (avgPrice < 100) tickSize = 0.25;
    else if (avgPrice < 500) tickSize = 0.5;
    else if (avgPrice < 1000) tickSize = 1;
    else if (avgPrice < 5000) tickSize = 2;
    else if (avgPrice < 10000) tickSize = 5;
    else tickSize = 10;

    const estimatedLevels = range / tickSize;
    if (estimatedLevels > 200) tickSize *= 2;
    else if (estimatedLevels > 100) tickSize *= 1.5;
    else if (estimatedLevels < 20 && tickSize > 0.05) tickSize /= 2;

    return Math.max(0.01, tickSize);
};

const quantizePrice = (price, tickSize) => {
    return Math.round(price / tickSize) * tickSize;
};

const getPriceLevels = (low, high, tickSize) => {
    const levels = [];
    const quantizedLow = quantizePrice(low, tickSize);
    const quantizedHigh = quantizePrice(high, tickSize);

    for (let price = quantizedLow; price <= quantizedHigh + tickSize / 2; price += tickSize) {
        levels.push(Math.round(price * 1000000) / 1000000);
    }
    return levels;
};

/**
 * Calculate TPO Profile for given data
 */
const calculateTPOProfile = (data, options = {}) => {
    const {
        blockSize = '30m',
        tickSize = 'auto',
        valueAreaPercent = 70,
        sessionStart = 9 * 60 + 15, // 9:15 IST
        sessionEnd = 15 * 60 + 30,  // 15:30 IST
    } = options;

    if (!data || data.length === 0) {
        return { sessions: [], error: null };
    }

    const periodMinutes = parseBlockSize(blockSize);
    const calculatedTickSize = tickSize === 'auto' ? calculateAutoTickSize(data) : parseFloat(tickSize);

    // Group data by session (day)
    const sessionMap = new Map();

    for (const candle of data) {
        const timestamp = candle.time * 1000;
        const date = new Date(timestamp);
        const dateKey = date.toISOString().split('T')[0];

        if (!sessionMap.has(dateKey)) {
            sessionMap.set(dateKey, []);
        }
        sessionMap.get(dateKey).push(candle);
    }

    const sessions = [];
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    for (const [dateKey, sessionData] of sessionMap) {
        if (sessionData.length === 0) continue;

        // Sort by time
        sessionData.sort((a, b) => a.time - b.time);

        // Build TPO map: priceLevel -> array of letters
        const tpoMap = new Map();
        let letterIndex = 0;
        let prevPeriodStart = null;

        for (const candle of sessionData) {
            const timestamp = candle.time * 1000;
            const periodStart = Math.floor(timestamp / (periodMinutes * 60 * 1000)) * (periodMinutes * 60 * 1000);

            // New period = new letter
            if (prevPeriodStart !== periodStart) {
                letterIndex = letterIndex < letters.length - 1 ? letterIndex + 1 : 0;
                if (prevPeriodStart === null) letterIndex = 0;
                prevPeriodStart = periodStart;
            }

            const letter = letters[letterIndex];
            const priceLevels = getPriceLevels(candle.low, candle.high, calculatedTickSize);

            for (const price of priceLevels) {
                const priceKey = price.toFixed(6);
                if (!tpoMap.has(priceKey)) {
                    tpoMap.set(priceKey, []);
                }
                const tpos = tpoMap.get(priceKey);
                if (!tpos.includes(letter)) {
                    tpos.push(letter);
                }
            }
        }

        // Calculate statistics
        let maxTpoCount = 0;
        let pocPrice = 0;
        let totalTpos = 0;
        const priceLevelStats = [];

        for (const [priceKey, tpos] of tpoMap) {
            const price = parseFloat(priceKey);
            const count = tpos.length;
            totalTpos += count;

            priceLevelStats.push({ price, count, letters: tpos });

            if (count > maxTpoCount) {
                maxTpoCount = count;
                pocPrice = price;
            }
        }

        // Sort by price descending
        priceLevelStats.sort((a, b) => b.price - a.price);

        // Calculate Value Area (70% of TPOs around POC)
        const targetTpos = Math.floor(totalTpos * (valueAreaPercent / 100));
        let vaHighPrice = pocPrice;
        let vaLowPrice = pocPrice;
        let vaTpos = priceLevelStats.find(p => Math.abs(p.price - pocPrice) < calculatedTickSize / 2)?.count || 0;

        const pocIndex = priceLevelStats.findIndex(p => Math.abs(p.price - pocPrice) < calculatedTickSize / 2);
        let upIndex = pocIndex - 1;
        let downIndex = pocIndex + 1;

        while (vaTpos < targetTpos && (upIndex >= 0 || downIndex < priceLevelStats.length)) {
            const upTpos = upIndex >= 0 ? priceLevelStats[upIndex].count : 0;
            const downTpos = downIndex < priceLevelStats.length ? priceLevelStats[downIndex].count : 0;

            if (upTpos >= downTpos && upIndex >= 0) {
                vaTpos += upTpos;
                vaHighPrice = priceLevelStats[upIndex].price;
                upIndex--;
            } else if (downIndex < priceLevelStats.length) {
                vaTpos += downTpos;
                vaLowPrice = priceLevelStats[downIndex].price;
                downIndex++;
            } else {
                break;
            }
        }

        // Get session high/low
        const sessionHigh = Math.max(...sessionData.map(c => c.high));
        const sessionLow = Math.min(...sessionData.map(c => c.low));

        sessions.push({
            date: dateKey,
            startTime: sessionData[0].time,
            endTime: sessionData[sessionData.length - 1].time,
            poc: pocPrice,
            vah: vaHighPrice,
            val: vaLowPrice,
            high: sessionHigh,
            low: sessionLow,
            tickSize: calculatedTickSize,
            tpoMap: Object.fromEntries(tpoMap),
            priceLevels: priceLevelStats,
            totalTpos
        });
    }

    return { sessions, tickSize: calculatedTickSize };
};

/**
 * Calculate Volume Profile
 */
const calculateVolumeProfile = (data, options = {}) => {
    const {
        rowCount = 24,
        valueAreaPercent = 70
    } = options;

    if (!data || data.length === 0) {
        return { profile: [], poc: 0, vah: 0, val: 0 };
    }

    // Find price range
    let minPrice = Infinity;
    let maxPrice = 0;
    let totalVolume = 0;

    for (const candle of data) {
        minPrice = Math.min(minPrice, candle.low);
        maxPrice = Math.max(maxPrice, candle.high);
        totalVolume += candle.volume || 0;
    }

    const priceRange = maxPrice - minPrice;
    const rowHeight = priceRange / rowCount;

    // Build volume by price level
    const volumeByLevel = new Array(rowCount).fill(0);

    for (const candle of data) {
        const candleVolume = candle.volume || 0;
        const candleRange = candle.high - candle.low || rowHeight;

        // Distribute volume across price levels the candle touched
        for (let i = 0; i < rowCount; i++) {
            const levelLow = minPrice + i * rowHeight;
            const levelHigh = levelLow + rowHeight;

            if (candle.high >= levelLow && candle.low <= levelHigh) {
                // Portion of candle in this level
                const overlapLow = Math.max(candle.low, levelLow);
                const overlapHigh = Math.min(candle.high, levelHigh);
                const overlapRatio = (overlapHigh - overlapLow) / candleRange;
                volumeByLevel[i] += candleVolume * overlapRatio;
            }
        }
    }

    // Find POC (level with max volume)
    let maxVolume = 0;
    let pocIndex = 0;

    for (let i = 0; i < rowCount; i++) {
        if (volumeByLevel[i] > maxVolume) {
            maxVolume = volumeByLevel[i];
            pocIndex = i;
        }
    }

    const poc = minPrice + (pocIndex + 0.5) * rowHeight;

    // Calculate Value Area
    const targetVolume = totalVolume * (valueAreaPercent / 100);
    let vaVolume = volumeByLevel[pocIndex];
    let vaHighIndex = pocIndex;
    let vaLowIndex = pocIndex;

    while (vaVolume < targetVolume) {
        const upVol = vaHighIndex < rowCount - 1 ? volumeByLevel[vaHighIndex + 1] : 0;
        const downVol = vaLowIndex > 0 ? volumeByLevel[vaLowIndex - 1] : 0;

        if (upVol >= downVol && vaHighIndex < rowCount - 1) {
            vaHighIndex++;
            vaVolume += upVol;
        } else if (vaLowIndex > 0) {
            vaLowIndex--;
            vaVolume += downVol;
        } else {
            break;
        }
    }

    const vah = minPrice + (vaHighIndex + 1) * rowHeight;
    const val = minPrice + vaLowIndex * rowHeight;

    // Build profile array
    const profile = volumeByLevel.map((volume, i) => ({
        price: minPrice + (i + 0.5) * rowHeight,
        priceLow: minPrice + i * rowHeight,
        priceHigh: minPrice + (i + 1) * rowHeight,
        volume,
        percent: totalVolume > 0 ? (volume / totalVolume) * 100 : 0,
        isPoc: i === pocIndex,
        isValueArea: i >= vaLowIndex && i <= vaHighIndex
    }));

    return { profile, poc, vah, val, totalVolume };
};

/**
 * Message handler
 */
self.onmessage = (event) => {
    const { type, id, data, options } = event.data;

    try {
        let result;

        switch (type) {
            case 'tpo':
                result = calculateTPOProfile(data, options);
                break;

            case 'volumeProfile':
                result = calculateVolumeProfile(data, options);
                break;

            default:
                throw new Error(`Unknown indicator type: ${type}`);
        }

        self.postMessage({ id, success: true, result });

    } catch (error) {
        self.postMessage({
            id,
            success: false,
            error: error.message
        });
    }
};

// Signal that worker is ready
self.postMessage({ type: 'ready' });
