import { useEffect, useRef } from 'react';
import { loadAlertsForSymbol } from '../services/alertService';

/**
 * Hook to handle restoring alerts for the chart.
 * @param {Object} manager - LineToolManager instance
 * @param {string} symbol - Current symbol
 * @param {string} exchange - Current exchange
 */
export const useChartAlerts = (manager, symbol, exchange) => {
    const managerRef = useRef(null);

    useEffect(() => {
        if (!manager || !symbol) return;
        managerRef.current = manager;

        const restoreAlerts = () => {
            // === Alert Persistence: Restore alerts for new symbol ===
            try {
                const userAlerts = manager._userPriceAlerts;
                console.log('[Alerts] Checking restore for', symbol, '- userAlerts exists:', !!userAlerts);
                if (userAlerts && typeof userAlerts.importAlerts === 'function') {
                    // We need loadAlertsForSymbol. 
                    // In ChartComponent it was likely imported or available in scope.
                    // I need to check where it comes from.
                    const savedAlerts = loadAlertsForSymbol(symbol, exchange);
                    console.log('[Alerts] Found saved alerts:', savedAlerts);
                    if (savedAlerts && savedAlerts.length > 0) {
                        userAlerts.importAlerts(savedAlerts);
                        console.log('[Alerts] Restored', savedAlerts.length, 'alerts for', symbol);
                    } else {
                        console.log('[Alerts] No saved alerts for', symbol);
                    }
                } else {
                    console.log('[Alerts] importAlerts not available on userAlerts');
                }
            } catch (err) {
                console.warn('[Alerts] Failed to restore alerts:', err);
            }
        };

        restoreAlerts();

    }, [manager, symbol, exchange]);
};
