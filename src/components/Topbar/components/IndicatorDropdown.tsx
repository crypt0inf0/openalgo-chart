import React from 'react';
import type { MouseEvent } from 'react';
import { BaseDropdown, DropdownItem, DropdownDivider } from '../../shared';
import styles from '../Topbar.module.css';

interface Position {
    top: number;
    left: number;
}

export interface IndicatorDropdownProps {
    position: Position;
    onAddIndicator: (indicator: string) => void;
    onClose: () => void;
}

interface SectionHeaderProps {
    children: React.ReactNode;
}

interface IndicatorItemProps {
    id: string;
    label: string;
    onClick: (id: string) => void;
}

/**
 * Indicator Dropdown Component
 * Displays categorized list of available indicators
 */
export const IndicatorDropdown: React.FC<IndicatorDropdownProps> = ({ position, onAddIndicator, onClose }) => {
    const handleClick = (indicator: string): void => {
        onAddIndicator(indicator);
        // Dont close automatically to allow adding multiple indicators
    };

    const SectionHeader: React.FC<SectionHeaderProps> = ({ children }) => (
        <div className={styles.dropdownSection}>{children}</div>
    );

    const IndicatorItem: React.FC<IndicatorItemProps> = ({ id, label, onClick }) => (
        <DropdownItem
            label={label}
            onClick={(e?: MouseEvent) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                onClick(id);
            }}
        />
    );

    return (
        <BaseDropdown
            isOpen={true}
            onClose={onClose}
            position={{ top: position.top, left: position.left }}
            width={220}
            className={styles.indicatorDropdown}
        >
            <SectionHeader>Moving Averages</SectionHeader>
            <IndicatorItem id="sma" label="SMA" onClick={handleClick} />
            <IndicatorItem id="ema" label="EMA" onClick={handleClick} />

            <DropdownDivider />
            <SectionHeader>Oscillators</SectionHeader>
            <IndicatorItem id="rsi" label="RSI" onClick={handleClick} />
            <IndicatorItem id="stochastic" label="Stochastic" onClick={handleClick} />
            <IndicatorItem id="hilengaMilenga" label="Hilenga-Milenga" onClick={handleClick} />

            <DropdownDivider />
            <SectionHeader>Momentum</SectionHeader>
            <IndicatorItem id="macd" label="MACD" onClick={handleClick} />

            <DropdownDivider />
            <SectionHeader>Volatility</SectionHeader>
            <IndicatorItem id="bollingerBands" label="Bollinger Bands" onClick={handleClick} />
            <IndicatorItem id="atr" label="ATR" onClick={handleClick} />

            <DropdownDivider />
            <SectionHeader>Trend</SectionHeader>
            <IndicatorItem id="supertrend" label="Supertrend" onClick={handleClick} />
            <IndicatorItem id="ichimoku" label="Ichimoku Cloud" onClick={handleClick} />

            <DropdownDivider />
            <SectionHeader>Trend Strength</SectionHeader>
            <IndicatorItem id="adx" label="ADX" onClick={handleClick} />
            <IndicatorItem id="marketBias" label="Market Bias (CEREBR)" onClick={handleClick} />

            <DropdownDivider />
            <SectionHeader>Support/Resistance</SectionHeader>
            <IndicatorItem id="cpr" label="Central Pivot Range (CPR)" onClick={handleClick} />
            <IndicatorItem id="pivotPoints" label="Pivot Points" onClick={handleClick} />
            <IndicatorItem id="redCandleZones" label="Red Candle Zones" onClick={handleClick} />
            <IndicatorItem id="srVolumeBoxes" label="SR Volume Boxes" onClick={handleClick} />

            <DropdownDivider />
            <SectionHeader>Volume</SectionHeader>
            <IndicatorItem id="volume" label="Volume" onClick={handleClick} />
            <IndicatorItem id="vwap" label="VWAP" onClick={handleClick} />
            <IndicatorItem id="vwapBands" label="VWAP + Bands" onClick={handleClick} />

            <DropdownDivider />
            <SectionHeader>Market Profile</SectionHeader>
            <IndicatorItem id="tpo" label="TPO Profile (30m)" onClick={handleClick} />

            <DropdownDivider />
            <SectionHeader>Strategy</SectionHeader>
            <IndicatorItem id="firstCandle" label="First Red Candle" onClick={handleClick} />
            <IndicatorItem id="rangeBreakout" label="Range Breakout" onClick={handleClick} />
            <IndicatorItem id="annStrategy" label="ANN Strategy" onClick={handleClick} />

            <DropdownDivider />
            <SectionHeader>Risk Management</SectionHeader>
            <IndicatorItem id="riskCalculator" label="Risk Calculator" onClick={handleClick} />
        </BaseDropdown>
    );
};

export default IndicatorDropdown;
