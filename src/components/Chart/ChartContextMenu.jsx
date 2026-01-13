/**
 * ChartContextMenu Component
 * Displays the right-click context menu for chart interactions
 */

import React from 'react';
import styles from './ChartComponent.module.css';

/**
 * Chart right-click context menu
 * @param {Object} props
 * @param {boolean} props.show - Whether the menu is visible
 * @param {number} props.x - X coordinate position
 * @param {number} props.y - Y coordinate position
 * @param {string} props.orderId - Order ID (for cancel order option)
 * @param {string} props.symbol - Current symbol
 * @param {string} props.exchange - Current exchange
 * @param {Function} props.onCancelOrder - Callback for cancel order
 * @param {Function} props.onOpenOptionChain - Callback for opening option chain
 * @param {Function} props.onClose - Callback to close the menu
 */
const ChartContextMenu = ({
    show,
    x,
    y,
    orderId,
    symbol,
    exchange,
    onCancelOrder,
    onOpenOptionChain,
    onClose
}) => {
    if (!show) return null;

    return (
        <div
            className={styles.contextMenu}
            style={{ left: x, top: y }}
            onClick={(e) => e.stopPropagation()}
        >
            {orderId && (
                <button
                    className={styles.contextMenuItem}
                    onClick={() => {
                        onCancelOrder?.(orderId);
                        onClose();
                    }}
                >
                    Cancel Order
                </button>
            )}
            <button
                className={styles.contextMenuItem}
                onClick={() => {
                    onOpenOptionChain?.(symbol, exchange);
                    onClose();
                }}
            >
                View Option Chain
            </button>
        </div>
    );
};

export default ChartContextMenu;
