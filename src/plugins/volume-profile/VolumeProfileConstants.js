/**
 * Volume Profile Constants
 * Colors and settings for enhanced Volume Profile visualization
 */

// Profile types
export const PROFILE_TYPES = {
    SESSION: 'session',           // One profile per trading session
    FIXED_RANGE: 'fixed_range',   // User-defined price range
    COMPOSITE_LEFT: 'composite_left',   // Full range on left side
    COMPOSITE_RIGHT: 'composite_right', // Full range on right side
    VISIBLE_RANGE: 'visible_range',     // Current visible chart range
};

// Profile type display names
export const PROFILE_TYPE_NAMES = {
    [PROFILE_TYPES.SESSION]: 'Session Profile',
    [PROFILE_TYPES.FIXED_RANGE]: 'Fixed Range',
    [PROFILE_TYPES.COMPOSITE_LEFT]: 'Composite (Left)',
    [PROFILE_TYPES.COMPOSITE_RIGHT]: 'Composite (Right)',
    [PROFILE_TYPES.VISIBLE_RANGE]: 'Visible Range',
};

// Display modes
export const DISPLAY_MODES = {
    TOTAL_VOLUME: 'total',        // Single color bars
    BID_ASK: 'bid_ask',           // Stacked buy/sell bars
    DELTA: 'delta',               // Delta-colored bars
};

export const COLORS = {
    // Volume bars
    VOLUME_BAR: '#5C6BC0',            // Indigo for total volume
    VOLUME_BAR_LIGHT: 'rgba(92, 107, 192, 0.6)',
    BUY_VOLUME: '#26A69A',            // Green-teal for buy
    SELL_VOLUME: '#EF5350',           // Red for sell

    // POC (Point of Control)
    POC: '#FF9800',                   // Orange
    POC_LINE: '#FF9800',
    POC_FILL: 'rgba(255, 152, 0, 0.2)',

    // Value Area
    VAH: '#9C27B0',                   // Purple
    VAL: '#9C27B0',
    VALUE_AREA_FILL: 'rgba(156, 39, 176, 0.1)',
    VALUE_AREA_BORDER: 'rgba(156, 39, 176, 0.3)',

    // High/Low Volume Nodes
    HVN: '#7B1FA2',                   // Dark purple
    HVN_FILL: 'rgba(123, 31, 162, 0.3)',
    LVN: '#E1BEE7',                   // Light purple
    LVN_FILL: 'rgba(225, 190, 231, 0.2)',

    // Text
    TEXT_PRIMARY: '#D1D4DC',
    TEXT_SECONDARY: '#787B86',
    TEXT_LABEL: '#FFFFFF',

    // Background
    PROFILE_BACKGROUND: 'rgba(42, 46, 57, 0.3)',
    PROFILE_BORDER: 'rgba(255, 255, 255, 0.1)',
};

export const DEFAULT_SETTINGS = {
    // Profile type
    profileType: PROFILE_TYPES.SESSION,
    displayMode: DISPLAY_MODES.TOTAL_VOLUME,

    // Position and sizing
    position: 'left',                 // 'left', 'right', 'overlay'
    width: 150,                       // Profile width in pixels
    opacity: 0.8,
    rowHeight: 'auto',                // 'auto' or number

    // Components to show
    showPOC: true,
    showValueArea: true,
    showVAH: true,
    showVAL: true,
    showHVN: false,
    showLVN: false,
    extendPOC: true,                  // Extend POC line across chart

    // Value area settings
    valueAreaPercent: 70,

    // Labels
    showVolumeLabels: true,
    showPriceLabels: true,
    fontSize: 9,

    // Colors (can be overridden)
    volumeColor: COLORS.VOLUME_BAR,
    pocColor: COLORS.POC,
    vahColor: COLORS.VAH,
    valColor: COLORS.VAL,
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
 * Get volume bar color based on delta
 * @param {number} buyVolume
 * @param {number} sellVolume
 * @param {string} mode
 * @returns {string}
 */
export const getVolumeBarColor = (buyVolume, sellVolume, mode = DISPLAY_MODES.TOTAL_VOLUME) => {
    if (mode === DISPLAY_MODES.TOTAL_VOLUME) {
        return COLORS.VOLUME_BAR;
    }

    const delta = buyVolume - sellVolume;
    const total = buyVolume + sellVolume;
    const deltaPercent = total > 0 ? (delta / total) * 100 : 0;

    if (deltaPercent > 20) return COLORS.BUY_VOLUME;
    if (deltaPercent < -20) return COLORS.SELL_VOLUME;
    return COLORS.VOLUME_BAR;
};

export default {
    PROFILE_TYPES,
    PROFILE_TYPE_NAMES,
    DISPLAY_MODES,
    COLORS,
    DEFAULT_SETTINGS,
    formatVolume,
    getVolumeBarColor,
};
