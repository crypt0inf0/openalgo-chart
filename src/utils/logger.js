/**
 * Logging Utility - Provides environment-aware logging
 * Logs are suppressed in production builds to improve performance and reduce noise
 */

// Determine if we're in development mode
const isDev = import.meta.env?.DEV ?? process.env.NODE_ENV !== 'production';

// Log levels
export const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
};

// Human-readable labels for UI
export const LOG_LEVEL_LABELS = {
    [LOG_LEVELS.DEBUG]: 'Debug (All logs)',
    [LOG_LEVELS.INFO]: 'Info',
    [LOG_LEVELS.WARN]: 'Warnings only',
    [LOG_LEVELS.ERROR]: 'Errors only',
    [LOG_LEVELS.NONE]: 'None (Silent)'
};

// Get initial log level from localStorage or use default
const getInitialLogLevel = () => {
    try {
        const saved = localStorage.getItem('oa_log_level');
        if (saved !== null) {
            const parsed = parseInt(saved, 10);
            if (!isNaN(parsed) && parsed >= 0 && parsed <= 4) {
                return parsed;
            }
        }
    } catch {
        // localStorage might not be available
    }
    // Default: DEBUG in dev, WARN in production
    return isDev ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN;
};

// Current log level - mutable for runtime changes
let currentLevel = getInitialLogLevel();

/**
 * Set the current log level
 */
export const setLogLevel = (level) => {
    if (level >= LOG_LEVELS.DEBUG && level <= LOG_LEVELS.NONE) {
        currentLevel = level;
        try {
            localStorage.setItem('oa_log_level', level.toString());
        } catch {
            // localStorage might not be available
        }
        // Log the change at info level (will show unless NONE)
        if (level < LOG_LEVELS.NONE) {
            console.log(`[Logger] Log level set to: ${LOG_LEVEL_LABELS[level]}`);
        }
    }
};

/**
 * Get the current log level
 */
export const getLogLevel = () => currentLevel;

/**
 * Logger object with methods for different log levels
 */
export const logger = {
    /**
     * Debug logs - only shown in development
     */
    debug: (...args) => {
        if (currentLevel <= LOG_LEVELS.DEBUG) {
            console.log(...args);
        }
    },

    /**
     * Info logs - shown in development and when explicitly enabled
     */
    info: (...args) => {
        if (currentLevel <= LOG_LEVELS.INFO) {
            console.log(...args);
        }
    },

    /**
     * Warning logs - shown in development and production
     */
    warn: (...args) => {
        if (currentLevel <= LOG_LEVELS.WARN) {
            console.warn(...args);
        }
    },

    /**
     * Error logs - always shown
     */
    error: (...args) => {
        if (currentLevel <= LOG_LEVELS.ERROR) {
            console.error(...args);
        }
    },

    /**
     * Group start - only in development
     */
    group: (label) => {
        if (currentLevel <= LOG_LEVELS.DEBUG) {
            console.group(label);
        }
    },

    /**
     * Group end - only in development
     */
    groupEnd: () => {
        if (currentLevel <= LOG_LEVELS.DEBUG) {
            console.groupEnd();
        }
    }
};

// For backwards compatibility and easier refactoring
export default logger;
