/**
 * Color Utilities
 * Centralized color constants and theme-aware color functions
 *
 * Provides consistent colors across the application with support
 * for light and dark themes.
 */

// ============ CHART COLORS ============

/**
 * Primary chart colors for candles and price movements
 */
export const CHART_COLORS = {
    // Bullish/Up colors
    UP: {
        primary: '#089981',     // Main candle up color (TradingView green)
        light: '#26a69a',       // Lighter variant for highlights
        dark: '#00695c',        // Darker variant for emphasis
        transparent: 'rgba(8, 153, 129, 0.2)'  // For fills/areas
    },

    // Bearish/Down colors
    DOWN: {
        primary: '#F23645',     // Main candle down color (TradingView red)
        light: '#ef5350',       // Lighter variant for highlights
        dark: '#c62828',        // Darker variant for emphasis
        transparent: 'rgba(242, 54, 69, 0.2)'  // For fills/areas
    },

    // Neutral colors
    NEUTRAL: {
        primary: '#787B86',     // Gray for unchanged
        light: '#9598A1',       // Lighter gray
        dark: '#5D606B',        // Darker gray
    }
};

// ============ INDICATOR COLORS ============

/**
 * Default colors for various indicator types
 */
export const INDICATOR_COLORS = {
    // Moving Averages
    SMA: '#2196F3',         // Blue
    EMA: '#FF9800',         // Orange
    WMA: '#9C27B0',         // Purple
    VWAP: '#E91E63',        // Pink

    // Oscillators
    RSI: '#7E57C2',         // Deep Purple
    MACD: {
        line: '#2196F3',    // Blue
        signal: '#FF9800',  // Orange
        histogram: {
            positive: '#089981',
            negative: '#F23645'
        }
    },
    STOCHASTIC: {
        k: '#2196F3',       // Blue
        d: '#FF9800'        // Orange
    },

    // Bands
    BOLLINGER: {
        upper: '#787B86',
        middle: '#2196F3',
        lower: '#787B86',
        fill: 'rgba(33, 150, 243, 0.1)'
    },

    // Support/Resistance
    SUPPORT: '#26a69a',     // Green
    RESISTANCE: '#ef5350', // Red

    // Volume
    VOLUME_UP: '#089981',
    VOLUME_DOWN: '#F23645',

    // Supertrend
    SUPERTREND: {
        bullish: '#26a69a',
        bearish: '#ef5350'
    },

    // Pivot Points
    PIVOT: '#FFD700',       // Gold
    R1: '#ef5350',          // Red
    R2: '#d32f2f',
    R3: '#b71c1c',
    S1: '#26a69a',          // Green
    S2: '#00897b',
    S3: '#00695c',

    // Comparison symbols
    COMPARISON: ['#f57f17', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5']
};

// ============ UI COLORS ============

/**
 * Colors for UI elements (buttons, alerts, etc.)
 */
export const UI_COLORS = {
    // Status colors
    SUCCESS: '#4caf50',
    WARNING: '#ff9800',
    ERROR: '#f44336',
    INFO: '#2196f3',

    // Alert levels
    ALERT: {
        triggered: '#f44336',
        active: '#4caf50',
        pending: '#ff9800'
    },

    // Selection/Highlight
    HIGHLIGHT: '#FFD700',
    SELECTION: 'rgba(33, 150, 243, 0.3)',

    // Order colors
    ORDER: {
        buy: '#26a69a',
        sell: '#ef5350',
        pending: '#ff9800',
        executed: '#4caf50',
        cancelled: '#9e9e9e'
    }
};

// ============ THEME COLORS ============

/**
 * Theme-specific colors for backgrounds, text, etc.
 */
export const THEME_COLORS = {
    dark: {
        background: '#131722',
        backgroundSecondary: '#1E222D',
        surface: '#2A2E39',
        border: '#363A45',
        text: '#D1D4DC',
        textSecondary: '#787B86',
        grid: '#2A2E39'
    },
    light: {
        background: '#ffffff',
        backgroundSecondary: '#f8f9fa',
        surface: '#f0f3fa',
        border: '#e0e3eb',
        text: '#131722',
        textSecondary: '#787B86',
        grid: '#e0e3eb'
    }
};

// ============ HELPER FUNCTIONS ============

/**
 * Get color based on price change direction
 * @param {number} change - Price change value
 * @param {boolean} useLight - Use lighter variant
 * @returns {string} Color hex code
 */
export const getChangeColor = (change, useLight = false) => {
    if (change > 0) {
        return useLight ? CHART_COLORS.UP.light : CHART_COLORS.UP.primary;
    } else if (change < 0) {
        return useLight ? CHART_COLORS.DOWN.light : CHART_COLORS.DOWN.primary;
    }
    return CHART_COLORS.NEUTRAL.primary;
};

/**
 * Get theme-specific color
 * @param {string} key - Color key (e.g., 'background', 'text')
 * @param {string} theme - Theme name ('dark' or 'light')
 * @returns {string} Color hex code
 */
export const getThemeColor = (key, theme = 'dark') => {
    const themeColors = THEME_COLORS[theme] || THEME_COLORS.dark;
    return themeColors[key] || themeColors.text;
};

/**
 * Get indicator color by type
 * @param {string} type - Indicator type (e.g., 'sma', 'ema')
 * @returns {string} Color hex code
 */
export const getIndicatorColor = (type) => {
    const typeUpper = type?.toUpperCase() || '';
    return INDICATOR_COLORS[typeUpper] || '#2196F3';
};

/**
 * Get comparison symbol color by index
 * @param {number} index - Symbol index
 * @returns {string} Color hex code
 */
export const getComparisonColor = (index) => {
    const colors = INDICATOR_COLORS.COMPARISON;
    return colors[index % colors.length];
};

/**
 * Adjust color opacity
 * @param {string} hex - Hex color code
 * @param {number} opacity - Opacity value (0-1)
 * @returns {string} RGBA color string
 */
export const withOpacity = (hex, opacity) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

/**
 * Lighten a hex color
 * @param {string} hex - Hex color code
 * @param {number} percent - Percentage to lighten (0-100)
 * @returns {string} Lightened hex color
 */
export const lighten = (hex, percent) => {
    const num = parseInt(hex.slice(1), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
};

/**
 * Darken a hex color
 * @param {string} hex - Hex color code
 * @param {number} percent - Percentage to darken (0-100)
 * @returns {string} Darkened hex color
 */
export const darken = (hex, percent) => {
    const num = parseInt(hex.slice(1), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
};

/**
 * Check if a color is light or dark
 * @param {string} hex - Hex color code
 * @returns {boolean} True if color is light
 */
export const isLightColor = (hex) => {
    const num = parseInt(hex.slice(1), 16);
    const r = num >> 16;
    const g = (num >> 8) & 0x00FF;
    const b = num & 0x0000FF;
    // Using relative luminance formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
};

/**
 * Get contrasting text color for a background
 * @param {string} backgroundColor - Background hex color
 * @returns {string} Text color (black or white)
 */
export const getContrastText = (backgroundColor) => {
    return isLightColor(backgroundColor) ? '#000000' : '#ffffff';
};

// Export default object for convenience
export default {
    CHART_COLORS,
    INDICATOR_COLORS,
    UI_COLORS,
    THEME_COLORS,
    getChangeColor,
    getThemeColor,
    getIndicatorColor,
    getComparisonColor,
    withOpacity,
    lighten,
    darken,
    isLightColor,
    getContrastText
};
