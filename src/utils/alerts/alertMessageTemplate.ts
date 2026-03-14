/**
 * Alert Message Template Processor
 * Processes alert messages with dynamic placeholders
 */

/**
 * RSI indicator data
 */
export interface RSIIndicatorData {
    value?: number;
}

/**
 * MACD indicator data
 */
export interface MACDIndicatorData {
    macd?: number;
    signal?: number;
    histogram?: number;
}

/**
 * Bollinger Bands indicator data
 */
export interface BollingerBandsIndicatorData {
    upper?: number;
    middle?: number;
    lower?: number;
}

/**
 * Stochastic indicator data
 */
export interface StochasticIndicatorData {
    k?: number;
    d?: number;
}

/**
 * Supertrend indicator data
 */
export interface SupertrendIndicatorData {
    supertrend?: number;
    direction?: 1 | -1;
}

/**
 * Single value indicator data (VWAP, SMA, EMA, ATR)
 */
export interface SingleValueIndicatorData {
    value?: number;
}

/**
 * UT Bot Alerts indicator data
 */
export interface UTBotAlertsIndicatorData {
    buy?: boolean;
    sell?: boolean;
    trailingStop?: number;
}

/**
 * All indicator data types
 */
export interface IndicatorsData {
    rsi?: RSIIndicatorData;
    macd?: MACDIndicatorData;
    bollingerBands?: BollingerBandsIndicatorData;
    stochastic?: StochasticIndicatorData;
    supertrend?: SupertrendIndicatorData;
    vwap?: SingleValueIndicatorData;
    sma?: SingleValueIndicatorData;
    ema?: SingleValueIndicatorData;
    atr?: SingleValueIndicatorData;
    utBotAlerts?: UTBotAlertsIndicatorData;
}

/**
 * Alert metadata
 */
export interface AlertInfo {
    name?: string;
    condition?: string;
}

/**
 * Data object for message template processing
 */
export interface MessageTemplateData {
    symbol?: string;
    exchange?: string;
    close?: number;
    open?: number;
    high?: number;
    low?: number;
    volume?: number;
    time?: number;
    indicators?: IndicatorsData;
    alert?: AlertInfo;
}

/**
 * Condition configuration for generating default messages
 */
export interface ConditionConfig {
    indicator?: string;
    type?: string;
    series?: string;
    value?: number;
    series1?: string;
    series2?: string;
    zone?: [number, number];
}

/**
 * Placeholder token definition
 */
export interface PlaceholderToken {
    token: string;
    description: string;
}

/**
 * Indicator placeholders map
 */
export interface IndicatorPlaceholders {
    rsi: PlaceholderToken[];
    macd: PlaceholderToken[];
    bollingerBands: PlaceholderToken[];
    stochastic: PlaceholderToken[];
    supertrend: PlaceholderToken[];
    vwap: PlaceholderToken[];
    sma: PlaceholderToken[];
    ema: PlaceholderToken[];
    atr: PlaceholderToken[];
    utBotAlerts: PlaceholderToken[];
}

/**
 * Available placeholders structure
 */
export interface AvailablePlaceholders {
    general: PlaceholderToken[];
    price: PlaceholderToken[];
    indicators: IndicatorPlaceholders;
}

/**
 * Process alert message template with dynamic data
 * @param template - Message template with placeholders
 * @param data - Data object containing values
 * @returns Processed message
 */
export const processAlertMessage = (template: string, data: MessageTemplateData): string => {
    if (!template || typeof template !== 'string') {
        return '';
    }

    let message = template;

    // Symbol and exchange
    message = message.replace(/\{\{symbol\}\}/g, data.symbol || '');
    message = message.replace(/\{\{exchange\}\}/g, data.exchange || '');

    // Price data
    message = message.replace(/\{\{close\}\}/g, formatValue(data.close));
    message = message.replace(/\{\{open\}\}/g, formatValue(data.open));
    message = message.replace(/\{\{high\}\}/g, formatValue(data.high));
    message = message.replace(/\{\{low\}\}/g, formatValue(data.low));
    message = message.replace(/\{\{volume\}\}/g, formatValue(data.volume, 0));

    // Time
    message = message.replace(/\{\{time\}\}/g, new Date(data.time || Date.now()).toISOString());
    message = message.replace(/\{\{date\}\}/g, new Date(data.time || Date.now()).toLocaleDateString());
    message = message.replace(/\{\{timestamp\}\}/g, formatValue(data.time || Date.now(), 0));

    // Indicator values (if provided)
    if (data.indicators) {
        const indicators = data.indicators;

        // RSI
        if (indicators.rsi !== undefined) {
            message = message.replace(/\{\{rsi\}\}/g, formatValue(indicators.rsi.value));
        }

        // MACD
        if (indicators.macd !== undefined) {
            message = message.replace(/\{\{macd\}\}/g, formatValue(indicators.macd.macd));
            message = message.replace(/\{\{macd\.signal\}\}/g, formatValue(indicators.macd.signal));
            message = message.replace(/\{\{macd\.histogram\}\}/g, formatValue(indicators.macd.histogram));
        }

        // Bollinger Bands
        if (indicators.bollingerBands !== undefined) {
            message = message.replace(/\{\{bb\.upper\}\}/g, formatValue(indicators.bollingerBands.upper));
            message = message.replace(/\{\{bb\.middle\}\}/g, formatValue(indicators.bollingerBands.middle));
            message = message.replace(/\{\{bb\.lower\}\}/g, formatValue(indicators.bollingerBands.lower));
        }

        // Stochastic
        if (indicators.stochastic !== undefined) {
            message = message.replace(/\{\{stoch\.k\}\}/g, formatValue(indicators.stochastic.k));
            message = message.replace(/\{\{stoch\.d\}\}/g, formatValue(indicators.stochastic.d));
        }

        // Supertrend
        if (indicators.supertrend !== undefined) {
            message = message.replace(/\{\{supertrend\}\}/g, formatValue(indicators.supertrend.supertrend));
            message = message.replace(/\{\{supertrend\.direction\}\}/g, indicators.supertrend.direction === 1 ? 'Bullish' : 'Bearish');
        }

        // VWAP
        if (indicators.vwap !== undefined) {
            message = message.replace(/\{\{vwap\}\}/g, formatValue(indicators.vwap.value));
        }

        // SMA
        if (indicators.sma !== undefined) {
            message = message.replace(/\{\{sma\}\}/g, formatValue(indicators.sma.value));
        }

        // EMA
        if (indicators.ema !== undefined) {
            message = message.replace(/\{\{ema\}\}/g, formatValue(indicators.ema.value));
        }

        // ATR
        if (indicators.atr !== undefined) {
            message = message.replace(/\{\{atr\}\}/g, formatValue(indicators.atr.value));
        }

        // UT Bot Alerts
        if (indicators.utBotAlerts !== undefined) {
            message = message.replace(/\{\{utBotAlerts\.trailingStop\}\}/g, formatValue(indicators.utBotAlerts.trailingStop));
        }
    }

    // Alert-specific data
    if (data.alert) {
        message = message.replace(/\{\{alert\.name\}\}/g, data.alert.name || '');
        message = message.replace(/\{\{alert\.condition\}\}/g, data.alert.condition || '');
    }

    return message;
};

/**
 * Format a numeric value for display
 * @param value - Value to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted value
 */
const formatValue = (value: number | undefined | null, decimals: number = 2): string => {
    if (value === undefined || value === null) {
        return 'N/A';
    }
    return Number(value).toFixed(decimals);
};

/**
 * Get default message template for a condition
 * @param condition - Condition configuration
 * @param symbol - Symbol name
 * @returns Default message template
 */
export const getDefaultMessageTemplate = (condition: ConditionConfig, symbol?: string): string => {
    const { indicator, type, series, value, series1, series2, zone } = condition;

    switch (type) {
        case 'crosses_above':
            if (series === 'price') {
                return `{{symbol}} crossed above ${indicator} at {{close}}`;
            }
            return `{{symbol}} ${indicator} crossed above ${value} (current: {{${indicator}${series ? '.' + series : ''}}})`;

        case 'crosses_below':
            if (series === 'price') {
                return `{{symbol}} crossed below ${indicator} at {{close}}`;
            }
            return `{{symbol}} ${indicator} crossed below ${value} (current: {{${indicator}${series ? '.' + series : ''}}})`;

        case 'line_crosses_above':
            return `{{symbol}} ${indicator} ${series1} crossed above ${series2}`;

        case 'line_crosses_below':
            return `{{symbol}} ${indicator} ${series1} crossed below ${series2}`;

        case 'enters_zone':
            return `{{symbol}} ${indicator} entered zone [${zone?.[0]}-${zone?.[1]}]`;

        case 'exits_zone':
            return `{{symbol}} ${indicator} exited zone [${zone?.[0]}-${zone?.[1]}]`;

        case 'equals':
            return `{{symbol}} ${indicator} changed to ${value}`;

        default:
            return `{{symbol}} alert triggered for ${indicator}`;
    }
};

/**
 * Available placeholder tokens
 */
export const AVAILABLE_PLACEHOLDERS: AvailablePlaceholders = {
    general: [
        { token: '{{symbol}}', description: 'Trading symbol' },
        { token: '{{exchange}}', description: 'Exchange name' },
        { token: '{{time}}', description: 'ISO timestamp' },
        { token: '{{date}}', description: 'Date string' },
    ],
    price: [
        { token: '{{close}}', description: 'Close price' },
        { token: '{{open}}', description: 'Open price' },
        { token: '{{high}}', description: 'High price' },
        { token: '{{low}}', description: 'Low price' },
        { token: '{{volume}}', description: 'Volume' },
    ],
    indicators: {
        rsi: [
            { token: '{{rsi}}', description: 'RSI value' },
        ],
        macd: [
            { token: '{{macd}}', description: 'MACD line value' },
            { token: '{{macd.signal}}', description: 'Signal line value' },
            { token: '{{macd.histogram}}', description: 'Histogram value' },
        ],
        bollingerBands: [
            { token: '{{bb.upper}}', description: 'Upper band value' },
            { token: '{{bb.middle}}', description: 'Middle band value' },
            { token: '{{bb.lower}}', description: 'Lower band value' },
        ],
        stochastic: [
            { token: '{{stoch.k}}', description: '%K value' },
            { token: '{{stoch.d}}', description: '%D value' },
        ],
        supertrend: [
            { token: '{{supertrend}}', description: 'Supertrend value' },
            { token: '{{supertrend.direction}}', description: 'Trend direction (Bullish/Bearish)' },
        ],
        vwap: [
            { token: '{{vwap}}', description: 'VWAP value' },
        ],
        sma: [
            { token: '{{sma}}', description: 'SMA value' },
        ],
        ema: [
            { token: '{{ema}}', description: 'EMA value' },
        ],
        atr: [
            { token: '{{atr}}', description: 'ATR value' },
        ],
        utBotAlerts: [
            { token: '{{utBotAlerts.trailingStop}}', description: 'UT Bot Trailing Stop Value' },
        ],
    },
};
