/**
 * Global Alert Monitor Service
 * 
 * Monitors prices for all symbols with active alerts in the background.
 * Uses WebSocket subscription to get real-time price updates.
 * Triggers callbacks when price crosses alert thresholds.
 */

import { subscribeToMultiTicker } from './openalgo';
import logger from '../utils/logger';

// Must match ChartComponent.jsx storage key
const ALERT_STORAGE_KEY = 'tv_chart_alerts';
const ALERT_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * @typedef {Object} StoredAlert
 * @property {string} id - Unique alert ID
 * @property {string} symbol - Trading symbol
 * @property {string} exchange - Exchange code
 * @property {number} price - Alert price level
 * @property {string} condition - 'crossing' | 'crossing_up' | 'crossing_down'
 * @property {number} createdAt - Timestamp when alert was created
 * @property {string} [status] - 'active' | 'triggered'
 */

/**
 * @typedef {Object} AlertTriggerEvent
 * @property {string} alertId
 * @property {string} symbol
 * @property {string} exchange
 * @property {number} alertPrice
 * @property {number} currentPrice
 * @property {string} direction - 'up' | 'down'
 * @property {string} condition
 * @property {number} timestamp
 */

class GlobalAlertMonitor {
    constructor() {
        /** @type {Map<string, number>} symbol-exchange -> last price */
        this._lastPrices = new Map();

        /** @type {Map<string, 'above'|'below'|'unknown'>} alertId -> position */
        this._alertPositions = new Map();

        /** @type {any} WebSocket connection */
        this._ws = null;

        /** @type {function|null} Callback for trigger events */
        this._onTrigger = null;

        /** @type {boolean} */
        this._isRunning = false;
    }

    /**
     * Get unique symbol key for tracking
     * @param {string} symbol 
     * @param {string} exchange 
     */
    _getSymbolKey(symbol, exchange) {
        return `${symbol}:${exchange}`;
    }

    /**
     * Load all alerts from localStorage
     * @returns {StoredAlert[]}
     */
    _loadAlerts() {
        try {
            const stored = localStorage.getItem(ALERT_STORAGE_KEY);
            if (!stored) return [];

            const data = JSON.parse(stored);
            if (!data || typeof data !== 'object') return [];

            // Data format: { [symbol-exchange]: [alerts], ... }
            const allAlerts = [];
            const cutoff = Date.now() - ALERT_RETENTION_MS;

            for (const [key, alerts] of Object.entries(data)) {
                if (!Array.isArray(alerts)) continue;

                for (const alert of alerts) {
                    // Filter expired and already triggered
                    if (alert.createdAt && alert.createdAt < cutoff) continue;
                    if (alert.status === 'triggered') continue;

                    const [symbol, exchange] = key.split(':');
                    allAlerts.push({
                        ...alert,
                        symbol: symbol || alert.symbol,
                        exchange: exchange || alert.exchange || 'NSE',
                    });
                }
            }

            return allAlerts;
        } catch (error) {
            logger.error('[GlobalAlertMonitor] Error loading alerts:', error);
            return [];
        }
    }

    /**
     * Save updated alerts to localStorage
     * @param {StoredAlert[]} alerts 
     */
    _saveAlerts(alerts) {
        try {
            // Group alerts by symbol-exchange
            const grouped = {};
            for (const alert of alerts) {
                const key = this._getSymbolKey(alert.symbol, alert.exchange);
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(alert);
            }

            localStorage.setItem(ALERT_STORAGE_KEY, JSON.stringify(grouped));
        } catch (error) {
            logger.error('[GlobalAlertMonitor] Error saving alerts:', error);
        }
    }

    /**
     * Remove a triggered alert from storage
     * @param {string} alertId 
     */
    _removeAlert(alertId) {
        const alerts = this._loadAlerts().filter(a => a.id !== alertId);
        this._saveAlerts(alerts);
        this._alertPositions.delete(alertId);
    }

    /**
     * Check if price crosses alert threshold
     * @param {StoredAlert} alert 
     * @param {number} currentPrice 
     * @returns {AlertTriggerEvent|null}
     */
    _checkCrossing(alert, currentPrice) {
        const key = this._getSymbolKey(alert.symbol, alert.exchange);
        const lastPrice = this._lastPrices.get(key);

        // Need previous price to detect crossing
        if (lastPrice === undefined) return null;

        // Get or set initial position
        let position = this._alertPositions.get(alert.id);
        if (!position) {
            position = lastPrice > alert.price ? 'above' : (lastPrice < alert.price ? 'below' : 'unknown');
            this._alertPositions.set(alert.id, position);
            return null; // Don't trigger on first check
        }

        const condition = alert.condition || 'crossing';
        const alertPrice = alert.price;
        let triggered = false;
        let direction = 'up';

        // Check crossing based on condition
        const hasCrossedUp = position === 'below' && currentPrice >= alertPrice;
        const hasCrossedDown = position === 'above' && currentPrice <= alertPrice;

        if (condition === 'crossing') {
            triggered = hasCrossedUp || hasCrossedDown;
            direction = hasCrossedUp ? 'up' : 'down';
        } else if (condition === 'crossing_up') {
            triggered = hasCrossedUp;
            direction = 'up';
        } else if (condition === 'crossing_down') {
            triggered = hasCrossedDown;
            direction = 'down';
        }

        // Update position for future checks
        if (currentPrice > alertPrice) {
            this._alertPositions.set(alert.id, 'above');
        } else if (currentPrice < alertPrice) {
            this._alertPositions.set(alert.id, 'below');
        }

        if (triggered) {
            return {
                alertId: alert.id,
                symbol: alert.symbol,
                exchange: alert.exchange,
                alertPrice: alert.price,
                currentPrice,
                direction,
                condition,
                timestamp: Date.now(),
            };
        }

        return null;
    }

    /**
     * Handle incoming price update
     * @param {Object} data - { symbol, exchange, last }
     */
    _onPriceUpdate(data) {
        if (!data || !data.symbol || !data.last) return;

        const { symbol, exchange = 'NSE', last: currentPrice } = data;
        const key = this._getSymbolKey(symbol, exchange);

        // Get alerts for this symbol
        const alerts = this._loadAlerts().filter(
            a => a.symbol === symbol && (a.exchange || 'NSE') === exchange
        );

        if (alerts.length > 0) {
            console.log('[GlobalAlertMonitor] Price update', symbol, currentPrice, '- checking', alerts.length, 'alerts');
        }

        // Check each alert for crossing
        for (const alert of alerts) {
            const triggerEvent = this._checkCrossing(alert, currentPrice);

            if (triggerEvent) {
                console.log('[GlobalAlertMonitor] Alert triggered:', triggerEvent);

                // Remove the alert (one-shot)
                this._removeAlert(alert.id);

                // Fire callback
                if (this._onTrigger) {
                    this._onTrigger(triggerEvent);
                }
            }
        }

        // Update last price
        this._lastPrices.set(key, currentPrice);
    }

    /**
     * Start monitoring all symbols with active alerts
     * @param {function} onTrigger - Callback when alert triggers
     */
    start(onTrigger) {
        console.log('[GlobalAlertMonitor] start() called, isRunning:', this._isRunning);
        if (this._isRunning) {
            console.log('[GlobalAlertMonitor] Already running, skipping');
            return;
        }

        this._onTrigger = onTrigger;
        this._restart();
    }

    /**
     * Restart WebSocket with current alerts
     */
    _restart() {
        // Close existing connection
        this.stop();

        const alerts = this._loadAlerts();
        console.log('[GlobalAlertMonitor] Loaded alerts for monitoring:', alerts);
        if (alerts.length === 0) {
            console.log('[GlobalAlertMonitor] No alerts to monitor');
            return;
        }

        // Get unique symbols to subscribe
        const symbolsMap = new Map();
        for (const alert of alerts) {
            const key = this._getSymbolKey(alert.symbol, alert.exchange);
            if (!symbolsMap.has(key)) {
                symbolsMap.set(key, { symbol: alert.symbol, exchange: alert.exchange || 'NSE' });
            }
        }

        const symbols = Array.from(symbolsMap.values());

        if (symbols.length === 0) return;

        console.log('[GlobalAlertMonitor] Starting monitor for', symbols.length, 'symbols:', symbols);

        this._isRunning = true;
        this._ws = subscribeToMultiTicker(symbols, (data) => this._onPriceUpdate(data));
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (this._ws) {
            try {
                if (typeof this._ws.close === 'function') {
                    this._ws.close();
                }
            } catch (error) {
                logger.debug('[GlobalAlertMonitor] Error closing WebSocket:', error);
            }
            this._ws = null;
        }
        this._isRunning = false;
    }

    /**
     * Refresh the monitor (call when alerts change)
     */
    refresh() {
        if (this._onTrigger) {
            this._restart();
        }
    }

    /**
     * Check if monitor is running
     */
    isRunning() {
        return this._isRunning;
    }
}

// Singleton instance
export const globalAlertMonitor = new GlobalAlertMonitor();

export default globalAlertMonitor;
