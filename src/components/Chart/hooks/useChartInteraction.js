import { useState, useRef, useEffect, useCallback } from 'react';
import { formatTimeDiff, TOOL_MAP } from '../utils/chartHelpers';

/**
 * Custom hook for chart interaction handlers
 * Handles zoom, measure tool, context menu, and keyboard events
 */
export function useChartInteraction({
    chartRef,
    mainSeriesRef,
    chartContainerRef,
    lineToolManagerRef,
    activeTool,
    onToolUsed,
    isDrawingsLocked,
    isDrawingsHidden,
    isTimerVisible,
    priceScaleTimerRef,
    isSessionBreakVisible,
    exchangeRef,
    dataRef,
}) {
    // Context menu state
    const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0 });
    const [priceScaleMenu, setPriceScaleMenu] = useState({ visible: false, x: 0, y: 0, price: null });

    // Shift+Click Quick Measure Tool refs and state
    const isShiftPressedRef = useRef(false);
    const measureStartPointRef = useRef(null);
    const [measureData, setMeasureData] = useState(null);

    // Keep track of active tool for the wrapper
    const activeToolRef = useRef(activeTool);
    useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);

    // Zoom helper function
    const zoomChart = useCallback((zoomIn = true) => {
        if (!chartRef.current) return;

        try {
            const timeScale = chartRef.current.timeScale();
            const visibleRange = timeScale.getVisibleLogicalRange();

            if (!visibleRange) return;

            const { from, to } = visibleRange;
            const rangeSize = to - from;
            const center = (from + to) / 2;

            const zoomFactor = zoomIn ? 0.8 : 1.25;
            const newRangeSize = rangeSize * zoomFactor;

            const newFrom = center - newRangeSize / 2;
            const newTo = center + newRangeSize / 2;

            timeScale.setVisibleLogicalRange({ from: newFrom, to: newTo });
        } catch (err) {
            console.warn('Failed to zoom chart', err);
        }
    }, [chartRef]);

    // Close context menu on click outside
    useEffect(() => {
        if (!contextMenu.show) return;
        const handleClickAway = () => setContextMenu({ show: false, x: 0, y: 0 });
        document.addEventListener('click', handleClickAway);
        return () => document.removeEventListener('click', handleClickAway);
    }, [contextMenu.show]);

    // Handle active tool change
    useEffect(() => {
        if (lineToolManagerRef?.current && activeTool) {
            const manager = lineToolManagerRef.current;

            // Lock All Drawings
            if (activeTool === 'lock_all') {
                if (onToolUsed) onToolUsed();
                return;
            }

            // Hide All Drawings
            if (activeTool === 'hide_drawings') {
                if (onToolUsed) onToolUsed();
                return;
            }

            // Clear All Drawings
            if (activeTool === 'clear_all') {
                if (typeof manager.clearTools === 'function') {
                    manager.clearTools();
                }
                if (onToolUsed) onToolUsed();
                return;
            }

            // Show Timer
            if (activeTool === 'show_timer') {
                if (onToolUsed) onToolUsed();
                return;
            }

            const mappedTool = TOOL_MAP[activeTool] || 'None';

            if (typeof manager.startTool === 'function') {
                manager.startTool(mappedTool);
            }
        }
    }, [activeTool, onToolUsed, lineToolManagerRef]);

    // Sync drawings lock state
    useEffect(() => {
        if (!lineToolManagerRef?.current) return;
        const manager = lineToolManagerRef.current;

        const currentlyLocked = typeof manager.areDrawingsLocked === 'function'
            ? manager.areDrawingsLocked()
            : false;

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
    }, [isDrawingsLocked, lineToolManagerRef]);

    // Sync drawings visibility state
    useEffect(() => {
        if (!lineToolManagerRef?.current) return;
        const manager = lineToolManagerRef.current;

        const currentlyHidden = typeof manager.areDrawingsHidden === 'function'
            ? manager.areDrawingsHidden()
            : false;

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
    }, [isDrawingsHidden, lineToolManagerRef]);

    // Sync timer visibility state
    useEffect(() => {
        if (!priceScaleTimerRef?.current) return;
        const timer = priceScaleTimerRef.current;

        if (typeof timer.setVisible === 'function') {
            timer.setVisible(isTimerVisible);

            if (mainSeriesRef?.current) {
                mainSeriesRef.current.applyOptions({
                    lastValueVisible: !isTimerVisible
                });
            }
        }
    }, [isTimerVisible, priceScaleTimerRef, mainSeriesRef]);

    // Handle zoom clicks
    useEffect(() => {
        const isZoomIn = activeTool === 'zoom_in';
        const isZoomOut = activeTool === 'zoom_out';

        if ((!isZoomIn && !isZoomOut) || !chartContainerRef?.current) return;

        const handleZoomClick = (e) => {
            if (e.button !== 0) return;
            zoomChart(isZoomIn);
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                if (onToolUsed) onToolUsed();
            }
        };

        const container = chartContainerRef.current;
        container.addEventListener('click', handleZoomClick);
        window.addEventListener('keydown', handleKeyDown);
        container.style.cursor = isZoomIn ? 'zoom-in' : 'zoom-out';

        return () => {
            container.removeEventListener('click', handleZoomClick);
            window.removeEventListener('keydown', handleKeyDown);
            container.style.cursor = '';
        };
    }, [activeTool, zoomChart, onToolUsed, chartContainerRef]);

    // Shift+Click Quick Measure Tool - keyboard event listeners
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Shift' && !isShiftPressedRef.current) {
                isShiftPressedRef.current = true;
                if (chartContainerRef?.current) {
                    chartContainerRef.current.style.cursor = 'crosshair';
                }
            }
        };

        const handleKeyUp = (e) => {
            if (e.key === 'Shift') {
                isShiftPressedRef.current = false;
                measureStartPointRef.current = null;
                if (chartContainerRef?.current) {
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
    }, [chartContainerRef]);

    // Shift+Click Quick Measure Tool - chart click handler
    useEffect(() => {
        if (!chartRef.current || !mainSeriesRef?.current) return;

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
                setMeasureData({ isFirstPoint: true, x: param.point.x, y: param.point.y });
            } else {
                // Second click - calculate and show measurement
                const start = measureStartPointRef.current;
                const priceChange = price - start.price;
                const percentChange = (priceChange / start.price) * 100;
                const barCount = Math.abs(Math.round(logical - start.logical));

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
    }, [chartRef, mainSeriesRef]);

    // Handle session break visibility
    useEffect(() => {
        if (!lineToolManagerRef?.current) return;
        const manager = lineToolManagerRef.current;

        let cancelled = false;

        if (isSessionBreakVisible) {
            if (typeof manager.enableSessionHighlighting === 'function') {
                manager.enableSessionHighlighting();

                // Fetch session boundaries from API
                const fetchSessionData = async () => {
                    try {
                        const { getSessionBoundaries } = await import('../../../services/marketService.js');

                        if (cancelled) return;

                        const data = dataRef?.current;
                        if (!data || data.length === 0) return;

                        const uniqueDates = new Set();
                        data.forEach(candle => {
                            const date = new Date(candle.time * 1000);
                            const dateStr = date.toISOString().split('T')[0];
                            uniqueDates.add(dateStr);
                        });

                        const sessionStartTimes = new Map();
                        const currentExchange = exchangeRef?.current || 'NSE';

                        for (const dateStr of uniqueDates) {
                            if (cancelled) return;

                            try {
                                const boundaries = await getSessionBoundaries(dateStr, currentExchange);
                                if (boundaries && boundaries.start_time) {
                                    const startTimeSeconds = Math.floor(boundaries.start_time / 1000);
                                    sessionStartTimes.set(dateStr, startTimeSeconds);
                                }
                            } catch (err) {
                                // Silently ignore individual date failures
                            }
                        }

                        if (cancelled) return;

                        if (sessionStartTimes.size > 0 && typeof manager.setSessionStartTimes === 'function') {
                            manager.setSessionStartTimes(sessionStartTimes);
                        }
                    } catch (err) {
                        console.warn('[ChartComponent] Could not fetch session data:', err);
                    }
                };

                fetchSessionData();
            }
        }

        return () => {
            cancelled = true;
            const currentManager = lineToolManagerRef?.current;
            if (currentManager && typeof currentManager.disableSessionHighlighting === 'function') {
                currentManager.disableSessionHighlighting();
            }
        };
    }, [isSessionBreakVisible, lineToolManagerRef, exchangeRef, dataRef]);

    return {
        // State
        contextMenu,
        setContextMenu,
        priceScaleMenu,
        setPriceScaleMenu,
        measureData,

        // Refs
        activeToolRef,
        isShiftPressedRef,
        measureStartPointRef,

        // Actions
        zoomChart,
    };
}

export default useChartInteraction;
