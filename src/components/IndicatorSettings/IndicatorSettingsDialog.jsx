import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './IndicatorSettingsDialog.module.css';
import { X, Plus } from 'lucide-react';
import { getIndicatorConfig } from './indicatorConfigs';

const TV_COLORS = [
    '#ffffff', '#e1e1e1', '#b2b5be', '#787b86', '#5d606b', '#434651', '#2a2e39', '#131722',
    '#f23645', '#ff9800', '#ffe600', '#4caf50', '#00bcd4', '#2962ff', '#673ab7', '#9c27b0',
    '#ef9a9a', '#ffe0b2', '#fff9c4', '#c8e6c9', '#b2ebf2', '#bbdefb', '#d1c4e9', '#e1bee7',
    '#e57373', '#ffcc80', '#fff59d', '#a5d6a7', '#80deea', '#90caf9', '#b39ddb', '#ce93d8',
    '#ef5350', '#ffb74d', '#fff176', '#81c784', '#4dd0e1', '#64b5f6', '#9575cd', '#ba68c8',
    '#e53935', '#ffa726', '#ffee58', '#66bb6a', '#26c6da', '#42a5f5', '#7e57c2', '#ab47bc',
    '#d32f2f', '#fb8c00', '#fdd835', '#43a047', '#00acc1', '#1e88e5', '#5e35b1', '#8e24aa',
    '#c62828', '#f57c00', '#fbc02d', '#388e3c', '#0097a7', '#1976d2', '#512da8', '#7b1fa2'
];

/**
 * Custom Color Picker Component using Portal
 */
const ColorPicker = ({ value, onChange, theme }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState(null);
    const swatchRef = useRef(null);
    const trackRef = useRef(null);

    // Calculate position when opening
    useEffect(() => {
        if (isOpen && swatchRef.current && !coords) {
            const rect = swatchRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + window.scrollY + 8,
                left: rect.left + window.scrollX,
            });
        }
    }, [isOpen]);

    // Handle scroll/resize
    useEffect(() => {
        if (!isOpen) return;
        const handleScroll = () => {
            if (swatchRef.current) {
                const rect = swatchRef.current.getBoundingClientRect();
                setCoords({
                    top: rect.bottom + window.scrollY + 8,
                    left: rect.left + window.scrollX,
                });
            }
        };
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleScroll);
        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleScroll);
        };
    }, [isOpen]);

    // Handle clicking outside
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e) => {
            if (!e.target.closest(`.${styles.colorPopover}`) &&
                swatchRef.current &&
                !swatchRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        window.addEventListener('mousedown', handleClickOutside);
        return () => window.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Parse opacity from RGBA or default to 1
    const getOpacity = (color) => {
        if (color && color.startsWith('rgba')) {
            const match = color.match(/[\d\.]+\)$/);
            if (match) {
                return parseFloat(match[0].slice(0, -1));
            }
        }
        return 1;
    };

    const currentOpacity = getOpacity(value);

    // Handle opacity change
    const handleOpacityChange = (e) => {
        if (!trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        let x = e.clientX - rect.left;
        x = Math.max(0, Math.min(x, rect.width));
        const percent = Math.round((x / rect.width) * 100);

        let newColor = value;
        // Convert hex to rgb if needed
        if (newColor.startsWith('#')) {
            const r = parseInt(newColor.slice(1, 3), 16);
            const g = parseInt(newColor.slice(3, 5), 16);
            const b = parseInt(newColor.slice(5, 7), 16);
            newColor = `rgba(${r}, ${g}, ${b}, ${percent / 100})`;
        } else if (newColor.startsWith('rgba')) {
            newColor = newColor.replace(/[\d\.]+\)$/, `${percent / 100})`);
        } else if (newColor.startsWith('rgb')) {
            newColor = newColor.replace(')', `, ${percent / 100})`).replace('rgb', 'rgba');
        }

        onChange(newColor);
    };

    const handleMouseDown = (e) => {
        handleOpacityChange(e);
        const handleMouseMove = (movedEvent) => handleOpacityChange(movedEvent);
        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const popoverContent = (
        <div
            className={`${styles.colorPopover} ${theme === 'light' ? styles.light : ''}`}
            style={{
                position: 'absolute',
                top: coords?.top || 0,
                left: coords?.left || 0,
                transform: (coords?.left || 0) + 260 > window.innerWidth ? 'translateX(-100%)' : 'none',
                marginLeft: (coords?.left || 0) + 260 > window.innerWidth ? 28 : 0,
            }}
        >
            <div className={styles.colorGrid}>
                {TV_COLORS.map(color => (
                    <div
                        key={color}
                        className={`${styles.colorOption} ${value.toLowerCase().startsWith(color) ? styles.active : ''}`}
                        style={{ '--option-color': color }}
                        onClick={() => {
                            // Keep existing opacity if switching base color
                            let newColor = color;
                            if (currentOpacity < 1) {
                                const r = parseInt(color.slice(1, 3), 16);
                                const g = parseInt(color.slice(3, 5), 16);
                                const b = parseInt(color.slice(5, 7), 16);
                                newColor = `rgba(${r}, ${g}, ${b}, ${currentOpacity})`;
                            }
                            onChange(newColor);
                        }}
                    />
                ))}
            </div>

            <div style={{ position: 'relative' }}>
                <button className={styles.customColorBtn}>
                    <Plus size={16} />
                </button>
                <input
                    type="color"
                    value={value.startsWith('#') ? value : '#000000'} // Color input needs hex
                    onChange={(e) => {
                        let newColor = e.target.value;
                        if (currentOpacity < 1) {
                            const r = parseInt(newColor.slice(1, 3), 16);
                            const g = parseInt(newColor.slice(3, 5), 16);
                            const b = parseInt(newColor.slice(5, 7), 16);
                            newColor = `rgba(${r}, ${g}, ${b}, ${currentOpacity})`;
                        }
                        onChange(newColor);
                    }}
                    style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                        opacity: 0, cursor: 'pointer'
                    }}
                />
            </div>

            {/* Opacity Slider */}
            <div className={styles.opacitySlider}>
                <div className={styles.opacitySliderLabel}>Opacity</div>
                <div className={styles.opacitySliderControls}>
                    <div
                        className={styles.opacitySliderTrack}
                        ref={trackRef}
                        onMouseDown={handleMouseDown}
                        style={{ background: `linear-gradient(to right, #E0E3EB 0%, ${value.startsWith('#') ? value : (value.startsWith('rgba') ? value.replace(/[\d\.]+\)$/, '1)') : value)} 100%)` }}
                    >
                        <div
                            className={styles.opacitySliderThumb}
                            style={{ left: `${currentOpacity * 100}%` }}
                        />
                    </div>
                    <div className={styles.opacitySliderValue}>
                        {Math.round(currentOpacity * 100)}%
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className={styles.colorPickerContainer}>
            <div
                ref={swatchRef}
                className={styles.colorSwatch}
                style={{ '--swatch-color': value }}
                onClick={() => {
                    if (!isOpen && swatchRef.current) {
                        const rect = swatchRef.current.getBoundingClientRect();
                        setCoords({
                            top: rect.bottom + window.scrollY + 8,
                            left: rect.left + window.scrollX,
                        });
                        setIsOpen(true);
                    } else {
                        setIsOpen(false);
                    }
                }}
            />

            {isOpen && coords && createPortal(popoverContent, document.body)}

            <input
                type="text"
                className={styles.hexInput}
                value={value}
                onChange={(e) => {
                    let val = e.target.value;
                    if (!val.startsWith('#') && !val.startsWith('rgb')) val = '#' + val;
                    onChange(val);
                }}
            />
        </div>
    );
};

/**
 * TradingView-style Indicator Settings Dialog
 * Opens when clicking settings gear on individual indicator in legend
 */
const IndicatorSettingsDialog = ({
    isOpen,
    onClose,
    indicatorType,
    settings,
    onSave,
    theme = 'dark',
}) => {
    const [activeTab, setActiveTab] = useState('inputs');
    const [localSettings, setLocalSettings] = useState({});
    const config = getIndicatorConfig(indicatorType);

    // Sync local state when dialog opens
    useEffect(() => {
        if (isOpen && settings) {
            setLocalSettings({ ...settings });
            setActiveTab('inputs');
        }
    }, [isOpen, settings]);

    // Handle field change
    const handleChange = useCallback((key, value) => {
        setLocalSettings(prev => ({ ...prev, [key]: value }));
    }, []);

    // Handle save
    const handleSave = useCallback(() => {
        onSave?.(localSettings);
        onClose();
    }, [localSettings, onSave, onClose]);

    // Handle cancel
    const handleCancel = useCallback(() => {
        onClose();
    }, [onClose]);

    // Reset to defaults
    const handleResetDefaults = useCallback(() => {
        if (!config) return;
        const defaults = {};
        [...config.inputs, ...config.style].forEach(field => {
            defaults[field.key] = field.default;
        });
        setLocalSettings(prev => ({ ...prev, ...defaults }));
    }, [config]);

    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                handleCancel();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, handleCancel]);

    if (!isOpen || !config) return null;

    // Render a single field
    const renderField = (field) => {
        const value = localSettings[field.key] ?? field.default;

        switch (field.type) {
            case 'number':
                return (
                    <div key={field.key} className={styles.fieldRow}>
                        <label className={styles.fieldLabel}>{field.label}</label>
                        <input
                            type="number"
                            className={styles.numberInput}
                            value={value}
                            min={field.min}
                            max={field.max}
                            step={field.step || 1}
                            onChange={(e) => handleChange(field.key, Number(e.target.value))}
                        />
                    </div>
                );

            case 'select':
                return (
                    <div key={field.key} className={styles.fieldRow}>
                        <label className={styles.fieldLabel}>{field.label}</label>
                        <select
                            className={styles.selectInput}
                            value={value}
                            onChange={(e) => handleChange(field.key, e.target.value)}
                        >
                            {field.options.map(opt => (
                                <option key={opt} value={opt}>
                                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                                </option>
                            ))}
                        </select>
                    </div>
                );

            case 'color':
                return (
                    <div key={field.key} className={styles.fieldRow}>
                        <label className={styles.fieldLabel}>{field.label}</label>
                        <ColorPicker
                            value={value}
                            onChange={(newValue) => handleChange(field.key, newValue)}
                            theme={theme}
                        />
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className={styles.overlay} onClick={handleCancel}>
            <div
                className={`${styles.dialog} ${theme === 'light' ? styles.light : ''}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className={styles.header}>
                    <h3 className={styles.title}>{config.name}</h3>
                    <button className={styles.closeBtn} onClick={handleCancel}>
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${activeTab === 'inputs' ? styles.active : ''}`}
                        onClick={() => setActiveTab('inputs')}
                    >
                        Inputs
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'style' ? styles.active : ''}`}
                        onClick={() => setActiveTab('style')}
                    >
                        Style
                    </button>
                </div>

                {/* Content */}
                <div className={styles.content}>
                    {activeTab === 'inputs' && (
                        <div className={styles.fields}>
                            {config.inputs.length > 0 ? (
                                config.inputs.map(renderField)
                            ) : (
                                <div className={styles.emptyMessage}>No input parameters</div>
                            )}
                        </div>
                    )}

                    {activeTab === 'style' && (
                        <div className={styles.fields}>
                            {config.style.map(renderField)}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className={styles.footer}>
                    <button className={styles.defaultsBtn} onClick={handleResetDefaults}>
                        Defaults
                    </button>
                    <div className={styles.footerButtons}>
                        <button className={styles.cancelBtn} onClick={handleCancel}>
                            Cancel
                        </button>
                        <button className={styles.okBtn} onClick={handleSave}>
                            Ok
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IndicatorSettingsDialog;
