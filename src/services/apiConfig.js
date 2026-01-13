/**
 * API Configuration Service
 * URL configuration and utilities for OpenAlgo API
 */

import { getString, STORAGE_KEYS } from './storageService';

const DEFAULT_HOST = 'http://127.0.0.1:5000';
const DEFAULT_WS_HOST = '127.0.0.1:8765';

/**
 * Get Host URL from localStorage settings or use default
 */
export const getHostUrl = () => {
    return getString(STORAGE_KEYS.OA_HOST_URL, DEFAULT_HOST);
};

/**
 * Check if we should use the Vite proxy (when using default localhost settings)
 * This avoids CORS issues during development
 */
export const shouldUseProxy = () => {
    const hostUrl = getHostUrl();
    // Use proxy when host is default localhost and we're running on localhost
    const isDefaultHost = hostUrl === DEFAULT_HOST || hostUrl === 'http://localhost:5000' || hostUrl === 'http://127.0.0.1:5000';
    const isLocalDev = typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    return isDefaultHost && isLocalDev;
};

/**
 * Get API Base URL
 * Returns relative path for proxy when in dev mode with default host
 * Returns full URL when using custom host
 */
export const getApiBase = () => {
    if (shouldUseProxy()) {
        return '/api/v1';  // Use Vite proxy
    }
    return `${getHostUrl()}/api/v1`;
};

/**
 * Get Login URL
 */
export const getLoginUrl = () => {
    return `${getHostUrl()}/auth/login`;
};

/**
 * Get WebSocket URL from localStorage settings or use default
 * Auto-detects protocol (ws/wss) based on page protocol
 * Uses Vite proxy in development for localhost
 */
export const getWebSocketUrl = () => {
    const wsHost = getString(STORAGE_KEYS.OA_WS_URL, DEFAULT_WS_HOST);

    // Check if we're in local development with default WebSocket host
    const isDefaultWsHost = wsHost === DEFAULT_WS_HOST || wsHost === '127.0.0.1:8765' || wsHost === 'localhost:8765';
    const isLocalDev = typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    // Use Vite proxy in development for localhost
    if (isDefaultWsHost && isLocalDev) {
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        return `${protocol}://${window.location.host}/ws`;
    }

    // For custom hosts, auto-detect protocol based on page protocol
    const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const protocol = isSecure ? 'wss' : 'ws';
    return `${protocol}://${wsHost}`;
};

/**
 * Check if user is authenticated with OpenAlgo
 * OpenAlgo stores API key in localStorage after login
 */
export const checkAuth = async () => {
    try {
        // Check if API key exists in localStorage (set by OpenAlgo after login)
        const apiKey = getString(STORAGE_KEYS.OA_API_KEY, '');

        if (!apiKey || apiKey.trim() === '') {
            // No API key means not logged in
            return false;
        }

        // API key exists, user is authenticated
        return true;
    } catch (error) {
        console.error('Auth check failed:', error);
        return false;
    }
};

/**
 * Get API key from localStorage (set by OpenAlgo after login)
 */
export const getApiKey = () => {
    return getString(STORAGE_KEYS.OA_API_KEY, '');
};

/**
 * Convert chart interval to OpenAlgo API format
 * Chart uses: 1d, 1w, 1M
 * OpenAlgo uses: D, W, M for daily/weekly/monthly
 */
export const convertInterval = (interval) => {
    const mapping = {
        '1d': 'D',
        '1w': 'W',
        '1M': 'M',
        'D': 'D',
        'W': 'W',
        'M': 'M',
    };
    return mapping[interval] || interval;
};

// Export defaults for use in other modules
export { DEFAULT_HOST, DEFAULT_WS_HOST };
