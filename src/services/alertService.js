/**
 * Alert Persistence Service
 * Handles loading and saving of alerts to localStorage
 *
 * Supports two storage formats:
 * 1. Per-symbol keys: tv_alerts_SYMBOL_EXCHANGE (legacy)
 * 2. Consolidated: tv_chart_alerts with nested {symbol:exchange: alerts} (preferred)
 */

import { STORAGE_KEYS } from '../constants/storageKeys';

// Storage key for consolidated chart alerts
const CHART_ALERTS_KEY = STORAGE_KEYS.CHART_ALERTS;

/**
 * Get storage key for a symbol
 * @param {string} symbol - Symbol name
 * @param {string} exchange - Exchange name
 * @returns {string} Combined key
 */
const getSymbolKey = (symbol, exchange) => {
    return `${symbol}:${exchange || 'NSE'}`;
};

/**
 * Load alerts for a symbol from localStorage
 * Checks consolidated storage first, then falls back to per-symbol storage
 * @param {string} symbol - Symbol name
 * @param {string} exchange - Exchange name
 * @returns {Array} Array of alerts
 */
export const loadAlertsForSymbol = (symbol, exchange) => {
    if (!symbol) return [];

    try {
        // Try consolidated storage first
        const stored = localStorage.getItem(CHART_ALERTS_KEY);
        if (stored) {
            const allAlerts = JSON.parse(stored);
            const key = getSymbolKey(symbol, exchange);
            const alerts = allAlerts[key] || [];
            if (alerts.length > 0) {
                console.log('[Alerts] Loaded', alerts.length, 'alerts for', key);
                return alerts;
            }
        }
    } catch (error) {
        console.warn('[Alerts] Failed to load alerts for', symbol, error);
    }

    return [];
};

/**
 * Save alerts for a symbol to localStorage
 * Uses consolidated storage format
 * @param {string} symbol - Symbol name
 * @param {string} exchange - Exchange name
 * @param {Array} alerts - Array of alerts to save
 */
export const saveAlertsForSymbol = (symbol, exchange, alerts) => {
    if (!symbol || !alerts) return;

    try {
        const key = getSymbolKey(symbol, exchange);
        const stored = JSON.parse(localStorage.getItem(CHART_ALERTS_KEY) || '{}');
        stored[key] = alerts;
        localStorage.setItem(CHART_ALERTS_KEY, JSON.stringify(stored));
        console.log('[Alerts] Saved', alerts.length, 'alerts for', key);
    } catch (error) {
        console.warn('[Alerts] Failed to save alerts for', symbol, error);
    }
};

/**
 * Get all alerts from storage
 * @returns {Object} Object with symbol keys and alert arrays
 */
export const getAllAlerts = () => {
    try {
        const stored = localStorage.getItem(CHART_ALERTS_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (error) {
        console.warn('[Alerts] Failed to load all alerts:', error);
        return {};
    }
};

/**
 * Clear alerts for a symbol
 * @param {string} symbol - Symbol name
 * @param {string} exchange - Exchange name
 */
export const clearAlertsForSymbol = (symbol, exchange) => {
    if (!symbol) return;

    try {
        const key = getSymbolKey(symbol, exchange);
        const stored = JSON.parse(localStorage.getItem(CHART_ALERTS_KEY) || '{}');
        delete stored[key];
        localStorage.setItem(CHART_ALERTS_KEY, JSON.stringify(stored));
        console.log('[Alerts] Cleared alerts for', key);
    } catch (error) {
        console.warn('[Alerts] Failed to clear alerts for', symbol, error);
    }
};
