/**
 * Chart Helper Utilities
 * Pure utility functions for chart operations
 */

/**
 * Drawing tool name mapping from UI tool names to LineToolManager tool names
 */
export const TOOL_MAP = {
  'cursor': 'None',
  'eraser': 'Eraser',
  'trendline': 'TrendLine',
  'arrow': 'Arrow',
  'ray': 'Ray',
  'extended_line': 'ExtendedLine',
  'horizontal': 'HorizontalLine',
  'horizontal_ray': 'HorizontalRay',
  'vertical': 'VerticalLine',
  'cross_line': 'CrossLine',
  'parallel_channel': 'ParallelChannel',
  'fibonacci': 'FibRetracement',
  'fib_extension': 'FibExtension',
  'pitchfork': 'Pitchfork',
  'brush': 'Brush',
  'highlighter': 'Highlighter',
  'rectangle': 'Rectangle',
  'circle': 'Circle',
  'arc': 'Arc',
  'path': 'Path',
  'text': 'Text',
  'callout': 'Callout',
  'price_label': 'PriceLabel',
  'pattern': 'Pattern',
  'triangle': 'Triangle',
  'abcd': 'ABCD',
  'xabcd': 'XABCD',
  'elliott_impulse': 'ElliottImpulseWave',
  'elliott_correction': 'ElliottCorrectionWave',
  'head_and_shoulders': 'HeadAndShoulders',
  'prediction': 'LongPosition',
  'prediction_short': 'ShortPosition',
  'date_range': 'DateRange',
  'price_range': 'PriceRange',
  'date_price_range': 'DatePriceRange',
  'measure': 'Measure',
  'zoom_in': 'None',
  'zoom_out': 'None',
  'remove': 'None'
};

/**
 * Convert hex color to rgba
 * @param {string} hex - Hex color string (e.g., '#FF0000')
 * @param {number} alpha - Alpha value (0-1)
 * @returns {string} RGBA color string
 */
export const hexToRgba = (hex, alpha) => {
  if (!hex || hex.length < 7) return `rgba(0, 0, 0, ${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Normalize symbols for comparison (handles exchange suffixes)
 * @param {string} s1 - First symbol
 * @param {string} s2 - Second symbol
 * @returns {boolean} True if symbols are equivalent
 */
export const areSymbolsEquivalent = (s1, s2) => {
  if (!s1 || !s2) return false;
  const normalize = (s) => s.split(':')[0].trim().toUpperCase();
  return normalize(s1) === normalize(s2);
};

/**
 * Convert interval string to seconds
 * @param {string} interval - Interval string (e.g., '5m', '1h', '1d')
 * @returns {number} Interval in seconds
 */
export const intervalToSeconds = (interval) => {
  if (!interval) return 300; // Default 5 minutes

  const value = parseInt(interval);
  const unit = interval.slice(-1).toLowerCase();

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    case 'w': return value * 604800;
    default: return value * 60; // Default to minutes
  }
};

/**
 * Format price based on instrument type
 * @param {number} price - Price value
 * @param {string} symbol - Symbol name
 * @returns {string} Formatted price string
 */
export const formatPrice = (price, symbol = '') => {
  if (price === null || price === undefined) return '-';

  // Crypto typically needs more decimals
  const isCrypto = symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('USDT');
  const decimals = isCrypto ? 8 : 2;

  return price.toFixed(decimals);
};

/**
 * Get chart theme colors based on theme name
 * @param {string} theme - Theme name ('light' or 'dark')
 * @returns {Object} Theme colors object
 */
export const getThemeColors = (theme) => {
  const isDark = theme === 'dark';

  return {
    background: isDark ? '#131722' : '#ffffff',
    text: isDark ? '#d1d4dc' : '#131722',
    grid: isDark ? '#1e222d' : '#f0f3fa',
    border: isDark ? '#2a2e39' : '#e0e3eb',
    crosshair: isDark ? '#758696' : '#9598a1',
  };
};

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export const clamp = (value, min, max) => {
  return Math.max(min, Math.min(max, value));
};

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Format time difference in human-readable format
 * @param {number} ms - Time difference in milliseconds
 * @returns {string} Formatted time string (e.g., "2d 5h", "3h 45m", "10m", "30s")
 */
export const formatTimeDiff = (ms) => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
};

/**
 * Add future whitespace points for time axis display
 * Whitespace points are data objects with only 'time' property (no price data)
 * This allows lightweight-charts to render future time labels on the axis
 * @param {Array} data - OHLC candle data
 * @param {number} intervalSeconds - Interval in seconds
 * @param {number} futureCandles - Number of future candles to add (default 120)
 * @returns {Array} Data with whitespace points appended
 */
export const addFutureWhitespacePoints = (data, intervalSeconds, futureCandles = 120) => {
  if (!data || data.length === 0 || !Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
    return data;
  }

  const lastCandle = data[data.length - 1];
  const lastTime = lastCandle.time;
  const whitespacePoints = [];

  for (let i = 1; i <= futureCandles; i++) {
    whitespacePoints.push({
      time: lastTime + (i * intervalSeconds)
    });
  }

  return [...data, ...whitespacePoints];
};
