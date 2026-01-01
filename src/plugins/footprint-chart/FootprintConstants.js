/**
 * Footprint Chart Constants and Configuration
 * Colors, presets, and default settings for footprint visualization
 */

// Footprint display presets
export const FOOTPRINT_PRESETS = {
    DELTA_PROFILE: 'delta_profile',
    BID_ASK_PROFILE: 'bid_ask_profile',
    VOLUME_PROFILE: 'volume_profile',
    FOCUS_FOOTPRINT: 'focus_footprint',
    LOPSIDED_FOOTPRINT: 'lopsided_footprint',
    CLASSIC: 'classic',
};

// Preset display names
export const PRESET_NAMES = {
    [FOOTPRINT_PRESETS.DELTA_PROFILE]: 'Delta Profile',
    [FOOTPRINT_PRESETS.BID_ASK_PROFILE]: 'Bid-Ask Profile',
    [FOOTPRINT_PRESETS.VOLUME_PROFILE]: 'Volume Profile',
    [FOOTPRINT_PRESETS.FOCUS_FOOTPRINT]: 'Focus Footprint',
    [FOOTPRINT_PRESETS.LOPSIDED_FOOTPRINT]: 'Lopsided Footprint',
    [FOOTPRINT_PRESETS.CLASSIC]: 'Classic',
};

// Preset descriptions
export const PRESET_DESCRIPTIONS = {
    [FOOTPRINT_PRESETS.DELTA_PROFILE]: 'Shows delta (buy-sell) value in each cell with gradient colors',
    [FOOTPRINT_PRESETS.BID_ASK_PROFILE]: 'Shows stacked buy/sell volume bars side by side',
    [FOOTPRINT_PRESETS.VOLUME_PROFILE]: 'Shows total volume at each price level',
    [FOOTPRINT_PRESETS.FOCUS_FOOTPRINT]: 'Highlights high volume levels, dims low activity',
    [FOOTPRINT_PRESETS.LOPSIDED_FOOTPRINT]: 'Emphasizes imbalance direction with arrows',
    [FOOTPRINT_PRESETS.CLASSIC]: 'Traditional bid x ask numeric display',
};

// Color schemes
export const COLORS = {
    // Delta colors (gradient from sell to buy dominant)
    DELTA_STRONG_BUY: '#00C853',     // Strong buy pressure (delta > +50%)
    DELTA_BUY: '#4CAF50',             // Buy dominant
    DELTA_NEUTRAL: '#9E9E9E',         // Balanced
    DELTA_SELL: '#F44336',            // Sell dominant
    DELTA_STRONG_SELL: '#D32F2F',     // Strong sell pressure (delta < -50%)

    // Volume bars
    BUY_BAR: '#26A69A',               // Green-teal for buy volume
    SELL_BAR: '#EF5350',              // Red for sell volume
    BUY_BAR_LIGHT: 'rgba(38, 166, 154, 0.6)',
    SELL_BAR_LIGHT: 'rgba(239, 83, 80, 0.6)',

    // Imbalance highlighting
    IMBALANCE_BUY: '#FFD54F',         // Yellow-gold for buy imbalance
    IMBALANCE_SELL: '#FFB74D',        // Orange for sell imbalance
    IMBALANCE_STACKED: '#FF5722',     // Deep orange for stacked imbalances

    // POC and Value Area
    POC: '#2196F3',                   // Blue for Point of Control
    VAH: '#9C27B0',                   // Purple for Value Area High
    VAL: '#9C27B0',                   // Purple for Value Area Low
    VALUE_AREA_FILL: 'rgba(156, 39, 176, 0.1)',

    // High/Low Volume Nodes
    HVN: '#7B1FA2',                   // High Volume Node - dark purple
    LVN: '#E1BEE7',                   // Low Volume Node - light purple

    // Cell backgrounds
    CELL_BACKGROUND: 'rgba(42, 46, 57, 0.8)',
    CELL_BORDER: 'rgba(255, 255, 255, 0.1)',
    CELL_HOVER: 'rgba(255, 255, 255, 0.15)',

    // Text
    TEXT_PRIMARY: '#D1D4DC',
    TEXT_SECONDARY: '#787B86',
    TEXT_LIGHT: '#FFFFFF',

    // Candle body reference
    CANDLE_UP: '#26A69A',
    CANDLE_DOWN: '#EF5350',
};

// Default settings
export const DEFAULT_SETTINGS = {
    preset: FOOTPRINT_PRESETS.DELTA_PROFILE,
    cellHeight: 'auto',              // 'auto' or number in pixels
    cellWidth: 80,                   // Width of footprint column
    showImbalances: true,
    imbalanceRatio: 3,               // Minimum ratio for imbalance detection
    showPOC: true,
    showValueArea: false,
    valueAreaPercent: 70,
    showDeltaText: true,
    showVolumeText: true,
    fontSize: 10,
    opacity: 0.9,
    showOnlyOnHover: false,
    autoTickSize: true,
    customTickSize: null,
    highlightPOC: true,
    fadeOldBars: true,               // Fade footprints as they age
    maxBarsToShow: 50,               // Maximum number of footprint bars to render
};

// Cell size presets
export const CELL_SIZE_PRESETS = {
    SMALL: { width: 60, fontSize: 8 },
    MEDIUM: { width: 80, fontSize: 10 },
    LARGE: { width: 100, fontSize: 12 },
    XLARGE: { width: 120, fontSize: 14 },
};

// Tick size presets based on price
export const TICK_SIZE_BY_PRICE = [
    { maxPrice: 50, tickSize: 0.05 },
    { maxPrice: 250, tickSize: 0.05 },
    { maxPrice: 500, tickSize: 0.10 },
    { maxPrice: 1000, tickSize: 0.25 },
    { maxPrice: 5000, tickSize: 0.50 },
    { maxPrice: 10000, tickSize: 1.00 },
    { maxPrice: Infinity, tickSize: 5.00 },
];

/**
 * Get tick size for a given price
 * @param {number} price
 * @returns {number}
 */
export const getTickSize = (price) => {
    for (const tier of TICK_SIZE_BY_PRICE) {
        if (price <= tier.maxPrice) {
            return tier.tickSize;
        }
    }
    return 5.00;
};

/**
 * Get delta color based on delta percentage
 * @param {number} deltaPercent - Delta as percentage of total volume
 * @returns {string} - Color hex code
 */
export const getDeltaColor = (deltaPercent) => {
    if (deltaPercent >= 50) return COLORS.DELTA_STRONG_BUY;
    if (deltaPercent >= 20) return COLORS.DELTA_BUY;
    if (deltaPercent <= -50) return COLORS.DELTA_STRONG_SELL;
    if (deltaPercent <= -20) return COLORS.DELTA_SELL;
    return COLORS.DELTA_NEUTRAL;
};

/**
 * Get gradient color for delta visualization
 * @param {number} deltaPercent - Delta as percentage (-100 to +100)
 * @returns {string} - RGBA color string
 */
export const getDeltaGradient = (deltaPercent) => {
    // Clamp to -100 to +100
    const clamped = Math.max(-100, Math.min(100, deltaPercent));

    // Normalize to 0-1 range (0 = full sell, 0.5 = neutral, 1 = full buy)
    const normalized = (clamped + 100) / 200;

    // Interpolate between sell red and buy green
    const r = Math.round(255 * (1 - normalized));
    const g = Math.round(255 * normalized);
    const b = 50;
    const a = 0.7 + (Math.abs(clamped) / 100) * 0.3; // More opaque for stronger signals

    return `rgba(${r}, ${g}, ${b}, ${a})`;
};

/**
 * Get imbalance highlight color
 * @param {string} type - 'buy' or 'sell'
 * @param {number} strength - Imbalance strength (0-3)
 * @returns {string}
 */
export const getImbalanceColor = (type, strength = 1) => {
    const baseColor = type === 'buy' ? COLORS.IMBALANCE_BUY : COLORS.IMBALANCE_SELL;
    const alpha = Math.min(0.3 + strength * 0.2, 0.9);
    return baseColor.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
};

/**
 * Format volume for display
 * @param {number} volume
 * @returns {string}
 */
export const formatVolume = (volume) => {
    if (volume >= 10000000) return `${(volume / 10000000).toFixed(1)}Cr`;
    if (volume >= 100000) return `${(volume / 100000).toFixed(1)}L`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toString();
};

/**
 * Format delta for display
 * @param {number} delta
 * @returns {string}
 */
export const formatDelta = (delta) => {
    const prefix = delta > 0 ? '+' : '';
    if (Math.abs(delta) >= 10000000) return `${prefix}${(delta / 10000000).toFixed(1)}Cr`;
    if (Math.abs(delta) >= 100000) return `${prefix}${(delta / 100000).toFixed(1)}L`;
    if (Math.abs(delta) >= 1000) return `${prefix}${(delta / 1000).toFixed(1)}K`;
    return `${prefix}${delta}`;
};

export default {
    FOOTPRINT_PRESETS,
    PRESET_NAMES,
    PRESET_DESCRIPTIONS,
    COLORS,
    DEFAULT_SETTINGS,
    CELL_SIZE_PRESETS,
    TICK_SIZE_BY_PRICE,
    getTickSize,
    getDeltaColor,
    getDeltaGradient,
    getImbalanceColor,
    formatVolume,
    formatDelta,
};
