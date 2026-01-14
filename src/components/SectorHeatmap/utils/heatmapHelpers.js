/**
 * Heatmap Helper Functions
 * Utilities for color calculation, formatting, and layout
 */

/**
 * Get color based on percentage change - TradingView style
 * @param {number} change - Percentage change
 * @param {boolean} isBackground - Whether for background color
 * @returns {string} Color hex code
 */
export const getChangeColor = (change, isBackground = false) => {
    const absChange = Math.abs(change);

    if (change >= 0) {
        // Green gradient
        if (absChange > 4) return '#00C853';
        if (absChange > 3) return '#00B248';
        if (absChange > 2) return '#00A63E';
        if (absChange > 1.5) return '#009A38';
        if (absChange > 1) return '#089981';
        if (absChange > 0.5) return '#0D9668';
        if (absChange > 0.2) return '#26A69A';
        return '#3D8B80'; // Near zero positive
    } else {
        // Red gradient
        if (absChange > 4) return '#FF1744';
        if (absChange > 3) return '#F5153D';
        if (absChange > 2) return '#E91235';
        if (absChange > 1.5) return '#D8102F';
        if (absChange > 1) return '#C62828';
        if (absChange > 0.5) return '#B71C1C';
        if (absChange > 0.2) return '#A52727';
        return '#8B3030'; // Near zero negative
    }
};

/**
 * Get text color for heatmap tiles
 * @returns {string} Color code (always white for contrast)
 */
export const getTextColor = () => '#FFFFFF';

/**
 * Get bar width percentage
 * @param {number} change - Percentage change
 * @param {number} maxChange - Maximum change for scaling
 * @returns {number} Width percentage
 */
export const getBarWidth = (change, maxChange) => {
    return Math.min((Math.abs(change) / Math.max(maxChange, 1)) * 100, 100);
};

/**
 * Format volume in Indian notation
 * @param {number} vol - Volume value
 * @returns {string} Formatted string
 */
export const formatVolume = (vol) => {
    if (vol >= 10000000) return `${(vol / 10000000).toFixed(1)}Cr`;
    if (vol >= 100000) return `${(vol / 100000).toFixed(1)}L`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
    return vol.toString();
};

/**
 * Format price with appropriate decimal places
 * @param {number} price - Price value
 * @returns {string} Formatted price
 */
export const formatPrice = (price) => {
    if (price >= 1000) return price.toFixed(0);
    if (price >= 100) return price.toFixed(1);
    return price.toFixed(2);
};

/**
 * Calculate intraday change from open price
 * @param {Object} item - Stock item with last and open prices
 * @returns {number} Percentage change
 */
export const calculateIntradayChange = (item) => {
    const ltp = parseFloat(item.last) || 0;
    const openPrice = parseFloat(item.open) || 0;
    if (openPrice > 0 && ltp > 0) {
        return ((ltp - openPrice) / openPrice) * 100;
    }
    return parseFloat(item.chgP) || 0;
};

export default {
    getChangeColor,
    getTextColor,
    getBarWidth,
    formatVolume,
    formatPrice,
    calculateIntradayChange,
};
