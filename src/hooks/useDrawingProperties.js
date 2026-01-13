import { useState, useEffect, useCallback } from 'react';
import { getJSON, setJSON, STORAGE_KEYS } from '../services/storageService';

/**
 * Default drawing options for line tools
 * Line styles: 0=Solid, 1=Dotted, 2=Dashed, 3=LargeDashed, 4=SparseDotted
 */
export const DEFAULT_DRAWING_OPTIONS = {
    lineColor: '#2962FF',
    backgroundColor: 'rgba(41, 98, 255, 0.2)',
    width: 2,
    lineStyle: 0,
    globalAlpha: 1.0,
};

/**
 * Line style constants with visual patterns
 */
export const LINE_STYLES = [
    { value: 0, label: 'Solid', pattern: [] },
    { value: 1, label: 'Dotted', pattern: [2, 2] },
    { value: 2, label: 'Dashed', pattern: [6, 6] },
    { value: 3, label: 'Large Dashed', pattern: [10, 10] },
    { value: 4, label: 'Sparse Dotted', pattern: [2, 10] },
];

/**
 * Preset colors for quick selection
 */
export const PRESET_COLORS = [
    '#2962FF', // Blue (default)
    '#089981', // Green (up)
    '#F23645', // Red (down)
    '#FF9800', // Orange
    '#9C27B0', // Purple
    '#00BCD4', // Cyan
    '#FFEB3B', // Yellow
    '#795548', // Brown
    '#607D8B', // Gray
    '#FFFFFF', // White
];

/**
 * Hook for managing drawing tool properties
 * @param {string|null} activeTool - Currently active drawing tool name
 * @returns {Object} Drawing properties state and handlers
 */
export const useDrawingProperties = (activeTool = null) => {
    // Drawing tools that should show the properties panel
    const DRAWING_TOOLS = [
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

    // Load defaults from localStorage
    const [defaults, setDefaults] = useState(() => {
        const saved = getJSON(STORAGE_KEYS.DRAWING_DEFAULTS, null);
        return saved ? { ...DEFAULT_DRAWING_OPTIONS, ...saved } : DEFAULT_DRAWING_OPTIONS;
    });

    // Persist to localStorage when defaults change
    useEffect(() => {
        setJSON(STORAGE_KEYS.DRAWING_DEFAULTS, defaults);
    }, [defaults]);

    // Check if panel should be visible
    const isPanelVisible = activeTool && DRAWING_TOOLS.includes(activeTool);

    // Update a single property
    const updateProperty = useCallback((property, value) => {
        setDefaults(prev => ({
            ...prev,
            [property]: value,
        }));
    }, []);

    // Update multiple properties at once
    const updateProperties = useCallback((updates) => {
        setDefaults(prev => ({
            ...prev,
            ...updates,
        }));
    }, []);

    // Reset to defaults
    const resetToDefaults = useCallback(() => {
        setDefaults(DEFAULT_DRAWING_OPTIONS);
    }, []);

    // Generate background color from line color with opacity
    const generateBackgroundColor = useCallback((lineColor, opacity = 0.2) => {
        // Handle hex colors
        if (lineColor.startsWith('#')) {
            const hex = lineColor.slice(1);
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        }
        // Return as-is for other formats
        return lineColor;
    }, []);

    return {
        // Current defaults
        defaults,

        // Panel visibility
        isPanelVisible,

        // Individual property values for convenience
        lineColor: defaults.lineColor,
        backgroundColor: defaults.backgroundColor,
        width: defaults.width,
        lineStyle: defaults.lineStyle,
        globalAlpha: defaults.globalAlpha,

        // Handlers
        updateProperty,
        updateProperties,
        resetToDefaults,
        setDefaults,

        // Utilities
        generateBackgroundColor,

        // Constants for UI
        LINE_STYLES,
        PRESET_COLORS,
    };
};

export default useDrawingProperties;
