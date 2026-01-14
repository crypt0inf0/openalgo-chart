/**
 * TPO Calculation Utilities
 * Core calculation functions for TPO profiles
 */

/**
 * Auto-calculate appropriate tick size based on price range
 * @param {Array} data - OHLC data
 * @returns {number} Calculated tick size
 */
export const calculateAutoTickSize = (data) => {
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

    if (avgPrice < 10) {
        tickSize = 0.05;
    } else if (avgPrice < 50) {
        tickSize = 0.1;
    } else if (avgPrice < 100) {
        tickSize = 0.25;
    } else if (avgPrice < 500) {
        tickSize = 0.5;
    } else if (avgPrice < 1000) {
        tickSize = 1;
    } else if (avgPrice < 5000) {
        tickSize = 2;
    } else if (avgPrice < 10000) {
        tickSize = 5;
    } else {
        tickSize = 10;
    }

    // Adjust based on range to get reasonable number of levels
    const estimatedLevels = range / tickSize;
    if (estimatedLevels > 200) {
        tickSize = tickSize * 2;
    } else if (estimatedLevels > 100) {
        tickSize = tickSize * 1.5;
    } else if (estimatedLevels < 20 && tickSize > 0.05) {
        tickSize = tickSize / 2;
    }

    return Math.max(0.01, tickSize);
};

/**
 * Quantize a price to the nearest tick size
 * @param {number} price
 * @param {number} tickSize
 * @returns {number}
 */
export const quantizePrice = (price, tickSize) => {
    return Math.round(price / tickSize) * tickSize;
};

/**
 * Get all price levels between low and high at tick size intervals
 * @param {number} low
 * @param {number} high
 * @param {number} tickSize
 * @returns {Array}
 */
export const getPriceLevels = (low, high, tickSize) => {
    const levels = [];
    const quantizedLow = quantizePrice(low, tickSize);
    const quantizedHigh = quantizePrice(high, tickSize);

    for (let price = quantizedLow; price <= quantizedHigh; price += tickSize) {
        levels.push(quantizePrice(price, tickSize));
    }

    return levels;
};

/**
 * Get TPO letter for a given period index
 * A-Z (0-25), then a-z (26-51), then AA-AZ, BA-BZ... for extended sessions
 * @param {number} periodIndex
 * @returns {string}
 */
export const getTPOLetter = (periodIndex) => {
    if (periodIndex < 0) return '?';
    if (periodIndex < 26) {
        return String.fromCharCode(65 + periodIndex); // A-Z
    } else if (periodIndex < 52) {
        return String.fromCharCode(97 + (periodIndex - 26)); // a-z
    }

    const offset = periodIndex - 52;
    const firstCharIndex = Math.floor(offset / 26);
    const secondCharIndex = offset % 26;

    if (firstCharIndex >= 26) return '*';

    const firstChar = String.fromCharCode(65 + firstCharIndex);
    const secondChar = String.fromCharCode(65 + secondCharIndex);
    return firstChar + secondChar;
};

/**
 * Parse time string (HH:MM) to minutes from midnight
 * @param {string} timeStr
 * @returns {number}
 */
export const parseTimeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

/**
 * Get date string from Unix timestamp (in seconds)
 * @param {number} timestamp
 * @returns {string}
 */
export const getDateString = (timestamp) => {
    return new Date(timestamp * 1000).toDateString();
};

/**
 * Get minutes from midnight for a Unix timestamp in a specific timezone
 * @param {number} timestamp
 * @param {string} timezone
 * @returns {number}
 */
export const getMinutesFromMidnight = (timestamp, timezone = undefined) => {
    const date = new Date(timestamp * 1000);

    if (timezone && timezone !== 'Local') {
        try {
            const options = {
                timeZone: timezone,
                hour: 'numeric',
                minute: 'numeric',
                hour12: false
            };
            const formatter = new Intl.DateTimeFormat('en-US', options);
            const parts = formatter.formatToParts(date);
            const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
            const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);

            const h = hour === 24 ? 0 : hour;
            return h * 60 + minute;
        } catch (e) {
            console.warn('Invalid timezone:', timezone, e);
        }
    }

    return date.getHours() * 60 + date.getMinutes();
};

/**
 * Calculate Value Area (70% of TPOs) starting from POC
 * @param {Map} priceLevels
 * @param {number} poc
 * @param {number} tickSize
 * @param {number} targetPercent
 * @returns {Object} { vah, val }
 */
export const calculateValueArea = (priceLevels, poc, tickSize, targetPercent = 70) => {
    const prices = [...priceLevels.keys()].sort((a, b) => a - b);
    if (prices.length === 0) return { vah: poc, val: poc };

    const totalTPOs = [...priceLevels.values()].reduce((sum, data) => sum + data.tpoCount, 0);
    const targetTPOs = totalTPOs * (targetPercent / 100);

    let vah = poc;
    let val = poc;
    let includedTPOs = priceLevels.get(poc)?.tpoCount || 0;

    while (includedTPOs < targetTPOs) {
        const priceAbove = quantizePrice(vah + tickSize, tickSize);
        const priceBelow = quantizePrice(val - tickSize, tickSize);

        const tposAbove = priceLevels.get(priceAbove)?.tpoCount || 0;
        const tposBelow = priceLevels.get(priceBelow)?.tpoCount || 0;

        if (tposAbove === 0 && tposBelow === 0) break;

        if (tposAbove >= tposBelow && tposAbove > 0) {
            vah = priceAbove;
            includedTPOs += tposAbove;
        } else if (tposBelow > 0) {
            val = priceBelow;
            includedTPOs += tposBelow;
        }
    }

    return { vah, val };
};

/**
 * Get price range for a specific period letter
 * @param {Map} priceLevels
 * @param {string} letter
 * @returns {Object} { high, low }
 */
export const getPeriodRange = (priceLevels, letter) => {
    let high = -Infinity;
    let low = Infinity;

    for (const [price, data] of priceLevels) {
        if (data.letters.has(letter)) {
            high = Math.max(high, price);
            low = Math.min(low, price);
        }
    }

    return { high, low };
};

/**
 * Calculate Rotation Factor
 * @param {Array} periods
 * @param {Map} priceLevels
 * @returns {number}
 */
export const calculateRotationFactor = (periods, priceLevels) => {
    if (periods.length < 2) return 0;

    let rf = 0;
    for (let i = 1; i < periods.length; i++) {
        const currRange = getPeriodRange(priceLevels, periods[i].letter);
        const prevRange = getPeriodRange(priceLevels, periods[i - 1].letter);

        if (currRange.high > prevRange.high) rf += 1;
        if (currRange.low < prevRange.low) rf -= 1;
    }

    return rf;
};

/**
 * Detect Poor High/Low
 * @param {Map} priceLevels
 * @param {number} rangeHigh
 * @param {number} rangeLow
 * @param {number} threshold
 * @returns {Object} { poorHigh, poorLow }
 */
export const detectPoorHighLow = (priceLevels, rangeHigh, rangeLow, threshold = 2) => {
    const highData = priceLevels.get(rangeHigh);
    const lowData = priceLevels.get(rangeLow);

    return {
        poorHigh: highData && highData.tpoCount <= threshold ? rangeHigh : null,
        poorLow: lowData && lowData.tpoCount <= threshold ? rangeLow : null,
    };
};

/**
 * Detect Single Prints
 * @param {Map} priceLevels
 * @param {number} tickSize
 * @returns {Array}
 */
export const detectSinglePrints = (priceLevels, tickSize) => {
    const singlePrints = [];
    const prices = [...priceLevels.keys()].sort((a, b) => a - b);

    for (let i = 1; i < prices.length - 1; i++) {
        const curr = priceLevels.get(prices[i]);
        const above = priceLevels.get(prices[i + 1]);
        const below = priceLevels.get(prices[i - 1]);

        if (curr.tpoCount === 1 && above?.tpoCount > 1 && below?.tpoCount > 1) {
            singlePrints.push(prices[i]);
        }
    }

    return singlePrints;
};

export default {
    calculateAutoTickSize,
    quantizePrice,
    getPriceLevels,
    getTPOLetter,
    parseTimeToMinutes,
    getDateString,
    getMinutesFromMidnight,
    calculateValueArea,
    getPeriodRange,
    calculateRotationFactor,
    detectPoorHighLow,
    detectSinglePrints,
};
