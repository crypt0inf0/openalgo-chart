import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
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
import { getKlines, getHistoricalKlines, subscribeToTicker } from '../../services/openalgo';
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
    calculateVWAP
} from '../../utils/indicators';
import { calculateHeikinAshi } from '../../utils/chartUtils';
import { intervalToSeconds } from '../../utils/timeframes';
import { logger } from '../../utils/logger.js';

import { LineToolManager, PriceScaleTimer } from '../../plugins/line-tools/line-tools.js';
import '../../plugins/line-tools/line-tools.css';
import ReplayControls from '../Replay/ReplayControls';
import ReplaySlider from '../Replay/ReplaySlider';

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
}, ref) => {
    const chartContainerRef = useRef();
    const [isLoading, setIsLoading] = useState(true);
    const isActuallyLoadingRef = useRef(true); // Track if we're actually loading data (not just updating indicators) - start as true on mount
    const chartRef = useRef(null);
    const mainSeriesRef = useRef(null);
    const smaSeriesRef = useRef(null);
    const emaSeriesRef = useRef(null);
    const bollingerSeriesRef = useRef({ upper: null, middle: null, lower: null });
    const vwapSeriesRef = useRef(null);
    // Integrated indicator series refs (displayed within main chart)
    const volumeSeriesRef = useRef(null);
    const rsiSeriesRef = useRef(null);
    const macdSeriesRef = useRef({ macd: null, signal: null, histogram: null });
    const stochasticSeriesRef = useRef({ k: null, d: null });
    const atrSeriesRef = useRef(null);
    const chartReadyRef = useRef(false); // Track when chart is fully stable and ready for indicator additions
    const lineToolManagerRef = useRef(null);
    const priceScaleTimerRef = useRef(null); // Ref for the candle countdown timer
    const wsRef = useRef(null);
    const chartTypeRef = useRef(chartType);
    const dataRef = useRef([]);
    const comparisonSeriesRefs = useRef(new Map());

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

    // Refs to track current prop values for use in closures (chart initialization useEffect)
    const symbolRef = useRef(symbol);
    const exchangeRef = useRef(exchange);
    const intervalRef = useRef(interval);
    const indicatorsRef = useRef(indicators);

    // Keep refs in sync with props
    useEffect(() => { symbolRef.current = symbol; }, [symbol]);
    useEffect(() => { exchangeRef.current = exchange; }, [exchange]);
    useEffect(() => { intervalRef.current = interval; }, [interval]);
    useEffect(() => { indicatorsRef.current = indicators; }, [indicators]);

    // ============================================
    // CONFIGURABLE CHART CONSTANTS
    // ============================================
    const DEFAULT_CANDLE_WINDOW = 235;        // Fixed number of candles to show
    const DEFAULT_RIGHT_OFFSET = 10;           // Right margin in candle units
    const PREFETCH_THRESHOLD = 126;            // Candles from oldest before prefetching
    const MIN_CANDLES_FOR_SCROLL_BACK = 50;   // Minimum candles before enabling scroll-back

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
                    userAlerts.setSymbolName(symbol);
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

        // Always disable first (clear any existing session highlighting)
        if (typeof manager.disableSessionHighlighting === 'function') {
            manager.disableSessionHighlighting();
        }

        // Then enable if requested
        if (isSessionBreakVisible) {
            if (typeof manager.enableSessionHighlighting === 'function') {
                // Session highlighter function - defines colors for different times
                const sessionHighlighter = (time) => {
                    // Convert time to date for session detection
                    const date = new Date(time * 1000);
                    const hours = date.getHours();

                    // Indian market session: 9:15 AM to 3:30 PM IST
                    // Color session start (9:15 AM) with a light color
                    if (hours === 9) {
                        return 'rgba(41, 98, 255, 0.15)'; // Light blue for market open
                    }
                    // Color session end (3:30 PM = 15:30)
                    if (hours === 15) {
                        return 'rgba(255, 82, 82, 0.15)'; // Light red for market close
                    }
                    return ''; // No highlighting for other times
                };
                manager.enableSessionHighlighting(sessionHighlighter);
            }
        }
    }, [isSessionBreakVisible]);

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

    // RAF Loop for smooth updates
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
            default:
                return data;
        }
    };

    // Create appropriate series based on chart type
    const createSeries = (chart, type, title = '') => {
        const commonOptions = { lastValueVisible: true, priceScaleId: 'right', title: title };

        switch (type) {
            case 'candlestick':
                return chart.addSeries(CandlestickSeries, {
                    ...commonOptions,
                    upColor: '#089981',
                    downColor: '#F23645',
                    borderVisible: false,
                    wickUpColor: '#089981',
                    wickDownColor: '#F23645',
                });
            case 'bar':
                return chart.addSeries(BarSeries, {
                    ...commonOptions,
                    upColor: '#089981',
                    downColor: '#F23645',
                    thinBars: false,
                });
            case 'hollow-candlestick':
                return chart.addSeries(CandlestickSeries, {
                    ...commonOptions,
                    upColor: 'transparent',
                    downColor: '#F23645',
                    borderUpColor: '#089981',
                    borderDownColor: '#F23645',
                    wickUpColor: '#089981',
                    wickDownColor: '#F23645',
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
                    topLineColor: '#089981',
                    topFillColor1: 'rgba(8, 153, 129, 0.28)',
                    topFillColor2: 'rgba(8, 153, 129, 0.05)',
                    bottomLineColor: '#F23645',
                    bottomFillColor1: 'rgba(242, 54, 69, 0.05)',
                    bottomFillColor2: 'rgba(242, 54, 69, 0.28)',
                });
            case 'heikin-ashi':
                return chart.addSeries(CandlestickSeries, {
                    ...commonOptions,
                    upColor: '#089981',
                    downColor: '#F23645',
                    borderVisible: false,
                    wickUpColor: '#089981',
                    wickDownColor: '#F23645',
                });
            default:
                return chart.addSeries(CandlestickSeries, {
                    ...commonOptions,
                    upColor: '#089981',
                    downColor: '#F23645',
                    borderVisible: false,
                    wickUpColor: '#089981',
                    wickDownColor: '#F23645',
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


            // Ensure alerts primitive (if present) knows the current symbol
            try {
                // Set symbol on the manager itself for alert notifications
                if (typeof manager.setSymbol === 'function') {
                    manager.setSymbol(symbol);
                }

                const userAlerts = manager._userPriceAlerts;
                if (userAlerts && typeof userAlerts.setSymbolName === 'function') {
                    userAlerts.setSymbolName(symbol);
                }

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
            } catch (err) {
                console.warn('Failed to initialize alert symbol name', err);
            }

            window.lineToolManager = manager;
            window.chartInstance = chartRef.current;
            window.seriesInstance = series;
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
        }
    };

    // Initialize chart once on mount
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            watermark: {
                visible: false,
            },
            layout: {
                textColor: theme === 'dark' ? '#D1D4DC' : '#131722',
                background: { color: theme === 'dark' ? '#131722' : '#ffffff' },
                attributionLogo: false,
            },
            grid: {
                vertLines: { color: theme === 'dark' ? '#2A2E39' : '#e0e3eb' },
                horzLines: { color: theme === 'dark' ? '#2A2E39' : '#e0e3eb' },
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
            },
            rightPriceScale: {
                borderColor: theme === 'dark' ? '#2A2E39' : '#e0e3eb',
            },
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
            },
            handleScale: {
                mouseWheel: true,
                pinch: true,
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

        // Use Logical Range change for better performance/accuracy mapping to data indices
        chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleTimeRangeChange);

        // Handle right-click to cancel tool
        const handleContextMenu = (event) => {
            event.preventDefault(); // Prevent default right-click menu
            if (activeToolRef.current && activeToolRef.current !== 'cursor') {
                if (onToolUsed) onToolUsed();
            }
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
                // Refs managed by other effects (lineToolManagerRef, mainSeriesRef) are cleared in their own cleanup functions
            }
        };
    }, []); // Only create chart once

    // Re-create main series when chart type changes
    useEffect(() => {
        if (!chartRef.current) {
            return;
        }

        const chart = chartRef.current;

        const replacementSeries = createSeries(chart, chartType, symbol);
        mainSeriesRef.current = replacementSeries;
        initializeLineTools(replacementSeries);

        // Re-attach timer to the new series when chart type changes
        if (priceScaleTimerRef.current) {
            try {
                replacementSeries.attachPrimitive(priceScaleTimerRef.current);
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

        return () => {
            if (lineToolManagerRef.current) {

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
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chartType, symbol]);

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
                const data = await getKlines(symbol, exchange, interval, 1000, abortController.signal);
                if (cancelled) return;

                if (Array.isArray(data) && data.length > 0 && mainSeriesRef.current) {
                    dataRef.current = data;

                    // Track the oldest loaded timestamp for scroll-back loading
                    oldestLoadedTimeRef.current = data[0].time;

                    const activeType = chartTypeRef.current;
                    const transformedData = transformData(data, activeType);
                    mainSeriesRef.current.setData(transformedData);

                    // Mark chart as ready immediately after data is set
                    // This allows indicators to be added without delay
                    chartReadyRef.current = true;

                    // Initialize the candle countdown timer
                    const intervalSeconds = intervalToSeconds(interval);
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
                            mainSeriesRef.current.update(transformedCandle);

                            updateRealtimeIndicators(currentData);
                            updateAxisLabel();
                            updateOhlcFromLatest();

                            if (priceScaleTimerRef.current) {
                                priceScaleTimerRef.current.updateCandleData(candle.open, candle.close);
                            }
                        }
                    });
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
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbol, interval]);

    const emaLastValueRef = useRef(null);

    const updateRealtimeIndicators = useCallback((data) => {
        if (!chartRef.current) return;

        const lastIndex = data.length - 1;
        const lastDataPoint = data[lastIndex];

        // SMA Indicator
        if (indicators.sma && smaSeriesRef.current) {
            if (data.length < 20) {
                const smaData = calculateSMA(data, 20);
                if (smaData && smaData.length > 0) {
                    smaSeriesRef.current.setData(smaData);
                }
            } else {
                const subset = data.slice(-20);
                const sum = subset.reduce((acc, d) => acc + d.close, 0);
                const average = sum / subset.length;
                smaSeriesRef.current.update({ time: lastDataPoint.time, value: average });
            }
        }

        // EMA Indicator
        if (indicators.ema && emaSeriesRef.current) {
            if (data.length < 20 || emaLastValueRef.current === null) {
                const emaData = calculateEMA(data, 20);
                if (emaData && emaData.length > 0) {
                    emaLastValueRef.current = emaData[emaData.length - 1].value;
                    emaSeriesRef.current.setData(emaData);
                }
            } else {
                const smoothing = 2 / (20 + 1);
                const emaValue = (lastDataPoint.close - emaLastValueRef.current) * smoothing + emaLastValueRef.current;
                emaLastValueRef.current = emaValue;
                emaSeriesRef.current.update({ time: lastDataPoint.time, value: emaValue });
            }
        }
    }, [indicators]);

    const updateIndicators = useCallback((data, indicatorsConfig) => {
        if (!chartRef.current) return;

        // If chart is not ready yet (still in initial load), defer indicator series creation
        // This prevents flicker caused by addSeries() during visibility transitions
        const canAddSeries = chartReadyRef.current;


        // SMA Indicator
        if (indicatorsConfig.sma) {
            // Only create series if chart is ready, otherwise just calculate data for later
            if (!smaSeriesRef.current && canAddSeries) {
                smaSeriesRef.current = chartRef.current.addSeries(LineSeries, {
                    color: '#2962FF',
                    lineWidth: 2,
                    title: 'SMA 20',
                    priceLineVisible: false,
                    lastValueVisible: false
                });
            }
            // Set data if series exists
            if (smaSeriesRef.current && typeof calculateSMA === 'function') {
                const smaData = calculateSMA(data, 20);
                if (smaData && smaData.length > 0) {
                    smaSeriesRef.current.setData(smaData);
                }
            }
        } else {
            if (smaSeriesRef.current) {
                chartRef.current.removeSeries(smaSeriesRef.current);
                smaSeriesRef.current = null;
            }
        }

        // EMA Indicator
        if (indicatorsConfig.ema) {
            // Only create series if chart is ready, otherwise just calculate data for later
            if (!emaSeriesRef.current && canAddSeries) {
                emaSeriesRef.current = chartRef.current.addSeries(LineSeries, {
                    color: '#FF6D00',
                    lineWidth: 2,
                    title: 'EMA 20',
                    priceLineVisible: false,
                    lastValueVisible: false
                });
            }
            // Set data if series exists
            if (emaSeriesRef.current && typeof calculateEMA === 'function') {
                const emaData = calculateEMA(data, 20);
                if (emaData && emaData.length > 0) {
                    emaSeriesRef.current.setData(emaData);
                }
            }
        } else {
            if (emaSeriesRef.current) {
                chartRef.current.removeSeries(emaSeriesRef.current);
                emaSeriesRef.current = null;
            }
        }

        // Bollinger Bands (overlay on main chart)
        if (indicatorsConfig.bollingerBands?.enabled) {
            const period = indicatorsConfig.bollingerBands.period || 20;
            const stdDev = indicatorsConfig.bollingerBands.stdDev || 2;
            const bbData = calculateBollingerBands(data, period, stdDev);

            if (canAddSeries && bbData.upper && bbData.upper.length > 0) {
                // Upper band
                if (!bollingerSeriesRef.current.upper) {
                    bollingerSeriesRef.current.upper = chartRef.current.addSeries(LineSeries, {
                        color: 'rgba(33, 150, 243, 0.5)',
                        lineWidth: 1,
                        priceLineVisible: false,
                        lastValueVisible: false,
                        title: '',
                    });
                }
                bollingerSeriesRef.current.upper.setData(bbData.upper);

                // Middle band (SMA)
                if (!bollingerSeriesRef.current.middle) {
                    bollingerSeriesRef.current.middle = chartRef.current.addSeries(LineSeries, {
                        color: 'rgba(33, 150, 243, 0.8)',
                        lineWidth: 1,
                        lineStyle: 2, // Dashed
                        priceLineVisible: false,
                        lastValueVisible: false,
                        title: 'BB',
                    });
                }
                bollingerSeriesRef.current.middle.setData(bbData.middle);

                // Lower band
                if (!bollingerSeriesRef.current.lower) {
                    bollingerSeriesRef.current.lower = chartRef.current.addSeries(LineSeries, {
                        color: 'rgba(33, 150, 243, 0.5)',
                        lineWidth: 1,
                        priceLineVisible: false,
                        lastValueVisible: false,
                        title: '',
                    });
                }
                bollingerSeriesRef.current.lower.setData(bbData.lower);
            }
        } else {
            // Remove Bollinger Bands series
            if (bollingerSeriesRef.current.upper) {
                chartRef.current.removeSeries(bollingerSeriesRef.current.upper);
                bollingerSeriesRef.current.upper = null;
            }
            if (bollingerSeriesRef.current.middle) {
                chartRef.current.removeSeries(bollingerSeriesRef.current.middle);
                bollingerSeriesRef.current.middle = null;
            }
            if (bollingerSeriesRef.current.lower) {
                chartRef.current.removeSeries(bollingerSeriesRef.current.lower);
                bollingerSeriesRef.current.lower = null;
            }
        }

        // VWAP Indicator (overlay on main chart)
        if (indicatorsConfig.vwap?.enabled) {
            if (!vwapSeriesRef.current && canAddSeries) {
                vwapSeriesRef.current = chartRef.current.addSeries(LineSeries, {
                    color: indicatorsConfig.vwap.color || '#FF9800',
                    lineWidth: 2,
                    title: 'VWAP',
                    priceLineVisible: false,
                    lastValueVisible: true
                });
            }
            if (vwapSeriesRef.current && typeof calculateVWAP === 'function') {
                const vwapData = calculateVWAP(data);
                if (vwapData && vwapData.length > 0) {
                    vwapSeriesRef.current.setData(vwapData);
                }
            }
        } else {
            if (vwapSeriesRef.current) {
                chartRef.current.removeSeries(vwapSeriesRef.current);
                vwapSeriesRef.current = null;
            }
        }

        // ========== VOLUME INDICATOR (Overlay at bottom of chart) ==========
        if (indicatorsConfig.volume?.enabled) {
            if (!volumeSeriesRef.current && canAddSeries) {
                volumeSeriesRef.current = chartRef.current.addSeries(HistogramSeries, {
                    priceFormat: { type: 'volume' },
                    priceScaleId: 'volume',
                    priceLineVisible: false,
                    lastValueVisible: false,
                });
                volumeSeriesRef.current.priceScale().applyOptions({
                    scaleMargins: { top: 0.85, bottom: 0 },
                });
            }
            if (volumeSeriesRef.current) {
                const upColor = indicatorsConfig.volume.colorUp || '#26a69a80';
                const downColor = indicatorsConfig.volume.colorDown || '#ef535080';
                const volumeData = calculateVolume(data, upColor, downColor);
                if (volumeData && volumeData.length > 0) {
                    volumeSeriesRef.current.setData(volumeData);
                }
            }
        } else if (volumeSeriesRef.current) {
            chartRef.current.removeSeries(volumeSeriesRef.current);
            volumeSeriesRef.current = null;
        }

        // ========== RSI INDICATOR (Overlay in lower portion) ==========
        if (indicatorsConfig.rsi?.enabled) {
            if (!rsiSeriesRef.current && canAddSeries) {
                rsiSeriesRef.current = chartRef.current.addSeries(LineSeries, {
                    color: indicatorsConfig.rsi?.color || '#7B1FA2',
                    lineWidth: 2,
                    priceScaleId: 'rsi',
                    priceLineVisible: false,
                    lastValueVisible: true,
                    title: 'RSI',
                });
                rsiSeriesRef.current.priceScale().applyOptions({
                    scaleMargins: { top: 0.7, bottom: 0.05 },
                });
            }
            if (rsiSeriesRef.current) {
                const period = indicatorsConfig.rsi.period || 14;
                const rsiData = calculateRSI(data, period);
                if (rsiData && rsiData.length > 0) {
                    rsiSeriesRef.current.setData(rsiData);
                }
            }
        } else if (rsiSeriesRef.current) {
            chartRef.current.removeSeries(rsiSeriesRef.current);
            rsiSeriesRef.current = null;
        }

        // ========== MACD INDICATOR (Overlay in lower portion) ==========
        if (indicatorsConfig.macd?.enabled) {
            const macdPriceScaleId = 'macd';
            const macdScaleMargins = { top: 0.75, bottom: 0.02 };

            // MACD Histogram
            if (!macdSeriesRef.current.histogram && canAddSeries) {
                macdSeriesRef.current.histogram = chartRef.current.addSeries(HistogramSeries, {
                    priceScaleId: macdPriceScaleId,
                    priceLineVisible: false,
                    lastValueVisible: false,
                });
                macdSeriesRef.current.histogram.priceScale().applyOptions({
                    scaleMargins: macdScaleMargins,
                });
            }
            // MACD Line
            if (!macdSeriesRef.current.macd && canAddSeries) {
                macdSeriesRef.current.macd = chartRef.current.addSeries(LineSeries, {
                    color: indicatorsConfig.macd?.macdColor || '#2962FF',
                    lineWidth: 2,
                    priceScaleId: macdPriceScaleId,
                    priceLineVisible: false,
                    lastValueVisible: true,
                    title: 'MACD',
                });
            }
            // Signal Line
            if (!macdSeriesRef.current.signal && canAddSeries) {
                macdSeriesRef.current.signal = chartRef.current.addSeries(LineSeries, {
                    color: indicatorsConfig.macd?.signalColor || '#FF6D00',
                    lineWidth: 2,
                    priceScaleId: macdPriceScaleId,
                    priceLineVisible: false,
                    lastValueVisible: true,
                    title: 'Signal',
                });
            }

            // Set MACD data
            const fast = indicatorsConfig.macd.fast || 12;
            const slow = indicatorsConfig.macd.slow || 26;
            const signal = indicatorsConfig.macd.signal || 9;
            const macdResult = calculateMACD(data, fast, slow, signal);

            if (macdSeriesRef.current.histogram && macdResult?.histogram) {
                macdSeriesRef.current.histogram.setData(macdResult.histogram);
            }
            if (macdSeriesRef.current.macd && macdResult?.macdLine) {
                macdSeriesRef.current.macd.setData(macdResult.macdLine);
            }
            if (macdSeriesRef.current.signal && macdResult?.signalLine) {
                macdSeriesRef.current.signal.setData(macdResult.signalLine);
            }
        } else {
            // Remove MACD series
            if (macdSeriesRef.current.histogram) {
                chartRef.current.removeSeries(macdSeriesRef.current.histogram);
                macdSeriesRef.current.histogram = null;
            }
            if (macdSeriesRef.current.macd) {
                chartRef.current.removeSeries(macdSeriesRef.current.macd);
                macdSeriesRef.current.macd = null;
            }
            if (macdSeriesRef.current.signal) {
                chartRef.current.removeSeries(macdSeriesRef.current.signal);
                macdSeriesRef.current.signal = null;
            }
        }

        // ========== STOCHASTIC INDICATOR (Overlay in lower portion) ==========
        if (indicatorsConfig.stochastic?.enabled) {
            const stochPriceScaleId = 'stochastic';
            const stochScaleMargins = { top: 0.7, bottom: 0.05 };

            // %K Line
            if (!stochasticSeriesRef.current.k && canAddSeries) {
                stochasticSeriesRef.current.k = chartRef.current.addSeries(LineSeries, {
                    color: indicatorsConfig.stochastic?.kColor || '#2962FF',
                    lineWidth: 2,
                    priceScaleId: stochPriceScaleId,
                    priceLineVisible: false,
                    lastValueVisible: true,
                    title: '%K',
                });
                stochasticSeriesRef.current.k.priceScale().applyOptions({
                    scaleMargins: stochScaleMargins,
                });
            }
            // %D Line
            if (!stochasticSeriesRef.current.d && canAddSeries) {
                stochasticSeriesRef.current.d = chartRef.current.addSeries(LineSeries, {
                    color: indicatorsConfig.stochastic?.dColor || '#FF6D00',
                    lineWidth: 2,
                    priceScaleId: stochPriceScaleId,
                    priceLineVisible: false,
                    lastValueVisible: true,
                    title: '%D',
                });
            }

            const kPeriod = indicatorsConfig.stochastic.kPeriod || 14;
            const dPeriod = indicatorsConfig.stochastic.dPeriod || 3;
            const smooth = indicatorsConfig.stochastic.smooth || 3;
            const stochResult = calculateStochastic(data, kPeriod, dPeriod, smooth);

            if (stochasticSeriesRef.current.k && stochResult?.kLine) {
                stochasticSeriesRef.current.k.setData(stochResult.kLine);
            }
            if (stochasticSeriesRef.current.d && stochResult?.dLine) {
                stochasticSeriesRef.current.d.setData(stochResult.dLine);
            }
        } else {
            if (stochasticSeriesRef.current.k) {
                chartRef.current.removeSeries(stochasticSeriesRef.current.k);
                stochasticSeriesRef.current.k = null;
            }
            if (stochasticSeriesRef.current.d) {
                chartRef.current.removeSeries(stochasticSeriesRef.current.d);
                stochasticSeriesRef.current.d = null;
            }
        }

        // ========== ATR INDICATOR (Overlay in lower portion) ==========
        if (indicatorsConfig.atr?.enabled) {
            if (!atrSeriesRef.current && canAddSeries) {
                atrSeriesRef.current = chartRef.current.addSeries(LineSeries, {
                    color: indicatorsConfig.atr?.color || '#FF9800',
                    lineWidth: 2,
                    priceScaleId: 'atr',
                    priceLineVisible: false,
                    lastValueVisible: true,
                    title: 'ATR',
                });
                atrSeriesRef.current.priceScale().applyOptions({
                    scaleMargins: { top: 0.8, bottom: 0.02 },
                });
            }
            if (atrSeriesRef.current) {
                const period = indicatorsConfig.atr.period || 14;
                const atrData = calculateATR(data, period);
                if (atrData && atrData.length > 0) {
                    atrSeriesRef.current.setData(atrData);
                }
            }
        } else if (atrSeriesRef.current) {
            chartRef.current.removeSeries(atrSeriesRef.current);
            atrSeriesRef.current = null;
        }

        // ========== ADJUST MAIN PRICE SERIES SCALE MARGINS ==========
        // When indicators are active, compress the main series to the top
        const hasLowerIndicators = indicatorsConfig.volume?.enabled ||
            indicatorsConfig.rsi?.enabled ||
            indicatorsConfig.macd?.enabled ||
            indicatorsConfig.stochastic?.enabled ||
            indicatorsConfig.atr?.enabled;

        if (mainSeriesRef.current) {
            mainSeriesRef.current.priceScale().applyOptions({
                scaleMargins: hasLowerIndicators
                    ? { top: 0.02, bottom: 0.35 }  // Compress to top ~63%
                    : { top: 0.1, bottom: 0.1 },   // Normal full view
            });
        }

    }, []); // Empty dependency array - indicators passed as parameter

    // Separate effect for indicators to prevent data reload
    useEffect(() => {
        // Reset EMA last value when indicators change
        emaLastValueRef.current = null;

        if (dataRef.current.length > 0) {
            // Update indicators with current data
            try {
                updateIndicators(dataRef.current, indicators);
                // Update EMA last value if EMA series exists
                if (emaSeriesRef.current && dataRef.current.length >= 20) {
                    const emaData = calculateEMA(dataRef.current, 20);
                    if (emaData && emaData.length > 0) {
                        emaLastValueRef.current = emaData[emaData.length - 1].value;
                        emaSeriesRef.current.setData(emaData);
                    }
                }
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
    }, [symbol, interval]); // Re-subscribe when symbol/interval changes



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

    // Handle Theme Changes
    useEffect(() => {
        if (chartRef.current) {
            chartRef.current.applyOptions({
                layout: {
                    textColor: theme === 'dark' ? '#D1D4DC' : '#131722',
                    background: { color: theme === 'dark' ? '#131722' : '#ffffff' },
                },
                grid: {
                    vertLines: { color: theme === 'dark' ? '#2A2E39' : '#e0e3eb' },
                    horzLines: { color: theme === 'dark' ? '#2A2E39' : '#e0e3eb' },
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
                    borderColor: theme === 'dark' ? '#2A2E39' : '#e0e3eb',
                },
                rightPriceScale: {
                    borderColor: theme === 'dark' ? '#2A2E39' : '#e0e3eb',
                },
            });
        }
    }, [theme]);

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

        // Update indicators only with past data
        updateIndicators(pastData, indicators);
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
        chartRef.current.subscribeClick(handleChartClick);

        return () => {
            if (chartRef.current) {
                chartRef.current.unsubscribeClick(handleChartClick);
            }
        };
    }, [isSelectingReplayPoint, updateReplayData]);

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

            {/* OHLC Header Bar */}
            {ohlcData && (
                <div className={styles.ohlcHeader} style={{ left: isToolbarVisible ? '55px' : '10px' }}>
                    <span className={styles.ohlcSymbol}>{symbol} · {interval.toUpperCase()}</span>
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
                </div>
            )}



            {/* Replay Controls */}
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


        </div>
    );
});

export default ChartComponent;
