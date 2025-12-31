import React, { useState, useEffect, useCallback } from 'react';
import styles from './IndicatorSettingsModal.module.css';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useKeyboardNav } from '../../hooks/useKeyboardNav';

// Indicator configuration - defines fields for each indicator
const INDICATOR_CONFIG = {
  sma: {
    name: 'Simple Moving Average',
    shortName: 'SMA',
    fields: [
      { key: 'period', label: 'Period', type: 'number', min: 1, max: 500, step: 1 },
      { key: 'color', label: 'Line Color', type: 'color' },
    ]
  },
  ema: {
    name: 'Exponential Moving Average',
    shortName: 'EMA',
    fields: [
      { key: 'period', label: 'Period', type: 'number', min: 1, max: 500, step: 1 },
      { key: 'color', label: 'Line Color', type: 'color' },
    ]
  },
  rsi: {
    name: 'Relative Strength Index',
    shortName: 'RSI',
    fields: [
      { key: 'period', label: 'Period', type: 'number', min: 1, max: 100, step: 1 },
      { key: 'color', label: 'Line Color', type: 'color' },
    ]
  },
  stochastic: {
    name: 'Stochastic',
    shortName: 'STOCH',
    fields: [
      { key: 'kPeriod', label: '%K Period', type: 'number', min: 1, max: 100, step: 1 },
      { key: 'dPeriod', label: '%D Period', type: 'number', min: 1, max: 100, step: 1 },
      { key: 'smooth', label: 'Smooth', type: 'number', min: 1, max: 10, step: 1 },
      { key: 'kColor', label: '%K Color', type: 'color' },
      { key: 'dColor', label: '%D Color', type: 'color' },
    ]
  },
  macd: {
    name: 'MACD',
    shortName: 'MACD',
    fields: [
      { key: 'fast', label: 'Fast Period', type: 'number', min: 1, max: 100, step: 1 },
      { key: 'slow', label: 'Slow Period', type: 'number', min: 1, max: 100, step: 1 },
      { key: 'signal', label: 'Signal Period', type: 'number', min: 1, max: 100, step: 1 },
      { key: 'macdColor', label: 'MACD Line', type: 'color' },
      { key: 'signalColor', label: 'Signal Line', type: 'color' },
    ]
  },
  bollingerBands: {
    name: 'Bollinger Bands',
    shortName: 'BB',
    fields: [
      { key: 'period', label: 'Period', type: 'number', min: 1, max: 200, step: 1 },
      { key: 'stdDev', label: 'Std Deviation', type: 'number', min: 0.5, max: 5, step: 0.5 },
      { key: 'color', label: 'Line Color', type: 'color' },
    ]
  },
  atr: {
    name: 'Average True Range',
    shortName: 'ATR',
    fields: [
      { key: 'period', label: 'Period', type: 'number', min: 1, max: 100, step: 1 },
      { key: 'color', label: 'Line Color', type: 'color' },
    ]
  },
  supertrend: {
    name: 'Supertrend',
    shortName: 'ST',
    fields: [
      { key: 'period', label: 'Period', type: 'number', min: 1, max: 100, step: 1 },
      { key: 'multiplier', label: 'Multiplier', type: 'number', min: 0.5, max: 10, step: 0.5 },
      { key: 'upColor', label: 'Up Color', type: 'color' },
      { key: 'downColor', label: 'Down Color', type: 'color' },
    ]
  },
  volume: {
    name: 'Volume',
    shortName: 'VOL',
    fields: [
      { key: 'colorUp', label: 'Up Color', type: 'color' },
      { key: 'colorDown', label: 'Down Color', type: 'color' },
    ]
  },
  vwap: {
    name: 'VWAP',
    shortName: 'VWAP',
    fields: [
      { key: 'color', label: 'Line Color', type: 'color' },
    ]
  },
  firstCandle: {
    name: 'First Red Candle',
    shortName: 'FRC',
    description: '5-min only: Marks first RED candle of day, shows its high/low as support/resistance',
    fields: [
      { key: 'highlightColor', label: 'Marker Color', type: 'color' },
      { key: 'highLineColor', label: 'High Line Color', type: 'color' },
      { key: 'lowLineColor', label: 'Low Line Color', type: 'color' },
    ]
  },
};

// Sidebar sections with their indicators
const SECTIONS = [
  {
    id: 'moving-averages',
    label: 'Moving Averages',
    indicators: ['sma', 'ema'],
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    )
  },
  {
    id: 'oscillators',
    label: 'Oscillators',
    indicators: ['rsi', 'stochastic'],
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 12h4l3-9 6 18 3-9h4" />
      </svg>
    )
  },
  {
    id: 'momentum',
    label: 'Momentum',
    indicators: ['macd'],
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="20" x2="12" y2="10" />
        <line x1="18" y1="20" x2="18" y2="4" />
        <line x1="6" y1="20" x2="6" y2="16" />
      </svg>
    )
  },
  {
    id: 'volatility',
    label: 'Volatility',
    indicators: ['bollingerBands', 'atr'],
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3v18h18" />
        <path d="M18 9l-5 5-4-4-3 3" />
      </svg>
    )
  },
  {
    id: 'trend',
    label: 'Trend',
    indicators: ['supertrend'],
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="7" y1="17" x2="17" y2="7" />
        <polyline points="7 7 17 7 17 17" />
      </svg>
    )
  },
  {
    id: 'volume',
    label: 'Volume',
    indicators: ['volume', 'vwap'],
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="12" width="4" height="8" />
        <rect x="10" y="8" width="4" height="12" />
        <rect x="17" y="4" width="4" height="16" />
      </svg>
    )
  },
  {
    id: 'strategy',
    label: 'Strategy',
    indicators: ['firstCandle'],
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    )
  },
];

// Individual indicator form
const IndicatorForm = ({ indicatorKey, config, value, onChange }) => {
  const handleToggle = () => {
    onChange({ ...value, enabled: !value.enabled });
  };

  const handleFieldChange = (fieldKey, newValue) => {
    onChange({ ...value, [fieldKey]: newValue });
  };

  return (
    <div className={styles.indicatorCard}>
      <div className={styles.indicatorHeader}>
        <span className={styles.indicatorName}>{config.name}</span>
        <label className={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={handleToggle}
            className={styles.toggleInput}
          />
          <span className={styles.toggleSwitch}></span>
        </label>
      </div>

      <div className={styles.indicatorFields}>
        {config.fields.map(field => (
          <div key={field.key} className={styles.fieldRow}>
            <label className={styles.fieldLabel}>{field.label}</label>
            {field.type === 'number' ? (
              <input
                type="number"
                className={styles.numberInput}
                value={value[field.key] ?? ''}
                min={field.min}
                max={field.max}
                step={field.step || 1}
                onChange={(e) => handleFieldChange(field.key, Number(e.target.value))}
              />
            ) : field.type === 'color' ? (
              <div className={styles.colorInputWrapper}>
                <input
                  type="color"
                  className={styles.colorInput}
                  value={value[field.key] || '#2962FF'}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                />
                <input
                  type="text"
                  className={styles.hexInput}
                  value={value[field.key] || '#2962FF'}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (!val.startsWith('#')) val = '#' + val;
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                      handleFieldChange(field.key, val);
                    }
                  }}
                  maxLength={7}
                  placeholder="#000000"
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};

const IndicatorSettingsModal = ({
  isOpen,
  onClose,
  theme = 'dark',
  indicators,
  onIndicatorSettingsChange,
}) => {
  const [activeSection, setActiveSection] = useState('moving-averages');
  const [localIndicators, setLocalIndicators] = useState(indicators);
  const [hasChanges, setHasChanges] = useState(false);

  // Handle cancel - reset local state and close
  const handleCancel = useCallback(() => {
    setLocalIndicators(indicators);
    setHasChanges(false);
    onClose();
  }, [indicators, onClose]);

  // Focus trap for accessibility
  const focusTrapRef = useFocusTrap(isOpen);

  // Escape key to close
  useKeyboardNav({
    enabled: isOpen,
    onEscape: handleCancel,
  });

  // Sync local state with props when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalIndicators(indicators);
      setHasChanges(false);
    }
  }, [isOpen, indicators]);

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(localIndicators) !== JSON.stringify(indicators);
    setHasChanges(changed);
  }, [localIndicators, indicators]);

  if (!isOpen) return null;

  const handleSave = () => {
    onIndicatorSettingsChange?.(localIndicators);
    onClose();
  };

  const handleIndicatorChange = (indicatorKey, newValue) => {
    setLocalIndicators(prev => ({
      ...prev,
      [indicatorKey]: newValue
    }));
  };

  // Get current section's indicators
  const currentSection = SECTIONS.find(s => s.id === activeSection);
  const sectionIndicators = currentSection?.indicators || [];

  return (
    <div className={styles.overlay} onClick={handleCancel}>
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="indicator-settings-title"
        className={`${styles.popup} ${theme === 'light' ? styles.light : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.header}>
          <h2 id="indicator-settings-title" className={styles.title}>Indicator Settings</h2>
          <button
            className={styles.closeButton}
            onClick={handleCancel}
            aria-label="Close indicator settings"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Sidebar */}
          <div className={styles.sidebar}>
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                className={`${styles.sidebarItem} ${activeSection === section.id ? styles.active : ''}`}
                onClick={() => setActiveSection(section.id)}
              >
                <span className={styles.sidebarIcon}>{section.icon}</span>
                <span className={styles.sidebarLabel}>{section.label}</span>
              </button>
            ))}
          </div>

          {/* Main Content Area */}
          <div className={styles.main}>
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>{currentSection?.label?.toUpperCase()}</h3>

              {sectionIndicators.map(indicatorKey => {
                const config = INDICATOR_CONFIG[indicatorKey];
                const value = localIndicators[indicatorKey];

                if (!config || !value) return null;

                return (
                  <IndicatorForm
                    key={indicatorKey}
                    indicatorKey={indicatorKey}
                    config={config}
                    value={value}
                    onChange={(newValue) => handleIndicatorChange(indicatorKey, newValue)}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.cancelButton} onClick={handleCancel}>
            Cancel
          </button>
          <button
            className={styles.okButton}
            onClick={handleSave}
          >
            Ok
          </button>
        </div>
      </div>
    </div>
  );
};

export default IndicatorSettingsModal;
