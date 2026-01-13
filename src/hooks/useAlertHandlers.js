/**
 * Alert Handlers Hook
 * Manages price alert operations: create, save, remove, restart, pause, sync, trigger
 */

import { useCallback } from 'react';
import { formatPrice } from '../utils/appUtils';

/**
 * Custom hook for alert operations
 * @param {Object} params - Hook parameters
 * @param {Object} params.chartRefs - Ref object containing chart references
 * @param {string|number} params.activeChartId - Currently active chart ID
 * @param {Function} params.setAlertPrice - State setter for alert price
 * @param {Function} params.setIsAlertOpen - State setter for alert dialog open state
 * @param {Function} params.showToast - Toast notification function
 * @param {string} params.currentSymbol - Current chart symbol
 * @param {string} params.currentExchange - Current chart exchange
 * @param {Array} params.alerts - Current alerts array
 * @param {Function} params.setAlerts - State setter for alerts
 * @param {Object} params.skipNextSyncRef - Ref for skipping next sync
 * @param {Function} params.setAlertLogs - State setter for alert logs
 * @param {Function} params.setUnreadAlertCount - State setter for unread alert count
 * @returns {Object} Alert handler functions
 */
export const useAlertHandlers = ({
    chartRefs,
    activeChartId,
    setAlertPrice,
    setIsAlertOpen,
    showToast,
    currentSymbol,
    currentExchange,
    alerts,
    setAlerts,
    skipNextSyncRef,
    setAlertLogs,
    setUnreadAlertCount
}) => {
    // Handle alert button click - create new alert at current price
    const handleAlertClick = useCallback(() => {
        const activeRef = chartRefs.current[activeChartId];
        if (activeRef) {
            const price = activeRef.getCurrentPrice();
            if (price !== null) {
                if (typeof activeRef.createAlert === 'function') {
                    activeRef.createAlert(price);
                } else {
                    setAlertPrice(price);
                    setIsAlertOpen(true);
                }
            } else {
                showToast('No price data available', 'error');
            }
        }
    }, [chartRefs, activeChartId, setAlertPrice, setIsAlertOpen, showToast]);

    // Save a new alert
    const handleSaveAlert = useCallback((alertData) => {
        const priceDisplay = formatPrice(alertData.value);

        const newAlert = {
            id: Date.now(),
            symbol: currentSymbol,
            exchange: currentExchange,
            price: priceDisplay,
            condition: `Crossing ${priceDisplay}`,
            status: 'Active',
            created_at: new Date().toISOString(),
        };

        setAlerts(prev => [...prev, newAlert]);
        skipNextSyncRef.current = { type: 'add', alertId: newAlert.id, chartId: activeChartId };

        const activeRef = chartRefs.current[activeChartId];
        if (activeRef && typeof activeRef.addPriceAlert === 'function') {
            activeRef.addPriceAlert(newAlert);
        }
    }, [currentSymbol, currentExchange, setAlerts, skipNextSyncRef, activeChartId, chartRefs]);

    // Remove an alert
    const handleRemoveAlert = useCallback((id) => {
        setAlerts(prev => {
            const target = prev.find(a => a.id === id);

            if (target && target._source === 'lineTools' && target.chartId != null && target.externalId) {
                const chartRef = chartRefs.current[target.chartId];
                if (chartRef && typeof chartRef.removePriceAlert === 'function') {
                    chartRef.removePriceAlert(target.externalId);
                }
            }

            return prev.filter(a => a.id !== id);
        });
    }, [setAlerts, chartRefs]);

    // Restart a paused/triggered alert
    const handleRestartAlert = useCallback((id) => {
        const target = alerts.find(a => a.id === id);
        if (!target) return;

        let originalCondition = 'crossing';
        if (target.condition) {
            const condLower = target.condition.toLowerCase();
            if (condLower.includes('crossing_down') || condLower.includes('crossing down')) {
                originalCondition = 'crossing_down';
            } else if (condLower.includes('crossing_up') || condLower.includes('crossing up')) {
                originalCondition = 'crossing_up';
            }
        }

        skipNextSyncRef.current = { type: 'resume', alertId: id, chartId: target.chartId };

        if (target._source === 'lineTools' && target.chartId != null) {
            const chartRef = chartRefs.current[target.chartId];
            if (chartRef && typeof chartRef.restartPriceAlert === 'function') {
                chartRef.restartPriceAlert(target.price, originalCondition);
            }
        }

        setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'Active' } : a));
    }, [alerts, skipNextSyncRef, chartRefs, setAlerts]);

    // Pause an active alert
    const handlePauseAlert = useCallback((id) => {
        const target = alerts.find(a => a.id === id);
        if (!target) return;

        skipNextSyncRef.current = { type: 'pause' };

        if (target._source === 'lineTools' && target.chartId != null && target.externalId) {
            const chartRef = chartRefs.current[target.chartId];
            if (chartRef && typeof chartRef.removePriceAlert === 'function') {
                chartRef.removePriceAlert(target.externalId);
            }
        }

        setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'Paused' } : a));
    }, [alerts, skipNextSyncRef, chartRefs, setAlerts]);

    // Sync alerts from chart to state
    const handleChartAlertsSync = useCallback((chartId, symbol, exchange, chartAlerts) => {
        const syncInfo = skipNextSyncRef.current;

        if (syncInfo && syncInfo.type === 'pause') {
            skipNextSyncRef.current = null;
            return;
        }

        if (syncInfo && syncInfo.type === 'add' && syncInfo.chartId === chartId) {
            skipNextSyncRef.current = null;
            const existingForChart = alerts.filter(a => a._source === 'lineTools' && a.chartId === chartId && a.status === 'Active');
            const existingExternalIds = new Set(existingForChart.map(a => a.externalId));
            const newChartAlert = (chartAlerts || []).find(a => !existingExternalIds.has(a.id));

            if (newChartAlert) {
                setAlerts(prev => prev.map(a =>
                    a.id === syncInfo.alertId ? { ...a, externalId: newChartAlert.id, _source: 'lineTools', chartId } : a
                ));
            }
            return;
        }

        if (syncInfo && syncInfo.type === 'resume' && syncInfo.chartId === chartId) {
            skipNextSyncRef.current = null;
            const existingForChart = alerts.filter(a => a._source === 'lineTools' && a.chartId === chartId && a.status === 'Active');
            const existingExternalIds = new Set(existingForChart.map(a => a.externalId));
            const newChartAlert = (chartAlerts || []).find(a => !existingExternalIds.has(a.id));

            if (newChartAlert) {
                setAlerts(prev => prev.map(a =>
                    a.id === syncInfo.alertId ? { ...a, externalId: newChartAlert.id, status: 'Active' } : a
                ));
            }
            return;
        }

        setAlerts(prev => {
            const chartAlertMap = new Map((chartAlerts || []).map(a => [a.id, a]));
            const chartAlertIds = new Set((chartAlerts || []).map(a => a.id));
            const existingForChart = prev.filter(a => a._source === 'lineTools' && a.chartId === chartId);
            const existingExternalIds = new Set(existingForChart.map(a => a.externalId));

            const remaining = prev.filter(a => {
                if (a._source !== 'lineTools' || a.chartId !== chartId) return true;
                if (a.status === 'Triggered' || a.status === 'Paused') return true;
                return chartAlertIds.has(a.externalId);
            }).map(a => {
                if (a._source === 'lineTools' && a.chartId === chartId && a.status === 'Active') {
                    const chartAlert = chartAlertMap.get(a.externalId);
                    if (chartAlert) {
                        const priceDisplay = formatPrice(chartAlert.price);
                        let conditionDisplay = `Crossing ${priceDisplay}`;
                        if (chartAlert.condition === 'crossing_up') {
                            conditionDisplay = `Crossing Up ${priceDisplay}`;
                        } else if (chartAlert.condition === 'crossing_down') {
                            conditionDisplay = `Crossing Down ${priceDisplay}`;
                        } else if (chartAlert.condition && chartAlert.condition !== 'crossing') {
                            conditionDisplay = chartAlert.condition;
                        }
                        return { ...a, price: priceDisplay, condition: conditionDisplay };
                    }
                }
                return a;
            });

            const newChartAlerts = (chartAlerts || []).filter(a => !existingExternalIds.has(a.id));
            const newMapped = newChartAlerts.map(a => {
                const priceDisplay = formatPrice(a.price);
                let conditionDisplay = `Crossing ${priceDisplay}`;
                if (a.condition === 'crossing_up') {
                    conditionDisplay = `Crossing Up ${priceDisplay}`;
                } else if (a.condition === 'crossing_down') {
                    conditionDisplay = `Crossing Down ${priceDisplay}`;
                } else if (a.condition && a.condition !== 'crossing') {
                    conditionDisplay = a.condition;
                }

                return {
                    id: `lt-${chartId}-${a.id}`,
                    externalId: a.id,
                    symbol,
                    exchange,
                    price: priceDisplay,
                    condition: conditionDisplay,
                    status: 'Active',
                    created_at: new Date().toISOString(),
                    _source: 'lineTools',
                    chartId,
                };
            });

            return [...remaining, ...newMapped];
        });
    }, [alerts, skipNextSyncRef, setAlerts]);

    // Handle alert triggered event
    const handleChartAlertTriggered = useCallback((chartId, symbol, exchange, evt) => {
        const displayPrice = formatPrice(evt.price ?? evt.alertPrice);
        const timestamp = evt.timestamp ? new Date(evt.timestamp).toISOString() : new Date().toISOString();

        const logEntry = {
            id: Date.now(),
            alertId: evt.externalId || evt.alertId,
            symbol,
            exchange,
            message: `Alert triggered: ${symbol}:${exchange} crossed ${displayPrice}`,
            time: timestamp,
        };
        setAlertLogs(prev => [logEntry, ...prev]);
        setUnreadAlertCount(prev => prev + 1);

        setAlerts(prev => {
            let updated = false;
            const next = prev.map(a => {
                if (a._source === 'lineTools' && a.chartId === chartId && a.externalId === (evt.externalId || evt.alertId)) {
                    updated = true;
                    return { ...a, status: 'Triggered' };
                }
                return a;
            });

            if (!updated) {
                next.unshift({
                    id: `lt-${chartId}-${evt.externalId || evt.alertId}-triggered-${Date.now()}`,
                    externalId: evt.externalId || evt.alertId,
                    symbol,
                    exchange,
                    price: displayPrice,
                    condition: evt.condition || `Crossing ${displayPrice}`,
                    status: 'Triggered',
                    created_at: timestamp,
                    _source: 'lineTools',
                    chartId,
                });
            }

            return next;
        });
    }, [setAlertLogs, setUnreadAlertCount, setAlerts]);

    return {
        handleAlertClick,
        handleSaveAlert,
        handleRemoveAlert,
        handleRestartAlert,
        handlePauseAlert,
        handleChartAlertsSync,
        handleChartAlertTriggered
    };
};

export default useAlertHandlers;
