import { useState, useEffect, useRef } from 'react';
import openalgo from '../services/openalgo';
import logger from '../utils/logger';

// Debounce delay in milliseconds (2 seconds for quicker UX)
const SYNC_DEBOUNCE_DELAY = 2000;

// Timeout for initial cloud sync fetch (5 seconds)
const CLOUD_FETCH_TIMEOUT = 5000;

// Keys to sync - all chart settings
const SYNC_KEYS = [
    'tv_saved_layout',       // Chart layout with indicators, symbol, interval per chart
    'tv_watchlists',         // Watchlists
    'tv_theme',              // Theme (dark/light)
    'tv_fav_intervals_v2',   // Favorite intervals
    'tv_custom_intervals',   // Custom intervals
    'tv_drawing_defaults',   // Drawing tool defaults
    'tv_alerts',             // Alerts
    'tv_alert_logs',         // Alert logs
    'tv_last_nonfav_interval', // Last non-favorite interval
    'tv_interval',           // Current interval/timeframe
    'tv_chart_appearance',   // Chart appearance (colors, candle style)
    'tv_drawing_templates',  // Drawing templates
    'tv_template_favorites', // Template favorites
    'tv_symbol_favorites',   // Symbol favorites
    'tv_recent_symbols',     // Recent symbols
    'tv_layout_templates',   // Layout templates
    'tv_favorite_drawing_tools', // Favorite drawing tools
    'tv_floating_toolbar_pos', // Floating toolbar position
    'tv_recent_commands',    // Recent commands
    'oa_session_break_visible', // Session break visibility setting
    'oa_timer_visible'       // Timer visibility setting
];

/**
 * Hook to manage Cloud Workspace Synchronization
 * - Blocks rendering until cloud sync is complete (or timeout) for authenticated users
 * - For non-authenticated users, allows immediate render
 * - Auto-saves changes to backend after 5s of inactivity
 * - Tracks which auth state we've loaded for to prevent flash during transitions
 * 
 * @param {boolean|null} isAuthenticated - null=checking, false=not auth, true=authenticated
 * @returns {{ isLoaded: boolean, isSyncing: boolean, syncKey: number }}
 */
export const useCloudWorkspaceSync = (isAuthenticated) => {
    // Track which auth state we've completed loading for
    // This prevents flash during auth transitions
    // Uses a special 'uninitialized' symbol to distinguish from null/false/true
    const [loadedForAuth, setLoadedForAuth] = useState('uninitialized');
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncKey, setSyncKey] = useState(0); // Increment to force AppContent remount

    // Store last SAVED state (confirmed by server)
    const lastSavedState = useRef({});
    // Store pending changes (scheduled but not yet saved)
    const pendingChanges = useRef({});
    const saveTimeoutRef = useRef(null);
    const hasLoadedFromServer = useRef(false);

    // Derive isLoaded from whether we've loaded for the CURRENT auth state
    // - When auth is still checking (null), isLoaded = false
    // - When loadedForAuth matches isAuthenticated (false or true), isLoaded = true
    // - During transitions, they won't match, so isLoaded = false
    const isLoaded = isAuthenticated !== null && loadedForAuth === isAuthenticated;

    // Initial Load - handles different auth states
    useEffect(() => {
        // Auth is still being checked - keep blocking
        if (isAuthenticated === null) {
            logger.debug('[CloudSync] Auth checking, waiting...');
            // Don't change loadedForAuth - stay in loading state
            return;
        }

        // Not authenticated - no cloud sync needed, show auth screen
        if (isAuthenticated === false) {
            logger.debug('[CloudSync] Not authenticated, skipping cloud sync');
            setLoadedForAuth(false);
            return;
        }

        // Already loaded from server, don't reload
        if (hasLoadedFromServer.current) {
            logger.debug('[CloudSync] Already loaded from server, skipping');
            setLoadedForAuth(true);
            return;
        }

        // Check if preferences were already loaded during login validation
        // This flag is set by ApiKeyDialog when it saves preferences from the validation response
        const cloudSyncDone = localStorage.getItem('_cloud_sync_done');
        if (cloudSyncDone === 'true') {
            logger.info('[CloudSync] Preferences already loaded during login, skipping fetch');
            // Clear the flag for future sessions
            localStorage.removeItem('_cloud_sync_done');
            hasLoadedFromServer.current = true;
            // Initialize lastSavedState with current localStorage
            SYNC_KEYS.forEach(key => {
                lastSavedState.current[key] = localStorage.getItem(key);
            });
            setLoadedForAuth(true);
            return;
        }

        // Authenticated - fetch cloud data before allowing render
        // IMPORTANT: Don't set loadedForAuth here - stay in loading state until sync completes
        hasLoadedFromServer.current = true;
        logger.info('[CloudSync] User authenticated, loading preferences from server...');

        let isCancelled = false;
        let timeoutId = null;

        const loadPreferences = async () => {
            try {
                // Create a fetch promise with timeout
                const fetchPromise = openalgo.fetchUserPreferences();
                const timeoutPromise = new Promise((resolve) => {
                    timeoutId = setTimeout(() => {
                        if (!isCancelled) {
                            logger.warn(`[CloudSync] Fetch timeout (${CLOUD_FETCH_TIMEOUT / 1000}s), proceeding with local state`);
                            resolve({ data: null, invalidApiKey: false, timeout: true });
                        }
                    }, CLOUD_FETCH_TIMEOUT);
                });

                // Race between fetch and timeout
                const result = await Promise.race([fetchPromise, timeoutPromise]);

                // Clear timeout if fetch won the race
                if (timeoutId) clearTimeout(timeoutId);
                isCancelled = true;

                logger.debug('[CloudSync] Server response:', result);

                // If API key is invalid, just log it and proceed with local state
                // (Upfront validation on login page handles the main validation)
                if (result.invalidApiKey) {
                    logger.warn('[CloudSync] Invalid API key detected, using local state');
                }

                const prefs = result.data;
                if (prefs && typeof prefs === 'object' && Object.keys(prefs).length > 0) {
                    // Apply cloud data to localStorage BEFORE allowing render
                    let appliedCount = 0;
                    Object.entries(prefs).forEach(([key, value]) => {
                        try {
                            if (value !== null && value !== undefined) {
                                localStorage.setItem(key, value);
                                lastSavedState.current[key] = value;
                                appliedCount++;
                            }
                        } catch (e) {
                            logger.error(`[CloudSync] Error applying key ${key}:`, e);
                        }
                    });

                    // Populate global cache for loadDrawings to use (avoids duplicate API calls)
                    if (!window._chartPrefsCache) window._chartPrefsCache = {};
                    Object.assign(window._chartPrefsCache, prefs);

                    logger.info(`[CloudSync] Applied ${appliedCount} preferences from cloud.`);
                    // Increment syncKey to force AppContent remount with new localStorage data
                    setSyncKey(prev => prev + 1);
                } else {
                    // No cloud data or timeout - use local state
                    logger.info('[CloudSync] No cloud preferences, using local state.');
                    SYNC_KEYS.forEach(key => {
                        lastSavedState.current[key] = localStorage.getItem(key);
                    });
                }
            } catch (error) {
                logger.error('[CloudSync] Failed to load preferences:', error);
                // Initialize lastSavedState with current localStorage
                SYNC_KEYS.forEach(key => {
                    lastSavedState.current[key] = localStorage.getItem(key);
                });
            }

            // Now allow AppContent to mount - localStorage is ready
            logger.info('[CloudSync] Cloud sync complete, allowing render');
            setLoadedForAuth(true);
        };

        loadPreferences();
    }, [isAuthenticated]);

    // Watcher for changes (Auto-Save) - only when authenticated and loaded
    useEffect(() => {
        if (isAuthenticated !== true || !isLoaded) return;

        const checkForChanges = () => {
            const newChanges = {};
            let hasNewChanges = false;

            SYNC_KEYS.forEach(key => {
                const currentValue = localStorage.getItem(key);
                const lastValue = lastSavedState.current[key];

                // Check if this key has changed from last saved state
                if (currentValue !== lastValue) {
                    // Ignore both null/undefined cases
                    if (currentValue == null && lastValue == null) return;

                    newChanges[key] = currentValue || "";
                    hasNewChanges = true;
                }
            });

            if (hasNewChanges) {
                // Check if these are different from pending changes
                const pendingKeys = Object.keys(pendingChanges.current).sort().join(',');
                const newKeys = Object.keys(newChanges).sort().join(',');
                const isDifferentFromPending = pendingKeys !== newKeys;

                if (isDifferentFromPending || !saveTimeoutRef.current) {
                    logger.debug('[CloudSync] New changes detected:', Object.keys(newChanges));

                    // Update pending changes
                    pendingChanges.current = { ...newChanges };

                    // Clear existing timeout only if we have new/different changes
                    if (saveTimeoutRef.current) {
                        clearTimeout(saveTimeoutRef.current);
                    }

                    // Schedule new save
                    saveTimeoutRef.current = setTimeout(async () => {
                        const toSave = { ...pendingChanges.current };
                        logger.info('[CloudSync] Executing auto-save for keys:', Object.keys(toSave));

                        setIsSyncing(true);
                        try {
                            const success = await openalgo.saveUserPreferences(toSave);
                            if (success) {
                                // Update last saved state
                                Object.entries(toSave).forEach(([key, val]) => {
                                    lastSavedState.current[key] = val;
                                });
                                pendingChanges.current = {};
                                logger.info('[CloudSync] Auto-save complete!');
                            } else {
                                logger.error('[CloudSync] Auto-save returned false');
                            }
                        } catch (err) {
                            logger.error('[CloudSync] Auto-save failed:', err);
                        } finally {
                            setIsSyncing(false);
                            saveTimeoutRef.current = null;
                        }
                    }, SYNC_DEBOUNCE_DELAY);
                }
                // If same pending changes, don't reset the timer - let it fire
            }
        };

        // Poll for localStorage changes every second
        const pollInterval = setInterval(checkForChanges, 1000);

        return () => {
            clearInterval(pollInterval);
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, [isAuthenticated, isLoaded]);

    return { isLoaded, isSyncing, syncKey };
};
