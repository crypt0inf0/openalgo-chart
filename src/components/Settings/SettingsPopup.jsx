import React, { useState, useEffect, useCallback } from 'react';
import styles from './SettingsPopup.module.css';
import { X, Keyboard } from 'lucide-react';
import ShortcutsSettings from '../ShortcutsSettings/ShortcutsSettings';
import { getLogLevel } from '../../utils/logger';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useKeyboardNav } from '../../hooks/useKeyboardNav';

// Import extracted section components
import { ScalesSection, OpenAlgoSection, LoggingSection, AppearanceSection } from './sections';

// Import constants
import { DEFAULT_CHART_APPEARANCE } from './constants';

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
        },
        {
            id: 'shortcuts', label: 'Keyboard Shortcuts', icon: (
                <Keyboard size={18} />
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
                            <ScalesSection
                                isTimerVisible={isTimerVisible}
                                onTimerToggle={onTimerToggle}
                                isSessionBreakVisible={isSessionBreakVisible}
                                onSessionBreakToggle={onSessionBreakToggle}
                            />
                        )}

                        {activeSection === 'openalgo' && (
                            <OpenAlgoSection
                                localHostUrl={localHostUrl}
                                setLocalHostUrl={setLocalHostUrl}
                                localApiKey={localApiKey}
                                setLocalApiKey={setLocalApiKey}
                                localWsUrl={localWsUrl}
                                setLocalWsUrl={setLocalWsUrl}
                                localUsername={localUsername}
                                setLocalUsername={setLocalUsername}
                            />
                        )}

                        {activeSection === 'logging' && (
                            <LoggingSection
                                logLevel={logLevel}
                                setLocalLogLevel={setLocalLogLevel}
                            />
                        )}

                        {activeSection === 'appearance' && (
                            <AppearanceSection
                                localAppearance={localAppearance}
                                setLocalAppearance={setLocalAppearance}
                            />
                        )}

                        {activeSection === 'shortcuts' && (
                            <div className={styles.section}>
                                <ShortcutsSettings embedded={true} />
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
