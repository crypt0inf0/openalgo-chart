/**
 * Template Manager - Handles saving, loading, and managing drawing style templates
 */

export interface StyleTemplate {
    id: string;              // UUID
    name: string;            // User-provided name
    created: number;         // Timestamp
    styles: {
        lineColor?: string;
        color?: string;
        width?: number;
        lineWidth?: number;
        opacity?: number;
        [key: string]: any;  // Allow other properties
    };
}

const STORAGE_KEY = 'lineTool_templates';
const MAX_TEMPLATES = 20;

export class TemplateManager {
    /**
     * Generate a unique ID for templates
     */
    private static generateId(): string {
        return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Load all templates from localStorage
     */
    static loadTemplates(): StyleTemplate[] {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return [];

            const templates = JSON.parse(stored);
            return Array.isArray(templates) ? templates : [];
        } catch (error) {
            console.error('Failed to load templates:', error);
            return [];
        }
    }

    /**
     * Save a new template
     */
    static saveTemplate(name: string, styles: object): StyleTemplate | null {
        try {
            const templates = this.loadTemplates();

            // Check max limit
            if (templates.length >= MAX_TEMPLATES) {
                console.warn(`Maximum ${MAX_TEMPLATES} templates reached`);
                return null;
            }

            // Create new template
            const template: StyleTemplate = {
                id: this.generateId(),
                name: name.trim() || `Template ${templates.length + 1}`,
                created: Date.now(),
                styles: { ...styles }
            };

            // Add to templates
            templates.push(template);

            // Save to localStorage
            localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));

            return template;
        } catch (error) {
            console.error('Failed to save template:', error);
            return null;
        }
    }

    /**
     * Delete a template by ID
     */
    static deleteTemplate(templateId: string): boolean {
        try {
            const templates = this.loadTemplates();
            const filtered = templates.filter(t => t.id !== templateId);

            if (filtered.length === templates.length) {
                return false; // Template not found
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
            return true;
        } catch (error) {
            console.error('Failed to delete template:', error);
            return false;
        }
    }

    /**
     * Get a template by ID
     */
    static getTemplate(templateId: string): StyleTemplate | null {
        const templates = this.loadTemplates();
        return templates.find(t => t.id === templateId) || null;
    }

    /**
     * Apply a template to a tool
     */
    static applyTemplate(templateId: string, tool: any): boolean {
        const template = this.getTemplate(templateId);
        if (!template || !tool || !tool.applyOptions) {
            return false;
        }

        try {
            tool.applyOptions(template.styles);
            return true;
        } catch (error) {
            console.error('Failed to apply template:', error);
            return false;
        }
    }

    /**
     * Extract styles from a tool's current options
     */
    static extractStyles(tool: any): object {
        if (!tool || !tool._options) {
            return {};
        }

        const options = tool._options;
        return {
            lineColor: options.lineColor,
            color: options.color,
            width: options.width,
            lineWidth: options.lineWidth,
            // Add other relevant style properties
        };
    }
}
