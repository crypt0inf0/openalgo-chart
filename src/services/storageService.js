/**
 * Centralized Storage Service
 * Provides safe localStorage operations with error handling and JSON support
 */

import { STORAGE_KEYS } from '../constants/storageKeys';

/**
 * Safely parse JSON with fallback
 * @param {string|null|undefined} value - The value to parse
 * @param {*} fallback - Fallback value if parsing fails
 * @returns {*} - Parsed value or fallback
 */
export const safeParseJSON = (value, fallback = null) => {
    if (value === null || value === undefined) {
        return fallback;
    }
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

/**
 * Get a string value from localStorage
 * @param {string} key - The storage key
 * @param {string} fallback - Fallback value if key doesn't exist
 * @returns {string} - The stored value or fallback
 */
export const getString = (key, fallback = '') => {
    try {
        const value = localStorage.getItem(key);
        return value !== null ? value : fallback;
    } catch (error) {
        console.warn(`[Storage] Failed to get '${key}':`, error.message);
        return fallback;
    }
};

/**
 * Get a value from localStorage
 * @param {string} key - The storage key
 * @param {*} fallback - Fallback value if key doesn't exist
 * @returns {string|null} - The stored value or fallback
 */
export const get = (key, fallback = null) => {
    try {
        const value = localStorage.getItem(key);
        return value !== null ? value : fallback;
    } catch (error) {
        console.warn(`[Storage] Failed to get '${key}':`, error.message);
        return fallback;
    }
};

/**
 * Set a value in localStorage
 * @param {string} key - The storage key
 * @param {string} value - The value to store
 * @returns {boolean} - Whether the operation succeeded
 */
export const set = (key, value) => {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (error) {
        console.warn(`[Storage] Failed to set '${key}':`, error.message);
        return false;
    }
};

/**
 * Remove a value from localStorage
 * @param {string} key - The storage key
 * @returns {boolean} - Whether the operation succeeded
 */
export const remove = (key) => {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.warn(`[Storage] Failed to remove '${key}':`, error.message);
        return false;
    }
};

/**
 * Get a JSON value from localStorage
 * @param {string} key - The storage key
 * @param {*} fallback - Fallback value if key doesn't exist or parsing fails
 * @returns {*} - The parsed value or fallback
 */
export const getJSON = (key, fallback = null) => {
    const value = get(key);
    return safeParseJSON(value, fallback);
};

/**
 * Set a JSON value in localStorage
 * @param {string} key - The storage key
 * @param {*} value - The value to store (will be JSON stringified)
 * @returns {boolean} - Whether the operation succeeded
 */
export const setJSON = (key, value) => {
    try {
        return set(key, JSON.stringify(value));
    } catch (error) {
        console.warn(`[Storage] Failed to stringify for '${key}':`, error.message);
        return false;
    }
};

/**
 * Get a boolean value from localStorage
 * @param {string} key - The storage key
 * @param {boolean} fallback - Fallback value if key doesn't exist
 * @returns {boolean} - The boolean value
 */
export const getBoolean = (key, fallback = false) => {
    const value = get(key);
    if (value === null) return fallback;
    return value === 'true';
};

/**
 * Set a boolean value in localStorage
 * @param {string} key - The storage key
 * @param {boolean} value - The boolean value to store
 * @returns {boolean} - Whether the operation succeeded
 */
export const setBoolean = (key, value) => {
    return set(key, value ? 'true' : 'false');
};

/**
 * Get a number value from localStorage
 * @param {string} key - The storage key
 * @param {number} fallback - Fallback value if key doesn't exist or parsing fails
 * @returns {number} - The number value
 */
export const getNumber = (key, fallback = 0) => {
    const value = get(key);
    if (value === null) return fallback;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? fallback : parsed;
};

/**
 * Set a number value in localStorage
 * @param {string} key - The storage key
 * @param {number} value - The number value to store
 * @returns {boolean} - Whether the operation succeeded
 */
export const setNumber = (key, value) => {
    return set(key, String(value));
};

/**
 * Check if a key exists in localStorage
 * @param {string} key - The storage key
 * @returns {boolean} - Whether the key exists
 */
export const has = (key) => {
    try {
        return localStorage.getItem(key) !== null;
    } catch {
        return false;
    }
};

/**
 * Clear all app-related storage (keys starting with 'tv_' or 'oa_')
 * @returns {number} - Number of keys cleared
 */
export const clearAppStorage = () => {
    let cleared = 0;
    try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('tv_') || key.startsWith('oa_'))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            cleared++;
        });
    } catch (error) {
        console.warn('[Storage] Failed to clear app storage:', error.message);
    }
    return cleared;
};

/**
 * Export storage as JSON object
 * @returns {Object} - All app storage as key-value pairs
 */
export const exportStorage = () => {
    const data = {};
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('tv_') || key.startsWith('oa_'))) {
                data[key] = localStorage.getItem(key);
            }
        }
    } catch (error) {
        console.warn('[Storage] Failed to export storage:', error.message);
    }
    return data;
};

/**
 * Import storage from JSON object
 * @param {Object} data - Key-value pairs to import
 * @returns {number} - Number of keys imported
 */
export const importStorage = (data) => {
    let imported = 0;
    try {
        Object.entries(data).forEach(([key, value]) => {
            if (key.startsWith('tv_') || key.startsWith('oa_')) {
                localStorage.setItem(key, value);
                imported++;
            }
        });
    } catch (error) {
        console.warn('[Storage] Failed to import storage:', error.message);
    }
    return imported;
};

// Re-export STORAGE_KEYS for convenience
export { STORAGE_KEYS };

export default {
    get,
    getString,
    set,
    remove,
    getJSON,
    setJSON,
    getBoolean,
    setBoolean,
    getNumber,
    setNumber,
    has,
    safeParseJSON,
    clearAppStorage,
    exportStorage,
    importStorage,
    STORAGE_KEYS,
};
