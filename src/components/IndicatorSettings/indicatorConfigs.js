/**
 * Indicator Configurations for TradingView-style Settings Dialog
 * Defines Inputs and Style fields for each indicator type
 */


export const indicatorConfigs = {
    ema: {
        name: 'EMA',
        fullName: 'Exponential Moving Average',
        pane: 'main',
        inputs: [
            { key: 'period', label: 'Length', type: 'number', min: 1, max: 500, default: 20 },
            { key: 'source', label: 'Source', type: 'select', options: ['open', 'high', 'low', 'close'], default: 'close' },
            { key: 'offset', label: 'Offset', type: 'number', min: -500, max: 500, default: 0 },
        ],
        style: [
            { key: 'color', label: 'Line Color', type: 'color', default: '#2962FF' },
            { key: 'lineWidth', label: 'Line Width', type: 'number', min: 1, max: 5, default: 2 },
        ],
    },

    sma: {
        name: 'SMA',
        fullName: 'Simple Moving Average',
        pane: 'main',
        inputs: [
            { key: 'period', label: 'Length', type: 'number', min: 1, max: 500, default: 20 },
            { key: 'source', label: 'Source', type: 'select', options: ['open', 'high', 'low', 'close'], default: 'close' },
            { key: 'offset', label: 'Offset', type: 'number', min: -500, max: 500, default: 0 },
        ],
        style: [
            { key: 'color', label: 'Line Color', type: 'color', default: '#FF6D00' },
            { key: 'lineWidth', label: 'Line Width', type: 'number', min: 1, max: 5, default: 2 },
        ],
    },

    rsi: {
        name: 'RSI',
        fullName: 'Relative Strength Index',
        pane: 'rsi',
        inputs: [
            { key: 'period', label: 'Length', type: 'number', min: 1, max: 100, default: 14 },
            { key: 'source', label: 'Source', type: 'select', options: ['open', 'high', 'low', 'close'], default: 'close' },
            { key: 'overbought', label: 'Overbought', type: 'number', min: 50, max: 100, default: 70 },
            { key: 'oversold', label: 'Oversold', type: 'number', min: 0, max: 50, default: 30 },
        ],
        style: [
            { key: 'color', label: 'RSI Line', type: 'color', default: '#7B1FA2' },
            { key: 'overboughtColor', label: 'Overbought Line', type: 'color', default: '#F23645' },
            { key: 'oversoldColor', label: 'Oversold Line', type: 'color', default: '#089981' },
        ],
    },

    stochastic: {
        name: 'Stochastic',
        fullName: 'Stochastic Oscillator',
        pane: 'stochastic',
        inputs: [
            { key: 'kPeriod', label: '%K Length', type: 'number', min: 1, max: 100, default: 14 },
            { key: 'dPeriod', label: '%D Smoothing', type: 'number', min: 1, max: 100, default: 3 },
            { key: 'smooth', label: '%K Smoothing', type: 'number', min: 1, max: 10, default: 3 },
        ],
        style: [
            { key: 'kColor', label: '%K Line', type: 'color', default: '#2962FF' },
            { key: 'dColor', label: '%D Line', type: 'color', default: '#FF6D00' },
        ],
    },

    macd: {
        name: 'MACD',
        fullName: 'Moving Average Convergence Divergence',
        pane: 'macd',
        inputs: [
            { key: 'fast', label: 'Fast Length', type: 'number', min: 1, max: 100, default: 12 },
            { key: 'slow', label: 'Slow Length', type: 'number', min: 1, max: 100, default: 26 },
            { key: 'signal', label: 'Signal Smoothing', type: 'number', min: 1, max: 100, default: 9 },
            { key: 'source', label: 'Source', type: 'select', options: ['open', 'high', 'low', 'close'], default: 'close' },
        ],
        style: [
            { key: 'macdColor', label: 'MACD Line', type: 'color', default: '#2962FF' },
            { key: 'signalColor', label: 'Signal Line', type: 'color', default: '#FF6D00' },
            { key: 'histUpColor', label: 'Histogram Up', type: 'color', default: '#26A69A' },
            { key: 'histDownColor', label: 'Histogram Down', type: 'color', default: '#EF5350' },
        ],
    },

    bollingerBands: {
        name: 'BB',
        fullName: 'Bollinger Bands',
        pane: 'main',
        inputs: [
            { key: 'period', label: 'Length', type: 'number', min: 1, max: 200, default: 20 },
            { key: 'stdDev', label: 'StdDev', type: 'number', min: 0.5, max: 5, step: 0.5, default: 2 },
            { key: 'source', label: 'Source', type: 'select', options: ['open', 'high', 'low', 'close'], default: 'close' },
        ],
        style: [
            { key: 'basisColor', label: 'Basis', type: 'color', default: '#FF6D00' },
            { key: 'upperColor', label: 'Upper', type: 'color', default: '#2962FF' },
            { key: 'lowerColor', label: 'Lower', type: 'color', default: '#2962FF' },
            { key: 'fillColor', label: 'Fill', type: 'color', default: '#2962FF20' },
        ],
    },

    atr: {
        name: 'ATR',
        fullName: 'Average True Range',
        pane: 'atr',
        inputs: [
            { key: 'period', label: 'Length', type: 'number', min: 1, max: 100, default: 14 },
        ],
        style: [
            { key: 'color', label: 'Line Color', type: 'color', default: '#FF9800' },
        ],
    },

    supertrend: {
        name: 'Supertrend',
        fullName: 'Supertrend',
        pane: 'main',
        inputs: [
            { key: 'period', label: 'ATR Length', type: 'number', min: 1, max: 100, default: 10 },
            { key: 'multiplier', label: 'Factor', type: 'number', min: 0.5, max: 10, step: 0.5, default: 3 },
        ],
        style: [
            { key: 'upColor', label: 'Up Trend', type: 'color', default: '#089981' },
            { key: 'downColor', label: 'Down Trend', type: 'color', default: '#F23645' },
        ],
    },

    volume: {
        name: 'Volume',
        fullName: 'Volume',
        pane: 'main',
        inputs: [],
        style: [
            { key: 'colorUp', label: 'Up Color', type: 'color', default: '#26A69A' },
            { key: 'colorDown', label: 'Down Color', type: 'color', default: '#EF5350' },
        ],
    },

    vwap: {
        name: 'VWAP',
        fullName: 'Volume Weighted Average Price',
        pane: 'main',
        inputs: [
            { key: 'source', label: 'Source', type: 'select', options: ['hlc3', 'close', 'open', 'high', 'low'], default: 'hlc3' },
            { key: 'resetDaily', label: 'New Daily Session', type: 'boolean', default: true },
            { key: 'resetAtMarketOpen', label: 'Reset at Market Open', type: 'boolean', default: false },
            { key: 'ignoreVolume', label: 'Equal Weight (No Volume)', type: 'boolean', default: false },
        ],
        style: [
            { key: 'color', label: 'Line Color', type: 'color', default: '#2962FF' },
            { key: 'lineWidth', label: 'Line Width', type: 'number', min: 1, max: 5, default: 2 },
        ],
    },
    tpo: {
        name: 'TPO',
        fullName: 'Time Price Opportunity',
        pane: 'main',
        inputs: [
            { key: 'blockSize', label: 'Block Size', type: 'select', options: ['5m', '10m', '15m', '30m', '1h', '2h', '4h', 'daily'], default: '30m' },
            { key: 'sessionType', label: 'Session Type', type: 'select', options: ['daily', 'weekly', 'monthly'], default: 'daily' },
            { key: 'timezone', label: 'Timezone', type: 'select', options: ['Asia/Kolkata', 'UTC', 'America/New_York', 'Europe/London', 'Local'], default: 'Asia/Kolkata' },
            { key: 'sessionStart', label: 'Session Start', type: 'text', default: '09:15' },
            { key: 'sessionEnd', label: 'Session End', type: 'text', default: '15:30' },
            { key: 'valueAreaPercent', label: 'Value Area %', type: 'number', default: 70 },
            { key: 'position', label: 'Position', type: 'select', options: ['left', 'right'], default: 'right' },
            { key: 'allHours', label: 'Use All Hours', type: 'boolean', default: true },
            { key: 'showLetters', label: 'Show Letters', type: 'boolean', default: true },
            { key: 'showPOC', label: 'Show POC', type: 'boolean', default: true },
            { key: 'showValueArea', label: 'Show Value Area', type: 'boolean', default: true },
            { key: 'showInitialBalance', label: 'Show IB', type: 'boolean', default: true },
            { key: 'showVAH', label: 'Show VAH', type: 'boolean', default: true },
            { key: 'showVAL', label: 'Show VAL', type: 'boolean', default: true },
            { key: 'showPoorHigh', label: 'Show Poor High', type: 'boolean', default: false },
            { key: 'showPoorLow', label: 'Show Poor Low', type: 'boolean', default: false },
            { key: 'showSinglePrints', label: 'Show Single Prints', type: 'boolean', default: false },
            { key: 'showMidpoint', label: 'Show Midpoint', type: 'boolean', default: false },
            { key: 'showOpen', label: 'Show Open', type: 'boolean', default: false },
            { key: 'showClose', label: 'Show Close', type: 'boolean', default: false },
            { key: 'useGradientColors', label: 'Use Gradients', type: 'boolean', default: true },
        ],
        style: [
            { key: 'pocColor', label: 'POC Color', type: 'color', default: '#FF9800' },
            { key: 'vahColor', label: 'VAH Color', type: 'color', default: '#26a69a' },
            { key: 'valColor', label: 'VAL Color', type: 'color', default: '#ef5350' },
            { key: 'poorHighColor', label: 'Poor High', type: 'color', default: '#ef5350' },
            { key: 'poorLowColor', label: 'Poor Low', type: 'color', default: '#26a69a' },
            { key: 'singlePrintColor', label: 'Single Prints', type: 'color', default: '#FFEB3B' },
            { key: 'midpointColor', label: 'Midpoint', type: 'color', default: '#9C27B0' },
        ],
    },
};

/**
 * Get config for a specific indicator type
 */
export const getIndicatorConfig = (type) => {
    return indicatorConfigs[type] || null;
};

/**
 * Get default settings for an indicator
 */
export const getDefaultSettings = (type) => {
    const config = indicatorConfigs[type];
    if (!config) return {};

    const defaults = {};

    // Get input defaults
    config.inputs.forEach(field => {
        defaults[field.key] = field.default;
    });

    // Get style defaults
    config.style.forEach(field => {
        defaults[field.key] = field.default;
    });

    return defaults;
};
