/**
 * Symbol Search Constants
 * Filter tabs and default symbols
 */

// Filter tabs with their corresponding API parameters
export const FILTER_TABS = [
    { label: 'All', exchange: null, instrumenttype: null },
    { label: 'Stocks', exchange: 'NSE', instrumenttype: 'EQ' },
    { label: 'Futures', exchange: 'NFO', instrumenttype: 'FUT' },
    { label: 'Options', exchange: 'NFO', instrumenttype: null },
    { label: 'Indices', exchange: 'NSE_INDEX', instrumenttype: null },
];

// Default popular symbols shown on initial load
export const DEFAULT_POPULAR_SYMBOLS = [
    { symbol: 'NIFTY', exchange: 'NSE_INDEX', instrumenttype: 'INDEX', name: 'Nifty 50 Index' },
    { symbol: 'BANKNIFTY', exchange: 'NSE_INDEX', instrumenttype: 'INDEX', name: 'Nifty Bank Index' },
    { symbol: 'CNXSMALLCAP', exchange: 'NSE_INDEX', instrumenttype: 'INDEX', name: 'Nifty SmallCap 100 Index' },
    { symbol: 'NIFTY_MID_SELECT', exchange: 'NSE_INDEX', instrumenttype: 'INDEX', name: 'Nifty MidCap Select Index' },
    { symbol: 'CNXIT', exchange: 'NSE_INDEX', instrumenttype: 'INDEX', name: 'Nifty IT Index' },
    { symbol: 'CNXFINANCE', exchange: 'NSE_INDEX', instrumenttype: 'INDEX', name: 'Nifty Financial Services Index' },
    { symbol: 'RELIANCE', exchange: 'NSE', instrumenttype: 'EQ', name: 'Reliance Industries Ltd' },
    { symbol: 'TCS', exchange: 'NSE', instrumenttype: 'EQ', name: 'Tata Consultancy Services' },
    { symbol: 'INFY', exchange: 'NSE', instrumenttype: 'EQ', name: 'Infosys Ltd' },
    { symbol: 'HDFCBANK', exchange: 'NSE', instrumenttype: 'EQ', name: 'HDFC Bank Ltd' },
];

// Search debounce delay in milliseconds
export const SEARCH_DEBOUNCE_MS = 300;

// Minimum characters before search triggers
export const MIN_SEARCH_LENGTH = 2;

// Maximum results to display
export const MAX_RESULTS = 50;

export default {
    FILTER_TABS,
    DEFAULT_POPULAR_SYMBOLS,
    SEARCH_DEBOUNCE_MS,
    MIN_SEARCH_LENGTH,
    MAX_RESULTS,
};
