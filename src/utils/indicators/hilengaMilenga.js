/**
 * Hilenga-Milenga Indicator by NK Sir
 * A momentum oscillator combining RSI with EMA and WMA smoothing
 *
 * Components:
 * - RSI: Relative Strength Index
 * - EMA of RSI: Fast signal line (Price/EMA)
 * - WMA of RSI: Slow signal line (Strength/WMA)
 * - Midline at 50
 *
 * @param {Array} data - Array of OHLC data points with {time, open, high, low, close}
 * @param {number} rsiLength - RSI period (default: 9)
 * @param {number} emaLength - EMA period for smoothing RSI (default: 3)
 * @param {number} wmaLength - WMA period for smoothing RSI (default: 21)
 * @returns {Object} { rsiLine, emaLine, wmaLine }
 */
export const calculateHilengaMilenga = (data, rsiLength = 9, emaLength = 3, wmaLength = 21) => {
    if (!Array.isArray(data) || data.length < Math.max(rsiLength, wmaLength) + 1) {
        return { rsiLine: [], emaLine: [], wmaLine: [] };
    }

    // Step 1: Calculate RSI
    const rsiValues = calculateRSIValues(data, rsiLength);

    if (rsiValues.length === 0) {
        return { rsiLine: [], emaLine: [], wmaLine: [] };
    }

    // Step 2: Calculate EMA of RSI
    const emaValues = calculateEMAOfValues(rsiValues.map(r => r.value), emaLength);

    // Step 3: Calculate WMA of RSI
    const wmaValues = calculateWMAOfValues(rsiValues.map(r => r.value), wmaLength);

    // Build output arrays with time alignment
    const rsiLine = rsiValues.map(r => ({ time: r.time, value: r.value }));

    // EMA line starts after emaLength - 1 RSI values
    const emaLine = [];
    const emaStartIndex = emaLength - 1;
    for (let i = 0; i < emaValues.length; i++) {
        if (emaStartIndex + i < rsiValues.length) {
            emaLine.push({
                time: rsiValues[emaStartIndex + i].time,
                value: emaValues[i]
            });
        }
    }

    // WMA line starts after wmaLength - 1 RSI values
    const wmaLine = [];
    const wmaStartIndex = wmaLength - 1;
    for (let i = 0; i < wmaValues.length; i++) {
        if (wmaStartIndex + i < rsiValues.length) {
            wmaLine.push({
                time: rsiValues[wmaStartIndex + i].time,
                value: wmaValues[i]
            });
        }
    }

    return { rsiLine, emaLine, wmaLine };
};

/**
 * Calculate RSI values from OHLC data
 */
const calculateRSIValues = (data, period) => {
    if (data.length < period + 1) {
        return [];
    }

    const rsiData = [];
    const gains = [];
    const losses = [];

    // Calculate price changes
    for (let i = 1; i < data.length; i++) {
        const change = data[i].close - data[i - 1].close;
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? Math.abs(change) : 0);
    }

    // Calculate first average gain and loss (SMA)
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 0; i < period; i++) {
        avgGain += gains[i];
        avgLoss += losses[i];
    }
    avgGain /= period;
    avgLoss /= period;

    // First RSI value
    const firstRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const firstRSI = 100 - (100 / (1 + firstRS));
    rsiData.push({ time: data[period].time, value: firstRSI });

    // Calculate subsequent RSI values using Wilder's smoothing
    for (let i = period; i < gains.length; i++) {
        avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
        avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;

        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        rsiData.push({ time: data[i + 1].time, value: rsi });
    }

    return rsiData;
};

/**
 * Calculate EMA of a value array
 */
const calculateEMAOfValues = (values, period) => {
    if (values.length < period) {
        return [];
    }

    const emaData = [];
    const k = 2 / (period + 1);

    // Start with SMA for the first EMA value
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += values[i];
    }
    let prevEma = sum / period;
    emaData.push(prevEma);

    for (let i = period; i < values.length; i++) {
        const ema = (values[i] - prevEma) * k + prevEma;
        emaData.push(ema);
        prevEma = ema;
    }

    return emaData;
};

/**
 * Calculate WMA (Weighted Moving Average) of a value array
 * WMA gives more weight to recent prices
 */
const calculateWMAOfValues = (values, period) => {
    if (values.length < period) {
        return [];
    }

    const wmaData = [];
    const weightSum = (period * (period + 1)) / 2; // Sum of weights 1+2+3+...+period

    for (let i = period - 1; i < values.length; i++) {
        let weightedSum = 0;
        for (let j = 0; j < period; j++) {
            // Weight increases from 1 to period (most recent has highest weight)
            weightedSum += values[i - period + 1 + j] * (j + 1);
        }
        wmaData.push(weightedSum / weightSum);
    }

    return wmaData;
};

/**
 * Get the latest Hilenga-Milenga values for display
 */
export const getLatestHilengaMilenga = (data, rsiLength = 9, emaLength = 3, wmaLength = 21) => {
    const result = calculateHilengaMilenga(data, rsiLength, emaLength, wmaLength);

    const latestRSI = result.rsiLine.length > 0 ? result.rsiLine[result.rsiLine.length - 1].value : null;
    const latestEMA = result.emaLine.length > 0 ? result.emaLine[result.emaLine.length - 1].value : null;
    const latestWMA = result.wmaLine.length > 0 ? result.wmaLine[result.wmaLine.length - 1].value : null;

    return {
        rsi: latestRSI,
        ema: latestEMA,
        wma: latestWMA,
        // Signal interpretation
        signal: latestRSI !== null ? (latestRSI > 50 ? 'bullish' : 'bearish') : null
    };
};
