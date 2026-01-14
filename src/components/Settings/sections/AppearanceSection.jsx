/**
 * Appearance Section Component
 * Chart appearance settings for SettingsPopup
 */
import React from 'react';
import styles from '../SettingsPopup.module.css';
import { DEFAULT_CHART_APPEARANCE } from '../constants/settingsConstants';

const AppearanceSection = ({ localAppearance, setLocalAppearance }) => {
    const handleResetAppearance = () => {
        setLocalAppearance(DEFAULT_CHART_APPEARANCE);
    };

    const handleColorChange = (field, value, linkedField = null) => {
        setLocalAppearance(prev => {
            const update = { ...prev, [field]: value };
            if (linkedField) {
                update[linkedField] = value;
            }
            return update;
        });
    };

    const handleHexInput = (field, value, linkedField = null) => {
        let val = value;
        if (!val.startsWith('#')) val = '#' + val;
        if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
            handleColorChange(field, val, linkedField);
        }
    };

    return (
        <div className={styles.section}>
            <h3 className={styles.sectionTitle}>CANDLE COLORS</h3>

            <div className={styles.colorRow}>
                <label className={styles.colorLabel}>Up Color (Bullish)</label>
                <div className={styles.colorInputWrapper}>
                    <input
                        type="color"
                        value={localAppearance.candleUpColor}
                        onChange={(e) => handleColorChange('candleUpColor', e.target.value, 'wickUpColor')}
                        className={styles.colorInput}
                    />
                    <input
                        type="text"
                        value={localAppearance.candleUpColor}
                        onChange={(e) => handleHexInput('candleUpColor', e.target.value, 'wickUpColor')}
                        className={styles.hexInput}
                        maxLength={7}
                        placeholder="#000000"
                    />
                </div>
            </div>

            <div className={styles.colorRow}>
                <label className={styles.colorLabel}>Down Color (Bearish)</label>
                <div className={styles.colorInputWrapper}>
                    <input
                        type="color"
                        value={localAppearance.candleDownColor}
                        onChange={(e) => handleColorChange('candleDownColor', e.target.value, 'wickDownColor')}
                        className={styles.colorInput}
                    />
                    <input
                        type="text"
                        value={localAppearance.candleDownColor}
                        onChange={(e) => handleHexInput('candleDownColor', e.target.value, 'wickDownColor')}
                        className={styles.hexInput}
                        maxLength={7}
                        placeholder="#000000"
                    />
                </div>
            </div>

            <h3 className={styles.sectionTitle} style={{ marginTop: '24px' }}>GRID LINES</h3>

            <div className={styles.optionGroup}>
                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        checked={localAppearance.showVerticalGridLines}
                        onChange={() => setLocalAppearance(prev => ({ ...prev, showVerticalGridLines: !prev.showVerticalGridLines }))}
                        className={styles.checkbox}
                    />
                    <span className={styles.checkmark}></span>
                    <span>Vertical grid lines</span>
                </label>
            </div>

            <div className={styles.optionGroup}>
                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        checked={localAppearance.showHorizontalGridLines}
                        onChange={() => setLocalAppearance(prev => ({ ...prev, showHorizontalGridLines: !prev.showHorizontalGridLines }))}
                        className={styles.checkbox}
                    />
                    <span className={styles.checkmark}></span>
                    <span>Horizontal grid lines</span>
                </label>
            </div>

            <h3 className={styles.sectionTitle} style={{ marginTop: '24px' }}>BACKGROUND COLOR</h3>

            <div className={styles.colorRow}>
                <label className={styles.colorLabel}>Dark Theme</label>
                <div className={styles.colorInputWrapper}>
                    <input
                        type="color"
                        value={localAppearance.darkBackground}
                        onChange={(e) => handleColorChange('darkBackground', e.target.value)}
                        className={styles.colorInput}
                    />
                    <input
                        type="text"
                        value={localAppearance.darkBackground}
                        onChange={(e) => handleHexInput('darkBackground', e.target.value)}
                        className={styles.hexInput}
                        maxLength={7}
                        placeholder="#000000"
                    />
                </div>
            </div>

            <div className={styles.colorRow}>
                <label className={styles.colorLabel}>Light Theme</label>
                <div className={styles.colorInputWrapper}>
                    <input
                        type="color"
                        value={localAppearance.lightBackground}
                        onChange={(e) => handleColorChange('lightBackground', e.target.value)}
                        className={styles.colorInput}
                    />
                    <input
                        type="text"
                        value={localAppearance.lightBackground}
                        onChange={(e) => handleHexInput('lightBackground', e.target.value)}
                        className={styles.hexInput}
                        maxLength={7}
                        placeholder="#000000"
                    />
                </div>
            </div>

            <button
                className={styles.resetButton}
                onClick={handleResetAppearance}
                style={{ marginTop: '24px' }}
            >
                Reset to Defaults
            </button>
        </div>
    );
};

export default AppearanceSection;
