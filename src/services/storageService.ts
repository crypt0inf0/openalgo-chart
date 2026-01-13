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

// Type for storage stats
interface StorageStats {
    used: number;
    total: number;
    percentage: string;
    usedKB: string;
}

/**
 * Safely parses JSON string
 */
export const safeParseJSON = <T>(value: string | null | undefined, fallback: T): T => {
    if (value === null || value === undefined) return fallback;
    try {
        return JSON.parse(value) as T;
    } catch (error) {
        console.warn('[Storage] Failed to parse JSON:', (error as Error).message);
        return fallback;
    }
};

/**
 * Safely stringifies value to JSON
 */
export const safeStringifyJSON = (value: unknown): string | null => {
    try {
        return JSON.stringify(value);
    } catch (error) {
        console.warn('[Storage] Failed to stringify JSON:', (error as Error).message);
        return null;
    }
};

/**
 * Get raw string value from localStorage
 */
export const getString = (key: string, fallback: string = ''): string => {
    try {
        const value = localStorage.getItem(key);
        return value !== null ? value : fallback;
    } catch (error) {
        console.warn(`[Storage] Failed to get '${key}':`, (error as Error).message);
        return fallback;
    }
};

/**
 * Get parsed JSON value from localStorage
 */
export const getJSON = <T>(key: string, fallback: T): T => {
    try {
        const value = localStorage.getItem(key);
        return safeParseJSON<T>(value, fallback);
    } catch (error) {
        console.warn(`[Storage] Failed to get '${key}':`, (error as Error).message);
        return fallback;
    }
};

/**
 * Get boolean value from localStorage
 */
export const getBoolean = (key: string, fallback: boolean = false): boolean => {
    try {
        const value = localStorage.getItem(key);
        if (value === null) return fallback;
        return value === 'true';
    } catch (error) {
        console.warn(`[Storage] Failed to get '${key}':`, (error as Error).message);
        return fallback;
    }
};

/**
 * Get number value from localStorage
 */
export const getNumber = (key: string, fallback: number = 0): number => {
    try {
        const value = localStorage.getItem(key);
        if (value === null) return fallback;
        const num = parseFloat(value);
        return Number.isFinite(num) ? num : fallback;
    } catch (error) {
        console.warn(`[Storage] Failed to get '${key}':`, (error as Error).message);
        return fallback;
    }
};

/**
 * Handle storage errors (quota exceeded, etc.)
 */
const handleStorageError = (error: unknown, key: string): void => {
    const err = error as Error & { code?: number };
    if (err.name === 'QuotaExceededError' || err.code === 22) {
        console.error(`[Storage] Quota exceeded when writing '${key}'. Consider clearing old data.`);
    } else {
        console.warn(`[Storage] Failed to write '${key}':`, err.message);
    }
};

/**
 * Set string value in localStorage
 */
export const setString = (key: string, value: string): boolean => {
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
 */
export const setJSON = (key: string, value: unknown): boolean => {
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
 */
export const setBoolean = (key: string, value: boolean): boolean => {
    return setString(key, value ? 'true' : 'false');
};

/**
 * Set number value in localStorage
 */
export const setNumber = (key: string, value: number): boolean => {
    return setString(key, String(value));
};

/**
 * Remove item from localStorage
 */
export const remove = (key: string): boolean => {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.warn(`[Storage] Failed to remove '${key}':`, (error as Error).message);
        return false;
    }
};

/**
 * Check if key exists in localStorage
 */
export const has = (key: string): boolean => {
    try {
        return localStorage.getItem(key) !== null;
    } catch {
        return false;
    }
};

/**
 * Clear all app-related localStorage keys
 * Only clears keys defined in STORAGE_KEYS
 */
export const clearAppStorage = (): number => {
    let cleared = 0;
    Object.values(STORAGE_KEYS).forEach(key => {
        try {
            if (localStorage.getItem(key) !== null) {
                localStorage.removeItem(key);
                cleared++;
            }
        } catch {
            // Ignore errors during clear
        }
    });
    return cleared;
};

/**
 * Get storage usage statistics
 */
export const getStorageStats = (): StorageStats => {
    try {
        let used = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key ?? '');
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
    } catch {
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
