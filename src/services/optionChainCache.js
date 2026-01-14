/**
 * Option Chain Cache Module
 * Handles caching to reduce API calls and avoid rate limits
 */

// ==================== OPTION CHAIN CACHE ====================
const optionChainCache = new Map();
const CACHE_TTL_MS = 300000; // 5 minutes cache
const MAX_OPTION_CHAIN_CACHE_SIZE = 50; // Max entries to prevent memory leaks
const STORAGE_KEY = 'optionChainCache';

// Negative cache for symbols that don't support F&O
const noFOSymbolsCache = new Set();
const NO_FO_STORAGE_KEY = 'noFOSymbolsCache';
const NO_FO_CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Rate limit protection
let lastApiCallTime = 0;
const MIN_API_INTERVAL_MS = 5000; // 5 seconds between API calls

// ==================== EXPIRY CACHE ====================
const expiryCache = new Map();
const EXPIRY_CACHE_TTL_MS = 300000; // 5 minutes cache
const MAX_EXPIRY_CACHE_SIZE = 30;
const EXPIRY_STORAGE_KEY = 'expiryCache';

/**
 * Generate cache key from underlying and expiry
 */
export const getCacheKey = (underlying, expiry) => `${underlying}_${expiry || 'default'}`;

/**
 * Generate expiry cache key
 */
export const getExpiryCacheKey = (underlying, exchange, instrumenttype) =>
    `${underlying}_${exchange}_${instrumenttype}`;

/**
 * Check if cache entry is still valid
 */
export const isCacheValid = (cacheEntry, ttl = CACHE_TTL_MS) => {
    if (!cacheEntry) return false;
    return Date.now() - cacheEntry.timestamp < ttl;
};

/**
 * Evict oldest entries from cache using LRU-like eviction
 */
export const evictOldestEntries = (cache, maxSize) => {
    if (cache.size <= maxSize) return;

    const entries = Array.from(cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = entries.slice(0, cache.size - maxSize);
    toRemove.forEach(([key]) => cache.delete(key));
    console.log('[OptionChainCache] Evicted', toRemove.length, 'old cache entries');
};

// ==================== NO F&O CACHE ====================

/**
 * Load negative cache from localStorage
 */
export const loadNoFOCacheFromStorage = () => {
    try {
        const stored = localStorage.getItem(NO_FO_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            const now = Date.now();
            Object.entries(parsed).forEach(([symbol, timestamp]) => {
                if (now - timestamp < NO_FO_CACHE_DURATION_MS) {
                    noFOSymbolsCache.add(symbol);
                }
            });
            console.log('[OptionChainCache] Loaded', noFOSymbolsCache.size, 'non-F&O symbols from cache');
        }
    } catch (e) {
        console.warn('[OptionChainCache] Failed to load no-F&O cache:', e.message);
    }
};

/**
 * Save negative cache to localStorage
 */
export const saveNoFOCacheToStorage = () => {
    try {
        const now = Date.now();
        const obj = {};
        noFOSymbolsCache.forEach(symbol => {
            obj[symbol] = now;
        });
        localStorage.setItem(NO_FO_STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
        console.warn('[OptionChainCache] Failed to save no-F&O cache:', e.message);
    }
};

/**
 * Check if symbol is known to not support F&O
 */
export const isNonFOSymbol = (symbol) => noFOSymbolsCache.has(symbol?.toUpperCase());

/**
 * Mark a symbol as not supporting F&O
 */
export const markAsNonFOSymbol = (symbol) => {
    const upperSymbol = symbol?.toUpperCase();
    if (upperSymbol) {
        noFOSymbolsCache.add(upperSymbol);
        saveNoFOCacheToStorage();
        console.log('[OptionChainCache] Marked as non-F&O symbol:', upperSymbol);
    }
};

// ==================== OPTION CHAIN CACHE ====================

/**
 * Load option chain cache from localStorage
 */
export const loadCacheFromStorage = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            Object.entries(parsed).forEach(([key, value]) => {
                optionChainCache.set(key, value);
            });
            console.log('[OptionChainCache] Loaded', optionChainCache.size, 'cache entries from storage');
        }
    } catch (e) {
        console.warn('[OptionChainCache] Failed to load cache from storage:', e.message);
    }
};

/**
 * Save option chain cache to localStorage
 */
export const saveCacheToStorage = () => {
    try {
        const obj = Object.fromEntries(optionChainCache);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
        console.warn('[OptionChainCache] Failed to save cache to storage:', e.message);
    }
};

/**
 * Get cached option chain data
 */
export const getOptionChainFromCache = (cacheKey) => {
    return optionChainCache.get(cacheKey);
};

/**
 * Set option chain data in cache
 */
export const setOptionChainInCache = (cacheKey, data) => {
    evictOldestEntries(optionChainCache, MAX_OPTION_CHAIN_CACHE_SIZE - 1);
    optionChainCache.set(cacheKey, {
        data,
        timestamp: Date.now()
    });
    saveCacheToStorage();
    console.log('[OptionChainCache] Cached data for:', cacheKey);
};

/**
 * Clear option chain cache
 */
export const clearOptionChainCache = (underlying = null, expiry = null) => {
    if (underlying && expiry) {
        const key = getCacheKey(underlying, expiry);
        optionChainCache.delete(key);
        console.log('[OptionChainCache] Cache cleared for:', key);
    } else if (underlying) {
        for (const key of optionChainCache.keys()) {
            if (key.startsWith(underlying + '_')) {
                optionChainCache.delete(key);
            }
        }
        console.log('[OptionChainCache] Cache cleared for underlying:', underlying);
    } else {
        optionChainCache.clear();
        console.log('[OptionChainCache] Full cache cleared');
    }
    saveCacheToStorage();
};

// ==================== EXPIRY CACHE ====================

/**
 * Load expiry cache from localStorage
 */
export const loadExpiryCacheFromStorage = () => {
    try {
        const stored = localStorage.getItem(EXPIRY_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            Object.entries(parsed).forEach(([key, value]) => {
                expiryCache.set(key, value);
            });
            console.log('[OptionChainCache] Loaded', expiryCache.size, 'expiry cache entries');
        }
    } catch (e) {
        console.warn('[OptionChainCache] Failed to load expiry cache:', e.message);
    }
};

/**
 * Save expiry cache to localStorage
 */
export const saveExpiryCacheToStorage = () => {
    try {
        const obj = Object.fromEntries(expiryCache);
        localStorage.setItem(EXPIRY_STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
        console.warn('[OptionChainCache] Failed to save expiry cache:', e.message);
    }
};

/**
 * Get cached expiry data
 */
export const getExpiryFromCache = (cacheKey) => {
    return expiryCache.get(cacheKey);
};

/**
 * Set expiry data in cache
 */
export const setExpiryInCache = (cacheKey, data) => {
    evictOldestEntries(expiryCache, MAX_EXPIRY_CACHE_SIZE - 1);
    expiryCache.set(cacheKey, {
        data,
        timestamp: Date.now()
    });
    saveExpiryCacheToStorage();
    console.log('[OptionChainCache] Cached expiries for:', cacheKey);
};

// ==================== RATE LIMITING ====================

/**
 * Get time since last API call
 */
export const getTimeSinceLastApiCall = () => Date.now() - lastApiCallTime;

/**
 * Update last API call time
 */
export const updateLastApiCallTime = () => {
    lastApiCallTime = Date.now();
};

/**
 * Check if rate limit should be applied
 */
export const shouldApplyRateLimit = () => {
    return getTimeSinceLastApiCall() < MIN_API_INTERVAL_MS;
};

/**
 * Get rate limit wait time
 */
export const getRateLimitWaitTime = () => {
    return MIN_API_INTERVAL_MS - getTimeSinceLastApiCall();
};

// Export constants for use in other modules
export const CACHE_CONFIG = {
    CACHE_TTL_MS,
    MAX_OPTION_CHAIN_CACHE_SIZE,
    MIN_API_INTERVAL_MS,
    EXPIRY_CACHE_TTL_MS,
    MAX_EXPIRY_CACHE_SIZE,
};

// Initialize caches on module load
loadNoFOCacheFromStorage();
loadCacheFromStorage();
loadExpiryCacheFromStorage();

export default {
    getCacheKey,
    getExpiryCacheKey,
    isCacheValid,
    evictOldestEntries,
    isNonFOSymbol,
    markAsNonFOSymbol,
    getOptionChainFromCache,
    setOptionChainInCache,
    clearOptionChainCache,
    getExpiryFromCache,
    setExpiryInCache,
    shouldApplyRateLimit,
    getRateLimitWaitTime,
    updateLastApiCallTime,
    CACHE_CONFIG,
};
