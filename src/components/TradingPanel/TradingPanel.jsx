import React, { useState, useEffect, useRef } from 'react';
import { Briefcase, X, Plus, Minus } from 'lucide-react';
import styles from './TradingPanel.module.css';
import { subscribeToTicker, placeOrder, getLotSize } from '../../services/openalgo';
import Toast from '../Toast/Toast';

const TradingPanel = ({ symbol, exchange = 'NSE', isOpen, onClose, showToast }) => {
    // Local State
    const [action, setAction] = useState('BUY'); // BUY | SELL
    const [orderType, setOrderType] = useState('MARKET'); // MARKET | LIMIT | SL | SL-M
    const [product, setProduct] = useState('MIS'); // MIS | CNC | NRML
    const [quantity, setQuantity] = useState('1');
    const [price, setPrice] = useState('');
    const [triggerPrice, setTriggerPrice] = useState('');

    // Lot Size State
    const [lotSize, setLotSize] = useState(1);
    const [isLoadingLotSize, setIsLoadingLotSize] = useState(false);

    // Market Data State
    const [ltp, setLtp] = useState(0);
    const [priceChange, setPriceChange] = useState(0);
    const [priceChangePercent, setPriceChangePercent] = useState(0);
    const [isSubscribed, setIsSubscribed] = useState(false);

    // UI State
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Check if F&O instrument (requires lot size handling)
    const isFnO = exchange === 'NFO' || exchange === 'MCX' || exchange === 'BFO' || exchange === 'CDS' || exchange === 'BCD';

    // Refs
    const unsubscribeRef = useRef(null);

    // Subscribe to Ticker when panel is open and symbol changes
    useEffect(() => {
        if (!isOpen || !symbol) return;

        // Reset subscription
        if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
        }

        setIsSubscribed(true);
        const sub = subscribeToTicker(symbol, exchange, '1d', (data) => {
            setLtp(data.close);
            // Calculate change if not provided directly (approximate based on open if previous close not avail)
            // Note: subscribeToTicker callback provides 'close' as current LTP
            // We might need to fetch full quote to get Change/Change% accurately or infer it
        });

        // The subscribeToTicker returns a subscription object with .close()
        unsubscribeRef.current = sub.close;

        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
            setIsSubscribed(false);
        };
    }, [isOpen, symbol, exchange]);

    // Fetch lot size when symbol/exchange changes
    useEffect(() => {
        if (!isOpen || !symbol) return;

        const fetchLotSize = async () => {
            setIsLoadingLotSize(true);
            try {
                const fetchedLotSize = await getLotSize(symbol, exchange);
                setLotSize(fetchedLotSize);
                // Auto-fill quantity with lot size for F&O instruments
                if (fetchedLotSize > 1) {
                    setQuantity(String(fetchedLotSize));
                } else {
                    setQuantity('1');
                }
            } catch (error) {
                console.error('Error fetching lot size:', error);
                setLotSize(1);
                setQuantity('1');
            } finally {
                setIsLoadingLotSize(false);
            }
        };

        fetchLotSize();
    }, [isOpen, symbol, exchange]);

    // Quantity adjustment functions
    const incrementQuantity = () => {
        const currentQty = parseInt(quantity, 10) || 0;
        setQuantity(String(currentQty + lotSize));
    };

    const decrementQuantity = () => {
        const currentQty = parseInt(quantity, 10) || 0;
        const newQty = currentQty - lotSize;
        if (newQty >= lotSize) {
            setQuantity(String(newQty));
        }
    };

    // Handle Order Placement
    const handleSubmit = async () => {
        if (!symbol || !quantity) {
            if (showToast) showToast('Please enter quantity', 'error');
            else alert('Please enter quantity');
            return;
        }

        // Basic Validation
        const qtyNum = parseInt(quantity, 10);
        if (isNaN(qtyNum) || qtyNum <= 0) {
            if (showToast) showToast('Invalid quantity', 'error');
            return;
        }

        // Lot size validation for F&O instruments
        if (lotSize > 1 && qtyNum % lotSize !== 0) {
            if (showToast) showToast(`Quantity must be a multiple of lot size (${lotSize})`, 'error');
            return;
        }

        if ((orderType === 'LIMIT' || orderType === 'SL') && (!price || parseFloat(price) <= 0)) {
            if (showToast) showToast('Invalid price for Limit order', 'error');
            return;
        }

        if ((orderType === 'SL' || orderType === 'SL-M') && (!triggerPrice || parseFloat(triggerPrice) <= 0)) {
            if (showToast) showToast('Invalid trigger price for Stop Loss order', 'error');
            return;
        }

        setIsSubmitting(true);

        const orderDetails = {
            symbol,
            exchange,
            action,
            quantity: qtyNum,
            product,
            pricetype: orderType,
            price: orderType === 'MARKET' ? 0 : price,
            trigger_price: (orderType === 'SL' || orderType === 'SL-M') ? triggerPrice : 0,
            strategy: 'MANUAL_PANEL'
        };

        try {
            const result = await placeOrder(orderDetails);
            if (result.status === 'success') {
                if (showToast) showToast(`Order Placed: ${result.orderid}`, 'success');
            } else {
                if (showToast) showToast(`Order Failed: ${result.message}`, 'error');
            }
        } catch (error) {
            if (showToast) showToast('Failed to place order', 'error');
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    // Helper to render price input availability
    const showPrice = orderType === 'LIMIT' || orderType === 'SL';
    const showTrigger = orderType === 'SL' || orderType === 'SL-M';

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.title}>
                    <Briefcase size={16} />
                    <span>Order Panel</span>
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.iconBtn} onClick={onClose} title="Close">
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Symbol Info */}
            <div className={styles.symbolSection}>
                <div className={styles.symbolInfo}>
                    <div>
                        <span className={styles.symbolName}>{symbol}</span>
                        <span className={styles.exchange}>{exchange}</span>
                    </div>
                    <div className={styles.priceDisplay}>
                        <div className={styles.ltp}>{ltp > 0 ? ltp.toFixed(2) : '--.--'}</div>
                    </div>
                </div>
                {/* Tabs can go here if we split Order / DOM */}
            </div>

            {/* Order Type Tabs */}
            <div className={styles.paddingH}>
                {/* Order / DOM Tabs - Visual Only for now */}
                <div className={styles.tabs}>
                    <div className={`${styles.tab} ${styles.activeTab}`}>Order</div>
                    <div className={styles.tab} onClick={() => { if (showToast) showToast('DOM View available in dedicated panel', 'info'); }}>DOM</div>
                </div>
            </div>

            {/* Action Toggles */}
            <div className={styles.actionToggles}>
                <button
                    className={`${styles.actionBtn} ${action === 'BUY' ? styles.activeBuy : ''}`}
                    onClick={() => setAction('BUY')}
                >
                    Buy
                </button>
                <button
                    className={`${styles.actionBtn} ${action === 'SELL' ? styles.activeSell : ''}`}
                    onClick={() => setAction('SELL')}
                >
                    Sell
                </button>
            </div>

            {/* Form */}
            <div className={styles.form}>

                {/* Order Type Selection */}
                <div className={styles.inputGroup}>
                    <label className={styles.label}>Order Type</label>
                    <div className={styles.typeTabs}>
                        {['MARKET', 'LIMIT', 'SL', 'SL-M'].map(t => (
                            <button
                                key={t}
                                className={`${styles.typeTab} ${orderType === t ? styles.activeType : ''}`}
                                onClick={() => setOrderType(t)}
                            >
                                {t.replace('SL-M', 'SL-M')}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Quantity */}
                <div className={styles.inputGroup}>
                    <label className={styles.label}>
                        Quantity
                        {lotSize > 1 && (
                            <span className={styles.lotSizeLabel}>
                                {isLoadingLotSize ? ' (Loading...)' : ` (Lot: ${lotSize})`}
                            </span>
                        )}
                    </label>
                    <div className={styles.quantityWrapper}>
                        <button
                            type="button"
                            className={styles.qtyBtn}
                            onClick={decrementQuantity}
                            disabled={parseInt(quantity, 10) <= lotSize}
                            title={`Decrease by ${lotSize}`}
                        >
                            <Minus size={14} />
                        </button>
                        <input
                            type="number"
                            className={styles.quantityInput}
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            min={lotSize}
                            step={lotSize}
                        />
                        <button
                            type="button"
                            className={styles.qtyBtn}
                            onClick={incrementQuantity}
                            title={`Increase by ${lotSize}`}
                        >
                            <Plus size={14} />
                        </button>
                    </div>
                    {lotSize > 1 && (
                        <div className={styles.lotsInfo}>
                            {Math.floor(parseInt(quantity, 10) / lotSize) || 0} lot(s) = {quantity} qty
                        </div>
                    )}
                </div>

                {/* Price (Conditional) */}
                {showPrice && (
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Price</label>
                        <div className={styles.inputWrapper}>
                            <input
                                type="number"
                                className={styles.input}
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                placeholder={ltp > 0 ? ltp.toFixed(2) : "0.00"}
                            />
                        </div>
                    </div>
                )}

                {/* Trigger Price (Conditional) */}
                {showTrigger && (
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Trigger Price</label>
                        <div className={styles.inputWrapper}>
                            <input
                                type="number"
                                className={styles.input}
                                value={triggerPrice}
                                onChange={(e) => setTriggerPrice(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                )}

                {/* Product */}
                <div className={styles.inputGroup}>
                    <label className={styles.label}>Product</label>
                    <select
                        className={styles.select}
                        value={product}
                        onChange={(e) => setProduct(e.target.value)}
                    >
                        <option value="MIS">Intraday (MIS)</option>
                        <option value="CNC">Longterm (CNC)</option>
                        <option value="NRML">Overnight (NRML)</option>
                    </select>
                </div>

                <div className={styles.marginInfo}>
                    <span>Required Margin</span>
                    <span>--</span>
                </div>
            </div>

            {/* Submit Button */}
            <div className={styles.footer}>
                <button
                    className={`${styles.submitBtn} ${action === 'BUY' ? styles.btnBuy : styles.btnSell}`}
                    disabled={isSubmitting}
                    onClick={handleSubmit}
                >
                    {isSubmitting ? 'Sending...' : `${action} ${symbol} ${orderType}`}
                </button>
            </div>
        </div>
    );
};

export default React.memo(TradingPanel);
