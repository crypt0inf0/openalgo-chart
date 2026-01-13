/**
 * Options API Service
 * Handles option chain, greeks, and expiry data fetching
 */

import { getApiKey, getApiBase, getLoginUrl } from './apiConfig';
import logger from '../utils/logger';

/**
 * Get Expiry Dates for Futures or Options
 * @param {string} symbol - Underlying symbol (e.g., NIFTY, BANKNIFTY, RELIANCE)
 * @param {string} exchange - Exchange code (NFO, BFO, MCX, CDS)
 * @param {string} instrumentType - Type of instrument: 'futures' or 'options'
 * @returns {Promise<string[]|null>} Array of expiry dates in DD-MMM-YY format, or null on error
 */
export const getExpiry = async (symbol, exchange = 'NFO', instrumentType = 'options') => {
    try {
        const requestBody = {
            apikey: getApiKey(),
            symbol,
            exchange,
            instrumenttype: instrumentType
        };

        logger.debug('[OptionsAPI] Expiry request:', requestBody);

        const response = await fetch(`${getApiBase()}/expiry`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = getLoginUrl();
                return null;
            }
            if (response.status === 400) {
                const errorData = await response.json().catch(() => ({}));
                logger.warn('[OptionsAPI] Expiry error:', errorData.message || response.statusText);
                return null;
            }
            throw new Error(`OpenAlgo expiry error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        logger.debug('[OptionsAPI] Expiry response:', data);

        if (data && data.status === 'success' && Array.isArray(data.data)) {
            return data.data;
        }

        return null;
    } catch (error) {
        console.error('Error fetching expiry dates:', error);
        return null;
    }
};

/**
 * Get Option Chain for an underlying
 * @param {string} underlying - Underlying symbol (e.g., NIFTY, BANKNIFTY, RELIANCE)
 * @param {string} exchange - Exchange code (NSE_INDEX, NSE, NFO, BSE_INDEX, BSE, BFO)
 * @param {string} expiryDate - Optional expiry date in DDMMMYY format (e.g., 30DEC25)
 * @param {number} strikeCount - Number of strikes above and below ATM (1-100)
 */
export const getOptionChain = async (underlying, exchange = 'NFO', expiryDate = null, strikeCount = 10) => {
    try {
        const requestBody = {
            apikey: getApiKey(),
            underlying,
            exchange,
            strike_count: strikeCount
        };

        if (expiryDate) {
            requestBody.expiry_date = expiryDate;
        }

        logger.debug('[OptionsAPI] Option Chain request:', requestBody);

        const response = await fetch(`${getApiBase()}/optionchain`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = getLoginUrl();
                return null;
            }
            if (response.status === 400) {
                const error = new Error(`Symbol does not support F&O trading`);
                error.code = 'NO_FO_SUPPORT';
                error.status = 400;
                throw error;
            }
            throw new Error(`OpenAlgo optionchain error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        logger.debug('[OptionsAPI] Option Chain response:', data);

        if (data && data.status === 'success') {
            return {
                underlying: data.underlying,
                underlyingLTP: parseFloat(data.underlying_ltp || 0),
                underlyingPrevClose: parseFloat(data.underlying_prev_close || 0),
                expiryDate: data.expiry_date,
                atmStrike: parseFloat(data.atm_strike || 0),
                chain: data.chain || []
            };
        }

        return null;
    } catch (error) {
        console.error('Error fetching option chain:', error);
        return null;
    }
};

/**
 * Get Option Greeks for a specific option symbol
 * @param {string} symbol - Option symbol (e.g., NIFTY02DEC2526000CE)
 * @param {string} exchange - Exchange code (NFO, BFO, CDS, MCX)
 * @param {Object} options - Optional parameters (interest_rate, forward_price, etc.)
 */
export const getOptionGreeks = async (symbol, exchange = 'NFO', options = {}) => {
    try {
        const requestBody = {
            apikey: getApiKey(),
            symbol,
            exchange,
            ...options
        };

        logger.debug('[OptionsAPI] Option Greeks request:', requestBody);

        const response = await fetch(`${getApiBase()}/optiongreeks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = getLoginUrl();
                return null;
            }
            throw new Error(`OpenAlgo optiongreeks error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        logger.debug('[OptionsAPI] Option Greeks response:', data);

        if (data && data.status === 'success') {
            return {
                symbol: data.symbol,
                underlying: data.underlying,
                strike: parseFloat(data.strike || 0),
                optionType: data.option_type,
                expiryDate: data.expiry_date,
                daysToExpiry: data.days_to_expiry,
                spotPrice: parseFloat(data.spot_price || 0),
                optionPrice: parseFloat(data.option_price || 0),
                iv: parseFloat(data.implied_volatility || 0),
                greeks: data.greeks || {}
            };
        }

        return null;
    } catch (error) {
        console.error('Error fetching option greeks:', error);
        return null;
    }
};

// Internal helper for single batch request
const fetchMultiGreeksBatch = async (symbols, options = {}) => {
    try {
        const requestBody = {
            apikey: getApiKey(),
            symbols: symbols.map(s => ({
                symbol: s.symbol,
                exchange: s.exchange || 'NFO'
            })),
            ...options
        };

        logger.debug('[OptionsAPI] Multi Option Greeks batch request:', { count: symbols.length });

        const response = await fetch(`${getApiBase()}/multioptiongreeks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = getLoginUrl();
                return null;
            }
            throw new Error(`OpenAlgo multioptiongreeks error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        logger.debug('[OptionsAPI] Multi Option Greeks batch response:', data.summary);

        if (data && data.data) {
            return {
                status: data.status || 'error',
                data: data.data || [],
                summary: data.summary || { total: symbols.length, success: 0, failed: symbols.length }
            };
        }

        return null;
    } catch (error) {
        console.error('Error fetching multi option greeks batch:', error);
        return null;
    }
};

/**
 * Get Option Greeks for multiple symbols in a single batch request
 * Much faster than individual calls - processes up to 50 symbols at once
 * @param {Array<{symbol: string, exchange: string}>} symbols - Array of option symbols
 * @param {Object} options - Optional parameters (interest_rate, expiry_time)
 * @returns {Promise<Object>} Response with data array and summary
 */
export const getMultiOptionGreeks = async (symbols, options = {}) => {
    if (!symbols || symbols.length === 0) {
        logger.debug('[OptionsAPI] Multi Option Greeks: No symbols to fetch');
        return { status: 'success', data: [], summary: { total: 0, success: 0, failed: 0 } };
    }

    const MAX_BATCH_SIZE = 50;

    if (symbols.length <= MAX_BATCH_SIZE) {
        return await fetchMultiGreeksBatch(symbols, options);
    }

    logger.debug('[OptionsAPI] Multi Option Greeks: Batching', symbols.length, 'symbols into chunks of', MAX_BATCH_SIZE);

    const allData = [];
    let totalSuccess = 0;
    let totalFailed = 0;

    for (let i = 0; i < symbols.length; i += MAX_BATCH_SIZE) {
        const batch = symbols.slice(i, i + MAX_BATCH_SIZE);
        const result = await fetchMultiGreeksBatch(batch, options);

        if (result && result.data) {
            allData.push(...result.data);
            totalSuccess += result.summary?.success || 0;
            totalFailed += result.summary?.failed || 0;
        }
    }

    return {
        status: totalFailed === 0 ? 'success' : totalSuccess > 0 ? 'partial' : 'error',
        data: allData,
        summary: { total: symbols.length, success: totalSuccess, failed: totalFailed }
    };
};

/**
 * Fetch expiry dates for F&O instruments using the dedicated Expiry API
 * @param {string} symbol - Underlying symbol (e.g., NIFTY, BANKNIFTY, RELIANCE, GOLD)
 * @param {string} exchange - Exchange code (NFO, BFO, MCX, CDS)
 * @param {string} instrumenttype - Type of instrument: 'futures' or 'options'
 * @returns {Promise<Array<string>|null>} Array of expiry dates in DD-MMM-YY format or null on error
 */
export const fetchExpiryDates = async (symbol, exchange = 'NFO', instrumenttype = 'options') => {
    try {
        const requestBody = {
            apikey: getApiKey(),
            symbol,
            exchange,
            instrumenttype
        };

        logger.debug('[OptionsAPI] Expiry API request:', requestBody);

        const response = await fetch(`${getApiBase()}/expiry`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = getLoginUrl();
                return null;
            }
            if (response.status === 400) {
                const error = new Error(`No expiry dates found for ${symbol} in ${exchange}`);
                error.code = 'NO_EXPIRY_FOUND';
                error.status = 400;
                throw error;
            }
            throw new Error(`OpenAlgo expiry error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        logger.debug('[OptionsAPI] Expiry API response:', data);

        if (data && data.status === 'success' && Array.isArray(data.data)) {
            return data.data;
        }

        return null;
    } catch (error) {
        console.error('Error fetching expiry dates:', error);
        return null;
    }
};

export default {
    getExpiry,
    getOptionChain,
    getOptionGreeks,
    getMultiOptionGreeks,
    fetchExpiryDates
};
