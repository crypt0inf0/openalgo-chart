/**
 * Option Chain Service
 * Handles option chain fetching using OpenAlgo Option Chain API
 */

import { getOptionChain as fetchOptionChainAPI, getOptionGreeks, searchSymbols } from './openalgo';

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
 * @param {string} underlying - Underlying symbol (NIFTY, BANKNIFTY)
 * @param {string} exchange - Exchange (NFO, BFO) - will be converted to index exchange for API
 * @param {string} expiryDate - Optional expiry date in DDMMMYY format
 * @param {number} strikeCount - Number of strikes above/below ATM (default 15)
 * @returns {Promise<Object>} Option chain data with LTP, OI, etc.
 */
export const getOptionChain = async (underlying, exchange = 'NFO', expiryDate = null, strikeCount = 15) => {
    try {
        // Find the underlying config to get correct index exchange
        const underlyingConfig = UNDERLYINGS.find(u => u.symbol === underlying);
        const indexExchange = underlyingConfig?.indexExchange || (exchange === 'BFO' ? 'BSE_INDEX' : 'NSE_INDEX');

        console.log('[OptionChain] Fetching chain:', { underlying, indexExchange, expiryDate, strikeCount });

        // Call OpenAlgo Option Chain API
        const result = await fetchOptionChainAPI(underlying, indexExchange, expiryDate, strikeCount);

        if (!result) {
            console.error('[OptionChain] API returned null');
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
            } : null
        }));

        // Parse expiry date for display
        const expiryDateObj = parseExpiryDate(result.expiryDate);
        const dte = getDaysToExpiry(result.expiryDate);

        // Calculate underlying change and percentage
        const underlyingLTP = result.underlyingLTP || 0;
        const underlyingPrevClose = result.underlyingPrevClose || result.underlying_prev_close || 0;
        const change = underlyingPrevClose > 0 ? underlyingLTP - underlyingPrevClose : 0;
        const changePercent = underlyingPrevClose > 0 ? (change / underlyingPrevClose) * 100 : 0;

        return {
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
    } catch (error) {
        console.error('[OptionChain] Error fetching option chain:', error);
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

export default {
    UNDERLYINGS,
    parseExpiryDate,
    formatExpiryDate,
    getDaysToExpiry,
    getExpiryLabel,
    formatExpiryTab,
    getOptionChain,
    getAvailableExpiries,
    fetchOptionGreeks
};
