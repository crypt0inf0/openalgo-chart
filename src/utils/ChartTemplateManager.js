/**
 * ChartTemplateManager - Manages saved chart templates
 * Templates store complete chart configurations: indicators, chart type, appearance settings
 */

const STORAGE_KEY = 'chart_templates';

/**
 * Template structure:
 * {
 *     id: string (UUID),
 *     name: string,
 *     createdAt: ISO string,
 *     updatedAt: ISO string,
 *     chartType: 'Candlestick' | 'Bar' | 'Line' | 'Area' | 'Baseline' | 'HeikinAshi' | 'Renko',
 *     indicators: Array<{ type: string, settings: object }>,
 *     appearance: {
 *         theme: string,
 *         showGrid: boolean,
 *         showVolume: boolean,
 *         upColor: string,
 *         downColor: string,
 *         ...other appearance settings
 *     },
 *     isDefault: boolean (optional)
 * }
 */

class ChartTemplateManager {
    constructor() {
        this._templates = null;
        this._listeners = new Set();
    }

    /**
     * Generate a unique ID
     */
    _generateId() {
        return 'tpl_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get all templates from storage
     * @returns {Array} List of templates
     */
    getAllTemplates() {
        if (this._templates === null) {
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                this._templates = saved ? JSON.parse(saved) : [];
            } catch (e) {
                console.warn('Failed to load chart templates:', e);
                this._templates = [];
            }
        }
        return [...this._templates];
    }

    /**
     * Save templates to storage
     */
    _saveTemplates() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this._templates));
            this._notifyListeners();
        } catch (e) {
            console.warn('Failed to save chart templates:', e);
        }
    }

    /**
     * Get a template by ID
     * @param {string} id - Template ID
     * @returns {Object|null} Template or null if not found
     */
    getTemplate(id) {
        const templates = this.getAllTemplates();
        return templates.find(t => t.id === id) || null;
    }

    /**
     * Save a new template
     * @param {string} name - Template name
     * @param {Object} config - Chart configuration
     * @returns {Object} The saved template
     */
    saveTemplate(name, config) {
        const templates = this.getAllTemplates();

        const template = {
            id: this._generateId(),
            name: name.trim(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            chartType: config.chartType || 'Candlestick',
            indicators: this._serializeIndicators(config.indicators || []),
            appearance: config.appearance || {},
            isDefault: false,
        };

        this._templates = [...templates, template];
        this._saveTemplates();

        return template;
    }

    /**
     * Update an existing template
     * @param {string} id - Template ID
     * @param {Object} updates - Fields to update
     * @returns {Object|null} Updated template or null if not found
     */
    updateTemplate(id, updates) {
        const templates = this.getAllTemplates();
        const index = templates.findIndex(t => t.id === id);

        if (index === -1) return null;

        const template = {
            ...templates[index],
            ...updates,
            updatedAt: new Date().toISOString(),
        };

        // Re-serialize indicators if updated
        if (updates.indicators) {
            template.indicators = this._serializeIndicators(updates.indicators);
        }

        this._templates = [...templates];
        this._templates[index] = template;
        this._saveTemplates();

        return template;
    }

    /**
     * Delete a template
     * @param {string} id - Template ID
     * @returns {boolean} True if deleted
     */
    deleteTemplate(id) {
        const templates = this.getAllTemplates();
        const filtered = templates.filter(t => t.id !== id);

        if (filtered.length === templates.length) return false;

        this._templates = filtered;
        this._saveTemplates();

        return true;
    }

    /**
     * Rename a template
     * @param {string} id - Template ID
     * @param {string} newName - New name
     * @returns {Object|null} Updated template or null if not found
     */
    renameTemplate(id, newName) {
        return this.updateTemplate(id, { name: newName.trim() });
    }

    /**
     * Set a template as default
     * @param {string} id - Template ID to set as default (null to clear)
     */
    setDefaultTemplate(id) {
        const templates = this.getAllTemplates();

        this._templates = templates.map(t => ({
            ...t,
            isDefault: t.id === id,
        }));

        this._saveTemplates();
    }

    /**
     * Get the default template
     * @returns {Object|null} Default template or null if none set
     */
    getDefaultTemplate() {
        const templates = this.getAllTemplates();
        return templates.find(t => t.isDefault) || null;
    }

    /**
     * Serialize indicators for storage
     * Removes calculated data, keeps only configuration
     */
    _serializeIndicators(indicators) {
        return indicators.map(ind => ({
            type: ind.type,
            visible: ind.visible !== false,
            settings: { ...ind.settings },
            // Copy all non-function properties except 'data' and 'series'
            ...Object.fromEntries(
                Object.entries(ind).filter(([key, value]) =>
                    !['type', 'visible', 'settings', 'data', 'series', '_hash'].includes(key) &&
                    typeof value !== 'function'
                )
            ),
        }));
    }

    /**
     * Export all templates as JSON
     * @returns {string} JSON string
     */
    exportTemplates() {
        return JSON.stringify({
            version: 1,
            exportedAt: new Date().toISOString(),
            templates: this.getAllTemplates(),
        }, null, 2);
    }

    /**
     * Import templates from JSON
     * @param {string} jsonString - JSON string to import
     * @param {boolean} merge - If true, merge with existing; if false, replace all
     * @returns {Object} { imported: number, errors: string[] }
     */
    importTemplates(jsonString, merge = true) {
        const result = { imported: 0, errors: [] };

        try {
            const data = JSON.parse(jsonString);

            if (!data.templates || !Array.isArray(data.templates)) {
                result.errors.push('Invalid template file format');
                return result;
            }

            const existing = merge ? this.getAllTemplates() : [];
            const existingNames = new Set(existing.map(t => t.name.toLowerCase()));
            const newTemplates = [];

            for (const template of data.templates) {
                // Validate required fields
                if (!template.name || !template.chartType) {
                    result.errors.push(`Skipped invalid template: missing name or chartType`);
                    continue;
                }

                // Handle name conflicts
                let name = template.name;
                if (existingNames.has(name.toLowerCase())) {
                    name = `${name} (imported)`;
                }

                newTemplates.push({
                    ...template,
                    id: this._generateId(),
                    name,
                    isDefault: false, // Don't import default status
                    updatedAt: new Date().toISOString(),
                });

                result.imported++;
                existingNames.add(name.toLowerCase());
            }

            this._templates = [...existing, ...newTemplates];
            this._saveTemplates();

        } catch (e) {
            result.errors.push(`Parse error: ${e.message}`);
        }

        return result;
    }

    /**
     * Add a listener for template changes
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
        this._listeners.add(callback);
        return () => this._listeners.delete(callback);
    }

    /**
     * Notify all listeners of changes
     */
    _notifyListeners() {
        const templates = this.getAllTemplates();
        this._listeners.forEach(cb => cb(templates));
    }

    /**
     * Clear all templates
     */
    clearAll() {
        this._templates = [];
        this._saveTemplates();
    }
}

// Singleton instance
export const chartTemplateManager = new ChartTemplateManager();
export default chartTemplateManager;
