import React, { useState, useEffect, useRef } from 'react';
import styles from './OrderEntryModal.module.css';
import classNames from 'classnames';
import { X } from 'lucide-react';
import { placeOrder } from '../../services/tradingService';

const OrderEntryModal = ({
    isOpen,
    onClose,
    symbol,
    exchange = 'NSE',
    lastPrice,
    action: initialAction = 'BUY',
    tradingMode = 'sandbox',
    theme = 'dark',
}) => {
    const [action, setAction] = useState(initialAction);
    const [orderType, setOrderType] = useState('MARKET');
    const [product, setProduct] = useState('MIS'); // MIS (Intraday) or CNC (Delivery)
    const [quantity, setQuantity] = useState(1);
    const [price, setPrice] = useState('');
    const [triggerPrice, setTriggerPrice] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const modalRef = useRef(null);

    // Update price when lastPrice changes
    useEffect(() => {
        if (lastPrice && orderType !== 'MARKET') {
            setPrice(lastPrice);
        }
    }, [lastPrice, orderType]);

    // Update action when initialAction changes
    useEffect(() => {
        setAction(initialAction);
    }, [initialAction]);

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setError('');
            setSuccess('');
            setIsSubmitting(false);
        }
    }, [isOpen]);

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (modalRef.current && !modalRef.current.contains(e.target)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    // Handle escape key
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEsc);
        }
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    const handleSubmit = async () => {
        setError('');
        setSuccess('');
        setIsSubmitting(true);

        try {
            const orderParams = {
                symbol,
                exchange,
                action,
                product,
                pricetype: orderType,
                quantity: parseInt(quantity, 10),
            };

            if (orderType === 'LIMIT' || orderType === 'SL') {
                orderParams.price = parseFloat(price);
            }

            if (orderType === 'SL' || orderType === 'SL-M') {
                orderParams.trigger_price = parseFloat(triggerPrice);
            }

            const result = await placeOrder(orderParams, tradingMode);

            setSuccess(`Order placed successfully! ${tradingMode === 'sandbox' ? '(Sandbox)' : ''}`);

            // Close modal after success
            setTimeout(() => {
                onClose();
            }, 1500);

        } catch (err) {
            setError(err.message || 'Failed to place order');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const estimatedValue = quantity * (parseFloat(price) || parseFloat(lastPrice) || 0);

    return (
        <div className={styles.overlay}>
            <div
                ref={modalRef}
                className={classNames(styles.modal, theme === 'light' && styles.light)}
            >
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.symbolInfo}>
                        <span className={styles.symbolName}>{symbol}</span>
                        <span className={styles.exchange}>{exchange}</span>
                        {lastPrice && (
                            <span className={styles.ltp}>₹{parseFloat(lastPrice).toFixed(2)}</span>
                        )}
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                {/* Mode Indicator */}
                <div className={classNames(
                    styles.modeIndicator,
                    tradingMode === 'live' ? styles.modeLive : styles.modeSandbox
                )}>
                    {tradingMode === 'live' ? '⚠️ LIVE TRADING' : '🔵 SANDBOX MODE'}
                </div>

                {/* Action Tabs */}
                <div className={styles.actionTabs}>
                    <button
                        className={classNames(styles.actionTab, styles.buyTab, action === 'BUY' && styles.active)}
                        onClick={() => setAction('BUY')}
                    >
                        BUY
                    </button>
                    <button
                        className={classNames(styles.actionTab, styles.sellTab, action === 'SELL' && styles.active)}
                        onClick={() => setAction('SELL')}
                    >
                        SELL
                    </button>
                </div>

                {/* Order Type */}
                <div className={styles.formGroup}>
                    <label>Order Type</label>
                    <div className={styles.buttonGroup}>
                        {['MARKET', 'LIMIT', 'SL', 'SL-M'].map((type) => (
                            <button
                                key={type}
                                className={classNames(styles.optionBtn, orderType === type && styles.active)}
                                onClick={() => setOrderType(type)}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Product Type */}
                <div className={styles.formGroup}>
                    <label>Product</label>
                    <div className={styles.buttonGroup}>
                        <button
                            className={classNames(styles.optionBtn, product === 'MIS' && styles.active)}
                            onClick={() => setProduct('MIS')}
                        >
                            Intraday
                        </button>
                        <button
                            className={classNames(styles.optionBtn, product === 'CNC' && styles.active)}
                            onClick={() => setProduct('CNC')}
                        >
                            Delivery
                        </button>
                        <button
                            className={classNames(styles.optionBtn, product === 'NRML' && styles.active)}
                            onClick={() => setProduct('NRML')}
                        >
                            Normal
                        </button>
                    </div>
                </div>

                {/* Quantity */}
                <div className={styles.formGroup}>
                    <label>Quantity</label>
                    <div className={styles.quantityInput}>
                        <button
                            className={styles.qtyBtn}
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        >
                            −
                        </button>
                        <input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                            min="1"
                        />
                        <button
                            className={styles.qtyBtn}
                            onClick={() => setQuantity(quantity + 1)}
                        >
                            +
                        </button>
                    </div>
                </div>

                {/* Price (for LIMIT/SL orders) */}
                {(orderType === 'LIMIT' || orderType === 'SL') && (
                    <div className={styles.formGroup}>
                        <label>Price</label>
                        <input
                            type="number"
                            className={styles.priceInput}
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder="Enter price"
                            step="0.05"
                        />
                    </div>
                )}

                {/* Trigger Price (for SL orders) */}
                {(orderType === 'SL' || orderType === 'SL-M') && (
                    <div className={styles.formGroup}>
                        <label>Trigger Price</label>
                        <input
                            type="number"
                            className={styles.priceInput}
                            value={triggerPrice}
                            onChange={(e) => setTriggerPrice(e.target.value)}
                            placeholder="Enter trigger price"
                            step="0.05"
                        />
                    </div>
                )}

                {/* Order Summary */}
                <div className={styles.summary}>
                    <div className={styles.summaryRow}>
                        <span>Estimated Value</span>
                        <span>₹{estimatedValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                </div>

                {/* Error/Success Messages */}
                {error && <div className={styles.error}>{error}</div>}
                {success && <div className={styles.success}>{success}</div>}

                {/* Submit Button */}
                <button
                    className={classNames(
                        styles.submitBtn,
                        action === 'BUY' ? styles.buyBtn : styles.sellBtn
                    )}
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? 'Placing Order...' : `${action} ${symbol}`}
                </button>
            </div>
        </div>
    );
};

export default OrderEntryModal;
