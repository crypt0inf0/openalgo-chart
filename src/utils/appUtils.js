/**
 * App Utilities
 * Utility functions and constants extracted from App.jsx
 */

// ============== Interval Utilities ==============

export const VALID_INTERVAL_UNITS = new Set(['s', 'm', 'h', 'd', 'w', 'M']);
export const DEFAULT_FAVORITE_INTERVALS = []; // No default favorites

/**
 * Validates if a value is a valid interval string
 * @param {string} value - The interval value to validate
 * @returns {boolean} Whether the value is valid
 */
export const isValidIntervalValue = (value) => {
    if (!value || typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (/^\d+$/.test(trimmed)) {
        return parseInt(trimmed, 10) > 0;
    }
    const match = /^([1-9]\d*)([smhdwM])$/.exec(trimmed);
    if (!match) return false;
    const unit = match[2];
    return VALID_INTERVAL_UNITS.has(unit);
};

/**
 * Sanitizes favorite intervals array
 * @param {Array} raw - Raw interval array
 * @returns {Array} Sanitized unique intervals
 */
export const sanitizeFavoriteIntervals = (raw) => {
    if (!Array.isArray(raw)) return DEFAULT_FAVORITE_INTERVALS;
    const filtered = raw.filter(isValidIntervalValue);
    const unique = Array.from(new Set(filtered));
    return unique;
};

/**
 * Sanitizes custom intervals array
 * @param {Array} raw - Raw custom intervals array
 * @returns {Array} Sanitized custom intervals with label
 */
export const sanitizeCustomIntervals = (raw) => {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((item) => item && typeof item === 'object' && isValidIntervalValue(item.value))
        .map((item) => ({
            value: item.value,
            label: item.label || item.value,
            isCustom: true,
        }));
};

// ============== JSON/Storage Utilities ==============

// Import and re-export from centralized storage service
import { safeParseJSON as _safeParseJSON } from '../services/storageService';
export const safeParseJSON = _safeParseJSON;

// ============== Alert Constants ==============

export const ALERT_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

// ============== Watchlist Utilities ==============

export const DEFAULT_WATCHLIST = {
    id: 'wl_default',
    name: 'My Watchlist',
    symbols: [
        { symbol: 'RELIANCE', exchange: 'NSE' },
        { symbol: 'TCS', exchange: 'NSE' },
        { symbol: 'INFY', exchange: 'NSE' },
        { symbol: 'HDFCBANK', exchange: 'NSE' },
        { symbol: 'ICICIBANK', exchange: 'NSE' },
        { symbol: 'SBIN', exchange: 'NSE' },
        { symbol: 'BHARTIARTL', exchange: 'NSE' },
        { symbol: 'ITC', exchange: 'NSE' },
    ],
};

/**
 * Migrates watchlist data from old format to new format
 * @returns {Object} Migrated watchlist data
 */
export const migrateWatchlistData = () => {
    const newData = safeParseJSON(localStorage.getItem('tv_watchlists'), null);

    // If new format exists, validate and use it
    if (newData && newData.lists && Array.isArray(newData.lists)) {
        // Filter out any old Favorites watchlist
        newData.lists = newData.lists.filter(wl => wl.id !== 'wl_favorites');
        // Ensure at least one watchlist exists
        if (newData.lists.length === 0) {
            newData.lists.push(DEFAULT_WATCHLIST);
            newData.activeListId = 'wl_default';
        }
        // Update activeListId if it was pointing to favorites
        if (newData.activeListId === 'wl_favorites') {
            newData.activeListId = newData.lists[0].id;
        }
        return newData;
    }

    // Check for old format
    const oldData = safeParseJSON(localStorage.getItem('tv_watchlist'), null);

    if (oldData && Array.isArray(oldData) && oldData.length > 0) {
        // Migrate old format to new format
        return {
            lists: [
                {
                    ...DEFAULT_WATCHLIST,
                    symbols: oldData.map(s => typeof s === 'string' ? { symbol: s, exchange: 'NSE' } : s),
                }
            ],
            activeListId: 'wl_default',
        };
    }

    // Return default
    return {
        lists: [DEFAULT_WATCHLIST],
        activeListId: 'wl_default',
    };
};

// ============== Chart Appearance Defaults ==============

export const DEFAULT_CHART_APPEARANCE = {
    // Candle Colors
    candleUpColor: '#089981',
    candleDownColor: '#F23645',
    wickUpColor: '#089981',
    wickDownColor: '#F23645',
    // Grid Settings
    showVerticalGridLines: true,
    showHorizontalGridLines: true,
    // Background Colors (per theme)
    darkBackground: '#131722',
    lightBackground: '#ffffff',
    // Grid Colors (per theme)
    darkGridColor: '#2A2E39',
    lightGridColor: '#e0e3eb',
};

// ============== Drawing Tool Defaults ==============

// Line styles: 0=Solid, 1=Dotted, 2=Dashed, 3=LargeDashed, 4=SparseDotted
export const DEFAULT_DRAWING_OPTIONS = {
    lineColor: '#2962FF',
    backgroundColor: 'rgba(41, 98, 255, 0.2)',
    width: 2,
    lineStyle: 0,
    globalAlpha: 1.0,
};

// Drawing tools that should show the properties panel
export const DRAWING_TOOLS = [
    'TrendLine',
    'HorizontalLine',
    'VerticalLine',
    'Rectangle',
    'Circle',
    'Path',
    'Text',
    'Callout',
    'PriceRange',
    'Arrow',
    'Ray',
    'ExtendedLine',
    'ParallelChannel',
    'FibonacciRetracement',
];

// ============== Price Formatting ==============

/**
 * Formats a price value to 2 decimal places
 * @param {number|string} value - Value to format
 * @returns {string} Formatted price string
 */
export const formatPrice = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return value;
    return num.toFixed(2);
};
