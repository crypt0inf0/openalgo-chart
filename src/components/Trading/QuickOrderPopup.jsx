import React, { useState, useEffect, useRef } from 'react';
import styles from './QuickOrderPopup.module.css';
import classNames from 'classnames';
import { X } from 'lucide-react';
import { placeOrder } from '../../services/tradingService';

const QuickOrderPopup = ({
    isOpen,
    onClose,
    price,
    position, // { x, y } - screen position
    symbol,
    exchange = 'NSE',
    tradingMode = 'sandbox',
    onOrderPlaced,
}) => {
    const [quantity, setQuantity] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const popupRef = useRef(null);

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setError('');
            setIsSubmitting(false);
        }
    }, [isOpen]);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (popupRef.current && !popupRef.current.contains(e.target)) {
                onClose();
            }
        };
        if (isOpen) {
            setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 100); // Delay to prevent immediate close
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    // Escape key to close
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEsc);
        }
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    const handleOrder = async (action) => {
        setError('');
        setIsSubmitting(true);

        try {
            const orderParams = {
                symbol,
                exchange,
                action,
                product: 'MIS', // Intraday by default for quick orders
                pricetype: 'LIMIT',
                quantity: parseInt(quantity, 10),
                price: parseFloat(price),
            };

            await placeOrder(orderParams, tradingMode);
            onOrderPlaced?.({ ...orderParams, tradingMode });
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to place order');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !position) return null;

    // Calculate popup position (ensure it stays within viewport)
    const popupStyle = {
        left: Math.min(position.x, window.innerWidth - 220),
        top: Math.max(10, position.y - 80),
    };

    return (
        <div
            ref={popupRef}
            className={styles.popup}
            style={popupStyle}
        >
            {/* Header */}
            <div className={styles.header}>
                <span className={styles.symbol}>{symbol}</span>
                <button className={styles.closeBtn} onClick={onClose}>
                    <X size={14} />
                </button>
            </div>

            {/* Price */}
            <div className={styles.priceRow}>
                <span className={styles.priceLabel}>Limit @</span>
                <span className={styles.priceValue}>₹{parseFloat(price).toFixed(2)}</span>
            </div>

            {/* Quantity */}
            <div className={styles.qtyRow}>
                <button
                    className={styles.qtyBtn}
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                >−</button>
                <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className={styles.qtyInput}
                    min="1"
                />
                <button
                    className={styles.qtyBtn}
                    onClick={() => setQuantity(quantity + 1)}
                >+</button>
            </div>

            {/* Mode Indicator */}
            <div className={classNames(
                styles.modeIndicator,
                tradingMode === 'live' ? styles.live : styles.sandbox
            )}>
                {tradingMode === 'live' ? 'LIVE' : 'SANDBOX'}
            </div>

            {/* Error */}
            {error && <div className={styles.error}>{error}</div>}

            {/* Buy/Sell Buttons */}
            <div className={styles.actions}>
                <button
                    className={classNames(styles.actionBtn, styles.buyBtn)}
                    onClick={() => handleOrder('BUY')}
                    disabled={isSubmitting}
                >
                    BUY
                </button>
                <button
                    className={classNames(styles.actionBtn, styles.sellBtn)}
                    onClick={() => handleOrder('SELL')}
                    disabled={isSubmitting}
                >
                    SELL
                </button>
            </div>
        </div>
    );
};

export default QuickOrderPopup;
