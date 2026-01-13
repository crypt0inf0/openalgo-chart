/**
 * Instrument Service
 * Handles symbol search and instrument metadata fetching
 */

import logger from '../utils/logger.js';
import { getApiBase, getLoginUrl, getApiKey, convertInterval } from './apiConfig';

// In-memory cache for instrument data (keyed by exchange)
const instrumentCache = new Map();
const INSTRUMENT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Search for symbols
 * @param {string} query - Search query
 * @param {string} exchange - Optional exchange filter (NSE, BSE, NFO, MCX, BFO, NSE_INDEX, BSE_INDEX)
 * @param {string} instrumenttype - Optional instrument type filter (EQ, FUT, CE, PE, OPTIDX, etc.)
 */
export const searchSymbols = async (query, exchange, instrumenttype) => {
    try {
        const requestBody = {
            apikey: getApiKey(),
            query
        };

        // Add exchange filter if specified
        if (exchange) {
            requestBody.exchange = exchange;
        }

        // Add instrumenttype filter if specified
        if (instrumenttype) {
            requestBody.instrumenttype = instrumenttype;
        }


        const response = await fetch(`${getApiBase()}/search`, {
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
                return [];
            }
            throw new Error(`OpenAlgo search error: ${response.status}`);
        }

        const data = await response.json();
        return data.data || data || [];
    } catch (error) {
        console.error('Error searching symbols:', error);
        return [];
    }
};

/**
 * Get all instruments for an exchange (with caching)
 * @param {string} exchange - Exchange code (NSE, NFO, MCX, etc.)
 * @returns {Promise<Array>} Array of instrument objects
 */
export const getInstruments = async (exchange) => {
    try {
        // Check cache first
        const cacheKey = exchange || 'ALL';
        const cached = instrumentCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < INSTRUMENT_CACHE_TTL) {
            return cached.data;
        }

        // Build URL with query parameters (GET request)
        const params = new URLSearchParams();
        params.append('apikey', getApiKey());
        if (exchange) {
            params.append('exchange', exchange);
        }

        const response = await fetch(`${getApiBase()}/instruments?${params.toString()}`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = getLoginUrl();
                return [];
            }
            throw new Error(`OpenAlgo instruments error: ${response.status}`);
        }

        const result = await response.json();
        const data = result.data || [];

        // Cache the result
        instrumentCache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });

        return data;
    } catch (error) {
        console.error('Error fetching instruments:', error);
        return [];
    }
};

/**
 * Get lot size for a specific symbol
 * @param {string} symbol - Trading symbol
 * @param {string} exchange - Exchange code
 * @returns {Promise<number>} Lot size (defaults to 1 if not found)
 */
export const getLotSize = async (symbol, exchange) => {
    try {
        const instruments = await getInstruments(exchange);
        const instrument = instruments.find(i =>
            i.symbol === symbol || i.brsymbol === symbol || i.tradingsymbol === symbol
        );

        if (instrument && instrument.lotsize) {
            return parseInt(instrument.lotsize, 10) || 1;
        }

        // Default to 1 for equity or if not found
        return 1;
    } catch (error) {
        console.error('Error getting lot size:', error);
        return 1;
    }
};

/**
 * Get full instrument info for a specific symbol
 * @param {string} symbol - Trading symbol
 * @param {string} exchange - Exchange code
 * @returns {Promise<Object|null>} Instrument object or null
 */
export const getInstrumentInfo = async (symbol, exchange) => {
    try {
        const instruments = await getInstruments(exchange);
        const instrument = instruments.find(i =>
            i.symbol === symbol || i.brsymbol === symbol || i.tradingsymbol === symbol
        );

        return instrument || null;
    } catch (error) {
        console.error('Error getting instrument info:', error);
        return null;
    }
};

/**
 * Clear the instruments cache (useful when switching brokers/accounts)
 */
export const clearInstrumentCache = () => {
    instrumentCache.clear();
};

/**
 * Get available intervals from broker
 * Returns: { seconds: [...], minutes: [...], hours: [...], days: [...], weeks: [...], months: [...] }
 */
export const getIntervals = async () => {
    try {
        const response = await fetch(`${getApiBase()}/intervals`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                apikey: getApiKey()
            })
        });

        if (!response.ok) {
            console.warn('[OpenAlgo] Intervals API returned:', response.status);
            return null;
        }

        const data = await response.json();
        logger.debug('[OpenAlgo] Intervals response:', data);

        // API returns { data: { seconds: [...], minutes: [...], ... }, status: 'success' }
        if (data && data.data && data.status === 'success') {
            return data.data;
        }

        return null;
    } catch (error) {
        console.error('Error fetching intervals:', error);
        return null;
    }
};

export default {
    searchSymbols,
    getInstruments,
    getLotSize,
    getInstrumentInfo,
    clearInstrumentCache,
    getIntervals
};
