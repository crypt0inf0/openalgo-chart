import React, { createContext, useState, useContext, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

const ToolContext = createContext();

/**
 * Drawing tools that show the properties panel
 */
export const DRAWING_TOOLS = [
    'TrendLine',
    'HorizontalLine',
    'VerticalLine',
    'Rectangle',
    'Circle',
    'Path',
    'Text',
    'Callout',
    'PriceRange',
    'Arrow',
    'Ray',
    'ExtendedLine',
    'ParallelChannel',
    'FibonacciRetracement',
];

/**
 * ToolProvider - Manages drawing tool states
 * Centralizes tool-related state management
 */
export const ToolProvider = ({ children }) => {
    // Active drawing tool
    const [activeTool, setActiveTool] = useState(null);

    // Magnet mode for snapping to prices
    const [isMagnetMode, setIsMagnetMode] = useState(false);

    // Drawing toolbar visibility
    const [showDrawingToolbar, setShowDrawingToolbar] = useState(true);

    // Drawings visibility and lock state
    const [isDrawingsHidden, setIsDrawingsHidden] = useState(false);
    const [isDrawingsLocked, setIsDrawingsLocked] = useState(false);

    // Timer visibility (persisted)
    const [isTimerVisible, setIsTimerVisible] = useLocalStorage('oa_timer_visible', false);

    // Replay mode
    const [isReplayMode, setIsReplayMode] = useState(false);

    // Derived: Is drawing properties panel visible
    const isDrawingPanelVisible = activeTool && DRAWING_TOOLS.includes(activeTool);

    // Toggle drawing toolbar
    const toggleDrawingToolbar = useCallback(() => {
        setShowDrawingToolbar(prev => !prev);
    }, []);

    // Toggle magnet mode
    const toggleMagnetMode = useCallback(() => {
        setIsMagnetMode(prev => !prev);
    }, []);

    // Toggle drawings visibility
    const toggleDrawingsHidden = useCallback(() => {
        setIsDrawingsHidden(prev => !prev);
    }, []);

    // Toggle drawings lock
    const toggleDrawingsLocked = useCallback(() => {
        setIsDrawingsLocked(prev => !prev);
    }, []);

    // Toggle timer visibility
    const toggleTimerVisible = useCallback(() => {
        setIsTimerVisible(prev => !prev);
    }, [setIsTimerVisible]);

    // Clear tool selection
    const clearActiveTool = useCallback(() => {
        setActiveTool(null);
    }, []);

    // Select a tool
    const selectTool = useCallback((tool) => {
        if (tool === 'magnet') {
            toggleMagnetMode();
        } else if (tool === 'hide_drawings') {
            toggleDrawingsHidden();
            setActiveTool(tool);
        } else if (tool === 'lock_all') {
            toggleDrawingsLocked();
            setActiveTool(tool);
        } else if (tool === 'show_timer') {
            toggleTimerVisible();
            setActiveTool(tool);
        } else {
            setActiveTool(tool);
        }
    }, [toggleMagnetMode, toggleDrawingsHidden, toggleDrawingsLocked, toggleTimerVisible]);

    // Reset all tool states
    const resetToolState = useCallback(() => {
        setActiveTool(null);
        setIsDrawingsHidden(false);
        setIsDrawingsLocked(false);
    }, []);

    const value = {
        // Active tool
        activeTool,
        setActiveTool,
        clearActiveTool,
        selectTool,

        // Magnet mode
        isMagnetMode,
        setIsMagnetMode,
        toggleMagnetMode,

        // Toolbar visibility
        showDrawingToolbar,
        setShowDrawingToolbar,
        toggleDrawingToolbar,

        // Drawings state
        isDrawingsHidden,
        setIsDrawingsHidden,
        toggleDrawingsHidden,
        isDrawingsLocked,
        setIsDrawingsLocked,
        toggleDrawingsLocked,

        // Timer
        isTimerVisible,
        setIsTimerVisible,
        toggleTimerVisible,

        // Replay mode
        isReplayMode,
        setIsReplayMode,

        // Derived
        isDrawingPanelVisible,

        // Utilities
        resetToolState,
        DRAWING_TOOLS,
    };

    return (
        <ToolContext.Provider value={value}>
            {children}
        </ToolContext.Provider>
    );
};

/**
 * Hook to access tool context
 * @returns {Object} Tool state and handlers
 */
export const useTool = () => {
    const context = useContext(ToolContext);
    if (!context) {
        throw new Error('useTool must be used within a ToolProvider');
    }
    return context;
};

export default ToolContext;
