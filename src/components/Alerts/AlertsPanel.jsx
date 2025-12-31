import React, { useState, useMemo } from 'react';
import { Bell, Trash2, PlayCircle, PauseCircle, Search, Filter, Volume2, BellOff, Download } from 'lucide-react';
import styles from './AlertsPanel.module.css';
import classNames from 'classnames';

const AlertsPanel = ({ alerts, logs, onRemoveAlert, onRestartAlert, onPauseAlert, onClearAllTriggered }) => {
    const [activeTab, setActiveTab] = useState('alerts');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Filter alerts based on search and status
    const filteredAlerts = useMemo(() => {
        return alerts.filter(alert => {
            // Status filter
            if (statusFilter !== 'all' && alert.status?.toLowerCase() !== statusFilter) {
                return false;
            }

            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchSymbol = alert.symbol?.toLowerCase().includes(query);
                const matchName = alert.name?.toLowerCase().includes(query);
                const matchCondition = alert.condition?.toLowerCase().includes(query);
                return matchSymbol || matchName || matchCondition;
            }

            return true;
        });
    }, [alerts, searchQuery, statusFilter]);

    // Count alerts by status
    const statusCounts = useMemo(() => {
        const counts = { active: 0, triggered: 0, paused: 0 };
        alerts.forEach(alert => {
            const status = alert.status?.toLowerCase() || 'active';
            if (counts[status] !== undefined) counts[status]++;
        });
        return counts;
    }, [alerts]);

    // Export logs as CSV
    const exportLogs = () => {
        if (logs.length === 0) return;

        const csvContent = [
            ['Time', 'Symbol', 'Exchange', 'Message'].join(','),
            ...logs.map(log => [
                new Date(log.time).toISOString(),
                log.symbol,
                log.exchange || 'NSE',
                `"${log.message.replace(/"/g, '""')}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alert-logs-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <span className={styles.title}>
                    <Bell size={16} />
                    Alerts
                </span>
            </div>

            <div className={styles.tabs}>
                <div
                    className={classNames(styles.tab, { [styles.activeTab]: activeTab === 'alerts' })}
                    onClick={() => setActiveTab('alerts')}
                >
                    Alerts
                    {alerts.length > 0 && <span className={styles.tabCount}>{alerts.length}</span>}
                </div>
                <div
                    className={classNames(styles.tab, { [styles.activeTab]: activeTab === 'log' })}
                    onClick={() => setActiveTab('log')}
                >
                    Log
                    {logs.length > 0 && <span className={styles.logCount}>{logs.length}</span>}
                </div>
            </div>

            {activeTab === 'alerts' && alerts.length > 0 && (
                <div className={styles.toolbar}>
                    <div className={styles.searchBox}>
                        <Search size={14} />
                        <input
                            type="text"
                            placeholder="Search alerts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={styles.searchInput}
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className={styles.filterSelect}
                    >
                        <option value="all">All ({alerts.length})</option>
                        <option value="active">Active ({statusCounts.active})</option>
                        <option value="triggered">Triggered ({statusCounts.triggered})</option>
                        <option value="paused">Paused ({statusCounts.paused})</option>
                    </select>
                </div>
            )}

            <div className={styles.content}>
                {activeTab === 'alerts' ? (
                    <div className={styles.list}>
                        {filteredAlerts.length === 0 ? (
                            <div className={styles.emptyState}>
                                {alerts.length === 0 ? 'No active alerts' : 'No matching alerts'}
                            </div>
                        ) : (
                            filteredAlerts.map(alert => {
                                const status = alert.status || 'Active';
                                const statusKey = status.toLowerCase();

                                return (
                                    <div key={alert.id} className={classNames(styles.item, styles[statusKey])}>
                                        <div className={styles.itemHeader}>
                                            <div className={styles.symbolGroup}>
                                                <span className={styles.symbol}>
                                                    {alert.symbol}{alert.exchange ? `:${alert.exchange}` : ''}
                                                </span>
                                                {alert.name && (
                                                    <span className={styles.alertName}>{alert.name}</span>
                                                )}
                                            </div>
                                            <span className={classNames(styles.status, styles[statusKey])}>
                                                {status}
                                            </span>
                                        </div>
                                        <div className={styles.condition}>
                                            {alert.condition}
                                        </div>
                                        <div className={styles.itemFooter}>
                                            <div className={styles.itemMeta}>
                                                <span className={styles.time}>
                                                    {new Date(alert.created_at).toLocaleDateString()} {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <div className={styles.notifIcons}>
                                                    {alert.enableSound !== false && <Volume2 size={12} title="Sound enabled" />}
                                                    {alert.enablePush !== false && <Bell size={12} title="Push enabled" />}
                                                </div>
                                            </div>
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
                    <div className={styles.list}>
                        {logs.length === 0 ? (
                            <div className={styles.emptyState}>No logs</div>
                        ) : (
                            logs.map(log => (
                                <div key={log.id} className={styles.logItem}>
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

            {/* Bulk Actions Footer */}
            {activeTab === 'alerts' && statusCounts.triggered > 0 && (
                <div className={styles.footer}>
                    <button
                        className={styles.bulkButton}
                        onClick={onClearAllTriggered}
                        title="Remove all triggered alerts"
                    >
                        <Trash2 size={14} />
                        Clear Triggered ({statusCounts.triggered})
                    </button>
                </div>
            )}

            {activeTab === 'log' && logs.length > 0 && (
                <div className={styles.footer}>
                    <button
                        className={styles.bulkButton}
                        onClick={exportLogs}
                        title="Export logs as CSV"
                    >
                        <Download size={14} />
                        Export Logs
                    </button>
                </div>
            )}
        </div>
    );
};

export default AlertsPanel;
