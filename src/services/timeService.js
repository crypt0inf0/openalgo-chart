/**
 * Time Service - Provides accurate IST time synced from NPL India
 * NPL (National Physical Laboratory) India is the official timekeeping authority
 * Used for candle creation and time-critical operations
 */

import { logger } from '../utils/logger.js';

// NPL India's official NTP time API - provides sub-second accuracy for IST
// Uses backend proxy to avoid CORS issues
const getNPLTimeUrl = () => {
    const clientTimestamp = Date.now() / 1000; // Current time in seconds
    // Use backend proxy endpoint to avoid CORS issues
    const { getApiBase } = require('./openalgo.js');
    const apiBase = getApiBase();
    // Remove /api/v1 from the base and use the backend's time endpoint
    const baseUrl = apiBase.replace('/api/v1', '');
    return `${baseUrl}/time?timestamp=${clientTimestamp.toFixed(3)}`;
};

const SYNC_INTERVAL_MS = 60 * 1000; // Resync every 1 minute for better accuracy
const IST_OFFSET_SECONDS = 19800; // 5 hours 30 minutes in seconds

// Store the offset between network time and local time
let timeOffset = 0;
let lastSyncTime = 0;
let isSyncing = false;
let isSynced = false; // Track if we've successfully synced at least once
let syncIntervalId = null; // Track interval for cleanup

/**
 * Fetch accurate time from NPL India's official NTP server and calculate offset
 * Response format: { id, it, ncrt, nctt, nsrt, nstt }
 * - nstt: NTP server transmit time (Unix epoch in UTC seconds)
 */
export const syncTimeWithAPI = async () => {
    if (isSyncing) return isSynced;
    isSyncing = true;

    try {
        const requestStartTime = Date.now();
        const response = await fetch(getNPLTimeUrl(), {
            headers: {
                'accept': 'application/json, text/javascript, */*; q=0.01',
                'x-requested-with': 'XMLHttpRequest'
            }
        });
        const requestEndTime = Date.now();

        if (response.ok) {
            const data = await response.json();
            // nstt is NTP server transmit time - Unix epoch timestamp in UTC seconds
            const nplTimestampUTC = data.nstt;

            if (nplTimestampUTC && Number.isFinite(nplTimestampUTC)) {
                // Account for network round-trip time (RTT/2)
                const networkLatency = (requestEndTime - requestStartTime) / 2000; // Convert to seconds
                const adjustedNplTime = nplTimestampUTC + networkLatency;

                // Compare against local UTC time (Date.now() is UTC milliseconds)
                const localTimestampUTC = Date.now() / 1000;

                // Offset = NPL time - local time (how much our clock is off from true UTC)
                const newOffset = adjustedNplTime - localTimestampUTC;

                // Only log if offset changes significantly (> 100ms) or first sync
                if (Math.abs(newOffset - timeOffset) > 0.1 || !isSynced) {
                    logger.debug('[TimeService] Synced with NPL India. Offset:', newOffset.toFixed(3), 'seconds, Latency:', (networkLatency * 1000).toFixed(0), 'ms');
                }

                timeOffset = newOffset;
                lastSyncTime = Date.now();
                isSynced = true;
                return true;
            }
        }
    } catch (error) {
        logger.warn('[TimeService] Failed to sync with NPL India:', error.message);
    } finally {
        isSyncing = false;
    }
    return false;
};

/**
 * Check if time is synced
 */
export const getIsSynced = () => isSynced;

/**
 * Get current accurate UTC timestamp in seconds
 * Uses the NPL-synced offset to correct local clock
 */
export const getAccurateUTCTimestamp = () => {
    // Local time in UTC + offset correction from NPL sync
    const localTimestampUTC = Date.now() / 1000;
    return localTimestampUTC + timeOffset;
};

/**
 * Get current accurate IST timestamp in seconds
 * Uses the NPL India synced offset for accuracy
 * This is the primary function for candle creation timing
 */
export const getAccurateISTTimestamp = () => {
    // Get accurate UTC first, then add IST offset (5h 30m)
    return getAccurateUTCTimestamp() + IST_OFFSET_SECONDS;
};

/**
 * Check if resync is needed (1 minute since last sync)
 */
export const shouldResync = () => {
    return Date.now() - lastSyncTime >= SYNC_INTERVAL_MS;
};

/**
 * Get time offset (for debugging)
 */
export const getTimeOffset = () => timeOffset;

/**
 * Initialize time service - call this on app startup
 */
export const initTimeService = async () => {
    // Prevent duplicate intervals
    if (syncIntervalId !== null) {
        return;
    }

    await syncTimeWithAPI().catch(err => logger.debug('[TimeService] Initial sync error:', err));

    // Set up periodic resync
    syncIntervalId = setInterval(() => {
        syncTimeWithAPI().catch(err => logger.debug('[TimeService] Interval sync error:', err));
    }, SYNC_INTERVAL_MS);

    console.log('[TimeService] Initialized with NPL India. Offset:', timeOffset.toFixed(3), 'seconds');
};

/**
 * Cleanup time service - call this on app shutdown
 */
export const destroyTimeService = () => {
    if (syncIntervalId !== null) {
        clearInterval(syncIntervalId);
        syncIntervalId = null;
    }
};

export default {
    syncTimeWithAPI,
    getAccurateUTCTimestamp,
    getAccurateISTTimestamp,
    shouldResync,
    getTimeOffset,
    getIsSynced,
    initTimeService,
    destroyTimeService
};
