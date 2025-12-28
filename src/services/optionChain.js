/**
 * Option Chain Service
 * Handles option chain fetching using OpenAlgo Option Chain API
 */

import { getOptionChain as fetchOptionChainAPI, getOptionGreeks, getKlines, searchSymbols } from './openalgo';

// ==================== OPTION CHAIN CACHE ====================
// Cache to reduce API calls and avoid Upstox rate limits (30 req/min)
const optionChainCache = new Map();
const CACHE_TTL_MS = 300000; // 5 minutes cache (increased from 60s to avoid rate limits)
const STORAGE_KEY = 'optionChainCache';

// Negative cache for symbols that don't support F&O (prevents repeated failed API calls)
const noFOSymbolsCache = new Set();
const NO_FO_STORAGE_KEY = 'noFOSymbolsCache';
const NO_FO_CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Rate limit protection: Track last API call time to prevent rapid repeated calls
let lastApiCallTime = 0;
const MIN_API_INTERVAL_MS = 5000; // Minimum 5 seconds between API calls

// Generate cache key from underlying and expiry
const getCacheKey = (underlying, expiry) => `${underlying}_${expiry || 'default'}`;

// Load negative cache from localStorage
const loadNoFOCacheFromStorage = () => {
    try {
        const stored = localStorage.getItem(NO_FO_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Only load entries that haven't expired
            const now = Date.now();
            Object.entries(parsed).forEach(([symbol, timestamp]) => {
                if (now - timestamp < NO_FO_CACHE_DURATION_MS) {
                    noFOSymbolsCache.add(symbol);
                }
            });
            console.log('[OptionChain] Loaded', noFOSymbolsCache.size, 'non-F&O symbols from cache');
        }
    } catch (e) {
        console.warn('[OptionChain] Failed to load no-F&O cache:', e.message);
    }
};

// Save negative cache to localStorage with timestamps
const saveNoFOCacheToStorage = () => {
    try {
        const now = Date.now();
        const obj = {};
        noFOSymbolsCache.forEach(symbol => {
            obj[symbol] = now;
        });
        localStorage.setItem(NO_FO_STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
        console.warn('[OptionChain] Failed to save no-F&O cache:', e.message);
    }
};

// Check if symbol is known to not support F&O
const isNonFOSymbol = (symbol) => noFOSymbolsCache.has(symbol?.toUpperCase());

// Mark a symbol as not supporting F&O
const markAsNonFOSymbol = (symbol) => {
    const upperSymbol = symbol?.toUpperCase();
    if (upperSymbol) {
        noFOSymbolsCache.add(upperSymbol);
        saveNoFOCacheToStorage();
        console.log('[OptionChain] Marked as non-F&O symbol:', upperSymbol);
    }
};

// Load negative cache on module init
loadNoFOCacheFromStorage();

// Check if cache entry is still valid
const isCacheValid = (cacheEntry) => {
    if (!cacheEntry) return false;
    return Date.now() - cacheEntry.timestamp < CACHE_TTL_MS;
};

// Load cache from localStorage on init (survives page refresh)
const loadCacheFromStorage = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            Object.entries(parsed).forEach(([key, value]) => {
                optionChainCache.set(key, value);
            });
            console.log('[OptionChain] Loaded', optionChainCache.size, 'cache entries from storage');
        }
    } catch (e) {
        console.warn('[OptionChain] Failed to load cache from storage:', e.message);
    }
};

// Save cache to localStorage
const saveCacheToStorage = () => {
    try {
        const obj = Object.fromEntries(optionChainCache);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
        console.warn('[OptionChain] Failed to save cache to storage:', e.message);
    }
};

// Load cache from storage on module init
loadCacheFromStorage();

/**
 * Clear option chain cache
 * @param {string} underlying - Optional: clear only for this underlying
 * @param {string} expiry - Optional: clear only for this expiry
 */
export const clearOptionChainCache = (underlying = null, expiry = null) => {
    if (underlying && expiry) {
        const key = getCacheKey(underlying, expiry);
        optionChainCache.delete(key);
        console.log('[OptionChain] Cache cleared for:', key);
    } else if (underlying) {
        // Clear all entries for this underlying
        for (const key of optionChainCache.keys()) {
            if (key.startsWith(underlying + '_')) {
                optionChainCache.delete(key);
            }
        }
        console.log('[OptionChain] Cache cleared for underlying:', underlying);
    } else {
        optionChainCache.clear();
        console.log('[OptionChain] Full cache cleared');
    }
    // Also update localStorage
    saveCacheToStorage();
};

// Common F&O underlyings with their index exchanges
export const UNDERLYINGS = [
    { symbol: 'NIFTY', name: 'NIFTY 50', exchange: 'NFO', indexExchange: 'NSE_INDEX' },
    { symbol: 'BANKNIFTY', name: 'BANK NIFTY', exchange: 'NFO', indexExchange: 'NSE_INDEX' },
    { symbol: 'FINNIFTY', name: 'FIN NIFTY', exchange: 'NFO', indexExchange: 'NSE_INDEX' },
    { symbol: 'MIDCPNIFTY', name: 'MIDCAP NIFTY', exchange: 'NFO', indexExchange: 'NSE_INDEX' },
    { symbol: 'SENSEX', name: 'SENSEX', exchange: 'BFO', indexExchange: 'BSE_INDEX' },
    { symbol: 'BANKEX', name: 'BANKEX', exchange: 'BFO', indexExchange: 'BSE_INDEX' }
];

// Month codes for option symbols (NSE format)
const MONTH_CODES = {
    1: 'JAN', 2: 'FEB', 3: 'MAR', 4: 'APR', 5: 'MAY', 6: 'JUN',
    7: 'JUL', 8: 'AUG', 9: 'SEP', 10: 'OCT', 11: 'NOV', 12: 'DEC'
};

// Reverse month codes
const MONTH_TO_NUM = Object.fromEntries(
    Object.entries(MONTH_CODES).map(([k, v]) => [v, parseInt(k)])
);

/**
 * Parse expiry date string in DDMMMYY format to Date object
 * @param {string} expiryStr - Expiry string like "30DEC25"
 * @returns {Date|null} Date object or null if invalid
 */
export const parseExpiryDate = (expiryStr) => {
    if (!expiryStr || expiryStr.length < 7) return null;

    const match = expiryStr.match(/^(\d{2})([A-Z]{3})(\d{2})$/);
    if (!match) return null;

    const [, dayStr, monthStr, yearStr] = match;
    const day = parseInt(dayStr, 10);
    const month = MONTH_TO_NUM[monthStr];
    const year = 2000 + parseInt(yearStr, 10);

    if (!month || isNaN(day) || isNaN(year)) return null;

    return new Date(year, month - 1, day);
};

/**
 * Format Date to DDMMMYY format for API
 * @param {Date} date - Date object
 * @returns {string} Formatted string like "30DEC25"
 */
export const formatExpiryDate = (date) => {
    if (!date) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = MONTH_CODES[date.getMonth() + 1];
    const year = String(date.getFullYear()).slice(-2);
    return `${day}${month}${year}`;
};

/**
 * Calculate days to expiry from expiry date string
 * @param {string} expiryStr - Expiry string like "30DEC25"
 * @returns {number} Days to expiry
 */
export const getDaysToExpiry = (expiryStr) => {
    const expiryDate = parseExpiryDate(expiryStr);
    if (!expiryDate) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);

    const diffTime = expiryDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
};

/**
 * Get expiry label type (CW, NW, CM, etc.)
 * @param {string} expiryStr - Expiry string
 * @param {number} index - Index in expiry list
 * @returns {string} Label like "CW", "NW", "CM", "NM"
 */
export const getExpiryLabel = (expiryStr, index) => {
    const dte = getDaysToExpiry(expiryStr);
    if (index === 0) return 'CW'; // Current Week
    if (index === 1) return 'NW'; // Next Week
    if (dte <= 7) return 'W' + (index + 1);
    if (dte <= 35) return 'CM'; // Current Month
    return 'NM'; // Next Month
};

/**
 * Format expiry for TradingView-style tab display
 * @param {string} expiryStr - Expiry string like "18DEC25"
 * @param {number} index - Index in expiry list
 * @returns {Object} { display: "18 DEC '25", dte: 0, label: "CW" }
 */
export const formatExpiryTab = (expiryStr, index) => {
    const date = parseExpiryDate(expiryStr);
    if (!date) return { display: expiryStr, dte: 0, label: '' };

    const day = date.getDate();
    const month = date.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase();
    const year = date.getFullYear().toString().slice(-2);
    const dte = getDaysToExpiry(expiryStr);
    const label = getExpiryLabel(expiryStr, index);

    return { display: `${day} ${month} '${year}`, dte, label };
};

/**
 * Get option chain for an underlying using OpenAlgo Option Chain API
 * Uses caching to reduce API calls and avoid Upstox rate limits
 * @param {string} underlying - Underlying symbol (NIFTY, BANKNIFTY)
 * @param {string} exchange - Exchange (NFO, BFO) - will be converted to index exchange for API
 * @param {string} expiryDate - Optional expiry date in DDMMMYY format
 * @param {number} strikeCount - Number of strikes above/below ATM (default 15)
 * @param {boolean} forceRefresh - Skip cache and fetch fresh data
 * @returns {Promise<Object>} Option chain data with LTP, OI, etc.
 */
export const getOptionChain = async (underlying, exchange = 'NFO', expiryDate = null, strikeCount = 15, forceRefresh = false) => {
    // Check if symbol is known to not support F&O (negative cache)
    if (isNonFOSymbol(underlying)) {
        console.log('[OptionChain] Symbol known to not support F&O:', underlying);
        const error = new Error(`${underlying} does not support F&O trading`);
        error.code = 'NO_FO_SUPPORT';
        throw error;
    }

    const cacheKey = getCacheKey(underlying, expiryDate);
    const cached = optionChainCache.get(cacheKey);

    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && isCacheValid(cached)) {
        console.log('[OptionChain] Using cached data for:', cacheKey, '(age:', Math.round((Date.now() - cached.timestamp) / 1000), 's)');
        return cached.data;
    }

    // Rate limit protection: Don't call API too rapidly
    const timeSinceLastCall = Date.now() - lastApiCallTime;
    if (timeSinceLastCall < MIN_API_INTERVAL_MS) {
        const waitTime = MIN_API_INTERVAL_MS - timeSinceLastCall;
        console.log('[OptionChain] Rate limit protection: waiting', waitTime, 'ms before API call');

        // If we have stale cache, return it instead of waiting
        if (cached) {
            console.log('[OptionChain] Using stale cache to avoid rate limit');
            return cached.data;
        }

        // Wait before making the call
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    try {
        // Find the underlying config to get correct index exchange (for underlying price lookup)
        // For known indices (NIFTY, BANKNIFTY), use their indexExchange (NSE_INDEX/BSE_INDEX)
        // For stocks (not in UNDERLYINGS), use 'NSE' or 'BSE' directly
        const underlyingConfig = UNDERLYINGS.find(u => u.symbol === underlying);
        const indexExchange = underlyingConfig?.indexExchange || (exchange === 'BFO' ? 'BSE' : 'NSE');

        // The option chain API expects the F&O exchange (NFO/BFO), not the underlying exchange
        // The 'exchange' parameter passed to this function should already be NFO or BFO
        const optionExchange = exchange; // NFO or BFO

        console.log('[OptionChain] Fetching fresh chain:', { underlying, optionExchange, indexExchange, expiryDate, strikeCount });

        // Update last API call time
        lastApiCallTime = Date.now();

        // Call OpenAlgo Option Chain API with the F&O exchange (NFO/BFO)
        const result = await fetchOptionChainAPI(underlying, optionExchange, expiryDate, strikeCount);

        if (!result) {
            console.error('[OptionChain] API returned null');

            // Use stale cache if available (better than empty data)
            if (cached) {
                console.log('[OptionChain] API returned null, using stale cache for:', cacheKey);
                return cached.data;
            }

            // No cache available - throw error so component shows correct message
            throw new Error('Option chain API unavailable (rate limit)');
        }

        // Transform chain data to our format
        // API returns: { strike, ce: { symbol, label, ltp, bid, ask, oi, volume, ... }, pe: { ... } }
        const chain = (result.chain || []).map(row => ({
            strike: parseFloat(row.strike),
            ce: row.ce ? {
                symbol: row.ce.symbol,
                ltp: parseFloat(row.ce.ltp || 0),
                prevClose: parseFloat(row.ce.prev_close || 0),
                open: parseFloat(row.ce.open || 0),
                high: parseFloat(row.ce.high || 0),
                low: parseFloat(row.ce.low || 0),
                bid: parseFloat(row.ce.bid || 0),
                ask: parseFloat(row.ce.ask || 0),
                oi: parseInt(row.ce.oi || 0),
                volume: parseInt(row.ce.volume || 0),
                label: row.ce.label, // ITM, ATM, OTM
                lotSize: parseInt(row.ce.lotsize || row.ce.lot_size || 0)
            } : null,
            pe: row.pe ? {
                symbol: row.pe.symbol,
                ltp: parseFloat(row.pe.ltp || 0),
                prevClose: parseFloat(row.pe.prev_close || 0),
                open: parseFloat(row.pe.open || 0),
                high: parseFloat(row.pe.high || 0),
                low: parseFloat(row.pe.low || 0),
                bid: parseFloat(row.pe.bid || 0),
                ask: parseFloat(row.pe.ask || 0),
                oi: parseInt(row.pe.oi || 0),
                volume: parseInt(row.pe.volume || 0),
                label: row.pe.label, // ITM, ATM, OTM
                lotSize: parseInt(row.pe.lotsize || row.pe.lot_size || 0)
            } : null,
            straddlePremium: (parseFloat(row.ce?.ltp || 0) + parseFloat(row.pe?.ltp || 0)).toFixed(2)
        }))

        // Parse expiry date for display
        const expiryDateObj = parseExpiryDate(result.expiryDate);
        const dte = getDaysToExpiry(result.expiryDate);

        // Calculate underlying change and percentage
        const underlyingLTP = result.underlyingLTP || 0;
        const underlyingPrevClose = result.underlyingPrevClose || result.underlying_prev_close || 0;
        const change = underlyingPrevClose > 0 ? underlyingLTP - underlyingPrevClose : 0;
        const changePercent = underlyingPrevClose > 0 ? (change / underlyingPrevClose) * 100 : 0;

        const processedData = {
            underlying: result.underlying,
            exchange,
            underlyingLTP,
            underlyingPrevClose,
            change,
            changePercent,
            atmStrike: result.atmStrike,
            expiryDate: result.expiryDate,
            expiryDateObj,
            dte,
            expiries: [result.expiryDate], // API returns one expiry at a time
            chain,
            chainByExpiry: {
                [result.expiryDate]: chain
            }
        };

        // Store in cache only if we have valid data
        if (chain.length > 0) {
            optionChainCache.set(cacheKey, {
                data: processedData,
                timestamp: Date.now()
            });
            saveCacheToStorage(); // Persist to localStorage
            console.log('[OptionChain] Cached data for:', cacheKey);
        }

        return processedData;
    } catch (error) {
        console.error('[OptionChain] Error fetching option chain:', error);

        // If symbol doesn't support F&O, add to negative cache and re-throw
        if (error.code === 'NO_FO_SUPPORT') {
            markAsNonFOSymbol(underlying);
            throw error; // Re-throw so caller knows this is a non-F&O symbol
        }

        // On error, return stale cache if available (better than nothing)
        if (cached) {
            console.log('[OptionChain] API error, returning stale cache for:', cacheKey);
            return cached.data;
        }

        return {
            underlying,
            exchange,
            underlyingLTP: 0,
            atmStrike: 0,
            expiryDate: null,
            expiries: [],
            chain: [],
            chainByExpiry: {}
        };
    }
};

/**
 * Get available expiries for an underlying by searching symbols
 * (Fallback when Option Chain API doesn't provide expiry list)
 * @param {string} underlying - Underlying symbol
 * @returns {Promise<Array>} Array of expiry dates in DDMMMYY format
 */
export const getAvailableExpiries = async (underlying) => {
    try {
        const allOptions = await searchSymbols(underlying);

        // Parse symbols to extract unique expiries
        const expirySet = new Set();

        for (const opt of allOptions) {
            if (!opt.symbol?.endsWith('CE') && !opt.symbol?.endsWith('PE')) continue;

            // Parse symbol: UNDERLYING + DD + MMM + YY + STRIKE + TYPE
            const withoutType = opt.symbol.slice(0, -2);
            const match = withoutType.match(/^([A-Z]+)(\d{2})([A-Z]{3})(\d{2})(\d+)$/);

            if (match && match[1] === underlying) {
                const [, , dayStr, monthStr, yearStr] = match;
                const expiryStr = `${dayStr}${monthStr}${yearStr}`;
                expirySet.add(expiryStr);
            }
        }

        // Sort expiries chronologically
        const expiries = Array.from(expirySet).sort((a, b) => {
            const dateA = parseExpiryDate(a);
            const dateB = parseExpiryDate(b);
            return dateA - dateB;
        });

        console.log('[OptionChain] Available expiries for', underlying, ':', expiries);
        return expiries;
    } catch (error) {
        console.error('[OptionChain] Error getting expiries:', error);
        return [];
    }
};

/**
 * Get option greeks for a symbol
 * @param {string} symbol - Option symbol
 * @param {string} exchange - Exchange (NFO, BFO)
 * @returns {Promise<Object|null>} Greeks data or null
 */
export const fetchOptionGreeks = async (symbol, exchange = 'NFO') => {
    return await getOptionGreeks(symbol, exchange);
};

/**
 * Combine CE and PE OHLC data into straddle/strangle premium
 * @param {Array} ceData - CE candle data
 * @param {Array} peData - PE candle data
 * @returns {Array} Combined OHLC data
 */
export const combinePremiumOHLC = (ceData, peData) => {
    if (!ceData?.length || !peData?.length) return [];

    // Create a map of PE data by timestamp for O(1) lookup
    const peMap = new Map(peData.map(d => [d.time, d]));

    const combined = [];
    for (const ce of ceData) {
        const pe = peMap.get(ce.time);
        if (pe) {
            combined.push({
                time: ce.time,
                open: ce.open + pe.open,
                high: ce.high + pe.high,
                low: ce.low + pe.low,
                close: ce.close + pe.close,
                volume: (ce.volume || 0) + (pe.volume || 0)
            });
        }
    }

    return combined;
};

/**
 * Combine multiple leg OHLC data into strategy premium
 * Handles buy/sell direction for each leg
 * @param {Array<Array>} legDataArrays - Array of OHLC arrays for each leg
 * @param {Array<Object>} legConfigs - Leg configurations with direction and quantity
 * @returns {Array} Combined OHLC data
 */
export const combineMultiLegOHLC = (legDataArrays, legConfigs) => {
    if (!legDataArrays?.length || !legConfigs?.length) return [];
    if (legDataArrays.length !== legConfigs.length) {
        console.warn('[combineMultiLegOHLC] Mismatch between data arrays and configs');
        return [];
    }

    // Create time-indexed maps for each leg
    const legMaps = legDataArrays.map(data =>
        new Map((data || []).map(candle => [candle.time, candle]))
    );

    // Get all unique timestamps from all legs
    const allTimes = new Set();
    legDataArrays.forEach(data => {
        if (data) data.forEach(d => allTimes.add(d.time));
    });

    const combined = [];
    const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);

    for (const time of sortedTimes) {
        // Check if all legs have data for this time
        const hasAllLegs = legMaps.every(map => map.has(time));
        if (!hasAllLegs) continue;

        let open = 0, high = 0, low = 0, close = 0, volume = 0;

        legConfigs.forEach((leg, i) => {
            const candle = legMaps[i].get(time);
            const multiplier = leg.direction === 'buy' ? 1 : -1;
            const qty = leg.quantity || 1;

            open += multiplier * qty * candle.open;
            high += multiplier * qty * candle.high;
            low += multiplier * qty * candle.low;
            close += multiplier * qty * candle.close;
            volume += candle.volume || 0;
        });

        // Recalculate true high/low for strategies with sells
        // (the high of a net short position may be lower than open)
        const allPrices = [open, high, low, close];
        const trueHigh = Math.max(...allPrices);
        const trueLow = Math.min(...allPrices);

        combined.push({
            time,
            open,
            high: trueHigh,
            low: trueLow,
            close,
            volume
        });
    }

    return combined;
};

/**
 * Fetch combined straddle/strangle premium data
 * @param {string} ceSymbol - CE option symbol
 * @param {string} peSymbol - PE option symbol
 * @param {string} exchange - Exchange (NFO, BFO)
 * @param {string} interval - Time interval
 * @returns {Promise<Array>} Combined OHLC data
 */
export const fetchStraddlePremium = async (ceSymbol, peSymbol, exchange = 'NFO', interval = '5m') => {
    try {
        const [ceData, peData] = await Promise.all([
            getKlines(ceSymbol, exchange, interval),
            getKlines(peSymbol, exchange, interval)
        ]);

        return combinePremiumOHLC(ceData, peData);
    } catch (error) {
        console.error('Error fetching straddle premium:', error);
        return [];
    }
};

/**
 * Format straddle display name
 * @param {Object} config - Straddle config with ceSymbol, peSymbol, etc.
 * @returns {string} Display name
 */
export const formatStraddleName = (config) => {
    if (!config) return '';

    const { underlying, ceStrike, peStrike, expiry } = config;

    // Handle expiry as string (DDMMMYY) or Date
    let expiryStr;
    if (typeof expiry === 'string') {
        expiryStr = expiry;
    } else if (expiry instanceof Date) {
        expiryStr = formatExpiryDate(expiry);
    } else {
        expiryStr = '';
    }

    // Parse for display
    const day = expiryStr.slice(0, 2);
    const month = expiryStr.slice(2, 5);

    if (ceStrike === peStrike) {
        // Straddle (same strike)
        return `${underlying} ${ceStrike} Straddle (${day} ${month})`;
    } else {
        // Strangle (different strikes)
        return `${underlying} ${ceStrike}/${peStrike} Strangle (${day} ${month})`;
    }
};

export default {
    UNDERLYINGS,
    parseExpiryDate,
    formatExpiryDate,
    getDaysToExpiry,
    getExpiryLabel,
    formatExpiryTab,
    getOptionChain,
    getAvailableExpiries,
    fetchOptionGreeks,
    combinePremiumOHLC,
    combineMultiLegOHLC,
    fetchStraddlePremium,
    formatStraddleName
};
