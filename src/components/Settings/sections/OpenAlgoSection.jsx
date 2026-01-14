/**
 * OpenAlgo Section Component
 * OpenAlgo connection settings for SettingsPopup
 */
import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import styles from '../SettingsPopup.module.css';

const OpenAlgoSection = ({
    localHostUrl,
    setLocalHostUrl,
    localApiKey,
    setLocalApiKey,
    localWsUrl,
    setLocalWsUrl,
    localUsername,
    setLocalUsername,
}) => {
    const [showApiKey, setShowApiKey] = useState(false);

    return (
        <div className={styles.section}>
            <h3 className={styles.sectionTitle}>OPENALGO CONNECTION</h3>

            <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Host URL</label>
                <input
                    type="text"
                    value={localHostUrl}
                    onChange={(e) => setLocalHostUrl(e.target.value)}
                    placeholder="http://127.0.0.1:5000"
                    className={styles.input}
                />
                <p className={styles.inputHint}>
                    Default: http://127.0.0.1:5000. Change to use a custom OpenAlgo server URL.
                </p>
            </div>

            <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>API Key</label>
                <div className={styles.inputWithIcon}>
                    <input
                        type={showApiKey ? "text" : "password"}
                        value={localApiKey}
                        onChange={(e) => setLocalApiKey(e.target.value)}
                        placeholder="Enter your OpenAlgo API key"
                        className={styles.input}
                    />
                    <button
                        type="button"
                        className={styles.eyeButton}
                        onClick={() => setShowApiKey(!showApiKey)}
                        title={showApiKey ? "Hide API key" : "Show API key"}
                    >
                        {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
                <p className={styles.inputHint}>
                    Find your API key in the{' '}
                    <a
                        href={`${localHostUrl}/apikey`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.link}
                    >
                        OpenAlgo Dashboard
                    </a>
                </p>
            </div>

            <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>WebSocket URL</label>
                <input
                    type="text"
                    value={localWsUrl}
                    onChange={(e) => setLocalWsUrl(e.target.value)}
                    placeholder="127.0.0.1:8765"
                    className={styles.input}
                />
                <p className={styles.inputHint}>
                    Default: 127.0.0.1:8765. Change to use a custom domain (e.g., openalgo.example.com:8765)
                </p>
            </div>

            <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>OpenAlgo Username</label>
                <input
                    type="text"
                    value={localUsername}
                    onChange={(e) => setLocalUsername(e.target.value)}
                    placeholder="Enter your OpenAlgo login username"
                    className={styles.input}
                />
                <p className={styles.inputHint}>
                    Your OpenAlgo login username (NOT Telegram username). Required for Telegram notifications.
                </p>
            </div>
        </div>
    );
};

export default OpenAlgoSection;
