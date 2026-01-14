import React from 'react';
import styles from '../Topbar.module.css';

/**
 * Indicator Dropdown Component
 * Displays categorized list of available indicators
 */
export function IndicatorDropdown({ position, onAddIndicator, onClose }) {
    const handleClick = (indicator) => {
        onAddIndicator(indicator);
    };

    return (
        <div
            className={styles.indicatorDropdown}
            style={{ top: position.top, left: position.left }}
        >
            <div className={styles.dropdownSection}>Moving Averages</div>
            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); handleClick('sma'); }}>SMA</div>
            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); handleClick('ema'); }}>EMA</div>

            <div className={styles.dropdownDivider}></div>
            <div className={styles.dropdownSection}>Oscillators</div>
            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); handleClick('rsi'); }}>RSI</div>
            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); handleClick('stochastic'); }}>Stochastic</div>
            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); handleClick('hilengaMilenga'); }}>Hilenga-Milenga</div>

            <div className={styles.dropdownDivider}></div>
            <div className={styles.dropdownSection}>Momentum</div>
            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); handleClick('macd'); }}>MACD</div>

            <div className={styles.dropdownDivider}></div>
            <div className={styles.dropdownSection}>Volatility</div>
            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); handleClick('bollingerBands'); }}>Bollinger Bands</div>
            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); handleClick('atr'); }}>ATR</div>

            <div className={styles.dropdownDivider}></div>
            <div className={styles.dropdownSection}>Trend</div>
            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); handleClick('supertrend'); }}>Supertrend</div>
            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); handleClick('ichimoku'); }}>Ichimoku Cloud</div>

            <div className={styles.dropdownDivider}></div>
            <div className={styles.dropdownSection}>Trend Strength</div>
            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); handleClick('adx'); }}>ADX</div>

            <div className={styles.dropdownDivider}></div>
            <div className={styles.dropdownSection}>Support/Resistance</div>
            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); handleClick('pivotPoints'); }}>Pivot Points</div>

            <div className={styles.dropdownDivider}></div>
            <div className={styles.dropdownSection}>Volume</div>
            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); handleClick('volume'); }}>Volume</div>
            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); handleClick('vwap'); }}>VWAP</div>

            <div className={styles.dropdownDivider}></div>
            <div className={styles.dropdownSection}>Market Profile</div>
            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); handleClick('tpo'); }}>TPO Profile (30m)</div>

            <div className={styles.dropdownDivider}></div>
            <div className={styles.dropdownSection}>Strategy</div>
            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); handleClick('firstCandle'); }}>First Red Candle</div>
            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); handleClick('rangeBreakout'); }}>Range Breakout</div>
            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); handleClick('annStrategy'); }}>ANN Strategy</div>
        </div>
    );
}

export default IndicatorDropdown;
