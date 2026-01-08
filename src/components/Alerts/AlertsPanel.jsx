import React, { useState, useCallback, useEffect, useRef } from 'react';
import { X, Bell, Trash2, PlayCircle, PauseCircle, Clock, Edit2 } from 'lucide-react';
import styles from './AlertsPanel.module.css';
import classNames from 'classnames';

const AlertsPanel = ({ alerts, logs, onRemoveAlert, onRestartAlert, onPauseAlert, onNavigate, onEditAlert }) => {
    const [activeTab, setActiveTab] = useState('alerts');
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const listRef = useRef(null);

    // Reset focusedIndex when tab changes
    useEffect(() => {
        setFocusedIndex(-1);
    }, [activeTab]);

    // Keyboard navigation handler
    const handleKeyDown = useCallback((e) => {
        const items = activeTab === 'alerts' ? alerts : logs;
        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocusedIndex(prev => prev < 0 ? 0 : Math.min(prev + 1, items.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusedIndex(prev => prev < 0 ? 0 : Math.max(prev - 1, 0));
        } else if (e.key === 'Delete' && focusedIndex >= 0 && activeTab === 'alerts') {
            e.preventDefault();
            onRemoveAlert(alerts[focusedIndex].id);
        } else if (e.key === ' ' && focusedIndex >= 0 && activeTab === 'alerts') {
            e.preventDefault();
            const alert = alerts[focusedIndex];
            if (alert.status === 'Active') onPauseAlert(alert.id);
            else onRestartAlert(alert.id);
        }
    }, [activeTab, alerts, logs, focusedIndex, onRemoveAlert, onPauseAlert, onRestartAlert]);

    // Handle click on alert row to navigate to that chart
    const handleAlertClick = useCallback((alert, e) => {
        // Don't navigate if clicking on action buttons
        if (e.target.closest('svg') || e.target.closest('button')) return;

        if (onNavigate && alert.symbol) {
            onNavigate({ symbol: alert.symbol, exchange: alert.exchange || 'NSE' });
        }
    }, [onNavigate]);

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <span className={styles.title}>Alerts</span>
                <div className={styles.actions}>
                    {/* Add actions if needed */}
                </div>
            </div>

            <div className={styles.tabs}>
                <div
                    className={classNames(styles.tab, { [styles.activeTab]: activeTab === 'alerts' })}
                    onClick={() => setActiveTab('alerts')}
                >
                    Alerts
                </div>
                <div
                    className={classNames(styles.tab, { [styles.activeTab]: activeTab === 'log' })}
                    onClick={() => setActiveTab('log')}
                >
                    Log
                    {logs.length > 0 && <span className={styles.logCount}>{logs.length}</span>}
                </div>
            </div>

            <div className={styles.content}>
                {activeTab === 'alerts' ? (
                    <div
                        className={styles.list}
                        ref={listRef}
                        tabIndex={0}
                        onKeyDown={handleKeyDown}
                    >
                        {alerts.length === 0 ? (
                            <div className={styles.emptyState}>No active alerts</div>
                        ) : (
                            alerts.map((alert, index) => {
                                // Normalize status so we always show a readable label
                                const status = alert.status || 'Active';
                                const statusKey = status.toLowerCase();

                                return (
                                    <div
                                        key={alert.id}
                                        className={classNames(styles.item, styles[statusKey], {
                                            [styles.focused]: index === focusedIndex
                                        })}
                                        onClick={(e) => handleAlertClick(alert, e)}
                                        style={{ cursor: 'pointer' }}
                                        title="Click to view chart"
                                    >
                                        <div className={styles.itemHeader}>
                                            <span className={styles.symbol}>
                                                {alert.symbol}{alert.exchange ? `:${alert.exchange}` : ''}
                                            </span>
                                            <span className={classNames(styles.status, styles[statusKey])}>
                                                {status}
                                            </span>
                                        </div>
                                        <div className={styles.condition}>
                                            {alert.condition}
                                        </div>
                                        <div className={styles.itemFooter}>
                                            <span className={styles.time}>
                                                {new Date(alert.created_at).toLocaleDateString()} {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </span>
                                            <div className={styles.itemActions}>
                                                {status === 'Active' && (
                                                    <PauseCircle
                                                        size={16}
                                                        className={styles.actionIcon}
                                                        onClick={() => onPauseAlert(alert.id)}
                                                        title="Pause Alert"
                                                    />
                                                )}
                                                {(status === 'Triggered' || status === 'Paused') && (
                                                    <PlayCircle
                                                        size={16}
                                                        className={styles.actionIcon}
                                                        onClick={() => onRestartAlert(alert.id)}
                                                        title="Resume Alert"
                                                    />
                                                )}
                                                <Edit2
                                                    size={16}
                                                    className={styles.actionIcon}
                                                    onClick={() => onEditAlert && onEditAlert(alert)}
                                                    title="Edit Alert"
                                                />
                                                <Trash2
                                                    size={16}
                                                    className={styles.actionIcon}
                                                    onClick={() => onRemoveAlert(alert.id)}
                                                    title="Remove Alert"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : (
                    <div
                        className={styles.list}
                        ref={listRef}
                        tabIndex={0}
                        onKeyDown={handleKeyDown}
                    >
                        {logs.length === 0 ? (
                            <div className={styles.emptyState}>No logs</div>
                        ) : (
                            logs.map((log, index) => (
                                <div key={`${log.id}-${index}`} className={classNames(styles.logItem, {
                                    [styles.focused]: index === focusedIndex
                                })}>
                                    <div className={styles.logHeader}>
                                        <span className={styles.symbol}>
                                            {log.symbol}{log.exchange ? `:${log.exchange}` : ''}
                                        </span>
                                        <span className={styles.time}>{new Date(log.time).toLocaleTimeString()}</span>
                                    </div>
                                    <div className={styles.message}>
                                        {log.message}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AlertsPanel;
