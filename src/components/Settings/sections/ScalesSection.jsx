/**
 * Scales Section Component
 * Price scale settings for SettingsPopup
 */
import React from 'react';
import styles from '../SettingsPopup.module.css';

const ScalesSection = ({
    isTimerVisible,
    onTimerToggle,
    isSessionBreakVisible,
    onSessionBreakToggle,
}) => {
    return (
        <div className={styles.section}>
            <h3 className={styles.sectionTitle}>PRICE SCALE</h3>

            <div className={styles.optionGroup}>
                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        checked={isTimerVisible}
                        onChange={() => onTimerToggle?.()}
                        className={styles.checkbox}
                    />
                    <span className={styles.checkmark}></span>
                    <span>Countdown to bar close</span>
                </label>
            </div>

            <div className={styles.optionGroup}>
                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        checked={isSessionBreakVisible}
                        onChange={() => onSessionBreakToggle?.()}
                        className={styles.checkbox}
                    />
                    <span className={styles.checkmark}></span>
                    <span>Session breaks</span>
                </label>
            </div>
        </div>
    );
};

export default ScalesSection;
