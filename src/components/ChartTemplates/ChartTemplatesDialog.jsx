import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './ChartTemplatesDialog.module.css';
import { chartTemplateManager } from '../../utils/ChartTemplateManager';
import {
    Save,
    Trash2,
    Upload,
    Download,
    Star,
    StarOff,
    Edit2,
    Check,
    X,
    LayoutTemplate,
    Clock,
    ChevronRight
} from 'lucide-react';

/**
 * ChartTemplatesDialog Component
 * Manages saved chart templates - view, save, load, delete, import/export
 */
const ChartTemplatesDialog = ({
    isOpen,
    onClose,
    currentConfig,      // { chartType, indicators, appearance }
    onLoadTemplate,     // (template) => void
}) => {
    const [templates, setTemplates] = useState([]);
    const [saveName, setSaveName] = useState('');
    const [showSaveForm, setShowSaveForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(null);
    const fileInputRef = useRef(null);

    // Load templates on mount and listen for changes
    useEffect(() => {
        if (isOpen) {
            setTemplates(chartTemplateManager.getAllTemplates());
        }

        const unsubscribe = chartTemplateManager.subscribe((newTemplates) => {
            setTemplates(newTemplates);
        });

        return unsubscribe;
    }, [isOpen]);

    // Save current chart as template
    const handleSave = useCallback(() => {
        if (!saveName.trim()) return;

        chartTemplateManager.saveTemplate(saveName, currentConfig);
        setSaveName('');
        setShowSaveForm(false);
    }, [saveName, currentConfig]);

    // Load a template
    const handleLoad = useCallback((template) => {
        onLoadTemplate?.(template);
        onClose?.();
    }, [onLoadTemplate, onClose]);

    // Delete a template
    const handleDelete = useCallback((id) => {
        chartTemplateManager.deleteTemplate(id);
        setConfirmDelete(null);
    }, []);

    // Set as default
    const handleSetDefault = useCallback((id) => {
        const template = templates.find(t => t.id === id);
        chartTemplateManager.setDefaultTemplate(template?.isDefault ? null : id);
    }, [templates]);

    // Start renaming
    const startRename = useCallback((template) => {
        setEditingId(template.id);
        setEditName(template.name);
    }, []);

    // Confirm rename
    const confirmRename = useCallback(() => {
        if (editingId && editName.trim()) {
            chartTemplateManager.renameTemplate(editingId, editName);
        }
        setEditingId(null);
        setEditName('');
    }, [editingId, editName]);

    // Export templates
    const handleExport = useCallback(() => {
        const json = chartTemplateManager.exportTemplates();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chart-templates-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, []);

    // Import templates
    const handleImport = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = chartTemplateManager.importTemplates(event.target.result, true);
            if (result.errors.length > 0) {
                alert(`Import completed with errors:\n${result.errors.join('\n')}`);
            } else if (result.imported > 0) {
                alert(`Successfully imported ${result.imported} template(s)`);
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset input
    }, []);

    // Handle keyboard in save form
    const handleSaveKeyDown = useCallback((e) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            setShowSaveForm(false);
            setSaveName('');
        }
    }, [handleSave]);

    // Handle keyboard in rename input
    const handleRenameKeyDown = useCallback((e) => {
        if (e.key === 'Enter') {
            confirmRename();
        } else if (e.key === 'Escape') {
            setEditingId(null);
            setEditName('');
        }
    }, [confirmRename]);

    // Format date
    const formatDate = (isoString) => {
        try {
            const date = new Date(isoString);
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            });
        } catch {
            return '';
        }
    };

    // Get indicator summary
    const getIndicatorSummary = (indicators = []) => {
        if (indicators.length === 0) return 'No indicators';
        if (indicators.length <= 3) {
            return indicators.map(i => i.type?.toUpperCase()).join(', ');
        }
        return `${indicators.length} indicators`;
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.dialog} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.headerTitle}>
                        <LayoutTemplate size={20} />
                        <h2>Chart Templates</h2>
                    </div>
                    <div className={styles.headerActions}>
                        <button
                            className={styles.headerBtn}
                            onClick={() => fileInputRef.current?.click()}
                            title="Import templates"
                        >
                            <Upload size={16} />
                        </button>
                        <button
                            className={styles.headerBtn}
                            onClick={handleExport}
                            title="Export all templates"
                            disabled={templates.length === 0}
                        >
                            <Download size={16} />
                        </button>
                        <button className={styles.closeBtn} onClick={onClose}>
                            <X size={18} />
                        </button>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleImport}
                        style={{ display: 'none' }}
                    />
                </div>

                <div className={styles.saveSection}>
                    {showSaveForm ? (
                        <div className={styles.saveForm}>
                            <input
                                type="text"
                                className={styles.saveInput}
                                placeholder="Template name..."
                                value={saveName}
                                onChange={(e) => setSaveName(e.target.value)}
                                onKeyDown={handleSaveKeyDown}
                                autoFocus
                            />
                            <button
                                className={styles.saveConfirmBtn}
                                onClick={handleSave}
                                disabled={!saveName.trim()}
                            >
                                <Check size={16} />
                            </button>
                            <button
                                className={styles.saveCancelBtn}
                                onClick={() => {
                                    setShowSaveForm(false);
                                    setSaveName('');
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    ) : (
                        <button
                            className={styles.saveBtn}
                            onClick={() => setShowSaveForm(true)}
                        >
                            <Save size={16} />
                            Save Current Chart as Template
                        </button>
                    )}
                </div>

                <div className={styles.templateList}>
                    {templates.length === 0 ? (
                        <div className={styles.emptyState}>
                            <LayoutTemplate size={48} className={styles.emptyIcon} />
                            <p>No saved templates yet</p>
                            <span>Save your current chart configuration to use it later</span>
                        </div>
                    ) : (
                        templates.map((template) => (
                            <div
                                key={template.id}
                                className={`${styles.templateItem} ${template.isDefault ? styles.defaultTemplate : ''}`}
                            >
                                {confirmDelete === template.id ? (
                                    <div className={styles.confirmDelete}>
                                        <span>Delete "{template.name}"?</span>
                                        <button
                                            className={styles.confirmYes}
                                            onClick={() => handleDelete(template.id)}
                                        >
                                            Delete
                                        </button>
                                        <button
                                            className={styles.confirmNo}
                                            onClick={() => setConfirmDelete(null)}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className={styles.templateInfo}>
                                            {editingId === template.id ? (
                                                <input
                                                    type="text"
                                                    className={styles.renameInput}
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    onKeyDown={handleRenameKeyDown}
                                                    onBlur={confirmRename}
                                                    autoFocus
                                                />
                                            ) : (
                                                <>
                                                    <div className={styles.templateName}>
                                                        {template.isDefault && (
                                                            <Star size={14} className={styles.defaultStar} />
                                                        )}
                                                        {template.name}
                                                    </div>
                                                    <div className={styles.templateMeta}>
                                                        <span className={styles.chartType}>
                                                            {template.chartType}
                                                        </span>
                                                        <span className={styles.separator}>•</span>
                                                        <span className={styles.indicators}>
                                                            {getIndicatorSummary(template.indicators)}
                                                        </span>
                                                        <span className={styles.separator}>•</span>
                                                        <span className={styles.date}>
                                                            <Clock size={10} />
                                                            {formatDate(template.updatedAt || template.createdAt)}
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <div className={styles.templateActions}>
                                            <button
                                                className={styles.actionBtn}
                                                onClick={() => handleSetDefault(template.id)}
                                                title={template.isDefault ? 'Remove default' : 'Set as default'}
                                            >
                                                {template.isDefault ? (
                                                    <StarOff size={14} />
                                                ) : (
                                                    <Star size={14} />
                                                )}
                                            </button>
                                            <button
                                                className={styles.actionBtn}
                                                onClick={() => startRename(template)}
                                                title="Rename"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                className={`${styles.actionBtn} ${styles.deleteBtn}`}
                                                onClick={() => setConfirmDelete(template.id)}
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                            <button
                                                className={styles.loadBtn}
                                                onClick={() => handleLoad(template)}
                                            >
                                                Load
                                                <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChartTemplatesDialog;
