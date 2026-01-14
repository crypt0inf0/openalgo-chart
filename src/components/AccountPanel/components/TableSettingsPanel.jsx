/**
 * TableSettingsPanel Component
 * Settings panel for AccountPanel table preferences
 */
import React from 'react';
import { X } from 'lucide-react';
import styles from '../AccountPanel.module.css';

const TableSettingsPanel = ({ preferences, onUpdate, onClose, position }) => {
    const handleToggleChange = (e) => {
        onUpdate('showSearchFilter', e.target.checked);
    };

    return (
        <div
            className={styles.settingsPanel}
            style={{
                top: `${position.top}px`,
                right: `${position.right}px`
            }}
        >
            {/* Header */}
            <div className={styles.settingsPanelHeader}>
                <h4>Table Settings</h4>
                <button
                    className={styles.modalCloseBtn}
                    onClick={onClose}
                    title="Close settings"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Body */}
            <div className={styles.settingsPanelBody}>
                <div className={styles.settingItem}>
                    <input
                        type="checkbox"
                        id="showSearchFilter"
                        checked={preferences.showSearchFilter}
                        onChange={handleToggleChange}
                    />
                    <label htmlFor="showSearchFilter" className={styles.settingLabel}>
                        <strong>Enable Search & Filters</strong>
                        <span>Show search bar and filter controls in all tables</span>
                    </label>
                </div>
            </div>

            {/* Footer */}
            <div className={styles.settingsPanelFooter}>
                <button
                    className={styles.primaryBtn}
                    onClick={onClose}
                >
                    Save & Close
                </button>
            </div>
        </div>
    );
};

export default TableSettingsPanel;
