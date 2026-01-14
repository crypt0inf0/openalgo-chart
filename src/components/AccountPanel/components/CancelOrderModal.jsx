/**
 * CancelOrderModal Component
 * Modal for confirming order cancellation
 */
import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import styles from '../AccountPanel.module.css';

const CancelOrderModal = ({ isOpen, order, onClose, onConfirm, isCancelling }) => {
    if (!isOpen || !order) return null;

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3>Cancel Order</h3>
                    <button
                        className={styles.modalCloseBtn}
                        onClick={onClose}
                        disabled={isCancelling}
                        title="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className={styles.modalBody}>
                    {/* Warning Icon */}
                    <div className={styles.warningIcon}>
                        <AlertTriangle size={48} color="#f59e0b" />
                    </div>

                    {/* Order Details */}
                    <div className={styles.cancelOrderDetails}>
                        <p className={styles.cancelMessage}>
                            Are you sure you want to cancel this order?
                        </p>

                        <div className={styles.orderDetails}>
                            <div className={styles.orderDetailRow}>
                                <span className={styles.orderDetailLabel}>Symbol:</span>
                                <span className={styles.orderDetailValue}>{order.symbol}</span>
                            </div>
                            <div className={styles.orderDetailRow}>
                                <span className={styles.orderDetailLabel}>Action:</span>
                                <span className={`${styles.orderDetailValue} ${order.action === 'BUY' ? styles.positive : styles.negative}`}>
                                    {order.action}
                                </span>
                            </div>
                            <div className={styles.orderDetailRow}>
                                <span className={styles.orderDetailLabel}>Quantity:</span>
                                <span className={styles.orderDetailValue}>{order.quantity}</span>
                            </div>
                            <div className={styles.orderDetailRow}>
                                <span className={styles.orderDetailLabel}>Price:</span>
                                <span className={styles.orderDetailValue}>₹{order.price}</span>
                            </div>
                            <div className={styles.orderDetailRow}>
                                <span className={styles.orderDetailLabel}>Status:</span>
                                <span className={styles.orderDetailValue}>{order.order_status}</span>
                            </div>
                            <div className={styles.orderDetailRow}>
                                <span className={styles.orderDetailLabel}>Order ID:</span>
                                <span className={styles.orderDetailValue}>{order.orderid}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal Actions */}
                <div className={styles.modalActions}>
                    <button
                        className={styles.secondaryBtn}
                        onClick={onClose}
                        disabled={isCancelling}
                    >
                        No, Keep Order
                    </button>
                    <button
                        className={styles.dangerBtn}
                        onClick={onConfirm}
                        disabled={isCancelling}
                    >
                        {isCancelling ? 'Cancelling...' : 'Yes, Cancel Order'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default React.memo(CancelOrderModal);
