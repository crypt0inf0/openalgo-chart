/**
 * Indicator Configurations for TradingView-style Settings Dialog
 * Defines Inputs and Style fields for each indicator type
 */

export interface ConfigField {
    key: string;
    label: string;
    type: 'number' | 'color' | 'boolean' | 'select' | 'text';
    min?: number;
    max?: number;
    step?: number;
    default: any;
    options?: string[] | Array<{ value: string; label: string }>;
}

export interface IndicatorConfigDefinition {
    name: string;
    fullName: string;
    pane: string;
    category?: string;
    description?: string;
    inputs: ConfigField[];
    style: ConfigField[];
}

export const indicatorConfigs: Record<string, IndicatorConfigDefinition> = {
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
            { key: 'showTitle', label: 'Show Title', type: 'boolean', default: false },
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
            { key: 'showTitle', label: 'Show Title', type: 'boolean', default: false },
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
            { key: 'showTitle', label: 'Show Title', type: 'boolean', default: false },
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
            { key: 'showTitle', label: 'Show Title', type: 'boolean', default: false },
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
            { key: 'showTitle', label: 'Show Title', type: 'boolean', default: false },
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
        fullName: 'Volume (TradingView Style)',
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
            { key: 'showTitle', label: 'Show Title', type: 'boolean', default: false },
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

    firstCandle: {
        name: 'First Red Candle',
        fullName: 'First Red Candle Strategy',
        pane: 'main',
        category: 'strategy',
        description: 'Identifies the first RED candle after market open (9:15 AM IST) on 5-minute charts',
        inputs: [],
        style: [
            { key: 'highlightColor', label: 'Marker Color', type: 'color', default: '#FFD700' },
            { key: 'highLineColor', label: 'High Line', type: 'color', default: '#ef5350' },
            { key: 'lowLineColor', label: 'Low Line', type: 'color', default: '#26a69a' },
        ],
    },

    rangeBreakout: {
        name: 'Range Breakout',
        fullName: 'Opening Range Breakout (9:30-10:00)',
        pane: 'main',
        category: 'strategy',
        description: 'Draws 9:30-10:00 AM range high/low lines with breakout/breakdown signals for Nifty/Sensex options',
        inputs: [
            { key: 'rangeStartHour', label: 'Range Start Hour', type: 'number', min: 9, max: 15, default: 9 },
            { key: 'rangeStartMinute', label: 'Range Start Min', type: 'number', min: 0, max: 59, default: 30 },
            { key: 'rangeEndHour', label: 'Range End Hour', type: 'number', min: 9, max: 15, default: 10 },
            { key: 'rangeEndMinute', label: 'Range End Min', type: 'number', min: 0, max: 59, default: 0 },
            { key: 'showSignals', label: 'Show Signals', type: 'boolean', default: true },
        ],
        style: [
            { key: 'highColor', label: 'High Line (Breakout)', type: 'color', default: '#089981' },
            { key: 'lowColor', label: 'Low Line (Breakdown)', type: 'color', default: '#F23645' },
            { key: 'lineWidth', label: 'Line Width', type: 'number', min: 1, max: 4, default: 2 },
        ],
    },

    annStrategy: {
        name: 'ANN Strategy',
        fullName: 'Artificial Neural Network Strategy',
        pane: 'ann',
        category: 'strategy',
        description: 'Pre-trained neural network predicting market direction based on daily price changes',
        inputs: [
            { key: 'threshold', label: 'Threshold', type: 'number', min: 0.0001, max: 0.01, step: 0.0001, default: 0.0014 },
            { key: 'showBackground', label: 'Show Background', type: 'boolean', default: true },
            { key: 'showSignals', label: 'Show Signals', type: 'boolean', default: true },
        ],
        style: [
            { key: 'longColor', label: 'Long Signal', type: 'color', default: '#26A69A' },
            { key: 'shortColor', label: 'Short Signal', type: 'color', default: '#EF5350' },
            { key: 'predictionColor', label: 'Prediction Line', type: 'color', default: '#00BCD4' },
            { key: 'areaColor', label: 'Area Fill', type: 'color', default: '#C0C0C040' },
        ],
    },

    hilengaMilenga: {
        name: 'Hilenga-Milenga',
        fullName: 'Hilenga-Milenga by NK Sir',
        pane: 'hilengaMilenga',
        description: 'Momentum oscillator combining RSI with EMA and WMA smoothing lines',
        inputs: [
            { key: 'rsiLength', label: 'RSI Length', type: 'number', min: 1, max: 100, default: 9 },
            { key: 'emaLength', label: 'EMA Length', type: 'number', min: 1, max: 50, default: 3 },
            { key: 'wmaLength', label: 'WMA Length', type: 'number', min: 1, max: 100, default: 21 },
        ],
        style: [
            { key: 'rsiColor', label: 'RSI Line', type: 'color', default: '#131722' },
            { key: 'emaColor', label: 'Price (EMA)', type: 'color', default: '#26A69A' },
            { key: 'wmaColor', label: 'Strength (WMA)', type: 'color', default: '#EF5350' },
            { key: 'bullFillColor', label: 'Bullish Fill (>50)', type: 'color', default: '#ff6b6bB3' },
            { key: 'bearFillColor', label: 'Bearish Fill (<50)', type: 'color', default: '#4ecdc4B3' },
            { key: 'midlineColor', label: 'Midline (50)', type: 'color', default: '#787B86' },
        ],
    },

    adx: {
        name: 'ADX',
        fullName: 'Average Directional Index',
        pane: 'adx',
        inputs: [
            { key: 'period', label: 'Length', type: 'number', min: 1, max: 100, default: 14 },
        ],
        style: [
            { key: 'adxColor', label: 'ADX Line', type: 'color', default: '#FF9800' },
            { key: 'plusDIColor', label: '+DI Line', type: 'color', default: '#26A69A' },
            { key: 'minusDIColor', label: '-DI Line', type: 'color', default: '#EF5350' },
            { key: 'lineWidth', label: 'Line Width', type: 'number', min: 1, max: 5, default: 2 },
        ],
    },

    ichimoku: {
        name: 'Ichimoku',
        fullName: 'Ichimoku Cloud',
        pane: 'main',
        inputs: [
            { key: 'tenkanPeriod', label: 'Conversion Line', type: 'number', min: 1, max: 100, default: 9 },
            { key: 'kijunPeriod', label: 'Base Line', type: 'number', min: 1, max: 100, default: 26 },
            { key: 'senkouBPeriod', label: 'Senkou B Period', type: 'number', min: 1, max: 200, default: 52 },
            { key: 'displacement', label: 'Displacement', type: 'number', min: 1, max: 100, default: 26 },
        ],
        style: [
            { key: 'tenkanColor', label: 'Tenkan-sen', type: 'color', default: '#2962FF' },
            { key: 'kijunColor', label: 'Kijun-sen', type: 'color', default: '#EF5350' },
            { key: 'senkouAColor', label: 'Senkou A', type: 'color', default: '#26A69A' },
            { key: 'senkouBColor', label: 'Senkou B', type: 'color', default: '#EF5350' },
            { key: 'chikouColor', label: 'Chikou Span', type: 'color', default: '#9C27B0' },
            { key: 'cloudUpColor', label: 'Cloud Up', type: 'color', default: 'rgba(38,166,154,0.2)' },
            { key: 'cloudDownColor', label: 'Cloud Down', type: 'color', default: 'rgba(239,83,80,0.2)' },
        ],
    },

    pivotPoints: {
        name: 'Pivot Points',
        fullName: 'Pivot Points',
        pane: 'main',
        inputs: [
            {
                key: 'pivotType', label: 'Type', type: 'select', options: [
                    { value: 'traditional', label: 'Traditional' },
                    { value: 'fibonacci', label: 'Fibonacci' },
                    { value: 'woodie', label: 'Woodie' },
                    { value: 'classic', label: 'Classic' },
                    { value: 'dm', label: 'DeMark' },
                    { value: 'camarilla', label: 'Camarilla' }
                ], default: 'traditional'
            },
            { key: 'timeframe', label: 'Timeframe', type: 'select', options: ['daily', 'weekly', 'monthly'], default: 'daily' },
        ],
        style: [
            { key: 'pivotColor', label: 'Pivot', type: 'color', default: '#FF9800' },
            { key: 'resistanceColor', label: 'Resistance', type: 'color', default: '#EF5350' },
            { key: 'supportColor', label: 'Support', type: 'color', default: '#26A69A' },
            { key: 'lineWidth', label: 'Line Width', type: 'number', min: 1, max: 5, default: 1 },
            { key: 'showTitle', label: 'Show Title', type: 'boolean', default: true },
        ],
    },

    riskCalculator: {
        name: 'Risk Calculator',
        fullName: 'Risk Calculator (Position Sizing)',
        pane: 'main',
        category: 'risk',
        description: 'Calculate position size and risk-reward based on entry, stop loss, and capital',
        inputs: [
            { key: 'capital', label: 'Capital (₹)', type: 'number', min: 1000, step: 1000, default: 100000 },
            { key: 'riskPercent', label: 'Risk %', type: 'number', min: 0.5, max: 5, step: 0.1, default: 2 },
            { key: 'side', label: 'Side', type: 'select', options: ['BUY', 'SELL'], default: 'BUY' },
            { key: 'entryPrice', label: 'Entry Price', type: 'number', min: 0, step: 0.01, default: 0 },
            { key: 'stopLossPrice', label: 'Stop Loss', type: 'number', min: 0, step: 0.01, default: 0 },
            { key: 'targetPrice', label: 'Target Price', type: 'number', min: 0, step: 0.01, default: 0 },
            { key: 'riskRewardRatio', label: 'Risk:Reward', type: 'select', options: [1, 1.5, 2, 2.5, 3, 4, 5] as any, default: 2 },
            { key: 'showTarget', label: 'Show Target', type: 'boolean', default: true },
            { key: 'showPanel', label: 'Show Info Panel', type: 'boolean', default: true },
        ],
        style: [
            { key: 'entryColor', label: 'Entry Line', type: 'color', default: '#26a69a' },
            { key: 'stopLossColor', label: 'Stop Loss Line', type: 'color', default: '#ef5350' },
            { key: 'targetColor', label: 'Target Line', type: 'color', default: '#42a5f5' },
            { key: 'lineWidth', label: 'Line Width', type: 'number', min: 1, max: 4, default: 2 },
        ],
    },
    utBotAlerts: {
        name: 'UT Bot Alerts',
        fullName: 'UT Bot Alerts',
        pane: 'main',
        description: 'UT Bot Alerts indicator with Buy/Sell signals and trailing stop',
        inputs: [
            { key: 'keyValues', label: 'Key Value (Sensitivity)', type: 'number', min: 1, max: 10, default: 1 },
            { key: 'atrPeriod', label: 'ATR Period', type: 'number', min: 1, max: 100, default: 10 },
        ],
        style: [
            { key: 'upColor', label: 'Buy Signal', type: 'color', default: '#26A69A' },
            { key: 'downColor', label: 'Sell Signal', type: 'color', default: '#EF5350' },
            { key: 'stopColor', label: 'Trailing Stop Line', type: 'color', default: '#2196F3' },
            { key: 'lineWidth', label: 'Line Width', type: 'number', min: 1, max: 5, default: 1 },
            { key: 'showSignals', label: 'Show Buy/Sell Labels', type: 'boolean', default: true },
            { key: 'showBarColor', label: 'Color Bars', type: 'boolean', default: true },
        ],
    },
};


/**
 * Get config for a specific indicator type
 */
export const getIndicatorConfig = (type: string): IndicatorConfigDefinition | null => {
    return indicatorConfigs[type] || null;
};

/**
 * Get default settings for an indicator
 */
export const getDefaultSettings = (type: string): Record<string, any> => {
    const config = indicatorConfigs[type];
    if (!config) return {};

    const defaults: Record<string, any> = {};

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
