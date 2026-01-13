import React, { createContext, useState, useContext, useCallback } from 'react';

const UIContext = createContext();

/**
 * UIProvider - Manages all modal/dialog visibility states
 * Reduces prop drilling for UI state across the app
 */
export const UIProvider = ({ children }) => {
    // Search modal
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchMode, setSearchMode] = useState('switch'); // 'switch', 'add', 'compare'
    const [initialSearchValue, setInitialSearchValue] = useState('');

    // Command palette
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

    // Dialogs
    const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
    const [isShortcutsDialogOpen, setIsShortcutsDialogOpen] = useState(false);
    const [isChartTemplatesOpen, setIsChartTemplatesOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Options related
    const [isStraddlePickerOpen, setIsStraddlePickerOpen] = useState(false);
    const [isOptionChainOpen, setIsOptionChainOpen] = useState(false);
    const [optionChainInitialSymbol, setOptionChainInitialSymbol] = useState(null);

    // Alert dialog
    const [isAlertOpen, setIsAlertOpen] = useState(false);

    // Sector heatmap
    const [isSectorHeatmapOpen, setIsSectorHeatmapOpen] = useState(false);

    // Indicator settings
    const [isIndicatorSettingsOpen, setIsIndicatorSettingsOpen] = useState(false);

    // Toolbar visibility
    const [showDrawingToolbar, setShowDrawingToolbar] = useState(true);

    // Helper: Open search with specific mode
    const openSearch = useCallback((mode = 'switch', initialValue = '') => {
        setSearchMode(mode);
        setInitialSearchValue(initialValue);
        setIsSearchOpen(true);
    }, []);

    // Helper: Open option chain with symbol
    const openOptionChain = useCallback((symbol = null) => {
        setOptionChainInitialSymbol(symbol);
        setIsOptionChainOpen(true);
    }, []);

    // Helper: Close all modals (useful for Escape key)
    const closeAllModals = useCallback(() => {
        setIsSearchOpen(false);
        setIsCommandPaletteOpen(false);
        setIsTemplateDialogOpen(false);
        setIsShortcutsDialogOpen(false);
        setIsChartTemplatesOpen(false);
        setIsSettingsOpen(false);
        setIsStraddlePickerOpen(false);
        setIsOptionChainOpen(false);
        setIsAlertOpen(false);
        setIsSectorHeatmapOpen(false);
        setIsIndicatorSettingsOpen(false);
    }, []);

    // Helper: Close topmost modal (for Escape key priority)
    const closeTopmostModal = useCallback(() => {
        // Priority order (most recent/topmost first)
        if (isShortcutsDialogOpen) {
            setIsShortcutsDialogOpen(false);
            return true;
        }
        if (isCommandPaletteOpen) {
            setIsCommandPaletteOpen(false);
            return true;
        }
        if (isSearchOpen) {
            setIsSearchOpen(false);
            return true;
        }
        if (isAlertOpen) {
            setIsAlertOpen(false);
            return true;
        }
        if (isSettingsOpen) {
            setIsSettingsOpen(false);
            return true;
        }
        if (isTemplateDialogOpen) {
            setIsTemplateDialogOpen(false);
            return true;
        }
        if (isChartTemplatesOpen) {
            setIsChartTemplatesOpen(false);
            return true;
        }
        if (isStraddlePickerOpen) {
            setIsStraddlePickerOpen(false);
            return true;
        }
        if (isOptionChainOpen) {
            setIsOptionChainOpen(false);
            return true;
        }
        if (isSectorHeatmapOpen) {
            setIsSectorHeatmapOpen(false);
            return true;
        }
        if (isIndicatorSettingsOpen) {
            setIsIndicatorSettingsOpen(false);
            return true;
        }
        return false; // No modal was open
    }, [
        isShortcutsDialogOpen, isCommandPaletteOpen, isSearchOpen, isAlertOpen,
        isSettingsOpen, isTemplateDialogOpen, isChartTemplatesOpen,
        isStraddlePickerOpen, isOptionChainOpen, isSectorHeatmapOpen, isIndicatorSettingsOpen
    ]);

    // Check if any modal is open
    const hasOpenModal = isSearchOpen || isCommandPaletteOpen || isTemplateDialogOpen ||
        isShortcutsDialogOpen || isChartTemplatesOpen || isSettingsOpen ||
        isStraddlePickerOpen || isOptionChainOpen || isAlertOpen ||
        isSectorHeatmapOpen || isIndicatorSettingsOpen;

    const value = {
        // Search
        isSearchOpen,
        setIsSearchOpen,
        searchMode,
        setSearchMode,
        initialSearchValue,
        setInitialSearchValue,
        openSearch,

        // Command palette
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,

        // Dialogs
        isTemplateDialogOpen,
        setIsTemplateDialogOpen,
        isShortcutsDialogOpen,
        setIsShortcutsDialogOpen,
        isChartTemplatesOpen,
        setIsChartTemplatesOpen,
        isSettingsOpen,
        setIsSettingsOpen,

        // Options
        isStraddlePickerOpen,
        setIsStraddlePickerOpen,
        isOptionChainOpen,
        setIsOptionChainOpen,
        optionChainInitialSymbol,
        setOptionChainInitialSymbol,
        openOptionChain,

        // Alert
        isAlertOpen,
        setIsAlertOpen,

        // Sector heatmap
        isSectorHeatmapOpen,
        setIsSectorHeatmapOpen,

        // Indicator settings
        isIndicatorSettingsOpen,
        setIsIndicatorSettingsOpen,

        // Toolbar
        showDrawingToolbar,
        setShowDrawingToolbar,

        // Helpers
        closeAllModals,
        closeTopmostModal,
        hasOpenModal,
    };

    return (
        <UIContext.Provider value={value}>
            {children}
        </UIContext.Provider>
    );
};

/**
 * Hook to access UI context
 * @returns {Object} UI state and setters
 */
export const useUI = () => {
    const context = useContext(UIContext);
    if (!context) {
        throw new Error('useUI must be used within a UIProvider');
    }
    return context;
};

export default UIContext;
