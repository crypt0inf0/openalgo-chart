import React, { useState, useEffect, useCallback } from 'react';
import styles from './AlertDialog.module.css';
import { X, Bell, Volume2, Webhook, AlertTriangle } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useKeyboardNav } from '../../hooks/useKeyboardNav';

const AlertDialog = ({ isOpen, onClose, onSave, initialPrice, symbol, theme = 'dark' }) => {
    const [condition, setCondition] = useState('Crossing');
    const [value, setValue] = useState('');
    const [alertName, setAlertName] = useState('');
    const [enableSound, setEnableSound] = useState(true);
    const [enablePush, setEnablePush] = useState(true);
    const [error, setError] = useState('');

    // Handle close
    const handleClose = useCallback(() => {
        setError('');
        onClose();
    }, [onClose]);

    // Focus trap for accessibility
    const focusTrapRef = useFocusTrap(isOpen);

    // Escape key to close
    useKeyboardNav({
        enabled: isOpen,
        onEscape: handleClose,
    });

    useEffect(() => {
        if (isOpen && initialPrice) {
            setValue(initialPrice.toString());
            setAlertName('');
            setError('');
        }
    }, [isOpen, initialPrice]);

    if (!isOpen) return null;

    // Validate input
    const validateInput = () => {
        const numValue = parseFloat(value);

        if (!value || value.trim() === '') {
            setError('Please enter a price value');
            return false;
        }

        if (isNaN(numValue)) {
            setError('Please enter a valid number');
            return false;
        }

        if (numValue <= 0) {
            setError('Price must be greater than 0');
            return false;
        }

        if (numValue > 10000000) {
            setError('Price must be less than 1 crore');
            return false;
        }

        setError('');
        return true;
    };

    const handleSave = () => {
        if (!validateInput()) return;

        onSave({
            condition,
            value,
            name: alertName.trim() || null,
            enableSound,
            enablePush,
        });
        onClose();
    };

    // Get condition description
    const getConditionDesc = () => {
        const numValue = parseFloat(value) || 0;
        switch (condition) {
            case 'Crossing': return `Triggers when price crosses ${numValue}`;
            case 'Crossing Up': return `Triggers when price crosses above ${numValue}`;
            case 'Crossing Down': return `Triggers when price crosses below ${numValue}`;
            case 'Greater Than': return `Triggers when price is above ${numValue}`;
            case 'Less Than': return `Triggers when price is below ${numValue}`;
            default: return '';
        }
    };

    return (
        <div className={styles.overlay} onClick={handleClose}>
            <div
                ref={focusTrapRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="alert-dialog-title"
                className={styles.dialog}
                onClick={e => e.stopPropagation()}
            >
                <div className={styles.header}>
                    <h2 id="alert-dialog-title" className={styles.title}>
                        <Bell size={18} />
                        Create Alert {symbol && <span className={styles.symbol}>{symbol}</span>}
                    </h2>
                    <button
                        className={styles.closeButton}
                        onClick={handleClose}
                        aria-label="Close alert dialog"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className={styles.content}>
                    <div className={styles.field}>
                        <label htmlFor="alert-name" className={styles.label}>Alert Name (optional)</label>
                        <input
                            id="alert-name"
                            type="text"
                            className={styles.input}
                            value={alertName}
                            onChange={(e) => setAlertName(e.target.value)}
                            placeholder="e.g., Support Level"
                            maxLength={50}
                        />
                    </div>
                    <div className={styles.field}>
                        <label htmlFor="alert-condition" className={styles.label}>Condition</label>
                        <select
                            id="alert-condition"
                            className={styles.select}
                            value={condition}
                            onChange={(e) => setCondition(e.target.value)}
                        >
                            <option value="Crossing">Crossing</option>
                            <option value="Crossing Up">Crossing Up</option>
                            <option value="Crossing Down">Crossing Down</option>
                            <option value="Greater Than">Greater Than</option>
                            <option value="Less Than">Less Than</option>
                        </select>
                    </div>
                    <div className={styles.field}>
                        <label htmlFor="alert-value" className={styles.label}>Price</label>
                        <input
                            id="alert-value"
                            type="number"
                            className={`${styles.input} ${error ? styles.inputError : ''}`}
                            value={value}
                            onChange={(e) => {
                                setValue(e.target.value);
                                if (error) setError('');
                            }}
                            step="0.01"
                            min="0.01"
                            placeholder="Enter price"
                        />
                        {error && (
                            <div className={styles.errorMessage}>
                                <AlertTriangle size={14} />
                                {error}
                            </div>
                        )}
                    </div>

                    {value && !error && (
                        <div className={styles.conditionPreview}>
                            {getConditionDesc()}
                        </div>
                    )}

                    <div className={styles.notificationSection}>
                        <label className={styles.sectionLabel}>Notifications</label>
                        <div className={styles.notificationOptions}>
                            <label className={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={enableSound}
                                    onChange={(e) => setEnableSound(e.target.checked)}
                                />
                                <Volume2 size={16} />
                                Sound
                            </label>
                            <label className={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={enablePush}
                                    onChange={(e) => setEnablePush(e.target.checked)}
                                />
                                <Bell size={16} />
                                Push
                            </label>
                        </div>
                    </div>
                </div>
                <div className={styles.footer}>
                    <button className={`${styles.button} ${styles.cancelButton}`} onClick={handleClose}>
                        Cancel
                    </button>
                    <button
                        className={`${styles.button} ${styles.saveButton}`}
                        onClick={handleSave}
                        disabled={!!error}
                    >
                        Create Alert
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AlertDialog;
