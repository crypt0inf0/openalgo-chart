import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback, useMemo } from 'react';
import {
    createChart,
    CandlestickSeries,
    BarSeries,
    LineSeries,
    AreaSeries,
    BaselineSeries,
    HistogramSeries
} from 'lightweight-charts';
import styles from './ChartComponent.module.css';
import IndicatorLegend from './IndicatorLegend';
import IndicatorSettingsDialog from '../IndicatorSettings/IndicatorSettingsDialog';
import { getIndicatorConfig } from '../IndicatorSettings/indicatorConfigs';
import { getKlines, getHistoricalKlines, subscribeToTicker, saveDrawings, loadDrawings } from '../../services/openalgo';
import { combinePremiumOHLC, combineMultiLegOHLC } from '../../services/optionChain';
import { getAccurateISTTimestamp, syncTimeWithAPI, shouldResync } from '../../services/timeService';
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
    calculateSupertrend
} from '../../utils/indicators';
import { calculateTPO } from '../../utils/indicators/tpo';
import { calculateFirstCandle } from '../../utils/indicators/firstCandle';
import { calculatePriceActionRange } from '../../utils/indicators/priceActionRange';
import { TPOProfilePrimitive } from '../../plugins/tpo-profile/TPOProfilePrimitive';
import { calculateHeikinAshi } from '../../utils/chartUtils';
import { calculateRenko } from '../../utils/renkoUtils';
import { intervalToSeconds } from '../../utils/timeframes';
import { logger } from '../../utils/logger.js';

import { LineToolManager } from '../../plugins/line-tools/line-tool-manager';
import { PriceScaleTimer } from '../../plugins/line-tools/tools/price-scale-timer';
import '../../plugins/line-tools/floating-toolbar.css';
import ReplayControls from '../Replay/ReplayControls';
import ReplaySlider from '../Replay/ReplaySlider';
import PriceScaleMenu from './PriceScaleMenu';
import { VisualTrading } from '../../plugins/visual-trading/visual-trading';

const TOOL_MAP = {
    'cursor': 'None',
    'eraser': 'Eraser',
    'trendline': 'TrendLine',
    'arrow': 'Arrow',
    'ray': 'Ray',
    'extended_line': 'ExtendedLine',
    'horizontal': 'HorizontalLine',
    'horizontal_ray': 'HorizontalRay',
    'vertical': 'VerticalLine',
    'cross_line': 'CrossLine',
    'parallel_channel': 'ParallelChannel',
    'fibonacci': 'FibRetracement',
    'fib_extension': 'FibExtension',
    'pitchfork': 'Pitchfork',
    'brush': 'Brush',
    'highlighter': 'Highlighter',
    'rectangle': 'Rectangle',
    'circle': 'Circle',
    'arc': 'Arc',
    'path': 'Path',
    'text': 'Text',
    'callout': 'Callout',
    'price_label': 'PriceLabel',
    'pattern': 'Pattern',
    'triangle': 'Triangle',
    'abcd': 'ABCD',
    'xabcd': 'XABCD',
    'elliott_impulse': 'ElliottImpulseWave',
    'elliott_correction': 'ElliottCorrectionWave',
    'head_and_shoulders': 'HeadAndShoulders',
    'prediction': 'LongPosition',
    'prediction_short': 'ShortPosition',
    'date_range': 'DateRange',
    'price_range': 'PriceRange',
    'date_price_range': 'DatePriceRange',
    'measure': 'Measure',
    'zoom_in': 'None', // Zoom handled separately via click handler
    'zoom_out': 'None', // Zoom handled separately via click handler
    'remove': 'None'
};

// Helper to convert hex color to rgba
const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const ChartComponent = forwardRef(({
    symbol,
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
    comparisonSymbols = [],
    onAlertsSync,
    onAlertTriggered,
    onReplayModeChange,
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
    oiLines = null, // { maxCallOI, maxPutOI, maxPain } - OI levels to display as price lines
    showOILines = false, // Whether to show OI lines
    orders = [],
    positions = [],
    onModifyOrder,
    onCancelOrder
}, ref) => {
    const chartContainerRef = useRef();
    const [isLoading, setIsLoading] = useState(true);
    const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0 });
    const [priceScaleMenu, setPriceScaleMenu] = useState({ visible: false, x: 0, y: 0, price: null });
    const [indicatorSettingsOpen, setIndicatorSettingsOpen] = useState(null); // which indicator's settings are open
    const [indicatorValues, setIndicatorValues] = useState({}); // Current value under cursor for each indicator { id: value }

    // Close context menu on click outside
    useEffect(() => {
        if (!contextMenu.show) return;
        const handleClickAway = () => setContextMenu({ show: false, x: 0, y: 0 });
        document.addEventListener('click', handleClickAway);
        return () => document.removeEventListener('click', handleClickAway);
    }, [contextMenu.show]);

    const isActuallyLoadingRef = useRef(true); // Track if we're actually loading data (not just updating indicators) - start as true on mount
    const chartRef = useRef(null);
    const mainSeriesRef = useRef(null);

    // Unified Indicator Maps for Multi-Instance Support
    const indicatorSeriesMap = useRef(new Map()); // Map<id, Series | Object>
    const indicatorPanesMap = useRef(new Map());  // Map<id, Pane | Object>

    // Keeping these for now if used by specific legacy logic, but goal is to move to maps
    // Integrated indicator series refs (displayed within main chart)
    const volumeSeriesRef = useRef(null); // Volume might remain special or move to map

    const chartReadyRef = useRef(false); // Track when chart is fully stable and ready for indicator additions
    const lineToolManagerRef = useRef(null);
    const priceScaleTimerRef = useRef(null); // Ref for the candle countdown timer
    const tpoProfileRef = useRef(null); // Ref for TPO Profile primitive
    const oiPriceLinesRef = useRef({ maxCallOI: null, maxPutOI: null, maxPain: null }); // Refs for OI price lines
    const firstCandleSeriesRef = useRef([]); // Array of line series for all days' high/low
    const priceActionRangeSeriesRef = useRef([]); // Array of line series for PAR support/resistance
    const wsRef = useRef(null);
    const chartTypeRef = useRef(chartType);
    const dataRef = useRef([]);
    const comparisonSeriesRefs = useRef(new Map());
    const visualTradingRef = useRef(null);

    // Multi-leg strategy mode refs
    const strategyWsRefs = useRef({}); // Map: legId -> WebSocket
    const strategyDataRef = useRef({}); // Map: legId -> data array
    const strategyLatestRef = useRef({}); // Map: legId -> latest price

    // Replay State
    const [isReplayMode, setIsReplayMode] = useState(false);
    const isReplayModeRef = useRef(false); // Ref to track replay mode in callbacks
    useEffect(() => { isReplayModeRef.current = isReplayMode; }, [isReplayMode]);

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

    // Keep refs in sync with props
    useEffect(() => { symbolRef.current = symbol; }, [symbol]);
    useEffect(() => { exchangeRef.current = exchange; }, [exchange]);
    useEffect(() => { intervalRef.current = interval; }, [interval]);
    useEffect(() => { indicatorsRef.current = indicators; }, [indicators]);
    useEffect(() => { isSessionBreakVisibleRef.current = isSessionBreakVisible; }, [isSessionBreakVisible]);

    // Track previous symbol for alert persistence
    const prevSymbolRef = useRef({ symbol: null, exchange: null });

    // === Alert Persistence Helpers ===
    // Use separate key from App.jsx which uses 'tv_alerts' with different format
    const CHART_ALERTS_STORAGE_KEY = 'tv_chart_alerts';

    /**
     * Save alerts for a symbol to localStorage
     */
    const saveAlertsForSymbol = useCallback((sym, exch, alerts) => {
        if (!sym || !alerts) return;
        try {
            const key = `${sym}:${exch || 'NSE'}`;
            const stored = JSON.parse(localStorage.getItem(CHART_ALERTS_STORAGE_KEY) || '{}');
            stored[key] = alerts;
            localStorage.setItem(CHART_ALERTS_STORAGE_KEY, JSON.stringify(stored));
            console.log('[Alerts] Saved', alerts.length, 'alerts for', key, alerts);
        } catch (err) {
            console.warn('[Alerts] Failed to save alerts:', err);
        }
    }, []);

    /**
     * Load alerts for a symbol from localStorage
     */
    const loadAlertsForSymbol = useCallback((sym, exch) => {
        if (!sym) return [];
        try {
            const key = `${sym}:${exch || 'NSE'}`;
            const stored = JSON.parse(localStorage.getItem(CHART_ALERTS_STORAGE_KEY) || '{}');
            const alerts = stored[key] || [];
            console.log('[Alerts] Loaded', alerts.length, 'alerts for', key, alerts);
            return alerts;
        } catch (err) {
            console.warn('[Alerts] Failed to load alerts:', err);
            return [];
        }
    }, []);

    // Sync interval changes with LineToolManager for drawing visibility filtering
    useEffect(() => {
        if (lineToolManagerRef.current && interval) {
            const seconds = intervalToSeconds(interval);
            if (typeof lineToolManagerRef.current.setCurrentInterval === 'function') {
                lineToolManagerRef.current.setCurrentInterval(seconds);
            }
        }
    }, [interval]);

    // ============================================
    // CONFIGURABLE CHART CONSTANTS
    // ============================================
    const DEFAULT_CANDLE_WINDOW = 235;        // Fixed number of candles to show
    const DEFAULT_RIGHT_OFFSET = 50;           // Right margin in candle units (~50 for TradingView-like future time display)
    const PREFETCH_THRESHOLD = 126;            // Candles from oldest before prefetching
    const MIN_CANDLES_FOR_SCROLL_BACK = 50;   // Minimum candles before enabling scroll-back
    const FUTURE_TIME_CANDLES = 120;           // Number of future candles to display time labels for

    // Helper: Generate whitespace points for future time display
    // Whitespace points are data objects with only 'time' property (no price data)
    // This allows lightweight-charts to render future time labels on the axis
    const addFutureWhitespacePoints = useCallback((data, intervalSeconds) => {
        if (!data || data.length === 0 || !Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
            return data;
        }

        const lastCandle = data[data.length - 1];
        const lastTime = lastCandle.time;
        const whitespacePoints = [];

        for (let i = 1; i <= FUTURE_TIME_CANDLES; i++) {
            whitespacePoints.push({
                time: lastTime + (i * intervalSeconds)
            });
        }

        return [...data, ...whitespacePoints];
    }, []);

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
            console.warn('Failed to apply default candle position', err);
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
                console.warn('Failed to add price alert to chart', err);
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
                console.warn('Failed to remove price alert from chart', err);
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
                console.warn('Failed to restart price alert on chart', err);
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
                    console.warn('Failed to apply drawing options:', err);
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
                    console.warn('Failed to update default tool options:', err);
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
                        if (updateReplayDataRef.current) {
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
                            console.warn('Error removing faded series:', e);
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
                    setTimeout(() => onReplayModeChange(newMode), 0);
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
            console.warn('Failed to zoom chart', err);
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
                console.warn('Error updating pane positions:', e);
            }
        };

        // Run update after delay to ensure chart is fully rendered
        const timer = setTimeout(updatePanePositions, 500);

        // Also observe for DOM changes
        const observer = new MutationObserver(() => {
            setTimeout(updatePanePositions, 100);
        });

        observer.observe(chartContainerRef.current, {
            childList: true,
            subtree: true
        });

        // Update on resize
        const resizeObserver = new ResizeObserver(() => {
            setTimeout(updatePanePositions, 50);
        });
        resizeObserver.observe(chartContainerRef.current);

        return () => {
            clearTimeout(timer);
            observer.disconnect();
            resizeObserver.disconnect();
        };
    }, [indicators]);



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

                        const uniqueDates = new Set();
                        data.forEach(candle => {
                            const date = new Date(candle.time * 1000);
                            const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
                            uniqueDates.add(dateStr);
                        });

                        // Fetch session boundaries for each unique date
                        const sessionStartTimes = new Map();
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
                        console.warn('[ChartComponent] Could not fetch session data, using fallback detection:', err);
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

    // Shift+Click Quick Measure Tool - chart click handler
    useEffect(() => {
        if (!chartRef.current || !mainSeriesRef.current) return;

        const formatTimeDiff = (ms) => {
            const seconds = Math.floor(ms / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            if (days > 0) return `${days}d ${hours % 24}h`;
            if (hours > 0) return `${hours}h ${minutes % 60}m`;
            if (minutes > 0) return `${minutes}m`;
            return `${seconds}s`;
        };

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
                const timeDiffMs = Math.abs(endTime - startTime);
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
            console.error('Error in updateAxisLabel:', err);
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

    // RAF Loop for smooth updates - pauses when not visible to save CPU/battery
    useEffect(() => {
        let animationFrameId;
        let isRunning = true;

        const animate = () => {
            if (!isRunning) return;

            if (isChartVisibleRef.current && document.visibilityState !== 'hidden') {
                updateAxisLabel();
                animationFrameId = requestAnimationFrame(animate);
            }
            // Don't schedule next frame if not visible - will resume on visibility change
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && isChartVisibleRef.current && isRunning) {
                // Resume animation when tab becomes visible again
                animationFrameId = requestAnimationFrame(animate);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        animationFrameId = requestAnimationFrame(animate);

        return () => {
            isRunning = false;
            cancelAnimationFrame(animationFrameId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [updateAxisLabel]);



    // Helper to transform OHLC data based on chart type
    const transformData = (data, type) => {
        if (!data || data.length === 0) return [];

        switch (type) {
            case 'line':
            case 'area':
            case 'baseline':
                return data.map(d => ({ time: d.time, value: d.close }));
            case 'heikin-ashi':
                return calculateHeikinAshi(data);
            case 'renko':
                return calculateRenko(data);
            default:
                return data;
        }
    };

    // Create appropriate series based on chart type
    const createSeries = (chart, type, title = '') => {
        const commonOptions = { lastValueVisible: true, priceScaleId: 'right', title: title };

        // Use appearance colors or defaults
        const upColor = chartAppearance.candleUpColor || '#089981';
        const downColor = chartAppearance.candleDownColor || '#F23645';
        const wickUpColor = chartAppearance.wickUpColor || upColor;
        const wickDownColor = chartAppearance.wickDownColor || downColor;

        switch (type) {
            case 'candlestick':
                return chart.addSeries(CandlestickSeries, {
                    ...commonOptions,
                    upColor,
                    downColor,
                    borderVisible: false,
                    wickUpColor,
                    wickDownColor,
                });
            case 'bar':
                return chart.addSeries(BarSeries, {
                    ...commonOptions,
                    upColor,
                    downColor,
                    thinBars: false,
                });
            case 'hollow-candlestick':
                return chart.addSeries(CandlestickSeries, {
                    ...commonOptions,
                    upColor: 'transparent',
                    downColor,
                    borderUpColor: upColor,
                    borderDownColor: downColor,
                    wickUpColor,
                    wickDownColor,
                });
            case 'line':
                return chart.addSeries(LineSeries, {
                    ...commonOptions,
                    color: '#2962FF',
                    lineWidth: 2,
                });
            case 'area':
                return chart.addSeries(AreaSeries, {
                    ...commonOptions,
                    topColor: 'rgba(41, 98, 255, 0.4)',
                    bottomColor: 'rgba(41, 98, 255, 0.0)',
                    lineColor: '#2962FF',
                    lineWidth: 2,
                });
            case 'baseline':
                return chart.addSeries(BaselineSeries, {
                    ...commonOptions,
                    topLineColor: upColor,
                    topFillColor1: hexToRgba(upColor, 0.28),
                    topFillColor2: hexToRgba(upColor, 0.05),
                    bottomLineColor: downColor,
                    bottomFillColor1: hexToRgba(downColor, 0.05),
                    bottomFillColor2: hexToRgba(downColor, 0.28),
                });
            case 'heikin-ashi':
                return chart.addSeries(CandlestickSeries, {
                    ...commonOptions,
                    upColor,
                    downColor,
                    borderVisible: false,
                    wickUpColor,
                    wickDownColor,
                });
            case 'renko':
                // Renko bricks don't have wicks, so we hide them by matching body colors
                return chart.addSeries(CandlestickSeries, {
                    ...commonOptions,
                    upColor,
                    downColor,
                    borderVisible: false,
                    wickUpColor: upColor,
                    wickDownColor: downColor,
                });
            default:
                return chart.addSeries(CandlestickSeries, {
                    ...commonOptions,
                    upColor,
                    downColor,
                    borderVisible: false,
                    wickUpColor,
                    wickDownColor,
                });
        }
    };

    // Keep track of active tool for the wrapper
    const activeToolRef = useRef(activeTool);
    useEffect(() => {
        activeToolRef.current = activeTool;
    }, [activeTool]);

    // Initialize LineToolManager when series is ready
    const initializeLineTools = (series) => {
        if (!lineToolManagerRef.current) {
            const manager = new LineToolManager();

            // Wrap startTool to detect when tool is cancelled/finished
            const originalStartTool = manager.startTool.bind(manager);
            manager.startTool = (tool) => {

                originalStartTool(tool);

                // If tool is None, it means we are back to cursor mode
                // But don't trigger onToolUsed for zoom tools since they handle their own state
                const isZoomTool = activeToolRef.current === 'zoom_in' || activeToolRef.current === 'zoom_out';
                if ((tool === 'None' || tool === null) && activeToolRef.current !== null && activeToolRef.current !== 'cursor' && !isZoomTool) {

                    if (onToolUsed) onToolUsed();
                }
            };

            series.attachPrimitive(manager);
            lineToolManagerRef.current = manager;

            // Enable session highlighting if the setting is active
            // This ensures session breaks appear immediately when switching symbols
            if (isSessionBreakVisibleRef.current && typeof manager.enableSessionHighlighting === 'function') {
                console.log('[ChartComponent] Enabling session highlighting on new manager');
                manager.enableSessionHighlighting();
            }

            // Ensure alerts primitive (if present) knows the current symbol
            try {
                // Set symbol on the manager itself for alert notifications
                // This will also propagate to UserPriceAlerts internally
                if (typeof manager.setSymbolName === 'function') {
                    manager.setSymbolName(symbol, exchange);
                }

                const userAlerts = manager._userPriceAlerts;
                // Bridge internal alert list out to React so the Alerts tab
                // can show alerts created from the chart-side UI.
                if (userAlerts && typeof userAlerts.alertsChanged === 'function' && typeof userAlerts.alerts === 'function' && typeof onAlertsSync === 'function') {
                    userAlerts.alertsChanged().subscribe(() => {
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
                                saveAlertsForSymbol(symbolRef.current, exchangeRef.current, alertsToSave);

                                // GlobalAlertMonitor refresh disabled - conflicts with watchlist WebSocket
                            }
                        } catch (err) {
                            console.warn('Failed to sync chart alerts to app', err);
                        }
                    }, manager);
                }

                // Also bridge trigger events so the app can mark alerts as Triggered
                // and write log entries when the internal primitive fires.
                if (userAlerts && typeof userAlerts.alertTriggered === 'function' && typeof onAlertTriggered === 'function') {
                    userAlerts.alertTriggered().subscribe((evt) => {
                        try {
                            onAlertTriggered({
                                externalId: evt.alertId,
                                price: evt.alertPrice,
                                timestamp: evt.timestamp,
                                direction: evt.direction,
                                condition: evt.condition,
                            });
                        } catch (err) {
                            console.warn('Failed to propagate alertTriggered event to app', err);
                        }
                    }, manager);
                }

                // Subscribe to price scale + button clicks to show context menu
                if (userAlerts && typeof userAlerts.priceScaleClicked === 'function') {
                    userAlerts.priceScaleClicked().subscribe((evt) => {
                        try {
                            setPriceScaleMenu({
                                visible: true,
                                x: evt.x,
                                y: evt.y,
                                price: evt.price
                            });
                        } catch (err) {
                            console.warn('Failed to show price scale menu', err);
                        }
                    }, manager);
                }
            } catch (err) {
                console.warn('Failed to initialize alert symbol name', err);
            }

            window.lineToolManager = manager;
            window.chartInstance = chartRef.current;
            window.seriesInstance = series;

            // Load saved drawings from backend
            const loadSavedDrawings = async () => {
                console.log('[ChartComponent] loadSavedDrawings called for:', symbol, exchange, interval);
                try {
                    const drawings = await loadDrawings(symbol, exchange, interval);
                    console.log('[ChartComponent] loadDrawings result:', drawings);
                    if (drawings && drawings.length > 0 && manager.importDrawings) {
                        console.log('[ChartComponent] Importing', drawings.length, 'drawings...');
                        manager.importDrawings(drawings, true);
                        console.log('[ChartComponent] Import complete!');
                    } else {
                        console.log('[ChartComponent] No drawings to import or importDrawings not available');
                    }
                } catch (error) {
                    console.warn('[ChartComponent] Failed to load saved drawings:', error);
                }
            };
            loadSavedDrawings();

            // === Alert Persistence: Restore alerts for new symbol ===
            try {
                const userAlerts = manager._userPriceAlerts;
                console.log('[Alerts] Checking restore for', symbol, '- userAlerts exists:', !!userAlerts);
                if (userAlerts && typeof userAlerts.importAlerts === 'function') {
                    const savedAlerts = loadAlertsForSymbol(symbol, exchange);
                    console.log('[Alerts] Found saved alerts:', savedAlerts);
                    if (savedAlerts && savedAlerts.length > 0) {
                        userAlerts.importAlerts(savedAlerts);
                        console.log('[Alerts] Restored', savedAlerts.length, 'alerts for', symbol);
                    } else {
                        console.log('[Alerts] No saved alerts for', symbol);
                    }
                } else {
                    console.log('[Alerts] importAlerts not available on userAlerts');
                }
            } catch (err) {
                console.warn('[Alerts] Failed to restore alerts:', err);
            }

            // Set up debounced auto-save for drawings
            let saveTimeout = null;
            const autoSaveDrawings = () => {
                if (saveTimeout) clearTimeout(saveTimeout);
                saveTimeout = setTimeout(async () => {
                    try {
                        if (manager.exportDrawings) {
                            const drawings = manager.exportDrawings();
                            await saveDrawings(symbol, exchange, interval, drawings);
                            console.log('[ChartComponent] Auto-saved', drawings.length, 'drawings');
                        }
                    } catch (error) {
                        console.warn('[ChartComponent] Failed to auto-save drawings:', error);
                    }
                }, 1000); // Debounce 1 second
            };

            // Connect auto-save to LineToolManager's onDrawingsChanged callback
            if (manager.setOnDrawingsChanged) {
                manager.setOnDrawingsChanged(() => {
                    console.log('[ChartComponent] Drawing changed, triggering auto-save...');
                    autoSaveDrawings();
                });
            }

            // Store autoSave function for external access
            manager._autoSaveDrawings = autoSaveDrawings;
        }
    };

    // Initialize PriceScaleTimer when series is ready
    const initializePriceScaleTimer = (series, intervalSeconds) => {
        if (!priceScaleTimerRef.current) {
            const timer = new PriceScaleTimer({
                timeframeSeconds: intervalSeconds,
                visible: isTimerVisible,
                textColor: '#FFFFFF',
                yOffset: 19,
                textPadding: 0.95
            });
            series.attachPrimitive(timer);
            priceScaleTimerRef.current = timer;

            // Enforce visibility rule
            if (isTimerVisible) {
                series.applyOptions({ lastValueVisible: false });
            }
        }
    };

    const updateVisualTradingData = useCallback(() => {
        if (!visualTradingRef.current) return;
        const relevantOrders = orders.filter(o => o.symbol === symbol);
        const relevantPositions = positions.filter(p => p.symbol === symbol);
        visualTradingRef.current.setData(relevantOrders, relevantPositions);
    }, [orders, positions, symbol]);

    const initializeVisualTrading = (series) => {
        if (!series) return;
        visualTradingRef.current = new VisualTrading({
            orders: [],
            positions: [],
            onModifyOrder: onModifyOrder,
            onCancelOrder: onCancelOrder
        });
        series.attachPrimitive(visualTradingRef.current);
        updateVisualTradingData();
    };

    // Initialize chart once on mount
    useEffect(() => {
        if (!chartContainerRef.current) return;

        // Use appearance settings or defaults
        const backgroundColor = theme === 'dark'
            ? (chartAppearance.darkBackground || '#131722')
            : (chartAppearance.lightBackground || '#ffffff');
        const gridColor = theme === 'dark'
            ? (chartAppearance.darkGridColor || '#2A2E39')
            : (chartAppearance.lightGridColor || '#e0e3eb');

        const chart = createChart(chartContainerRef.current, {
            watermark: {
                visible: false,
            },
            layout: {
                textColor: theme === 'dark' ? '#D1D4DC' : '#131722',
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
                    color: theme === 'dark' ? '#758696' : '#9598a1',
                    style: 3,
                    labelBackgroundColor: theme === 'dark' ? '#758696' : '#9598a1',
                },
                horzLine: {
                    width: 1,
                    color: theme === 'dark' ? '#758696' : '#9598a1',
                    style: 3,
                    labelBackgroundColor: theme === 'dark' ? '#758696' : '#9598a1',
                },
            },
            timeScale: {
                borderColor: theme === 'dark' ? '#2A2E39' : '#e0e3eb',
                timeVisible: true,
                rightOffset: 10, // Show ~10 candle widths of future time (TradingView style)
            },
            rightPriceScale: {
                borderColor: theme === 'dark' ? '#2A2E39' : '#e0e3eb',
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
        });

        chartRef.current = chart;



        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight,
                });
            }
        };

        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(chartContainerRef.current);

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
                const IST_OFFSET_SECONDS = 19800; // Same offset used in openalgo.js
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
                        console.warn('[ScrollBack] Failed to restore visible range:', e);
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
                    console.error('[ScrollBack] Error loading older data:', error);
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
            event.preventDefault(); // Prevent default right-click menu
            if (activeToolRef.current && activeToolRef.current !== 'cursor') {
                if (onToolUsed) onToolUsed();
                return;
            }

            // check for hovered order
            const hoveredOrderId = visualTradingRef.current ? visualTradingRef.current.getHoveredOrderId() : null;

            // Show custom context menu
            setContextMenu({ show: true, x: event.clientX, y: event.clientY, orderId: hoveredOrderId });
        };
        const container = chartContainerRef.current;
        container.addEventListener('contextmenu', handleContextMenu, true);

        return () => {
            // Clean up global window references to prevent memory leaks
            window.lineToolManager = null;
            window.chartInstance = null;
            window.seriesInstance = null;

            try {
                chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleTimeRangeChange);
            } catch (e) {
                console.warn('Failed to unsubscribe visible logical range change', e);
            }

            try {
                container.removeEventListener('contextmenu', handleContextMenu, true);
            } catch (error) {
                console.warn('Failed to remove contextmenu listener', error);
            }
            try {
                resizeObserver.disconnect();
            } catch (error) {
                console.warn('Failed to disconnect resize observer', error);
            }

            // Mark chart as disposed FIRST to prevent any pending RAF callbacks
            isDisposedRef.current = true;

            // Destroy lineToolManager BEFORE chart.remove() to prevent "Object is disposed" errors
            // The line-tools plugin holds a reference to the chart and may try to call requestUpdate()
            if (lineToolManagerRef.current) {
                try {
                    lineToolManagerRef.current.destroy();
                } catch (error) {
                    console.warn('Failed to destroy lineToolManager', error);
                }
                lineToolManagerRef.current = null;
            }

            try {
                if (wsRef.current) wsRef.current.close();
            } catch (error) {
                console.warn('Failed to close chart WebSocket', error);
            }
            try {
                chart.remove();
            } catch (error) {
                console.warn('Failed to remove chart instance', error);
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

        const replacementSeries = createSeries(chart, chartType, strategyConfig?.displayName || symbol);
        mainSeriesRef.current = replacementSeries;
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
                console.warn('Error re-attaching timer to new series:', e);
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
                console.warn('Error removing faded series on chart type change:', e);
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
                            console.log('[Alerts] Exporting alerts for', capturedSymbol, ':', alertsToSave);
                            if (alertsToSave.length > 0) {
                                saveAlertsForSymbol(capturedSymbol, capturedExchange, alertsToSave);
                                console.log('[Alerts] Saved', alertsToSave.length, 'alerts for', capturedSymbol, 'before cleanup');
                            }
                        }
                    }
                } catch (err) {
                    console.warn('[Alerts] Failed to save alerts in cleanup:', err);
                }

                try {
                    lineToolManagerRef.current.clearTools();
                } catch (err) {
                    console.warn('Failed to clear tools before switching chart type', err);
                }
                try {
                    if (mainSeriesRef.current) {
                        mainSeriesRef.current.detachPrimitive(lineToolManagerRef.current);
                    }
                } catch (err) {
                    console.warn('Failed to detach line tools from series', err);
                }
                lineToolManagerRef.current = null;
            }



            if (mainSeriesRef.current) {
                try {
                    chart.removeSeries(mainSeriesRef.current);
                } catch (e) {
                    // Ignore 'Value is undefined' which happens during strict mode cleanup
                    if (e.message !== 'Value is undefined') {
                        console.warn('Error removing series:', e);
                    }
                }
                mainSeriesRef.current = null;
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
        Object.values(strategyWsRefs.current).forEach(ws => {
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
                    dataRef.current = data;

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
                        if (!cancelled) {
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
                        const handleStrategyTick = (legConfig) => (ticker) => {
                            if (cancelled || !ticker) return;

                            const closePrice = Number(ticker.close);
                            if (!Number.isFinite(closePrice) || closePrice <= 0) return;

                            // Update the latest tick for this leg
                            strategyLatestRef.current[legConfig.id] = closePrice;

                            // Only update chart if all legs have ticks
                            const allLegsHaveTicks = strategyConfig.legs.every(
                                leg => strategyLatestRef.current[leg.id] != null
                            );
                            if (!allLegsHaveTicks) return;

                            // Calculate combined price with direction multiplier
                            const combinedClose = strategyConfig.legs.reduce((sum, leg) => {
                                const price = strategyLatestRef.current[leg.id];
                                const multiplier = leg.direction === 'buy' ? 1 : -1;
                                const qty = leg.quantity || 1;
                                return sum + (multiplier * qty * price);
                            }, 0);

                            const currentData = dataRef.current;
                            if (!currentData || currentData.length === 0) return;

                            const intervalSeconds = intervalToSeconds(interval);
                            if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) return;

                            const lastIndex = currentData.length - 1;
                            const lastCandleTime = currentData[lastIndex].time;

                            if (shouldResync()) syncTimeWithAPI();
                            const currentISTTime = getAccurateISTTimestamp();
                            const currentCandleTime = Math.floor(currentISTTime / intervalSeconds) * intervalSeconds;
                            const needNewCandle = currentCandleTime > lastCandleTime;

                            let candle;
                            if (needNewCandle) {
                                candle = {
                                    time: currentCandleTime,
                                    open: combinedClose,
                                    high: combinedClose,
                                    low: combinedClose,
                                    close: combinedClose,
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
                                };
                                currentData[lastIndex] = candle;
                            }

                            dataRef.current = currentData;
                            const currentChartType = chartTypeRef.current;
                            const transformedCandle = transformData([candle], currentChartType)[0];

                            if (transformedCandle && mainSeriesRef.current && !isReplayModeRef.current) {
                                mainSeriesRef.current.update(transformedCandle);
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
                        wsRef.current = subscribeToTicker(symbol, exchange, interval, (ticker) => {
                            if (cancelled || !ticker) return;

                            // Only need close price - that's the real-time tick data
                            const closePrice = Number(ticker.close);
                            if (!Number.isFinite(closePrice) || closePrice <= 0) {
                                console.warn('Received invalid close price:', ticker);
                                return;
                            }

                            const currentData = dataRef.current;
                            if (!currentData || currentData.length === 0) return;

                            const intervalSeconds = intervalToSeconds(interval);
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
                                candle = {
                                    time: currentCandleTime,
                                    open: closePrice,
                                    high: closePrice,
                                    low: closePrice,
                                    close: closePrice,
                                };
                                currentData.push(candle);
                                logger.debug('[WebSocket] Created new candle at time:', currentCandleTime, 'price:', closePrice);
                            } else {
                                // Update the last candle using ONLY the close price for high/low
                                // WebSocket high/low are session-wide, not per-interval
                                const existingCandle = currentData[lastIndex];
                                candle = {
                                    time: lastCandleTime,
                                    open: existingCandle.open,
                                    high: Math.max(existingCandle.high, closePrice),
                                    low: Math.min(existingCandle.low, closePrice),
                                    close: closePrice,
                                };
                                currentData[lastIndex] = candle;
                            }

                            dataRef.current = currentData;

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
                                    console.warn('[WebSocket] Failed to update chart with setData:', setDataErr);
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
                console.error('Error loading chart data:', error);
                if (!cancelled) {
                    isActuallyLoadingRef.current = false;
                    setIsLoading(false);
                }
            }
        };

        emaLastValueRef.current = null;
        loadData();

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
            Object.values(strategyWsRefs.current).forEach(ws => {
                if (ws) ws.close();
            });
            strategyWsRefs.current = {};
            // Reset strategy state
            strategyLatestRef.current = {};
            strategyDataRef.current = {};
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbol, exchange, interval, strategyConfig]);

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
                        const val = calculateMACD(data, fast, slow, signal);
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
                        const val = calculateStochastic(data, kPeriod, dPeriod);
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
                        const val = calculateVolume(data, ind.colorUp, ind.colorDown);
                        if (val && val.length > 0) series.setData(val);
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
                    // TPO, FirstCandle, PAR?
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
                }
            });
        }
    }, []);
    const updateIndicators = useCallback((data, indicatorsArray) => {
        if (!chartRef.current) return;

        const canAddSeries = chartReadyRef.current;
        const validIds = new Set();

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
                        switch (type) {
                            case 'sma':
                            case 'ema':
                            case 'vwap':
                            case 'atr': // ATR overlay? No, ATR is usually separate pane. Check config.
                                // If ATR is overlay, use addSeries. If pane, user addPane.
                                // Previous code put ATR in a Pane.
                                if (type === 'atr') {
                                    pane = chartRef.current.addPane({ height: 100 });
                                    series = pane.addSeries(LineSeries, { lineWidth: 2, priceLineVisible: false, lastValueVisible: true });
                                    indicatorPanesMap.current.set(id, pane);
                                } else {
                                    // SMA, EMA, VWAP are overlays
                                    series = chartRef.current.addSeries(LineSeries, { lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
                                }
                                break;
                            case 'rsi':
                                pane = chartRef.current.addPane({ height: 100 });
                                series = pane.addSeries(LineSeries, { lineWidth: 2, priceLineVisible: false, lastValueVisible: true });
                                // Add OB/OS lines for RSI
                                series._obLine = series.createPriceLine({ price: ind.overbought || 70, color: ind.overboughtColor || '#F23645', lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '' });
                                series._osLine = series.createPriceLine({ price: ind.oversold || 30, color: ind.oversoldColor || '#089981', lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '' });
                                indicatorPanesMap.current.set(id, pane);
                                break;
                            case 'stochastic':
                                pane = chartRef.current.addPane({ height: 100 });
                                series = {
                                    k: pane.addSeries(LineSeries, { lineWidth: 2, priceLineVisible: false, lastValueVisible: true, title: '%K' }),
                                    d: pane.addSeries(LineSeries, { lineWidth: 2, priceLineVisible: false, lastValueVisible: true, title: '%D' })
                                };
                                indicatorPanesMap.current.set(id, pane);
                                break;
                            case 'macd':
                                pane = chartRef.current.addPane({ height: 120 });
                                series = {
                                    histogram: pane.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }),
                                    macd: pane.addSeries(LineSeries, { lineWidth: 2, priceLineVisible: false, lastValueVisible: true, title: 'MACD' }),
                                    signal: pane.addSeries(LineSeries, { lineWidth: 2, priceLineVisible: false, lastValueVisible: true, title: 'Signal' })
                                };
                                indicatorPanesMap.current.set(id, pane);
                                break;
                            case 'bollingerBands':
                                series = {
                                    upper: chartRef.current.addSeries(LineSeries, { lineWidth: 1, priceLineVisible: false, lastValueVisible: false }),
                                    middle: chartRef.current.addSeries(LineSeries, { lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false }),
                                    lower: chartRef.current.addSeries(LineSeries, { lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
                                };
                                break;
                            case 'supertrend':
                                series = chartRef.current.addSeries(LineSeries, { lineWidth: 2, priceLineVisible: false, lastValueVisible: isVisible, crosshairMarkerVisible: true });
                                break;
                            case 'volume':
                                // Volume usually at bottom overlay
                                series = chartRef.current.addSeries(HistogramSeries, {
                                    priceFormat: { type: 'volume' },
                                    priceScaleId: 'volume', // Shared scale for all volumes? Or unique? 'volume' ID shares scale.
                                    priceLineVisible: false,
                                    lastValueVisible: false
                                });
                                series.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
                                break;
                            // Add other types as needed
                        }

                        if (series) {
                            indicatorSeriesMap.current.set(id, series);
                        }
                    } catch (e) {
                        console.error(`Error creating series for ${type} (${id})`, e);
                    }
                }

                // --- UPDATE LOGIC ---
                if (series) {
                    // Generic visibility update
                    const setVisible = (s, v) => s && s.applyOptions({ visible: v });

                    if (type === 'sma' || type === 'ema' || type === 'vwap') {
                        series.applyOptions({
                            visible: isVisible,
                            color: ind.color || (type === 'sma' ? '#2196F3' : '#FF9800'),
                            title: `${type.toUpperCase()} ${ind.period || 20}`
                        });
                        // Data update is handled by updateRealtimeIndicators mostly, but on load/change we must calc
                        // Calculate Full Data if needed (e.g. init or period change)
                        // For efficiency we might check if period changed? 
                        // For now, re-calculate is safer to ensure correct data on settings change.
                        let val = null;
                        if (type === 'sma') val = calculateSMA(data, ind.period || 20);
                        else if (type === 'ema') val = calculateEMA(data, ind.period || 20);
                        else if (type === 'vwap') val = calculateVWAP(data, { resetDaily: ind.resetDaily !== false });

                        if (val && val.length > 0) series.setData(val);

                    } else if (type === 'rsi') {
                        series.applyOptions({ visible: isVisible, color: ind.color || '#7B1FA2' });
                        if (series._obLine) series._obLine.applyOptions({ price: ind.overbought || 70, color: ind.overboughtColor || '#F23645' });
                        if (series._osLine) series._osLine.applyOptions({ price: ind.oversold || 30, color: ind.oversoldColor || '#089981' });
                        const val = calculateRSI(data, ind.period || 14);
                        if (val) series.setData(val);

                    } else if (type === 'macd') {
                        if (series.macd) series.macd.applyOptions({ visible: isVisible, color: ind.macdColor || '#2962FF' });
                        if (series.signal) series.signal.applyOptions({ visible: isVisible, color: ind.signalColor || '#FF6D00' });
                        if (series.histogram) series.histogram.applyOptions({ visible: isVisible }); // colors set in data

                        const val = calculateMACD(data, ind.fast || 12, ind.slow || 26, ind.signal || 9);
                        if (val) {
                            if (val.macd) series.macd.setData(val.macd);
                            if (val.signal) series.signal.setData(val.signal);
                            if (val.histogram) {
                                const colored = val.histogram.map(d => ({ ...d, color: d.value >= 0 ? (ind.histUpColor || '#26A69A') : (ind.histDownColor || '#EF5350') }));
                                series.histogram.setData(colored);
                            }
                        }
                    } else if (type === 'bollingerBands') {
                        series.upper.applyOptions({ visible: isVisible, color: ind.upperColor || '#2962FF' });
                        series.middle.applyOptions({ visible: isVisible, color: ind.basisColor || '#FF6D00' });
                        series.lower.applyOptions({ visible: isVisible, color: ind.lowerColor || '#2962FF' });
                        const val = calculateBollingerBands(data, ind.period || 20, ind.stdDev || 2);
                        if (val) {
                            series.upper.setData(val.upper);
                            series.middle.setData(val.middle);
                            series.lower.setData(val.lower);
                        }
                    } else if (type === 'stochastic') {
                        series.k.applyOptions({ visible: isVisible, color: ind.kColor || '#2962FF' });
                        series.d.applyOptions({ visible: isVisible, color: ind.dColor || '#FF6D00' });
                        const val = calculateStochastic(data, ind.kPeriod || 14, ind.dPeriod || 3, ind.smooth || 3);
                        if (val) {
                            series.k.setData(val.kLine);
                            series.d.setData(val.dLine);
                        }
                    } else if (type === 'atr') {
                        if (series.applyOptions) series.applyOptions({ visible: isVisible, color: ind.color || '#FF9800' });
                        const val = calculateATR(data, ind.period || 14);
                        if (val) series.setData(val);
                    } else if (type === 'supertrend') {
                        series.applyOptions({ visible: isVisible });
                        const val = calculateSupertrend(data, ind.period || 10, ind.multiplier || 3);
                        if (val) {
                            const colored = val.map(d => ({ ...d, color: d.trend === 1 ? (ind.upColor || '#089981') : (ind.downColor || '#F23645') }));
                            series.setData(colored);
                        }
                    } else if (type === 'volume') {
                        series.applyOptions({ visible: isVisible });
                        const val = calculateVolume(data, ind.colorUp || '#26A69A', ind.colorDown || '#EF5350');
                        if (val) series.setData(val);
                    }
                }
            });
        }



        // --- CLEANUP LOGIC ---
        // Identify IDs that are no longer in the list
        const idsToRemove = [];
        for (const id of indicatorSeriesMap.current.keys()) {
            if (!validIds.has(id)) {
                idsToRemove.push(id);
            }
        }

        idsToRemove.forEach(id => {
            const series = indicatorSeriesMap.current.get(id);
            const pane = indicatorPanesMap.current.get(id);

            // Remove Series
            if (series) {
                const list = Array.isArray(series) ? series : (typeof series === 'object' && !series.applyOptions ? Object.values(series) : [series]);
                list.forEach(s => {
                    if (s) {
                        try {
                            if (pane) pane.removeSeries(s);
                            else chartRef.current.removeSeries(s);
                        } catch (e) { /* ignore */ }
                    }
                });
            }

            // Remove Pane
            if (pane) {
                try {
                    const idx = chartRef.current.panes().indexOf(pane);
                    if (idx > 0) chartRef.current.removePane(idx);
                } catch (e) { console.warn('Error removing pane', e); }
                indicatorPanesMap.current.delete(id);
            }

            indicatorSeriesMap.current.delete(id);
        });

    }, []);

    // --- VISUAL TRADING DATA SYNC ---
    useEffect(() => {
        if (!visualTradingRef.current) return;

        const currentSym = symbolRef.current || symbol; // prefer Ref but fallback to prop

        // Filter orders/positions for current symbol
        // Use looser matching to handle "SYMBOL:Exch" vs "SYMBOL" mismatch
        const normalize = s => s ? s.split(':')[0] : '';
        const target = normalize(currentSym);

        const relevantOrders = (orders || []).filter(o => normalize(o.symbol) === target);
        const relevantPositions = (positions || []).filter(p => normalize(p.symbol) === target);

        if (process.env.NODE_ENV === 'development') {
            console.log('[VisualTrading] Sync:', {
                currentSym,
                target,
                totalOrders: (orders || []).length,
                relevantOrders,
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
    useEffect(() => {
        const container = chartContainerRef.current;
        if (!container) return;

        const handleMouseDown = (e) => {
            if (visualTradingRef.current) {
                const rect = container.getBoundingClientRect();
                const handled = visualTradingRef.current.handleMouseDown(e.clientX - rect.left, e.clientY - rect.top);
                if (handled) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        };
        const handleMouseMove = (e) => {
            if (visualTradingRef.current) {
                const rect = container.getBoundingClientRect();
                visualTradingRef.current.handleMouseMove(e.clientX - rect.left, e.clientY - rect.top);
            }
        };
        const handleMouseUp = (e) => {
            if (visualTradingRef.current) {
                const rect = container.getBoundingClientRect();
                visualTradingRef.current.handleMouseUp(e.clientX - rect.left, e.clientY - rect.top);
            }
        };

        container.addEventListener('mousedown', handleMouseDown, true); // Use capture to ensure we get event before chart swallows it
        window.addEventListener('mousemove', handleMouseMove); // Window for drag continuation
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            container.removeEventListener('mousedown', handleMouseDown, true);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

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
        updatePriceLine('maxCallOI', oiLines?.maxCallOI, {
            color: '#ef5350',
            lineWidth: 2,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: 'Max Call OI',
        });

        // Max Put OI Line (Blue/Cyan - Support)
        updatePriceLine('maxPutOI', oiLines?.maxPutOI, {
            color: '#42A5F5',
            lineWidth: 2,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: 'Max Put OI',
        });

        // Max Pain Line (Green)
        updatePriceLine('maxPain', oiLines?.maxPain, {
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
        if (dataRef.current.length > 0) {
            // Update indicators with current data
            try {
                updateIndicators(dataRef.current, indicators);
            } catch (error) {
                console.error('Error updating indicators:', error);
            }
        }
    }, [indicators, updateIndicators]);

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
                                Object.entries(seriesOrObj).forEach(([key, s]) => {
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



    // Handle Comparison Symbols
    useEffect(() => {
        if (!chartRef.current) return;

        const abortController = new AbortController();
        let cancelled = false;

        const currentSymbols = new Set(comparisonSymbols.map(s => s.symbol));
        const activeSeries = comparisonSeriesRefs.current;

        // Remove series that are no longer in comparisonSymbols
        activeSeries.forEach((series, sym) => {
            if (!currentSymbols.has(sym)) {
                try {
                    chartRef.current.removeSeries(series);
                } catch (e) {
                    // Ignore removal errors
                }
                activeSeries.delete(sym);
            }
        });

        // Add new series with cancellation support
        const loadComparisonData = async (comp) => {
            if (activeSeries.has(comp.symbol)) return;

            const series = chartRef.current.addSeries(LineSeries, {
                color: comp.color,
                lineWidth: 2,
                priceScaleId: 'right',
                title: comp.symbol,
            });
            activeSeries.set(comp.symbol, series);

            try {
                const data = await getKlines(comp.symbol, comp.exchange || 'NSE', interval, 1000, abortController.signal);
                // Check if still valid before setting data
                if (cancelled || !activeSeries.has(comp.symbol)) return;
                if (data && data.length > 0) {
                    const transformedData = data.map(d => ({ time: d.time, value: d.close }));
                    series.setData(transformedData);
                }
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error(`Failed to load comparison data for ${comp.symbol}`, err);
                }
            }
        };

        comparisonSymbols.forEach(comp => loadComparisonData(comp));

        // Update Price Scale Mode
        // 0: Normal, 1: Log, 2: Percentage
        const mode = comparisonSymbols.length > 0 ? 2 : (isLogScale ? 1 : 0);

        chartRef.current.priceScale('right').applyOptions({
            mode: mode,
            autoScale: isAutoScale,
        });

        return () => {
            cancelled = true;
            abortController.abort();
        };
    }, [comparisonSymbols, interval, isLogScale, isAutoScale]);

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
                    applyDefaultCandlePosition();
                    return;
                default: return;
            }

            if (from && to && !isNaN(from) && !isNaN(to)) {
                try {
                    chartRef.current.timeScale().setVisibleRange({ from, to });
                } catch (e) {
                    if (e.message !== 'Value is null') {
                        console.warn('Failed to set visible range:', e);
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
                    const timeScale = chartRef.current.timeScale();
                    timeScale.setVisibleLogicalRange(currentVisibleRange);
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
                if (chartRef.current && fullDataRef.current && fullDataRef.current.length > 0) {
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
                                const DEFAULT_VIEW_WINDOW = 200; // Larger window to avoid zooming in
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
                        console.warn('Failed to restore visible range in Jump to Bar:', e);
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

            replayIntervalRef.current = setInterval(() => {
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
                    }, 0);
                }
            } catch (e) {
                console.warn('Error handling replay click:', e);
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
                        const VIEW_WINDOW = 300;
                        const startIndex = Math.max(0, selectedIndex - VIEW_WINDOW / 2);
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
                                if (chartRef.current) {
                                    try {
                                        chartRef.current.timeScale().setVisibleRange(targetRange);
                                    } catch (e) {
                                        // Ignore
                                    }
                                }
                            }, 10);

                            // Set one more time after data update completes
                            setTimeout(() => {
                                if (chartRef.current) {
                                    try {
                                        chartRef.current.timeScale().setVisibleRange(targetRange);
                                    } catch (e) {
                                        // Ignore
                                    }
                                }
                            }, 100);
                        } catch (e) {
                            console.warn('Failed to set visible range after selection:', e);
                        }
                    }
                }
            } catch (e) {
                console.warn('Error handling chart click in Jump to Bar:', e);
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
        return JSON.stringify({
            visible: tpoIndicators[0].visible,
            settings: tpoIndicators[0].settings
        });
    }, [indicators]);

    // Handle TPO Indicator
    useEffect(() => {
        if (!chartRef.current || !mainSeriesRef.current || !dataRef.current) return;

        const tpoIndicators = (indicators || []).filter(ind => ind.type === 'tpo');

        // Remove old TPO primitives
        if (tpoProfileRef.current) {
            try {
                mainSeriesRef.current.detachPrimitive(tpoProfileRef.current);
            } catch (e) {
                // Primitive might already be detached
            }
            tpoProfileRef.current = null;
        }

        // Add new TPO if exists and is visible
        if (tpoIndicators.length > 0 && dataRef.current.length > 0) {
            const tpoInd = tpoIndicators[0];

            // Check if indicator is visible (default to true if not specified)
            const isVisible = tpoInd.visible !== false;

            if (!isVisible) {
                console.log('[TPO] Indicator hidden, skipping render');
                return;
            }

            try {
                const profiles = calculateTPO(dataRef.current, {
                    tickSize: tpoInd.settings?.tickSize || 'auto',
                    blockSize: tpoInd.settings?.blockSize || '30m',
                    sessionType: tpoInd.settings?.sessionType || 'daily',
                    sessionStart: tpoInd.settings?.sessionStart || '09:15',
                    sessionEnd: tpoInd.settings?.sessionEnd || '15:30',
                    valueAreaPercent: tpoInd.settings?.valueAreaPercent || 70,
                    allHours: tpoInd.settings?.allHours !== false,
                    timezone: tpoInd.settings?.timezone || 'Asia/Kolkata',
                    interval: interval
                });

                console.log('[TPO] Calculated profiles:', profiles.length, 'Settings:', tpoInd.settings);

                const tpoPrimitive = new TPOProfilePrimitive({
                    visible: isVisible,
                    showLetters: tpoInd.settings?.showLetters !== false,
                    showPOC: tpoInd.settings?.showPOC !== false,
                    showValueArea: tpoInd.settings?.showValueArea !== false,
                    showVAH: tpoInd.settings?.showVAH !== false,
                    showVAL: tpoInd.settings?.showVAL !== false,
                    useGradientColors: tpoInd.settings?.useGradientColors !== false,
                });

                tpoPrimitive.setData(profiles);
                mainSeriesRef.current.attachPrimitive(tpoPrimitive);
                tpoProfileRef.current = tpoPrimitive;

                console.log('[TPO] Primitive attached successfully');
            } catch (error) {
                console.error('[TPO] Error rendering TPO:', error);
            }
        }
    }, [interval, symbol, exchange, tpoSettingsHash]);



    // Helper to prepare indicators for the legend
    const getActiveIndicators = useCallback(() => {
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

            if (ind.source && ind.source !== 'close') params += `${ind.source} `;

            return {
                ...ind,
                name: config ? config.name : (ind.name || ind.type.toUpperCase()),
                params: params.trim(),
                value: val,
                color: ind.color || (config?.style?.[0]?.default) || '#2962FF',
                isHidden: ind.visible === false,
                pane: ind.pane || (config ? config.pane : 'main')
            };
        }).filter(Boolean);
    }, [indicators, indicatorValues]);

    return (
        <div className={`${styles.chartWrapper} ${isToolbarVisible ? styles.toolbarVisible : ''}`} style={{ display: 'flex', flexDirection: 'column' }}>
            <div
                id="container"
                ref={chartContainerRef}
                className={styles.chartContainer}
                style={{
                    position: 'relative',
                    touchAction: 'none',
                    flex: '1 1 100%',
                    minHeight: 200,
                }}
            />
            {isLoading && isActuallyLoadingRef.current && <div className={styles.loadingOverlay}><div className={styles.spinner}></div><div>Loading...</div></div>}

            {/* Symbol + OHLC Header Bar - All on one line */}
            <div className={styles.ohlcHeader} style={{ left: isToolbarVisible ? '55px' : '10px' }}>
                <span className={styles.ohlcSymbol}>{strategyConfig?.displayName || `${symbol}:${exchange}`}</span>
                <span className={styles.ohlcInterval}>· {interval.toUpperCase()}</span>
                {ohlcData && (
                    <>
                        <span className={`${styles.ohlcDot} ${ohlcData.isUp ? '' : styles.down}`}></span>
                        <div className={styles.ohlcValues}>
                            <span className={styles.ohlcItem}>
                                <span className={styles.ohlcLabel}>O</span>
                                <span className={styles.ohlcValue}>{ohlcData.open?.toFixed(2)}</span>
                            </span>
                            <span className={styles.ohlcItem}>
                                <span className={styles.ohlcLabel}>H</span>
                                <span className={styles.ohlcValue}>{ohlcData.high?.toFixed(2)}</span>
                            </span>
                            <span className={styles.ohlcItem}>
                                <span className={styles.ohlcLabel}>L</span>
                                <span className={styles.ohlcValue}>{ohlcData.low?.toFixed(2)}</span>
                            </span>
                            <span className={styles.ohlcItem}>
                                <span className={styles.ohlcLabel}>C</span>
                                <span className={`${styles.ohlcValue} ${ohlcData.isUp ? styles.up : styles.down}`}>{ohlcData.close?.toFixed(2)}</span>
                            </span>
                            <span className={styles.ohlcChange}>
                                <span className={`${styles.ohlcChangeValue} ${ohlcData.change >= 0 ? styles.up : styles.down}`}>
                                    {ohlcData.change >= 0 ? '+' : ''}{ohlcData.change?.toFixed(2)} ({ohlcData.changePercent >= 0 ? '+' : ''}{ohlcData.changePercent?.toFixed(2)}%)
                                </span>
                            </span>
                        </div>
                    </>
                )}
            </div>

            {/* Indicator Legend - Using reusable component */}
            <IndicatorLegend
                indicators={getActiveIndicators()}
                panePositions={panePositions}
                isToolbarVisible={isToolbarVisible}
                isCollapsed={indicatorDropdownOpen}
                onToggleCollapse={() => setIndicatorDropdownOpen(prev => !prev)}
                onVisibilityToggle={onIndicatorVisibilityToggle}
                onRemove={onIndicatorRemove}
                onSettings={(indicatorType) => setIndicatorSettingsOpen(indicatorType)}
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
                            if (onIndicatorSettings && indicatorSettingsOpen) {
                                onIndicatorSettings(indicatorSettingsOpen, newSettings);
                            }
                        }}
                        theme={theme}
                    />
                );
            })()}

            {/* Shift+Click Quick Measure Overlay */}
            {measureData && !measureData.isFirstPoint && (
                <div
                    className={styles.measureOverlay}
                    style={{
                        left: measureData.position.x,
                        top: measureData.position.y,
                    }}
                >
                    {/* Dashed line between points */}
                    <svg
                        className={styles.measureLine}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            pointerEvents: 'none',
                            zIndex: 99,
                        }}
                    >
                        <line
                            x1={measureData.line.x1}
                            y1={measureData.line.y1}
                            x2={measureData.line.x2}
                            y2={measureData.line.y2}
                            stroke={measureData.priceChange >= 0 ? '#26a69a' : '#ef5350'}
                            strokeWidth="1"
                            strokeDasharray="4,4"
                        />
                    </svg>
                    <div className={styles.measureBox}>
                        <div className={measureData.priceChange >= 0 ? styles.measureUp : styles.measureDown}>
                            {measureData.priceChange >= 0 ? '+' : ''}{measureData.priceChange.toFixed(2)}
                            {' '}({measureData.percentChange >= 0 ? '+' : ''}{measureData.percentChange.toFixed(2)}%)
                        </div>
                        <div className={styles.measureDetails}>
                            {measureData.barCount} bars · {measureData.timeElapsed}
                        </div>
                    </div>
                </div>
            )}

            {/* First point indicator */}
            {measureData && measureData.isFirstPoint && (
                <div
                    className={styles.measureStartPoint}
                    style={{
                        left: measureData.x - 4,
                        top: measureData.y - 4,
                    }}
                />
            )}

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
                onAddAlert={() => {
                    const manager = lineToolManagerRef.current;
                    const userAlerts = manager && manager._userPriceAlerts;
                    if (userAlerts && priceScaleMenu.price != null) {
                        userAlerts.openEditDialog('new', {
                            price: priceScaleMenu.price,
                            condition: 'crossing'
                        });
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

            {/* Right-click Context Menu */}
            {contextMenu.show && (
                <div
                    className={styles.contextMenu}
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {contextMenu.orderId && (
                        <button
                            className={styles.contextMenuItem}
                            onClick={() => {
                                onCancelOrder?.(contextMenu.orderId);
                                setContextMenu({ show: false, x: 0, y: 0 });
                            }}
                        >
                            Cancel Order
                        </button>
                    )}
                    <button
                        className={styles.contextMenuItem}
                        onClick={() => {
                            onOpenOptionChain?.(symbol, exchange);
                            setContextMenu({ show: false, x: 0, y: 0 });
                        }}
                    >
                        View Option Chain
                    </button>
                </div>
            )}

        </div >

    );
});

export default ChartComponent;
