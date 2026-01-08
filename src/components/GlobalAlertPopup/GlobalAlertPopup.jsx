import React, { useState, useCallback, useEffect } from 'react';
import styles from './GlobalAlertPopup.module.css';

/**
 * GlobalAlertPopup - Shows alert notifications for background alerts
 * Works independently of which chart is currently being viewed
 */

export default function GlobalAlertPopup({ alerts, onDismiss, onClick }) {
    const [dismissing, setDismissing] = useState({});

    // Auto-dismiss after 60 seconds
    useEffect(() => {
        const timers = {};
        alerts.forEach(alert => {
            timers[alert.id] = setTimeout(() => {
                handleDismiss(alert.id);
            }, 60000);
        });

        return () => {
            Object.values(timers).forEach(t => clearTimeout(t));
        };
    }, [alerts]);

    const handleDismiss = useCallback((alertId) => {
        setDismissing(prev => ({ ...prev, [alertId]: true }));
        setTimeout(() => {
            onDismiss && onDismiss(alertId);
            setDismissing(prev => {
                const next = { ...prev };
                delete next[alertId];
                return next;
            });
        }, 300);
    }, [onDismiss]);

    const handleClick = useCallback((alert, e) => {
        // Don't navigate if clicking close button
        if (e.target.closest('button')) return;

        if (onClick) {
            onClick({ symbol: alert.symbol, exchange: alert.exchange });
            handleDismiss(alert.id);
        }
    }, [onClick, handleDismiss]);

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    };

    if (!alerts || alerts.length === 0) return null;

    return (
        <div className={styles.container}>
            {alerts.map(alert => (
                <div
                    key={alert.id}
                    className={`${styles.notification} ${dismissing[alert.id] ? styles.dismissing : ''}`}
                    onClick={(e) => handleClick(alert, e)}
                    style={{ cursor: 'pointer' }}
                    title="Click to view chart"
                >
                    {/* Icon */}
                    <div className={styles.icon}>🪙</div>

                    {/* Content */}
                    <div className={styles.content}>
                        <div className={styles.header}>Alert on {alert.symbol}</div>
                        <div className={styles.message}>
                            {alert.symbol} Crossing {alert.direction === 'up' ? '↑' : '↓'} {alert.price}
                        </div>
                        <div className={styles.footer}>
                            <span className={styles.viewChart}>View chart →</span>
                            <span className={styles.timestamp}>{formatTime(alert.timestamp)}</span>
                        </div>
                    </div>

                    {/* Close button */}
                    <button
                        className={styles.closeBtn}
                        onClick={() => handleDismiss(alert.id)}
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    );
}
