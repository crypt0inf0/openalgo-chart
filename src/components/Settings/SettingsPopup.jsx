import React, { useState, useEffect, useCallback } from 'react';
import styles from './SettingsPopup.module.css';
import { X, Eye, EyeOff } from 'lucide-react';
import { LOG_LEVELS, LOG_LEVEL_LABELS, getLogLevel, setLogLevel } from '../../utils/logger';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useKeyboardNav } from '../../hooks/useKeyboardNav';

// Default chart appearance for reset
const DEFAULT_CHART_APPEARANCE = {
    candleUpColor: '#089981',
    candleDownColor: '#F23645',
    wickUpColor: '#089981',
    wickDownColor: '#F23645',
    showVerticalGridLines: true,
    showHorizontalGridLines: true,
    darkBackground: '#131722',
    lightBackground: '#ffffff',
    darkGridColor: '#2A2E39',
    lightGridColor: '#e0e3eb',
};

const SettingsPopup = ({
    isOpen,
    onClose,
    theme = 'dark',
    // Price Scale settings
    isTimerVisible = false,
    onTimerToggle,
    isSessionBreakVisible = false,
    onSessionBreakToggle,
    // OpenAlgo settings
    hostUrl = 'http://127.0.0.1:5000',
    onHostUrlSave,
    apiKey = '',
    onApiKeySave,
    websocketUrl = '127.0.0.1:8765',
    onWebsocketUrlSave,
    openalgoUsername = '',
    onUsernameSave,
    // Chart Appearance settings
    chartAppearance = DEFAULT_CHART_APPEARANCE,
    onChartAppearanceChange,
    onResetChartAppearance
}) => {
    // Logging state
    const [logLevel, setLocalLogLevel] = useState(getLogLevel);
    const [activeSection, setActiveSection] = useState('scales');
    const [localHostUrl, setLocalHostUrl] = useState(hostUrl);
    const [localApiKey, setLocalApiKey] = useState(apiKey);
    const [localWsUrl, setLocalWsUrl] = useState(websocketUrl);
    const [localUsername, setLocalUsername] = useState(openalgoUsername);
    const [hasChanges, setHasChanges] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [localAppearance, setLocalAppearance] = useState(chartAppearance);

    // Handle cancel - reset local state and close
    const handleCancel = useCallback(() => {
        setLocalHostUrl(hostUrl);
        setLocalApiKey(apiKey);
        setLocalWsUrl(websocketUrl);
        setLocalUsername(openalgoUsername);
        setLocalAppearance(chartAppearance);
        onClose();
    }, [hostUrl, apiKey, websocketUrl, openalgoUsername, chartAppearance, onClose]);

    // Focus trap for accessibility
    const focusTrapRef = useFocusTrap(isOpen);

    // Escape key to close
    useKeyboardNav({
        enabled: isOpen,
        onEscape: handleCancel,
    });

    // Sync local state with props
    useEffect(() => {
        setLocalHostUrl(hostUrl);
    }, [hostUrl]);

    useEffect(() => {
        setLocalApiKey(apiKey);
    }, [apiKey]);

    useEffect(() => {
        setLocalWsUrl(websocketUrl);
    }, [websocketUrl]);

    useEffect(() => {
        setLocalUsername(openalgoUsername);
    }, [openalgoUsername]);

    useEffect(() => {
        setLocalAppearance(chartAppearance);
    }, [chartAppearance]);

    // Track changes
    useEffect(() => {
        const hasHostChange = localHostUrl !== hostUrl;
        const hasApiKeyChange = localApiKey !== apiKey;
        const hasWsUrlChange = localWsUrl !== websocketUrl;
        const hasUsernameChange = localUsername !== openalgoUsername;
        const hasAppearanceChange = JSON.stringify(localAppearance) !== JSON.stringify(chartAppearance);
        setHasChanges(hasHostChange || hasApiKeyChange || hasWsUrlChange || hasUsernameChange || hasAppearanceChange);
    }, [localHostUrl, localApiKey, localWsUrl, localUsername, localAppearance, hostUrl, apiKey, websocketUrl, openalgoUsername, chartAppearance]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (localHostUrl !== hostUrl) {
            onHostUrlSave?.(localHostUrl);
        }
        if (localApiKey !== apiKey) {
            onApiKeySave?.(localApiKey);
        }
        if (localWsUrl !== websocketUrl) {
            onWebsocketUrlSave?.(localWsUrl);
        }
        if (localUsername !== openalgoUsername) {
            onUsernameSave?.(localUsername);
        }
        if (JSON.stringify(localAppearance) !== JSON.stringify(chartAppearance)) {
            onChartAppearanceChange?.(localAppearance);
        }
        onClose();
    };

    const handleResetAppearance = () => {
        setLocalAppearance(DEFAULT_CHART_APPEARANCE);
    };

    const sections = [
        {
            id: 'scales', label: 'Scales and lines', icon: (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="18" height="18" fill="none" stroke="currentColor">
                    <path d="M10.5 20.5a2 2 0 1 1-2-2m2 2a2 2 0 0 0-2-2m2 2h14m-16-2v-14m16 16L21 17m3.5 3.5L21 24M8.5 4.5L12 8M8.5 4.5L5 8"></path>
                </svg>
            )
        },
        {
            id: 'openalgo', label: 'OpenAlgo', icon: (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
                    <path d="M14 5a2 2 0 0 0-2 2v2h4V7a2 2 0 0 0-2-2Zm3 4V7a3 3 0 1 0-6 0v2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-8 2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-8Zm5 3a1 1 0 0 0-.5.13v-.13a.5.5 0 0 0-1 0v2.5a.5.5 0 0 0 1 0v-.13A1 1 0 1 0 14 14Z"></path>
                </svg>
            )
        },
        {
            id: 'logging', label: 'Logging', icon: (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
                    <path d="M4 6h20v2H4V6zm0 5h20v2H4v-2zm0 5h14v2H4v-2zm0 5h10v2H4v-2z"></path>
                </svg>
            )
        },
        {
            id: 'appearance', label: 'Appearance', icon: (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
                    <path d="M14 4a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM5 14a9 9 0 1 1 18 0 9 9 0 0 1-18 0Z" />
                    <path d="M14 8a6 6 0 0 0-6 6h12a6 6 0 0 0-6-6Z" />
                </svg>
            )
        }
    ];

    return (
        <div className={styles.overlay} onClick={handleCancel}>
            <div
                ref={focusTrapRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="settings-dialog-title"
                className={`${styles.popup} ${theme === 'light' ? styles.light : ''}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className={styles.header}>
                    <h2 id="settings-dialog-title" className={styles.title}>Settings</h2>
                    <button
                        className={styles.closeButton}
                        onClick={handleCancel}
                        aria-label="Close settings"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className={styles.content}>
                    {/* Sidebar */}
                    <div className={styles.sidebar}>
                        {sections.map((section) => (
                            <button
                                key={section.id}
                                className={`${styles.sidebarItem} ${activeSection === section.id ? styles.active : ''}`}
                                onClick={() => setActiveSection(section.id)}
                            >
                                <span className={styles.sidebarIcon}>{section.icon}</span>
                                <span className={styles.sidebarLabel}>{section.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Main Content Area */}
                    <div className={styles.main}>
                        {activeSection === 'scales' && (
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
                        )}

                        {activeSection === 'openalgo' && (
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
                        )}

                        {activeSection === 'logging' && (
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
                        )}

                        {activeSection === 'appearance' && (
                            <div className={styles.section}>
                                <h3 className={styles.sectionTitle}>CANDLE COLORS</h3>

                                <div className={styles.colorRow}>
                                    <label className={styles.colorLabel}>Up Color (Bullish)</label>
                                    <div className={styles.colorInputWrapper}>
                                        <input
                                            type="color"
                                            value={localAppearance.candleUpColor}
                                            onChange={(e) => setLocalAppearance(prev => ({ ...prev, candleUpColor: e.target.value, wickUpColor: e.target.value }))}
                                            className={styles.colorInput}
                                        />
                                        <input
                                            type="text"
                                            value={localAppearance.candleUpColor}
                                            onChange={(e) => {
                                                let val = e.target.value;
                                                if (!val.startsWith('#')) val = '#' + val;
                                                if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                                                    setLocalAppearance(prev => ({ ...prev, candleUpColor: val, wickUpColor: val }));
                                                }
                                            }}
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
                                            onChange={(e) => setLocalAppearance(prev => ({ ...prev, candleDownColor: e.target.value, wickDownColor: e.target.value }))}
                                            className={styles.colorInput}
                                        />
                                        <input
                                            type="text"
                                            value={localAppearance.candleDownColor}
                                            onChange={(e) => {
                                                let val = e.target.value;
                                                if (!val.startsWith('#')) val = '#' + val;
                                                if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                                                    setLocalAppearance(prev => ({ ...prev, candleDownColor: val, wickDownColor: val }));
                                                }
                                            }}
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
                                            onChange={(e) => setLocalAppearance(prev => ({ ...prev, darkBackground: e.target.value }))}
                                            className={styles.colorInput}
                                        />
                                        <input
                                            type="text"
                                            value={localAppearance.darkBackground}
                                            onChange={(e) => {
                                                let val = e.target.value;
                                                if (!val.startsWith('#')) val = '#' + val;
                                                if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                                                    setLocalAppearance(prev => ({ ...prev, darkBackground: val }));
                                                }
                                            }}
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
                                            onChange={(e) => setLocalAppearance(prev => ({ ...prev, lightBackground: e.target.value }))}
                                            className={styles.colorInput}
                                        />
                                        <input
                                            type="text"
                                            value={localAppearance.lightBackground}
                                            onChange={(e) => {
                                                let val = e.target.value;
                                                if (!val.startsWith('#')) val = '#' + val;
                                                if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                                                    setLocalAppearance(prev => ({ ...prev, lightBackground: val }));
                                                }
                                            }}
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
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className={styles.footer}>
                    <button className={styles.cancelButton} onClick={handleCancel}>
                        Cancel
                    </button>
                    <button
                        className={styles.okButton}
                        onClick={handleSave}
                    >
                        Ok
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsPopup;
