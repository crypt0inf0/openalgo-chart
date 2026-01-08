import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getDepth } from '../../services/openalgo';
import { X, RefreshCw, Layers } from 'lucide-react';
import styles from './DepthOfMarket.module.css';

/**
 * Depth of Market (DOM) Panel
 * Displays 5 best bid/ask levels with price ladder visualization
 */
const DepthOfMarket = ({ symbol, exchange = 'NSE', isOpen, onClose }) => {
    const [depth, setDepth] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isPaused, setIsPaused] = useState(false);
    const intervalRef = useRef(null);
    const abortControllerRef = useRef(null);

    // Fetch depth data
    const fetchDepth = useCallback(async () => {
        if (!symbol || isPaused) return;

        // Abort previous request if still pending
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        try {
            const data = await getDepth(symbol, exchange, abortControllerRef.current.signal);
            if (data) {
                setDepth(data);
                setError(null);
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                setError('Failed to fetch depth');
                console.error('Depth fetch error:', err);
            }
        }
    }, [symbol, exchange, isPaused]);

    // Initial fetch and polling
    useEffect(() => {
        if (!isOpen || !symbol) return;

        setIsLoading(true);
        fetchDepth().finally(() => setIsLoading(false));

        // Poll every 500ms for real-time updates
        intervalRef.current = setInterval(fetchDepth, 500);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [isOpen, symbol, fetchDepth]);

    // Format number with commas
    const formatNumber = (num) => {
        if (num >= 10000000) return (num / 10000000).toFixed(2) + ' Cr';
        if (num >= 100000) return (num / 100000).toFixed(2) + ' L';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toLocaleString('en-IN');
    };

    // Format price
    const formatPrice = (price) => {
        return price.toFixed(2);
    };

    // Calculate max quantity for bar width scaling
    const getMaxQuantity = () => {
        if (!depth) return 1;
        const allQtys = [
            ...depth.asks.map(a => a.quantity),
            ...depth.bids.map(b => b.quantity)
        ];
        return Math.max(...allQtys, 1);
    };

    if (!isOpen) return null;

    const maxQty = getMaxQuantity();

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.title}>
                    <Layers size={16} />
                    <span>Depth of Market</span>
                </div>
                <div className={styles.headerActions}>
                    <button
                        className={`${styles.iconBtn} ${isPaused ? styles.paused : ''}`}
                        onClick={() => setIsPaused(!isPaused)}
                        title={isPaused ? 'Resume' : 'Pause'}
                    >
                        <RefreshCw size={14} className={!isPaused ? styles.spinning : ''} />
                    </button>
                    <button className={styles.iconBtn} onClick={onClose} title="Close">
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Symbol Info */}
            <div className={styles.symbolInfo}>
                <span className={styles.symbolName}>{symbol}</span>
                <span className={styles.exchange}>{exchange}</span>
            </div>

            {/* Loading/Error States */}
            {isLoading && !depth && (
                <div className={styles.loading}>Loading...</div>
            )}
            {error && (
                <div className={styles.error}>{error}</div>
            )}

            {/* Depth Table */}
            {depth && (
                <>
                    {/* Column Headers */}
                    <div className={styles.columnHeaders}>
                        <span className={styles.bidHeader}>BID QTY</span>
                        <span className={styles.priceHeader}>PRICE</span>
                        <span className={styles.askHeader}>ASK QTY</span>
                    </div>

                    {/* Price Ladder */}
                    <div className={styles.ladder}>
                        {/* Ask rows (reversed to show highest at top) */}
                        {[...depth.asks].reverse().map((ask, idx) => (
                            <div key={`ask-${idx}`} className={styles.row}>
                                <div className={styles.bidCell}></div>
                                <div className={styles.priceCell}>
                                    <span className={styles.askPrice}>{formatPrice(ask.price)}</span>
                                </div>
                                <div className={styles.askCell}>
                                    <div
                                        className={styles.askBar}
                                        style={{ width: `${(ask.quantity / maxQty) * 100}%` }}
                                    />
                                    <span className={styles.qty}>{formatNumber(ask.quantity)}</span>
                                </div>
                            </div>
                        ))}

                        {/* LTP Separator */}
                        <div className={styles.ltpRow}>
                            <div className={styles.ltpLine}></div>
                            <div className={styles.ltpBadge}>
                                <span>LTP</span>
                                <strong>{formatPrice(depth.ltp)}</strong>
                                {depth.ltq > 0 && <span className={styles.ltq}>x{formatNumber(depth.ltq)}</span>}
                            </div>
                            <div className={styles.ltpLine}></div>
                        </div>

                        {/* Bid rows */}
                        {depth.bids.map((bid, idx) => (
                            <div key={`bid-${idx}`} className={styles.row}>
                                <div className={styles.bidCell}>
                                    <div
                                        className={styles.bidBar}
                                        style={{ width: `${(bid.quantity / maxQty) * 100}%` }}
                                    />
                                    <span className={styles.qty}>{formatNumber(bid.quantity)}</span>
                                </div>
                                <div className={styles.priceCell}>
                                    <span className={styles.bidPrice}>{formatPrice(bid.price)}</span>
                                </div>
                                <div className={styles.askCell}></div>
                            </div>
                        ))}
                    </div>

                    {/* Summary Footer */}
                    <div className={styles.summary}>
                        <div className={styles.summaryItem}>
                            <span className={styles.buyLabel}>Total Buy</span>
                            <span className={styles.buyValue}>{formatNumber(depth.totalBuyQty)}</span>
                        </div>
                        <div className={styles.summaryItem}>
                            <span className={styles.sellLabel}>Total Sell</span>
                            <span className={styles.sellValue}>{formatNumber(depth.totalSellQty)}</span>
                        </div>
                    </div>

                    {/* Additional Info */}
                    <div className={styles.footer}>
                        <div className={styles.footerItem}>
                            <span>Vol:</span>
                            <span>{formatNumber(depth.volume)}</span>
                        </div>
                        {depth.oi > 0 && (
                            <div className={styles.footerItem}>
                                <span>OI:</span>
                                <span>{formatNumber(depth.oi)}</span>
                            </div>
                        )}
                        <div className={styles.footerItem}>
                            <span>H/L:</span>
                            <span>{formatPrice(depth.high)} / {formatPrice(depth.low)}</span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default React.memo(DepthOfMarket);
