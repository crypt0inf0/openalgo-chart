import React, { useState } from 'react';
import type { ComponentType } from 'react';
import {
    Eye,
    EyeOff,
    Lock,
    Unlock,
    Trash2,
    TrendingUp,
    Minus,
    Square,
    Type,
    PenTool,
    ArrowUpRight,
    BarChart3,
    Activity,
    Settings,
    ChevronDown,
    ChevronRight
} from 'lucide-react';
import styles from './ObjectTreePanel.module.css';

interface IconProps {
    size?: number;
    className?: string;
}

type IconComponent = ComponentType<IconProps>;

// Icon mapping for drawing types
const DRAWING_ICONS: Record<string, IconComponent> = {
    TrendLine: TrendingUp,
    HorizontalLine: Minus,
    VerticalLine: BarChart3,
    Ray: ArrowUpRight,
    Rectangle: Square,
    Polyline: PenTool,
    Text: Type,
    Callout: Type,
    FibRetracement: Activity,
    default: PenTool
};

// Icon mapping for indicator types
const INDICATOR_ICONS: Record<string, IconComponent> = {
    SMA: Activity,
    EMA: Activity,
    RSI: BarChart3,
    MACD: BarChart3,
    BB: TrendingUp,
    VOL: BarChart3,
    ATR: Activity,
    STOCH: BarChart3,
    VWAP: Activity,
    SUPERT: TrendingUp,
    ADX: Activity,
    ICHIMOKU: Activity,
    PIVOT: Minus,
    default: Activity
};

interface IndicatorSettings {
    period?: number;
    fastPeriod?: number;
    slowPeriod?: number;
    signalPeriod?: number;
    kPeriod?: number;
}

interface Indicator {
    id?: string;
    type: string;
    visible?: boolean;
    settings?: IndicatorSettings;
}

interface Drawing {
    id?: string;
    type: string;
    visible?: boolean;
    locked?: boolean;
}

export interface ObjectTreePanelProps {
    indicators?: Indicator[];
    drawings?: Drawing[];
    onIndicatorVisibilityToggle?: (id: string) => void;
    onIndicatorRemove?: (id: string) => void;
    onIndicatorSettings?: (id: string) => void;
    onDrawingVisibilityToggle?: (index: number) => void;
    onDrawingLockToggle?: (index: number) => void;
    onDrawingRemove?: (index: number) => void;
    symbol?: string;
    interval?: string;
}

const ObjectTreePanel: React.FC<ObjectTreePanelProps> = ({
    indicators = [],
    drawings = [],
    onIndicatorVisibilityToggle,
    onIndicatorRemove,
    onIndicatorSettings,
    onDrawingVisibilityToggle,
    onDrawingLockToggle,
    onDrawingRemove,
    symbol,
    interval
}) => {
    const [indicatorsExpanded, setIndicatorsExpanded] = useState(true);
    const [drawingsExpanded, setDrawingsExpanded] = useState(true);

    // Defensive: ensure we always have arrays
    const safeIndicators = Array.isArray(indicators) ? indicators : [];
    const safeDrawings = Array.isArray(drawings) ? drawings : [];

    // Format indicator name for display
    const formatIndicatorName = (indicator: Indicator): string => {
        const type = indicator.type?.toUpperCase() || 'INDICATOR';
        const params = indicator.settings || {};

        switch (type) {
            case 'SMA':
            case 'EMA':
                return `${type} (${params.period || 20})`;
            case 'RSI':
                return `RSI (${params.period || 14})`;
            case 'MACD':
                return `MACD (${params.fastPeriod || 12}, ${params.slowPeriod || 26}, ${params.signalPeriod || 9})`;
            case 'BB':
                return `Bollinger Bands (${params.period || 20})`;
            case 'VOL':
                return 'Volume';
            case 'ATR':
                return `ATR (${params.period || 14})`;
            case 'STOCH':
                return `Stochastic (${params.kPeriod || 14})`;
            case 'VWAP':
                return 'VWAP';
            case 'SUPERT':
                return `Supertrend (${params.period || 10})`;
            case 'ADX':
                return `ADX (${params.period || 14})`;
            case 'ICHIMOKU':
                return 'Ichimoku Cloud';
            case 'PIVOT':
                return 'Pivot Points';
            default:
                return type;
        }
    };

    // Format drawing name for display
    const formatDrawingName = (drawing: Drawing, index: number): string => {
        const type = drawing.type || 'Drawing';
        return `${type} #${index + 1}`;
    };

    const getIndicatorIcon = (type?: string): IconComponent => {
        const IconComponent = INDICATOR_ICONS[type?.toUpperCase() || ''] || INDICATOR_ICONS.default;
        return IconComponent;
    };

    const getDrawingIcon = (type?: string): IconComponent => {
        const IconComponent = DRAWING_ICONS[type || ''] || DRAWING_ICONS.default;
        return IconComponent;
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerTitle}>
                    <span className={styles.symbolBadge}>{symbol}</span>
                    <span className={styles.intervalBadge}>{interval}</span>
                </div>
            </div>

            {/* Indicators Section */}
            <div className={styles.section}>
                <div
                    className={styles.sectionHeader}
                    onClick={() => setIndicatorsExpanded(!indicatorsExpanded)}
                >
                    {indicatorsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span>Indicators ({safeIndicators.length})</span>
                </div>

                {indicatorsExpanded && (
                    <div className={styles.itemList}>
                        {safeIndicators.length === 0 ? (
                            <div className={styles.emptyMessage}>No indicators added</div>
                        ) : (
                            safeIndicators.map((indicator, idx) => {
                                const IconComponent = getIndicatorIcon(indicator.type);
                                const isVisible = indicator.visible !== false;

                                return (
                                    <div
                                        key={indicator.id || `indicator-${idx}`}
                                        className={`${styles.item} ${!isVisible ? styles.itemHidden : ''}`}
                                    >
                                        <div className={styles.itemInfo}>
                                            <IconComponent size={14} className={styles.itemIcon} />
                                            <span className={styles.itemName}>
                                                {formatIndicatorName(indicator)}
                                            </span>
                                        </div>
                                        <div className={styles.itemActions}>
                                            <button
                                                className={styles.actionBtn}
                                                onClick={() => onIndicatorSettings?.(indicator.id || indicator.type)}
                                                title="Settings"
                                            >
                                                <Settings size={14} />
                                            </button>
                                            <button
                                                className={`${styles.actionBtn} ${!isVisible ? styles.actionBtnActive : ''}`}
                                                onClick={() => onIndicatorVisibilityToggle?.(indicator.id || indicator.type)}
                                                title={isVisible ? 'Hide' : 'Show'}
                                            >
                                                {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                                            </button>
                                            <button
                                                className={`${styles.actionBtn} ${styles.deleteBtn}`}
                                                onClick={() => onIndicatorRemove?.(indicator.id || indicator.type)}
                                                title="Remove"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>

            {/* Drawings Section */}
            <div className={styles.section}>
                <div
                    className={styles.sectionHeader}
                    onClick={() => setDrawingsExpanded(!drawingsExpanded)}
                >
                    {drawingsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span>Drawings ({safeDrawings.length})</span>
                </div>

                {drawingsExpanded && (
                    <div className={styles.itemList}>
                        {safeDrawings.length === 0 ? (
                            <div className={styles.emptyMessage}>No drawings on chart</div>
                        ) : (
                            safeDrawings.map((drawing, idx) => {
                                const IconComponent = getDrawingIcon(drawing.type);
                                const isVisible = drawing.visible !== false;
                                const isLocked = drawing.locked === true;

                                return (
                                    <div
                                        key={drawing.id || `drawing-${idx}`}
                                        className={`${styles.item} ${!isVisible ? styles.itemHidden : ''}`}
                                    >
                                        <div className={styles.itemInfo}>
                                            <IconComponent size={14} className={styles.itemIcon} />
                                            <span className={styles.itemName}>
                                                {formatDrawingName(drawing, idx)}
                                            </span>
                                        </div>
                                        <div className={styles.itemActions}>
                                            <button
                                                className={`${styles.actionBtn} ${isLocked ? styles.actionBtnActive : ''}`}
                                                onClick={() => onDrawingLockToggle?.(idx)}
                                                title={isLocked ? 'Unlock' : 'Lock'}
                                            >
                                                {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                                            </button>
                                            <button
                                                className={`${styles.actionBtn} ${!isVisible ? styles.actionBtnActive : ''}`}
                                                onClick={() => onDrawingVisibilityToggle?.(idx)}
                                                title={isVisible ? 'Hide' : 'Show'}
                                            >
                                                {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                                            </button>
                                            <button
                                                className={`${styles.actionBtn} ${styles.deleteBtn}`}
                                                onClick={() => onDrawingRemove?.(idx)}
                                                title="Remove"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ObjectTreePanel;
