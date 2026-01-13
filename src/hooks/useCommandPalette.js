import { useState, useEffect, useCallback, useMemo } from 'react';
import { fuzzySearch } from '../utils/fuzzySearch';
import { THEMES } from '../styles/themes';
import { getJSON, setJSON, STORAGE_KEYS } from '../services/storageService';

const MAX_RECENT = 5;

/**
 * Command categories
 */
export const COMMAND_CATEGORIES = {
    CHART: 'chart',
    INDICATOR: 'indicator',
    DRAWING: 'drawing',
    TOOL: 'tool',
    ACTION: 'action',
};

/**
 * Category display names and order
 */
export const CATEGORY_CONFIG = {
    [COMMAND_CATEGORIES.CHART]: { label: 'Chart Types', order: 1 },
    [COMMAND_CATEGORIES.INDICATOR]: { label: 'Indicators', order: 2 },
    [COMMAND_CATEGORIES.DRAWING]: { label: 'Drawing Tools', order: 3 },
    [COMMAND_CATEGORIES.TOOL]: { label: 'Tools', order: 4 },
    [COMMAND_CATEGORIES.ACTION]: { label: 'Actions', order: 5 },
};

/**
 * Build commands array from handlers
 */
const buildCommands = (handlers) => {
    const commands = [];

    // Chart type commands
    const chartTypes = [
        { id: 'candlestick', title: 'Candlestick', keywords: ['candle', 'ohlc'] },
        { id: 'bar', title: 'Bar Chart', keywords: ['bars', 'ohlc'] },
        { id: 'hollow-candlestick', title: 'Hollow Candles', keywords: ['hollow'] },
        { id: 'line', title: 'Line Chart', keywords: ['line'] },
        { id: 'area', title: 'Area Chart', keywords: ['area', 'filled'] },
        { id: 'baseline', title: 'Baseline', keywords: ['baseline', 'zero'] },
        { id: 'heikin-ashi', title: 'Heikin Ashi', keywords: ['heikin', 'ashi', 'ha'] },
        { id: 'renko', title: 'Renko', keywords: ['renko', 'brick', 'box'] },
    ];

    chartTypes.forEach((chart, index) => {
        commands.push({
            id: `chart.${chart.id}`,
            title: chart.title,
            category: COMMAND_CATEGORIES.CHART,
            keywords: ['chart', 'type', ...chart.keywords],
            shortcut: index < 7 ? `${index + 1}` : undefined,
            action: () => handlers.onChartTypeChange?.(chart.id),
        });
    });

    // Indicator commands
    const indicators = [
        { id: 'sma', title: 'SMA', description: 'Simple Moving Average', keywords: ['moving', 'average', 'simple'] },
        { id: 'ema', title: 'EMA', description: 'Exponential Moving Average', keywords: ['moving', 'average', 'exponential'] },
        { id: 'rsi', title: 'RSI', description: 'Relative Strength Index', keywords: ['relative', 'strength', 'oscillator'] },
        { id: 'macd', title: 'MACD', description: 'Moving Average Convergence Divergence', keywords: ['convergence', 'divergence', 'momentum'] },
        { id: 'bollingerBands', title: 'Bollinger Bands', description: 'Volatility Bands', keywords: ['bollinger', 'bands', 'volatility', 'bb'] },
        { id: 'volume', title: 'Volume', description: 'Volume Bars', keywords: ['volume', 'bars'] },
        { id: 'atr', title: 'ATR', description: 'Average True Range', keywords: ['average', 'true', 'range', 'volatility'] },
        { id: 'stochastic', title: 'Stochastic', description: 'Stochastic Oscillator', keywords: ['stochastic', 'oscillator', '%k', '%d'] },
        { id: 'vwap', title: 'VWAP', description: 'Volume Weighted Average Price', keywords: ['volume', 'weighted', 'average', 'price'] },
    ];

    indicators.forEach(indicator => {
        commands.push({
            id: `indicator.${indicator.id}`,
            title: indicator.title,
            description: indicator.description,
            category: COMMAND_CATEGORIES.INDICATOR,
            keywords: ['indicator', ...indicator.keywords],
            action: () => handlers.toggleIndicator?.(indicator.id),
        });
    });

    // Drawing tool commands
    const drawingTools = [
        { id: 'trendline', title: 'Trendline', keywords: ['trend', 'line', 'diagonal'] },
        { id: 'horizontal', title: 'Horizontal Line', keywords: ['horizontal', 'support', 'resistance'] },
        { id: 'vertical', title: 'Vertical Line', keywords: ['vertical'] },
        { id: 'ray', title: 'Ray', keywords: ['ray', 'line'] },
        { id: 'arrow', title: 'Arrow', keywords: ['arrow', 'pointer'] },
        { id: 'parallel_channel', title: 'Parallel Channel', keywords: ['channel', 'parallel'] },
        { id: 'fibonacci', title: 'Fibonacci Retracement', keywords: ['fibonacci', 'fib', 'retracement'] },
        { id: 'fib_extension', title: 'Fibonacci Extension', keywords: ['fibonacci', 'fib', 'extension'] },
        { id: 'rectangle', title: 'Rectangle', keywords: ['rectangle', 'box', 'shape'] },
        { id: 'circle', title: 'Circle', keywords: ['circle', 'ellipse', 'shape'] },
        { id: 'triangle', title: 'Triangle', keywords: ['triangle', 'shape'] },
        { id: 'text', title: 'Text', keywords: ['text', 'label', 'annotation'] },
        { id: 'callout', title: 'Callout', keywords: ['callout', 'bubble', 'annotation'] },
        { id: 'brush', title: 'Brush', keywords: ['brush', 'draw', 'freehand'] },
        { id: 'highlighter', title: 'Highlighter', keywords: ['highlighter', 'mark'] },
    ];

    drawingTools.forEach(tool => {
        commands.push({
            id: `drawing.${tool.id}`,
            title: tool.title,
            category: COMMAND_CATEGORIES.DRAWING,
            keywords: ['draw', 'drawing', ...tool.keywords],
            action: () => handlers.onToolChange?.(tool.id),
        });
    });

    // Tool commands
    const tools = [
        { id: 'cursor', title: 'Cursor', keywords: ['cursor', 'pointer', 'select'] },
        { id: 'eraser', title: 'Eraser', keywords: ['eraser', 'delete', 'remove'] },
        { id: 'zoom_in', title: 'Zoom In', keywords: ['zoom', 'in', 'magnify'] },
        { id: 'zoom_out', title: 'Zoom Out', keywords: ['zoom', 'out', 'shrink'] },
        { id: 'measure', title: 'Measure', keywords: ['measure', 'ruler', 'distance'] },
    ];

    tools.forEach(tool => {
        commands.push({
            id: `tool.${tool.id}`,
            title: tool.title,
            category: COMMAND_CATEGORIES.TOOL,
            keywords: ['tool', ...tool.keywords],
            action: () => handlers.onToolChange?.(tool.id),
        });
    });

    // Action commands
    commands.push(
        {
            id: 'action.search',
            title: 'Search Symbol',
            category: COMMAND_CATEGORIES.ACTION,
            keywords: ['search', 'symbol', 'find', 'ticker'],
            shortcut: 'P',
            action: () => handlers.openSymbolSearch?.('switch'),
        },
        {
            id: 'action.add',
            title: 'Add Symbol',
            category: COMMAND_CATEGORIES.ACTION,
            keywords: ['add', 'symbol', 'new'],
            action: () => handlers.openSymbolSearch?.('add'),
        },
        {
            id: 'action.compare',
            title: 'Compare Symbols',
            category: COMMAND_CATEGORIES.ACTION,
            keywords: ['compare', 'symbol', 'overlay'],
            action: () => handlers.openSymbolSearch?.('compare'),
        },
        {
            id: 'action.settings',
            title: 'Settings',
            category: COMMAND_CATEGORIES.ACTION,
            keywords: ['settings', 'preferences', 'config', 'options'],
            action: () => handlers.openSettings?.(),
        },
        {
            id: 'action.undo',
            title: 'Undo',
            category: COMMAND_CATEGORIES.ACTION,
            keywords: ['undo', 'back', 'revert'],
            shortcut: 'Z',
            action: () => handlers.onUndo?.(),
        },
        {
            id: 'action.redo',
            title: 'Redo',
            category: COMMAND_CATEGORIES.ACTION,
            keywords: ['redo', 'forward'],
            shortcut: 'Y',
            action: () => handlers.onRedo?.(),
        },
        {
            id: 'action.theme',
            title: 'Toggle Theme',
            category: COMMAND_CATEGORIES.ACTION,
            keywords: ['theme', 'dark', 'light', 'mode', 'toggle'],
            action: () => handlers.toggleTheme?.(),
        }
    );

    // Add commands for specific themes
    Object.values(THEMES).forEach(theme => {
        commands.push({
            id: `action.theme.${theme.id}`,
            title: `Switch to ${theme.name} Theme`,
            category: COMMAND_CATEGORIES.ACTION,
            keywords: ['theme', 'switch', theme.id, theme.name.toLowerCase()],
            action: () => handlers.setTheme?.(theme.id),
        });
    });

    commands.push(
        {
            id: 'action.fullscreen',
            title: 'Toggle Fullscreen',
            category: COMMAND_CATEGORIES.ACTION,
            keywords: ['fullscreen', 'full', 'screen', 'maximize'],
            shortcut: 'F11',
            action: () => handlers.toggleFullscreen?.(),
        },
        {
            id: 'action.screenshot',
            title: 'Take Screenshot',
            category: COMMAND_CATEGORIES.ACTION,
            keywords: ['screenshot', 'capture', 'image', 'download'],
            action: () => handlers.takeScreenshot?.(),
        },
        {
            id: 'action.copy',
            title: 'Copy Chart Image',
            category: COMMAND_CATEGORIES.ACTION,
            keywords: ['copy', 'clipboard', 'image'],
            action: () => handlers.copyImage?.(),
        },
        {
            id: 'action.alert',
            title: 'Create Alert',
            category: COMMAND_CATEGORIES.ACTION,
            keywords: ['alert', 'notification', 'price'],
            action: () => handlers.createAlert?.(),
        },
        {
            id: 'action.clear',
            title: 'Clear All Drawings',
            category: COMMAND_CATEGORIES.ACTION,
            keywords: ['clear', 'delete', 'remove', 'drawings', 'all'],
            action: () => handlers.clearDrawings?.(),
        },
        {
            id: 'action.reset_chart',
            title: 'Reset Chart',
            category: COMMAND_CATEGORIES.ACTION,
            keywords: ['reset', 'chart', 'default', 'restore'],
            action: () => handlers.resetChart?.(),
        },
        {
            id: 'action.shortcuts',
            title: 'Keyboard Shortcuts',
            category: COMMAND_CATEGORIES.ACTION,
            keywords: ['keyboard', 'shortcuts', 'keys', 'hotkeys', 'help'],
            shortcut: '?',
            action: () => handlers.openShortcutsDialog?.(),
        }
    );

    return commands;
};

/**
 * Hook for managing command palette state and commands
 * @param {Object} handlers - Object containing handler functions
 * @returns {Object} Command palette state and handlers
 */
export const useCommandPalette = (handlers) => {
    // Recent commands state
    const [recentCommandIds, setRecentCommandIds] = useState(() => {
        const saved = getJSON(STORAGE_KEYS.RECENT_COMMANDS, []);
        return Array.isArray(saved) ? saved : [];
    });

    // Build commands from handlers
    const commands = useMemo(() => buildCommands(handlers), [handlers]);

    // Persist recent commands to localStorage
    useEffect(() => {
        setJSON(STORAGE_KEYS.RECENT_COMMANDS, recentCommandIds);
    }, [recentCommandIds]);

    /**
     * Get recent commands (full command objects)
     */
    const recentCommands = useMemo(() => {
        return recentCommandIds
            .map(id => commands.find(cmd => cmd.id === id))
            .filter(Boolean);
    }, [recentCommandIds, commands]);

    /**
     * Add command to recent history
     */
    const addToRecent = useCallback((commandId) => {
        setRecentCommandIds(prev => {
            const filtered = prev.filter(id => id !== commandId);
            return [commandId, ...filtered].slice(0, MAX_RECENT);
        });
    }, []);

    /**
     * Search commands using fuzzy matching
     */
    const searchCommands = useCallback((query) => {
        if (!query || query.trim() === '') {
            return commands;
        }

        // Search by title and keywords
        return fuzzySearch(query, commands, ['title', 'description'], 0.2);
    }, [commands]);

    /**
     * Execute a command and track in recent
     */
    const executeCommand = useCallback((command) => {
        if (command && command.action) {
            addToRecent(command.id);
            command.action();
        }
    }, [addToRecent]);

    /**
     * Group commands by category
     */
    const groupedCommands = useMemo(() => {
        const groups = {};

        commands.forEach(cmd => {
            if (!groups[cmd.category]) {
                groups[cmd.category] = [];
            }
            groups[cmd.category].push(cmd);
        });

        // Sort groups by category order
        const sortedGroups = Object.entries(groups)
            .sort(([a], [b]) => {
                return (CATEGORY_CONFIG[a]?.order || 99) - (CATEGORY_CONFIG[b]?.order || 99);
            })
            .map(([category, cmds]) => ({
                category,
                label: CATEGORY_CONFIG[category]?.label || category,
                commands: cmds,
            }));

        return sortedGroups;
    }, [commands]);

    /**
     * Clear recent commands
     */
    const clearRecent = useCallback(() => {
        setRecentCommandIds([]);
    }, []);

    return {
        // All commands
        commands,

        // Recent commands
        recentCommands,
        recentCommandIds,

        // Grouped commands
        groupedCommands,

        // Actions
        searchCommands,
        executeCommand,
        addToRecent,
        clearRecent,

        // Categories
        COMMAND_CATEGORIES,
        CATEGORY_CONFIG,
    };
};

export default useCommandPalette;
