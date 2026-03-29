import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback, useMemo } from 'react';
import {
    createChart,
    LineSeries,
    CandlestickSeries,
    createSeriesMarkers
} from 'lightweight-charts';
import styles from './ChartComponent.module.css';
import IndicatorLegend from './IndicatorLegend';
import PaneContextMenu from './PaneContextMenu';
import MeasureOverlay from './MeasureOverlay';
import OHLCHeader from './OHLCHeader';
import ChartContextMenu from './ChartContextMenu';
import IndicatorSettingsDialog from '../IndicatorSettings/IndicatorSettingsDialog';
import { getIndicatorConfig } from '../IndicatorSettings/indicatorConfigs';
import { getKlines, getHistoricalKlines, subscribeToTicker, saveDrawings, loadDrawings } from '../../services/openalgo';
import { combineMultiLegOHLC } from '../../services/optionChain';
import { getAccurateISTTimestamp, syncTimeWithAPI, shouldResync } from '../../services/timeService';
import { formatCurrency } from '../../utils/shared/formatters';
import {
    calculateSMA,
    calculateEMA,
    calculateRSI,
    calculateMACD,
    calculateBollingerBands,
    calculateVolume,
    calculateATR,
    calculateStochastic,
    calculateVWAP,
    calculateSupertrend,
    calculateTPO,
    calculateFirstCandle,
    calculateRangeBreakout,
    calculatePriceActionRange,
    calculateVWAPBands,
    calculatePivotPoints,
    calculateRedCandleZones,
    calculateMarketBias,
    calculateSRVolumeBoxes
} from '../../utils/indicators';


import { calculateANNStrategy } from '../../utils/indicators/annStrategy';
import { calculateHilengaMilenga } from '../../utils/indicators/hilengaMilenga';
import { calculateRiskPosition, autoDetectSide } from '../../utils/indicators/riskCalculator';
import { createRiskCalculatorPrimitive, removeRiskCalculatorPrimitive } from '../../utils/indicators/riskCalculatorChart';
import { TPOProfilePrimitive } from '../../plugins/tpo-profile/TPOProfilePrimitive';
import { intervalToSeconds } from '../../utils/timeframes';
import { logger } from '../../utils/logger.js';

import { LineToolManager } from '../../plugins/line-tools/line-tool-manager';
import { PriceScaleTimer } from '../../plugins/line-tools/tools/price-scale-timer';
import '../../plugins/line-tools/floating-toolbar.css';
import ReplayControls from '../Replay/ReplayControls';
import { pineScriptService } from '../../services/pineScriptService';
import ReplaySlider from '../Replay/ReplaySlider';
import PriceScaleMenu from './PriceScaleMenu';
import PriceScaleContextMenu, { SCALE_MODES } from './PriceScaleContextMenu';
import { VisualTrading } from '../../plugins/visual-trading/visual-trading';
import RiskCalculatorPanel from '../RiskCalculatorPanel/RiskCalculatorPanel';
import { useChartResize } from '../../hooks/useChartResize';
import { useChartDrawings } from '../../hooks/useChartDrawings';
import { useChartAlerts } from '../../hooks/useChartAlerts';
import { getChartTheme, getThemeType } from '../../utils/chartTheme';
import { TOOL_MAP, hexToRgba, areSymbolsEquivalent, addFutureWhitespacePoints, formatTimeDiff } from './utils/chartHelpers';
import { createSeries, transformData } from './utils/seriesFactories';
import { createIndicatorSeries } from './utils/indicatorCreators';
import { updateIndicatorSeries } from './utils/indicatorUpdaters';
import { cleanupIndicators } from './utils/indicatorCleanup';
import {
    DEFAULT_CANDLE_WINDOW,
    DEFAULT_RIGHT_OFFSET,
    PREFETCH_THRESHOLD,
    MIN_CANDLES_FOR_SCROLL_BACK,
    IST_OFFSET_SECONDS,
    DEFAULT_VIEW_WINDOW,
    EXTENDED_VIEW_WINDOW
} from './utils/chartConfig';
import { saveAlertsForSymbol, loadAlertsForSymbol } from '../../services/alertService';
import { usePaneMenu } from './hooks/usePaneMenu';
import { useOrders } from '../../context/OrderContext';
import { useUser } from '../../context/UserContext';

// ChartComponent props interface
interface ChartComponentProps {
    data?: any[];
    symbol?: string;
    exchange?: string;
    interval?: string;
    chartType?: string;
    indicators?: any[];
    activeTool?: string | null;
    onToolUsed?: () => void;
    isLogScale?: boolean;
    isAutoScale?: boolean;
    timeRange?: any;
    magnetMode?: boolean;
    isToolbarVisible?: boolean;
    theme?: string;
    comparisonSymbols?: any[];
    onAlertsSync?: (alerts: any) => void;
    onDrawingsSync?: (drawings: any) => void;
    onAlertTriggered?: (event: any) => void;
    onReplayModeChange?: (isActive: boolean) => void;
    onOHLCDataUpdate?: (...args: any[]) => void;
    isDrawingsLocked?: boolean;
    isDrawingsHidden?: boolean;
    isTimerVisible?: boolean;
    isSessionBreakVisible?: boolean;
    onIndicatorRemove?: (id: string) => void;
    onIndicatorVisibilityToggle?: (id: string) => void;
    onIndicatorSettings?: (id: string, settings: any) => void;
    chartAppearance?: any;
    strategyConfig?: any;
    onOpenOptionChain?: (symbol: string) => void;
    oiLines?: any[];
    showOILines?: boolean;
    onOpenSettings?: () => void;
    onOpenObjectTree?: () => void;
    onOpenTradingPanel?: (action?: string, price?: number, orderType?: string, isModal?: boolean) => void;
    onIndicatorMoveUp?: (id: string) => void;
    onOpenIndicatorAlert?: (indicatorId?: string) => void;
}

// Helper to normalize time for comparison (handles both UNIX seconds and Date objects)
const getTimeValue = (t) => {
    if (typeof t === 'number') return t;
    if (t && typeof t === 'object') {
        if (t.year && t.month && t.day) {
            // Lightweight Charts business day object to timestamp (approx start of day)
            return new Date(t.year, t.month - 1, t.day).getTime() / 1000;
        }
    }
    return 0; // Invalid or unknown format
};

const ChartComponent = forwardRef<any, ChartComponentProps>(({
    data: initialData = [],
    symbol = 'RELIANCE',
    exchange = 'NSE',
    interval,
    chartType,
    indicators,
    activeTool,
    onToolUsed,
    isLogScale,
    isAutoScale,
    timeRange,
    magnetMode,
    isToolbarVisible = true,
    theme = 'dark',
    comparisonSymbols: comparisonSymbolsProp = [],
    onAlertsSync,
    onDrawingsSync,
    onAlertTriggered,
    onReplayModeChange,
    onOHLCDataUpdate, // Callback to share OHLC data with GlobalAlertMonitor for indicator alerts
    isDrawingsLocked = false,
    isDrawingsHidden = false,
    isTimerVisible = false,
    isSessionBreakVisible = false,
    onIndicatorRemove,
    onIndicatorVisibilityToggle,
    onIndicatorSettings, // Callback when indicator settings are changed
    chartAppearance = {},
    strategyConfig = null, // { strategyType, legs: [{ id, symbol, direction, quantity }], exchange, displayName }
    onOpenOptionChain, // Callback to open option chain for current symbol
    oiLines = [], // OI Lines data
    showOILines = false, // Toggle state for OI lines
    onOpenSettings,
    onOpenObjectTree,
    onOpenTradingPanel, // Callback to open trading panel
    onIndicatorMoveUp, // New prop for moving indicators
    onOpenIndicatorAlert, // Callback to open indicator alert dialog
}, ref) => {
    // Get authentication status
    const { isAuthenticated } = useUser();

    // Get orders and positions from OrderContext
    const { activeOrders: orders = [], activePositions: positions = [], onModifyOrder, onCancelOrder } = useOrders();

    // Memoize comparisons - use length and first item as proxy for deep comparison
    // This avoids JSON.stringify on every render while still detecting meaningful changes
    const comparisonSymbols = useMemo(() => comparisonSymbolsProp, [
        comparisonSymbolsProp?.length,
        comparisonSymbolsProp?.[0]?.symbol,
        comparisonSymbolsProp?.[0]?.exchange
    ]);

    const chartContainerRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, price: null as number | null, orderId: null as string | null });
    const [isVerticalCursorLocked, setIsVerticalCursorLocked] = useState(false);
    const [priceScaleMenu, setPriceScaleMenu] = useState({ visible: false, x: 0, y: 0, price: null });
    // Right-click price scale context menu state (TradingView-style)
    const [priceScaleContextMenu, setPriceScaleContextMenu] = useState({ visible: false, x: 0, y: 0, priceScaleId: '' as string });
    // Price scale settings state
    const [priceScaleSettings, setPriceScaleSettings] = useState({
        autoScale: true,
        scalePriceChartOnly: false,
        invertScale: false,
        scaleMode: SCALE_MODES.NORMAL, // 0: Normal, 1: Log, 2: Percent, 3: Indexed
        plusButtonVisible: true
    });
    const [indicatorSettingsOpen, setIndicatorSettingsOpen] = useState(null); // which indicator's settings are open
    const [indicatorValues, setIndicatorValues] = useState({}); // Current value under cursor for each indicator { id: value }
    const [tpoLocalSettings, setTpoLocalSettings] = useState({}); // Local TPO settings storage (workaround for broken parent callback)
    // Comparison symbol price labels - { symbol: { price, y, color } }
    const [comparisonPriceLabels, setComparisonPriceLabels] = useState({});

    const [chartInstance, setChartInstance] = useState(null);
    useChartResize(chartContainerRef, chartInstance);

    const [lineToolManager, setLineToolManager] = useState(null);
    useChartDrawings(lineToolManager, symbol, exchange, interval, onDrawingsSync);
    useChartAlerts(lineToolManager, symbol, exchange);

    // Store onOHLCDataUpdate in a ref so it's accessible in WebSocket callbacks
    const onOHLCDataUpdateRef = useRef(onOHLCDataUpdate);
    useEffect(() => {
        onOHLCDataUpdateRef.current = onOHLCDataUpdate;
    }, [onOHLCDataUpdate]);

    // Share OHLC data with GlobalAlertMonitor for indicator alert evaluation
    useEffect(() => {
        if (onOHLCDataUpdate && dataRef.current && dataRef.current.length > 0 && symbol && interval) {
            // Notify after data is loaded/updated
            onOHLCDataUpdate(symbol, exchange, interval, dataRef.current);
        }
    }, [symbol, exchange, interval, onOHLCDataUpdate]);
    // Note: dataRef is intentionally NOT in deps to avoid loops - we rely on symbol/interval changes

    // Also share data periodically to keep cache fresh (every 30 seconds)
    useEffect(() => {
        if (!onOHLCDataUpdate || !symbol || !interval) return;

        const intervalId = setInterval(() => {
            if (dataRef.current && dataRef.current.length > 0) {
                onOHLCDataUpdate(symbol, exchange, interval, dataRef.current);
            }
        }, 30000); // Every 30 seconds

        return () => clearInterval(intervalId);
    }, [symbol, exchange, interval, onOHLCDataUpdate]);

    // Close context menu on click outside
    // MEDIUM FIX ML-7: Remove early return to prevent event listener memory leak
    useEffect(() => {
        if (contextMenu.show) {
            const handleClickAway = () => setContextMenu({ show: false, x: 0, y: 0, price: null, orderId: null });
            document.addEventListener('click', handleClickAway);
            return () => document.removeEventListener('click', handleClickAway);
        }
    }, [contextMenu.show]);

    // Handle right-click on price scale area to show scale options context menu
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const handlePriceScaleContextMenu = (e) => {
            // Check if click is in the right price scale area (approximately rightmost 70px)
            const container = chartContainerRef.current;
            if (!container) return;

            const rect = container.getBoundingClientRect();
            const rightEdge = rect.right;
            const leftEdge = rect.left;
            const priceScaleWidth = 70; // Approximate price scale width

            let clickedScaleId = null;

            // Check if click is within the Right price scale area
            if (e.clientX >= rightEdge - priceScaleWidth) {
                clickedScaleId = 'right';
            }
            // Check if click is within the Left price scale area (if visible)
            else if (e.clientX <= leftEdge + priceScaleWidth) {
                const leftScale = chartRef.current?.priceScale('left');
                if (leftScale && leftScale.options().visible) {
                    clickedScaleId = 'left';
                }
            }

            if (clickedScaleId) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                // Load current settings for the clicked scale
                if (chartRef.current) {
                    const options = chartRef.current.priceScale(clickedScaleId).options();
                    setPriceScaleSettings(prev => ({
                        ...prev,
                        autoScale: options.autoScale,
                        scaleMode: options.mode,
                        invertScale: options.invertScale
                    }));
                }

                setPriceScaleContextMenu({
                    visible: true,
                    x: e.clientX,
                    y: e.clientY,
                    priceScaleId: clickedScaleId
                });
            }

        };

        const container = chartContainerRef.current;
        container.addEventListener('contextmenu', handlePriceScaleContextMenu);

        return () => {
            container.removeEventListener('contextmenu', handlePriceScaleContextMenu);
        };
    }, []);

    // Handle price scale settings changes
    const handleScaleModeChange = useCallback((mode) => {
        setPriceScaleSettings(prev => ({ ...prev, scaleMode: mode }));
        const scaleId = priceScaleContextMenu.priceScaleId || 'right';

        if (chartRef.current) {
            chartRef.current.priceScale(scaleId).applyOptions({
                mode: mode,
            });
        }
    }, [priceScaleContextMenu.priceScaleId]);

    const handleAutoScaleChange = useCallback((value) => {
        setPriceScaleSettings(prev => ({ ...prev, autoScale: value }));
        const scaleId = priceScaleContextMenu.priceScaleId || 'right';

        if (chartRef.current) {
            chartRef.current.priceScale(scaleId).applyOptions({
                autoScale: value,
            });
        }
    }, [priceScaleContextMenu.priceScaleId]);

    const handleInvertScaleChange = useCallback((value) => {
        setPriceScaleSettings(prev => ({ ...prev, invertScale: value }));
        const scaleId = priceScaleContextMenu.priceScaleId || 'right';

        if (chartRef.current) {
            chartRef.current.priceScale(scaleId).applyOptions({
                invertScale: value,
            });
        }
    }, [priceScaleContextMenu.priceScaleId]);


    const isActuallyLoadingRef = useRef(true); // Track if we're actually loading data (not just updating indicators) - start as true on mount
    const chartRef = useRef(null);
    const mainSeriesRef = useRef(null);
    const seriesMarkersRef = useRef(null); // Ref for series markers primitive (lightweight-charts v5)

    // Unified Indicator Maps for Multi-Instance Support
    const indicatorSeriesMap = useRef(new Map()); // Map<id, Series | Object>
    const indicatorPanesMap = useRef(new Map());  // Map<id, Pane | Object>
    const indicatorTypesMap = useRef(new Map());  // Map<id, type string> - Track indicator types for cleanup

    // Keeping these for now if used by specific legacy logic, but goal is to move to maps
    // Integrated indicator series refs (displayed within main chart)
    const volumeSeriesRef = useRef(null); // Volume might remain special or move to map
    const cumulativeVolumeRef = useRef(0); // Track cumulative day volume for per-candle calculation

    const chartReadyRef = useRef(false); // Track when chart is fully stable and ready for indicator additions
    const lineToolManagerRef = useRef(null);
    // HIGH FIX ML-3: Store alert subscriptions for cleanup
    const alertSubscriptionsRef = useRef({
        alertsChanged: null,
        alertTriggered: null,
        priceScaleClicked: null
    });
    const priceScaleTimerRef = useRef(null); // Ref for the candle countdown timer
    const tpoProfileRef = useRef(null); // Ref for TPO Profile primitive
    const oiPriceLinesRef = useRef({ maxCallOI: null, maxPutOI: null, maxPain: null }); // Refs for OI price lines
    const firstCandleSeriesRef = useRef([]); // Array of line series for all days' high/low
    const priceActionRangeSeriesRef = useRef([]); // Array of line series for PAR support/resistance
    const rangeBreakoutSeriesRef = useRef([]); // Array of line series for range breakout high/low
    const cprSeriesRef = useRef([]); // Array of line series for CPR (Pivot, BC, TC per day)
    const redCandleZonesSeriesRef = useRef([]); // Array of line series for Red Candle Zones
    const marketBiasSeriesRef = useRef({ candles: null, band: null }); // Market Bias refs
    const srVolumeBoxesSeriesRef = useRef([]); // Array of Candlestick/Line series for SR Volume Boxes
    const pivotPointsSeriesRef = useRef([]); // Array of line series for Pivot Points
    const vwapBandsSeriesRef = useRef({ center: null, upper1: null, lower1: null, upper2: null, lower2: null }); // VWAP bands
    const annStrategySeriesRef = useRef(null); // ANN Strategy prediction series
    const annStrategyPaneRef = useRef(null); // ANN Strategy pane reference
    const riskCalculatorPrimitiveRef = useRef(null); // Risk Calculator draggable primitive
    const wsRef = useRef(null);
    const chartTypeRef = useRef(chartType);
    const dataRef = useRef([]);
    const comparisonSeriesRefs = useRef(new Map());
    const comparisonPanesRef = useRef(new Map()); // Track panes for 'newPane' comparison mode
    const visualTradingRef = useRef(null);
    const [error, setError] = useState(null);

    // Pane context menu hook
    const {
        paneContextMenu,
        maximizedPane,
        collapsedPanes,
        handlePaneMenu,
        closePaneMenu,
        handleMaximizePane,
        handleCollapsePane,
        handleMovePaneUp,
        handleDeletePane,
        canPaneMoveUp
    } = usePaneMenu({
        chartRef,
        chartContainerRef,
        indicatorPanesMap,
        onIndicatorRemove,
        onIndicatorMoveUp: onIndicatorMoveUp // Extract from props
    });


    // Multi-leg strategy mode refs
    const strategyWsRefs = useRef({}); // Map: legId -> WebSocket
    const strategyDataRef = useRef({}); // Map: legId -> data array
    const strategyLatestRef = useRef({}); // Map: legId -> latest price

    // Component mount state for cleanup safety
    const mountedRef = useRef(true);

    // Replay State
    const [isReplayMode, setIsReplayMode] = useState(false);
    const isReplayModeRef = useRef(false); // Ref to track replay mode in callbacks
    useEffect(() => { isReplayModeRef.current = isReplayMode; }, [isReplayMode]);

    // Track component mounted state
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const [isPlaying, setIsPlaying] = useState(false);
    const [replaySpeed, setReplaySpeed] = useState(1);
    const [replayIndex, setReplayIndex] = useState(null);
    const [isSelectingReplayPoint, setIsSelectingReplayPoint] = useState(false);
    const fullDataRef = useRef([]); // Store full data for replay
    const replayIntervalRef = useRef(null);
    const fadedSeriesRef = useRef(null); // Store faded series for future candles

    // Refs for stable callbacks to prevent race conditions
    const replayIndexRef = useRef(null);
    const isPlayingRef = useRef(false);
    const updateReplayDataRef = useRef(null); // Ref to store updateReplayData function
    useEffect(() => { replayIndexRef.current = replayIndex; }, [replayIndex]);
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

    // Historical data scroll loading refs
    const isLoadingOlderDataRef = useRef(false);
    const hasMoreHistoricalDataRef = useRef(true);
    const oldestLoadedTimeRef = useRef(null);
    const abortControllerRef = useRef(null);

    // Flag to prevent operations on disposed chart (fixes "Object is disposed" error)
    const isDisposedRef = useRef(false);

    // Shift+Click Quick Measure Tool refs and state
    const isShiftPressedRef = useRef(false);
    const measureStartPointRef = useRef(null);
    const [measureData, setMeasureData] = useState(null);

    // Refs to track current prop values for use in closures (chart initialization useEffect)
    const symbolRef = useRef(symbol);
    const exchangeRef = useRef(exchange);
    const intervalRef = useRef(interval);
    const indicatorsRef = useRef(indicators);
    const isSessionBreakVisibleRef = useRef(isSessionBreakVisible);
    // LOW FIX ML-13: Add strategyConfigRef to prevent large object closure capture
    const strategyConfigRef = useRef(strategyConfig);

    // Keep refs in sync with props
    useEffect(() => { symbolRef.current = symbol; }, [symbol]);
    useEffect(() => { exchangeRef.current = exchange; }, [exchange]);
    useEffect(() => { intervalRef.current = interval; }, [interval]);
    useEffect(() => { indicatorsRef.current = indicators; }, [indicators]);
    useEffect(() => { isSessionBreakVisibleRef.current = isSessionBreakVisible; }, [isSessionBreakVisible]);
    useEffect(() => { strategyConfigRef.current = strategyConfig; }, [strategyConfig]);

    // Track previous symbol for alert persistence
    const prevSymbolRef = useRef({ symbol: null, exchange: null });

    // Alert persistence now handled by alertService (imported above)

    // Sync interval changes with LineToolManager for drawing visibility filtering
    useEffect(() => {
        if (lineToolManagerRef.current && interval) {
            const seconds = intervalToSeconds(interval);
            if (typeof lineToolManagerRef.current.setCurrentInterval === 'function') {
                lineToolManagerRef.current.setCurrentInterval(seconds);
            }
        }
    }, [interval]);

    // Loading state for scroll-back (shows subtle indicator)
    const [isLoadingOlderData, setIsLoadingOlderData] = useState(false);

    const applyDefaultCandlePosition = (explicitLength, candleWindow = DEFAULT_CANDLE_WINDOW) => {
        if (!chartRef.current) return;

        const inferredLength = Number.isFinite(explicitLength)
            ? explicitLength
            : (mainSeriesRef.current?.data()?.length ?? 0);

        if (!inferredLength || inferredLength <= 0) {
            return;
        }

        // Calculate from/to at top level for both branches and setDefaultRange
        const lastIndex = Math.max(inferredLength - 1, 0);
        const effectiveWindow = Math.min(candleWindow, inferredLength);
        const to = lastIndex + DEFAULT_RIGHT_OFFSET;
        const from = to - effectiveWindow;

        try {
            const timeScale = chartRef.current.timeScale();
            timeScale.applyOptions({ rightOffset: DEFAULT_RIGHT_OFFSET });

            // If we have fewer candles than the window, use fitContent to fill the visible area
            // This prevents empty space on the left when data is limited
            if (inferredLength < candleWindow) {
                timeScale.fitContent();
            } else {
                timeScale.setVisibleLogicalRange({ from, to });
            }
        } catch (err) {
            logger.warn('Failed to apply default candle position', err);
        }

        chartRef.current.priceScale('right').applyOptions({ autoScale: true });
        if (lineToolManagerRef.current) {
            lineToolManagerRef.current.setDefaultRange({ from, to });
        }
    };

    // Axis Label State
    const [axisLabel, setAxisLabel] = useState(null);

    const isChartVisibleRef = useRef(true);

    // OHLC Header Bar State
    const [ohlcData, setOhlcData] = useState(null);

    // Indicator Legend Dropdown State
    const [indicatorDropdownOpen, setIndicatorDropdownOpen] = useState(false);

    // Risk Calculator State
    const [riskCalculatorResults, setRiskCalculatorResults] = useState(null);

    const [panePositions, setPanePositions] = useState({}); // Tracks vertical position of each indicator pane
    const indicatorDropdownRef = useRef(null);

    useEffect(() => {
        chartTypeRef.current = chartType;
    }, [chartType]);

    // Expose undo/redo and line tool manager to parent
    useImperativeHandle(ref, () => ({
        undo: () => {
            if (lineToolManagerRef.current) lineToolManagerRef.current.undo();
        },
        redo: () => {
            if (lineToolManagerRef.current) lineToolManagerRef.current.redo();
        },
        getLineToolManager: () => lineToolManagerRef.current,
        clearTools: () => {
            if (lineToolManagerRef.current) lineToolManagerRef.current.clearTools();
        },
        addPriceAlert: (alert) => {
            // Bridge App-level alerts to the line-tools UserPriceAlerts primitive
            // WITHOUT opening an extra dialog – just create the alert directly.
            try {
                const manager = lineToolManagerRef.current;
                const userAlerts = manager && manager._userPriceAlerts;
                if (!userAlerts || !alert || alert.price == null) return;

                if (typeof userAlerts.setSymbolName === 'function') {
                    userAlerts.setSymbolName(symbol, exchange);
                }

                const priceNum = Number(alert.price);
                if (!Number.isFinite(priceNum)) return;

                // Directly add the alert with a simple crossing condition so it
                // is rendered on the chart without another confirmation dialog.
                if (typeof userAlerts.addAlertWithCondition === 'function') {
                    userAlerts.addAlertWithCondition(priceNum, 'crossing');
                } else if (typeof userAlerts.openEditDialog === 'function') {
                    // Fallback for older builds: still ensure it works, even if
                    // it means showing the internal dialog.
                    userAlerts.openEditDialog(alert.id, {
                        price: priceNum,
                        condition: 'crossing',
                    });
                }
            } catch (err) {
                logger.warn('Failed to add price alert to chart', err);
            }
        },
        removePriceAlert: (externalId) => {
            try {
                const manager = lineToolManagerRef.current;
                const userAlerts = manager && manager._userPriceAlerts;
                if (!userAlerts || !externalId) return;

                if (typeof userAlerts.removeAlert === 'function') {
                    userAlerts.removeAlert(externalId);
                }
            } catch (err) {
                logger.warn('Failed to remove price alert from chart', err);
            }
        },
        restartPriceAlert: (price, condition = 'crossing') => {
            try {
                const manager = lineToolManagerRef.current;
                const userAlerts = manager && manager._userPriceAlerts;
                if (!userAlerts || price == null) return;

                const priceNum = Number(price);
                if (!Number.isFinite(priceNum)) return;

                if (typeof userAlerts.addAlertWithCondition === 'function') {
                    userAlerts.addAlertWithCondition(priceNum, condition === 'crossing' ? 'crossing' : condition);
                }
            } catch (err) {
                logger.warn('Failed to restart price alert on chart', err);
            }
        },
        resetZoom: () => {
            applyDefaultCandlePosition(dataRef.current.length);
        },
        getChartContainer: () => chartContainerRef.current,
        getCurrentPrice: () => {
            if (dataRef.current && dataRef.current.length > 0) {
                const lastData = dataRef.current[dataRef.current.length - 1];
                return lastData.close ?? lastData.value;
            }
            return null;
        },
        toggleTimer: () => {
            if (priceScaleTimerRef.current) {
                const isVisible = priceScaleTimerRef.current.isVisible();
                priceScaleTimerRef.current.setVisible(!isVisible);

                // Toggle native price label: hide when our timer is shown, show when hidden
                if (mainSeriesRef.current) {
                    mainSeriesRef.current.applyOptions({
                        lastValueVisible: isVisible // If timer WAS visible, it IS NOW hidden, so show native label
                    });
                }

                return !isVisible;
            }
            return false;
        },
        applyDrawingOptions: (options) => {
            // Apply options to the currently selected drawing
            const manager = lineToolManagerRef.current;
            if (manager && manager._selectedTool) {
                try {
                    manager._selectedTool.applyOptions(options);
                    return true;
                } catch (err) {
                    logger.warn('Failed to apply drawing options:', err);
                }
            }
            return false;
        },
        updateDefaultToolOptions: (options) => {
            // Update default options for future drawings
            const manager = lineToolManagerRef.current;
            if (manager && typeof manager.updateToolOptions === 'function') {
                try {
                    manager.updateToolOptions(options);
                } catch (err) {
                    logger.warn('Failed to update default tool options:', err);
                }
            }
        },
        getSelectedDrawing: () => {
            // Get the currently selected drawing tool instance
            const manager = lineToolManagerRef.current;
            return manager?._selectedTool || null;
        },
        toggleReplay: () => {
            setIsReplayMode(prev => {
                const newMode = !prev;
                if (!prev) {
                    // Entering replay mode
                    fullDataRef.current = [...dataRef.current];
                    setIsPlaying(false);
                    isPlayingRef.current = false;
                    const startIndex = Math.max(0, dataRef.current.length - 1);
                    setReplayIndex(startIndex);
                    replayIndexRef.current = startIndex;
                    // Initialize replay data display - show all candles initially
                    setTimeout(() => {
                        if (mountedRef.current && updateReplayDataRef.current) {
                            updateReplayDataRef.current(startIndex, false);
                        }
                    }, 0);
                } else {
                    // Exiting replay mode
                    stopReplay();
                    setIsPlaying(false);
                    isPlayingRef.current = false;
                    setReplayIndex(null);
                    replayIndexRef.current = null;
                    setIsSelectingReplayPoint(false);

                    // Clean up faded series (if we were using it)
                    if (fadedSeriesRef.current && chartRef.current) {
                        try {
                            chartRef.current.removeSeries(fadedSeriesRef.current);
                        } catch (e) {
                            logger.warn('Error removing faded series:', e);
                        }
                        fadedSeriesRef.current = null;
                    }


                    // Restore full data
                    if (mainSeriesRef.current && fullDataRef.current.length > 0) {
                        dataRef.current = fullDataRef.current;
                        const transformedData = transformData(fullDataRef.current, chartTypeRef.current);
                        mainSeriesRef.current.setData(transformedData);
                        updateIndicators(fullDataRef.current, indicators);
                    }
                }

                // Notify parent about replay mode change
                if (onReplayModeChange) {
                    setTimeout(() => {
                        if (mountedRef.current) {
                            onReplayModeChange(newMode);
                        }
                    }, 0);
                }

                return newMode;
            });
        },
        editAlertById: (alertId) => {
            // Open the edit dialog for a specific alert by ID
            const manager = lineToolManagerRef.current;
            if (manager && typeof manager.editAlertById === 'function') {
                manager.editAlertById(alertId);
            }
        },
        createAlert: (price) => {
            const manager = lineToolManagerRef.current;
            const userAlerts = manager && manager._userPriceAlerts;
            if (userAlerts && typeof userAlerts.openEditDialog === 'function') {
                userAlerts.openEditDialog('new', { price: Number(price), condition: 'crossing' });
            }
        },
        toggleDrawingVisibility: (index) => {
            if (lineToolManagerRef.current && typeof lineToolManagerRef.current.toggleToolVisibilityByIndex === 'function') {
                lineToolManagerRef.current.toggleToolVisibilityByIndex(index);
            }
        },
        toggleDrawingLock: (index) => {
            if (lineToolManagerRef.current && typeof lineToolManagerRef.current.toggleToolLockByIndex === 'function') {
                lineToolManagerRef.current.toggleToolLockByIndex(index);
            }
        },
        removeDrawingByIndex: (index) => {
            if (lineToolManagerRef.current && typeof lineToolManagerRef.current.removeToolByIndex === 'function') {
                lineToolManagerRef.current.removeToolByIndex(index);
            }
        },
        enableSessionHighlighting: () => {
            if (lineToolManagerRef.current && typeof lineToolManagerRef.current.enableSessionHighlighting === 'function') {
                lineToolManagerRef.current.enableSessionHighlighting();
            }
        },
        disableSessionHighlighting: () => {
            if (lineToolManagerRef.current && typeof lineToolManagerRef.current.disableSessionHighlighting === 'function') {
                lineToolManagerRef.current.disableSessionHighlighting();
            }
        },
        // Shortcut helper methods
        getCrosshairPrice: () => {
            // Return the current price as the "crosshair price" since we don't track crosshair position
            // This is used by keyboard shortcuts for trading orders
            if (dataRef.current && dataRef.current.length > 0) {
                const lastData = dataRef.current[dataRef.current.length - 1];
                return lastData.close ?? lastData.value;
            }
            return null;
        },
        addAlertAtCrosshair: () => {
            // Add alert at current price (used by Alt+A shortcut)
            const currentPrice = dataRef.current?.length > 0
                ? (dataRef.current[dataRef.current.length - 1].close ?? dataRef.current[dataRef.current.length - 1].value)
                : null;
            if (currentPrice) {
                const manager = lineToolManagerRef.current;
                const userAlerts = manager && manager._userPriceAlerts;
                if (userAlerts && typeof userAlerts.addAlertWithCondition === 'function') {
                    userAlerts.addAlertWithCondition(currentPrice, 'crossing');
                }
            }
        },
        drawHorizontalLineAtCrosshair: () => {
            // Draw horizontal line at current price (used by Alt+H shortcut)
            const currentPrice = dataRef.current?.length > 0
                ? (dataRef.current[dataRef.current.length - 1].close ?? dataRef.current[dataRef.current.length - 1].value)
                : null;
            if (currentPrice && lineToolManagerRef.current) {
                lineToolManagerRef.current.createHorizontalLineAtPrice(currentPrice);
            }
        }
    }));

    // Helper function for zooming the chart
    const zoomChart = useCallback((zoomIn = true) => {
        if (!chartRef.current) return;

        try {
            const timeScale = chartRef.current.timeScale();
            const visibleRange = timeScale.getVisibleLogicalRange();

            if (!visibleRange) return;

            const { from, to } = visibleRange;
            const rangeSize = to - from;
            const center = (from + to) / 2;

            // Zoom in shrinks the visible range by 20%, zoom out expands by 25%
            const zoomFactor = zoomIn ? 0.8 : 1.25;
            const newRangeSize = rangeSize * zoomFactor;

            const newFrom = center - newRangeSize / 2;
            const newTo = center + newRangeSize / 2;

            timeScale.setVisibleLogicalRange({ from: newFrom, to: newTo });

        } catch (err) {
            logger.warn('Failed to zoom chart', err);
        }
    }, []);



    // Close indicator dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (indicatorDropdownRef.current && !indicatorDropdownRef.current.contains(event.target)) {
                setIndicatorDropdownOpen(false);
            }
        };

        if (indicatorDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [indicatorDropdownOpen]);

    // Track pane positions for indicator legends placed inside each pane
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const updatePanePositions = () => {
            try {
                const container = chartContainerRef.current;
                if (!container || !chartRef.current) return;

                // Try different selectors for pane elements
                let paneElements = container.querySelectorAll('table > tbody > tr');
                if (paneElements.length === 0) {
                    paneElements = container.querySelectorAll('table tr');
                }
                if (paneElements.length === 0) {
                    paneElements = container.querySelectorAll('[class*="pane"]');
                }

                if (paneElements.length === 0) return;

                const containerRect = container.getBoundingClientRect();
                const positions = {};

                // Map logical panes to IDs
                const paneToId = new Map();
                if (indicatorPanesMap.current) {
                    indicatorPanesMap.current.forEach((pane, id) => {
                        paneToId.set(pane, id);
                    });
                }

                // Get all logical panes from chart
                const allPanes = (chartRef.current.panes && typeof chartRef.current.panes === 'function')
                    ? chartRef.current.panes()
                    : [];

                // Filter visual rows
                const actualPanes = Array.from(paneElements).filter(el => {
                    const rect = el.getBoundingClientRect();
                    return rect.height > 10; // Skip separator rows
                });

                // Map visual rows to logical panes
                actualPanes.forEach((row, index) => {
                    const rowRect = row.getBoundingClientRect();
                    const topOffset = rowRect.top - containerRect.top;

                    if (index === 0) {
                        // Main pane (always index 0)
                        positions['main'] = topOffset;
                    } else {
                        // Assumption: visual rows (after filter) match logical panes order
                        // actualPanes[0] is main. logicalPanes[0] is main.
                        // So actualPanes[index] corresponds to allPanes[index]
                        if (index < allPanes.length) {
                            const logicalPane = allPanes[index];
                            const id = paneToId.get(logicalPane);
                            if (id) {
                                positions[id] = topOffset;
                            }
                        }
                    }
                });

                setPanePositions(positions);
            } catch (e) {
                logger.warn('Error updating pane positions:', e);
            }
        };

        // Run update after delay to ensure chart is fully rendered
        const timer = setTimeout(updatePanePositions, 500);

        // Debounced update - only schedules one update at a time to reduce CPU usage
        let pendingUpdate: ReturnType<typeof setTimeout> | null = null;
        const scheduleUpdate = (delay: number) => {
            // Skip if tab is hidden
            if (document.visibilityState === 'hidden') return;
            // Clear any pending update and schedule a new one
            if (pendingUpdate) clearTimeout(pendingUpdate);
            pendingUpdate = setTimeout(() => {
                pendingUpdate = null;
                if (document.visibilityState !== 'hidden') {
                    updatePanePositions();
                }
            }, delay);
        };

        // Also observe for DOM changes
        const observer = new MutationObserver(() => {
            scheduleUpdate(100);
        });

        observer.observe(chartContainerRef.current, {
            childList: true,
            subtree: true,
            attributes: true, // Watch for style changes (height/position) on rows
            attributeFilter: ['style', 'class', 'height']
        });

        // Update on resize
        const resizeObserver = new ResizeObserver(() => {
            scheduleUpdate(50);
        });
        resizeObserver.observe(chartContainerRef.current);

        return () => {
            clearTimeout(timer);
            if (pendingUpdate) clearTimeout(pendingUpdate);
            observer.disconnect();
            resizeObserver.disconnect();
        };
    }, [indicators, collapsedPanes]);



    // Handle active tool change
    useEffect(() => {
        if (lineToolManagerRef.current && activeTool) {
            // Handle special action tools that don't use startTool
            const manager = lineToolManagerRef.current;

            // Lock All Drawings - SET state based on App's state
            if (activeTool === 'lock_all') {
                // Don't toggle here - the App.jsx already toggled its state
                // We just need to ensure LineToolManager is in sync
                // The useEffect below handles the sync
                // Reset to cursor after action
                if (onToolUsed) onToolUsed();
                return;
            }

            // Hide All Drawings - SET state based on App's state
            if (activeTool === 'hide_drawings') {
                // Don't toggle here - the App.jsx already toggled its state
                // We just need to ensure LineToolManager is in sync
                // The useEffect below handles the sync
                // Reset to cursor after action
                if (onToolUsed) onToolUsed();
                return;
            }

            // Clear All Drawings - remove all drawings
            if (activeTool === 'clear_all') {
                if (typeof manager.clearTools === 'function') {
                    manager.clearTools();

                }
                // Reset to cursor after action
                if (onToolUsed) onToolUsed();
                return;
            }

            // Show Timer - toggle timer visibility (handled by useEffect below)
            if (activeTool === 'show_timer') {
                // Timer visibility is synced via the isTimerVisible prop
                // Reset to cursor after action
                if (onToolUsed) onToolUsed();
                return;
            }


            const mappedTool = TOOL_MAP[activeTool] || 'None';


            if (lineToolManagerRef.current && typeof lineToolManagerRef.current.startTool === 'function') {
                lineToolManagerRef.current.startTool(mappedTool);

            }
        }
    }, [activeTool, onToolUsed]);

    // Sync drawings lock state from props to LineToolManager
    useEffect(() => {
        if (!lineToolManagerRef.current) return;
        const manager = lineToolManagerRef.current;

        // Get current state from LineToolManager
        const currentlyLocked = typeof manager.areDrawingsLocked === 'function'
            ? manager.areDrawingsLocked()
            : false;

        // Only update if state differs
        if (isDrawingsLocked !== currentlyLocked) {
            if (isDrawingsLocked) {
                if (typeof manager.lockAllDrawings === 'function') {
                    manager.lockAllDrawings();

                }
            } else {
                if (typeof manager.unlockAllDrawings === 'function') {
                    manager.unlockAllDrawings();

                }
            }
        }
    }, [isDrawingsLocked]);

    // Sync drawings visibility state from props to LineToolManager
    useEffect(() => {
        if (!lineToolManagerRef.current) return;
        const manager = lineToolManagerRef.current;

        // Get current state from LineToolManager
        const currentlyHidden = typeof manager.areDrawingsHidden === 'function'
            ? manager.areDrawingsHidden()
            : false;

        // Only update if state differs
        if (isDrawingsHidden !== currentlyHidden) {
            if (isDrawingsHidden) {
                if (typeof manager.hideAllDrawings === 'function') {
                    manager.hideAllDrawings();

                }
            } else {
                if (typeof manager.showAllDrawings === 'function') {
                    manager.showAllDrawings();

                }
            }
        }
    }, [isDrawingsHidden]);

    // Sync timer visibility state from props to PriceScaleTimer
    useEffect(() => {
        if (!priceScaleTimerRef.current) return;
        const timer = priceScaleTimerRef.current;

        if (typeof timer.setVisible === 'function') {
            timer.setVisible(isTimerVisible);

            // Toggle native price label: hide when our timer is shown, show when hidden
            // This ensures they are mutually exclusive
            if (mainSeriesRef.current) {
                mainSeriesRef.current.applyOptions({
                    lastValueVisible: !isTimerVisible // Show native label only when timer is HIDDEN
                });
            }
        }
    }, [isTimerVisible]);

    // Sync session break visibility state from props to LineToolManager
    useEffect(() => {
        if (!lineToolManagerRef.current) return;
        const manager = lineToolManagerRef.current;

        // Track if this effect run is still valid (not superseded by a newer run)
        let cancelled = false;

        // Only enable if requested - don't disable/re-enable on every run
        if (isSessionBreakVisible) {
            if (typeof manager.enableSessionHighlighting === 'function') {
                manager.enableSessionHighlighting();

                // Fetch session boundaries from API for accurate market timing
                const fetchSessionData = async () => {
                    try {
                        // Import dynamically to avoid circular deps
                        const { getSessionBoundaries } = await import('../../services/marketService.js');

                        // Check if cancelled before proceeding
                        if (cancelled) return;

                        // Get unique dates from chart data
                        const data = dataRef.current;
                        if (!data || data.length === 0) return;

                        const uniqueDates = new Set<string>();
                        data.forEach((candle: any) => {
                            const date = new Date(candle.time * 1000);
                            const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
                            uniqueDates.add(dateStr);
                        });

                        // Fetch session boundaries for each unique date
                        const sessionStartTimes = new Map<string, number>();
                        const currentExchange = exchangeRef.current || 'NSE';

                        for (const dateStr of uniqueDates) {
                            // Check if cancelled during the loop
                            if (cancelled) return;

                            try {
                                const boundaries = await getSessionBoundaries(dateStr, currentExchange);
                                if (boundaries && boundaries.start_time) {
                                    // Convert from milliseconds to seconds
                                    const startTimeSeconds = Math.floor(boundaries.start_time / 1000);
                                    sessionStartTimes.set(dateStr, startTimeSeconds);
                                }
                            } catch (err) {
                                // Silently ignore individual date failures
                            }
                        }

                        // Check if cancelled before setting data
                        if (cancelled) return;

                        // Pass session data to the plugin
                        if (sessionStartTimes.size > 0 && typeof manager.setSessionStartTimes === 'function') {
                            manager.setSessionStartTimes(sessionStartTimes);
                        }
                    } catch (err) {
                        logger.warn('[ChartComponent] Could not fetch session data, using fallback detection:', err);
                    }
                };

                fetchSessionData();
            }
        }

        // Cleanup function: disable session highlighting when toggling off or unmounting
        return () => {
            cancelled = true;
            // IMPORTANT: Use lineToolManagerRef.current (not the captured manager) to avoid stale closure
            // When symbols change, a new manager is created, but cleanup still has the old manager in its closure
            const currentManager = lineToolManagerRef.current;
            if (currentManager && typeof currentManager.disableSessionHighlighting === 'function') {
                currentManager.disableSessionHighlighting();
            }
        };
    }, [isSessionBreakVisible, exchange]);

    // Handle zoom clicks on chart (both zoom-in and zoom-out)
    useEffect(() => {
        const isZoomIn = activeTool === 'zoom_in';
        const isZoomOut = activeTool === 'zoom_out';

        if ((!isZoomIn && !isZoomOut) || !chartContainerRef.current) return;

        const handleZoomClick = (e) => {
            // Only handle left clicks
            if (e.button !== 0) return;
            zoomChart(isZoomIn);
        };

        // Handle ESC key to exit zoom mode
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                if (onToolUsed) onToolUsed();

            }
        };

        const container = chartContainerRef.current;
        container.addEventListener('click', handleZoomClick);
        window.addEventListener('keydown', handleKeyDown);

        // Change cursor based on zoom direction
        container.style.cursor = isZoomIn ? 'zoom-in' : 'zoom-out';

        return () => {
            container.removeEventListener('click', handleZoomClick);
            window.removeEventListener('keydown', handleKeyDown);
            container.style.cursor = '';
        };
    }, [activeTool, zoomChart, onToolUsed]);

    // Shift+Click Quick Measure Tool - keyboard event listeners
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Shift' && !isShiftPressedRef.current) {
                isShiftPressedRef.current = true;
                if (chartContainerRef.current) {
                    chartContainerRef.current.style.cursor = 'crosshair';
                }
            }
        };

        const handleKeyUp = (e) => {
            if (e.key === 'Shift') {
                isShiftPressedRef.current = false;
                measureStartPointRef.current = null;
                if (chartContainerRef.current) {
                    chartContainerRef.current.style.cursor = '';
                }
                setMeasureData(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Alt+Click Risk Calculator Entry/SL Setter - keyboard event listeners
    const isAltPressedRef = useRef(false);
    const [clickToSetMode, setClickToSetMode] = useState(null); // 'entry' | 'stopLoss' | null

    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.key === 'Alt' || e.altKey) && !isAltPressedRef.current) {
                isAltPressedRef.current = true;
                const riskCalcInd = indicators?.find(i => i.type === 'riskCalculator' && i.visible);
                if (riskCalcInd && chartContainerRef.current) {
                    chartContainerRef.current.style.cursor = 'crosshair';
                }
            }
        };

        const handleKeyUp = (e) => {
            if (e.key === 'Alt' || !e.altKey) {
                isAltPressedRef.current = false;
                if (chartContainerRef.current && chartContainerRef.current.style.cursor === 'crosshair') {
                    chartContainerRef.current.style.cursor = '';
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [indicators]);

    // Alt+Click Risk Calculator Entry/SL Setter - chart click handler
    useEffect(() => {
        if (!chartContainerRef.current || !chartRef.current || !mainSeriesRef.current) return;

        const handleAltClick = (event) => {
            if (!isAltPressedRef.current) return;

            const riskCalcInd = indicators?.find(i => i.type === 'riskCalculator' && i.visible);
            if (!riskCalcInd) return;

            event.preventDefault();
            event.stopPropagation();

            // Get price from click coordinates
            const rect = chartContainerRef.current.getBoundingClientRect();
            const y = event.clientY - rect.top;

            try {
                const price = mainSeriesRef.current.coordinateToPrice(y);
                if (!price || price <= 0) return;

                const updates = { ...riskCalcInd };

                // Determine which parameter to set
                if (!riskCalcInd.entryPrice || riskCalcInd.entryPrice === 0) {
                    // Set entry first
                    updates.entryPrice = price;
                    setClickToSetMode('stopLoss');
                } else if (!riskCalcInd.stopLossPrice || riskCalcInd.stopLossPrice === 0) {
                    // Set stop loss second
                    updates.stopLossPrice = price;
                    setClickToSetMode(null);

                    // Auto-detect side after both entry and SL are set
                    const detectedSide = autoDetectSide(updates.entryPrice || riskCalcInd.entryPrice, price);
                    if (detectedSide) {
                        updates.side = detectedSide;
                    }
                } else {
                    // Both exist - toggle between entry and SL based on current mode
                    if (clickToSetMode === 'stopLoss') {
                        updates.stopLossPrice = price;
                        setClickToSetMode('entry');
                    } else {
                        updates.entryPrice = price;
                        setClickToSetMode('stopLoss');
                    }

                    // Auto-detect side after updating
                    const detectedSide = autoDetectSide(
                        updates.entryPrice || riskCalcInd.entryPrice,
                        updates.stopLossPrice || riskCalcInd.stopLossPrice
                    );
                    if (detectedSide) {
                        updates.side = detectedSide;
                    }
                }

                // Update indicator settings
                if (onIndicatorSettings) {
                    onIndicatorSettings(riskCalcInd.id, updates);
                }
            } catch (error) {
                logger.error('Error setting price from Alt+Click:', error);
            }
        };

        const container = chartContainerRef.current;
        container.addEventListener('click', handleAltClick, true);

        return () => {
            container.removeEventListener('click', handleAltClick, true);
        };
    }, [indicators, onIndicatorSettings, clickToSetMode]);

    // Shift+Click Quick Measure Tool - chart click handler
    useEffect(() => {
        if (!chartRef.current || !mainSeriesRef.current) return;

        const handleChartClick = (param) => {
            if (!isShiftPressedRef.current) return;
            if (!param.point || !param.time) return;

            const chart = chartRef.current;
            const series = mainSeriesRef.current;
            if (!chart || !series) return;

            const price = series.coordinateToPrice(param.point.y);
            const logical = chart.timeScale().coordinateToLogical(param.point.x);

            if (!measureStartPointRef.current) {
                // First click - set start point
                measureStartPointRef.current = {
                    price,
                    logical,
                    time: param.time,
                    x: param.point.x,
                    y: param.point.y
                };
                // Show a subtle indicator that first point is set
                setMeasureData({ isFirstPoint: true, x: param.point.x, y: param.point.y });
            } else {
                // Second click - calculate and show measurement
                const start = measureStartPointRef.current;
                const priceChange = price - start.price;
                const percentChange = (priceChange / start.price) * 100;
                const barCount = Math.abs(Math.round(logical - start.logical));

                // Calculate time difference
                const startTime = new Date(start.time * 1000);
                const endTime = new Date(param.time * 1000);
                const timeDiffMs = Math.abs(endTime.getTime() - startTime.getTime());
                const timeElapsed = formatTimeDiff(timeDiffMs);

                setMeasureData({
                    priceChange,
                    percentChange,
                    barCount,
                    timeElapsed,
                    position: {
                        x: (start.x + param.point.x) / 2,
                        y: Math.min(start.y, param.point.y) - 10
                    },
                    line: {
                        x1: start.x, y1: start.y,
                        x2: param.point.x, y2: param.point.y
                    }
                });

                // Reset for next measurement
                measureStartPointRef.current = null;
            }
        };

        chartRef.current.subscribeClick(handleChartClick);

        return () => {
            if (chartRef.current) {
                try {
                    chartRef.current.unsubscribeClick(handleChartClick);
                } catch (e) {
                    // Chart may be disposed
                }
            }
        };
    }, [symbol, interval]);

    // Track chart visibility to avoid unnecessary RAF work
    useEffect(() => {
        if (!chartContainerRef.current) return undefined;

        const handleVisibility = (entries) => {
            if (entries && entries[0]) {
                isChartVisibleRef.current = entries[0].isIntersecting;
            }
        };

        const observer = new IntersectionObserver(handleVisibility, { threshold: 0 });
        observer.observe(chartContainerRef.current);

        const handleDocumentVisibility = () => {
            if (document.visibilityState === 'hidden') {
                isChartVisibleRef.current = false;
            }
        };

        document.addEventListener('visibilitychange', handleDocumentVisibility);

        return () => {
            observer.disconnect();
            document.removeEventListener('visibilitychange', handleDocumentVisibility);
        };
    }, []);

    // Update Axis Label Position and Content
    const updateAxisLabel = useCallback(() => {
        if (!chartRef.current || !mainSeriesRef.current || !chartContainerRef.current) return;

        const data = mainSeriesRef.current.data();
        if (!data || data.length === 0) {
            setAxisLabel(null);
            return;
        }

        const lastData = data[data.length - 1];
        const price = lastData.close ?? lastData.value;
        if (price === undefined) {
            setAxisLabel(null);
            return;
        }

        const coordinate = mainSeriesRef.current.priceToCoordinate(price);

        if (coordinate === null) {
            setAxisLabel(null);
            return;
        }

        let color = '#2962FF';
        if (lastData.open !== undefined && lastData.close !== undefined) {
            color = lastData.close >= lastData.open ? '#089981' : '#F23645';
        }

        try {
            let labelText = price.toFixed(2);

            // Handle Percentage Mode Label
            if (comparisonSymbols.length > 0) {
                const timeScale = chartRef.current.timeScale();
                const visibleRange = timeScale.getVisibleLogicalRange();

                if (visibleRange) {
                    const firstIndex = Math.max(0, Math.round(visibleRange.from));
                    if (dataRef.current && firstIndex < dataRef.current.length) {
                        const baseData = dataRef.current[firstIndex];
                        if (baseData) {
                            const baseValue = baseData.close ?? baseData.value;

                            if (baseValue && baseValue !== 0) {
                                const percentage = ((price - baseValue) / baseValue) * 100;
                                labelText = `${percentage >= 0 ? '+' : ''}${percentage.toFixed(2)}%`;
                            }
                        }
                    }
                }
            }

            const newLabel = {
                top: coordinate,
                price: labelText,
                symbol: comparisonSymbols.length > 0 ? symbol : null, // Only show symbol if in comparison mode
                color: color
            };

            setAxisLabel(prev => {
                if (!prev || prev.top !== newLabel.top || prev.price !== newLabel.price || prev.symbol !== newLabel.symbol || prev.color !== newLabel.color) {
                    return newLabel;
                }
                return prev;
            });
        } catch (err) {
            logger.error('Error in updateAxisLabel:', err);
        }
    }, [comparisonSymbols]);

    // Helper to update OHLC from latest candle data (for real-time updates)
    const updateOhlcFromLatest = useCallback(() => {
        if (dataRef.current && dataRef.current.length > 0) {
            const lastData = dataRef.current[dataRef.current.length - 1];
            const prevData = dataRef.current.length > 1 ? dataRef.current[dataRef.current.length - 2] : null;
            const change = prevData ? lastData.close - prevData.close : 0;
            const changePercent = prevData && prevData.close !== 0 ? ((change / prevData.close) * 100) : 0;

            setOhlcData({
                open: lastData.open,
                high: lastData.high,
                low: lastData.low,
                close: lastData.close,
                change: change,
                changePercent: changePercent,
                isUp: lastData.close >= lastData.open
            });
        }
    }, []);

    // Throttled axis label updates - only updates when chart changes, not every frame
    // This saves significant CPU when idle compared to continuous RAF loop
    useEffect(() => {
        let updateScheduled = false;
        let lastUpdateTime = 0;
        const THROTTLE_MS = 100; // Update at most every 100ms

        const scheduleUpdate = () => {
            if (updateScheduled || document.visibilityState === 'hidden' || !isChartVisibleRef.current) return;

            const now = Date.now();
            const timeSinceLastUpdate = now - lastUpdateTime;

            if (timeSinceLastUpdate >= THROTTLE_MS) {
                // Enough time has passed, update immediately
                updateAxisLabel();
                lastUpdateTime = now;
            } else {
                // Schedule update for later
                updateScheduled = true;
                setTimeout(() => {
                    updateScheduled = false;
                    if (document.visibilityState !== 'hidden' && isChartVisibleRef.current) {
                        updateAxisLabel();
                        lastUpdateTime = Date.now();
                    }
                }, THROTTLE_MS - timeSinceLastUpdate);
            }
        };

        // Update on chart events instead of continuous RAF
        const chart = chartRef.current;
        if (!chart) return;

        // Subscribe to chart changes that require axis label update
        const handleCrosshairMove = () => scheduleUpdate();
        const handleVisibleRangeChange = () => scheduleUpdate();

        chart.subscribeCrosshairMove(handleCrosshairMove);
        chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

        // Initial update
        scheduleUpdate();

        // Update when tab becomes visible
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                scheduleUpdate();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            chart.unsubscribeCrosshairMove(handleCrosshairMove);
            chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [updateAxisLabel]);

    // Keep track of active tool for the wrapper
    const activeToolRef = useRef(activeTool);
    useEffect(() => {
        activeToolRef.current = activeTool;
    }, [activeTool]);

    // Track onToolUsed to avoid stale closures in callback
    const onToolUsedRef = useRef(onToolUsed);
    useEffect(() => {
        onToolUsedRef.current = onToolUsed;
    }, [onToolUsed]);

    // Initialize LineToolManager when series is ready
    const initializeLineTools = (series) => {
        if (!lineToolManagerRef.current) {
            const manager = new LineToolManager();

            // Handle tool completion
            manager.onToolCompleted = (completedToolType) => {
                const finishedTool = activeToolRef.current;
                const currentOnToolUsed = onToolUsedRef.current;

                // Don't trigger onToolUsed for zoom tools since they handle their own state
                const isZoomTool = finishedTool === 'zoom_in' || finishedTool === 'zoom_out';

                if (finishedTool && finishedTool !== 'cursor' && !isZoomTool) {
                    if (currentOnToolUsed) currentOnToolUsed();

                    // Support for Sequential Mode:
                    // If activeTool is NOT reset by onToolUsed (i.e. we are in sequential mode),
                    // we need to re-activate the tool on the manager because the manager self-resets to None.
                    setTimeout(() => {
                        // Check if activeTool is STILL same (meaning sequential mode active)
                        // And verify manager exists
                        if (activeToolRef.current === finishedTool && lineToolManagerRef.current) {
                            const mappedTool = TOOL_MAP[finishedTool] || 'None';
                            // We call startTool to restart the tool. 
                            // This might deselect the just-drawn tool, which is expected for sequential drawing.
                            lineToolManagerRef.current.startTool(mappedTool);
                        }
                    }, 0);
                }
            };

            series.attachPrimitive(manager);
            lineToolManagerRef.current = manager;

            // Enable session highlighting if the setting is active
            // This ensures session breaks appear immediately when switching symbols
            if (isSessionBreakVisibleRef.current && typeof manager.enableSessionHighlighting === 'function') {
                logger.debug('[ChartComponent] Enabling session highlighting on new manager');
                manager.enableSessionHighlighting();
            }

            // Ensure alerts primitive (if present) knows the current symbol
            try {
                // Set symbol on the manager itself for alert notifications
                // This will also propagate to UserPriceAlerts internally
                if (typeof manager.setSymbolName === 'function') {
                    manager.setSymbolName(symbol, exchange);
                }

                const userAlerts = (manager as any)._userPriceAlerts;
                // Bridge internal alert list out to React so the Alerts tab
                // can show alerts created from the chart-side UI.
                if (userAlerts && typeof userAlerts.alertsChanged === 'function' && typeof userAlerts.alerts === 'function' && typeof onAlertsSync === 'function') {
                    // HIGH FIX ML-3: Store subscription for cleanup
                    alertSubscriptionsRef.current.alertsChanged = userAlerts.alertsChanged().subscribe(() => {
                        try {
                            const rawAlerts = userAlerts.alerts() || [];
                            const mapped = rawAlerts.map(a => ({
                                id: a.id,
                                price: a.price,
                                condition: a.condition || 'crossing',
                                type: a.type || 'price',
                            }));
                            onAlertsSync(mapped);

                            // === Alert Auto-Save: Persist to localStorage for cloud sync ===
                            if (typeof userAlerts.exportAlerts === 'function') {
                                const alertsToSave = userAlerts.exportAlerts();
                                saveAlertsForSymbol(symbolRef.current, exchangeRef.current, alertsToSave as any);

                                // GlobalAlertMonitor refresh disabled - conflicts with watchlist WebSocket
                            }
                        } catch (err) {
                            logger.warn('Failed to sync chart alerts to app', err);
                        }
                    }, manager);
                }

                // Also bridge trigger events so the app can mark alerts as Triggered
                // and write log entries when the internal primitive fires.
                if (userAlerts && typeof userAlerts.alertTriggered === 'function' && typeof onAlertTriggered === 'function') {
                    // HIGH FIX ML-3: Store subscription for cleanup
                    alertSubscriptionsRef.current.alertTriggered = userAlerts.alertTriggered().subscribe((evt) => {
                        try {
                            onAlertTriggered({
                                externalId: evt.alertId,
                                price: evt.alertPrice,
                                timestamp: evt.timestamp,
                                direction: evt.direction,
                                condition: evt.condition,
                            });
                        } catch (err) {
                            logger.warn('Failed to propagate alertTriggered event to app', err);
                        }
                    }, manager);
                }

                // Subscribe to price scale + button clicks to show context menu
                if (userAlerts && typeof userAlerts.priceScaleClicked === 'function') {
                    // HIGH FIX ML-3: Store subscription for cleanup
                    alertSubscriptionsRef.current.priceScaleClicked = userAlerts.priceScaleClicked().subscribe((evt) => {
                        try {
                            setPriceScaleMenu({
                                visible: true,
                                x: evt.x,
                                y: evt.y,
                                price: evt.price
                            });
                        } catch (err) {
                            logger.warn('Failed to show price scale menu', err);
                        }
                    }, manager);
                }
            } catch (err) {
                logger.warn('Failed to initialize alert symbol name', err);
            }

            (window as any).lineToolManager = manager;
            setLineToolManager(manager);
            (window as any).chartInstance = chartRef.current;
            (window as any).seriesInstance = series;

            // Drawings persistence handled by useChartDrawings hook
        }
    };

    // Initialize PriceScaleTimer when series is ready
    const initializePriceScaleTimer = (series, intervalSeconds) => {
        if (!priceScaleTimerRef.current) {
            const timer = new PriceScaleTimer({
                timeframeSeconds: intervalSeconds,
                visible: isTimerVisible,
                textColor: '#FFFFFF',
                textPadding: 0.95
            } as any);
            series.attachPrimitive(timer);
            priceScaleTimerRef.current = timer;

            // Enforce visibility rule
            if (isTimerVisible) {
                series.applyOptions({ lastValueVisible: false });
            }
        }
    };

    const initializeVisualTrading = (series) => {
        if (!series) return;

        // Filter orders and positions for current symbol
        const relevantOrders = orders.filter(o => areSymbolsEquivalent(o.symbol, symbol));
        const relevantPositions = positions.filter(p => areSymbolsEquivalent(p.symbol, symbol));

        visualTradingRef.current = new VisualTrading({
            orders: relevantOrders,
            positions: relevantPositions,
            onModifyOrder: onModifyOrder as any,
            onCancelOrder: onCancelOrder
        });
        series.attachPrimitive(visualTradingRef.current);
    };

    // Initialize chart once on mount
    useEffect(() => {
        if (!chartContainerRef.current) return;

        // Use appearance settings or defaults based on theme
        const themeColors = getChartTheme(theme);
        const themeType = getThemeType(theme);

        // Only apply legacy appearance overrides for standard 'dark'/'light' themes
        // New themes (midnight, ocean) use their defined colors
        let backgroundColor = themeColors.background;
        let gridColor = themeColors.grid;
        let textColor = themeColors.text;

        if (theme === 'dark' && chartAppearance.darkBackground) {
            backgroundColor = chartAppearance.darkBackground;
        } else if (theme === 'light' && chartAppearance.lightBackground) {
            backgroundColor = chartAppearance.lightBackground;
        }

        if (theme === 'dark' && chartAppearance.darkGridColor) {
            gridColor = chartAppearance.darkGridColor;
        } else if (theme === 'light' && chartAppearance.lightGridColor) {
            gridColor = chartAppearance.lightGridColor;
        }

        const chart = createChart(chartContainerRef.current, ({
            watermark: {
                visible: false,
            },
            layout: {
                textColor: textColor,
                background: { color: backgroundColor },
                attributionLogo: false,
            },
            grid: {
                vertLines: {
                    color: gridColor,
                    visible: chartAppearance.showVerticalGridLines !== false,
                },
                horzLines: {
                    color: gridColor,
                    visible: chartAppearance.showHorizontalGridLines !== false,
                },
            },
            crosshair: {
                mode: magnetMode ? 1 : 0,
                vertLine: {
                    width: 1,
                    color: themeColors.crosshair,
                    style: 3,
                    labelBackgroundColor: themeColors.crosshair,
                },
                horzLine: {
                    width: 1,
                    color: themeColors.crosshair,
                    style: 3,
                    labelBackgroundColor: themeColors.crosshair,
                },
            },
            timeScale: {
                borderColor: themeColors.borderColor,
                timeVisible: true,
                rightOffset: 10, // Show ~10 candle widths of future time (TradingView style)
            },
            rightPriceScale: {
                borderColor: themeColors.borderColor,
            },
            handleScroll: {
                mouseWheel: false,
                pressedMouseMove: true,
            },
            handleScale: {
                mouseWheel: true,
                pinch: true,
            },
            kineticScroll: {
                mouse: false,
                touch: false,
            },
        }) as any);

        chartRef.current = chart;
        setChartInstance(chart);

        // DEBUG: Expose chart and indicator management to window for browser console testing
        if (typeof window !== 'undefined') {
            (window as any).__indicatorStore__ = {
                getState: () => ({
                    indicators: indicators || [],
                    addIndicator: (indicator) => {
                        if (onIndicatorSettings) {
                            // Add indicator via callback
                            const id = `ind_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                            const newIndicator = { ...indicator, id, visible: indicator.visible !== false };
                            (onIndicatorSettings as any)(id, indicator.type, indicator.settings);
                        }
                    },
                    removeIndicator: (id) => {
                        if (onIndicatorRemove) {
                            onIndicatorRemove(id);
                        }
                    },
                    updateIndicator: (id, updates) => {
                        if (onIndicatorSettings) {
                            const indicator = (indicators || []).find(ind => ind.id === id);
                            if (indicator) {
                                (onIndicatorSettings as any)(id, indicator.type, { ...indicator.settings, ...updates });
                            }
                        }
                    }
                })
            };

            // Expose chart instance and maps
            if (chartContainerRef.current) {
                (chartContainerRef.current as any).__chartInstance__ = chart;
                (chartContainerRef.current as any).__indicatorTypesMap__ = indicatorTypesMap;
                (chartContainerRef.current as any).__indicatorSeriesMap__ = indicatorSeriesMap;
                (chartContainerRef.current as any).__indicatorPanesMap__ = indicatorPanesMap;
                (chartContainerRef.current as any).__mainSeriesRef__ = mainSeriesRef.current;
            }

            // Also expose on window for easy access
            (window as any).chartInstance = chart;
        }

        // Load older historical data when user scrolls back to the oldest loaded candle
        const loadOlderData = async () => {
            // Guard against concurrent loads and check if more data is available
            if (isLoadingOlderDataRef.current || !hasMoreHistoricalDataRef.current) return;
            if (!oldestLoadedTimeRef.current || !mainSeriesRef.current || !dataRef.current) return;
            if (isReplayModeRef.current) return; // Don't load during replay mode

            isLoadingOlderDataRef.current = true;
            setIsLoadingOlderData(true); // Show loading indicator

            try {
                // Calculate date range for older data
                // Go back further based on interval type
                const oldestTime = oldestLoadedTimeRef.current;
                const oldestDate = new Date((oldestTime - IST_OFFSET_SECONDS) * 1000);

                // End date is 1 day before oldest loaded (to avoid overlap)
                const endDate = new Date(oldestDate);
                endDate.setDate(endDate.getDate() - 1);

                // Start date: go back based on interval
                const startDate = new Date(endDate);
                // Use refs to get current values instead of stale closure values
                const currentSymbol = symbolRef.current;
                const currentExchange = exchangeRef.current;
                const currentInterval = intervalRef.current;
                const currentIndicators = indicatorsRef.current;

                if (currentInterval.includes('m') || currentInterval.includes('h')) {
                    startDate.setDate(startDate.getDate() - 30); // 30 days for intraday
                } else {
                    startDate.setFullYear(startDate.getFullYear() - 1); // 1 year for daily+
                }

                const formatDate = (d) => d.toISOString().split('T')[0];

                logger.debug('[ScrollBack] Loading older data:', {
                    symbol: currentSymbol,
                    exchange: currentExchange,
                    interval: currentInterval,
                    startDate: formatDate(startDate),
                    endDate: formatDate(endDate)
                });

                // Abort any previous request
                if (abortControllerRef.current) {
                    abortControllerRef.current.abort();
                }
                abortControllerRef.current = new AbortController();

                const olderData = await getHistoricalKlines(
                    currentSymbol,
                    currentExchange,
                    currentInterval,
                    formatDate(startDate),
                    formatDate(endDate),
                    abortControllerRef.current.signal
                );

                if (!olderData || olderData.length === 0) {
                    logger.debug('[ScrollBack] No more historical data available');
                    hasMoreHistoricalDataRef.current = false;
                    isLoadingOlderDataRef.current = false;
                    return;
                }

                // Filter out any candles that might overlap with existing data
                const existingOldestTime = dataRef.current[0]?.time || 0;
                const filteredOlderData = olderData.filter(d => d.time < existingOldestTime);

                if (filteredOlderData.length === 0) {
                    logger.debug('[ScrollBack] All fetched data overlaps with existing, no more available');
                    hasMoreHistoricalDataRef.current = false;
                    isLoadingOlderDataRef.current = false;
                    return;
                }

                logger.debug('[ScrollBack] Prepending', filteredOlderData.length, 'older candles');

                // Save current visible range before prepending
                const timeScale = chart.timeScale();
                let currentLogicalRange = null;
                try {
                    currentLogicalRange = timeScale.getVisibleLogicalRange();
                } catch (e) {
                    // Ignore
                }

                // Prepend older data to existing data
                const prependCount = filteredOlderData.length;
                const newData = [...filteredOlderData, ...dataRef.current];
                dataRef.current = newData;

                // Update oldest loaded time
                oldestLoadedTimeRef.current = newData[0].time;

                // Update the chart with the new combined data
                const activeType = chartTypeRef.current;
                const transformedData = transformData(newData, activeType);
                mainSeriesRef.current.setData(transformedData);

                // Restore visible range shifted by the prepended candle count
                // This keeps the user's current view stable - they won't see a jump
                if (currentLogicalRange) {
                    try {
                        const newFrom = currentLogicalRange.from + prependCount;
                        const newTo = currentLogicalRange.to + prependCount;
                        timeScale.setVisibleLogicalRange({ from: newFrom, to: newTo });
                    } catch (e) {
                        logger.warn('[ScrollBack] Failed to restore visible range:', e);
                    }
                }

                // Also update fullDataRef for replay mode
                if (fullDataRef.current && fullDataRef.current.length > 0) {
                    fullDataRef.current = [...filteredOlderData, ...fullDataRef.current];
                }

                // Update indicators with new data
                updateIndicators(newData, currentIndicators);

            } catch (error) {
                if (error.name !== 'AbortError') {
                    logger.error('[ScrollBack] Error loading older data:', error);
                }
            } finally {
                isLoadingOlderDataRef.current = false;
                setIsLoadingOlderData(false); // Hide loading indicator
            }
        };

        // Handle Visible Time Range Change (Scrolling/Panning)
        const handleVisibleTimeRangeChange = (newVisibleRange) => {
            if (!newVisibleRange || !mainSeriesRef.current || !dataRef.current || dataRef.current.length === 0) return;

            const timeScale = chart.timeScale();
            const logicalRange = timeScale.getVisibleLogicalRange();

            if (logicalRange) {
                // The 'to' logical index represents the rightmost visible bar.
                const rawIndex = logicalRange.to;
                // Use Math.round to align with the visual bar boundary at x.5
                const lastIndex = Math.min(Math.round(rawIndex), dataRef.current.length - 1);

                // If we are scrolling back, 'to' might be valid.
                if (lastIndex >= 0) {
                    const candle = dataRef.current[lastIndex];
                    if (candle && priceScaleTimerRef.current) {
                        // Only update if we have valid open/close
                        if (candle.open !== undefined && candle.close !== undefined) {
                            priceScaleTimerRef.current.updateCandleData(candle.open, candle.close);
                        }
                    }
                }

                // Prefetch older data BEFORE user reaches the oldest candles
                // Trigger when fromIndex <= PREFETCH_THRESHOLD for seamless continuous scrolling
                const fromIndex = Math.round(logicalRange.from);
                if (fromIndex <= PREFETCH_THRESHOLD && hasMoreHistoricalDataRef.current && !isLoadingOlderDataRef.current) {
                    logger.debug('[ScrollBack] Prefetching older data (user is', fromIndex, 'candles from oldest)');
                    loadOlderData();
                }
            }
        };

        // Handle Crosshair Move for Data Box and Legend
        const handleCrosshairMove = (param) => {
            if (!param.time) {
                setOhlcData(null);
                setIndicatorValues({});
                return;
            }

            // Update OHLC Data
            const ohlc = param.seriesData.get(mainSeriesRef.current);
            if (ohlc) {
                const isUp = ohlc.close >= ohlc.open;
                const change = ohlc.close - ohlc.open;
                const changePercent = (change / ohlc.open) * 100;
                setOhlcData({ ...ohlc, isUp, change, changePercent });
            } else {
                // If checking last bar (sometimes seriesData is empty on very last pixel)
                // Fallback to last data point if relevant? No, just clear or leave last known?
                // TradingView usually keeps last known if off-chart but here we clear.
                // setOhlcData(null); 
            }

            // Update Indicator Values for Legend
            const newValues = {};
            if (indicatorSeriesMap.current) {
                indicatorSeriesMap.current.forEach((indSeries, id) => {
                    // Check if series is valid type (could be primitive or object for complex plugins)
                    if (indSeries.series) {
                        // Complex indicator (e.g. Bollinger Bands with multiple series)
                        // This part depends on how complex indicators are stored.
                        // For now assuming simple series or handling specifically.
                        // If it's an object with multiple series (like BB upper/lower), handling might be needed.
                        // But indicatorSeriesMap in this refactor might perform direct mapping.
                        // Let's assume direct mapping for standard indicators for now.
                        const val = param.seriesData.get(indSeries.series);
                        if (val !== undefined) newValues[id] = val;
                    } else {
                        // Standard series
                        const val = param.seriesData.get(indSeries);
                        if (val !== undefined) {
                            // Handle TPO or unique data types if necessary
                            if (typeof val === 'object' && val.value !== undefined) {
                                newValues[id] = val.value;
                            } else {
                                newValues[id] = val;
                            }
                        }
                    }
                });
            }
            setIndicatorValues(newValues);
        };

        // Subscribe to crosshair move
        chart.subscribeCrosshairMove(handleCrosshairMove);

        // Use Logical Range change for better performance/accuracy mapping to data indices
        chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleTimeRangeChange);

        // Handle right-click - show context menu or cancel tool
        const handleContextMenu = (event) => {
            // Check if click is in price scale area (rightmost ~70px)
            // If so, let the specific price scale handler (bubbling phase) logic handle it
            if (chartContainerRef.current) {
                const rect = chartContainerRef.current.getBoundingClientRect();
                const priceScaleWidth = 70;
                // Ignore Right Edge
                if (event.clientX >= rect.right - priceScaleWidth) {
                    return;
                }
                // Ignore Left Edge (if visible)
                const leftScale = chartRef.current?.priceScale('left');
                if (leftScale && leftScale.options().visible && event.clientX <= rect.left + priceScaleWidth) {
                    return;
                }
            }

            event.preventDefault(); // Prevent default right-click menu
            if (activeToolRef.current && activeToolRef.current !== 'cursor') {
                if (onToolUsed) onToolUsed();
                return;
            }

            // check for hovered order
            const hoveredOrderId = visualTradingRef.current ? visualTradingRef.current.getHoveredOrderId() : null;

            // Calculate price at click point
            let clickPrice = null;
            if (mainSeriesRef.current && chartContainerRef.current) {
                const rect = chartContainerRef.current.getBoundingClientRect();
                const relativeY = event.clientY - rect.top;
                try {
                    clickPrice = mainSeriesRef.current.coordinateToPrice(relativeY);
                } catch (e) {
                    logger.warn('Failed to convert coordinate to price', e);
                }
            }

            // Show custom context menu
            setContextMenu({ show: true, x: event.clientX, y: event.clientY, orderId: hoveredOrderId, price: clickPrice });
        };
        const container = chartContainerRef.current;
        container.addEventListener('contextmenu', handleContextMenu, true);

        return () => {
            // Clean up global window references to prevent memory leaks
            (window as any).lineToolManager = null;
            (window as any).chartInstance = null;
            (window as any).seriesInstance = null;

            // HIGH FIX ML-2: Unsubscribe crosshair move listener
            try {
                chart.unsubscribeCrosshairMove(handleCrosshairMove);
            } catch (e) {
                logger.warn('Failed to unsubscribe crosshair move', e);
            }

            try {
                chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleTimeRangeChange);
            } catch (e) {
                logger.warn('Failed to unsubscribe visible logical range change', e);
            }

            try {
                container.removeEventListener('contextmenu', handleContextMenu, true);
            } catch (error) {
                logger.warn('Failed to remove contextmenu listener', error);
            }


            // Mark chart as disposed FIRST to prevent any pending RAF callbacks
            isDisposedRef.current = true;

            // Destroy lineToolManager BEFORE chart.remove() to prevent "Object is disposed" errors
            // The line-tools plugin holds a reference to the chart and may try to call requestUpdate()
            if (lineToolManagerRef.current) {
                // HIGH FIX ML-3: Unsubscribe alert event listeners before destroying manager
                try {
                    if (alertSubscriptionsRef.current.alertsChanged) {
                        alertSubscriptionsRef.current.alertsChanged.unsubscribe(lineToolManagerRef.current);
                        alertSubscriptionsRef.current.alertsChanged = null;
                    }
                    if (alertSubscriptionsRef.current.alertTriggered) {
                        alertSubscriptionsRef.current.alertTriggered.unsubscribe(lineToolManagerRef.current);
                        alertSubscriptionsRef.current.alertTriggered = null;
                    }
                    if (alertSubscriptionsRef.current.priceScaleClicked) {
                        alertSubscriptionsRef.current.priceScaleClicked.unsubscribe(lineToolManagerRef.current);
                        alertSubscriptionsRef.current.priceScaleClicked = null;
                    }
                } catch (error) {
                    logger.warn('Failed to unsubscribe alert listeners', error);
                }

                try {
                    lineToolManagerRef.current.destroy();
                } catch (error) {
                    logger.warn('Failed to destroy lineToolManager', error);
                }
                lineToolManagerRef.current = null;
            }

            // Detach primitives before removing chart to prevent memory leaks
            if (mainSeriesRef.current) {
                try {
                    if (visualTradingRef.current) {
                        mainSeriesRef.current.detachPrimitive(visualTradingRef.current);
                        visualTradingRef.current = null;
                    }
                    if (seriesMarkersRef.current) {
                        mainSeriesRef.current.detachPrimitive(seriesMarkersRef.current);
                        seriesMarkersRef.current = null;
                    }
                } catch (error) {
                    logger.warn('Failed to detach primitives', error);
                }
            }

            try {
                if (wsRef.current) wsRef.current.close();
            } catch (error) {
                logger.warn('Failed to close chart WebSocket', error);
            }
            try {
                chart.remove();
            } catch (error) {
                logger.warn('Failed to remove chart instance', error);
            } finally {
                chartRef.current = null;
            }
        };
    }, []); // Only create chart once

    // Re-create main series when chart type changes
    useEffect(() => {
        if (!chartRef.current) {
            return;
        }

        const chart = chartRef.current;

        const replacementSeries = createSeries(chart, chartType, chartAppearance);
        mainSeriesRef.current = replacementSeries;
        seriesMarkersRef.current = null; // Reset markers primitive for new series
        initializeLineTools(replacementSeries);
        initializeVisualTrading(replacementSeries);

        // Re-attach timer to the new series when chart type changes
        if (priceScaleTimerRef.current) {
            try {
                replacementSeries.attachPrimitive(priceScaleTimerRef.current);
                // Enforce visibility rule immediately
                if (isTimerVisible) {
                    replacementSeries.applyOptions({ lastValueVisible: false });
                }
            } catch (e) {
                logger.warn('Error re-attaching timer to new series:', e);
            }
        }

        const existingData = transformData(dataRef.current, chartType);
        if (existingData.length) {
            replacementSeries.setData(existingData);
            updateIndicators(dataRef.current, indicators);
            applyDefaultCandlePosition(existingData.length);
            updateAxisLabel();

            // Re-apply active tool to the new manager
            if (activeTool && activeTool !== 'cursor') {
                const mappedTool = TOOL_MAP[activeTool] || 'None';
                if (lineToolManagerRef.current && typeof lineToolManagerRef.current.startTool === 'function') {
                    lineToolManagerRef.current.startTool(mappedTool);

                }
            }
        }

        // Recreate faded series if in replay mode
        if (isReplayMode && fadedSeriesRef.current) {
            try {
                chart.removeSeries(fadedSeriesRef.current);
            } catch (e) {
                logger.warn('Error removing faded series on chart type change:', e);
            }
            fadedSeriesRef.current = null;

            // Trigger replay data update to recreate faded series with new type
            if (replayIndex !== null) {
                updateReplayData(replayIndex);
            }
        }

        // Capture current symbol for cleanup to use (refs will have new values when cleanup runs)
        const capturedSymbol = symbol;
        const capturedExchange = exchange;

        return () => {
            if (lineToolManagerRef.current) {
                // === Alert Persistence: Save alerts BEFORE destruction ===
                try {
                    const userAlerts = lineToolManagerRef.current._userPriceAlerts;
                    if (userAlerts && typeof userAlerts.exportAlerts === 'function') {
                        // Use captured symbol (what it was when effect started), not symbolRef (which is now new)
                        if (capturedSymbol) {
                            const alertsToSave = userAlerts.exportAlerts();
                            logger.debug('[Alerts] Exporting alerts for', capturedSymbol, ':', alertsToSave);
                            if (alertsToSave.length > 0) {
                                saveAlertsForSymbol(capturedSymbol, capturedExchange, alertsToSave);
                                logger.debug('[Alerts] Saved', alertsToSave.length, 'alerts for', capturedSymbol, 'before cleanup');
                            }
                        }
                    }
                } catch (err) {
                    logger.warn('[Alerts] Failed to save alerts in cleanup:', err);
                }

                // HIGH FIX ML-3: Unsubscribe alert event listeners before clearing manager
                try {
                    if (alertSubscriptionsRef.current.alertsChanged) {
                        alertSubscriptionsRef.current.alertsChanged.unsubscribe(lineToolManagerRef.current);
                        alertSubscriptionsRef.current.alertsChanged = null;
                    }
                    if (alertSubscriptionsRef.current.alertTriggered) {
                        alertSubscriptionsRef.current.alertTriggered.unsubscribe(lineToolManagerRef.current);
                        alertSubscriptionsRef.current.alertTriggered = null;
                    }
                    if (alertSubscriptionsRef.current.priceScaleClicked) {
                        alertSubscriptionsRef.current.priceScaleClicked.unsubscribe(lineToolManagerRef.current);
                        alertSubscriptionsRef.current.priceScaleClicked = null;
                    }
                } catch (err) {
                    logger.warn('Failed to unsubscribe alert listeners before chart type switch', err);
                }

                try {
                    lineToolManagerRef.current.clearTools();
                } catch (err) {
                    logger.warn('Failed to clear tools before switching chart type', err);
                }
                try {
                    if (mainSeriesRef.current) {
                        mainSeriesRef.current.detachPrimitive(lineToolManagerRef.current);
                    }
                } catch (err) {
                    logger.warn('Failed to detach line tools from series', err);
                }
                lineToolManagerRef.current = null;
            }



            if (mainSeriesRef.current) {
                try {
                    chart.removeSeries(mainSeriesRef.current);
                } catch (e) {
                    // Ignore 'Value is undefined' which happens during strict mode cleanup
                    if (e.message !== 'Value is undefined') {
                        logger.warn('Error removing series:', e);
                    }
                }
                mainSeriesRef.current = null;
                seriesMarkersRef.current = null; // Clear markers primitive
            }

            // Cleanup PriceScaleTimer
            if (priceScaleTimerRef.current) {
                // If the timer has a destroy or detach method, call it here
                // Assumed primitive cleanup handled by series removal, but clearing ref is crucial
                priceScaleTimerRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chartType, symbol, exchange, strategyConfig?.displayName]);

    // Load data when symbol/interval changes
    useEffect(() => {
        if (!chartRef.current) return;

        let cancelled = false;
        let indicatorFrame = null;
        const abortController = new AbortController();

        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        // Close all strategy WebSocket connections
        Object.values(strategyWsRefs.current).forEach((ws: any) => {
            if (ws?.close) ws.close();
        });
        strategyWsRefs.current = {};

        // Update previous symbol ref for next change (Alert save is now in chartType cleanup)
        prevSymbolRef.current = { symbol, exchange };

        // Reset scroll-back loading refs when symbol/interval changes
        isLoadingOlderDataRef.current = false;
        hasMoreHistoricalDataRef.current = true;
        oldestLoadedTimeRef.current = null;
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }

        const loadData = async () => {
            isActuallyLoadingRef.current = true;
            chartReadyRef.current = false; // Reset chart ready state when loading new data
            setIsLoading(true);

            try {
                let data;

                // Check if we're in strategy mode (multi-leg)
                if (strategyConfig && strategyConfig.legs?.length >= 2) {
                    // Fetch all leg data in parallel
                    const strategyExchange = strategyConfig.exchange || 'NFO';
                    const legDataPromises = strategyConfig.legs.map(leg =>
                        getKlines(leg.symbol, strategyExchange, interval, 1000, abortController.signal)
                    );
                    const legDataArrays = await Promise.all(legDataPromises);

                    if (cancelled) return;

                    // Store raw data for real-time updates (keyed by leg id)
                    strategyDataRef.current = {};
                    strategyConfig.legs.forEach((leg, i) => {
                        strategyDataRef.current[leg.id] = legDataArrays[i];
                    });

                    // Combine into single premium data using direction-aware calculation
                    data = combineMultiLegOHLC(legDataArrays, strategyConfig.legs);
                    logger.debug('[Strategy] Combined data length:', data.length, 'from', strategyConfig.legs.length, 'legs');
                } else {
                    // Regular symbol mode
                    data = await getKlines(symbol, exchange, interval, 1000, abortController.signal);
                }
                if (cancelled) return;

                if (Array.isArray(data) && data.length > 0 && mainSeriesRef.current) {
                    setError(null); // Clear any previous errors
                    dataRef.current = data;

                    // Share OHLC data with GlobalAlertMonitor
                    if (onOHLCDataUpdateRef.current && symbol && interval) {
                        onOHLCDataUpdateRef.current(symbol, exchange, interval, data);
                    }

                    // Track the oldest loaded timestamp for scroll-back loading
                    oldestLoadedTimeRef.current = data[0].time;

                    const activeType = chartTypeRef.current;
                    const transformedData = transformData(data, activeType);

                    // Add whitespace points for future time display (TradingView-style)
                    const intervalSeconds = intervalToSeconds(interval);
                    const dataWithFuture = addFutureWhitespacePoints(transformedData, intervalSeconds);
                    mainSeriesRef.current.setData(dataWithFuture);

                    // Mark chart as ready immediately after data is set
                    // This allows indicators to be added without delay
                    chartReadyRef.current = true;

                    // Initialize the candle countdown timer
                    if (!priceScaleTimerRef.current && mainSeriesRef.current && Number.isFinite(intervalSeconds) && intervalSeconds > 0) {
                        initializePriceScaleTimer(mainSeriesRef.current, intervalSeconds);
                    } else if (priceScaleTimerRef.current && Number.isFinite(intervalSeconds) && intervalSeconds > 0) {
                        // Update timer timeframe if interval changed
                        priceScaleTimerRef.current.applyOptions({ timeframeSeconds: intervalSeconds });
                    }

                    if (indicatorFrame) cancelAnimationFrame(indicatorFrame);
                    indicatorFrame = requestAnimationFrame(() => {
                        if (!cancelled) {
                            updateIndicators(data, indicators);
                        }
                    });

                    // Apply fixed candle window for consistent zoom across all timeframes
                    applyDefaultCandlePosition(transformedData.length, DEFAULT_CANDLE_WINDOW);

                    setTimeout(() => {
                        if (!cancelled && mountedRef.current) {
                            isActuallyLoadingRef.current = false;
                            setIsLoading(false);
                            updateAxisLabel();
                        }
                    }, 50);

                    // Set up WebSocket subscriptions based on mode
                    if (strategyConfig && strategyConfig.legs?.length >= 2) {
                        // Strategy mode: subscribe to all legs
                        const strategyExchange = strategyConfig.exchange || 'NFO';

                        // Handler for multi-leg real-time updates
                        // LOW FIX ML-13: Use refs to avoid capturing large objects in closure
                        const handleStrategyTick = (legConfig) => (ticker) => {
                            if (cancelled || !ticker) return;

                            const closePrice = Number(ticker.close);
                            if (!Number.isFinite(closePrice) || closePrice <= 0) return;

                            // Update the latest tick for this leg
                            strategyLatestRef.current[legConfig.id] = closePrice;

                            // Use ref to avoid closure capture
                            const currentStrategyConfig = strategyConfigRef.current;
                            if (!currentStrategyConfig?.legs) return;

                            // Only update chart if all legs have ticks
                            const allLegsHaveTicks = currentStrategyConfig.legs.every(
                                leg => strategyLatestRef.current[leg.id] != null
                            );
                            if (!allLegsHaveTicks) return;

                            // Calculate combined price with direction multiplier
                            const combinedClose = currentStrategyConfig.legs.reduce((sum, leg) => {
                                const price = strategyLatestRef.current[leg.id];
                                const multiplier = leg.direction === 'buy' ? 1 : -1;
                                const qty = leg.quantity || 1;
                                return sum + (multiplier * qty * price);
                            }, 0);

                            const currentData = dataRef.current;
                            if (!currentData || currentData.length === 0) return;

                            // Use ref to avoid closure capture
                            const currentInterval = intervalRef.current;
                            const intervalSeconds = intervalToSeconds(currentInterval);
                            if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) return;

                            const lastIndex = currentData.length - 1;
                            const lastCandleTime = currentData[lastIndex].time;

                            if (shouldResync()) syncTimeWithAPI();
                            const currentISTTime = getAccurateISTTimestamp();
                            const currentCandleTime = Math.floor(currentISTTime / intervalSeconds) * intervalSeconds;

                            // Robust time comparison using helper
                            const lastTimeVal = getTimeValue(lastCandleTime);
                            const needNewCandle = currentCandleTime > lastTimeVal;

                            let candle;
                            if (needNewCandle) {
                                candle = {
                                    time: currentCandleTime,
                                    open: combinedClose,
                                    high: combinedClose,
                                    low: combinedClose,
                                    close: combinedClose,
                                    volume: 0,
                                };
                                currentData.push(candle);
                            } else {
                                const existingCandle = currentData[lastIndex];
                                candle = {
                                    time: lastCandleTime,
                                    open: existingCandle.open,
                                    high: Math.max(existingCandle.high, combinedClose),
                                    low: Math.min(existingCandle.low, combinedClose),
                                    close: combinedClose,
                                    volume: existingCandle.volume || 0,
                                };
                                currentData[lastIndex] = candle;
                            }

                            dataRef.current = currentData;

                            // Share updated OHLC data with GlobalAlertMonitor
                            if (onOHLCDataUpdateRef.current && symbol && interval && currentData.length > 0) {
                                onOHLCDataUpdateRef.current(symbol, exchange, interval, currentData);
                            }

                            const currentChartType = chartTypeRef.current;
                            const transformedCandle = transformData([candle], currentChartType)[0];

                            if (mainSeriesRef.current && !isReplayModeRef.current) {
                                // Use setData() approach same as regular symbol mode to avoid
                                // lightweight-charts time ordering issues with update()
                                try {
                                    const transformedFullData = transformData(currentData, currentChartType);
                                    const dataWithFuture = addFutureWhitespacePoints(transformedFullData, intervalSeconds);
                                    mainSeriesRef.current.setData(dataWithFuture);
                                } catch (setDataErr) {
                                    console.warn('[Strategy WebSocket] Failed to update chart with setData:', setDataErr);
                                }

                                updateRealtimeIndicators(currentData);
                                updateAxisLabel();
                                updateOhlcFromLatest();
                                if (priceScaleTimerRef.current) {
                                    priceScaleTimerRef.current.updateCandleData(candle.open, candle.close);
                                }
                            }
                        };

                        // Subscribe to all legs
                        strategyConfig.legs.forEach(leg => {
                            strategyWsRefs.current[leg.id] = subscribeToTicker(
                                leg.symbol,
                                strategyExchange,
                                interval,
                                handleStrategyTick(leg)
                            );
                        });
                    } else {
                        // Regular symbol mode
                        // LOW FIX ML-13: Use refs to avoid capturing large objects in closure
                        wsRef.current = subscribeToTicker(symbol, exchange, interval, (ticker) => {
                            if (cancelled || !ticker) return;

                            // Extract price and volume from real-time tick data
                            const closePrice = Number(ticker.close);
                            const tickVolume = Number(ticker.volume) || 0;
                            if (!Number.isFinite(closePrice) || closePrice <= 0) {
                                logger.warn('Received invalid close price:', ticker);
                                return;
                            }

                            const currentData = dataRef.current;
                            if (!currentData || currentData.length === 0) return;

                            // Use ref to avoid closure capture
                            const currentInterval = intervalRef.current;
                            const intervalSeconds = intervalToSeconds(currentInterval);
                            if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) return;

                            const lastIndex = currentData.length - 1;
                            const lastCandleTime = currentData[lastIndex].time;

                            // Use accurate IST time from WorldTimeAPI for candle creation
                            // Resync if needed (every 5 minutes)
                            if (shouldResync()) {
                                syncTimeWithAPI();
                            }
                            const currentISTTime = getAccurateISTTimestamp();
                            const currentCandleTime = Math.floor(currentISTTime / intervalSeconds) * intervalSeconds;

                            // Check if we need a new candle (current time is in a new interval period)
                            const needNewCandle = currentCandleTime > lastCandleTime;

                            let candle;
                            if (needNewCandle) {
                                // Create a new candle - all OHLC start at current price
                                // Calculate per-candle volume from cumulative day volume
                                const perCandleVolume = cumulativeVolumeRef.current === 0
                                    ? tickVolume  // First tick: use as-is
                                    : Math.max(0, tickVolume - cumulativeVolumeRef.current);  // Subsequent: calculate difference

                                // Update baseline for next candle
                                cumulativeVolumeRef.current = tickVolume;

                                candle = {
                                    time: currentCandleTime,
                                    open: closePrice,
                                    high: closePrice,
                                    low: closePrice,
                                    close: closePrice,
                                    volume: perCandleVolume,
                                };
                                currentData.push(candle);
                                logger.debug('[WebSocket] Created new candle at time:', currentCandleTime, 'price:', closePrice, 'volume:', perCandleVolume, '(cumulative:', tickVolume + ')');
                            } else {
                                // Update the last candle using ONLY the close price for high/low
                                // WebSocket high/low are session-wide, not per-interval
                                const existingCandle = currentData[lastIndex];

                                // Initialize baseline on first tick for this candle
                                if (cumulativeVolumeRef.current === 0) {
                                    // Estimate baseline: current cumulative - existing candle volume
                                    cumulativeVolumeRef.current = Math.max(0, tickVolume - (existingCandle.volume || 0));
                                }

                                // Calculate per-candle volume
                                const perCandleVolume = Math.max(0, tickVolume - cumulativeVolumeRef.current);

                                candle = {
                                    time: lastCandleTime,
                                    open: existingCandle.open,
                                    high: Math.max(existingCandle.high, closePrice),
                                    low: Math.min(existingCandle.low, closePrice),
                                    close: closePrice,
                                    volume: perCandleVolume,
                                };
                                currentData[lastIndex] = candle;
                            }

                            dataRef.current = currentData;

                            // Share updated OHLC data with GlobalAlertMonitor
                            if (onOHLCDataUpdateRef.current && symbol && interval && currentData.length > 0) {
                                onOHLCDataUpdateRef.current(symbol, exchange, interval, currentData);
                            }

                            const currentChartType = chartTypeRef.current;
                            const transformedCandle = transformData([candle], currentChartType)[0];

                            if (transformedCandle && mainSeriesRef.current && !isReplayModeRef.current) {
                                // PERFORMANCE NOTE: Using setData() instead of update() for real-time WebSocket updates.
                                // This regenerates 120 whitespace points on every tick, which is less efficient.
                                // However, this is NECESSARY because update() cannot insert data before existing
                                // whitespace points (future time labels). If future optimization is needed,
                                // consider removing whitespace points feature or finding alternative approach.
                                // Impact: ~1-2 ticks/second in practice, so this should be negligible.
                                // To switch back to update(): remove whitespace points and use mainSeriesRef.current.update(transformedCandle);
                                try {
                                    const currentChartTypeForSet = chartTypeRef.current;
                                    const transformedFullData = transformData(currentData, currentChartTypeForSet);
                                    const dataWithFuture = addFutureWhitespacePoints(transformedFullData, intervalSeconds);
                                    mainSeriesRef.current.setData(dataWithFuture);
                                } catch (setDataErr) {
                                    logger.warn('[WebSocket] Failed to update chart with setData:', setDataErr);
                                }

                                updateRealtimeIndicators(currentData);
                                updateAxisLabel();
                                updateOhlcFromLatest();

                                if (priceScaleTimerRef.current) {
                                    priceScaleTimerRef.current.updateCandleData(candle.open, candle.close);
                                }
                            }
                        });
                    }
                } else {
                    dataRef.current = [];
                    mainSeriesRef.current?.setData([]);
                    isActuallyLoadingRef.current = false;
                    setIsLoading(false);
                }
            } catch (error) {
                if (error.name === 'AbortError') {
                    return;
                }
                logger.error('Error loading chart data:', error);

                // Set user-friendly error message
                let errorMessage = 'Failed to load chart data';
                if (error.message && error.message.includes('Symbol')) {
                    errorMessage = error.message;
                } else if (error.status === 400 || error.status === 404) {
                    errorMessage = `Symbol '${symbol}' not found`;
                }

                // If the error object has a JSON body with a message (from chartDataService logs), use it
                // Note: The fetch service might reject with an Error object that has the text

                setError(errorMessage);

                if (!cancelled) {
                    isActuallyLoadingRef.current = false;
                    setIsLoading(false);
                }
            }
        };

        // Only load data if authenticated
        if (isAuthenticated === true) {
            emaLastValueRef.current = null;
            loadData();
        } else {
            // Not authenticated - set loading false and show empty chart
            setIsLoading(false);
            isActuallyLoadingRef.current = false;
        }

        return () => {
            cancelled = true;
            if (indicatorFrame) {
                cancelAnimationFrame(indicatorFrame);
            }
            abortController.abort();
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            // Clean up strategy WebSocket connections (N-leg support)
            Object.values(strategyWsRefs.current).forEach((ws: any) => {
                if (ws) ws.close();
            });
            strategyWsRefs.current = {};
            // Reset strategy state
            strategyLatestRef.current = {};
            strategyDataRef.current = {};
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbol, exchange, interval, strategyConfig, isAuthenticated]);

    const emaLastValueRef = useRef(null);

    const updateRealtimeIndicators = useCallback((data) => {
        if (!chartRef.current || !data || data.length === 0) return;

        const lastIndex = data.length - 1;
        const lastDataPoint = data[lastIndex];
        const currentIndicators = indicatorsRef.current || []; // Use array

        // If generic indicators array, iterate map
        // We iterate the MAP keys to update existing series
        // But we need config. So we iterate valid indicators.

        if (Array.isArray(currentIndicators)) {
            currentIndicators.forEach(ind => {
                if (!ind.visible || !indicatorSeriesMap.current.has(ind.id)) return;

                const series = indicatorSeriesMap.current.get(ind.id);
                if (!series) return;

                // Calculate based on type
                // Note: Ideally we should not calculate full array on every tick for large datasets
                // But for simplicity we mirror existing logic (calculate full or partial)

                switch (ind.type) {
                    case 'sma': {
                        const period = ind.period || 20;
                        // Optimization: only calc last point if possible? 
                        // Existing logic calculated full if < period, else update.
                        // But calculateSMA returns full array. 
                        // To be efficient, we need to know the previous value or calculate full.
                        // For now, let's just calculate full. It's fast enough for < 5000 points.
                        // Optimizing: 
                        // If data length is huge, we should optimize.
                        // But existing logic did: if data.length < period ... else update.
                        // To update SMA properly we need full history or streaming calc.
                        // calculateSMA provides streaming? No.
                        // Let's stick to full calc for robustness or simple last point optimization if feasible.

                        // Simple approach: Calculate full dataset for the *last few bars*? 
                        // No, SMA needs history.
                        // Let's rely on standard calculation.
                        const val = calculateSMA(data, period);
                        if (val && val.length > 0) {
                            series.setData(val);
                        }
                        break;
                    }
                    case 'ema': {
                        const period = ind.period || 20;
                        const val = calculateEMA(data, period);
                        if (val && val.length > 0) series.setData(val);
                        break;
                    }
                    case 'rsi': {
                        const period = ind.period || 14;
                        const val = calculateRSI(data, period);
                        if (val && val.length > 0) series.setData(val);
                        break;
                    }
                    case 'macd': {
                        const { fast = 12, slow = 26, signal = 9 } = ind;
                        const val = calculateMACD(data, fast, slow, signal) as any;
                        if (val && series.macd && series.signal && series.histogram) {
                            if (val.macd) series.macd.setData(val.macd);
                            if (val.signal) series.signal.setData(val.signal);
                            if (val.histogram) series.histogram.setData(val.histogram);
                        }
                        break;
                    }
                    case 'bollingerBands': {
                        const { period = 20, stdDev = 2 } = ind;
                        const val = calculateBollingerBands(data, period, stdDev);
                        if (val && series.upper && series.middle && series.lower) {
                            if (val.upper) series.upper.setData(val.upper);
                            if (val.middle) series.middle.setData(val.middle);
                            if (val.lower) series.lower.setData(val.lower);
                        }
                        break;
                    }
                    case 'stochastic': {
                        const { kPeriod = 14, dPeriod = 3 } = ind;
                        const val = calculateStochastic(data, kPeriod, dPeriod) as any;
                        if (val && series.k && series.d) {
                            if (val.k) series.k.setData(val.k);
                            if (val.d) series.d.setData(val.d);
                        }
                        break;
                    }
                    case 'atr': {
                        const period = ind.period || 14;
                        const val = calculateATR(data, period);
                        if (val && val.length > 0) series.setData(val);
                        break;
                    }
                    case 'volume': {
                        // TradingView-style volume (close vs previous close)
                        const volumeData = calculateVolume(
                            data,
                            ind.colorUp || '#26A69A',
                            ind.colorDown || '#EF5350'
                        );
                        if (volumeData && volumeData.length > 0 && series.bars) {
                            series.bars.setData(volumeData);
                        }
                        break;
                    }
                    case 'vwap': {
                        const val = calculateVWAP(data, { resetDaily: ind.resetDaily !== false });
                        if (val && val.length > 0) series.setData(val);
                        break;
                    }
                    case 'supertrend': {
                        const { period = 10, multiplier = 3, upColor, downColor } = ind;
                        const val = calculateSupertrend(data, period, multiplier);
                        const colored = val.map(d => ({ ...d, color: d.trend === 1 ? (upColor || '#089981') : (downColor || '#F23645') }));
                        if (colored && colored.length > 0) series.setData(colored);
                        break;
                    }
                    // TPO, PAR?
                    // They usually don't tick update in the same simple way or are handled by updateIndicators re-run.
                    // But strictly speaking they should update.
                    // TPO is a primitive attached to main series usually.
                    // We can refresh TPO.
                    case 'tpo': {
                        // TPO is likely ref-based to a single primitive or map based.
                        // But TPO calculation is heavy. Maybe skip on tick?
                        // For now skip TPO on every tick or handle if efficient.
                        break;
                    }
                    case 'annStrategy': {
                        // ANN Strategy real-time update
                        const result = calculateANNStrategy(data, {
                            threshold: ind.threshold || 0.0014,
                            longColor: ind.longColor || '#26A69A',
                            shortColor: ind.shortColor || '#EF5350',
                            showSignals: ind.showSignals !== false,
                            showBackground: ind.showBackground !== false
                        });

                        if (result.predictions && result.predictions.length > 0 && series.prediction) {
                            series.prediction.setData(result.predictions);
                        }

                        // Update background area series on main chart
                        if ((series.bgLong || series.bgShort) && result.signals && result.signals.length > 0 && ind.showBackground !== false) {
                            const priceMax = Math.max(...data.map(d => d.high));
                            const priceMin = Math.min(...data.map(d => d.low));
                            const padding = (priceMax - priceMin) * 0.1;
                            const bgTop = priceMax + padding;
                            const bgBottom = priceMin - padding;

                            const longBgData = result.signals.map(sig => ({
                                time: sig.time,
                                value: sig.buying === true ? bgTop : bgBottom
                            }));
                            const shortBgData = result.signals.map(sig => ({
                                time: sig.time,
                                value: sig.buying === false ? bgTop : bgBottom
                            }));

                            if (series.bgLong) series.bgLong.setData(longBgData);
                            if (series.bgShort) series.bgShort.setData(shortBgData);
                        }

                        // Note: Markers are handled collectively in updateIndicators to avoid overwriting
                        // other indicators' markers. Real-time updates only refresh prediction and background.
                        break;
                    }
                    case 'hilengaMilenga': {
                        // Hilenga-Milenga real-time update
                        const hmResult = calculateHilengaMilenga(
                            data,
                            ind.rsiLength || 9,
                            ind.emaLength || 3,
                            ind.wmaLength || 21
                        );

                        if (hmResult.rsiLine && hmResult.rsiLine.length > 0) {
                            if (series.rsi) series.rsi.setData(hmResult.rsiLine);
                            if (series.baseline) series.baseline.setData(hmResult.rsiLine);
                        }
                        if (hmResult.emaLine && hmResult.emaLine.length > 0 && series.ema) {
                            series.ema.setData(hmResult.emaLine);
                        }
                        if (hmResult.wmaLine && hmResult.wmaLine.length > 0 && series.wma) {
                            series.wma.setData(hmResult.wmaLine);
                        }
                        break;
                    }
                }
            });
        }
    }, []);

    // Callback for when user drags risk calculator price lines
    const handleRiskCalculatorDrag = useCallback((lineType, newPrice) => {
        const riskCalcInd = indicators.find(i => i.type === 'riskCalculator');
        if (!riskCalcInd) return;

        // ALWAYS preserve the current targetPrice to prevent recalculation
        const updates: any = {
            targetPrice: riskCalcInd.targetPrice || null
        };

        if (lineType === 'entry') {
            updates.entryPrice = newPrice;
        } else if (lineType === 'stopLoss') {
            updates.stopLossPrice = newPrice;
        } else if (lineType === 'target') {
            updates.targetPrice = newPrice;
        }

        // This triggers re-calculation through onIndicatorSettings
        if (onIndicatorSettings) {
            onIndicatorSettings(riskCalcInd.id, updates);
        }
    }, [indicators, onIndicatorSettings]);

    const updateIndicators = useCallback((data, indicatorsArray) => {
        logger.debug('[DEBUG] updateIndicators CALLED');
        logger.debug('[DEBUG] Indicators param:', indicatorsArray?.length, 'indicators');
        logger.debug('[DEBUG] Indicator IDs param:', indicatorsArray?.map(i => i.id));

        if (!chartRef.current) return;

        const canAddSeries = chartReadyRef.current;
        const validIds = new Set();

        // Collect all markers from all indicators to set them together at the end
        const allMarkers = [];

        if (Array.isArray(indicatorsArray)) {
            indicatorsArray.forEach(ind => {
                const { id, type, visible } = ind;
                if (!id) return;
                validIds.add(id);

                const isVisible = visible !== false;

                let series = indicatorSeriesMap.current.get(id);
                let pane = indicatorPanesMap.current.get(id);

                // --- CREATION LOGIC ---
                if (!series && canAddSeries) {
                    try {
                        const result = createIndicatorSeries(chartRef.current, ind, isVisible);
                        if (result) {
                            series = result.series;
                            if (result.pane) {
                                pane = result.pane;
                                indicatorPanesMap.current.set(id, pane);
                                // Special case for ANN Strategy pane ref
                                if (type === 'annStrategy') {
                                    annStrategyPaneRef.current = pane;
                                }
                            }
                        }

                        if (series) {
                            indicatorSeriesMap.current.set(id, series);
                            indicatorTypesMap.current.set(id, type); // Track type for cleanup
                        }
                    } catch (e) {
                        logger.error(`Error creating series for ${type} (${id})`, e);
                    }
                }

                // --- UPDATE LOGIC ---
                if (series) {
                    const markers = updateIndicatorSeries(series, ind, data, isVisible);
                    if (markers && markers.length > 0) {
                        allMarkers.push(...markers);
                    }
                }

            });
        }

        logger.debug('[DEBUG] validIds constructed with', validIds.size, 'IDs:', Array.from(validIds));

        // ========== FIRST RED CANDLE INDICATOR (5-min only) ==========
        const firstCandleInd = indicatorsArray?.find(ind => ind.type === 'firstCandle');
        const is5MinChart = intervalRef.current === '5' || intervalRef.current === '5m';
        const firstCandleEnabled = firstCandleInd?.visible !== false && is5MinChart;

        if (firstCandleEnabled && firstCandleInd && data && data.length > 0) {
            const highLineColor = firstCandleInd.highLineColor || '#ef5350';
            const lowLineColor = firstCandleInd.lowLineColor || '#26a69a';

            const result = calculateFirstCandle(data, {
                highlightColor: firstCandleInd.highlightColor || '#FFD700',
                highLineColor: highLineColor,
                lowLineColor: lowLineColor
            });

            // Remove old line series if count changed
            const existingCount = firstCandleSeriesRef.current.length;
            const neededCount = (result.allLevels?.length || 0) * 2;

            if (existingCount !== neededCount) {
                for (const series of firstCandleSeriesRef.current) {
                    try { chartRef.current.removeSeries(series); } catch (e) { /* ignore */ }
                }
                firstCandleSeriesRef.current = [];
            }

            // Create/update line series for each day's high and low
            if (result.allLevels && result.allLevels.length > 0 && chartRef.current) {
                let seriesIndex = 0;
                for (const level of result.allLevels) {
                    const { high, low, startTime, endTime } = level;

                    // High line
                    if (!firstCandleSeriesRef.current[seriesIndex]) {
                        firstCandleSeriesRef.current[seriesIndex] = chartRef.current.addSeries(LineSeries, {
                            color: highLineColor, lineWidth: 2, lineStyle: 2,
                            priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
                        });
                    }
                    firstCandleSeriesRef.current[seriesIndex].setData([
                        { time: startTime, value: high },
                        { time: endTime, value: high }
                    ]);
                    seriesIndex++;

                    // Low line
                    if (!firstCandleSeriesRef.current[seriesIndex]) {
                        firstCandleSeriesRef.current[seriesIndex] = chartRef.current.addSeries(LineSeries, {
                            color: lowLineColor, lineWidth: 2, lineStyle: 2,
                            priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
                        });
                    }
                    firstCandleSeriesRef.current[seriesIndex].setData([
                        { time: startTime, value: low },
                        { time: endTime, value: low }
                    ]);
                    seriesIndex++;
                }
            }

            // Add First Candle markers to allMarkers for display on main chart
            if (result.allMarkers && result.allMarkers.length > 0) {
                allMarkers.push(...result.allMarkers);
            }

            // Track type for cleanup (array-based indicator)
            if (firstCandleInd?.id) {
                indicatorTypesMap.current.set(firstCandleInd.id, 'firstCandle');
            }
        } else if (!firstCandleEnabled) {
            // Remove first candle series when disabled
            logger.debug('[MANUAL CLEANUP] First Candle manual cleanup triggered. Series count:', firstCandleSeriesRef.current.length);
            for (const series of firstCandleSeriesRef.current) {
                try {
                    logger.debug('[MANUAL CLEANUP] Removing First Candle series');
                    chartRef.current.removeSeries(series);
                } catch (e) { /* ignore */ }
            }
            firstCandleSeriesRef.current = [];
            logger.debug('[MANUAL CLEANUP] First Candle array cleared');
        }

        // ========== RANGE BREAKOUT INDICATOR ==========
        const rangeBreakoutInd = indicatorsArray?.find(ind => ind.type === 'rangeBreakout');
        const rangeBreakoutEnabled = rangeBreakoutInd?.visible !== false;

        if (rangeBreakoutEnabled && rangeBreakoutInd && data && data.length > 0) {
            const highColor = rangeBreakoutInd.highColor || '#089981';
            const lowColor = rangeBreakoutInd.lowColor || '#F23645';
            const lineWidth = rangeBreakoutInd.lineWidth || 2;

            const result = calculateRangeBreakout(data, {
                rangeStartHour: rangeBreakoutInd.rangeStartHour || 9,
                rangeStartMinute: rangeBreakoutInd.rangeStartMinute || 30,
                rangeEndHour: rangeBreakoutInd.rangeEndHour || 10,
                rangeEndMinute: rangeBreakoutInd.rangeEndMinute || 0,
                showSignals: rangeBreakoutInd.showSignals !== false,
                highColor,
                lowColor
            });

            // Remove old line series if count changed
            const existingCount = rangeBreakoutSeriesRef.current.length;
            const neededCount = (result.allLevels?.length || 0) * 2;

            if (existingCount !== neededCount) {
                for (const series of rangeBreakoutSeriesRef.current) {
                    try { chartRef.current.removeSeries(series); } catch (e) { /* ignore */ }
                }
                rangeBreakoutSeriesRef.current = [];
            }

            // Create/update line series for each day's high and low
            if (result.allLevels && result.allLevels.length > 0 && chartRef.current) {
                let seriesIndex = 0;
                for (const level of result.allLevels) {
                    const { high, low, startTime, endTime } = level;

                    // High line (green - breakout level)
                    if (!rangeBreakoutSeriesRef.current[seriesIndex]) {
                        rangeBreakoutSeriesRef.current[seriesIndex] = chartRef.current.addSeries(LineSeries, {
                            color: highColor, lineWidth: lineWidth, lineStyle: 2, // dashed
                            priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
                        });
                    }
                    rangeBreakoutSeriesRef.current[seriesIndex].setData([
                        { time: startTime, value: high },
                        { time: endTime, value: high }
                    ]);
                    seriesIndex++;

                    // Low line (red - breakdown level)
                    if (!rangeBreakoutSeriesRef.current[seriesIndex]) {
                        rangeBreakoutSeriesRef.current[seriesIndex] = chartRef.current.addSeries(LineSeries, {
                            color: lowColor, lineWidth: lineWidth, lineStyle: 2, // dashed
                            priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
                        });
                    }
                    rangeBreakoutSeriesRef.current[seriesIndex].setData([
                        { time: startTime, value: low },
                        { time: endTime, value: low }
                    ]);
                    seriesIndex++;
                }
            }

            // Collect markers for breakout/breakdown signals (will be set together with all other indicator markers)
            if (result.markers && result.markers.length > 0) {
                allMarkers.push(...result.markers);
            }

            // Track type for cleanup (array-based indicator)
            if (rangeBreakoutInd?.id) {
                indicatorTypesMap.current.set(rangeBreakoutInd.id, 'rangeBreakout');
            }
        } else if (!rangeBreakoutEnabled) {
            // Remove range breakout series when disabled
            logger.debug('[MANUAL CLEANUP] Range Breakout manual cleanup triggered. Series count:', rangeBreakoutSeriesRef.current.length);
            for (const series of rangeBreakoutSeriesRef.current) {
                try {
                    logger.debug('[MANUAL CLEANUP] Removing Range Breakout series');
                    chartRef.current.removeSeries(series);
                } catch (e) { /* ignore */ }
            }
            rangeBreakoutSeriesRef.current = [];
            logger.debug('[MANUAL CLEANUP] Range Breakout array cleared');
            // Note: markers are handled collectively at the end of updateIndicators
        }

        // ==================== RISK CALCULATOR INDICATOR ====================
        const riskCalculatorInd = indicatorsArray?.find(ind => ind.type === 'riskCalculator');
        const riskCalculatorEnabled = riskCalculatorInd?.visible !== false;

        if (riskCalculatorEnabled && riskCalculatorInd && mainSeriesRef.current) {
            // Get current LTP for potential use
            const currentLTP = dataRef.current.length > 0 ? dataRef.current[dataRef.current.length - 1]?.close : 0;

            // Calculate risk position based on indicator settings
            const params = {
                capital: riskCalculatorInd.capital || 100000,
                riskPercent: riskCalculatorInd.riskPercent || 2,
                entryPrice: riskCalculatorInd.entryPrice || currentLTP || 0,
                stopLossPrice: riskCalculatorInd.stopLossPrice || 0,
                targetPrice: riskCalculatorInd.targetPrice || null,
                riskRewardRatio: riskCalculatorInd.riskRewardRatio || 2,
                side: riskCalculatorInd.side || 'BUY'
            };

            const results = calculateRiskPosition(params);

            // Update state for panel display
            setRiskCalculatorResults(results);

            // Remove old primitive if exists
            if (riskCalculatorPrimitiveRef.current) {
                removeRiskCalculatorPrimitive({
                    series: mainSeriesRef.current,
                    primitiveRef: riskCalculatorPrimitiveRef
                });
            }

            // Create new draggable primitive with updated prices
            if (results && results.success) {
                riskCalculatorPrimitiveRef.current = createRiskCalculatorPrimitive({
                    series: mainSeriesRef.current,
                    results: {
                        ...results,
                        showTarget: riskCalculatorInd.showTarget !== false
                    },
                    settings: {
                        entryColor: riskCalculatorInd.entryColor || '#26a69a',
                        stopLossColor: riskCalculatorInd.stopLossColor || '#ef5350',
                        targetColor: riskCalculatorInd.targetColor || '#42a5f5',
                        lineWidth: riskCalculatorInd.lineWidth || 2
                    },
                    side: riskCalculatorInd.side || 'BUY',
                    onPriceChange: handleRiskCalculatorDrag
                });

                // Track type for cleanup (primitive-based indicator)
                if (riskCalculatorInd?.id) {
                    indicatorTypesMap.current.set(riskCalculatorInd.id, 'riskCalculator');
                }
            }
        } else if (!riskCalculatorEnabled) {
            // Remove risk calculator primitive when disabled
            if (mainSeriesRef.current) {
                removeRiskCalculatorPrimitive({
                    series: mainSeriesRef.current,
                    primitiveRef: riskCalculatorPrimitiveRef
                });
            }
            setRiskCalculatorResults(null);
        }

        // ==================== CPR (CENTRAL PIVOT RANGE) INDICATOR ====================
        const cprInd = indicatorsArray?.find(ind => ind.type === 'cpr');
        const cprEnabled = cprInd && cprInd.visible !== false;

        if (cprEnabled && cprInd && data && data.length > 0 && chartRef.current) {
            const pivotColor  = cprInd.pivotColor || '#FF9800';
            const bcColor     = cprInd.bcColor    || '#26A69A';
            const tcColor     = cprInd.tcColor    || '#EF5350';
            const lineWidth   = cprInd.lineWidth  || 2;
            const lineStyle   = parseInt(cprInd.lineStyle ?? '0', 10);

            // ── Group candles by date ──────────────────────────────────────────────
            // data is already sorted by time (unix seconds)
            const dayMap = new Map(); // date-string → { h, l, c, candles[] }
            for (const bar of data) {
                const d = new Date(bar.time * 1000);
                const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
                if (!dayMap.has(key)) dayMap.set(key, { h: bar.high, l: bar.low, c: bar.close, candles: [bar] });
                else {
                    const entry = dayMap.get(key);
                    if (bar.high > entry.h) entry.h = bar.high;
                    if (bar.low  < entry.l) entry.l = bar.low;
                    entry.c = bar.close; // last candle = day close
                    entry.candles.push(bar);
                }
            }

            const sortedDays = Array.from(dayMap.entries()).sort((a, b) => a[0] < b[0] ? -1 : 1);

            // ── Calculate CPR levels for each day using PREVIOUS day values ────────
            //   Pivot (P) = (Prev_H + Prev_L + Prev_C) / 3
            //   BC        = (Prev_H + Prev_L) / 2
            //   TC        = 2 * P - BC
            const cprDays = [];
            for (let i = 1; i < sortedDays.length; i++) {
                const [, prev] = sortedDays[i - 1];
                const [, cur ]  = sortedDays[i];

                const P  = (prev.h + prev.l + prev.c) / 3;
                const BC = (prev.h + prev.l) / 2;
                const TC = 2 * P - BC;

                const startTime = cur.candles[0].time;
                const endTime   = cur.candles[cur.candles.length - 1].time;

                cprDays.push({ P, BC, TC, startTime, endTime });
            }

            // ── Recreate series array if count changed (3 series per day) ─────────
            const neededSeriesCount = cprDays.length * 3;
            if (cprSeriesRef.current.length !== neededSeriesCount) {
                for (const s of cprSeriesRef.current) {
                    try { chartRef.current.removeSeries(s); } catch (e) { /* ignore */ }
                }
                cprSeriesRef.current = [];
            }

            // ── Create / update LineSeries for each day ───────────────────────────
            let si = 0;
            for (const day of cprDays) {
                const { P, BC, TC, startTime, endTime } = day;
                const configs = [
                    { value: P,  color: pivotColor },  // Pivot
                    { value: BC, color: bcColor    },  // Bottom Central Pivot
                    { value: TC, color: tcColor    },  // Top Central Pivot
                ];
                for (const { value, color } of configs) {
                    if (!cprSeriesRef.current[si]) {
                        cprSeriesRef.current[si] = chartRef.current.addSeries(LineSeries, {
                            color,
                            lineWidth,
                            lineStyle,
                            priceLineVisible: false,
                            lastValueVisible: false,
                            crosshairMarkerVisible: false,
                        });
                    } else {
                        cprSeriesRef.current[si].applyOptions({ color, lineWidth, lineStyle });
                    }
                    cprSeriesRef.current[si].setData([
                        { time: startTime, value },
                        { time: endTime,   value },
                    ]);
                    si++;
                }
            }

            // Track type for cleanup
            if (cprInd?.id) {
                indicatorTypesMap.current.set(cprInd.id, 'cpr');
            }

        } else if (!cprEnabled) {
            // Clean up CPR series when disabled
            if (chartRef.current) {
                for (const s of cprSeriesRef.current) {
                    try { chartRef.current.removeSeries(s); } catch (e) { /* ignore */ }
                }
            }
            cprSeriesRef.current = [];
        }

        // ==================== PRICE ACTION RANGE (PAR) INDICATOR ====================
        const parIndicator = indicatorsArray?.find(i => i.type === 'priceActionRange');
        const parEnabled = parIndicator && parIndicator.visible !== false;

        if (parEnabled && chartRef.current && data.length > 0) {
            const supportColor = parIndicator.supportColor || '#26a69a';
            const resistanceColor = parIndicator.resistanceColor || '#ef5350';

            const result = calculatePriceActionRange(data, {
                supportColor,
                resistanceColor
            });

            // Clean up existing PAR series if count changed
            const existingCount = priceActionRangeSeriesRef.current.length;
            const neededCount = result.allLevels.length;

            if (existingCount !== neededCount) {
                for (const series of priceActionRangeSeriesRef.current) {
                    try { chartRef.current.removeSeries(series); } catch (e) { /* ignore */ }
                }
                priceActionRangeSeriesRef.current = [];
            }

            // Create or update line series for each support/resistance level
            result.allLevels.forEach((level, idx) => {
                const lineColor = level.type === 'support' ? supportColor : resistanceColor;

                if (!priceActionRangeSeriesRef.current[idx]) {
                    priceActionRangeSeriesRef.current[idx] = chartRef.current.addSeries(LineSeries, {
                        color: lineColor,
                        lineWidth: 2,
                        lineStyle: 0, // Solid
                        priceLineVisible: false,
                        lastValueVisible: false,
                    });
                }

                priceActionRangeSeriesRef.current[idx].setData([
                    { time: level.startTime, value: level.value },
                    { time: level.endTime, value: level.value }
                ]);
            });

            // Collect breakout/breakdown markers
            result.days.forEach(day => {
                if (day.signals && day.signals.length > 0) {
                    day.signals.forEach(signal => {
                        allMarkers.push({
                            time: signal.time,
                            position: signal.type === 'breakout' ? 'aboveBar' : 'belowBar',
                            color: signal.type === 'breakout' ? supportColor : resistanceColor,
                            shape: signal.type === 'breakout' ? 'arrowUp' : 'arrowDown',
                            text: `PAR: ${signal.type === 'breakout' ? 'Breakout' : 'Breakdown'}`
                        });
                    });
                }
            });

            // Track type for cleanup (array-based indicator)
            if (parIndicator?.id) {
                indicatorTypesMap.current.set(parIndicator.id, 'priceActionRange');
            }
        } else if (!parEnabled) {
            // Remove PAR series when disabled
            logger.debug('[MANUAL CLEANUP] PAR manual cleanup triggered. Series count:', priceActionRangeSeriesRef.current.length);
            for (const series of priceActionRangeSeriesRef.current) {
                try {
                    logger.debug('[MANUAL CLEANUP] Removing PAR series');
                    chartRef.current.removeSeries(series);
                } catch (e) { /* ignore */ }
            }
            priceActionRangeSeriesRef.current = [];
            logger.debug('[MANUAL CLEANUP] PAR array cleared');
        }

        // ==================== RED CANDLE ZONES INDICATOR ====================
        const rcIndicator = indicatorsArray?.find(i => i.type === 'redCandleZones');
        const rcEnabled = rcIndicator && rcIndicator.visible !== false;

        if (rcEnabled && chartRef.current && data.length > 0) {
            const minBodyPct = rcIndicator.minBodyPct ?? 40;
            const showSupply = rcIndicator.showSupply !== false;
            const showDemand = rcIndicator.showDemand !== false;

            const res = calculateRedCandleZones(data, { minBodyPct });

            // Count needed series (2 lines per zone = 1 box)
            const neededSeriesCount = (showSupply ? res.supplyZones.length * 2 : 0) + 
                                      (showDemand ? res.demandZones.length * 2 : 0);

            if (redCandleZonesSeriesRef.current.length !== neededSeriesCount) {
                for (const s of redCandleZonesSeriesRef.current) {
                    try { chartRef.current.removeSeries(s); } catch (e) {}
                }
                redCandleZonesSeriesRef.current = [];
            }

            let sIdx = 0;
            
            // Helper to draw a zone (high + low lines)
            const drawZoneLines = (zones, highColor, lowColor, lineWidth, lineStyle) => {
                for (const zone of zones) {
                    // High Line
                    if (!redCandleZonesSeriesRef.current[sIdx]) {
                        redCandleZonesSeriesRef.current[sIdx] = chartRef.current.addSeries(LineSeries, {
                            color: highColor, lineWidth, lineStyle: parseInt(lineStyle || '0', 10),
                            priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false
                        });
                    }
                    redCandleZonesSeriesRef.current[sIdx].setData([
                        { time: zone.startTime, value: zone.high },
                        { time: zone.endTime, value: zone.high }
                    ]);
                    sIdx++;

                    // Low Line
                    if (!redCandleZonesSeriesRef.current[sIdx]) {
                        redCandleZonesSeriesRef.current[sIdx] = chartRef.current.addSeries(LineSeries, {
                            color: lowColor, lineWidth, lineStyle: parseInt(lineStyle || '0', 10),
                            priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false
                        });
                    }
                    redCandleZonesSeriesRef.current[sIdx].setData([
                        { time: zone.startTime, value: zone.low },
                        { time: zone.endTime, value: zone.low }
                    ]);
                    sIdx++;
                }
            };

            if (showSupply) drawZoneLines(res.supplyZones, rcIndicator.supplyHighColor || '#EF5350', rcIndicator.supplyLowColor || '#EF535060', rcIndicator.lineWidth || 1, rcIndicator.lineStyle || '0');
            if (showDemand) drawZoneLines(res.demandZones, rcIndicator.demandHighColor || '#26A69A60', rcIndicator.demandLowColor || '#26A69A', rcIndicator.lineWidth || 1, rcIndicator.lineStyle || '0');

            if (rcIndicator.id) {
                indicatorTypesMap.current.set(rcIndicator.id, 'redCandleZones');
                indicatorSeriesMap.current.set(rcIndicator.id, redCandleZonesSeriesRef.current);
            }
        } else if (!rcEnabled) {
            for (const s of redCandleZonesSeriesRef.current) {
                try { chartRef.current.removeSeries(s); } catch (e) {}
            }
            redCandleZonesSeriesRef.current = [];
        }

        // ==================== MARKET BIAS INDICATOR ====================
        const mbIndicator = indicatorsArray?.find(i => i.type === 'marketBias');
        const mbEnabled = mbIndicator && mbIndicator.visible !== false;

        if (mbEnabled && chartRef.current && data.length > 0) {
            const res = calculateMarketBias(
                data,
                mbIndicator.haLen || 100,
                mbIndicator.haLen2 || 100,
                mbIndicator.oscLen || 7
            );

            const refs = marketBiasSeriesRef.current;
            const showHa = mbIndicator.showHa !== false;
            const showMb = mbIndicator.showMb !== false;

            // 1. Render Band (as Candlestick Series matching High2->Low2)
            if (showMb && res.h2.length > 0) {
                if (!refs.band) {
                    refs.band = chartRef.current.addSeries(CandlestickSeries, {
                        upColor: '#26A69A', downColor: '#EF5350', borderVisible: false, wickVisible: false, priceLineVisible: false, lastValueVisible: false
                    });
                }
                const bandData = [];
                for (let i = 0; i < res.h2.length; i++) {
                    const time = res.h2[i].time;
                    const high = res.h2[i].value;
                    const low = res.l2[i].value;
                    const sig = res.sigColors[i];
                    
                    const baseBull = (mbIndicator.colBull || '#00FF00').slice(0, 7);
                    const baseBear = (mbIndicator.colBear || '#FF0000').slice(0, 7);

                    let color = 'rgba(120, 120, 120, 0.2)'; // default
                    if (sig === 'strongBull') color = baseBull + 'A6'; // 35% transparent pine = ~65% solid
                    else if (sig === 'weakBull') color = baseBull + '40'; // 75% transparent pine = ~25% solid
                    else if (sig === 'strongBear') color = baseBear + 'A6';
                    else if (sig === 'weakBear') color = baseBear + '40';

                    bandData.push({ time, open: high, high: high, low: low, close: low, color });
                }
                refs.band.setData(bandData);
            } else if (refs.band) {
                refs.band.setData([]);
            }

            // 2. Render Smoothed HA Candles
            if (showHa && res.o2.length > 0) {
                if (!refs.candles) {
                    refs.candles = chartRef.current.addSeries(CandlestickSeries, {
                        upColor: '#26A69A', downColor: '#EF5350', borderVisible: true, wickVisible: true, priceLineVisible: false, lastValueVisible: false
                    });
                }
                const candleData = [];
                for (let i = 0; i < res.o2.length; i++) {
                    const time = res.o2[i].time;
                    const o = res.o2[i].value;
                    const h = res.h2[i].value;
                    const l = res.l2[i].value;
                    const c = res.c2[i].value;
                    const dir = res.candleColors[i]; // 'bull' or 'bear'
                    
                    const color = dir === 'bull' ? (mbIndicator.colBull || '#00FF00') : (mbIndicator.colBear || '#FF0000');
                    candleData.push({ time, open: o, high: h, low: l, close: c, color, borderColor: color, wickColor: color });
                }
                refs.candles.setData(candleData);
            } else if (refs.candles) {
                refs.candles.setData([]);
            }

            if (mbIndicator.id) {
                indicatorTypesMap.current.set(mbIndicator.id, 'marketBias');
                indicatorSeriesMap.current.set(mbIndicator.id, marketBiasSeriesRef.current);
            }
        } else if (!mbEnabled) {
            const refs = marketBiasSeriesRef.current;
            if (refs.band) { try { chartRef.current.removeSeries(refs.band); } catch (e) {} refs.band = null; }
            if (refs.candles) { try { chartRef.current.removeSeries(refs.candles); } catch (e) {} refs.candles = null; }
        }

        // ==================== SR HIGH VOLUME BOXES ====================
        const srIndicator = indicatorsArray?.find(i => i.type === 'srVolumeBoxes');
        const srEnabled = srIndicator && srIndicator.visible !== false;

        if (srEnabled && chartRef.current && data.length > 0) {
            const res = calculateSRVolumeBoxes(
                data,
                srIndicator.lookbackPeriod || 20,
                srIndicator.volLen || 2,
                srIndicator.boxWidth || 1
            );

            // Combine boxes
            const allBoxes = [...res.supportBoxes, ...res.resistanceBoxes];
            // Sort by start index
            allBoxes.sort((a, b) => a.startIndex - b.startIndex);

            // We need 1 Candlestick series per box. 
            // Plus 1 invisible Line series for all the makers.
            const neededSeriesCount = allBoxes.length + 1; // +1 for markers

            if (srVolumeBoxesSeriesRef.current.length > neededSeriesCount) {
                for (let i = neededSeriesCount; i < srVolumeBoxesSeriesRef.current.length; i++) {
                    const s = srVolumeBoxesSeriesRef.current[i];
                    if (s) { try { chartRef.current.removeSeries(s); } catch(e){} }
                }
                srVolumeBoxesSeriesRef.current = srVolumeBoxesSeriesRef.current.slice(0, neededSeriesCount);
            }

            let markerSeries = srVolumeBoxesSeriesRef.current[0];
            if (!markerSeries) {
                markerSeries = chartRef.current.addSeries(LineSeries, {
                    lineWidth: 0, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false
                });
                srVolumeBoxesSeriesRef.current[0] = markerSeries;
            }

            const markers = [];

            // Update boxes (starting from index 1 in the ref array)
            for (let i = 0; i < allBoxes.length; i++) {
                const box = allBoxes[i];
                const sIdx = i + 1;
                
                if (!srVolumeBoxesSeriesRef.current[sIdx]) {
                    srVolumeBoxesSeriesRef.current[sIdx] = chartRef.current.addSeries(CandlestickSeries, {
                        borderVisible: false, wickVisible: false, priceLineVisible: false, lastValueVisible: false
                    });
                }
                
                const series = srVolumeBoxesSeriesRef.current[sIdx];
                const boxData = [];

                const baseSupColor = 'rgba(0, 255, 0, 0.3)'; // Default green translucent
                const brokenSupColor = 'rgba(255, 0, 0, 0.15)'; // Red and translucent if broken
                const baseResColor = 'rgba(255, 0, 0, 0.3)';
                const brokenResColor = 'rgba(0, 255, 0, 0.15)';

                const isSup = box.type === 'support';
                const fillColor = isSup 
                    ? (box.broken ? brokenSupColor : baseSupColor) 
                    : (box.broken ? brokenResColor : baseResColor);
                
                const borderColor = isSup
                    ? (box.broken ? 'red' : 'green')
                    : (box.broken ? 'green' : 'red');

                series.applyOptions({
                    upColor: fillColor, downColor: fillColor,
                    borderColor: borderColor, borderVisible: true
                });

                for (let j = box.startIndex; j <= box.endIndex; j++) {
                    if (j < data.length) {
                        boxData.push({
                            time: data[j].time,
                            open: box.top,
                            high: box.top,
                            low: box.bottom,
                            close: box.bottom,
                            color: fillColor
                        });
                    }
                }
                series.setData(boxData);

                // Add markers for holds and breaks
                box.holds.forEach(idx => {
                    if (idx < data.length) {
                        markers.push({
                            time: data[idx].time,
                            position: isSup ? 'belowBar' : 'aboveBar',
                            color: isSup ? '#20ca26' : '#e92929',
                            shape: isSup ? 'arrowUp' : 'arrowDown',
                            text: isSup ? 'Sup Hold' : 'Res Hold',
                            size: 1
                        });
                    }
                });

                box.breaks.forEach(idx => {
                    if (idx < data.length) {
                        markers.push({
                            time: data[idx].time,
                            position: isSup ? 'belowBar' : 'aboveBar',
                            color: isSup ? '#7e1e1e' : '#2b6d2d',
                            shape: 'circle',
                            text: isSup ? 'Break Sup' : 'Break Res',
                            size: 1
                        });
                    }
                });
            }

            // Sync marker series data space and set markers
            const markerData = data.map(d => ({ time: d.time, value: d.close }));
            markerSeries.setData(markerData);
            
            // Sort markers by time as required by lightweight-charts
            markers.sort((a, b) => a.time - b.time);
            
            // Deduplicate markers: lightweight-charts throws "data must be asc ordered" 
            // if multiple markers share the exact same time.
            const uniqueMarkers = [];
            let lastTime = -1;
            for (const m of markers) {
                if (m.time !== lastTime) {
                    uniqueMarkers.push(m);
                    lastTime = m.time;
                } else {
                    // Combine text for markers at the same time
                    const lastMarker = uniqueMarkers[uniqueMarkers.length - 1];
                    if (lastMarker && !lastMarker.text.includes(m.text)) {
                        lastMarker.text += ` + ${m.text}`;
                    }
                }
            }
            markerSeries.setMarkers(uniqueMarkers);

            if (srIndicator.id) {
                indicatorTypesMap.current.set(srIndicator.id, 'srVolumeBoxes');
                indicatorSeriesMap.current.set(srIndicator.id, srVolumeBoxesSeriesRef.current);
            }
        } else if (!srEnabled) {
            for (const s of srVolumeBoxesSeriesRef.current) {
                try { chartRef.current.removeSeries(s); } catch (e) {}
            }
            srVolumeBoxesSeriesRef.current = [];
        }

        // ==================== PIVOT POINTS INDICATOR ====================
        const ppIndicator = indicatorsArray?.find(i => i.type === 'pivotPoints');
        const ppEnabled = ppIndicator && ppIndicator.visible !== false;

        if (ppEnabled && chartRef.current && data.length > 0) {
            const pivotType = ppIndicator.pivotType || 'traditional';
            const timeframe = ppIndicator.timeframe || 'daily';
            const res = calculatePivotPoints(data, pivotType, timeframe);

            // 7 levels per day (P, R1-R3, S1-S3). Count unique days to know needed series.
            // But calculatePivotPoints gives us point-by-point, like VWAP.
            // Wait, calculatePivotPoints returns continuous time-series arrays for each level.
            
            // Collect all non-empty series we need to plot
            const seriesKeysToMap = [
                { key: 'pivot', color: ppIndicator.pivotColor || '#FF9800' },
                { key: 'r1', color: ppIndicator.resistanceColor || '#EF5350' },
                { key: 'r2', color: ppIndicator.resistanceColor || '#EF5350' },
                { key: 'r3', color: ppIndicator.resistanceColor || '#EF5350' },
                { key: 's1', color: ppIndicator.supportColor || '#26A69A' },
                { key: 's2', color: ppIndicator.supportColor || '#26A69A' },
                { key: 's3', color: ppIndicator.supportColor || '#26A69A' },
            ];

            const lw = ppIndicator.lineWidth || 1;
            
            // Adjust the refs array length if needed
            if (pivotPointsSeriesRef.current.length !== seriesKeysToMap.length) {
                for (const s of pivotPointsSeriesRef.current) {
                    if(s) try { chartRef.current.removeSeries(s); } catch (e) {}
                }
                pivotPointsSeriesRef.current = new Array(seriesKeysToMap.length).fill(null);
            }

            seriesKeysToMap.forEach((sk, idx) => {
                if(res[sk.key] && res[sk.key].length > 0) {
                    if (!pivotPointsSeriesRef.current[idx]) {
                        pivotPointsSeriesRef.current[idx] = chartRef.current.addSeries(LineSeries, {
                            color: sk.color, lineWidth: lw, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false
                        });
                    } else {
                        pivotPointsSeriesRef.current[idx].applyOptions({ color: sk.color, lineWidth: lw });
                    }
                    pivotPointsSeriesRef.current[idx].setData(res[sk.key]);
                } else if(pivotPointsSeriesRef.current[idx]) {
                    pivotPointsSeriesRef.current[idx].setData([]);
                }
            });

            if (ppIndicator.id) indicatorTypesMap.current.set(ppIndicator.id, 'pivotPoints');
        } else if (!ppEnabled) {
             for (const s of pivotPointsSeriesRef.current) {
                if(s) try { chartRef.current.removeSeries(s); } catch (e) {}
            }
            pivotPointsSeriesRef.current = [];
        }

        // ==================== VWAP BANDS INDICATOR ====================
        const vwapBandsInd = indicatorsArray?.find(i => i.type === 'vwapBands');
        const vbwEnabled = vwapBandsInd && vwapBandsInd.visible !== false;

        if (vbwEnabled && chartRef.current && data.length > 0) {
            // Note: Since this behaves mostly like a standard indicator, we might overlap with standard VWAP handler in updateIndicatorSeries.
            // But this draws bands, so we handle it similarly. 
            // Better yet, updateIndicatorSeries doesn't natively do 5 lines for one series entry without a custom draw method.
            // calculateVWAPBands returns { vwap, upperBand1, lowerBand1, upperBand2, lowerBand2 }
            const res = calculateVWAPBands(data, vwapBandsInd.band1Mult || 1, true); // true = resetDaily
            const res2 = calculateVWAPBands(data, vwapBandsInd.band2Mult || 2, true);
            
            const refs = vwapBandsSeriesRef.current;
            const drawBand = (key, lineData, color, width) => {
                if (lineData && lineData.length > 0) {
                    const validData = lineData.filter(d => !isNaN(d.value) && d.value !== null);
                    if (validData.length > 0) {
                        if(!refs[key]) {
                            refs[key] = chartRef.current.addSeries(LineSeries, {
                                color: color, lineWidth: width, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false
                            });
                        } else {
                            refs[key].applyOptions({ color: color, lineWidth: width });
                        }
                        refs[key].setData(validData);
                    } else if (refs[key]) {
                        refs[key].setData([]);
                    }
                }
            };
            
            const lw = vwapBandsInd.lineWidth || 2;
            const b1color = vwapBandsInd.band1Color || '#2962FF80';
            const b2color = vwapBandsInd.band2Color || '#9C27B080';

            // Also VWAP line handled by standard createIndicatorSeries? Wait, 'vwapBands' isn't handled by default unless metadata mapped.
            // We'll draw the VWAP center line explicitly here!
            if(!refs.center) {
                refs.center = chartRef.current.addSeries(LineSeries, {
                     color: vwapBandsInd.vwapColor || '#FF9800', lineWidth: lw, priceLineVisible: true, lastValueVisible: true, crosshairMarkerVisible: true
                });
            } else {
                refs.center.applyOptions({ color: vwapBandsInd.vwapColor || '#FF9800', lineWidth: lw });
            }
            const validVwap = res.vwap.filter(d => !isNaN(d.value) && d.value !== null);
            refs.center.setData(validVwap);
            
            if (vwapBandsInd.showBand1 !== false) {
                drawBand('upper1', res.upperBand1, b1color, 1);
                drawBand('lower1', res.lowerBand1, b1color, 1);
            } else {
                if(refs.upper1) refs.upper1.setData([]);
                if(refs.lower1) refs.lower1.setData([]);
            }
            
            if (vwapBandsInd.showBand2 !== false) {
                drawBand('upper2', res2.upperBand2, b2color, 1);
                drawBand('lower2', res2.lowerBand2, b2color, 1);
            } else {
                if(refs.upper2) refs.upper2.setData([]);
                if(refs.lower2) refs.lower2.setData([]);
            }

            if (vwapBandsInd.id) {
                indicatorTypesMap.current.set(vwapBandsInd.id, 'vwapBands');
                indicatorSeriesMap.current.set(vwapBandsInd.id, vwapBandsSeriesRef.current);
            }
        } else if (!vbwEnabled) {
            const refs = vwapBandsSeriesRef.current;
            for(const [key, s] of Object.entries(refs)) {
                if(s) {
                     try { chartRef.current.removeSeries(s); } catch (e) {}
                     refs[key as keyof typeof refs] = null;
                }
            }
        }

        // --- UNIFIED CLEANUP LOGIC ---
        // Identify IDs that are no longer in the list
        const idsToRemove = [];
        for (const id of indicatorSeriesMap.current.keys()) {
            if (!validIds.has(id)) {
                idsToRemove.push(id);
            }
        }

        // DEBUG: Log cleanup detection
        logger.debug('[CLEANUP DEBUG] ===== CLEANUP DETECTION =====');
        logger.debug('[CLEANUP DEBUG] Valid IDs from indicators:', Array.from(validIds));
        logger.debug('[CLEANUP DEBUG] Series map keys (existing):', Array.from(indicatorSeriesMap.current.keys()));
        logger.debug('[CLEANUP DEBUG] IDs to remove:', idsToRemove);
        logger.debug('[CLEANUP DEBUG] Types map entries:', Array.from(indicatorTypesMap.current.entries()));

        if (idsToRemove.length > 0) {
            logger.debug('[CLEANUP] Detected indicators to remove:', idsToRemove);
            logger.debug('[CLEANUP] Valid IDs:', Array.from(validIds));
            logger.debug('[CLEANUP] Series map keys:', Array.from(indicatorSeriesMap.current.keys()));
            logger.debug('[CLEANUP] Types map:', Array.from(indicatorTypesMap.current.entries()));
        }

        // Prepare cleanup context with all necessary references
        const cleanupContext = {
            chart: chartRef.current,
            mainSeries: mainSeriesRef.current,
            indicatorSeriesMap: indicatorSeriesMap.current,
            indicatorPanesMap: indicatorPanesMap.current,
            refs: {
                tpoProfileRef,
                riskCalculatorPrimitiveRef,
                firstCandleSeriesRef,
                rangeBreakoutSeriesRef,
                priceActionRangeSeriesRef,
                cprSeriesRef,
                redCandleZonesSeriesRef,
                marketBiasSeriesRef,
                srVolumeBoxesSeriesRef,
                pivotPointsSeriesRef,
                vwapBandsSeriesRef
            }
        };

        // Execute unified cleanup using metadata-driven engine
        if (idsToRemove.length > 0) {
            logger.debug('[CLEANUP] Calling cleanupIndicators with', idsToRemove.length, 'indicators');
            cleanupIndicators(idsToRemove, indicatorTypesMap.current, cleanupContext);
            logger.debug('[CLEANUP] Cleanup complete');

            // Explicit ref null assignments for cleanup hygiene (Phase 4.1)
            idsToRemove.forEach(id => {
                const type = indicatorTypesMap.current.get(id);
                if (type === 'annStrategy') {
                    annStrategyPaneRef.current = null;
                    logger.debug('[CLEANUP] Nulled annStrategyPaneRef');
                }
            });
        }

        // Set all collected markers on the main candlestick series using lightweight-charts v5 API
        // This ensures markers from all indicators (ANN Strategy, Range Breakout, etc.) are displayed together
        if (mainSeriesRef.current) {
            try {
                // Sort markers by time to ensure proper display order
                allMarkers.sort((a, b) => a.time - b.time);

                // In lightweight-charts v5, markers are handled via createSeriesMarkers
                if (!seriesMarkersRef.current) {
                    // Create the markers primitive if it doesn't exist
                    seriesMarkersRef.current = createSeriesMarkers(mainSeriesRef.current, allMarkers);
                } else {
                    // Update existing markers primitive
                    seriesMarkersRef.current.setMarkers(allMarkers);
                }
            } catch (e) {
                logger.warn('[Markers] Error setting markers:', e);
            }
        }

    }, []);

    // --- VISUAL TRADING DATA SYNC ---
    useEffect(() => {
        if (!visualTradingRef.current) return;

        const currentSym = symbolRef.current || symbol; // prefer Ref but fallback to prop

        // Filter orders/positions for current symbol using consistent helper
        const relevantOrders = (orders || []).filter(o => areSymbolsEquivalent(o.symbol, currentSym));
        const relevantPositions = (positions || []).filter(p => areSymbolsEquivalent(p.symbol, currentSym));

        if (process.env.NODE_ENV === 'development') {
            logger.debug('[VisualTrading] Sync:', {
                currentSym,
                totalOrders: (orders || []).length,
                relevantOrders: relevantOrders.length,
                relevantPositions: relevantPositions.length,
                allOrderSymbols: (orders || []).map(o => o.symbol)
            });
        }

        visualTradingRef.current.setData(relevantOrders, relevantPositions);
    }, [orders, positions, symbol]);



    // Update callbacks for Visual Trading (fix stale closures)
    useEffect(() => {
        if (visualTradingRef.current) {
            visualTradingRef.current.setCallbacks({
                onModifyOrder,
                onCancelOrder
            });
        }
    }, [onModifyOrder, onCancelOrder]);

    // --- VISUAL TRADING EVENT LISTENERS ---
    // NOTE: VisualTrading handles its own mouse events internally via attached() method.
    // No need for manual event forwarding here.

    // ========== OI LINES EFFECT (Max Call OI, Max Put OI, Max Pain) ==========
    useEffect(() => {
        if (!mainSeriesRef.current || !chartRef.current) {
            return;
        }

        // Helper to create or update a price line
        const updatePriceLine = (key, price, options) => {
            if (price && showOILines) {
                if (oiPriceLinesRef.current[key]) {
                    // Update existing line
                    oiPriceLinesRef.current[key].applyOptions({ price, ...options });
                } else {
                    // Create new line
                    oiPriceLinesRef.current[key] = mainSeriesRef.current.createPriceLine({
                        price,
                        ...options
                    });
                }
            } else {
                // Remove line if disabled or no price
                if (oiPriceLinesRef.current[key]) {
                    mainSeriesRef.current.removePriceLine(oiPriceLinesRef.current[key]);
                    oiPriceLinesRef.current[key] = null;
                }
            }
        };

        // Max Call OI Line (Red/Orange - Resistance)
        updatePriceLine('maxCallOI', (oiLines as any)?.maxCallOI, {
            color: '#ef5350',
            lineWidth: 2,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: 'Max Call OI',
        });

        // Max Put OI Line (Blue/Cyan - Support)
        updatePriceLine('maxPutOI', (oiLines as any)?.maxPutOI, {
            color: '#42A5F5',
            lineWidth: 2,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: 'Max Put OI',
        });

        // Max Pain Line (Green)
        updatePriceLine('maxPain', (oiLines as any)?.maxPain, {
            color: '#66BB6A',
            lineWidth: 2,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: 'Max Pain',
        });

        // Cleanup on unmount
        return () => {
            if (mainSeriesRef.current) {
                Object.keys(oiPriceLinesRef.current).forEach(key => {
                    if (oiPriceLinesRef.current[key]) {
                        try {
                            mainSeriesRef.current.removePriceLine(oiPriceLinesRef.current[key]);
                        } catch (e) {
                            // Ignore errors during cleanup
                        }
                        oiPriceLinesRef.current[key] = null;
                    }
                });
            }
        };
    }, [oiLines, showOILines]);

    // Separate effect for indicators to prevent data reload
    useEffect(() => {
        logger.debug('[DEBUG] Indicators effect TRIGGERED. Count:', indicators?.length);
        logger.debug('[DEBUG] Indicator IDs:', indicators?.map(i => i.id));

        if (dataRef.current.length > 0) {
            // Update indicators with current data
            try {
                updateIndicators(dataRef.current, indicators);
            } catch (error) {
                logger.error('Error updating indicators:', error);
            }
        }
    }, [indicators, updateIndicators]);

    // Track Pine indicator input hashes to detect changes
    const pineInputHashRef = useRef<Record<string, string>>({});

    // Execute Pine Script when Pine indicators are added or inputs change
    useEffect(() => {
        if (!indicators || dataRef.current.length === 0) return;

        const pineIndicators = indicators.filter((ind: any) => ind.type === 'pine' && ind.pineCode);

        pineIndicators.forEach(async (ind: any) => {
            // Create hash of current input values to detect changes
            const inputHash = JSON.stringify(
                (ind.pineInputs || []).map((input: any) => ind[input.name])
            );

            // Skip if already executed with same inputs
            if (pineInputHashRef.current[ind.id] === inputHash && ind.pineResultData) {
                return;
            }

            try {
                logger.debug('[Pine] Executing Pine Script for:', ind.id, 'with inputs:', inputHash);

                // Build input values from indicator settings
                const inputValues: Record<string, unknown> = {};
                (ind.pineInputs || []).forEach((input: any) => {
                    inputValues[input.name] = ind[input.name] ?? input.default;
                });

                // Execute Pine Script
                const result = await pineScriptService.execute(
                    ind.pineCode,
                    dataRef.current,
                    inputValues
                );

                if (result.errors.length === 0 && result.plots.size > 0) {
                    // Get the first plot's data
                    const firstPlot = result.plots.values().next().value;
                    if (firstPlot && firstPlot.data) {
                        // Update the indicator with the result data
                        if (onIndicatorSettings) {
                            onIndicatorSettings(ind.id, {
                                pineResultData: firstPlot.data,
                                pineResultColor: firstPlot.config?.color
                            });
                        }
                        pineInputHashRef.current[ind.id] = inputHash;
                        logger.debug('[Pine] Execution successful, data points:', firstPlot.data.length);
                    }
                } else if (result.errors.length > 0) {
                    logger.warn('[Pine] Execution errors:', result.errors);
                }
            } catch (error) {
                logger.error('[Pine] Execution failed:', error);
            }
        });
    }, [indicators, onIndicatorSettings]);

    // Handle Magnet Mode
    useEffect(() => {
        if (chartRef.current) {
            chartRef.current.applyOptions({
                crosshair: {
                    mode: magnetMode ? 1 : 0,
                },
            });
        }
    }, [magnetMode]);

    // OHLC Header Bar - Subscribe to crosshair move
    useEffect(() => {
        if (!chartRef.current || !mainSeriesRef.current) return;

        const handleCrosshairMove = (param) => {
            // Show last candle data when not hovering (mouse left chart or no data at position)
            const isNotHovering = !param || !param.point || !param.seriesData || param.seriesData.size === 0;

            if (isNotHovering || !mainSeriesRef.current) {
                // Show last candle data when not hovering
                if (dataRef.current && dataRef.current.length > 0) {
                    const lastData = dataRef.current[dataRef.current.length - 1];
                    const prevData = dataRef.current.length > 1 ? dataRef.current[dataRef.current.length - 2] : null;
                    const change = prevData ? lastData.close - prevData.close : 0;
                    const changePercent = prevData && prevData.close !== 0 ? ((change / prevData.close) * 100) : 0;

                    setOhlcData({
                        open: lastData.open,
                        high: lastData.high,
                        low: lastData.low,
                        close: lastData.close,
                        change: change,
                        changePercent: changePercent,
                        isUp: lastData.close >= lastData.open
                    });

                    // Update indicator values with last values (generic)
                    const newIndicatorValues = {};
                    indicatorSeriesMap.current.forEach((seriesOrObj, id) => {
                        try {
                            if (seriesOrObj.applyOptions) {
                                // Single Series (SMA, EMA, etc.)
                                const data = seriesOrObj.data();
                                if (data && data.length > 0) {
                                    newIndicatorValues[id] = data[data.length - 1].value;
                                }
                            } else {
                                // Compound Indicator (BB, MACD, Stoch)
                                Object.entries(seriesOrObj).forEach(([key, s]: [string, any]) => {
                                    if (s && s.data) {
                                        const data = s.data();
                                        if (data && data.length > 0) {
                                            if (!newIndicatorValues[id]) newIndicatorValues[id] = {};
                                            newIndicatorValues[id][key] = data[data.length - 1].value;
                                        }
                                    }
                                });
                            }
                        } catch (e) {
                            // Ignore
                        }
                    });
                    setIndicatorValues(newIndicatorValues);
                }
                return;
            }

            const data = param.seriesData.get(mainSeriesRef.current);
            if (data && data.open !== undefined) {
                // Find previous candle for change calculation
                const currentIndex = dataRef.current.findIndex(d => d.time === data.time);
                const prevData = currentIndex > 0 ? dataRef.current[currentIndex - 1] : null;
                const change = prevData ? data.close - prevData.close : 0;
                const changePercent = prevData && prevData.close !== 0 ? ((change / prevData.close) * 100) : 0;

                setOhlcData({
                    open: data.open,
                    high: data.high,
                    low: data.low,
                    close: data.close,
                    change: change,
                    changePercent: changePercent,
                    isUp: data.close >= data.open
                });

                // Update indicator values at crosshair position
                const newIndicatorValues = {};

                indicatorSeriesMap.current.forEach((seriesOrObj, id) => {
                    try {
                        if (seriesOrObj.applyOptions) {
                            // Single Series
                            const d = param.seriesData.get(seriesOrObj);
                            if (d && d.value !== undefined) {
                                newIndicatorValues[id] = d.value;
                            }
                        } else {
                            // Compound Indicator
                            Object.entries(seriesOrObj).forEach(([key, s]) => {
                                const d = param.seriesData.get(s);
                                if (d && d.value !== undefined) {
                                    if (!newIndicatorValues[id]) newIndicatorValues[id] = {};
                                    newIndicatorValues[id][key] = d.value;
                                }
                            });
                        }
                    } catch (e) {
                        // Ignore
                    }
                });

                setIndicatorValues(newIndicatorValues);
            }
        };

        chartRef.current.subscribeCrosshairMove(handleCrosshairMove);

        // Initialize with last candle data
        if (dataRef.current && dataRef.current.length > 0) {
            const lastData = dataRef.current[dataRef.current.length - 1];
            const prevData = dataRef.current.length > 1 ? dataRef.current[dataRef.current.length - 2] : null;
            const change = prevData ? lastData.close - prevData.close : 0;
            const changePercent = prevData && prevData.close !== 0 ? ((change / prevData.close) * 100) : 0;

            setOhlcData({
                open: lastData.open,
                high: lastData.high,
                low: lastData.low,
                close: lastData.close,
                change: change,
                changePercent: changePercent,
                isUp: lastData.close >= lastData.open
            });
        }

        return () => {
            if (chartRef.current) {
                try {
                    chartRef.current.unsubscribeCrosshairMove(handleCrosshairMove);
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        };
    }, [symbol, exchange, interval]); // Re-subscribe when symbol/exchange/interval changes



    // Handle Comparison Symbols with different scale modes
    useEffect(() => {
        if (!chartRef.current) return;

        const abortController = new AbortController();
        let cancelled = false;

        // Create unique keys that include scale mode and symbol
        const currentSymbolsMap = new Map(comparisonSymbols.map(s => [
            `${s.symbol}_${s.exchange}_${s.scaleMode || 'samePercent'}`,
            s
        ]));
        const activeSeries = comparisonSeriesRefs.current;
        const activePanes = comparisonPanesRef.current;

        // Remove series/panes that are no longer in comparisonSymbols
        activeSeries.forEach((series, key) => {
            if (!currentSymbolsMap.has(key)) {
                try {
                    // Check if it was in a separate pane
                    const pane = activePanes.get(key);
                    if (pane) {
                        try {
                            const idx = chartRef.current.panes().indexOf(pane);
                            if (idx > 0) chartRef.current.removePane(idx);
                        } catch (e) { /* ignore */ }
                        activePanes.delete(key);
                    } else {
                        chartRef.current.removeSeries(series);
                    }
                } catch (e) {
                    // Ignore removal errors
                }
                activeSeries.delete(key);
            }
        });

        // Check if any active series use the left scale, if not, hide it
        const hasLeftScaleSeries = comparisonSymbols.some(s => s.scaleMode === 'newPriceScale');
        if (!hasLeftScaleSeries && chartRef.current) {
            chartRef.current.priceScale('left').applyOptions({ visible: false });
        }

        // Add new series with cancellation support
        const loadComparisonData = async (comp) => {
            const key = `${comp.symbol}_${comp.exchange}_${comp.scaleMode || 'samePercent'}`;
            logger.debug('[Comparison] Processing:', key, 'Exists:', activeSeries.has(key));

            // Check if series exists AND has data - if it exists but has no data, reload it
            if (activeSeries.has(key)) {
                const existingSeries = activeSeries.get(key);
                try {
                    const existingData = existingSeries.data();
                    if (existingData && existingData.length > 0) {
                        logger.debug('[Comparison] Series already has data:', key);
                        return; // Already has data, skip
                    }
                    logger.debug('[Comparison] Series exists but no data, removing and recreating:', key);
                    // Remove the empty series and recreate
                    chartRef.current.removeSeries(existingSeries);
                    activeSeries.delete(key);
                } catch (e) {
                    // Series might be invalid, recreate it
                    logger.debug('[Comparison] Series check error, recreating:', key, e);
                    try { chartRef.current.removeSeries(existingSeries); } catch (e2) { /* ignore */ }
                    activeSeries.delete(key);
                }
            }

            const scaleMode = comp.scaleMode || 'samePercent';
            let series;
            let pane;

            // Determine price scale based on scale mode
            if (scaleMode === 'newPane') {
                // Create a new pane for this comparison
                pane = chartRef.current.addPane({ height: 150 });
                activePanes.set(key, pane);

                series = pane.addSeries(LineSeries, {
                    color: comp.color,
                    lineWidth: 2,
                    priceScaleId: 'right',
                    title: comp.symbol,
                });
            } else if (scaleMode === 'newPriceScale') {
                // Create a series on a new left price scale
                series = chartRef.current.addSeries(LineSeries, {
                    color: comp.color,
                    lineWidth: 2,
                    priceScaleId: 'left', // Use left scale for comparison
                    title: comp.symbol,
                });

                // Configure the left price scale
                chartRef.current.priceScale('left').applyOptions({
                    visible: true,
                    borderColor: '#363a45',
                    autoScale: true,
                });
            } else {
                // Same % scale (default) - use right price scale with percentage mode
                series = chartRef.current.addSeries(LineSeries, {
                    color: comp.color,
                    lineWidth: 2,
                    priceScaleId: 'right',
                    title: comp.symbol,
                });
            }

            activeSeries.set(key, series);
            logger.debug('[Comparison] Created series for:', key, 'Color:', comp.color);

            try {
                const data = await getKlines(comp.symbol, comp.exchange || 'NSE', interval, 1000, abortController.signal);
                logger.debug('[Comparison] Data loaded for:', key, 'Length:', data?.length);
                // Check if still valid before setting data
                if (cancelled || !activeSeries.has(key)) return;
                if (data && data.length > 0) {
                    const transformedData = data.map(d => ({ time: d.time, value: d.close }));
                    series.setData(transformedData);
                    logger.debug('[Comparison] Data set for:', key);
                } else {
                    logger.warn('[Comparison] No data for:', key);
                }
            } catch (err) {
                if (err.name !== 'AbortError') {
                    logger.error(`Failed to load comparison data for ${comp.symbol}`, err);
                }
            }
        };

        logger.debug('[Comparison] Processing symbols:', comparisonSymbols.map(c => c.symbol));
        comparisonSymbols.forEach(comp => loadComparisonData(comp));

        // Update Price Scale Mode based on comparison mode
        // Check if any comparison uses samePercent mode
        const hasSamePercentComparison = comparisonSymbols.some(c =>
            (c.scaleMode || 'samePercent') === 'samePercent'
        );

        // 0: Normal, 1: Log, 2: Percentage
        let mode;
        if (hasSamePercentComparison) {
            mode = 2; // Percentage mode for Same % scale comparisons
        } else if (isLogScale) {
            mode = 1;
        } else {
            mode = 0;
        }

        chartRef.current.priceScale('right').applyOptions({
            mode: mode,
            autoScale: isAutoScale,
        });

        return () => {
            cancelled = true;
            abortController.abort();
        };
    }, [comparisonSymbols, interval, isLogScale, isAutoScale]);

    // Update comparison symbol price labels
    useEffect(() => {
        if (!chartRef.current || comparisonSymbols.length === 0) {
            setComparisonPriceLabels({});
            return;
        }

        const updateComparisonLabels = () => {
            const container = chartContainerRef.current;
            if (!container) return;

            const containerRect = container.getBoundingClientRect();
            const labels = {};

            const activeSeries = comparisonSeriesRefs.current;

            // Count symbol occurrences to handle duplicates
            const symbolCounts = {};
            comparisonSymbols.forEach(c => {
                symbolCounts[c.symbol] = (symbolCounts[c.symbol] || 0) + 1;
            });

            comparisonSymbols.forEach(comp => {
                const key = `${comp.symbol}_${comp.exchange}_${comp.scaleMode || 'samePercent'}`;
                const series = activeSeries.get(key);

                if (series) {
                    try {
                        const data = series.data();
                        if (data && data.length > 0) {
                            const lastDataPoint = data[data.length - 1];
                            const price = lastDataPoint.value;

                            // Get Y coordinate for this price
                            const y = series.priceToCoordinate(price);

                            if (y !== null && y >= 0 && y <= containerRect.height) {
                                // If symbol appears multiple times, append exchange to differentiate
                                const displayName = symbolCounts[comp.symbol] > 1
                                    ? `${comp.symbol} (${comp.exchange})`
                                    : comp.symbol;

                                // Use unique key for the map to avoid overwriting duplicates
                                labels[key] = {
                                    price: price,
                                    y: y,
                                    color: comp.color,
                                    symbol: displayName,
                                    scaleMode: comp.scaleMode || 'samePercent'
                                };
                            }
                        }
                    } catch (e) {
                        // Series may not be ready yet
                    }
                }
            });

            setComparisonPriceLabels(labels);
        };

        // Initial update
        const timeoutId = setTimeout(updateComparisonLabels, 500);

        // Subscribe to visible range changes
        const handleVisibleRangeChange = () => {
            updateComparisonLabels();
        };

        if (chartRef.current) {
            chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
        }

        return () => {
            clearTimeout(timeoutId);
            if (chartRef.current) {
                try {
                    chartRef.current.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
                } catch (e) { /* ignore */ }
            }
        };
    }, [comparisonSymbols]);

    // Handle Theme and Appearance Changes
    useEffect(() => {
        if (chartRef.current) {
            const backgroundColor = theme === 'dark'
                ? (chartAppearance.darkBackground || '#131722')
                : (chartAppearance.lightBackground || '#ffffff');
            const gridColor = theme === 'dark'
                ? (chartAppearance.darkGridColor || '#2A2E39')
                : (chartAppearance.lightGridColor || '#e0e3eb');

            chartRef.current.applyOptions({
                layout: {
                    textColor: theme === 'dark' ? '#D1D4DC' : '#131722',
                    background: { color: backgroundColor },
                },
                grid: {
                    vertLines: {
                        color: gridColor,
                        visible: chartAppearance.showVerticalGridLines !== false,
                    },
                    horzLines: {
                        color: gridColor,
                        visible: chartAppearance.showHorizontalGridLines !== false,
                    },
                },
                crosshair: {
                    vertLine: {
                        color: theme === 'dark' ? '#758696' : '#9598a1',
                        labelBackgroundColor: theme === 'dark' ? '#758696' : '#9598a1',
                    },
                    horzLine: {
                        color: theme === 'dark' ? '#758696' : '#9598a1',
                        labelBackgroundColor: theme === 'dark' ? '#758696' : '#9598a1',
                    },
                },
                timeScale: {
                    borderColor: gridColor,
                },
                rightPriceScale: {
                    borderColor: gridColor,
                },
            });

            // Update series colors (real-time preview)
            if (mainSeriesRef.current) {
                const upColor = chartAppearance.candleUpColor || '#089981';
                const downColor = chartAppearance.candleDownColor || '#F23645';
                const wickUpColor = chartAppearance.wickUpColor || upColor;
                const wickDownColor = chartAppearance.wickDownColor || downColor;

                const seriesType = chartTypeRef.current;

                if (seriesType === 'candlestick' || seriesType === 'heikin-ashi') {
                    mainSeriesRef.current.applyOptions({
                        upColor,
                        downColor,
                        wickUpColor,
                        wickDownColor,
                    });
                } else if (seriesType === 'bar') {
                    mainSeriesRef.current.applyOptions({
                        upColor,
                        downColor,
                    });
                } else if (seriesType === 'hollow-candlestick') {
                    mainSeriesRef.current.applyOptions({
                        downColor,
                        borderUpColor: upColor,
                        borderDownColor: downColor,
                        wickUpColor,
                        wickDownColor,
                    });
                } else if (seriesType === 'baseline') {
                    mainSeriesRef.current.applyOptions({
                        topLineColor: upColor,
                        topFillColor1: hexToRgba(upColor, 0.28),
                        topFillColor2: hexToRgba(upColor, 0.05),
                        bottomLineColor: downColor,
                        bottomFillColor1: hexToRgba(downColor, 0.05),
                        bottomFillColor2: hexToRgba(downColor, 0.28),
                    });
                }
            }
        }
    }, [theme, chartAppearance]);

    // Handle Time Range
    useEffect(() => {
        if (chartRef.current && timeRange && !isLoading) {
            const now = Math.floor(Date.now() / 1000);
            let from = now;
            const to = now;

            switch (timeRange) {
                case '1D': from = now - 86400; break;
                case '5D': from = now - 86400 * 5; break;
                case '1M': from = now - 86400 * 30; break;
                case '3M': from = now - 86400 * 90; break;
                case '6M': from = now - 86400 * 180; break;
                case 'YTD': {
                    const startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime() / 1000;
                    from = startOfYear;
                    break;
                }
                case '1Y': from = now - 86400 * 365; break;
                case '5Y': from = now - 86400 * 365 * 5; break;
                case 'All':
                    applyDefaultCandlePosition(dataRef.current?.length || 0);
                    return;
                default: return;
            }

            if (from && to && !isNaN(from) && !isNaN(to)) {
                try {
                    chartRef.current.timeScale().setVisibleRange({ from, to });
                } catch (e) {
                    if (e.message !== 'Value is null') {
                        logger.warn('Failed to set visible range:', e);
                    }
                }
            }
        }
    }, [timeRange, isLoading]);

    // Replay Logic
    const stopReplay = () => {
        if (replayIntervalRef.current) {
            clearInterval(replayIntervalRef.current);
            replayIntervalRef.current = null;
        }
    };

    // Define updateReplayData first since other functions depend on it
    const updateReplayData = useCallback((index, hideFeature = true, preserveView = false) => {
        if (!mainSeriesRef.current || !fullDataRef.current || !chartRef.current) return;

        // Clamp index to valid range
        const clampedIndex = Math.max(0, Math.min(index, fullDataRef.current.length - 1));

        // Store current visible range if we need to preserve it
        let currentVisibleRange = null;
        if (preserveView && chartRef.current) {
            try {
                const timeScale = chartRef.current.timeScale();
                currentVisibleRange = timeScale.getVisibleLogicalRange();
            } catch (e) {
                // Ignore errors
            }
        }

        const pastData = fullDataRef.current.slice(0, clampedIndex + 1);

        if (hideFeature) {
            // Hide future candles - show only past data
            dataRef.current = pastData;
            const transformedData = transformData(pastData, chartTypeRef.current);
            mainSeriesRef.current.setData(transformedData);
        } else {
            // Show all candles (for preview mode)
            dataRef.current = fullDataRef.current;
            const transformedData = transformData(fullDataRef.current, chartTypeRef.current);
            mainSeriesRef.current.setData(transformedData);
        }

        // Update indicators only with past data (use ref to avoid stale closure)
        updateIndicators(pastData, indicatorsRef.current);
        updateAxisLabel();

        // Update timer with latest candle data from replay to ensure correct color
        if (priceScaleTimerRef.current && pastData.length > 0) {
            const lastCandle = pastData[pastData.length - 1];
            if (lastCandle && lastCandle.open !== undefined && lastCandle.close !== undefined) {
                priceScaleTimerRef.current.updateCandleData(lastCandle.open, lastCandle.close);
            }
        }

        // Update ref to keep in sync
        replayIndexRef.current = clampedIndex;

        // Restore visible range if we're preserving the view
        if (preserveView && currentVisibleRange && chartRef.current) {
            try {
                setTimeout(() => {
                    if (mountedRef.current && chartRef.current) {
                        const timeScale = chartRef.current.timeScale();
                        timeScale.setVisibleLogicalRange(currentVisibleRange);
                    }
                }, 0);
            } catch (e) {
                // Ignore errors
            }
        }
    }, []);

    // Store updateReplayData in ref so it can be accessed from useImperativeHandle
    useEffect(() => {
        updateReplayDataRef.current = updateReplayData;
    }, [updateReplayData]);

    const handleReplayPlayPause = () => {
        setIsPlaying(prev => !prev);
    };

    const handleReplayForward = () => {
        const currentIndex = replayIndexRef.current;
        if (currentIndex !== null && currentIndex < fullDataRef.current.length - 1) {
            const nextIndex = currentIndex + 1;
            setReplayIndex(nextIndex);
            updateReplayData(nextIndex);
        }
    };

    const handleReplayJumpTo = () => {
        setIsSelectingReplayPoint(true);
        setIsPlaying(false);

        // Show ALL candles so user can see the full timeline and select a new point
        // But preserve the current zoom level and position
        if (mainSeriesRef.current && fullDataRef.current && fullDataRef.current.length > 0) {
            // Store current visible range to preserve zoom level
            let currentVisibleRange = null;
            if (chartRef.current) {
                try {
                    const timeScale = chartRef.current.timeScale();
                    currentVisibleRange = timeScale.getVisibleRange();
                } catch (e) {
                    // Ignore errors
                }
            }

            // Store current replay index before showing all candles
            const currentReplayIndex = replayIndexRef.current;

            // Show all candles so user can see the full timeline
            dataRef.current = fullDataRef.current;
            const transformedData = transformData(fullDataRef.current, chartTypeRef.current);
            mainSeriesRef.current.setData(transformedData);
            updateIndicators(fullDataRef.current, indicators);

            // Restore the visible range to maintain zoom level
            // Use setTimeout to ensure data update has completed
            setTimeout(() => {
                if (mountedRef.current && chartRef.current && fullDataRef.current && fullDataRef.current.length > 0) {
                    try {
                        const timeScale = chartRef.current.timeScale();

                        // If we have a current visible range, restore it to maintain zoom
                        if (currentVisibleRange && currentVisibleRange.from && currentVisibleRange.to) {
                            // Restore the exact same range to maintain zoom level
                            timeScale.setVisibleRange(currentVisibleRange);
                        } else if (currentReplayIndex !== null && currentReplayIndex >= 0) {
                            // No current range, but we have a replay index - show around it
                            const currentIndex = currentReplayIndex;
                            const currentTime = fullDataRef.current[currentIndex]?.time;

                            if (currentTime) {
                                // Use a reasonable default window that matches typical zoom
                                const startIndex = Math.max(0, currentIndex - DEFAULT_VIEW_WINDOW / 2);
                                const endIndex = Math.min(fullDataRef.current.length - 1, currentIndex + DEFAULT_VIEW_WINDOW / 2);

                                const startTime = fullDataRef.current[startIndex]?.time;
                                const endTime = fullDataRef.current[endIndex]?.time;

                                if (startTime && endTime) {
                                    timeScale.setVisibleRange({ from: startTime, to: endTime });
                                }
                            }
                        } else {
                            // No current range or replay index - use fitContent to show all
                            try {
                                timeScale.fitContent();
                            } catch (e) {
                                // Ignore
                            }
                        }
                    } catch (e) {
                        logger.warn('Failed to restore visible range in Jump to Bar:', e);
                    }
                }
            }, 50);
        }

        // Change cursor to indicate selection
        if (chartContainerRef.current) {
            chartContainerRef.current.style.cursor = 'crosshair';
        }
    };

    const handleSliderChange = useCallback((index, hideFuture = true) => {
        if (index >= 0 && index < fullDataRef.current.length) {
            // Stop playback when user manually changes position
            if (isPlayingRef.current) {
                setIsPlaying(false);
                isPlayingRef.current = false;
                stopReplay();
            }

            setReplayIndex(index);
            updateReplayData(index, hideFuture);
        }
    }, [updateReplayData]);

    // Playback Effect - Fixed race condition and synchronization
    // Pauses when tab is hidden to save CPU
    useEffect(() => {
        if (isPlaying && isReplayMode) {
            stopReplay();

            // When playback starts, ensure we're showing only candles up to current index
            // Hide future candles immediately
            const currentIndex = replayIndexRef.current;
            if (currentIndex !== null) {
                updateReplayData(currentIndex, true); // true = hide future candles
            }

            const intervalMs = 1000 / replaySpeed; // 1x = 1 sec, 10x = 0.1 sec

            const startInterval = () => {
                if (replayIntervalRef.current) return; // Already running
                replayIntervalRef.current = setInterval(() => {
                    // Skip if tab is hidden - pause playback to save CPU
                    if (document.visibilityState === 'hidden') return;

                    // Use ref to get current value and avoid stale closures
                    const currentIndex = replayIndexRef.current;

                    if (currentIndex === null || currentIndex >= fullDataRef.current.length - 1) {
                        setIsPlaying(false);
                        isPlayingRef.current = false;
                        return;
                    }

                    const nextIndex = currentIndex + 1;

                    // Update state and data synchronously - always hide future candles during playback
                    setReplayIndex(nextIndex);
                    updateReplayData(nextIndex, true); // true = hide future candles
                }, intervalMs);
            };

            // Only start if tab is visible
            if (document.visibilityState !== 'hidden') {
                startInterval();
            }

            // Handle visibility changes - pause/resume playback
            const handleVisibilityChange = () => {
                if (document.visibilityState === 'hidden') {
                    stopReplay();
                } else if (isPlayingRef.current) {
                    startInterval();
                }
            };

            document.addEventListener('visibilitychange', handleVisibilityChange);

            return () => {
                stopReplay();
                document.removeEventListener('visibilitychange', handleVisibilityChange);
            };
        } else {
            stopReplay();
        }
        return () => stopReplay();
    }, [isPlaying, isReplayMode, replaySpeed, updateReplayData]);

    // Click Handler for Replay Mode - handles direct chart clicks to jump to a position
    // Uses chart.subscribeClick which provides accurate param.time
    // This is separate from the "Jump to Bar" (scissors) handler
    useEffect(() => {
        if (!chartRef.current || !isReplayMode || isSelectingReplayPoint || isPlaying) return;
        if (!mainSeriesRef.current) return;

        const handleReplayClick = (param) => {
            if (!param) return;
            if (!fullDataRef.current || fullDataRef.current.length === 0) return;
            // Skip if we're in selecting mode (handled by different handler)
            if (isSelectingReplayPoint) return;
            // Skip if we're playing (don't interrupt playback with clicks)
            if (isPlayingRef.current) return;

            try {
                let clickedTime = null;

                // Use param.time - this is the most accurate way to get time at click position
                if (param.time) {
                    clickedTime = param.time;
                } else if (param.point) {
                    // Fallback: use coordinate to get time
                    const timeScale = chartRef.current.timeScale();
                    clickedTime = timeScale.coordinateToTime(param.point.x);
                }

                if (!clickedTime) return;

                // DEBUG: Log the clicked time to verify it's correct


                // Find the closest candle in FULL data to the clicked time
                let clickedIndex = -1;
                let minDiff = Infinity;

                for (let i = 0; i < fullDataRef.current.length; i++) {
                    const diff = Math.abs(fullDataRef.current[i].time - clickedTime);
                    if (diff < minDiff) {
                        minDiff = diff;
                        clickedIndex = i;
                    }
                }

                // Fallback if no match found
                if (clickedIndex === -1) {
                    clickedIndex = fullDataRef.current.length - 1;
                }

                // Clamp to valid range
                clickedIndex = Math.max(0, Math.min(clickedIndex, fullDataRef.current.length - 1));

                // DEBUG: Log the found candle time


                // Store current visible range BEFORE updating data
                let currentVisibleRange = null;
                try {
                    const timeScale = chartRef.current.timeScale();
                    currentVisibleRange = timeScale.getVisibleRange();
                } catch (e) {
                    // Ignore
                }

                // Update replay to the clicked position
                setReplayIndex(clickedIndex);
                replayIndexRef.current = clickedIndex;
                updateReplayData(clickedIndex, true); // true = hide future candles

                // Restore visible range after data update to prevent view jumping
                if (currentVisibleRange && chartRef.current) {
                    setTimeout(() => {
                        if (mountedRef.current && chartRef.current) {
                            try {
                                const timeScale = chartRef.current.timeScale();
                                // Adjust the range to end at the clicked candle if needed
                                const clickedCandleTime = fullDataRef.current[clickedIndex]?.time;
                                if (clickedCandleTime && currentVisibleRange.to > clickedCandleTime) {
                                    // The current view extends beyond the clicked time, adjust it
                                    const rangeWidth = currentVisibleRange.to - currentVisibleRange.from;
                                    const newTo = clickedCandleTime;
                                    const newFrom = newTo - rangeWidth;
                                    timeScale.setVisibleRange({ from: newFrom, to: newTo });
                                } else {
                                    // Keep the current view
                                    timeScale.setVisibleRange(currentVisibleRange);
                                }
                            } catch (e) {
                                // Ignore
                            }
                        }
                    }, 0);
                }
            } catch (e) {
                logger.warn('Error handling replay click:', e);
            }
        };

        chartRef.current.subscribeClick(handleReplayClick);

        return () => {
            if (chartRef.current) {
                chartRef.current.unsubscribeClick(handleReplayClick);
            }
        };
    }, [isReplayMode, isSelectingReplayPoint, isPlaying, updateReplayData]);

    // Click Handler for "Jump to Bar" - TradingView style
    useEffect(() => {
        if (!chartRef.current || !isSelectingReplayPoint) return;
        if (!mainSeriesRef.current) return;

        // Chart click handler - param.time gives us the exact time at the clicked position
        const handleChartClick = (param) => {
            if (!param || !isSelectingReplayPoint) return;
            if (!fullDataRef.current || fullDataRef.current.length === 0) return;

            try {
                let clickedTime = null;

                // First try to use param.time (most accurate - exact time at click position)
                if (param.time) {
                    clickedTime = param.time;
                } else if (param.point) {
                    // Fallback: use coordinate to get time
                    const timeScale = chartRef.current.timeScale();
                    const x = param.point.x;
                    clickedTime = timeScale.coordinateToTime(x);
                }

                if (!clickedTime) return;

                // Find exact time match first (most accurate)
                let clickedIndex = fullDataRef.current.findIndex(d => d.time === clickedTime);

                // If no exact match, find the closest candle by time
                if (clickedIndex === -1) {
                    let minDiff = Infinity;
                    fullDataRef.current.forEach((d, i) => {
                        const diff = Math.abs(d.time - clickedTime);
                        if (diff < minDiff) {
                            minDiff = diff;
                            clickedIndex = i;
                        }
                    });
                }

                // Clamp to valid range
                clickedIndex = Math.max(0, Math.min(clickedIndex, fullDataRef.current.length - 1));

                if (clickedIndex >= 0 && clickedIndex < fullDataRef.current.length) {
                    // Store the selected index before updating
                    const selectedIndex = clickedIndex;

                    // Get current visible range BEFORE updating data to preserve zoom level
                    let currentVisibleRange = null;
                    let currentVisibleLogicalRange = null;
                    try {
                        const timeScale = chartRef.current.timeScale();
                        currentVisibleRange = timeScale.getVisibleRange();
                        currentVisibleLogicalRange = timeScale.getVisibleLogicalRange();
                    } catch (e) {
                        // Ignore
                    }

                    // Calculate the range width in time units to maintain zoom
                    let rangeWidth = null;
                    if (currentVisibleRange && currentVisibleRange.from && currentVisibleRange.to) {
                        rangeWidth = currentVisibleRange.to - currentVisibleRange.from;
                    }

                    setReplayIndex(selectedIndex);
                    replayIndexRef.current = selectedIndex;

                    // Calculate target visible range BEFORE updating data
                    const selectedTime = fullDataRef.current[selectedIndex]?.time;
                    let targetRange = null;

                    if (selectedTime && rangeWidth && rangeWidth > 0) {
                        // Calculate target range to maintain zoom
                        const newFrom = selectedTime - rangeWidth / 2;
                        const newTo = selectedTime + rangeWidth / 2;

                        const firstTime = fullDataRef.current[0]?.time;
                        const lastAvailableTime = fullDataRef.current[selectedIndex]?.time;

                        if (firstTime && lastAvailableTime) {
                            let adjustedFrom = Math.max(firstTime, newFrom);
                            let adjustedTo = Math.min(lastAvailableTime, newTo);

                            // Adjust boundaries while maintaining width
                            if (adjustedFrom === firstTime && adjustedTo < newTo) {
                                adjustedTo = Math.min(lastAvailableTime, adjustedFrom + rangeWidth);
                            } else if (adjustedTo === lastAvailableTime && adjustedFrom > newFrom) {
                                adjustedFrom = Math.max(firstTime, adjustedTo - rangeWidth);
                            }

                            if (adjustedTo > adjustedFrom && (adjustedTo - adjustedFrom) >= rangeWidth * 0.3) {
                                targetRange = { from: adjustedFrom, to: adjustedTo };
                            }
                        }
                    }

                    // If no target range calculated, use a default that doesn't zoom in
                    if (!targetRange && selectedTime) {
                        const startIndex = Math.max(0, selectedIndex - EXTENDED_VIEW_WINDOW / 2);
                        const endIndex = selectedIndex;
                        const startTime = fullDataRef.current[startIndex]?.time;
                        const endTime = fullDataRef.current[endIndex]?.time;
                        if (startTime && endTime) {
                            targetRange = { from: startTime, to: endTime };
                        }
                    }

                    // Update replay data
                    updateReplayData(selectedIndex, true, false);

                    setIsSelectingReplayPoint(false);
                    if (chartContainerRef.current) {
                        chartContainerRef.current.style.cursor = 'default';
                    }

                    // Immediately set visible range to prevent auto-zoom
                    // Set multiple times to ensure it sticks
                    if (targetRange && chartRef.current) {
                        try {
                            const timeScale = chartRef.current.timeScale();
                            // Set immediately
                            timeScale.setVisibleRange(targetRange);

                            // Set again after a short delay to override any auto-zoom
                            setTimeout(() => {
                                if (mountedRef.current && chartRef.current) {
                                    try {
                                        chartRef.current.timeScale().setVisibleRange(targetRange);
                                    } catch (e) {
                                        // Ignore
                                    }
                                }
                            }, 10);

                            // Set one more time after data update completes
                            setTimeout(() => {
                                if (mountedRef.current && chartRef.current) {
                                    try {
                                        chartRef.current.timeScale().setVisibleRange(targetRange);
                                    } catch (e) {
                                        // Ignore
                                    }
                                }
                            }, 100);
                        } catch (e) {
                            logger.warn('Failed to set visible range after selection:', e);
                        }
                    }
                }
            } catch (e) {
                logger.warn('Error handling chart click in Jump to Bar:', e);
            }
        };

        // Subscribe to chart clicks only (series don't have subscribeClick method)
        if (chartRef.current) {
            chartRef.current.subscribeClick(handleChartClick);
        }

        return () => {
            if (chartRef.current) {
                chartRef.current.unsubscribeClick(handleChartClick);
            }
        };
    }, [isSelectingReplayPoint, updateReplayData]);

    // Create stable hash of TPO settings for dependency tracking
    const tpoSettingsHash = useMemo(() => {
        const tpoIndicators = (indicators || []).filter(ind => ind.type === 'tpo');
        if (tpoIndicators.length === 0) return null;

        const tpoId = tpoIndicators[0].id;
        // Prefer local settings over indicator props
        const effectiveSettings = tpoLocalSettings[tpoId] || tpoIndicators[0].settings;

        const hash = JSON.stringify({
            visible: tpoIndicators[0].visible,
            settings: effectiveSettings
        });
        logger.debug('[TPO] Settings hash updated:', hash);
        return hash;
    }, [indicators, tpoLocalSettings]);

    // Handle TPO Indicator
    useEffect(() => {
        if (!chartRef.current || !mainSeriesRef.current || !dataRef.current) return;

        const tpoIndicators = (indicators || []).filter(ind => ind.type === 'tpo');

        // ALWAYS remove old TPO primitive first (fixes visibility toggle issue)
        if (tpoProfileRef.current && mainSeriesRef.current) {
            try {
                mainSeriesRef.current.detachPrimitive(tpoProfileRef.current);
            } catch (e) {
                logger.warn('[TPO] Error detaching primitive:', e);
            }
            tpoProfileRef.current = null;
        }

        // Only recreate TPO if it exists AND is visible
        if (tpoIndicators.length > 0 && dataRef.current.length > 0) {
            const tpoInd = tpoIndicators[0];
            const tpoId = tpoInd.id;

            // Prefer local settings over indicator props
            const effectiveSettings = tpoLocalSettings[tpoId] || tpoInd.settings || {};

            // Check if indicator is visible (default to true if not specified)
            const isVisible = tpoInd.visible !== false;

            // Skip creation if not visible (primitive already removed above)
            if (!isVisible) {
                logger.debug('[TPO] Indicator hidden, primitive removed');
                return;
            }

            try {
                const profiles = calculateTPO(dataRef.current, {
                    tickSize: effectiveSettings.tickSize || 'auto',
                    blockSize: effectiveSettings.blockSize || '30m',
                    sessionType: effectiveSettings.sessionType || 'daily',
                    sessionStart: effectiveSettings.sessionStart || '09:15',
                    sessionEnd: effectiveSettings.sessionEnd || '15:30',
                    valueAreaPercent: effectiveSettings.valueAreaPercent || 70,
                    allHours: effectiveSettings.allHours !== false,
                    timezone: effectiveSettings.timezone || 'Asia/Kolkata',
                    interval: interval
                });

                logger.debug('[TPO] Calculated profiles:', profiles.length, 'Settings:', effectiveSettings);

                const tpoPrimitive = new TPOProfilePrimitive({
                    visible: isVisible,
                    showLetters: effectiveSettings.showLetters !== false,
                    showPOC: effectiveSettings.showPOC !== false,
                    showValueArea: effectiveSettings.showValueArea !== false,
                    showVAH: effectiveSettings.showVAH !== false,
                    showVAL: effectiveSettings.showVAL !== false,
                    useGradientColors: effectiveSettings.useGradientColors !== false,
                });

                tpoPrimitive.setData(profiles);
                mainSeriesRef.current.attachPrimitive(tpoPrimitive);
                tpoProfileRef.current = tpoPrimitive;

                // Track type for cleanup (primitive-based indicator)
                if (tpoInd?.id) {
                    indicatorTypesMap.current.set(tpoInd.id, 'tpo');
                }

                logger.debug('[TPO] Primitive attached successfully');
            } catch (error) {
                logger.error('[TPO] Error rendering TPO:', error);
            }
        }
    }, [interval, symbol, exchange, tpoSettingsHash]);

    // Memoized active indicators for the legend (prevents recalculation on every render)
    const activeIndicatorsForLegend = React.useMemo(() => {
        if (!Array.isArray(indicators)) return [];

        return indicators.map(ind => {
            if (!ind) return null;
            const config = getIndicatorConfig(ind.type);
            // Get current value from state
            const val = indicatorValues[ind.id];

            // Build params string
            let params = '';
            if (ind.period) params += `${ind.period} `;
            // Add other common params
            if (ind.stdDev) params += `${ind.stdDev} `;
            if (ind.fast) params += `${ind.fast} `;
            if (ind.slow) params += `${ind.slow} `;
            if (ind.signal) params += `${ind.signal} `;
            if (ind.kPeriod) params += `${ind.kPeriod} `;
            if (ind.dPeriod) params += `${ind.dPeriod} `;
            if (ind.smooth) params += `${ind.smooth} `;
            // Hilenga-Milenga params
            if (ind.rsiLength) params += `${ind.rsiLength} `;
            if (ind.emaLength) params += `${ind.emaLength} `;
            if (ind.wmaLength) params += `${ind.wmaLength} `;

            if (ind.source && ind.source !== 'close') params += `${ind.source} `;

            // Special handling for Pivot Points - include type in name
            let indicatorName = config ? config.name : (ind.name || ind.type.toUpperCase());
            if (ind.type === 'pivotPoints' && ind.pivotType) {
                // Map pivot type values to display names
                const pivotTypeLabels = {
                    traditional: 'Traditional',
                    fibonacci: 'Fibonacci',
                    woodie: 'Woodie',
                    classic: 'Classic',
                    dm: 'DeMark',
                    camarilla: 'Camarilla'
                };
                const pivotTypeName = pivotTypeLabels[ind.pivotType] || (ind.pivotType.charAt(0).toUpperCase() + ind.pivotType.slice(1));
                indicatorName = `Pivot Points ${pivotTypeName}`;
            }

            // Special handling for Pivot Points values - format with labels and colors
            let formattedValue = val;
            let pivotColors = null;
            if (ind.type === 'pivotPoints' && val && typeof val === 'object') {
                pivotColors = {
                    pivot: ind.pivotColor || '#FF9800',
                    r1: ind.resistanceColor || '#EF5350',
                    r2: ind.resistanceColor || '#EF5350',
                    r3: ind.resistanceColor || '#EF5350',
                    s1: ind.supportColor || '#26A69A',
                    s2: ind.supportColor || '#26A69A',
                    s3: ind.supportColor || '#26A69A'
                };
                // Format as labeled object for IndicatorLegend to render
                formattedValue = {
                    _pivotLabeled: true,
                    colors: pivotColors,
                    values: val
                };
            }

            return {
                ...ind,
                name: indicatorName,
                params: params.trim(),
                value: formattedValue,
                color: ind.color || (config?.style?.[0]?.default) || '#2962FF',
                isHidden: ind.visible === false,
                pane: ind.pane || (config ? config.pane : 'main')
            };
        }).filter(Boolean);
    }, [indicators, indicatorValues]);

    // Check if any comparison uses the left price scale
    const hasLeftPriceScale = useMemo(() => {
        return comparisonSymbols.some(c => c.scaleMode === 'newPriceScale');
    }, [comparisonSymbols]);

    return (
        <div className={`${styles.chartWrapper} ${isToolbarVisible ? styles.toolbarVisible : ''}`} style={{ display: 'flex', flexDirection: 'column' }}>
            <div
                id="container"
                ref={chartContainerRef}
                className={styles.chartContainer}
                style={{
                    position: 'relative',
                    touchAction: 'none',
                    flex: '1 1 auto',
                    minHeight: 200,
                    // Adjust width and margin when toolbar is visible AND left price scale is used
                    // This prevents the left price scale from being hidden under the drawing toolbar
                    width: (isToolbarVisible && hasLeftPriceScale) ? 'calc(100% - 48px)' : '100%',
                    marginLeft: (isToolbarVisible && hasLeftPriceScale) ? '48px' : '0px',
                    transition: 'width 0.15s ease, margin-left 0.15s ease',
                }}
            />
            {isLoading && isActuallyLoadingRef.current && <div className={styles.loadingOverlay}><div className={styles.spinner}></div><div>Loading...</div></div>}

            {error && (
                <div className={styles.loadingOverlay}>
                    <div style={{ color: '#F23645', marginBottom: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚠️</div>
                        <b>Error Loading Data</b>
                        <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>{error}</div>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '6px 16px',
                            background: '#2962FF',
                            border: 'none',
                            borderRadius: '4px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '13px'
                        }}
                    >
                        Reload Page
                    </button>
                </div>
            )}

            {/* Symbol + OHLC Header Bar */}
            <OHLCHeader
                symbol={symbol}
                exchange={exchange}
                interval={interval}
                strategyConfig={strategyConfig}
                ohlcData={ohlcData}
                isToolbarVisible={isToolbarVisible}
                isLeftScaleVisible={comparisonSymbols.some(s => s.scaleMode === 'newPriceScale')}
            />

            {/* Comparison Symbol Floating Price Labels */}
            {Object.keys(comparisonPriceLabels).length > 0 && (
                <div className={styles.comparisonPriceLabels}>
                    {Object.entries(comparisonPriceLabels).map(([key, data]: [string, any]) => {
                        // User requested to remove newPriceScale labels
                        if (data.scaleMode === 'newPriceScale') return null;

                        const isLeftScale = false; // Always right/overlay if not newPriceScale
                        const formattedPrice = data.price != null ? formatCurrency(data.price, { showSymbol: false, decimals: 2 }) : '0.00';

                        return (
                            <div
                                key={key}
                                className={`${styles.comparisonPriceLabel} ${isLeftScale ? styles.comparisonPriceLabelLeft : ''}`}
                                style={{
                                    top: data.y,
                                    // For left scale labels, account for toolbar
                                    ...(isLeftScale && isToolbarVisible ? { left: '48px' } : {})
                                }}
                            >
                                <span
                                    className={styles.comparisonPriceLabelSymbol}
                                    style={{ backgroundColor: data.color }}
                                >
                                    {data.symbol}
                                </span>
                                <span
                                    className={styles.comparisonPriceLabelPrice}
                                    style={{ backgroundColor: data.color }}
                                >
                                    {formattedPrice}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}


            {/* Indicator Legend - Using reusable component */}
            <IndicatorLegend
                indicators={activeIndicatorsForLegend}
                panePositions={panePositions}
                isToolbarVisible={isToolbarVisible}
                isCollapsed={indicatorDropdownOpen}
                onToggleCollapse={() => setIndicatorDropdownOpen(prev => !prev)}
                onVisibilityToggle={onIndicatorVisibilityToggle}
                onRemove={onIndicatorRemove}
                onSettings={(indicatorType) => setIndicatorSettingsOpen(indicatorType)}
                onPaneMenu={handlePaneMenu}
                maximizedPane={maximizedPane}
                onAddAlert={onOpenIndicatorAlert}
            />

            {/* Pane Context Menu - TradingView style */}
            <PaneContextMenu
                show={paneContextMenu.show}
                x={paneContextMenu.x}
                y={paneContextMenu.y}
                paneId={paneContextMenu.paneId}
                isMaximized={maximizedPane === paneContextMenu.paneId}
                isCollapsed={collapsedPanes.has(paneContextMenu.paneId)}
                canMoveUp={canPaneMoveUp(paneContextMenu.paneId)}
                onMaximize={handleMaximizePane}
                onCollapse={handleCollapsePane}
                onMoveUp={handleMovePaneUp}
                onDelete={handleDeletePane}
                onClose={closePaneMenu}
                theme={theme as any}
            />

            {/* Per-Indicator Settings Dialog */}
            {(() => {
                const activeInd = indicatorSettingsOpen && Array.isArray(indicators)
                    ? indicators.find(i => i.id === indicatorSettingsOpen)
                    : null;



                return (
                    <IndicatorSettingsDialog
                        isOpen={!!indicatorSettingsOpen}
                        onClose={() => setIndicatorSettingsOpen(null)}
                        indicatorType={activeInd ? activeInd.type : null}
                        settings={activeInd || {}}
                        onSave={(newSettings) => {
                            logger.debug('[Settings] Dialog onSave called:', { indicatorSettingsOpen, newSettings, hasCallback: !!onIndicatorSettings });

                            // Store TPO settings locally (workaround for broken parent callback)
                            const activeInd = indicators?.find(i => i.id === indicatorSettingsOpen);
                            if (activeInd?.type === 'tpo') {
                                setTpoLocalSettings(prev => ({
                                    ...prev,
                                    [indicatorSettingsOpen]: newSettings
                                }));
                                logger.debug('[TPO] Stored settings locally:', newSettings);
                            }

                            // Also call parent callback
                            if (onIndicatorSettings && indicatorSettingsOpen) {
                                logger.debug('[Settings] Calling parent onIndicatorSettings with:', indicatorSettingsOpen, newSettings);
                                onIndicatorSettings(indicatorSettingsOpen, newSettings);
                            } else {
                                logger.warn('[Settings] Parent callback not available:', { onIndicatorSettings: !!onIndicatorSettings, indicatorSettingsOpen });
                            }
                        }}
                        theme={theme as any}
                        // For Pine indicators, generate dynamic config from pineInputs
                        dynamicConfig={activeInd?.type === 'pine' && activeInd?.pineInputs ? {
                            name: activeInd.name || 'Pine Script',
                            fullName: activeInd.name || 'Pine Script Indicator',
                            pane: activeInd.pane || 'pine_indicator',
                            inputs: (activeInd.pineInputs || []).map((input: any) => ({
                                key: input.name,
                                label: input.title || input.name,
                                type: input.type === 'int' || input.type === 'float' ? 'number' :
                                      input.type === 'bool' ? 'boolean' :
                                      input.type === 'color' ? 'color' :
                                      input.type === 'string' || input.type === 'source' ? 'select' : 'text',
                                default: input.default,
                                min: input.minval,
                                max: input.maxval,
                                step: input.step || (input.type === 'float' ? 0.1 : 1),
                                options: input.options || (input.type === 'source' ? ['close', 'open', 'high', 'low', 'hl2', 'hlc3', 'ohlc4'] : undefined),
                            })),
                            style: [
                                { key: 'pineColor', label: 'Line Color', type: 'color', default: '#2962FF' },
                                { key: 'pineLineWidth', label: 'Line Width', type: 'number', min: 1, max: 5, default: 2 },
                            ],
                        } : undefined}
                    />
                );
            })()}

            {/* Shift+Click Quick Measure Overlay */}
            <MeasureOverlay measureData={measureData} />

            {isReplayMode && (
                <ReplayControls
                    isPlaying={isPlaying}
                    speed={replaySpeed}
                    onPlayPause={handleReplayPlayPause}
                    onForward={handleReplayForward}
                    onJumpTo={handleReplayJumpTo}
                    onSpeedChange={setReplaySpeed}
                    onClose={() => {
                        setIsReplayMode(false);
                        // Notify parent about replay mode change
                        if (onReplayModeChange) {
                            onReplayModeChange(false);
                        }
                        // Restore full data
                        if (mainSeriesRef.current && fullDataRef.current.length > 0) {
                            dataRef.current = fullDataRef.current;
                            const transformedData = transformData(fullDataRef.current, chartTypeRef.current);
                            mainSeriesRef.current.setData(transformedData);
                            updateIndicators(fullDataRef.current, indicators);
                        }
                    }}
                />
            )}

            {/* Replay Slider */}
            {isReplayMode && (
                <ReplaySlider
                    chartRef={chartRef}
                    isReplayMode={isReplayMode}
                    replayIndex={replayIndex}
                    fullData={fullDataRef.current}
                    onSliderChange={handleSliderChange}
                    containerRef={chartContainerRef}
                    isSelectingReplayPoint={isSelectingReplayPoint}
                    isPlaying={isPlaying}
                />
            )}


            {/* Price Scale Context Menu */}
            <PriceScaleMenu
                visible={priceScaleMenu.visible}
                x={priceScaleMenu.x}
                y={priceScaleMenu.y}
                price={priceScaleMenu.price}
                symbol={symbol}
                ltp={dataRef.current?.length > 0 ? dataRef.current[dataRef.current.length - 1]?.close : null}
                onAddAlert={() => {
                    const manager = lineToolManagerRef.current;
                    const userAlerts = manager && manager._userPriceAlerts;
                    if (userAlerts && priceScaleMenu.price != null) {
                        userAlerts.addAlertWithCondition(priceScaleMenu.price, 'crossing');
                    }
                }}
                onPlaceSellOrder={(price, orderType) => {
                    // Open trading panel with SELL pre-filled
                    if (onOpenTradingPanel && priceScaleMenu.price != null) {
                        onOpenTradingPanel('SELL', priceScaleMenu.price, orderType || 'LIMIT');
                    }
                }}
                onPlaceBuyOrder={(price, orderType) => {
                    // Open trading panel with BUY pre-filled
                    if (onOpenTradingPanel && priceScaleMenu.price != null) {
                        onOpenTradingPanel('BUY', priceScaleMenu.price, orderType || 'LIMIT');
                    }
                }}
                onAddOrder={(price) => {
                    // Open trading panel with default settings at price
                    if (onOpenTradingPanel && priceScaleMenu.price != null) {
                        onOpenTradingPanel('BUY', priceScaleMenu.price, 'LIMIT', true);
                    }
                }}
                onDrawHorizontalLine={() => {
                    const manager = lineToolManagerRef.current;
                    if (manager && priceScaleMenu.price != null) {
                        // Create horizontal line directly at the clicked price
                        manager.createHorizontalLineAtPrice(priceScaleMenu.price);
                        // Notify parent that a tool is being used
                        if (onToolUsed) onToolUsed();
                    }
                }}
                onClose={() => setPriceScaleMenu({ visible: false, x: 0, y: 0, price: null })}
            />

            {/* Price Scale Right-Click Context Menu (TradingView-style scale options) */}
            <PriceScaleContextMenu
                visible={priceScaleContextMenu.visible}
                x={priceScaleContextMenu.x}
                y={priceScaleContextMenu.y}
                priceScaleId={priceScaleContextMenu.priceScaleId}
                autoScale={priceScaleSettings.autoScale}
                scalePriceChartOnly={priceScaleSettings.scalePriceChartOnly}
                invertScale={priceScaleSettings.invertScale}
                scaleMode={priceScaleSettings.scaleMode}
                plusButtonVisible={priceScaleSettings.plusButtonVisible}
                onAutoScaleChange={handleAutoScaleChange}
                onScalePriceChartOnlyChange={(value) =>
                    setPriceScaleSettings(prev => ({ ...prev, scalePriceChartOnly: value }))
                }
                onInvertScaleChange={handleInvertScaleChange}
                onScaleModeChange={handleScaleModeChange}
                onPlusButtonChange={(value) =>
                    setPriceScaleSettings(prev => ({ ...prev, plusButtonVisible: value }))
                }
                onMergeScales={(type) => {
                    // TODO: Implement merge scales functionality
                    logger.debug('Merge scales:', type);
                }}
                onOpenSettings={onOpenSettings}
                onClose={() => setPriceScaleContextMenu({ visible: false, x: 0, y: 0, priceScaleId: '' })}
            />

            {/* Right-click Context Menu */}
            <ChartContextMenu
                show={contextMenu.show}
                x={contextMenu.x}
                y={contextMenu.y}
                orderId={contextMenu.orderId}
                symbol={symbol}
                exchange={exchange}
                price={contextMenu.price}
                ltp={dataRef.current?.length > 0 ? dataRef.current[dataRef.current.length - 1]?.close : null}
                indicatorCount={indicators?.length || 0}
                isVerticalCursorLocked={isVerticalCursorLocked}
                onCancelOrder={onCancelOrder}
                onOpenOptionChain={onOpenOptionChain}
                onResetChartView={() => {
                    // Reset chart to default view
                    applyDefaultCandlePosition(dataRef.current?.length || 0);
                }}
                onCopyPrice={(price) => {
                    // Price is copied in the component, just a notification hook
                    logger.debug('Price copied:', price);
                }}
                onAddAlert={(price) => {
                    // Add alert at the clicked price
                    if (lineToolManagerRef.current) {
                        const userAlerts = lineToolManagerRef.current._userPriceAlerts;
                        if (userAlerts && typeof userAlerts.addAlertWithCondition === 'function') {
                            userAlerts.addAlertWithCondition(price, 'crossing');
                        }
                    }
                }}
                onPlaceSellOrder={(price, orderType) => {
                    // Open trading panel with SELL pre-filled
                    if (onOpenTradingPanel) {
                        onOpenTradingPanel('SELL', price, orderType || 'LIMIT');
                    }
                }}
                onPlaceBuyOrder={(price, orderType) => {
                    // Open trading panel with BUY pre-filled
                    if (onOpenTradingPanel) {
                        onOpenTradingPanel('BUY', price, orderType || 'LIMIT');
                    }
                }}
                onAddOrder={(price) => {
                    // Open trading panel with default settings at price
                    if (onOpenTradingPanel) {
                        onOpenTradingPanel('BUY', price, 'LIMIT', true);
                    }
                }}
                onToggleCursorLock={() => {
                    setIsVerticalCursorLocked(prev => !prev);
                    // TODO: Implement actual crosshair lock functionality
                }}
                onOpenObjectTree={() => {
                    if (onOpenObjectTree) {
                        onOpenObjectTree();
                    }
                }}
                onRemoveIndicator={() => {
                    // Remove ALL indicators (since menu says "Remove X indicators")
                    if (indicators?.length > 0 && onIndicatorRemove) {
                        // Remove each indicator
                        indicators.forEach(indicator => {
                            onIndicatorRemove(indicator.id);
                        });
                    }
                }}
                onOpenSettings={() => {
                    if (onOpenSettings) {
                        onOpenSettings();
                    }
                }}
                onClose={() => setContextMenu({ show: false, x: 0, y: 0, price: null, orderId: null })}
            />

            {/* Risk Calculator Panel */}
            {(() => {
                const riskCalcInd = indicators?.find(ind => ind.type === 'riskCalculator');
                const shouldShow = riskCalcInd && riskCalcInd.visible !== false && (riskCalcInd.showPanel !== false);

                if (!shouldShow || !riskCalculatorResults) return null;

                // Get current LTP for "Use LTP" button
                const currentLTP = dataRef.current.length > 0 ? dataRef.current[dataRef.current.length - 1]?.close : 0;

                return (
                    <RiskCalculatorPanel
                        results={riskCalculatorResults}
                        params={{
                            capital: riskCalcInd.capital || 100000,
                            riskPercent: riskCalcInd.riskPercent || 2,
                            entryPrice: riskCalcInd.entryPrice || 0,
                            stopLossPrice: riskCalcInd.stopLossPrice || 0,
                            targetPrice: riskCalcInd.targetPrice || 0,
                            riskRewardRatio: riskCalcInd.riskRewardRatio || 2,
                            side: riskCalcInd.side || 'BUY',
                            showTarget: riskCalcInd.showTarget !== false
                        }}
                        onClose={() => {
                            // Toggle off the showPanel setting
                            if (onIndicatorSettings && riskCalcInd.id) {
                                onIndicatorSettings(riskCalcInd.id, { ...riskCalcInd, showPanel: false });
                            }
                        }}
                        onUpdateSettings={(updates) => {
                            // Update indicator settings when values change in panel
                            if (onIndicatorSettings && riskCalcInd.id) {
                                onIndicatorSettings(riskCalcInd.id, updates);
                            }
                        }}
                        ltp={currentLTP}
                        draggable={true}
                    />
                );
            })()}

        </div >

    );
});

export default ChartComponent;
