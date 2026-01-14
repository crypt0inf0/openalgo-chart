import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import classNames from 'classnames';
import styles from '../OptionChainPicker.module.css';

/**
 * Format LTP helper
 */
const formatLTP = (ltp) => {
    if (!ltp && ltp !== 0) return '-';
    return ltp.toFixed(1);
};

/**
 * LegBuilder Component
 * Displays and manages selected option legs
 */
export function LegBuilder({
    legs,
    netPremium,
    selectedTemplate,
    onToggleDirection,
    onRemoveLeg,
}) {
    if (legs.length === 0) return null;

    return (
        <div className={styles.legBuilder}>
            <div className={styles.legBuilderHeader}>
                <span>Selected Legs ({legs.length}/4)</span>
                <span className={classNames(styles.netPremium, { [styles.credit]: netPremium < 0 })}>
                    Net: {netPremium >= 0 ? `₹${netPremium.toFixed(2)} Debit` : `₹${Math.abs(netPremium).toFixed(2)} Credit`}
                </span>
            </div>
            <div className={styles.legsList}>
                {legs.map(leg => (
                    <div key={leg.id} className={styles.legItem}>
                        <button
                            className={classNames(styles.legDirection, {
                                [styles.buy]: leg.direction === 'buy',
                                [styles.sell]: leg.direction === 'sell'
                            })}
                            onClick={() => onToggleDirection(leg.id)}
                        >
                            {leg.direction === 'buy' ? 'B' : 'S'}
                        </button>
                        <span className={styles.legStrike}>{leg.strike}</span>
                        <span className={classNames(styles.legType, {
                            [styles.ce]: leg.type === 'CE',
                            [styles.pe]: leg.type === 'PE'
                        })}>
                            {leg.type}
                        </span>
                        <span className={styles.legLtp}>₹{formatLTP(leg.ltp)}</span>
                        <button className={styles.legRemove} onClick={() => onRemoveLeg(leg.id)}>
                            <Trash2 size={12} />
                        </button>
                    </div>
                ))}
                {legs.length < 4 && selectedTemplate === 'custom' && (
                    <div className={styles.addLegHint}>
                        <Plus size={14} />
                        <span>Click options to add legs</span>
                    </div>
                )}
            </div>
        </div>
    );
}

export default LegBuilder;
