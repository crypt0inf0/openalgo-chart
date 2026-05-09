/**
 * Chart Helper Utilities
 * Pure utility functions for chart operations
 */

export interface ThemeColors {
  background: string;
  text: string;
  grid: string;
  border: string;
  crosshair: string;
}

export interface OHLCCandle {
  time: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

/**
 * Drawing tool name mapping from UI tool names to LineToolManager tool names
 */
export const TOOL_MAP: Record<string, string> = {
  'cursor': 'None',
  'eraser': 'Eraser',
  'trendline': 'TrendLine',
  'ray': 'Ray',
  'horizontal': 'HorizontalLine',
  'vertical': 'VerticalLine',
  'parallel_channel': 'ParallelChannel',
  'fibonacci': 'FibRetracement',
  'brush': 'Brush',
  'rectangle': 'Rectangle',
  'text': 'Text',
  'callout': 'Callout',
  'prediction': 'LongPosition',
  'prediction_short': 'ShortPosition',
  'price_range': 'PriceRange',
  'date_price_range': 'DatePriceRange',
  'measure': 'Measure',
  'zoom_in': 'None',
  'zoom_out': 'None',
  'remove': 'None'
};

/**
 * Convert hex color to rgba
 */
export const hexToRgba = (hex: string, alpha: number): string => {
  if (!hex || hex.length < 7) return `rgba(0, 0, 0, ${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Normalize symbols for comparison (handles exchange suffixes)
 */
export const areSymbolsEquivalent = (s1: string, s2: string): boolean => {
  // Validate inputs are non-empty strings
  if (!s1 || !s2 || typeof s1 !== 'string' || typeof s2 !== 'string') return false;
  const normalize = (s: string): string => {
    const parts = s.split(':');
    return parts.length > 0 ? parts[0].trim().toUpperCase() : '';
  };
  return normalize(s1) === normalize(s2);
};

/**
 * Convert interval string to seconds
 */
export const intervalToSeconds = (interval: string): number => {
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
 */
export const formatPrice = (price: number | null | undefined, symbol: string = ''): string => {
  if (price === null || price === undefined) return '-';

  // Crypto typically needs more decimals
  const isCrypto = symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('USDT');
  const decimals = isCrypto ? 8 : 2;

  return price.toFixed(decimals);
};

/**
 * Get chart theme colors based on theme name
 */
export const getThemeColors = (theme: string): ThemeColors => {
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
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

/**
 * Debounce function execution
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return function executedFunction(...args: Parameters<T>) {
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
 */
export const formatTimeDiff = (ms: number): string => {
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
 */
export const addFutureWhitespacePoints = <T extends { time: number }>(
  data: T[],
  intervalSeconds: number,
  futureCandles: number = 120
): Array<T | { time: number }> => {
  if (!data || data.length === 0 || !Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
    return data;
  }

  const lastCandle = data[data.length - 1];
  const lastTime = lastCandle.time;
  const whitespacePoints: Array<{ time: number }> = [];

  for (let i = 1; i <= futureCandles; i++) {
    whitespacePoints.push({
      time: lastTime + (i * intervalSeconds)
    });
  }

  return [...data, ...whitespacePoints];
};
