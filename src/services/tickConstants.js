/**
 * Tick Data Service Constants
 * WebSocket modes and configuration
 */

// WebSocket modes
export const WS_MODES = {
    LTP: 1,
    QUOTE: 2,
    TICK: 3,  // Full tick data with trade direction
};

// Default WebSocket host
export const DEFAULT_WS_HOST = '127.0.0.1:8765';

// Maximum reconnect attempts
export const MAX_RECONNECT_ATTEMPTS = 5;

// Base reconnect delay in milliseconds
export const BASE_RECONNECT_DELAY_MS = 1000;

// Maximum reconnect delay in milliseconds
export const MAX_RECONNECT_DELAY_MS = 10000;

export default {
    WS_MODES,
    DEFAULT_WS_HOST,
    MAX_RECONNECT_ATTEMPTS,
    BASE_RECONNECT_DELAY_MS,
    MAX_RECONNECT_DELAY_MS,
};
