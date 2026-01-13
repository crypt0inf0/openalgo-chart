/**
 * Keyboard Shortcuts Configuration
 * Single source of truth for all keyboard shortcuts in the application.
 */

/**
 * Shortcut Categories
 */
export const SHORTCUT_CATEGORIES = {
    NAVIGATION: 'navigation',
    CHART: 'chart',
    DRAWING: 'drawing',
    ZOOM: 'zoom',
    ACTIONS: 'actions',
};

/**
 * Category display labels
 */
export const CATEGORY_LABELS = {
    [SHORTCUT_CATEGORIES.NAVIGATION]: 'Navigation',
    [SHORTCUT_CATEGORIES.CHART]: 'Chart Types',
    [SHORTCUT_CATEGORIES.DRAWING]: 'Drawing Tools',
    [SHORTCUT_CATEGORIES.ZOOM]: 'Zoom',
    [SHORTCUT_CATEGORIES.ACTIONS]: 'Actions',
};

/**
 * All keyboard shortcuts
 *
 * Structure:
 * - key: The keyboard key (lowercase)
 * - modifiers: Array of modifier keys ['cmd', 'shift', 'alt']
 * - category: SHORTCUT_CATEGORIES value
 * - label: Display label for the shortcut
 * - action: Action identifier for handler mapping
 */
export const SHORTCUTS = {
    // Navigation
    openCommandPalette: {
        key: 'k',
        modifiers: ['cmd'],
        category: SHORTCUT_CATEGORIES.NAVIGATION,
        label: 'Open Command Palette',
        action: 'openCommandPalette',
    },
    openShortcutsHelp: {
        key: '?',
        modifiers: [],
        category: SHORTCUT_CATEGORIES.NAVIGATION,
        label: 'Keyboard Shortcuts',
        action: 'openShortcutsHelp',
    },
    openSymbolSearch: {
        key: 'p',
        modifiers: [],
        category: SHORTCUT_CATEGORIES.NAVIGATION,
        label: 'Symbol Search',
        action: 'openSymbolSearch',
    },
    closeDialog: {
        key: 'Escape',
        modifiers: [],
        category: SHORTCUT_CATEGORIES.NAVIGATION,
        label: 'Close / Cancel',
        action: 'closeDialog',
    },

    // Chart Types
    chartCandlestick: {
        key: '1',
        modifiers: [],
        category: SHORTCUT_CATEGORIES.CHART,
        label: 'Candlestick Chart',
        action: 'setChartType',
        payload: 'Candlestick',
    },
    chartBar: {
        key: '2',
        modifiers: [],
        category: SHORTCUT_CATEGORIES.CHART,
        label: 'Bar Chart',
        action: 'setChartType',
        payload: 'Bar',
    },
    chartHollowCandles: {
        key: '3',
        modifiers: [],
        category: SHORTCUT_CATEGORIES.CHART,
        label: 'Hollow Candles',
        action: 'setChartType',
        payload: 'Hollow candles',
    },
    chartLine: {
        key: '4',
        modifiers: [],
        category: SHORTCUT_CATEGORIES.CHART,
        label: 'Line Chart',
        action: 'setChartType',
        payload: 'Line',
    },
    chartArea: {
        key: '5',
        modifiers: [],
        category: SHORTCUT_CATEGORIES.CHART,
        label: 'Area Chart',
        action: 'setChartType',
        payload: 'Area',
    },
    chartBaseline: {
        key: '6',
        modifiers: [],
        category: SHORTCUT_CATEGORIES.CHART,
        label: 'Baseline Chart',
        action: 'setChartType',
        payload: 'Baseline',
    },
    chartHeikinAshi: {
        key: '7',
        modifiers: [],
        category: SHORTCUT_CATEGORIES.CHART,
        label: 'Heikin Ashi',
        action: 'setChartType',
        payload: 'Heikin Ashi',
    },

    // Drawing Tools
    activateDrawMode: {
        key: 'd',
        modifiers: [],
        category: SHORTCUT_CATEGORIES.DRAWING,
        label: 'Draw Mode',
        action: 'activateDrawMode',
    },
    activateCursorMode: {
        key: 'c',
        modifiers: [],
        category: SHORTCUT_CATEGORIES.DRAWING,
        label: 'Cursor Mode',
        action: 'activateCursorMode',
    },

    // Zoom
    zoomIn: {
        key: '+',
        modifiers: [],
        category: SHORTCUT_CATEGORIES.ZOOM,
        label: 'Zoom In',
        action: 'zoomIn',
        altKey: '=', // = without shift is also +
    },
    zoomOut: {
        key: '-',
        modifiers: [],
        category: SHORTCUT_CATEGORIES.ZOOM,
        label: 'Zoom Out',
        action: 'zoomOut',
    },

    // Actions
    undo: {
        key: 'z',
        modifiers: ['cmd'],
        category: SHORTCUT_CATEGORIES.ACTIONS,
        label: 'Undo',
        action: 'undo',
    },
    redo: {
        key: 'y',
        modifiers: ['cmd'],
        category: SHORTCUT_CATEGORIES.ACTIONS,
        label: 'Redo',
        action: 'redo',
    },
    createAlert: {
        key: 'a',
        modifiers: [],
        category: SHORTCUT_CATEGORIES.ACTIONS,
        label: 'Create Alert',
        action: 'createAlert',
    },
    toggleFullscreen: {
        key: 'F11',
        modifiers: [],
        category: SHORTCUT_CATEGORIES.ACTIONS,
        label: 'Toggle Fullscreen',
        action: 'toggleFullscreen',
    },
};

/**
 * Detect if running on macOS
 */
export const isMac = () => {
    if (typeof navigator === 'undefined') return false;
    return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
};

/**
 * Get the modifier key symbol for the current OS
 * @returns {string} Command symbol (⌘) for Mac, "Ctrl" for others
 */
export const getModifierKey = () => {
    return isMac() ? '⌘' : 'Ctrl';
};

/**
 * Format a shortcut for display
 * @param {Object} shortcutDef - Shortcut definition from SHORTCUTS
 * @returns {string} Formatted shortcut string (e.g., "⌘K" or "Ctrl+K")
 */
export const formatShortcut = (shortcutDef) => {
    if (!shortcutDef) return '';

    const parts = [];
    const mac = isMac();

    // Add modifiers
    if (shortcutDef.modifiers?.includes('cmd')) {
        parts.push(mac ? '⌘' : 'Ctrl');
    }
    if (shortcutDef.modifiers?.includes('shift')) {
        parts.push(mac ? '⇧' : 'Shift');
    }
    if (shortcutDef.modifiers?.includes('alt')) {
        parts.push(mac ? '⌥' : 'Alt');
    }

    // Add key
    let key = shortcutDef.key;

    // Format special keys
    if (key === 'Escape') key = 'Esc';
    else if (key === ' ') key = 'Space';
    else if (key.length === 1) key = key.toUpperCase();

    parts.push(key);

    // Use different separator for Mac vs Windows
    return mac ? parts.join('') : parts.join('+');
};

/**
 * Get shortcuts grouped by category
 * @returns {Object} Object with category keys and arrays of shortcuts
 */
export const getGroupedShortcuts = () => {
    const grouped = {};

    // Initialize categories in desired order
    Object.values(SHORTCUT_CATEGORIES).forEach(category => {
        grouped[category] = [];
    });

    // Group shortcuts by category
    Object.entries(SHORTCUTS).forEach(([id, shortcut]) => {
        if (grouped[shortcut.category]) {
            grouped[shortcut.category].push({
                id,
                ...shortcut,
                formatted: formatShortcut(shortcut),
            });
        }
    });

    return grouped;
};

/**
 * Check if a keyboard event matches a shortcut
 * @param {KeyboardEvent} event - The keyboard event
 * @param {Object} shortcutDef - Shortcut definition from SHORTCUTS
 * @returns {boolean} True if the event matches the shortcut
 */
export const matchesShortcut = (event, shortcutDef) => {
    if (!shortcutDef) return false;

    const mac = isMac();
    const pressedKey = event.key;

    // Check modifiers
    const cmdPressed = mac ? event.metaKey : event.ctrlKey;
    const altPressed = event.altKey;

    const needsCmd = shortcutDef.modifiers?.includes('cmd') || false;
    const needsAlt = shortcutDef.modifiers?.includes('alt') || false;

    if (cmdPressed !== needsCmd) return false;
    if (altPressed !== needsAlt) return false;

    // For keys that require shift to type (?, +, !, @, etc.),
    // we don't check shiftPressed because it's implicit in the key press
    const shiftRequiredKeys = ['?', '+', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '{', '}', '|', ':', '"', '<', '>', '~'];
    const isShiftImplicit = shiftRequiredKeys.includes(shortcutDef.key);

    if (!isShiftImplicit) {
        const shiftPressed = event.shiftKey;
        const needsShift = shortcutDef.modifiers?.includes('shift') || false;
        if (shiftPressed !== needsShift) return false;
    }

    // Check key match
    const targetKey = shortcutDef.key.toLowerCase();
    const eventKey = pressedKey.toLowerCase();

    if (eventKey === targetKey) return true;

    // Handle alternate keys (e.g., = for +)
    if (shortcutDef.altKey && eventKey === shortcutDef.altKey.toLowerCase()) {
        return true;
    }

    return false;
};

/**
 * Check if the event target is an input field
 * @param {Event} event - The event
 * @returns {boolean} True if typing in an input field
 */
export const isInputField = (event) => {
    const target = event.target;
    if (!target) return false;

    const tagName = target.tagName?.toLowerCase();
    const isEditable = target.isContentEditable;
    const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select';

    return isEditable || isInput;
};

// ============================================
// SHORTCUT CUSTOMIZATION - User-defined overrides
// ============================================

const CUSTOM_SHORTCUTS_KEY = 'custom_keyboard_shortcuts';

/**
 * Load user's custom shortcut overrides from localStorage
 * @returns {Object} Map of shortcut ID -> { key, modifiers }
 */
export const loadCustomShortcuts = () => {
    try {
        const saved = localStorage.getItem(CUSTOM_SHORTCUTS_KEY);
        return saved ? JSON.parse(saved) : {};
    } catch (e) {
        console.warn('Failed to load custom shortcuts:', e);
        return {};
    }
};

/**
 * Save user's custom shortcut overrides to localStorage
 * @param {Object} customizations - Map of shortcut ID -> { key, modifiers }
 */
export const saveCustomShortcuts = (customizations) => {
    try {
        localStorage.setItem(CUSTOM_SHORTCUTS_KEY, JSON.stringify(customizations));
    } catch (e) {
        console.warn('Failed to save custom shortcuts:', e);
    }
};

/**
 * Get effective shortcuts (defaults merged with user customizations)
 * @returns {Object} Complete shortcuts object with user overrides applied
 */
export const getEffectiveShortcuts = () => {
    const custom = loadCustomShortcuts();
    const effective = {};

    Object.entries(SHORTCUTS).forEach(([id, shortcut]) => {
        if (custom[id]) {
            // Merge user customization with default (keeps action, label, category)
            effective[id] = {
                ...shortcut,
                key: custom[id].key,
                modifiers: custom[id].modifiers || [],
            };
        } else {
            effective[id] = { ...shortcut };
        }
    });

    return effective;
};

/**
 * Update a single shortcut binding
 * @param {string} shortcutId - ID of the shortcut to update
 * @param {string} key - New key binding
 * @param {string[]} modifiers - New modifier keys
 * @returns {Object|null} Conflict info if there's a conflict, null otherwise
 */
export const updateShortcut = (shortcutId, key, modifiers = []) => {
    const custom = loadCustomShortcuts();
    const effective = getEffectiveShortcuts();

    // Check for conflicts with other shortcuts
    const newBinding = { key: key.toLowerCase(), modifiers: [...modifiers].sort() };

    for (const [id, shortcut] of Object.entries(effective)) {
        if (id === shortcutId) continue; // Skip self

        const existingBinding = {
            key: shortcut.key.toLowerCase(),
            modifiers: [...(shortcut.modifiers || [])].sort(),
        };

        // Check if key and modifiers match
        if (
            existingBinding.key === newBinding.key &&
            JSON.stringify(existingBinding.modifiers) === JSON.stringify(newBinding.modifiers)
        ) {
            return {
                conflict: true,
                conflictWith: id,
                conflictLabel: shortcut.label,
            };
        }
    }

    // No conflict, save the update
    custom[shortcutId] = { key, modifiers };
    saveCustomShortcuts(custom);
    return null;
};

/**
 * Reset a single shortcut to its default binding
 * @param {string} shortcutId - ID of the shortcut to reset
 */
export const resetShortcut = (shortcutId) => {
    const custom = loadCustomShortcuts();
    delete custom[shortcutId];
    saveCustomShortcuts(custom);
};

/**
 * Reset all shortcuts to their default bindings
 */
export const resetAllShortcuts = () => {
    saveCustomShortcuts({});
};

/**
 * Check if a shortcut has been customized
 * @param {string} shortcutId - ID of the shortcut
 * @returns {boolean} True if the shortcut has a custom binding
 */
export const isShortcutCustomized = (shortcutId) => {
    const custom = loadCustomShortcuts();
    return !!custom[shortcutId];
};

/**
 * Parse a keyboard event into a shortcut definition
 * @param {KeyboardEvent} event - The keyboard event
 * @returns {Object} { key, modifiers } or null if invalid
 */
export const parseKeyboardEvent = (event) => {
    // Ignore modifier-only key presses
    if (['Control', 'Alt', 'Shift', 'Meta', 'CapsLock', 'Tab'].includes(event.key)) {
        return null;
    }

    const modifiers = [];
    const mac = isMac();

    if (mac ? event.metaKey : event.ctrlKey) {
        modifiers.push('cmd');
    }
    if (event.altKey) {
        modifiers.push('alt');
    }
    if (event.shiftKey) {
        // Only add shift for letter/number keys, not for special chars
        const isShiftSpecialChar = /^[!@#$%^&*()_+{}|:"<>?~]$/.test(event.key);
        if (!isShiftSpecialChar) {
            modifiers.push('shift');
        }
    }

    return {
        key: event.key,
        modifiers,
    };
};

/**
 * Get all shortcuts that have been customized
 * @returns {Object} Map of shortcut ID -> custom binding
 */
export const getCustomizedShortcuts = () => {
    return loadCustomShortcuts();
};
