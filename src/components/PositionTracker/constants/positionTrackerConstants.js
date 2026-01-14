/**
 * Position Tracker Constants
 * Market timing, columns, and filter options
 */

// Market timing constants (IST)
export const MARKET_OPEN = { hour: 9, minute: 15 };
export const MARKET_CLOSE = { hour: 15, minute: 30 };

// Top N options for gainers/losers filter
export const TOP_N_OPTIONS = [5, 10, 15, 20];

// Default column widths
export const DEFAULT_COLUMN_WIDTHS = {
    rank: 32,
    move: 40,
    symbol: 80,
    ltp: 70,
    change: 60,
    volume: 55,
};

export const MIN_COLUMN_WIDTH = 35;

// Filter mode options
export const FILTER_MODES = {
    ALL: 'all',
    GAINERS: 'gainers',
    LOSERS: 'losers',
};

export default {
    MARKET_OPEN,
    MARKET_CLOSE,
    TOP_N_OPTIONS,
    DEFAULT_COLUMN_WIDTHS,
    MIN_COLUMN_WIDTH,
    FILTER_MODES,
};
