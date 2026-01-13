/**
 * Storage Service
 * Centralized localStorage access with error handling and type safety
 *
 * Benefits:
 * - Consistent error handling (quota exceeded, private browsing)
 * - Type-safe getters (getString, getJSON, getBoolean, getNumber)
 * - Automatic JSON serialization/deserialization
 * - Uses STORAGE_KEYS constants to prevent typos
 * - Single point of change for storage logic
 */

import { STORAGE_KEYS } from '../constants/storageKeys';

/**
 * Safely parses JSON string
 * @param {string} value - JSON string to parse
 * @param {*} fallback - Fallback value if parsing fails
 * @returns {*} Parsed value or fallback
 */
export const safeParseJSON = (value, fallback) => {
    if (value === null || value === undefined) return fallback;
    try {
        return JSON.parse(value);
    } catch (error) {
        console.warn('[Storage] Failed to parse JSON:', error.message);
        return fallback;
    }
};

/**
 * Safely stringifies value to JSON
 * @param {*} value - Value to stringify
 * @returns {string|null} JSON string or null if failed
 */
export const safeStringifyJSON = (value) => {
    try {
        return JSON.stringify(value);
    } catch (error) {
        console.warn('[Storage] Failed to stringify JSON:', error.message);
        return null;
    }
};

/**
 * Get raw string value from localStorage
 * @param {string} key - Storage key (use STORAGE_KEYS constant)
 * @param {string} [fallback=''] - Fallback value
 * @returns {string} Stored value or fallback
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
 * Get parsed JSON value from localStorage
 * @param {string} key - Storage key (use STORAGE_KEYS constant)
 * @param {*} fallback - Fallback value if key doesn't exist or parse fails
 * @returns {*} Parsed value or fallback
 */
export const getJSON = (key, fallback = null) => {
    try {
        const value = localStorage.getItem(key);
        return safeParseJSON(value, fallback);
    } catch (error) {
        console.warn(`[Storage] Failed to get '${key}':`, error.message);
        return fallback;
    }
};

/**
 * Get boolean value from localStorage
 * @param {string} key - Storage key (use STORAGE_KEYS constant)
 * @param {boolean} [fallback=false] - Fallback value
 * @returns {boolean} Stored boolean or fallback
 */
export const getBoolean = (key, fallback = false) => {
    try {
        const value = localStorage.getItem(key);
        if (value === null) return fallback;
        return value === 'true';
    } catch (error) {
        console.warn(`[Storage] Failed to get '${key}':`, error.message);
        return fallback;
    }
};

/**
 * Get number value from localStorage
 * @param {string} key - Storage key (use STORAGE_KEYS constant)
 * @param {number} [fallback=0] - Fallback value
 * @returns {number} Stored number or fallback
 */
export const getNumber = (key, fallback = 0) => {
    try {
        const value = localStorage.getItem(key);
        if (value === null) return fallback;
        const num = parseFloat(value);
        return Number.isFinite(num) ? num : fallback;
    } catch (error) {
        console.warn(`[Storage] Failed to get '${key}':`, error.message);
        return fallback;
    }
};

/**
 * Set string value in localStorage
 * @param {string} key - Storage key (use STORAGE_KEYS constant)
 * @param {string} value - Value to store
 * @returns {boolean} Success status
 */
export const setString = (key, value) => {
    try {
        localStorage.setItem(key, String(value));
        return true;
    } catch (error) {
        handleStorageError(error, key);
        return false;
    }
};

/**
 * Set JSON value in localStorage
 * @param {string} key - Storage key (use STORAGE_KEYS constant)
 * @param {*} value - Value to store (will be JSON stringified)
 * @returns {boolean} Success status
 */
export const setJSON = (key, value) => {
    try {
        const json = safeStringifyJSON(value);
        if (json === null) return false;
        localStorage.setItem(key, json);
        return true;
    } catch (error) {
        handleStorageError(error, key);
        return false;
    }
};

/**
 * Set boolean value in localStorage
 * @param {string} key - Storage key (use STORAGE_KEYS constant)
 * @param {boolean} value - Boolean value to store
 * @returns {boolean} Success status
 */
export const setBoolean = (key, value) => {
    return setString(key, value ? 'true' : 'false');
};

/**
 * Set number value in localStorage
 * @param {string} key - Storage key (use STORAGE_KEYS constant)
 * @param {number} value - Number value to store
 * @returns {boolean} Success status
 */
export const setNumber = (key, value) => {
    return setString(key, String(value));
};

/**
 * Remove item from localStorage
 * @param {string} key - Storage key to remove
 * @returns {boolean} Success status
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
 * Check if key exists in localStorage
 * @param {string} key - Storage key to check
 * @returns {boolean} Whether key exists
 */
export const has = (key) => {
    try {
        return localStorage.getItem(key) !== null;
    } catch (error) {
        return false;
    }
};

/**
 * Handle storage errors (quota exceeded, etc.)
 * @param {Error} error - The error that occurred
 * @param {string} key - The key being written
 */
const handleStorageError = (error, key) => {
    if (error.name === 'QuotaExceededError' || error.code === 22) {
        console.error(`[Storage] Quota exceeded when writing '${key}'. Consider clearing old data.`);
        // Could implement LRU eviction here if needed
    } else {
        console.warn(`[Storage] Failed to write '${key}':`, error.message);
    }
};

/**
 * Clear all app-related localStorage keys
 * Only clears keys defined in STORAGE_KEYS
 * @returns {number} Number of keys cleared
 */
export const clearAppStorage = () => {
    let cleared = 0;
    Object.values(STORAGE_KEYS).forEach(key => {
        try {
            if (localStorage.getItem(key) !== null) {
                localStorage.removeItem(key);
                cleared++;
            }
        } catch (error) {
            // Ignore errors during clear
        }
    });
    return cleared;
};

/**
 * Get storage usage statistics
 * @returns {Object} Storage stats { used, total, percentage }
 */
export const getStorageStats = () => {
    try {
        let used = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            used += (key?.length || 0) + (value?.length || 0);
        }
        // localStorage typically has 5MB limit
        const total = 5 * 1024 * 1024;
        return {
            used,
            total,
            percentage: ((used / total) * 100).toFixed(2),
            usedKB: (used / 1024).toFixed(2),
        };
    } catch (error) {
        return { used: 0, total: 0, percentage: '0', usedKB: '0' };
    }
};

// Re-export STORAGE_KEYS for convenience
export { STORAGE_KEYS };

export default {
    // Getters
    getString,
    getJSON,
    getBoolean,
    getNumber,
    // Setters
    setString,
    setJSON,
    setBoolean,
    setNumber,
    // Utils
    remove,
    has,
    clearAppStorage,
    getStorageStats,
    safeParseJSON,
    safeStringifyJSON,
    // Constants
    STORAGE_KEYS,
};
