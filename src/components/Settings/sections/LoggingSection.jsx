/**
 * Logging Section Component
 * Console logging settings for SettingsPopup
 */
import React from 'react';
import styles from '../SettingsPopup.module.css';
import { LOG_LEVELS, LOG_LEVEL_LABELS, setLogLevel } from '../../../utils/logger';

const LoggingSection = ({ logLevel, setLocalLogLevel }) => {
    return (
        <div className={styles.section}>
            <h3 className={styles.sectionTitle}>CONSOLE LOGGING</h3>

            <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Log Level</label>
                <select
                    value={logLevel}
                    onChange={(e) => {
                        const newLevel = parseInt(e.target.value, 10);
                        setLocalLogLevel(newLevel);
                        setLogLevel(newLevel);
                    }}
                    className={styles.select}
                >
                    {Object.entries(LOG_LEVELS).map(([name, value]) => (
                        <option key={name} value={value}>
                            {LOG_LEVEL_LABELS[value]}
                        </option>
                    ))}
                </select>
                <p className={styles.inputHint}>
                    Controls which messages appear in the browser console. Set to "Debug" for detailed troubleshooting.
                </p>
            </div>

            <div className={styles.optionGroup} style={{ marginTop: '16px' }}>
                <div className={styles.levelDescriptions}>
                    <p><strong>Debug:</strong> All messages including detailed tracing</p>
                    <p><strong>Info:</strong> General information and above</p>
                    <p><strong>Warnings:</strong> Warnings and errors only</p>
                    <p><strong>Errors:</strong> Only error messages</p>
                    <p><strong>None:</strong> Silent mode - no console output</p>
                </div>
            </div>
        </div>
    );
};

export default LoggingSection;
