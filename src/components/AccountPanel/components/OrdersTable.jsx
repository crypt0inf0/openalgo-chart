/**
 * OrdersTable Component
 * Renders the orders table for AccountPanel
 */
import React from 'react';
import { XCircle } from 'lucide-react';
import styles from '../AccountPanel.module.css';
import { formatCurrency, isOpenOrderStatus } from '../utils/accountFormatters';

const OrdersTable = ({ orders, onRowClick, onCancelOrder }) => {
    // Sort orders: OPEN orders first, then by timestamp (latest first)
    const sortedOrders = [...(orders || [])].sort((a, b) => {
        const normalizeStatus = (s) => (s || '').toUpperCase().replace(/\s+/g, '_');
        const statusA = normalizeStatus(a.order_status);
        const statusB = normalizeStatus(b.order_status);

        const isOpenA = ['OPEN', 'PENDING', 'TRIGGER_PENDING', 'AMO_REQ_RECEIVED'].includes(statusA);
        const isOpenB = ['OPEN', 'PENDING', 'TRIGGER_PENDING', 'AMO_REQ_RECEIVED'].includes(statusB);

        if (isOpenA && !isOpenB) return -1;
        if (!isOpenA && isOpenB) return 1;

        return (b.timestamp || '').localeCompare(a.timestamp || '');
    });

    if (sortedOrders.length === 0) {
        return (
            <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>📋</span>
                <p>No orders found for today</p>
            </div>
        );
    }

    return (
        <div className={styles.tableWrapper}>
            <table className={styles.table}>
                <colgroup>
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '13%' }} />
                </colgroup>
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Symbol</th>
                        <th>Action</th>
                        <th>Type</th>
                        <th className={styles.alignRight}>Qty</th>
                        <th className={styles.alignRight}>Limit Price</th>
                        <th className={styles.alignRight}>Fill Price</th>
                        <th>Status</th>
                        <th className={styles.alignCenter}>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedOrders.map((order, idx) => {
                        const canCancel = isOpenOrderStatus(order.order_status);
                        const totalQty = parseFloat(order.quantity || 0);
                        const filledQty = parseFloat(order.filledqty || order.filled_quantity || 0);
                        const pendingQty = totalQty - filledQty;
                        const avgPrice = parseFloat(order.average_price || 0);
                        const limitPrice = parseFloat(order.price || 0);

                        // Determine quantity display
                        let qtyDisplay;
                        if (filledQty > 0 && filledQty < totalQty) {
                            qtyDisplay = `${filledQty}/${totalQty}`;
                        } else {
                            qtyDisplay = totalQty.toString();
                        }

                        return (
                            <tr
                                key={order.orderid || idx}
                                onClick={() => onRowClick(order.symbol, order.exchange)}
                                className={styles.clickableRow}
                            >
                                <td className={styles.timeCell}>{order.timestamp}</td>
                                <td className={styles.symbolCell}>{order.symbol}</td>
                                <td className={order.action === 'BUY' ? styles.positive : styles.negative}>
                                    {order.action}
                                </td>
                                <td>{order.pricetype}</td>
                                <td className={styles.alignRight}>
                                    {qtyDisplay}
                                    {filledQty > 0 && filledQty < totalQty && (
                                        <span className={styles.partialFill} title={`${pendingQty} pending`}> ⏳</span>
                                    )}
                                </td>
                                <td className={styles.alignRight}>{formatCurrency(limitPrice)}</td>
                                <td className={styles.alignRight}>
                                    {avgPrice > 0 ? formatCurrency(avgPrice) : '-'}
                                </td>
                                <td>
                                    <span className={`${styles.statusBadge} ${styles[`status${order.order_status}`]}`}>
                                        {order.order_status}
                                    </span>
                                </td>
                                <td className={styles.alignCenter}>
                                    {canCancel ? (
                                        <button
                                            className={styles.cancelBtn}
                                            onClick={(e) => onCancelOrder(order, e)}
                                            title="Cancel order"
                                        >
                                            <XCircle size={12} />
                                            <span>Cancel</span>
                                        </button>
                                    ) : (
                                        <span className={styles.noAction}>-</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default React.memo(OrdersTable);
