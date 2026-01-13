// Template Manager for saving and loading drawing configurations
import { getJSON, setJSON, STORAGE_KEYS } from '../services/storageService';

export class TemplateManager {
    constructor() {
        this.templates = this.loadTemplates();
    }

    // Load templates from localStorage
    loadTemplates() {
        const saved = getJSON(STORAGE_KEYS.DRAWING_TEMPLATES, null);
        if (saved && typeof saved === 'object') {
            return saved;
        }
        return this.getDefaultTemplates();
    }

    // Get default built-in templates
    getDefaultTemplates() {
        return {
            'Support/Resistance': {
                id: 'default_sr',
                name: 'Support/Resistance',
                tool: 'horizontal',
                options: {
                    color: '#2196F3',
                    lineWidth: 2,
                },
                isDefault: true,
                icon: '📊'
            },
            'Fibonacci Golden': {
                id: 'default_fib',
                name: 'Fibonacci Golden',
                tool: 'fibonacci',
                options: {
                    color: '#FF9800',
                    lineWidth: 2,
                    levels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
                },
                isDefault: true,
                icon: '🔱'
            },
            'Bullish Pattern': {
                id: 'default_bull',
                name: 'Bullish Pattern',
                tool: 'trendline',
                options: {
                    color: '#4CAF50',
                    lineWidth: 2,
                    fillColor: 'rgba(76, 175, 80, 0.1)'
                },
                isDefault: true,
                icon: '📈'
            },
            'Bearish Pattern': {
                id: 'default_bear',
                name: 'Bearish Pattern',
                tool: 'trendline',
                options: {
                    color: '#F23645',
                    lineWidth: 2,
                    fillColor: 'rgba(242, 54, 69, 0.1)'
                },
                isDefault: true,
                icon: '📉'
            },
            'Key Level': {
                id: 'default_key',
                name: 'Key Level',
                tool: 'horizontal',
                options: {
                    color: '#FFEB3B',
                    lineWidth: 3,
                },
                isDefault: true,
                icon: '⭐'
            },
            'Trend Channel': {
                id: 'default_channel',
                name: 'Trend Channel',
                tool: 'parallel_channel',
                options: {
                    color: '#9C27B0',
                    lineWidth: 2,
                    fillColor: 'rgba(156, 39, 176, 0.1)'
                },
                isDefault: true,
                icon: '📐'
            }
        };
    }

    // Save a new template
    saveTemplate(name, tool, options, icon = '📌') {
        const id = `custom_${Date.now()}`;
        this.templates[name] = {
            id,
            name,
            tool,
            options: { ...options },
            isDefault: false,
            icon,
            createdAt: new Date().toISOString()
        };
        this.persist();
        return id;
    }

    // Delete a template (only custom templates can be deleted)
    deleteTemplate(name) {
        const template = this.templates[name];
        if (template && !template.isDefault) {
            delete this.templates[name];
            this.persist();
            return true;
        }
        return false;
    }

    // Update an existing template
    updateTemplate(name, updates) {
        const template = this.templates[name];
        if (template && !template.isDefault) {
            this.templates[name] = {
                ...template,
                ...updates,
                updatedAt: new Date().toISOString()
            };
            this.persist();
            return true;
        }
        return false;
    }

    // Get a template by name
    getTemplate(name) {
        return this.templates[name] || null;
    }

    // Get all templates
    getAllTemplates() {
        return Object.values(this.templates);
    }

    // Get only custom templates
    getCustomTemplates() {
        return Object.values(this.templates).filter(t => !t.isDefault);
    }

    // Get only default templates
    getDefaultTemplatesList() {
        return Object.values(this.templates).filter(t => t.isDefault);
    }

    // Apply a template (returns the options to use for a new drawing)
    applyTemplate(name) {
        const template = this.templates[name];
        if (template) {
            return {
                tool: template.tool,
                options: { ...template.options }
            };
        }
        return null;
    }

    // Persist templates to localStorage
    persist() {
        setJSON(STORAGE_KEYS.DRAWING_TEMPLATES, this.templates);
    }

    // Export templates as JSON file
    exportTemplates() {
        const customTemplates = this.getCustomTemplates();
        const dataStr = JSON.stringify(customTemplates, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

        const exportName = `tradingview-templates-${new Date().toISOString().split('T')[0]}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportName);
        linkElement.click();
    }

    // Import templates from JSON file
    importTemplates(jsonData) {
        try {
            const imported = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

            if (Array.isArray(imported)) {
                imported.forEach(template => {
                    if (template.name && template.tool && template.options) {
                        const name = template.name;
                        // Ensure we don't overwrite defaults
                        if (!this.templates[name] || !this.templates[name].isDefault) {
                            this.templates[name] = {
                                ...template,
                                isDefault: false,
                                importedAt: new Date().toISOString()
                            };
                        }
                    }
                });
                this.persist();
                return true;
            }
        } catch (error) {
            console.error('Error importing templates:', error);
        }
        return false;
    }

    // Get favorite templates (stored separately)
    getFavorites() {
        const saved = getJSON(STORAGE_KEYS.TEMPLATE_FAVORITES, []);
        return Array.isArray(saved) ? saved : [];
    }

    // Toggle favorite status
    toggleFavorite(templateName) {
        const favorites = this.getFavorites();
        const index = favorites.indexOf(templateName);

        if (index === -1) {
            favorites.push(templateName);
        } else {
            favorites.splice(index, 1);
        }

        setJSON(STORAGE_KEYS.TEMPLATE_FAVORITES, favorites);
        return favorites;
    }
}

export default TemplateManager;
