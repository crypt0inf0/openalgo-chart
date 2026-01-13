/**
 * Preferences Service
 * Handles fetching and saving user chart preferences to Cloud Workspace
 */

import logger from '../utils/logger.js';
import { getApiBase, getApiKey } from './apiConfig';

/**
 * Fetch all user chart preferences from Cloud Workspace
 * @returns {Promise<{data: Object|null, invalidApiKey: boolean}>} - Result with invalidApiKey flag
 */
export const fetchUserPreferences = async () => {
    try {
        const apiKey = getApiKey();
        const apiBase = getApiBase();

        logger.info('[OpenAlgo] fetchUserPreferences called');
        logger.debug('[OpenAlgo] API Key present:', !!apiKey, 'API Base:', apiBase);

        if (!apiKey) {
            logger.warn('[OpenAlgo] fetchUserPreferences: No API key found');
            return { data: null, invalidApiKey: true };
        }

        const url = `${apiBase}/chart?apikey=${encodeURIComponent(apiKey)}`;
        logger.info('[OpenAlgo] Fetching preferences from:', url);

        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include'
        });

        logger.info('[OpenAlgo] fetchUserPreferences response status:', response.status);

        if (!response.ok) {
            logger.warn('[OpenAlgo] Fetch preferences failed:', response.status, response.statusText);
            // 400, 401, 403 = Invalid API key
            if (response.status === 400 || response.status === 401 || response.status === 403) {
                return { data: null, invalidApiKey: true };
            }
            // Other errors - proceed with local state
            return { data: null, invalidApiKey: false };
        }

        const result = await response.json();
        // Response format: { status: 'success', data: {...prefs...} }
        const data = result.data || result;
        logger.info('[OpenAlgo] fetchUserPreferences received data:', Object.keys(data || {}));
        return { data, invalidApiKey: false };
    } catch (error) {
        logger.error('[OpenAlgo] Error fetching user preferences:', error);
        return { data: null, invalidApiKey: false };
    }
};

/**
 * Save user chart preferences to Cloud Workspace
 * @param {Object} preferences - Dictionary of preferences to save { key: value }
 */
export const saveUserPreferences = async (preferences) => {
    try {
        const apiKey = getApiKey();
        const apiBase = getApiBase();

        logger.info('[OpenAlgo] saveUserPreferences called with keys:', Object.keys(preferences || {}));
        logger.debug('[OpenAlgo] API Key present:', !!apiKey, 'API Base:', apiBase);

        if (!apiKey) {
            logger.warn('[OpenAlgo] saveUserPreferences: No API key found, returning false');
            return false;
        }

        const url = `${apiBase}/chart`;
        logger.info('[OpenAlgo] Saving preferences to:', url);

        // Include apikey in body along with preferences
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ apikey: apiKey, ...preferences })
        });

        logger.info('[OpenAlgo] saveUserPreferences response status:', response.status);

        if (!response.ok) {
            logger.warn('[OpenAlgo] Save preferences failed:', response.status, response.statusText);
            return false;
        }

        logger.info('[OpenAlgo] saveUserPreferences success!');
        return true;
    } catch (error) {
        logger.error('[OpenAlgo] Error saving user preferences:', error);
        return false;
    }
};

export default {
    fetchUserPreferences,
    saveUserPreferences
};
