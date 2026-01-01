import React, { useState, useEffect, useCallback } from 'react';
import styles from './OrderFlowSettingsPanel.module.css';
import { X, ChevronRight, Activity, BarChart3, TrendingUp, Zap, Eye } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useKeyboardNav } from '../../hooks/useKeyboardNav';

// Import constants from plugins
import { FOOTPRINT_PRESETS, PRESET_NAMES } from '../../plugins/footprint-chart/FootprintConstants';
import { PROFILE_TYPES, PROFILE_TYPE_NAMES, DISPLAY_MODES } from '../../plugins/volume-profile/VolumeProfileConstants';

// Order Flow feature configuration
const ORDER_FLOW_CONFIG = {
  footprint: {
    name: 'Footprint Charts',
    description: 'Volume at each price level with buy/sell breakdown',
    icon: <BarChart3 size={18} />,
    fields: [
      {
        key: 'preset',
        label: 'Preset',
        type: 'select',
        options: Object.entries(PRESET_NAMES).map(([value, label]) => ({ value, label }))
      },
      { key: 'cellWidth', label: 'Cell Width', type: 'number', min: 40, max: 120, step: 5 },
      { key: 'priceStep', label: 'Price Step', type: 'number', min: 0.05, max: 100, step: 0.05 },
      { key: 'showImbalances', label: 'Show Imbalances', type: 'checkbox' },
      { key: 'imbalanceRatio', label: 'Imbalance Ratio', type: 'number', min: 1.5, max: 10, step: 0.5 },
      { key: 'showPOC', label: 'Show POC', type: 'checkbox' },
      { key: 'showDelta', label: 'Show Delta', type: 'checkbox' },
      { key: 'opacity', label: 'Opacity', type: 'number', min: 0.1, max: 1, step: 0.1 },
    ]
  },
  volumeProfile: {
    name: 'Volume Profile',
    description: 'Session/Fixed/Composite with POC, VAH, VAL',
    icon: <Activity size={18} />,
    fields: [
      {
        key: 'profileType',
        label: 'Profile Type',
        type: 'select',
        options: Object.entries(PROFILE_TYPE_NAMES).map(([value, label]) => ({ value, label }))
      },
      {
        key: 'displayMode',
        label: 'Display Mode',
        type: 'select',
        options: [
          { value: DISPLAY_MODES.TOTAL_VOLUME, label: 'Total Volume' },
          { value: DISPLAY_MODES.BID_ASK, label: 'Bid/Ask Split' },
          { value: DISPLAY_MODES.DELTA, label: 'Delta' },
        ]
      },
      {
        key: 'position',
        label: 'Position',
        type: 'select',
        options: [
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' },
          { value: 'overlay', label: 'Overlay' },
        ]
      },
      { key: 'width', label: 'Width (px)', type: 'number', min: 50, max: 300, step: 10 },
      { key: 'showPOC', label: 'Show POC', type: 'checkbox' },
      { key: 'extendPOC', label: 'Extend POC Line', type: 'checkbox' },
      { key: 'showValueArea', label: 'Show Value Area', type: 'checkbox' },
      { key: 'valueAreaPercent', label: 'Value Area %', type: 'number', min: 50, max: 90, step: 5 },
      { key: 'showHVN', label: 'Show HVN', type: 'checkbox' },
      { key: 'showLVN', label: 'Show LVN', type: 'checkbox' },
      { key: 'showVolumeLabels', label: 'Show Labels', type: 'checkbox' },
      { key: 'opacity', label: 'Opacity', type: 'number', min: 0.1, max: 1, step: 0.1 },
    ]
  },
  delta: {
    name: 'Delta Analysis',
    description: 'Delta bars and Cumulative Delta line',
    icon: <TrendingUp size={18} />,
    fields: [
      { key: 'showDeltaBars', label: 'Show Delta Bars', type: 'checkbox' },
      { key: 'showCumulativeDelta', label: 'Show Cumulative Delta', type: 'checkbox' },
      { key: 'showDivergence', label: 'Show Divergence', type: 'checkbox' },
      { key: 'panelHeight', label: 'Panel Height', type: 'number', min: 60, max: 200, step: 10 },
      { key: 'buyColor', label: 'Buy Color', type: 'color' },
      { key: 'sellColor', label: 'Sell Color', type: 'color' },
      { key: 'lineColor', label: 'CD Line Color', type: 'color' },
    ]
  },
  barStats: {
    name: 'Bar Statistics',
    description: 'Per-bar volume metrics grid',
    icon: <Eye size={18} />,
    fields: [
      { key: 'showPanel', label: 'Show Panel', type: 'checkbox' },
      { key: 'panelHeight', label: 'Panel Height', type: 'number', min: 80, max: 200, step: 10 },
      { key: 'showVolume', label: 'Show Volume', type: 'checkbox' },
      { key: 'showDelta', label: 'Show Delta', type: 'checkbox' },
      { key: 'showDeltaPercent', label: 'Show Delta %', type: 'checkbox' },
      { key: 'showPOC', label: 'Show POC', type: 'checkbox' },
      { key: 'showVWAP', label: 'Show VWAP', type: 'checkbox' },
      { key: 'showBuyVWAP', label: 'Show Buy VWAP', type: 'checkbox' },
      { key: 'showSellVWAP', label: 'Show Sell VWAP', type: 'checkbox' },
      { key: 'showTrades', label: 'Show Trades', type: 'checkbox' },
    ]
  },
  powerTrades: {
    name: 'Power Trades',
    description: 'Real-time large trade detection',
    icon: <Zap size={18} />,
    fields: [
      { key: 'enabled', label: 'Enable', type: 'checkbox' },
      { key: 'volumeThreshold', label: 'Volume Threshold', type: 'number', min: 10, max: 10000, step: 10 },
      { key: 'timeWindowMs', label: 'Time Window (ms)', type: 'number', min: 1000, max: 30000, step: 1000 },
      { key: 'showBubbles', label: 'Show Bubbles', type: 'checkbox' },
      { key: 'showLabels', label: 'Show Labels', type: 'checkbox' },
      { key: 'showHistory', label: 'Show History', type: 'checkbox' },
      { key: 'maxHistoryCount', label: 'Max History', type: 'number', min: 10, max: 200, step: 10 },
      { key: 'alertVolumeMultiplier', label: 'Alert Multiplier', type: 'number', min: 2, max: 10, step: 1 },
    ]
  },
  vwap: {
    name: 'VWAP Variants',
    description: 'VWAP, Buy VWAP, Sell VWAP, Anchored',
    icon: <Activity size={18} />,
    fields: [
      { key: 'showVWAP', label: 'Show VWAP', type: 'checkbox' },
      { key: 'showBuyVWAP', label: 'Show Buy VWAP', type: 'checkbox' },
      { key: 'showSellVWAP', label: 'Show Sell VWAP', type: 'checkbox' },
      { key: 'showBands', label: 'Show Std Dev Bands', type: 'checkbox' },
      { key: 'bandMultiplier', label: 'Band Multiplier', type: 'number', min: 1, max: 3, step: 0.5 },
      { key: 'vwapColor', label: 'VWAP Color', type: 'color' },
      { key: 'buyVwapColor', label: 'Buy VWAP Color', type: 'color' },
      { key: 'sellVwapColor', label: 'Sell VWAP Color', type: 'color' },
    ]
  },
};

// Sections for sidebar
const SECTIONS = [
  { id: 'footprint', label: 'Footprint', icon: <BarChart3 size={18} /> },
  { id: 'volumeProfile', label: 'Volume Profile', icon: <Activity size={18} /> },
  { id: 'delta', label: 'Delta', icon: <TrendingUp size={18} /> },
  { id: 'barStats', label: 'Bar Stats', icon: <Eye size={18} /> },
  { id: 'powerTrades', label: 'Power Trades', icon: <Zap size={18} /> },
  { id: 'vwap', label: 'VWAP', icon: <Activity size={18} /> },
];

// Default settings for Order Flow features
export const DEFAULT_ORDER_FLOW_SETTINGS = {
  footprint: {
    enabled: false,
    preset: FOOTPRINT_PRESETS.DELTA_PROFILE,
    cellWidth: 60,
    priceStep: 1,
    showImbalances: true,
    imbalanceRatio: 3,
    showPOC: true,
    showDelta: true,
    opacity: 0.8,
  },
  volumeProfile: {
    enabled: false,
    profileType: PROFILE_TYPES.SESSION,
    displayMode: DISPLAY_MODES.TOTAL_VOLUME,
    position: 'right',
    width: 150,
    showPOC: true,
    extendPOC: true,
    showValueArea: true,
    valueAreaPercent: 70,
    showHVN: false,
    showLVN: false,
    showVolumeLabels: true,
    opacity: 0.8,
  },
  delta: {
    enabled: false,
    showDeltaBars: true,
    showCumulativeDelta: true,
    showDivergence: true,
    panelHeight: 80,
    buyColor: '#26A69A',
    sellColor: '#EF5350',
    lineColor: '#2962FF',
  },
  barStats: {
    enabled: false,
    showPanel: true,
    panelHeight: 120,
    showVolume: true,
    showDelta: true,
    showDeltaPercent: true,
    showPOC: true,
    showVWAP: true,
    showBuyVWAP: false,
    showSellVWAP: false,
    showTrades: false,
  },
  powerTrades: {
    enabled: false,
    volumeThreshold: 100,
    timeWindowMs: 5000,
    showBubbles: true,
    showLabels: true,
    showHistory: true,
    maxHistoryCount: 50,
    alertVolumeMultiplier: 3,
  },
  vwap: {
    enabled: true,
    showVWAP: true,
    showBuyVWAP: false,
    showSellVWAP: false,
    showBands: false,
    bandMultiplier: 2,
    vwapColor: '#2962FF',
    buyVwapColor: '#26A69A',
    sellVwapColor: '#EF5350',
  },
};

// Form for individual order flow feature
const FeatureForm = ({ featureKey, config, value, onChange }) => {
  const handleToggle = () => {
    onChange({ ...value, enabled: !value.enabled });
  };

  const handleFieldChange = (fieldKey, newValue) => {
    onChange({ ...value, [fieldKey]: newValue });
  };

  return (
    <div className={styles.featureCard}>
      <div className={styles.featureHeader}>
        <div className={styles.featureInfo}>
          <span className={styles.featureIcon}>{config.icon}</span>
          <div>
            <span className={styles.featureName}>{config.name}</span>
            <span className={styles.featureDescription}>{config.description}</span>
          </div>
        </div>
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

      <div className={`${styles.featureFields} ${!value.enabled ? styles.disabled : ''}`}>
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
                disabled={!value.enabled}
              />
            ) : field.type === 'color' ? (
              <div className={styles.colorInputWrapper}>
                <input
                  type="color"
                  className={styles.colorInput}
                  value={value[field.key] || '#2962FF'}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  disabled={!value.enabled}
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
                  disabled={!value.enabled}
                />
              </div>
            ) : field.type === 'checkbox' ? (
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={value[field.key] ?? false}
                  onChange={(e) => handleFieldChange(field.key, e.target.checked)}
                  disabled={!value.enabled}
                />
                <span className={styles.checkmark}></span>
              </label>
            ) : field.type === 'select' ? (
              <select
                className={styles.selectInput}
                value={value[field.key] || ''}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                disabled={!value.enabled}
              >
                {field.options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};

const OrderFlowSettingsPanel = ({
  isOpen,
  onClose,
  theme = 'dark',
  settings,
  onSettingsChange,
}) => {
  const [activeSection, setActiveSection] = useState('footprint');
  const [localSettings, setLocalSettings] = useState(settings || DEFAULT_ORDER_FLOW_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setLocalSettings(settings || DEFAULT_ORDER_FLOW_SETTINGS);
    setHasChanges(false);
    onClose();
  }, [settings, onClose]);

  // Focus trap for accessibility
  const focusTrapRef = useFocusTrap(isOpen);

  // Escape key to close
  useKeyboardNav({
    enabled: isOpen,
    onEscape: handleCancel,
  });

  // Sync local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings || DEFAULT_ORDER_FLOW_SETTINGS);
      setHasChanges(false);
    }
  }, [isOpen, settings]);

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(localSettings) !== JSON.stringify(settings);
    setHasChanges(changed);
  }, [localSettings, settings]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSettingsChange?.(localSettings);
    onClose();
  };

  const handleFeatureChange = (featureKey, newValue) => {
    setLocalSettings(prev => ({
      ...prev,
      [featureKey]: newValue
    }));
  };

  const handleResetToDefaults = () => {
    setLocalSettings(DEFAULT_ORDER_FLOW_SETTINGS);
  };

  const currentConfig = ORDER_FLOW_CONFIG[activeSection];
  const currentValue = localSettings[activeSection];

  return (
    <div className={styles.overlay} onClick={handleCancel}>
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="orderflow-settings-title"
        className={`${styles.popup} ${theme === 'light' ? styles.light : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.header}>
          <h2 id="orderflow-settings-title" className={styles.title}>
            <Activity size={20} className={styles.titleIcon} />
            Order Flow Settings
          </h2>
          <button
            className={styles.closeButton}
            onClick={handleCancel}
            aria-label="Close order flow settings"
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
                {localSettings[section.id]?.enabled && (
                  <span className={styles.enabledBadge}>ON</span>
                )}
                <ChevronRight size={14} className={styles.chevron} />
              </button>
            ))}
          </div>

          {/* Main Content */}
          <div className={styles.main}>
            {currentConfig && currentValue && (
              <FeatureForm
                featureKey={activeSection}
                config={currentConfig}
                value={currentValue}
                onChange={(newValue) => handleFeatureChange(activeSection, newValue)}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.resetButton} onClick={handleResetToDefaults}>
            Reset to Defaults
          </button>
          <div className={styles.footerRight}>
            <button className={styles.cancelButton} onClick={handleCancel}>
              Cancel
            </button>
            <button
              className={styles.saveButton}
              onClick={handleSave}
              disabled={!hasChanges}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderFlowSettingsPanel;
