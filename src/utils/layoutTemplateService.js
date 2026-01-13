/**
 * Layout Template Service
 * Handles CRUD operations for layout templates with localStorage persistence
 */

import { getJSON, setJSON, STORAGE_KEYS } from '../services/storageService';

const MAX_TEMPLATES = 50;
const EXPORT_VERSION = '1.0';

/**
 * Generate unique template ID
 */
const generateId = () => `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

/**
 * Get all templates from localStorage
 * @returns {Array} Array of template objects
 */
export const getAll = () => {
    const saved = getJSON(STORAGE_KEYS.LAYOUT_TEMPLATES, []);
    return Array.isArray(saved) ? saved : [];
};

/**
 * Get template by ID
 * @param {string} id - Template ID
 * @returns {Object|null} Template object or null
 */
export const getById = (id) => {
    const templates = getAll();
    return templates.find(t => t.id === id) || null;
};

/**
 * Save templates to localStorage
 * @param {Array} templates - Array of templates
 */
const saveAll = (templates) => {
    return setJSON(STORAGE_KEYS.LAYOUT_TEMPLATES, templates);
};

/**
 * Save a new template or update existing
 * @param {Object} template - Template object (with or without id)
 * @returns {Object} Result with success flag and template/error
 */
export const save = (template) => {
    const templates = getAll();
    const now = new Date().toISOString();

    if (template.id) {
        // Update existing template
        const index = templates.findIndex(t => t.id === template.id);
        if (index === -1) {
            return { success: false, error: 'Template not found' };
        }
        templates[index] = {
            ...templates[index],
            ...template,
            updatedAt: now,
        };
    } else {
        // Create new template
        if (templates.length >= MAX_TEMPLATES) {
            return { success: false, error: `Maximum ${MAX_TEMPLATES} templates allowed. Please delete some templates first.` };
        }
        const newTemplate = {
            ...template,
            id: generateId(),
            createdAt: now,
            updatedAt: now,
            isFavorite: false,
        };
        templates.unshift(newTemplate); // Add to beginning
        if (saveAll(templates)) {
            return { success: true, template: newTemplate };
        }
        return { success: false, error: 'Failed to save template' };
    }

    if (saveAll(templates)) {
        return { success: true, template: templates.find(t => t.id === template.id) };
    }
    return { success: false, error: 'Failed to save template' };
};

/**
 * Delete a template by ID
 * @param {string} id - Template ID
 * @returns {Object} Result with success flag
 */
export const deleteTemplate = (id) => {
    const templates = getAll();
    const filtered = templates.filter(t => t.id !== id);

    if (filtered.length === templates.length) {
        return { success: false, error: 'Template not found' };
    }

    if (saveAll(filtered)) {
        return { success: true };
    }
    return { success: false, error: 'Failed to delete template' };
};

/**
 * Toggle favorite status for a template
 * @param {string} id - Template ID
 * @returns {Object} Result with success flag and updated template
 */
export const toggleFavorite = (id) => {
    const templates = getAll();
    const index = templates.findIndex(t => t.id === id);

    if (index === -1) {
        return { success: false, error: 'Template not found' };
    }

    templates[index] = {
        ...templates[index],
        isFavorite: !templates[index].isFavorite,
        updatedAt: new Date().toISOString(),
    };

    if (saveAll(templates)) {
        return { success: true, template: templates[index] };
    }
    return { success: false, error: 'Failed to update template' };
};

/**
 * Export all templates as JSON string
 * @returns {string} JSON string for download
 */
export const exportAll = () => {
    const templates = getAll();
    const exportData = {
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        templates,
    };
    return JSON.stringify(exportData, null, 2);
};

/**
 * Export a single template as JSON string
 * @param {string} id - Template ID
 * @returns {string|null} JSON string or null if not found
 */
export const exportOne = (id) => {
    const template = getById(id);
    if (!template) return null;

    const exportData = {
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        templates: [template],
    };
    return JSON.stringify(exportData, null, 2);
};

/**
 * Import templates from JSON string
 * @param {string} jsonString - JSON string to import
 * @returns {Object} Result with success flag, imported count, and errors
 */
export const importTemplates = (jsonString) => {
    let importData;
    try {
        importData = JSON.parse(jsonString);
    } catch {
        return { success: false, error: 'Invalid JSON format' };
    }

    if (!importData.templates || !Array.isArray(importData.templates)) {
        return { success: false, error: 'Invalid template format: missing templates array' };
    }

    const currentTemplates = getAll();
    const importedTemplates = [];
    const errors = [];

    for (const template of importData.templates) {
        if (!template.name || !template.layout || !template.charts) {
            errors.push(`Skipped invalid template: ${template.name || 'unnamed'}`);
            continue;
        }

        if (currentTemplates.length + importedTemplates.length >= MAX_TEMPLATES) {
            errors.push(`Maximum ${MAX_TEMPLATES} templates reached. Some templates were not imported.`);
            break;
        }

        // Generate new ID to avoid conflicts
        const newTemplate = {
            ...template,
            id: generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isFavorite: false,
        };
        importedTemplates.push(newTemplate);
    }

    if (importedTemplates.length > 0) {
        const allTemplates = [...importedTemplates, ...currentTemplates];
        if (saveAll(allTemplates)) {
            return {
                success: true,
                imported: importedTemplates.length,
                errors: errors.length > 0 ? errors : null,
            };
        }
        return { success: false, error: 'Failed to save imported templates' };
    }

    return {
        success: false,
        error: errors.length > 0 ? errors.join('; ') : 'No valid templates to import',
    };
};

/**
 * Capture current layout state as a template object
 * @param {Object} appState - Current app state
 * @param {string} name - Template name
 * @param {string} description - Optional description
 * @returns {Object} Template object (without id - will be added on save)
 */
export const captureCurrentLayout = (appState, name, description = '') => {
    const {
        layout,
        charts,
        chartType,
        chartAppearance,
        theme,
    } = appState;

    // Deep clone charts to avoid reference issues
    const chartsCopy = charts.map(chart => ({
        id: chart.id,
        symbol: chart.symbol,
        exchange: chart.exchange,
        interval: chart.interval,
        indicators: JSON.parse(JSON.stringify(chart.indicators || {})),
        comparisonSymbols: JSON.parse(JSON.stringify(chart.comparisonSymbols || [])),
    }));

    return {
        name,
        description,
        layout,
        chartType,
        charts: chartsCopy,
        appearance: {
            chartAppearance: chartAppearance ? JSON.parse(JSON.stringify(chartAppearance)) : null,
            theme,
        },
    };
};

/**
 * Get templates sorted with favorites first
 * @returns {Array} Sorted templates array
 */
export const getAllSorted = () => {
    const templates = getAll();
    return templates.sort((a, b) => {
        // Favorites first
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        // Then by updated date (newest first)
        return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
};

/**
 * Get count of templates
 * @returns {number} Number of templates
 */
export const getCount = () => getAll().length;

/**
 * Check if max templates reached
 * @returns {boolean} True if at max capacity
 */
export const isAtMaxCapacity = () => getCount() >= MAX_TEMPLATES;

/**
 * Get enabled indicators as display string
 * @param {Object} indicators - Indicators object
 * @returns {string} Comma-separated indicator names
 */
export const getIndicatorSummary = (indicators) => {
    if (!indicators) return '';

    const enabled = [];
    if (indicators.sma) enabled.push('SMA');
    if (indicators.ema) enabled.push('EMA');
    if (indicators.rsi?.enabled) enabled.push('RSI');
    if (indicators.macd?.enabled) enabled.push('MACD');
    if (indicators.bollingerBands?.enabled) enabled.push('BB');
    if (indicators.volume?.enabled) enabled.push('Vol');
    if (indicators.atr?.enabled) enabled.push('ATR');
    if (indicators.stochastic?.enabled) enabled.push('Stoch');
    if (indicators.vwap?.enabled) enabled.push('VWAP');

    return enabled.join(', ') || 'None';
};

// Export as service object for convenience
export const layoutTemplateService = {
    getAll,
    getAllSorted,
    getById,
    save,
    delete: deleteTemplate,
    toggleFavorite,
    exportAll,
    exportOne,
    importTemplates,
    captureCurrentLayout,
    getCount,
    isAtMaxCapacity,
    getIndicatorSummary,
    MAX_TEMPLATES,
};

export default layoutTemplateService;
