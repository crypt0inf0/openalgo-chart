import React, { useState, useEffect, useCallback } from 'react';
import { X, Minus, Plus, AlertTriangle } from 'lucide-react';
import { placeOrder } from '../../services/openalgo';
import { getLotSize } from '../../services/openalgo';
import styles from './ExitPositionModal.module.css';

// Format currency values
const formatCurrency = (value) => {
    if (value === null || value === undefined) return '0.00';
    const num = parseFloat(value);
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Order types available for exit
const ORDER_TYPES = [
    { id: 'MARKET', label: 'Market', description: 'Exit at best available price' },
    { id: 'LIMIT', label: 'Limit', description: 'Exit at specified price or better' },
    { id: 'SL', label: 'SL', description: 'Stop Loss - Trigger activates limit order' },
    { id: 'SL-M', label: 'SL-M', description: 'Stop Loss Market - Trigger activates market order' },
];

const ExitPositionModal = ({
    isOpen,
    position,
    onClose,
    onExitComplete,
    showToast
}) => {
    // State
    const [orderType, setOrderType] = useState('MARKET');
    const [exitQuantity, setExitQuantity] = useState('');
    const [limitPrice, setLimitPrice] = useState('');
    const [triggerPrice, setTriggerPrice] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lotSize, setLotSize] = useState(1);
    const [isLoadingLotSize, setIsLoadingLotSize] = useState(false);

    // Reset state when modal opens with new position
    useEffect(() => {
        if (isOpen && position) {
            setOrderType('MARKET');
            setExitQuantity(String(Math.abs(position.quantity)));
            setLimitPrice(position.ltp ? String(position.ltp) : '');
            setTriggerPrice('');
            setIsSubmitting(false);

            // Fetch lot size for F&O instruments
            const fetchLotSize = async () => {
                setIsLoadingLotSize(true);
                try {
                    const ls = await getLotSize(position.symbol, position.exchange);
                    setLotSize(ls || 1);
                } catch (error) {
                    console.error('Error fetching lot size:', error);
                    setLotSize(1);
                }
                setIsLoadingLotSize(false);
            };
            fetchLotSize();
        }
    }, [isOpen, position]);

    // Close modal on Escape key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Increment/decrement quantity by lot size
    const adjustQuantity = useCallback((delta) => {
        const current = parseInt(exitQuantity) || 0;
        const step = lotSize || 1;
        const maxQty = Math.abs(position?.quantity || 0);
        const newQty = Math.max(step, Math.min(maxQty, current + (delta * step)));
        setExitQuantity(String(newQty));
    }, [exitQuantity, lotSize, position]);

    // Validate inputs
    const validateInputs = () => {
        const qty = parseInt(exitQuantity) || 0;
        const maxQty = Math.abs(position?.quantity || 0);
        const ltp = parseFloat(position?.ltp) || 0;
        const limit = parseFloat(limitPrice) || 0;
        const trigger = parseFloat(triggerPrice) || 0;

        // Quantity validation
        if (qty <= 0) {
            return { valid: false, error: 'Quantity must be greater than 0' };
        }
        if (qty > maxQty) {
            return { valid: false, error: `Quantity cannot exceed position size (${maxQty})` };
        }

        // Lot size validation for F&O
        if (lotSize > 1 && qty % lotSize !== 0) {
            return { valid: false, error: `Quantity must be a multiple of lot size (${lotSize})` };
        }

        // Price validations for LIMIT orders
        if ((orderType === 'LIMIT' || orderType === 'SL') && limit <= 0) {
            return { valid: false, error: 'Please enter a valid limit price' };
        }

        // Trigger price validations for SL orders
        if ((orderType === 'SL' || orderType === 'SL-M') && trigger <= 0) {
            return { valid: false, error: 'Please enter a valid trigger price' };
        }

        // Trigger price logic validation (for exit)
        if (orderType === 'SL' || orderType === 'SL-M') {
            const isLong = position.quantity > 0;
            if (isLong && trigger >= ltp) {
                // For long position exit (SELL), trigger should be below LTP
                return { valid: false, error: `For selling, trigger price should be below LTP (${formatCurrency(ltp)})` };
            }
            if (!isLong && trigger <= ltp) {
                // For short position exit (BUY), trigger should be above LTP
                return { valid: false, error: `For buying, trigger price should be above LTP (${formatCurrency(ltp)})` };
            }
        }

        return { valid: true, error: null };
    };

    // Handle exit order submission
    const handleSubmit = async () => {
        if (!position) return;

        const validation = validateInputs();
        if (!validation.valid) {
            if (showToast) showToast(validation.error, 'error');
            return;
        }

        setIsSubmitting(true);

        try {
            const exitOrder = {
                symbol: position.symbol,
                exchange: position.exchange,
                action: position.quantity > 0 ? 'SELL' : 'BUY', // Reverse action
                quantity: parseInt(exitQuantity),
                product: position.product,
                pricetype: orderType,
                price: (orderType === 'LIMIT' || orderType === 'SL') ? parseFloat(limitPrice) : 0,
                trigger_price: (orderType === 'SL' || orderType === 'SL-M') ? parseFloat(triggerPrice) : 0,
                strategy: 'EXIT_POSITION'
            };

            const result = await placeOrder(exitOrder);

            if (result.status === 'success') {
                if (showToast) {
                    showToast(`Exit order placed: ${result.orderid}`, 'success');
                }
                onClose();
                if (onExitComplete) {
                    onExitComplete();
                }
            } else {
                if (showToast) showToast(`Exit failed: ${result.message}`, 'error');
            }
        } catch (error) {
            console.error('Error placing exit order:', error);
            if (showToast) showToast('Failed to place exit order', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !position) return null;

    const pnl = parseFloat(position.pnl || 0);
    const pnlPercent = position.average_price > 0
        ? ((position.ltp - position.average_price) / position.average_price * 100 * (position.quantity > 0 ? 1 : -1))
        : 0;
    const isLong = position.quantity > 0;
    const exitAction = isLong ? 'SELL' : 'BUY';
    const lotsCount = lotSize > 1 ? Math.floor(Math.abs(parseInt(exitQuantity) || 0) / lotSize) : null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.header}>
                    <h2 className={styles.title}>Exit Position</h2>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                {/* Position Summary */}
                <div className={styles.positionSummary}>
                    <div className={styles.symbolRow}>
                        <span className={styles.symbolName}>{position.symbol}</span>
                        <span className={styles.exchange}>{position.exchange}</span>
                        <span className={styles.product}>{position.product}</span>
                    </div>
                    <div className={styles.statsRow}>
                        <div className={styles.stat}>
                            <span className={styles.statLabel}>Position</span>
                            <span className={`${styles.statValue} ${isLong ? styles.positive : styles.negative}`}>
                                {isLong ? 'LONG' : 'SHORT'} {Math.abs(position.quantity)}
                                {lotSize > 1 && (
                                    <span className={styles.lotsLabel}>
                                        ({Math.floor(Math.abs(position.quantity) / lotSize)}L)
                                    </span>
                                )}
                            </span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.statLabel}>Avg Price</span>
                            <span className={styles.statValue}>{formatCurrency(position.average_price)}</span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.statLabel}>LTP</span>
                            <span className={styles.statValue}>{formatCurrency(position.ltp)}</span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.statLabel}>P&L</span>
                            <span className={`${styles.statValue} ${pnl >= 0 ? styles.positive : styles.negative}`}>
                                {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                                <span className={styles.pnlPercent}>({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)</span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* Order Type Selection */}
                <div className={styles.section}>
                    <label className={styles.sectionLabel}>Order Type</label>
                    <div className={styles.orderTypeGrid}>
                        {ORDER_TYPES.map(type => (
                            <button
                                key={type.id}
                                className={`${styles.orderTypeBtn} ${orderType === type.id ? styles.active : ''}`}
                                onClick={() => setOrderType(type.id)}
                                title={type.description}
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>
                    <p className={styles.orderTypeDesc}>
                        {ORDER_TYPES.find(t => t.id === orderType)?.description}
                    </p>
                </div>

                {/* Quantity Input */}
                <div className={styles.section}>
                    <label className={styles.sectionLabel}>
                        Quantity
                        {lotSize > 1 && !isLoadingLotSize && (
                            <span className={styles.lotSizeLabel}>(Lot: {lotSize})</span>
                        )}
                    </label>
                    <div className={styles.quantityWrapper}>
                        <button
                            className={styles.qtyBtn}
                            onClick={() => adjustQuantity(-1)}
                            disabled={parseInt(exitQuantity) <= (lotSize || 1)}
                        >
                            <Minus size={16} />
                        </button>
                        <input
                            type="number"
                            className={styles.quantityInput}
                            value={exitQuantity}
                            onChange={(e) => setExitQuantity(e.target.value)}
                            min={lotSize || 1}
                            max={Math.abs(position.quantity)}
                            step={lotSize || 1}
                        />
                        <button
                            className={styles.qtyBtn}
                            onClick={() => adjustQuantity(1)}
                            disabled={parseInt(exitQuantity) >= Math.abs(position.quantity)}
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                    {lotsCount !== null && (
                        <p className={styles.lotsInfo}>
                            {lotsCount} {lotsCount === 1 ? 'Lot' : 'Lots'}
                        </p>
                    )}
                </div>

                {/* Limit Price (for LIMIT and SL orders) */}
                {(orderType === 'LIMIT' || orderType === 'SL') && (
                    <div className={styles.section}>
                        <label className={styles.sectionLabel}>Limit Price</label>
                        <div className={styles.inputWrapper}>
                            <span className={styles.inputPrefix}>₹</span>
                            <input
                                type="number"
                                className={styles.priceInput}
                                value={limitPrice}
                                onChange={(e) => setLimitPrice(e.target.value)}
                                placeholder="Enter limit price"
                                step="0.05"
                            />
                        </div>
                    </div>
                )}

                {/* Trigger Price (for SL and SL-M orders) */}
                {(orderType === 'SL' || orderType === 'SL-M') && (
                    <div className={styles.section}>
                        <label className={styles.sectionLabel}>Trigger Price</label>
                        <div className={styles.inputWrapper}>
                            <span className={styles.inputPrefix}>₹</span>
                            <input
                                type="number"
                                className={styles.priceInput}
                                value={triggerPrice}
                                onChange={(e) => setTriggerPrice(e.target.value)}
                                placeholder={isLong ? 'Below LTP for sell' : 'Above LTP for buy'}
                                step="0.05"
                            />
                        </div>
                        <p className={styles.triggerHint}>
                            <AlertTriangle size={12} />
                            {isLong
                                ? `Trigger should be below LTP (${formatCurrency(position.ltp)})`
                                : `Trigger should be above LTP (${formatCurrency(position.ltp)})`
                            }
                        </p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className={styles.actions}>
                    <button
                        className={styles.cancelBtn}
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        className={`${styles.submitBtn} ${isLong ? styles.btnSell : styles.btnBuy}`}
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Placing Order...' : `${exitAction} ${exitQuantity} Qty`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExitPositionModal;
