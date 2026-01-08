/**
 * TPO (Time Price Opportunity) Profile Indicator
 * Also known as Market Profile - shows price distribution over time
 *
 * TPO measures where price spent the most TIME, not volume.
 * Each 30-minute period is assigned a letter (A, B, C...) and marks
 * all price levels touched during that period.
 *
 * Key concepts:
 * - POC (Point of Control): Price level with most TPOs (fair value)
 * - Value Area: Price range containing 70% of TPOs (VAH/VAL)
 * - Initial Balance: First hour range (A+B periods)
 * - Rotation Factor: Measures price extension (+1 up, -1 down per period)
 * - Single Prints: Price levels with only 1 TPO (fast price movement)
 * - Poor High/Low: Session extremes with few TPOs (weak support/resistance)
 *
 * @param {Array} data - Array of OHLC data points with {time, open, high, low, close}
 * @param {Object} options - Configuration options
 * @returns {Array} Array of TPO profile objects, one per session
 */

import { BLOCK_SIZE_MAP, DEFAULT_BLOCK_SIZE } from '../../plugins/tpo-profile/TPOConstants';

/**
 * Convert block size string to minutes
 * @param {string|number} blockSize - Block size ('30m', '1h', etc.) or number
 * @returns {number} Period in minutes
 */
const parseBlockSize = (blockSize) => {
    if (typeof blockSize === 'number') {
        return blockSize;
    }
    return BLOCK_SIZE_MAP[blockSize] || BLOCK_SIZE_MAP[DEFAULT_BLOCK_SIZE];
};

/**
 * Auto-calculate appropriate tick size based on price range
 * Similar to how TradingView calculates it
 */
const calculateAutoTickSize = (data) => {
    if (!data || data.length === 0) return 1;

    // Get price range
    let minPrice = Infinity;
    let maxPrice = 0;

    for (const candle of data) {
        minPrice = Math.min(minPrice, candle.low);
        maxPrice = Math.max(maxPrice, candle.high);
    }

    const avgPrice = (minPrice + maxPrice) / 2;
    const range = maxPrice - minPrice;

    // Calculate tick size based on average price (like TradingView)
    // Goal: Have roughly 30-100 price levels in the profile
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
 */
const quantizePrice = (price, tickSize) => {
    return Math.round(price / tickSize) * tickSize;
};

/**
 * Get all price levels between low and high at tick size intervals
 */
const getPriceLevels = (low, high, tickSize) => {
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
 */
const getTPOLetter = (periodIndex) => {
    if (periodIndex < 0) return '?';
    if (periodIndex < 26) {
        return String.fromCharCode(65 + periodIndex); // A-Z
    } else if (periodIndex < 52) {
        return String.fromCharCode(97 + (periodIndex - 26)); // a-z
    }

    // Extended periods: 52+ -> AA, AB...
    const offset = periodIndex - 52;
    const firstCharIndex = Math.floor(offset / 26);
    const secondCharIndex = offset % 26;

    // Safety check for ridiculous periods
    if (firstCharIndex >= 26) return '*';

    const firstChar = String.fromCharCode(65 + firstCharIndex);
    const secondChar = String.fromCharCode(65 + secondCharIndex);
    return firstChar + secondChar;
};

/**
 * Parse time string (HH:MM) to minutes from midnight
 */
const parseTimeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

/**
 * Get date string from Unix timestamp (in seconds)
 */
const getDateString = (timestamp) => {
    return new Date(timestamp * 1000).toDateString();
};

/**
 * Get minutes from midnight for a Unix timestamp in a specific timezone
 */
const getMinutesFromMidnight = (timestamp, timezone = undefined) => {
    const date = new Date(timestamp * 1000);

    // If timezone specified, use Intl to get correct hours/minutes
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

            // Handle 24h format quirk (sometimes returns 24 instead of 0)
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
 */
const calculateValueArea = (priceLevels, poc, tickSize, targetPercent = 70) => {
    const prices = [...priceLevels.keys()].sort((a, b) => a - b);
    if (prices.length === 0) return { vah: poc, val: poc };

    const totalTPOs = [...priceLevels.values()].reduce((sum, data) => sum + data.tpoCount, 0);
    const targetTPOs = totalTPOs * (targetPercent / 100);

    let vah = poc;
    let val = poc;
    let includedTPOs = priceLevels.get(poc)?.tpoCount || 0;

    // Expand up and down from POC until we include 70% of TPOs
    while (includedTPOs < targetTPOs) {
        const priceAbove = quantizePrice(vah + tickSize, tickSize);
        const priceBelow = quantizePrice(val - tickSize, tickSize);

        const tposAbove = priceLevels.get(priceAbove)?.tpoCount || 0;
        const tposBelow = priceLevels.get(priceBelow)?.tpoCount || 0;

        // If no more prices to add, break
        if (tposAbove === 0 && tposBelow === 0) break;

        // Add the side with more TPOs (or both if equal)
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
 */
const getPeriodRange = (priceLevels, letter) => {
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
 * +1 for each period that extends above previous period's high
 * -1 for each period that extends below previous period's low
 */
const calculateRotationFactor = (periods, priceLevels) => {
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
 * Session extremes with few TPOs indicate weak support/resistance
 */
const detectPoorHighLow = (priceLevels, rangeHigh, rangeLow, threshold = 2) => {
    const highData = priceLevels.get(rangeHigh);
    const lowData = priceLevels.get(rangeLow);

    return {
        poorHigh: highData && highData.tpoCount <= threshold ? rangeHigh : null,
        poorLow: lowData && lowData.tpoCount <= threshold ? rangeLow : null,
    };
};

/**
 * Detect Single Prints
 * Price levels with only 1 TPO surrounded by levels with multiple TPOs
 * Indicates fast price movement through that zone
 */
const detectSinglePrints = (priceLevels, tickSize) => {
    const singlePrints = [];
    const prices = [...priceLevels.keys()].sort((a, b) => a - b);

    for (let i = 1; i < prices.length - 1; i++) {
        const curr = priceLevels.get(prices[i]);
        const above = priceLevels.get(prices[i + 1]);
        const below = priceLevels.get(prices[i - 1]);

        // Single print: this level has 1 TPO, surrounded by levels with >1 TPO
        if (curr.tpoCount === 1 && above?.tpoCount > 1 && below?.tpoCount > 1) {
            singlePrints.push(prices[i]);
        }
    }

    return singlePrints;
};

/**
 * Calculate TPO for higher timeframes (daily/weekly candles)
 * Each candle becomes a separate period/letter
 * All candles are combined into a single profile
 */
const calculateHigherTimeframeTPO = (data, tickSize, valueAreaPercent, poorThreshold, blockSize) => {
    if (!data || data.length === 0) return [];

    const sessionData = {
        sessionKey: 'composite',
        sessionStart: data[0].time,
        sessionEnd: data[data.length - 1].time,
        tickSize,
        blockSize,
        periods: [],
        priceLevels: new Map(),
        poc: 0,
        vah: 0,
        val: 0,
        ibHigh: 0,
        ibLow: Infinity,
        rangeHigh: 0,
        rangeLow: Infinity,
        totalTPOs: 0,
        openPrice: data[0].open,
        closePrice: data[data.length - 1].close,
        rotationFactor: 0,
        poorHigh: null,
        poorLow: null,
        singlePrints: [],
        midpoint: 0,
    };

    // Process each candle as a separate period
    data.forEach((candle, index) => {
        const letter = getTPOLetter(index);

        // Track period info
        sessionData.periods.push({
            letter,
            startTime: candle.time,
            endTime: candle.time,
        });

        // Get all price levels touched by this candle
        const levels = getPriceLevels(candle.low, candle.high, tickSize);

        for (const price of levels) {
            if (!sessionData.priceLevels.has(price)) {
                sessionData.priceLevels.set(price, {
                    tpoCount: 0,
                    letters: new Set(),
                    isInitialBalance: false,
                });
            }

            const levelData = sessionData.priceLevels.get(price);

            // Only count each letter once per price level
            if (!levelData.letters.has(letter)) {
                levelData.letters.add(letter);
                levelData.tpoCount++;
                sessionData.totalTPOs++;
            }

            // Track session range
            sessionData.rangeHigh = Math.max(sessionData.rangeHigh, price);
            sessionData.rangeLow = Math.min(sessionData.rangeLow, price);
        }
    });

    // Calculate POC (Point of Control)
    let maxTPOCount = 0;
    for (const [price, levelData] of sessionData.priceLevels) {
        if (levelData.tpoCount > maxTPOCount) {
            maxTPOCount = levelData.tpoCount;
            sessionData.poc = price;
        }
    }

    // Calculate Value Area
    const { vah, val } = calculateValueArea(
        sessionData.priceLevels,
        sessionData.poc,
        tickSize,
        valueAreaPercent
    );
    sessionData.vah = vah;
    sessionData.val = val;

    // Set IB to first candle range
    if (data.length > 0) {
        sessionData.ibHigh = data[0].high;
        sessionData.ibLow = data[0].low;
    }

    // Calculate Rotation Factor
    sessionData.rotationFactor = calculateRotationFactor(
        sessionData.periods,
        sessionData.priceLevels
    );

    // Detect Poor High/Low
    const { poorHigh, poorLow } = detectPoorHighLow(
        sessionData.priceLevels,
        sessionData.rangeHigh,
        sessionData.rangeLow,
        poorThreshold
    );
    sessionData.poorHigh = poorHigh;
    sessionData.poorLow = poorLow;

    // Detect Single Prints
    sessionData.singlePrints = detectSinglePrints(sessionData.priceLevels, tickSize);

    // Calculate Midpoint
    sessionData.midpoint = (sessionData.rangeHigh + sessionData.rangeLow) / 2;

    return [sessionData];
};

/**
 * Main TPO calculation function
 */
export const calculateTPO = (data, options = {}) => {
    const {
        tickSize: tickSizeOption = 'auto', // 'auto' or number
        blockSize = '30m',                  // Block size string ('5m', '30m', '1h', etc.)
        periodMinutes: periodMinutesOption, // Legacy support - use blockSize instead
        sessionType = 'daily', // 'daily', 'weekly', 'custom'
        sessionStart = '09:15', // NSE market open (IST)
        sessionEnd = '15:30',   // NSE market close
        valueAreaPercent = 70,
        allHours = true, // Set to true to include all hours (for crypto/24x7 markets)
        poorThreshold = 2, // TPO count threshold for poor high/low
        interval, // Chart interval (e.g., '15m', '1D')
        timezone = 'Asia/Kolkata', // Default timezone (User can override)
    } = options;

    // Parse block size - support both string ('30m') and number (30)
    const periodMinutes = periodMinutesOption || parseBlockSize(blockSize);

    if (!Array.isArray(data) || data.length === 0) {
        return [];
    }

    // Detect if this is daily/weekly data
    // Priority: Use explicit 'interval' if provided, otherwise fallback to gap detection
    let isHigherTimeframe = false;

    if (interval) {
        // Check for Daily (D), Weekly (W), Monthly (M)
        isHigherTimeframe = /^[0-9]*[DWM]$/.test(interval) || interval === '1D' || interval === '1W' || interval === '1M';
    } else if (data.length >= 2) {
        // Fallback: Check time gaps
        const gap = data[1].time - data[0].time;
        // If gap is >= 1 day (86400 seconds), treat as higher timeframe
        isHigherTimeframe = gap >= 86400;
    }

    // Auto-calculate tick size if not specified or set to 'auto'
    const tickSize = (tickSizeOption === 'auto' || tickSizeOption <= 0)
        ? calculateAutoTickSize(data)
        : tickSizeOption;

    const sessionStartMinutes = parseTimeToMinutes(sessionStart);
    const sessionEndMinutes = parseTimeToMinutes(sessionEnd);

    // For higher timeframes (daily/weekly), combine all data into single profile
    // Each candle (day) becomes a separate period/letter
    if (isHigherTimeframe) {
        return calculateHigherTimeframeTPO(data, tickSize, valueAreaPercent, poorThreshold, blockSize);
    }

    // Group candles by session (day/week)
    const sessions = new Map();

    for (const candle of data) {
        let sessionKey;

        if (sessionType === 'weekly') {
            // Group by week
            const date = new Date(candle.time * 1000);
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            sessionKey = weekStart.toDateString();
        } else {
            // Group by day (default)
            sessionKey = getDateString(candle.time);
        }

        if (!sessions.has(sessionKey)) {
            sessions.set(sessionKey, []);
        }
        sessions.get(sessionKey).push(candle);
    }

    // Calculate TPO profile for each session
    const profiles = [];

    for (const [sessionKey, candles] of sessions) {
        if (candles.length === 0) continue;

        // Sort candles by time
        candles.sort((a, b) => a.time - b.time);

        const sessionData = {
            sessionKey,
            sessionStart: candles[0].time,
            sessionEnd: candles[candles.length - 1].time,
            tickSize, // Store calculated tick size
            blockSize, // Store block size for display
            periods: [],
            priceLevels: new Map(),
            poc: 0,
            vah: 0,
            val: 0,
            ibHigh: 0,
            ibLow: Infinity,
            rangeHigh: 0,
            rangeLow: Infinity,
            totalTPOs: 0,
            // New fields for Phase 2
            openPrice: candles[0].open,
            closePrice: candles[candles.length - 1].close,
            rotationFactor: 0,
            poorHigh: null,
            poorLow: null,
            singlePrints: [],
            midpoint: 0,
        };

        // Process each candle
        for (const candle of candles) {
            const minutesFromMidnight = getMinutesFromMidnight(candle.time, timezone);

            // Skip candles outside session hours (unless allHours is true)
            if (!allHours && (minutesFromMidnight < sessionStartMinutes || minutesFromMidnight >= sessionEndMinutes)) {
                continue;
            }

            // Calculate which period (letter) this candle belongs to
            // Always anchor 'A' to sessionStart, even if allHours is used.
            const minutesIntoSession = minutesFromMidnight - sessionStartMinutes;
            let periodIndex = Math.floor(minutesIntoSession / periodMinutes);

            // Handle pre-market (negative index) or extensive hours
            if (periodIndex < 0) {
                // Option: Use negative indices or special mapping.
                // For now, let's just clamp or allow standard mapping to see.
                // Ideally pre-market gets distinct letters, but let's stick to standard map
                // If very negative (e.g. yesterday evening), it will be weird.
                // Assuming intraday relative to 09:15.
            }

            // Adjust index to non-negative if we want 'A' to be first print?
            // Standard TPO: 'A' is the first period of the session.
            // If we allow allHours, 'A' should probably correspond to sessionStart.
            // Pre-market (before sessionStart) would be negative periods?
            // Let's rely on getTPOLetter to handle index.

            const letter = getTPOLetter(periodIndex);

            // Track period info
            if (!sessionData.periods.find(p => p.letter === letter)) {
                sessionData.periods.push({
                    letter,
                    startTime: candle.time,
                    endTime: candle.time,
                });
            } else {
                const period = sessionData.periods.find(p => p.letter === letter);
                period.endTime = candle.time;
            }

            // Get all price levels touched by this candle
            const levels = getPriceLevels(candle.low, candle.high, tickSize);

            for (const price of levels) {
                if (!sessionData.priceLevels.has(price)) {
                    sessionData.priceLevels.set(price, {
                        tpoCount: 0,
                        letters: new Set(),
                        isInitialBalance: false,
                    });
                }

                const levelData = sessionData.priceLevels.get(price);

                // Only count each letter once per price level
                if (!levelData.letters.has(letter)) {
                    levelData.letters.add(letter);
                    levelData.tpoCount++;
                    sessionData.totalTPOs++;
                }

                // Mark as Initial Balance (first 2 periods: A and B)
                if (periodIndex < 2) {
                    levelData.isInitialBalance = true;
                    sessionData.ibHigh = Math.max(sessionData.ibHigh, price);
                    sessionData.ibLow = Math.min(sessionData.ibLow, price);
                }

                // Track session range
                sessionData.rangeHigh = Math.max(sessionData.rangeHigh, price);
                sessionData.rangeLow = Math.min(sessionData.rangeLow, price);
            }
        }

        // Calculate POC (Point of Control) - price with highest TPO count
        let maxTPOCount = 0;
        for (const [price, levelData] of sessionData.priceLevels) {
            if (levelData.tpoCount > maxTPOCount) {
                maxTPOCount = levelData.tpoCount;
                sessionData.poc = price;
            }
        }

        // Calculate Value Area (70% of TPOs)
        const { vah, val } = calculateValueArea(
            sessionData.priceLevels,
            sessionData.poc,
            tickSize,
            valueAreaPercent
        );
        sessionData.vah = vah;
        sessionData.val = val;

        // Fix IB values if no IB candles found
        if (sessionData.ibLow === Infinity) {
            sessionData.ibLow = sessionData.rangeLow;
            sessionData.ibHigh = sessionData.rangeHigh;
        }

        // Calculate Rotation Factor
        sessionData.rotationFactor = calculateRotationFactor(
            sessionData.periods,
            sessionData.priceLevels
        );

        // Detect Poor High/Low
        const { poorHigh, poorLow } = detectPoorHighLow(
            sessionData.priceLevels,
            sessionData.rangeHigh,
            sessionData.rangeLow,
            poorThreshold
        );
        sessionData.poorHigh = poorHigh;
        sessionData.poorLow = poorLow;

        // Detect Single Prints
        sessionData.singlePrints = detectSinglePrints(sessionData.priceLevels, tickSize);

        // Calculate TPO Midpoint
        sessionData.midpoint = (sessionData.rangeHigh + sessionData.rangeLow) / 2;

        profiles.push(sessionData);
    }

    // Sort profiles by session start time (most recent last)
    profiles.sort((a, b) => a.sessionStart - b.sessionStart);

    return profiles;
};

/**
 * Convert TPO profile to renderable format for lightweight-charts
 * Returns array of price levels with their TPO data
 */
export const tpoToRenderData = (profile, options = {}) => {
    const {
        showLetters = true,
        maxLettersPerRow = 20,
    } = options;

    if (!profile || !profile.priceLevels) {
        return [];
    }

    const renderData = [];

    for (const [price, levelData] of profile.priceLevels) {
        const letters = [...levelData.letters];

        renderData.push({
            price,
            tpoCount: levelData.tpoCount,
            letters: showLetters ? letters.slice(0, maxLettersPerRow) : [],
            isInitialBalance: levelData.isInitialBalance,
            isPOC: price === profile.poc,
            isValueArea: price >= profile.val && price <= profile.vah,
            isVAH: price === profile.vah,
            isVAL: price === profile.val,
        });
    }

    // Sort by price (high to low for display)
    renderData.sort((a, b) => b.price - a.price);

    return renderData;
};

/**
 * Count TPOs above or below POC
 */
const countTPOsRelativeToPOC = (priceLevels, poc) => {
    let above = 0;
    let below = 0;

    for (const [price, data] of priceLevels) {
        if (price > poc) {
            above += data.tpoCount;
        } else if (price < poc) {
            below += data.tpoCount;
        }
    }

    return { above, below };
};

/**
 * Get summary statistics for a TPO profile
 * Extended with all TradingView-compatible stats
 */
export const getTPOStats = (profile) => {
    if (!profile) return null;

    const { above: tpoAbovePOC, below: tpoBelowPOC } = countTPOsRelativeToPOC(
        profile.priceLevels,
        profile.poc
    );

    return {
        // Core stats
        poc: profile.poc,
        vah: profile.vah,
        val: profile.val,
        ibHigh: profile.ibHigh,
        ibLow: profile.ibLow,
        rangeHigh: profile.rangeHigh,
        rangeLow: profile.rangeLow,

        // Calculated ranges
        hlRange: profile.rangeHigh - profile.rangeLow,
        vaRange: profile.vah - profile.val,
        ibRange: profile.ibHigh - profile.ibLow,

        // TPO counts
        totalTPOs: profile.totalTPOs,
        tpoAbovePOC,
        tpoBelowPOC,
        periodCount: profile.periods.length,

        // New stats
        rotationFactor: profile.rotationFactor,
        midpoint: profile.midpoint,
        openPrice: profile.openPrice,
        closePrice: profile.closePrice,
        poorHigh: profile.poorHigh,
        poorLow: profile.poorLow,
        singlePrintCount: profile.singlePrints?.length || 0,

        // Session info
        sessionKey: profile.sessionKey,
        blockSize: profile.blockSize,
        tickSize: profile.tickSize,
    };
};

export default calculateTPO;
