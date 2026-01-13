/**
 * Ichimoku Cloud (Ichimoku Kinko Hyo) Indicator
 * A comprehensive indicator showing support, resistance, trend, and momentum
 * 
 * Components:
 * - Tenkan-sen (Conversion Line): (9-period high + 9-period low) / 2
 * - Kijun-sen (Base Line): (26-period high + 26-period low) / 2
 * - Senkou Span A (Leading Span A): (Tenkan + Kijun) / 2, plotted 26 periods ahead
 * - Senkou Span B (Leading Span B): (52-period high + 52-period low) / 2, plotted 26 periods ahead
 * - Chikou Span (Lagging Span): Close price plotted 26 periods behind
 * 
 * The area between Senkou A and B forms the "cloud" (Kumo)
 *
 * @param {Array} data - Array of OHLC data points with {time, open, high, low, close}
 * @param {number} tenkanPeriod - Conversion line period (default: 9)
 * @param {number} kijunPeriod - Base line period (default: 26)
 * @param {number} senkouBPeriod - Senkou Span B period (default: 52)
 * @param {number} displacement - Forward/backward shift (default: 26)
 * @returns {Object} { tenkan: [], kijun: [], senkouA: [], senkouB: [], chikou: [] }
 */
export function calculateIchimoku(
    data,
    tenkanPeriod = 9,
    kijunPeriod = 26,
    senkouBPeriod = 52,
    displacement = 26
) {
    if (!Array.isArray(data) || data.length < senkouBPeriod) {
        return { tenkan: [], kijun: [], senkouA: [], senkouB: [], chikou: [] };
    }

    const tenkan = [];
    const kijun = [];
    const senkouA = [];
    const senkouB = [];
    const chikou = [];

    // Get interval in seconds for time displacement
    const intervalSeconds = data.length > 1 ? data[1].time - data[0].time : 60;

    // Calculate midpoint of period (high + low) / 2
    const getMidpoint = (startIndex, period) => {
        let highest = -Infinity;
        let lowest = Infinity;

        for (let i = startIndex; i < startIndex + period && i < data.length; i++) {
            if (i >= 0) {
                highest = Math.max(highest, data[i].high);
                lowest = Math.min(lowest, data[i].low);
            }
        }

        return highest !== -Infinity ? (highest + lowest) / 2 : null;
    };

    // Calculate for each bar
    for (let i = 0; i < data.length; i++) {
        const bar = data[i];

        // Tenkan-sen (Conversion Line) - 9 period midpoint
        if (i >= tenkanPeriod - 1) {
            const tenkanValue = getMidpoint(i - tenkanPeriod + 1, tenkanPeriod);
            if (tenkanValue !== null) {
                tenkan.push({ time: bar.time, value: tenkanValue });
            }
        }

        // Kijun-sen (Base Line) - 26 period midpoint
        if (i >= kijunPeriod - 1) {
            const kijunValue = getMidpoint(i - kijunPeriod + 1, kijunPeriod);
            if (kijunValue !== null) {
                kijun.push({ time: bar.time, value: kijunValue });
            }
        }

        // Senkou Span A - (Tenkan + Kijun) / 2, shifted forward
        if (i >= kijunPeriod - 1) {
            const tenkanValue = getMidpoint(i - tenkanPeriod + 1, tenkanPeriod);
            const kijunValue = getMidpoint(i - kijunPeriod + 1, kijunPeriod);
            if (tenkanValue !== null && kijunValue !== null) {
                const senkouAValue = (tenkanValue + kijunValue) / 2;
                // Shift forward by displacement periods
                const futureTime = bar.time + (displacement * intervalSeconds);
                senkouA.push({ time: futureTime, value: senkouAValue });
            }
        }

        // Senkou Span B - 52 period midpoint, shifted forward
        if (i >= senkouBPeriod - 1) {
            const senkouBValue = getMidpoint(i - senkouBPeriod + 1, senkouBPeriod);
            if (senkouBValue !== null) {
                // Shift forward by displacement periods
                const futureTime = bar.time + (displacement * intervalSeconds);
                senkouB.push({ time: futureTime, value: senkouBValue });
            }
        }

        // Chikou Span (Lagging Span) - Close price shifted backward
        // We plot current close at (current time - displacement periods)
        const pastTime = bar.time - (displacement * intervalSeconds);
        chikou.push({ time: pastTime, value: bar.close });
    }

    return { tenkan, kijun, senkouA, senkouB, chikou };
}

/**
 * Get cloud fill data for rendering between Senkou A and B
 * Returns an array suitable for AreaRange series or custom rendering
 * 
 * @param {Array} senkouA - Senkou Span A data
 * @param {Array} senkouB - Senkou Span B data
 * @returns {Array} Array of { time, upper, lower, color } for cloud rendering
 */
export function getCloudData(senkouA, senkouB) {
    if (!senkouA.length || !senkouB.length) {
        return [];
    }

    const cloudData = [];

    // Create a map for quick lookup
    const senkouBMap = new Map(senkouB.map(s => [s.time, s.value]));

    for (const spanA of senkouA) {
        const spanBValue = senkouBMap.get(spanA.time);
        if (spanBValue !== undefined) {
            const isGreen = spanA.value >= spanBValue;
            cloudData.push({
                time: spanA.time,
                upper: Math.max(spanA.value, spanBValue),
                lower: Math.min(spanA.value, spanBValue),
                isGreen
            });
        }
    }

    return cloudData;
}

export default calculateIchimoku;
