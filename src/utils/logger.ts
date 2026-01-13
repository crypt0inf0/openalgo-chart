/**
 * Logging Utility - Provides environment-aware logging
 * Logs are suppressed in production builds to improve performance and reduce noise
 */

// Determine if we're in development mode
const isDev = import.meta.env?.DEV ?? process.env.NODE_ENV !== 'production';

// Log level type
export type LogLevel = 0 | 1 | 2 | 3 | 4;

// Log levels - exported for UI configuration
export const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
} as const;

// Human-readable labels for UI
export const LOG_LEVEL_LABELS: Record<LogLevel, string> = {
    [LOG_LEVELS.DEBUG]: 'Debug (All logs)',
    [LOG_LEVELS.INFO]: 'Info',
    [LOG_LEVELS.WARN]: 'Warnings only',
    [LOG_LEVELS.ERROR]: 'Errors only',
    [LOG_LEVELS.NONE]: 'None (Silent)'
};

// Get initial log level from localStorage or use default
const getInitialLogLevel = (): LogLevel => {
    try {
        const saved = localStorage.getItem('oa_log_level');
        if (saved !== null) {
            const parsed = parseInt(saved, 10);
            if (!isNaN(parsed) && parsed >= 0 && parsed <= 4) {
                return parsed as LogLevel;
            }
        }
    } catch {
        // localStorage might not be available
    }
    // Default: DEBUG in dev, WARN in production
    return isDev ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN;
};

// Current log level - mutable for runtime changes
let currentLevel: LogLevel = getInitialLogLevel();

/**
 * Set the current log level
 */
export const setLogLevel = (level: LogLevel): void => {
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
export const getLogLevel = (): LogLevel => currentLevel;

/**
 * Logger interface
 */
export interface Logger {
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    group: (label: string) => void;
    groupEnd: () => void;
}

/**
 * Logger object with methods for different log levels
 */
export const logger: Logger = {
    /**
     * Debug logs - only shown in development
     */
    debug: (...args: unknown[]): void => {
        if (currentLevel <= LOG_LEVELS.DEBUG) {
            console.log(...args);
        }
    },

    /**
     * Info logs - shown in development and when explicitly enabled
     */
    info: (...args: unknown[]): void => {
        if (currentLevel <= LOG_LEVELS.INFO) {
            console.log(...args);
        }
    },

    /**
     * Warning logs - shown in development and production
     */
    warn: (...args: unknown[]): void => {
        if (currentLevel <= LOG_LEVELS.WARN) {
            console.warn(...args);
        }
    },

    /**
     * Error logs - always shown
     */
    error: (...args: unknown[]): void => {
        if (currentLevel <= LOG_LEVELS.ERROR) {
            console.error(...args);
        }
    },

    /**
     * Group start - only in development
     */
    group: (label: string): void => {
        if (currentLevel <= LOG_LEVELS.DEBUG) {
            console.group(label);
        }
    },

    /**
     * Group end - only in development
     */
    groupEnd: (): void => {
        if (currentLevel <= LOG_LEVELS.DEBUG) {
            console.groupEnd();
        }
    }
};

// For backwards compatibility and easier refactoring
export default logger;
