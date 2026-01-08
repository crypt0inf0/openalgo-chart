/**
 * Market Service - Holidays & Timings API Integration
 * Provides accurate market timing information for indicators and session boundaries
 * 
 * API Endpoints:
 * - POST /api/v1/market/holidays - Get market holidays for a year
 * - POST /api/v1/market/timings - Get market timings for a date
 */

import logger from '../utils/logger.js';
import { getApiBase, getApiKey } from './openalgo.js';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5h 30m in milliseconds

// Cache storage
const cache = {
    holidays: { data: null, year: null, timestamp: 0 },
    timings: new Map() // Map<date, { data, timestamp }>
};

/**
 * Check if cached data is still valid
 */
const isCacheValid = (timestamp) => {
    return Date.now() - timestamp < CACHE_TTL_MS;
};

/**
 * Get market holidays for a specific year
 * @param {number} year - Year to get holidays for (2020-2050)
 * @returns {Promise<Array>} Array of holiday objects
 * 
 * Holiday object structure:
 * {
 *   date: "2025-02-26",
 *   description: "Maha Shivaratri",
 *   holiday_type: "TRADING_HOLIDAY" | "SETTLEMENT_HOLIDAY" | "SPECIAL_SESSION",
 *   closed_exchanges: ["NSE", "BSE", ...],
 *   open_exchanges: [{ exchange: "MCX", start_time: epoch_ms, end_time: epoch_ms }]
 * }
 */
export const getMarketHolidays = async (year = new Date().getFullYear()) => {
    // Check cache
    if (cache.holidays.year === year && isCacheValid(cache.holidays.timestamp)) {
        logger.debug('[MarketService] Using cached holidays for', year);
        return cache.holidays.data;
    }

    try {
        const response = await fetch(`${getApiBase()}/market/holidays`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                apikey: getApiKey(),
                year
            })
        });

        if (!response.ok) {
            throw new Error(`Market holidays error: ${response.status}`);
        }

        const result = await response.json();
        logger.debug('[MarketService] Holidays response:', result);

        if (result.status === 'success' && result.data) {
            // Update cache
            cache.holidays = {
                data: result.data,
                year,
                timestamp: Date.now()
            };
            return result.data;
        }

        return [];
    } catch (error) {
        console.error('[MarketService] Error fetching holidays:', error);
        return [];
    }
};

/**
 * Get market timings for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Array>} Array of exchange timing objects
 * 
 * Timing object structure:
 * {
 *   exchange: "NSE",
 *   start_time: 1745984700000,  // epoch milliseconds
 *   end_time: 1746007200000
 * }
 * 
 * Returns empty array if market is closed (weekend/holiday)
 */
export const getMarketTimings = async (date) => {
    if (!date) {
        date = new Date().toISOString().split('T')[0];
    }

    // Check cache
    const cached = cache.timings.get(date);
    if (cached && isCacheValid(cached.timestamp)) {
        logger.debug('[MarketService] Using cached timings for', date);
        return cached.data;
    }

    try {
        const response = await fetch(`${getApiBase()}/market/timings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                apikey: getApiKey(),
                date
            })
        });

        if (!response.ok) {
            throw new Error(`Market timings error: ${response.status}`);
        }

        const result = await response.json();
        logger.debug('[MarketService] Timings response:', result);

        if (result.status === 'success' && result.data) {
            // Update cache
            cache.timings.set(date, {
                data: result.data,
                timestamp: Date.now()
            });

            // Limit cache size (keep last 7 days)
            if (cache.timings.size > 7) {
                const oldestKey = cache.timings.keys().next().value;
                cache.timings.delete(oldestKey);
            }

            return result.data;
        }

        return [];
    } catch (error) {
        console.error('[MarketService] Error fetching timings:', error);
        return [];
    }
};

/**
 * Check if market is currently open for a specific exchange
 * @param {string} exchange - Exchange code (NSE, BSE, NFO, MCX, etc.)
 * @returns {Promise<boolean>} True if market is open
 */
export const isMarketOpen = async (exchange = 'NSE') => {
    const today = new Date().toISOString().split('T')[0];
    const timings = await getMarketTimings(today);

    if (!timings || timings.length === 0) {
        return false; // Holiday or weekend
    }

    const exchangeTiming = timings.find(t => t.exchange === exchange);
    if (!exchangeTiming) {
        return false; // Exchange not trading today
    }

    const now = Date.now();
    return now >= exchangeTiming.start_time && now <= exchangeTiming.end_time;
};

/**
 * Check if a date is a trading holiday for a specific exchange
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} exchange - Exchange code
 * @returns {Promise<{isHoliday: boolean, description?: string, type?: string}>}
 */
export const isTradingHoliday = async (date, exchange = 'NSE') => {
    if (!date) {
        date = new Date().toISOString().split('T')[0];
    }

    const year = parseInt(date.split('-')[0]);
    const holidays = await getMarketHolidays(year);

    const holiday = holidays.find(h => h.date === date);

    if (!holiday) {
        return { isHoliday: false };
    }

    // Check if this exchange is closed
    if (holiday.closed_exchanges.includes(exchange)) {
        return {
            isHoliday: true,
            description: holiday.description,
            type: holiday.holiday_type
        };
    }

    // Exchange might have special session timings
    const specialSession = holiday.open_exchanges.find(e => e.exchange === exchange);
    if (specialSession) {
        return {
            isHoliday: false,
            description: holiday.description,
            type: holiday.holiday_type,
            specialSession: {
                start_time: specialSession.start_time,
                end_time: specialSession.end_time
            }
        };
    }

    return { isHoliday: false };
};

/**
 * Get session boundaries for a specific date and exchange
 * Useful for indicators like VWAP, TPO that need session start/end times
 * 
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} exchange - Exchange code
 * @returns {Promise<{start_time: number, end_time: number} | null>} Times in epoch milliseconds
 */
export const getSessionBoundaries = async (date, exchange = 'NSE') => {
    if (!date) {
        date = new Date().toISOString().split('T')[0];
    }

    const timings = await getMarketTimings(date);
    const exchangeTiming = timings.find(t => t.exchange === exchange);

    if (!exchangeTiming) {
        return null; // Market closed
    }

    return {
        start_time: exchangeTiming.start_time,
        end_time: exchangeTiming.end_time
    };
};

/**
 * Get session boundaries with IST offset for chart display
 * Chart uses IST-offset timestamps for display consistency
 * 
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} exchange - Exchange code
 * @returns {Promise<{start_time: number, end_time: number} | null>} Times in epoch seconds with IST offset
 */
export const getSessionBoundariesIST = async (date, exchange = 'NSE') => {
    const boundaries = await getSessionBoundaries(date, exchange);

    if (!boundaries) {
        return null;
    }

    // Convert from milliseconds to seconds and add IST offset
    const IST_OFFSET_SECONDS = 19800; // 5h 30m
    return {
        start_time: Math.floor(boundaries.start_time / 1000) + IST_OFFSET_SECONDS,
        end_time: Math.floor(boundaries.end_time / 1000) + IST_OFFSET_SECONDS
    };
};

/**
 * Get default market timings (fallback when API is unavailable)
 * @param {string} exchange - Exchange code
 * @returns {{ open: string, close: string }} Times in HH:MM IST format
 */
export const getDefaultTimings = (exchange = 'NSE') => {
    const defaults = {
        'NSE': { open: '09:15', close: '15:30' },
        'BSE': { open: '09:15', close: '15:30' },
        'NFO': { open: '09:15', close: '15:30' },
        'BFO': { open: '09:15', close: '15:30' },
        'CDS': { open: '09:00', close: '17:00' },
        'BCD': { open: '09:00', close: '17:00' },
        'MCX': { open: '09:00', close: '23:55' }
    };

    return defaults[exchange] || defaults['NSE'];
};

/**
 * Clear all cached data
 * Useful when user changes API settings
 */
export const clearCache = () => {
    cache.holidays = { data: null, year: null, timestamp: 0 };
    cache.timings.clear();
    logger.debug('[MarketService] Cache cleared');
};

export default {
    getMarketHolidays,
    getMarketTimings,
    isMarketOpen,
    isTradingHoliday,
    getSessionBoundaries,
    getSessionBoundariesIST,
    getDefaultTimings,
    clearCache
};
