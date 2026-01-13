import React, { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';
import { safeParseJSON, STORAGE_KEYS } from '../services/storageService';

const AlertContext = createContext();

/**
 * Alert retention period (24 hours)
 */
const ALERT_RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * AlertProvider - Manages all alert-related state
 * Centralizes alert data, logs, and popup management
 */
export const AlertProvider = ({ children }) => {
    // Alert price for creating new alerts
    const [alertPrice, setAlertPrice] = useState(null);

    // Active alerts with 24h retention
    const [alerts, setAlerts] = useState(() => {
        const saved = safeParseJSON(localStorage.getItem(STORAGE_KEYS.ALERTS), []);
        // Filter out expired alerts (older than 24 hours)
        const cutoff = Date.now() - ALERT_RETENTION_MS;
        return saved.filter(a => !a.triggeredAt || a.triggeredAt > cutoff);
    });

    // Ref to avoid race condition in WebSocket callback
    const alertsRef = useRef(alerts);
    useEffect(() => { alertsRef.current = alerts; }, [alerts]);

    // Alert logs with 24h retention
    const [alertLogs, setAlertLogs] = useState(() => {
        const saved = safeParseJSON(localStorage.getItem(STORAGE_KEYS.ALERT_LOGS), []);
        const cutoff = Date.now() - ALERT_RETENTION_MS;
        return saved.filter(l => !l.timestamp || l.timestamp > cutoff);
    });

    // Unread alert count for badge display
    const [unreadAlertCount, setUnreadAlertCount] = useState(0);

    // Global alert popups for background alerts
    const [globalAlertPopups, setGlobalAlertPopups] = useState([]);

    // Ref for tracking previous prices (for crossing detection)
    const alertPricesRef = useRef(new Map());

    // Persist alerts to localStorage with 24h retention
    useEffect(() => {
        const cutoff = Date.now() - ALERT_RETENTION_MS;
        const filtered = alerts.filter(a => {
            if (!a.triggeredAt) return true;
            return a.triggeredAt > cutoff;
        });
        if (filtered.length !== alerts.length) {
            setAlerts(filtered);
        }
        try {
            localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(filtered));
        } catch (error) {
            console.error('Failed to persist alerts:', error);
        }
    }, [alerts]);

    // Persist alert logs to localStorage with 24h retention
    useEffect(() => {
        const cutoff = Date.now() - ALERT_RETENTION_MS;
        const filtered = alertLogs.filter(l => {
            if (!l.timestamp) return true;
            return l.timestamp > cutoff;
        });
        if (filtered.length !== alertLogs.length) {
            setAlertLogs(filtered);
        }
        try {
            localStorage.setItem(STORAGE_KEYS.ALERT_LOGS, JSON.stringify(filtered));
        } catch (error) {
            console.error('Failed to persist alert logs:', error);
        }
    }, [alertLogs]);

    // Add a new alert
    const addAlert = useCallback((alert) => {
        setAlerts(prev => [...prev, { ...alert, createdAt: Date.now() }]);
    }, []);

    // Remove an alert by id
    const removeAlert = useCallback((alertId) => {
        setAlerts(prev => prev.filter(a => a.id !== alertId));
    }, []);

    // Update an alert
    const updateAlert = useCallback((alertId, updates) => {
        setAlerts(prev => prev.map(a =>
            a.id === alertId ? { ...a, ...updates } : a
        ));
    }, []);

    // Mark alert as triggered
    const triggerAlert = useCallback((alertId) => {
        setAlerts(prev => prev.map(a =>
            a.id === alertId ? { ...a, triggered: true, triggeredAt: Date.now() } : a
        ));
    }, []);

    // Add log entry
    const addAlertLog = useCallback((log) => {
        setAlertLogs(prev => [...prev, { ...log, timestamp: Date.now() }]);
    }, []);

    // Clear all logs
    const clearAlertLogs = useCallback(() => {
        setAlertLogs([]);
    }, []);

    // Add a global popup alert
    const addGlobalPopup = useCallback((popup) => {
        const id = Date.now() + Math.random();
        setGlobalAlertPopups(prev => [...prev, { ...popup, id }]);
        return id;
    }, []);

    // Remove a global popup alert
    const removeGlobalPopup = useCallback((popupId) => {
        setGlobalAlertPopups(prev => prev.filter(p => p.id !== popupId));
    }, []);

    // Clear all global popups
    const clearGlobalPopups = useCallback(() => {
        setGlobalAlertPopups([]);
    }, []);

    // Mark all alerts as read
    const markAllAlertsRead = useCallback(() => {
        setUnreadAlertCount(0);
    }, []);

    // Increment unread count
    const incrementUnreadCount = useCallback(() => {
        setUnreadAlertCount(prev => prev + 1);
    }, []);

    // Get active alerts (not triggered)
    const getActiveAlerts = useCallback(() => {
        return alerts.filter(a => !a.triggered && a.status === 'Active');
    }, [alerts]);

    // Get triggered alerts
    const getTriggeredAlerts = useCallback(() => {
        return alerts.filter(a => a.triggered);
    }, [alerts]);

    // Get alerts for a specific symbol
    const getAlertsForSymbol = useCallback((symbol) => {
        return alerts.filter(a => a.symbol === symbol);
    }, [alerts]);

    const value = {
        // Alert price
        alertPrice,
        setAlertPrice,

        // Alerts
        alerts,
        setAlerts,
        alertsRef,
        addAlert,
        removeAlert,
        updateAlert,
        triggerAlert,
        getActiveAlerts,
        getTriggeredAlerts,
        getAlertsForSymbol,

        // Alert logs
        alertLogs,
        setAlertLogs,
        addAlertLog,
        clearAlertLogs,

        // Unread count
        unreadAlertCount,
        setUnreadAlertCount,
        markAllAlertsRead,
        incrementUnreadCount,

        // Global popups
        globalAlertPopups,
        setGlobalAlertPopups,
        addGlobalPopup,
        removeGlobalPopup,
        clearGlobalPopups,

        // Price tracking ref (for crossing detection)
        alertPricesRef,

        // Constants
        ALERT_RETENTION_MS,
    };

    return (
        <AlertContext.Provider value={value}>
            {children}
        </AlertContext.Provider>
    );
};

/**
 * Hook to access alert context
 * @returns {Object} Alert state and handlers
 */
export const useAlert = () => {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error('useAlert must be used within an AlertProvider');
    }
    return context;
};

export default AlertContext;
