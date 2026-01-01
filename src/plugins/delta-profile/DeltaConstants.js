/**
 * Delta Profile Constants
 * Colors and settings for Delta and Cumulative Delta visualization
 */

export const COLORS = {
    // Delta bar colors
    DELTA_POSITIVE: '#26A69A',         // Green for positive delta
    DELTA_NEGATIVE: '#EF5350',         // Red for negative delta
    DELTA_NEUTRAL: '#9E9E9E',          // Gray for near-zero delta

    // Cumulative delta line
    CD_LINE_UP: '#4CAF50',             // Green when CD is rising
    CD_LINE_DOWN: '#F44336',           // Red when CD is falling
    CD_LINE_NEUTRAL: '#2196F3',        // Blue for neutral

    // Divergence markers
    BULLISH_DIVERGENCE: '#00E676',     // Bright green for bullish divergence
    BEARISH_DIVERGENCE: '#FF5252',     // Bright red for bearish divergence

    // Zero line
    ZERO_LINE: '#787B86',

    // Text
    TEXT_PRIMARY: '#D1D4DC',
    TEXT_SECONDARY: '#787B86',

    // Background
    HISTOGRAM_BACKGROUND: 'rgba(42, 46, 57, 0.5)',
};

export const DEFAULT_DELTA_SETTINGS = {
    // Display options
    showDeltaBars: true,
    showCumulativeDelta: true,
    showDivergences: true,
    showZeroLine: true,
    showLabels: true,

    // Styling
    barWidth: 0.8,                     // Proportion of available space
    cdLineWidth: 2,
    fontSize: 10,
    opacity: 0.9,

    // Colors (can be overridden)
    positiveColor: COLORS.DELTA_POSITIVE,
    negativeColor: COLORS.DELTA_NEGATIVE,
    cdLineColor: COLORS.CD_LINE_UP,

    // Thresholds
    divergenceThreshold: 0.5,          // Minimum % move for divergence detection
    neutralThreshold: 0.1,             // Delta within this % is considered neutral

    // Pane settings
    paneHeight: 100,                   // Height of delta pane in pixels
    separatePaneForCD: false,          // Show CD in separate pane or overlay
};

/**
 * Get delta bar color based on value
 * @param {number} delta
 * @param {number} neutralThreshold - Threshold for neutral coloring
 * @returns {string}
 */
export const getDeltaBarColor = (delta, neutralThreshold = 0.1) => {
    if (Math.abs(delta) < neutralThreshold) return COLORS.DELTA_NEUTRAL;
    return delta > 0 ? COLORS.DELTA_POSITIVE : COLORS.DELTA_NEGATIVE;
};

/**
 * Get cumulative delta line color based on trend
 * @param {number} currentCD
 * @param {number} previousCD
 * @returns {string}
 */
export const getCDLineColor = (currentCD, previousCD) => {
    if (currentCD > previousCD) return COLORS.CD_LINE_UP;
    if (currentCD < previousCD) return COLORS.CD_LINE_DOWN;
    return COLORS.CD_LINE_NEUTRAL;
};

/**
 * Format delta value for display
 * @param {number} delta
 * @returns {string}
 */
export const formatDeltaValue = (delta) => {
    const prefix = delta > 0 ? '+' : '';
    if (Math.abs(delta) >= 10000000) return `${prefix}${(delta / 10000000).toFixed(1)}Cr`;
    if (Math.abs(delta) >= 100000) return `${prefix}${(delta / 100000).toFixed(1)}L`;
    if (Math.abs(delta) >= 1000) return `${prefix}${(delta / 1000).toFixed(1)}K`;
    return `${prefix}${Math.round(delta)}`;
};

export default {
    COLORS,
    DEFAULT_DELTA_SETTINGS,
    getDeltaBarColor,
    getCDLineColor,
    formatDeltaValue,
};
