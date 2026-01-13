/**
 * OHLCHeader Component
 * Displays the symbol, interval, and OHLC data header bar
 */

import React from 'react';
import styles from './ChartComponent.module.css';

/**
 * OHLC Header bar component
 * @param {Object} props
 * @param {string} props.symbol - Current symbol
 * @param {string} props.exchange - Current exchange
 * @param {string} props.interval - Current interval
 * @param {Object} props.strategyConfig - Strategy configuration (optional)
 * @param {Object} props.ohlcData - OHLC data object
 * @param {boolean} props.isToolbarVisible - Whether toolbar is visible
 */
const OHLCHeader = ({
    symbol,
    exchange,
    interval,
    strategyConfig,
    ohlcData,
    isToolbarVisible
}) => {
    return (
        <div className={styles.ohlcHeader} style={{ left: isToolbarVisible ? '55px' : '10px' }}>
            <span className={styles.ohlcSymbol}>
                {strategyConfig?.displayName || `${symbol}:${exchange}`}
            </span>
            <span className={styles.ohlcInterval}>· {interval.toUpperCase()}</span>
            {ohlcData && (
                <>
                    <span className={`${styles.ohlcDot} ${ohlcData.isUp ? '' : styles.down}`}></span>
                    <div className={styles.ohlcValues}>
                        <span className={styles.ohlcItem}>
                            <span className={styles.ohlcLabel}>O</span>
                            <span className={styles.ohlcValue}>{ohlcData.open?.toFixed(2)}</span>
                        </span>
                        <span className={styles.ohlcItem}>
                            <span className={styles.ohlcLabel}>H</span>
                            <span className={styles.ohlcValue}>{ohlcData.high?.toFixed(2)}</span>
                        </span>
                        <span className={styles.ohlcItem}>
                            <span className={styles.ohlcLabel}>L</span>
                            <span className={styles.ohlcValue}>{ohlcData.low?.toFixed(2)}</span>
                        </span>
                        <span className={styles.ohlcItem}>
                            <span className={styles.ohlcLabel}>C</span>
                            <span className={`${styles.ohlcValue} ${ohlcData.isUp ? styles.up : styles.down}`}>
                                {ohlcData.close?.toFixed(2)}
                            </span>
                        </span>
                        <span className={styles.ohlcChange}>
                            <span className={`${styles.ohlcChangeValue} ${ohlcData.change >= 0 ? styles.up : styles.down}`}>
                                {ohlcData.change >= 0 ? '+' : ''}{ohlcData.change?.toFixed(2)} ({ohlcData.changePercent >= 0 ? '+' : ''}{ohlcData.changePercent?.toFixed(2)}%)
                            </span>
                        </span>
                    </div>
                </>
            )}
        </div>
    );
};

export default OHLCHeader;
