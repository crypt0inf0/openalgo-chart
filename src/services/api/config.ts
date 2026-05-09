/**
 * API Configuration Service
 * URL configuration and utilities for OpenAlgo API
 */

import { getString, STORAGE_KEYS } from '../storageService';
import logger from '@/utils/logger';

const DEFAULT_HOST = 'http://127.0.0.1:5000';
const DEFAULT_WS_HOST = '127.0.0.1:8765';

/**
 * Get Host URL from localStorage settings or use default
 */
export const getHostUrl = (): string => {
  return getString(STORAGE_KEYS.OA_HOST_URL, DEFAULT_HOST);
};

/**
 * Check if we should use the Vite proxy (when using default localhost settings)
 * This avoids CORS issues during development
 */
export const shouldUseProxy = (): boolean => {
  const hostUrl = getHostUrl();
  const isDefaultHost =
    hostUrl === DEFAULT_HOST ||
    hostUrl === 'http://localhost:5000' ||
    hostUrl === 'http://127.0.0.1:5000';
  const isLocalDev =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');
  return isDefaultHost && isLocalDev;
};

/**
 * Get API Base URL
 * Returns relative path for proxy when in dev mode with default host
 * Returns full URL when using custom host
 */
export const getApiBase = (): string => {
  if (shouldUseProxy()) {
    return '/api/v1';
  }
  return `${getHostUrl()}/api/v1`;
};

/**
 * Get Login URL
 */
export const getLoginUrl = (): string => {
  return `${getHostUrl()}/auth/login`;
};

/**
 * Get WebSocket URL from localStorage settings or use default
 * Auto-detects protocol (ws/wss) based on page protocol
 * Uses Vite proxy in development for localhost
 */
export const getWebSocketUrl = (): string => {
  const wsHost = getString(STORAGE_KEYS.OA_WS_URL, DEFAULT_WS_HOST);

  const isDefaultWsHost =
    wsHost === DEFAULT_WS_HOST ||
    wsHost === '127.0.0.1:8765' ||
    wsHost === 'localhost:8765';
  const isLocalDev =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');

  if (isDefaultWsHost && isLocalDev) {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${window.location.host}/ws`;
  }

  if (wsHost.startsWith('wss://') || wsHost.startsWith('ws://')) {
    return wsHost;
  }

  const isSecure =
    typeof window !== 'undefined' && window.location.protocol === 'https:';
  const protocol = isSecure ? 'wss' : 'ws';
  return `${protocol}://${wsHost}`;
};

/**
 * Fetch the API key from the Flask session (only works when served under /chart by Flask).
 * Returns the key string on success, null otherwise.
 */
export const fetchApiKeyFromServer = async (): Promise<string | null> => {
  try {
    const response = await fetch('/chart/config');
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data.api_key === 'string' ? data.api_key : null;
  } catch {
    return null;
  }
};

/**
 * Check if user is authenticated with OpenAlgo.
 * First tries to auto-fetch the API key from the Flask session, then falls
 * back to the key stored in localStorage (e.g. manual entry in dev mode).
 */
export const checkAuth = async (): Promise<boolean> => {
  try {
    const serverKey = await fetchApiKeyFromServer();
    if (serverKey) {
      localStorage.setItem(STORAGE_KEYS.OA_API_KEY, serverKey);
      return true;
    }
    const apiKey = getString(STORAGE_KEYS.OA_API_KEY, '');
    return apiKey.trim() !== '';
  } catch (error) {
    logger.error('[ApiConfig] Auth check failed:', error);
    return false;
  }
};

/**
 * Get API key from localStorage (set by OpenAlgo after login)
 */
export const getApiKey = (): string => {
  return getString(STORAGE_KEYS.OA_API_KEY, '');
};

/**
 * Convert chart interval to OpenAlgo API format
 */
export const convertInterval = (interval: string): string => {
  const mapping: Record<string, string> = {
    '1d': 'D',
    '1w': 'W',
    '1M': 'M',
    D: 'D',
    W: 'W',
    M: 'M',
  };
  return mapping[interval] ?? interval;
};

export { DEFAULT_HOST, DEFAULT_WS_HOST };
