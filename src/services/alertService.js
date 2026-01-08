/**
 * Alert Persistence Service
 * Handles loading and saving of alerts to localStorage
 */

const STORAGE_KEY_PREFIX = 'tv_alerts_';

export const loadAlertsForSymbol = (symbol, exchange) => {
    try {
        const key = `${STORAGE_KEY_PREFIX}${symbol}_${exchange}`;
        const stored = localStorage.getItem(key);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.warn('Failed to load alerts for', symbol, error);
    }
    return [];
};

export const saveAlertsForSymbol = (symbol, exchange, alerts) => {
    try {
        const key = `${STORAGE_KEY_PREFIX}${symbol}_${exchange}`;
        localStorage.setItem(key, JSON.stringify(alerts));
    } catch (error) {
        console.warn('Failed to save alerts for', symbol, error);
    }
};
