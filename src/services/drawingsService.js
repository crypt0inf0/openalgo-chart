/**
 * Drawings Service
 * Handles saving and loading chart drawings to/from the backend
 */

import { getApiKey, getApiBase } from './apiConfig';
import logger from '../utils/logger';

/**
 * Save chart drawings to backend
 * @param {string} symbol - Trading symbol
 * @param {string} exchange - Exchange code
 * @param {string} interval - Chart interval
 * @param {Array} drawings - Array of drawing objects from LineToolManager.exportDrawings()
 * @returns {Promise<boolean>} Success status
 */
export const saveDrawings = async (symbol, exchange = 'NSE', interval = '1d', drawings) => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) {
            logger.warn('[DrawingsService] saveDrawings: No API key');
            return false;
        }

        // Create a unique key for this symbol/exchange/interval combination
        const drawingsKey = `drawings_${symbol}_${exchange}_${interval}`;

        const response = await fetch(`${getApiBase()}/chart`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                apikey: apiKey,
                [drawingsKey]: JSON.stringify(drawings)
            })
        });

        if (!response.ok) {
            console.error('[DrawingsService] saveDrawings error:', response.status);
            return false;
        }

        const data = await response.json();
        logger.debug('[DrawingsService] saveDrawings success:', { symbol, exchange, interval, count: drawings.length });
        return data.status === 'success';
    } catch (error) {
        console.error('[DrawingsService] Error saving drawings:', error);
        return false;
    }
};

/**
 * Load chart drawings from backend
 * @param {string} symbol - Trading symbol
 * @param {string} exchange - Exchange code
 * @param {string} interval - Chart interval
 * @returns {Promise<Array|null>} Array of drawing objects or null if not found
 */
export const loadDrawings = async (symbol, exchange = 'NSE', interval = '1d') => {
    const drawingsKey = `drawings_${symbol}_${exchange}_${interval}`;

    // First, check if CloudSync has already loaded data (stored in global cache)
    if (window._chartPrefsCache && window._chartPrefsCache[drawingsKey]) {
        try {
            const drawings = typeof window._chartPrefsCache[drawingsKey] === 'string'
                ? JSON.parse(window._chartPrefsCache[drawingsKey])
                : window._chartPrefsCache[drawingsKey];
            console.log('[DrawingsService] loadDrawings from cache:', { symbol, exchange, interval, count: drawings.length });
            return drawings;
        } catch (parseError) {
            console.warn('[DrawingsService] Failed to parse cached drawings:', parseError);
        }
    }

    // Fallback: make API call
    try {
        const apiKey = getApiKey();
        if (!apiKey) {
            logger.debug('[DrawingsService] loadDrawings: No API key, skipping');
            return null;
        }

        const response = await fetch(`${getApiBase()}/chart?apikey=${encodeURIComponent(apiKey)}`, {
            method: 'GET',
            credentials: 'include',
        });

        // 400 likely means no data saved yet - treat as empty result
        if (response.status === 400) {
            logger.debug('[DrawingsService] loadDrawings: No saved preferences yet');
            return null;
        }

        if (!response.ok) {
            if (response.status === 401) {
                return null;
            }
            logger.debug('[DrawingsService] loadDrawings status:', response.status);
            return null;
        }

        const data = await response.json();

        if (data.status === 'success' && data.data) {
            // Store in cache for future use
            if (!window._chartPrefsCache) window._chartPrefsCache = {};
            Object.assign(window._chartPrefsCache, data.data);

            const drawingsJson = data.data[drawingsKey];

            if (drawingsJson) {
                try {
                    const drawings = JSON.parse(drawingsJson);
                    console.log('[DrawingsService] loadDrawings success:', { symbol, exchange, interval, count: drawings.length });
                    return drawings;
                } catch (parseError) {
                    console.warn('[DrawingsService] Failed to parse drawings JSON:', parseError);
                    return null;
                }
            }
        }

        return null;
    } catch (error) {
        logger.debug('[DrawingsService] loadDrawings error:', error.message);
        return null;
    }
};

export default {
    saveDrawings,
    loadDrawings
};
