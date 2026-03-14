/**
 * Alert Condition Types and Configurations
 * Defines all supported alert conditions for indicators
 */

/**
 * Standard alert condition types
 */
export const ALERT_CONDITION_TYPES = {
    // Value-based conditions (single value comparison)
    CROSSES_ABOVE: 'crosses_above',
    CROSSES_BELOW: 'crosses_below',
    GREATER_THAN: 'greater_than',
    LESS_THAN: 'less_than',
    EQUALS: 'equals',

    // Zone-based conditions (range comparisons)
    ENTERS_ZONE: 'enters_zone',
    EXITS_ZONE: 'exits_zone',
    WITHIN_ZONE: 'within_zone',
    OUTSIDE_ZONE: 'outside_zone',

    // Crossover conditions (two series comparison)
    LINE_CROSSES_ABOVE: 'line_crosses_above',
    LINE_CROSSES_BELOW: 'line_crosses_below',

    // Change-based conditions
    INCREASES_BY: 'increases_by',
    DECREASES_BY: 'decreases_by',
    CHANGES_BY: 'changes_by',
} as const;

export type AlertConditionType = typeof ALERT_CONDITION_TYPES[keyof typeof ALERT_CONDITION_TYPES];

/**
 * Value range configuration for conditions with adjustable thresholds
 */
export interface ValueRange {
    min: number;
    max: number;
}

/**
 * Base alert condition configuration
 */
export interface BaseAlertCondition {
    id: string;
    type: AlertConditionType;
    label: string;
    description: string;
    series?: string;
    defaultValue?: number;
    value?: number | boolean;
    valueRange?: ValueRange;
    valueStep?: number;
    zone?: [number, number];
    series1?: string;
    series2?: string;
    comparison?: string;
    requiresPrice?: boolean;
}

/**
 * Alert condition for crossing above a value
 */
export interface CrossAboveCondition extends BaseAlertCondition {
    type: typeof ALERT_CONDITION_TYPES.CROSSES_ABOVE;
}

/**
 * Alert condition for crossing below a value
 */
export interface CrossBelowCondition extends BaseAlertCondition {
    type: typeof ALERT_CONDITION_TYPES.CROSSES_BELOW;
}

/**
 * Alert condition for entering a zone
 */
export interface EntersZoneCondition extends BaseAlertCondition {
    type: typeof ALERT_CONDITION_TYPES.ENTERS_ZONE;
    zone: [number, number];
}

/**
 * Alert condition for exiting a zone
 */
export interface ExitsZoneCondition extends BaseAlertCondition {
    type: typeof ALERT_CONDITION_TYPES.EXITS_ZONE;
    zone: [number, number];
}

/**
 * Alert condition for line crossing above another line
 */
export interface LineCrossAboveCondition extends BaseAlertCondition {
    type: typeof ALERT_CONDITION_TYPES.LINE_CROSSES_ABOVE;
    series1: string;
    series2: string;
}

/**
 * Alert condition for line crossing below another line
 */
export interface LineCrossBelowCondition extends BaseAlertCondition {
    type: typeof ALERT_CONDITION_TYPES.LINE_CROSSES_BELOW;
    series1: string;
    series2: string;
}

/**
 * Alert condition for equals comparison
 */
export interface EqualsCondition extends BaseAlertCondition {
    type: typeof ALERT_CONDITION_TYPES.EQUALS;
    value: number | boolean;
}

/**
 * Union type for all alert conditions
 */
export type AlertCondition =
    | CrossAboveCondition
    | CrossBelowCondition
    | EntersZoneCondition
    | ExitsZoneCondition
    | LineCrossAboveCondition
    | LineCrossBelowCondition
    | EqualsCondition
    | BaseAlertCondition;

/**
 * Indicator alert configuration
 */
export interface IndicatorAlertConfig {
    id: string;
    name: string;
    description: string;
    series: string[];
    defaultConditions: AlertCondition[];
}

/**
 * Map of indicator IDs to their alert configurations
 */
export interface IndicatorAlertConfigMap {
    [indicatorId: string]: IndicatorAlertConfig;
}

/**
 * Indicator-specific alert configurations
 * Defines available alert conditions for each indicator
 */
export const INDICATOR_ALERT_CONFIGS: IndicatorAlertConfigMap = {
    rsi: {
        id: 'rsi',
        name: 'RSI',
        description: 'Relative Strength Index',
        series: ['value'],
        defaultConditions: [
            {
                id: 'rsi_crosses_above',
                type: ALERT_CONDITION_TYPES.CROSSES_ABOVE,
                label: 'RSI Crosses Above',
                description: 'Alert when RSI crosses above a value',
                defaultValue: 70,
                series: 'value',
                valueRange: { min: 0, max: 100 },
                valueStep: 1,
            },
            {
                id: 'rsi_crosses_below',
                type: ALERT_CONDITION_TYPES.CROSSES_BELOW,
                label: 'RSI Crosses Below',
                description: 'Alert when RSI crosses below a value',
                defaultValue: 30,
                series: 'value',
                valueRange: { min: 0, max: 100 },
                valueStep: 1,
            },
            {
                id: 'rsi_enters_overbought',
                type: ALERT_CONDITION_TYPES.ENTERS_ZONE,
                label: 'RSI Enters Overbought',
                description: 'Alert when RSI enters overbought zone (70-100)',
                series: 'value',
                zone: [70, 100],
            },
            {
                id: 'rsi_enters_oversold',
                type: ALERT_CONDITION_TYPES.ENTERS_ZONE,
                label: 'RSI Enters Oversold',
                description: 'Alert when RSI enters oversold zone (0-30)',
                series: 'value',
                zone: [0, 30],
            },
            {
                id: 'rsi_exits_overbought',
                type: ALERT_CONDITION_TYPES.EXITS_ZONE,
                label: 'RSI Exits Overbought',
                description: 'Alert when RSI exits overbought zone',
                series: 'value',
                zone: [70, 100],
            },
            {
                id: 'rsi_exits_oversold',
                type: ALERT_CONDITION_TYPES.EXITS_ZONE,
                label: 'RSI Exits Oversold',
                description: 'Alert when RSI exits oversold zone',
                series: 'value',
                zone: [0, 30],
            },
        ],
    },

    macd: {
        id: 'macd',
        name: 'MACD',
        description: 'Moving Average Convergence Divergence',
        series: ['macd', 'signal', 'histogram'],
        defaultConditions: [
            {
                id: 'macd_crosses_signal_up',
                type: ALERT_CONDITION_TYPES.LINE_CROSSES_ABOVE,
                label: 'MACD Crosses Above Signal',
                description: 'Alert when MACD line crosses above signal line (bullish)',
                series1: 'macd',
                series2: 'signal',
            },
            {
                id: 'macd_crosses_signal_down',
                type: ALERT_CONDITION_TYPES.LINE_CROSSES_BELOW,
                label: 'MACD Crosses Below Signal',
                description: 'Alert when MACD line crosses below signal line (bearish)',
                series1: 'macd',
                series2: 'signal',
            },
            {
                id: 'macd_crosses_zero_up',
                type: ALERT_CONDITION_TYPES.CROSSES_ABOVE,
                label: 'MACD Crosses Above Zero',
                description: 'Alert when MACD crosses above zero line',
                series: 'macd',
                value: 0,
            },
            {
                id: 'macd_crosses_zero_down',
                type: ALERT_CONDITION_TYPES.CROSSES_BELOW,
                label: 'MACD Crosses Below Zero',
                description: 'Alert when MACD crosses below zero line',
                series: 'macd',
                value: 0,
            },
            {
                id: 'histogram_crosses_zero_up',
                type: ALERT_CONDITION_TYPES.CROSSES_ABOVE,
                label: 'Histogram Crosses Above Zero',
                description: 'Alert when MACD histogram crosses above zero',
                series: 'histogram',
                value: 0,
            },
            {
                id: 'histogram_crosses_zero_down',
                type: ALERT_CONDITION_TYPES.CROSSES_BELOW,
                label: 'Histogram Crosses Below Zero',
                description: 'Alert when MACD histogram crosses below zero',
                series: 'histogram',
                value: 0,
            },
        ],
    },

    bollingerBands: {
        id: 'bollingerBands',
        name: 'Bollinger Bands',
        description: 'Volatility bands around moving average',
        series: ['upper', 'middle', 'lower'],
        defaultConditions: [
            {
                id: 'price_crosses_upper_up',
                type: ALERT_CONDITION_TYPES.CROSSES_ABOVE,
                label: 'Price Crosses Above Upper Band',
                description: 'Alert when price crosses above upper Bollinger Band',
                series: 'price',
                comparison: 'upper',
                requiresPrice: true,
            },
            {
                id: 'price_crosses_upper_down',
                type: ALERT_CONDITION_TYPES.CROSSES_BELOW,
                label: 'Price Crosses Below Upper Band',
                description: 'Alert when price crosses back below upper band',
                series: 'price',
                comparison: 'upper',
                requiresPrice: true,
            },
            {
                id: 'price_crosses_lower_down',
                type: ALERT_CONDITION_TYPES.CROSSES_BELOW,
                label: 'Price Crosses Below Lower Band',
                description: 'Alert when price crosses below lower Bollinger Band',
                series: 'price',
                comparison: 'lower',
                requiresPrice: true,
            },
            {
                id: 'price_crosses_lower_up',
                type: ALERT_CONDITION_TYPES.CROSSES_ABOVE,
                label: 'Price Crosses Above Lower Band',
                description: 'Alert when price crosses back above lower band',
                series: 'price',
                comparison: 'lower',
                requiresPrice: true,
            },
            {
                id: 'price_crosses_middle',
                type: ALERT_CONDITION_TYPES.CROSSES_ABOVE,
                label: 'Price Crosses Middle Band',
                description: 'Alert when price crosses the middle (SMA) line',
                series: 'price',
                comparison: 'middle',
                requiresPrice: true,
            },
        ],
    },

    stochastic: {
        id: 'stochastic',
        name: 'Stochastic',
        description: 'Stochastic Oscillator',
        series: ['k', 'd'],
        defaultConditions: [
            {
                id: 'k_crosses_d_up',
                type: ALERT_CONDITION_TYPES.LINE_CROSSES_ABOVE,
                label: '%K Crosses Above %D',
                description: 'Alert when %K line crosses above %D line (bullish)',
                series1: 'k',
                series2: 'd',
            },
            {
                id: 'k_crosses_d_down',
                type: ALERT_CONDITION_TYPES.LINE_CROSSES_BELOW,
                label: '%K Crosses Below %D',
                description: 'Alert when %K line crosses below %D line (bearish)',
                series1: 'k',
                series2: 'd',
            },
            {
                id: 'stoch_enters_overbought',
                type: ALERT_CONDITION_TYPES.ENTERS_ZONE,
                label: 'Stochastic Enters Overbought',
                description: 'Alert when stochastic enters overbought zone (80-100)',
                series: 'k',
                zone: [80, 100],
            },
            {
                id: 'stoch_enters_oversold',
                type: ALERT_CONDITION_TYPES.ENTERS_ZONE,
                label: 'Stochastic Enters Oversold',
                description: 'Alert when stochastic enters oversold zone (0-20)',
                series: 'k',
                zone: [0, 20],
            },
            {
                id: 'stoch_exits_overbought',
                type: ALERT_CONDITION_TYPES.EXITS_ZONE,
                label: 'Stochastic Exits Overbought',
                description: 'Alert when stochastic exits overbought zone',
                series: 'k',
                zone: [80, 100],
            },
            {
                id: 'stoch_exits_oversold',
                type: ALERT_CONDITION_TYPES.EXITS_ZONE,
                label: 'Stochastic Exits Oversold',
                description: 'Alert when stochastic exits oversold zone',
                series: 'k',
                zone: [0, 20],
            },
        ],
    },

    supertrend: {
        id: 'supertrend',
        name: 'Supertrend',
        description: 'Trend following indicator',
        series: ['supertrend', 'direction'],
        defaultConditions: [
            {
                id: 'supertrend_bullish',
                type: ALERT_CONDITION_TYPES.EQUALS,
                label: 'Trend Changes to Bullish',
                description: 'Alert when Supertrend changes to bullish (green)',
                series: 'direction',
                value: 1,
            },
            {
                id: 'supertrend_bearish',
                type: ALERT_CONDITION_TYPES.EQUALS,
                label: 'Trend Changes to Bearish',
                description: 'Alert when Supertrend changes to bearish (red)',
                series: 'direction',
                value: -1,
            },
            {
                id: 'price_crosses_supertrend_up',
                type: ALERT_CONDITION_TYPES.CROSSES_ABOVE,
                label: 'Price Crosses Above Supertrend',
                description: 'Alert when price crosses above Supertrend line',
                series: 'price',
                comparison: 'supertrend',
                requiresPrice: true,
            },
            {
                id: 'price_crosses_supertrend_down',
                type: ALERT_CONDITION_TYPES.CROSSES_BELOW,
                label: 'Price Crosses Below Supertrend',
                description: 'Alert when price crosses below Supertrend line',
                series: 'price',
                comparison: 'supertrend',
                requiresPrice: true,
            },
        ],
    },

    vwap: {
        id: 'vwap',
        name: 'VWAP',
        description: 'Volume Weighted Average Price',
        series: ['value'],
        defaultConditions: [
            {
                id: 'price_crosses_vwap_up',
                type: ALERT_CONDITION_TYPES.CROSSES_ABOVE,
                label: 'Price Crosses Above VWAP',
                description: 'Alert when price crosses above VWAP line',
                series: 'price',
                comparison: 'value',
                requiresPrice: true,
            },
            {
                id: 'price_crosses_vwap_down',
                type: ALERT_CONDITION_TYPES.CROSSES_BELOW,
                label: 'Price Crosses Below VWAP',
                description: 'Alert when price crosses below VWAP line',
                series: 'price',
                comparison: 'value',
                requiresPrice: true,
            },
        ],
    },

    sma: {
        id: 'sma',
        name: 'SMA',
        description: 'Simple Moving Average',
        series: ['value'],
        defaultConditions: [
            {
                id: 'price_crosses_sma_up',
                type: ALERT_CONDITION_TYPES.CROSSES_ABOVE,
                label: 'Price Crosses Above SMA',
                description: 'Alert when price crosses above SMA',
                series: 'price',
                comparison: 'value',
                requiresPrice: true,
            },
            {
                id: 'price_crosses_sma_down',
                type: ALERT_CONDITION_TYPES.CROSSES_BELOW,
                label: 'Price Crosses Below SMA',
                description: 'Alert when price crosses below SMA',
                series: 'price',
                comparison: 'value',
                requiresPrice: true,
            },
        ],
    },

    ema: {
        id: 'ema',
        name: 'EMA',
        description: 'Exponential Moving Average',
        series: ['value'],
        defaultConditions: [
            {
                id: 'price_crosses_ema_up',
                type: ALERT_CONDITION_TYPES.CROSSES_ABOVE,
                label: 'Price Crosses Above EMA',
                description: 'Alert when price crosses above EMA',
                series: 'price',
                comparison: 'value',
                requiresPrice: true,
            },
            {
                id: 'price_crosses_ema_down',
                type: ALERT_CONDITION_TYPES.CROSSES_BELOW,
                label: 'Price Crosses Below EMA',
                description: 'Alert when price crosses below EMA',
                series: 'price',
                comparison: 'value',
                requiresPrice: true,
            },
        ],
    },

    atr: {
        id: 'atr',
        name: 'ATR',
        description: 'Average True Range',
        series: ['value'],
        defaultConditions: [
            {
                id: 'atr_crosses_above',
                type: ALERT_CONDITION_TYPES.CROSSES_ABOVE,
                label: 'ATR Crosses Above',
                description: 'Alert when ATR crosses above a value',
                series: 'value',
                defaultValue: 10,
                valueRange: { min: 0, max: 1000 },
                valueStep: 0.1,
            },
            {
                id: 'atr_crosses_below',
                type: ALERT_CONDITION_TYPES.CROSSES_BELOW,
                label: 'ATR Crosses Below',
                description: 'Alert when ATR crosses below a value',
                series: 'value',
                defaultValue: 5,
                valueRange: { min: 0, max: 1000 },
                valueStep: 0.1,
            },
        ],
    },

    utBotAlerts: {
        id: 'utBotAlerts',
        name: 'UT Bot Alerts',
        description: 'UT Bot Buy/Sell Signals',
        series: ['buy', 'sell'],
        defaultConditions: [
            {
                id: 'utbot_buy',
                type: ALERT_CONDITION_TYPES.EQUALS,
                label: 'Buy Signal',
                description: 'Alert when a Buy signal is generated',
                series: 'buy',
                value: true,
            },
            {
                id: 'utbot_sell',
                type: ALERT_CONDITION_TYPES.EQUALS,
                label: 'Sell Signal',
                description: 'Alert when a Sell signal is generated',
                series: 'sell',
                value: true,
            },
        ],
    },
};

/**
 * Get alert configuration for a specific indicator
 * @param indicatorId - Indicator identifier
 * @returns Alert configuration or null if not found
 */
export const getIndicatorAlertConfig = (indicatorId: string): IndicatorAlertConfig | null => {
    return INDICATOR_ALERT_CONFIGS[indicatorId] || null;
};

/**
 * Get all available indicators that support alerts
 * @returns Array of indicator configurations
 */
export const getAlertableIndicators = (): IndicatorAlertConfig[] => {
    return Object.values(INDICATOR_ALERT_CONFIGS);
};

/**
 * Check if an indicator supports alerts
 * @param indicatorId - Indicator identifier
 * @returns True if indicator supports alerts
 */
export const isIndicatorAlertable = (indicatorId: string): boolean => {
    return indicatorId in INDICATOR_ALERT_CONFIGS;
};

/**
 * Get condition configuration by ID
 * @param indicatorId - Indicator identifier
 * @param conditionId - Condition identifier
 * @returns Condition configuration or null
 */
export const getConditionConfig = (indicatorId: string, conditionId: string): AlertCondition | null => {
    const indicator = INDICATOR_ALERT_CONFIGS[indicatorId];
    if (!indicator) return null;

    return indicator.defaultConditions.find(c => c.id === conditionId) || null;
};
