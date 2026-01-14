/**
 * ModifyOrderModal Component
 * Modal for modifying pending orders
 */
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import styles from '../AccountPanel.module.css';
import { formatCurrency } from '../utils/accountFormatters';

const ModifyOrderModal = ({ isOpen, order, onClose, onModifyComplete, showToast }) => {
    const [price, setPrice] = useState('');
    const [quantity, setQuantity] = useState('');
    const [triggerPrice, setTriggerPrice] = useState('');
    const [isModifying, setIsModifying] = useState(false);
    const [errors, setErrors] = useState({});

    // Pre-fill with current order values
    useEffect(() => {
        if (order) {
            setPrice(order.price || '');
            setQuantity(order.quantity || '');
            setTriggerPrice(order.trigger_price || order.triggerprice || '');
            setErrors({});
        }
    }, [order]);

    // Validate inputs
    const validate = () => {
        const newErrors = {};

        // Price validation (for LIMIT and SL orders)
        if (order?.pricetype !== 'MARKET') {
            const priceVal = parseFloat(price);
            if (!price || isNaN(priceVal) || priceVal <= 0) {
                newErrors.price = 'Price must be greater than 0';
            }
        }

        // Quantity validation
        const qtyVal = parseInt(quantity);
        if (!quantity || isNaN(qtyVal) || qtyVal <= 0) {
            newErrors.quantity = 'Quantity must be greater than 0';
        }

        // Trigger price validation (for SL orders)
        if (order?.pricetype === 'SL' || order?.pricetype === 'SL-M') {
            const triggerVal = parseFloat(triggerPrice);
            if (!triggerPrice || isNaN(triggerVal) || triggerVal <= 0) {
                newErrors.triggerPrice = 'Trigger price must be greater than 0';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleModify = async () => {
        if (!validate()) return;

        setIsModifying(true);
        try {
            const modifyPayload = {
                orderid: order.orderid,
                quantity: parseInt(quantity)
            };

            // Add price for non-MARKET orders
            if (order.pricetype !== 'MARKET') {
                modifyPayload.price = parseFloat(price);
            }

            // Add trigger price for SL orders
            if (order.pricetype === 'SL' || order.pricetype === 'SL-M') {
                modifyPayload.trigger_price = parseFloat(triggerPrice);
            }

            await onModifyComplete(modifyPayload);
            onClose();
        } catch (error) {
            console.error('[ModifyOrderModal] Modify failed:', error);
            setErrors({ submit: error.message || 'Failed to modify order' });
        } finally {
            setIsModifying(false);
        }
    };

    const handleClose = () => {
        if (!isModifying) {
            setErrors({});
            onClose();
        }
    };

    if (!isOpen || !order) return null;

    // Calculate estimated value
    const estimatedValue = parseFloat(price || 0) * parseInt(quantity || 0);

    return (
        <div className={styles.modalOverlay} onClick={handleClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3>Modify Order</h3>
                    <button
                        className={styles.modalCloseBtn}
                        onClick={handleClose}
                        disabled={isModifying}
                        title="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className={styles.modalBody}>
                    {/* Order Details */}
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
                            <span className={styles.orderDetailLabel}>Type:</span>
                            <span className={styles.orderDetailValue}>{order.pricetype}</span>
                        </div>
                        <div className={styles.orderDetailRow}>
                            <span className={styles.orderDetailLabel}>Product:</span>
                            <span className={styles.orderDetailValue}>{order.product}</span>
                        </div>
                    </div>

                    {/* Modification Form */}
                    <div className={styles.modifyForm}>
                        {/* Quantity Input */}
                        <div className={styles.formGroup}>
                            <label htmlFor="quantity">
                                Quantity <span className={styles.required}>*</span>
                            </label>
                            <input
                                id="quantity"
                                type="number"
                                step="1"
                                min="1"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                className={`${styles.formInput} ${errors.quantity ? styles.inputError : ''}`}
                                disabled={isModifying}
                            />
                            {errors.quantity && (
                                <span className={styles.errorText}>{errors.quantity}</span>
                            )}
                        </div>

                        {/* Price Input (not for MARKET orders) */}
                        {order.pricetype !== 'MARKET' && (
                            <div className={styles.formGroup}>
                                <label htmlFor="price">
                                    {order.pricetype === 'SL' ? 'Limit Price' : 'Price'} <span className={styles.required}>*</span>
                                </label>
                                <input
                                    id="price"
                                    type="number"
                                    step="0.05"
                                    min="0"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    className={`${styles.formInput} ${errors.price ? styles.inputError : ''}`}
                                    disabled={isModifying}
                                />
                                {errors.price && (
                                    <span className={styles.errorText}>{errors.price}</span>
                                )}
                            </div>
                        )}

                        {/* Trigger Price Input (for SL orders) */}
                        {(order.pricetype === 'SL' || order.pricetype === 'SL-M') && (
                            <div className={styles.formGroup}>
                                <label htmlFor="triggerPrice">
                                    Trigger Price <span className={styles.required}>*</span>
                                </label>
                                <input
                                    id="triggerPrice"
                                    type="number"
                                    step="0.05"
                                    min="0"
                                    value={triggerPrice}
                                    onChange={(e) => setTriggerPrice(e.target.value)}
                                    className={`${styles.formInput} ${errors.triggerPrice ? styles.inputError : ''}`}
                                    disabled={isModifying}
                                />
                                {errors.triggerPrice && (
                                    <span className={styles.errorText}>{errors.triggerPrice}</span>
                                )}
                            </div>
                        )}

                        {/* Estimated Value */}
                        {order.pricetype !== 'MARKET' && (
                            <div className={styles.estimatedValue}>
                                <span className={styles.estimatedLabel}>Estimated Value:</span>
                                <span className={styles.estimatedAmount}>₹{formatCurrency(estimatedValue)}</span>
                            </div>
                        )}
                    </div>

                    {/* Error Message */}
                    {errors.submit && (
                        <div className={styles.errorMessage}>
                            {errors.submit}
                        </div>
                    )}
                </div>

                {/* Modal Actions */}
                <div className={styles.modalActions}>
                    <button
                        className={styles.secondaryBtn}
                        onClick={handleClose}
                        disabled={isModifying}
                    >
                        Cancel
                    </button>
                    <button
                        className={styles.primaryBtn}
                        onClick={handleModify}
                        disabled={isModifying}
                    >
                        {isModifying ? 'Modifying...' : 'Modify Order'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default React.memo(ModifyOrderModal);
