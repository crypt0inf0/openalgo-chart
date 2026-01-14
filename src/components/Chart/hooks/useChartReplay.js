import { useState, useRef, useEffect, useCallback } from 'react';
import { transformData } from '../utils/seriesFactories';
import { DEFAULT_VIEW_WINDOW, EXTENDED_VIEW_WINDOW } from '../utils/chartConfig';

/**
 * Custom hook for chart replay mode functionality
 * Handles play/pause, forward, jump-to-bar, and slider interactions
 */
export function useChartReplay({
    chartRef,
    mainSeriesRef,
    chartTypeRef,
    dataRef,
    priceScaleTimerRef,
    chartContainerRef,
    indicatorsRef,
    updateIndicators,
    updateAxisLabel,
    onReplayModeChange,
}) {
    // Replay State
    const [isReplayMode, setIsReplayMode] = useState(false);
    const isReplayModeRef = useRef(false);

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
    const updateReplayDataRef = useRef(null);

    // Keep refs in sync with state
    useEffect(() => { isReplayModeRef.current = isReplayMode; }, [isReplayMode]);
    useEffect(() => { replayIndexRef.current = replayIndex; }, [replayIndex]);
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

    // Stop replay playback
    const stopReplay = useCallback(() => {
        if (replayIntervalRef.current) {
            clearInterval(replayIntervalRef.current);
            replayIntervalRef.current = null;
        }
    }, []);

    // Update replay data to show candles up to the specified index
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
        if (updateIndicators && indicatorsRef?.current) {
            updateIndicators(pastData, indicatorsRef.current);
        }

        if (updateAxisLabel) {
            updateAxisLabel();
        }

        // Update timer with latest candle data from replay to ensure correct color
        if (priceScaleTimerRef?.current && pastData.length > 0) {
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
    }, [chartRef, mainSeriesRef, chartTypeRef, dataRef, priceScaleTimerRef, indicatorsRef, updateIndicators, updateAxisLabel]);

    // Store updateReplayData in ref for external access
    useEffect(() => {
        updateReplayDataRef.current = updateReplayData;
    }, [updateReplayData]);

    // Toggle replay mode
    const toggleReplay = useCallback(() => {
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

                // Clean up faded series
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
                    if (updateIndicators && indicatorsRef?.current) {
                        updateIndicators(fullDataRef.current, indicatorsRef.current);
                    }
                }
            }

            // Notify parent about replay mode change
            if (onReplayModeChange) {
                setTimeout(() => onReplayModeChange(newMode), 0);
            }

            return newMode;
        });
    }, [chartRef, mainSeriesRef, chartTypeRef, dataRef, indicatorsRef, updateIndicators, stopReplay, onReplayModeChange]);

    // Handle play/pause
    const handleReplayPlayPause = useCallback(() => {
        setIsPlaying(prev => !prev);
    }, []);

    // Handle forward step
    const handleReplayForward = useCallback(() => {
        const currentIndex = replayIndexRef.current;
        if (currentIndex !== null && currentIndex < fullDataRef.current.length - 1) {
            const nextIndex = currentIndex + 1;
            setReplayIndex(nextIndex);
            updateReplayData(nextIndex);
        }
    }, [updateReplayData]);

    // Handle jump to bar (TradingView style)
    const handleReplayJumpTo = useCallback(() => {
        setIsSelectingReplayPoint(true);
        setIsPlaying(false);

        // Show ALL candles so user can see the full timeline and select a new point
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

            if (updateIndicators && indicatorsRef?.current) {
                updateIndicators(fullDataRef.current, indicatorsRef.current);
            }

            // Restore the visible range to maintain zoom level
            setTimeout(() => {
                if (chartRef.current && fullDataRef.current && fullDataRef.current.length > 0) {
                    try {
                        const timeScale = chartRef.current.timeScale();

                        if (currentVisibleRange && currentVisibleRange.from && currentVisibleRange.to) {
                            timeScale.setVisibleRange(currentVisibleRange);
                        } else if (currentReplayIndex !== null && currentReplayIndex >= 0) {
                            const currentIndex = currentReplayIndex;
                            const currentTime = fullDataRef.current[currentIndex]?.time;

                            if (currentTime) {
                                const startIndex = Math.max(0, currentIndex - DEFAULT_VIEW_WINDOW / 2);
                                const endIndex = Math.min(fullDataRef.current.length - 1, currentIndex + DEFAULT_VIEW_WINDOW / 2);
                                const startTime = fullDataRef.current[startIndex]?.time;
                                const endTime = fullDataRef.current[endIndex]?.time;

                                if (startTime && endTime) {
                                    timeScale.setVisibleRange({ from: startTime, to: endTime });
                                }
                            }
                        } else {
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
        if (chartContainerRef?.current) {
            chartContainerRef.current.style.cursor = 'crosshair';
        }
    }, [chartRef, mainSeriesRef, chartTypeRef, dataRef, chartContainerRef, indicatorsRef, updateIndicators]);

    // Handle slider change
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
    }, [updateReplayData, stopReplay]);

    // Close replay mode
    const closeReplay = useCallback(() => {
        setIsReplayMode(false);
        if (onReplayModeChange) {
            onReplayModeChange(false);
        }
        // Restore full data
        if (mainSeriesRef.current && fullDataRef.current.length > 0) {
            dataRef.current = fullDataRef.current;
            const transformedData = transformData(fullDataRef.current, chartTypeRef.current);
            mainSeriesRef.current.setData(transformedData);
            if (updateIndicators && indicatorsRef?.current) {
                updateIndicators(fullDataRef.current, indicatorsRef.current);
            }
        }
    }, [chartTypeRef, dataRef, mainSeriesRef, indicatorsRef, updateIndicators, onReplayModeChange]);

    // Playback Effect
    useEffect(() => {
        if (isPlaying && isReplayMode) {
            stopReplay();

            // When playback starts, ensure we're showing only candles up to current index
            const currentIndex = replayIndexRef.current;
            if (currentIndex !== null) {
                updateReplayData(currentIndex, true);
            }

            const intervalMs = 1000 / replaySpeed;

            replayIntervalRef.current = setInterval(() => {
                const currentIndex = replayIndexRef.current;

                if (currentIndex === null || currentIndex >= fullDataRef.current.length - 1) {
                    setIsPlaying(false);
                    isPlayingRef.current = false;
                    return;
                }

                const nextIndex = currentIndex + 1;
                setReplayIndex(nextIndex);
                updateReplayData(nextIndex, true);
            }, intervalMs);
        } else {
            stopReplay();
        }
        return () => stopReplay();
    }, [isPlaying, isReplayMode, replaySpeed, updateReplayData, stopReplay]);

    // Click Handler for Replay Mode - handles direct chart clicks
    useEffect(() => {
        if (!chartRef.current || !isReplayMode || isSelectingReplayPoint || isPlaying) return;
        if (!mainSeriesRef.current) return;

        const handleReplayClick = (param) => {
            if (!param) return;
            if (!fullDataRef.current || fullDataRef.current.length === 0) return;
            if (isSelectingReplayPoint) return;
            if (isPlayingRef.current) return;

            try {
                let clickedTime = null;

                if (param.time) {
                    clickedTime = param.time;
                } else if (param.point) {
                    const timeScale = chartRef.current.timeScale();
                    clickedTime = timeScale.coordinateToTime(param.point.x);
                }

                if (!clickedTime) return;

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

                if (clickedIndex === -1) {
                    clickedIndex = fullDataRef.current.length - 1;
                }

                clickedIndex = Math.max(0, Math.min(clickedIndex, fullDataRef.current.length - 1));

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
                updateReplayData(clickedIndex, true);

                // Restore visible range after data update
                if (currentVisibleRange && chartRef.current) {
                    setTimeout(() => {
                        try {
                            const timeScale = chartRef.current.timeScale();
                            const clickedCandleTime = fullDataRef.current[clickedIndex]?.time;
                            if (clickedCandleTime && currentVisibleRange.to > clickedCandleTime) {
                                const rangeWidth = currentVisibleRange.to - currentVisibleRange.from;
                                const newTo = clickedCandleTime;
                                const newFrom = newTo - rangeWidth;
                                timeScale.setVisibleRange({ from: newFrom, to: newTo });
                            } else {
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
    }, [chartRef, mainSeriesRef, isReplayMode, isSelectingReplayPoint, isPlaying, updateReplayData]);

    // Click Handler for "Jump to Bar"
    useEffect(() => {
        if (!chartRef.current || !isSelectingReplayPoint) return;
        if (!mainSeriesRef.current) return;

        const handleChartClick = (param) => {
            if (!param || !isSelectingReplayPoint) return;
            if (!fullDataRef.current || fullDataRef.current.length === 0) return;

            try {
                let clickedTime = null;

                if (param.time) {
                    clickedTime = param.time;
                } else if (param.point) {
                    const timeScale = chartRef.current.timeScale();
                    const x = param.point.x;
                    clickedTime = timeScale.coordinateToTime(x);
                }

                if (!clickedTime) return;

                // Find exact time match first
                let clickedIndex = fullDataRef.current.findIndex(d => d.time === clickedTime);

                // If no exact match, find the closest candle
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

                clickedIndex = Math.max(0, Math.min(clickedIndex, fullDataRef.current.length - 1));

                if (clickedIndex >= 0 && clickedIndex < fullDataRef.current.length) {
                    const selectedIndex = clickedIndex;

                    // Get current visible range BEFORE updating data
                    let currentVisibleRange = null;
                    try {
                        const timeScale = chartRef.current.timeScale();
                        currentVisibleRange = timeScale.getVisibleRange();
                    } catch (e) {
                        // Ignore
                    }

                    // Calculate the range width in time units
                    let rangeWidth = null;
                    if (currentVisibleRange && currentVisibleRange.from && currentVisibleRange.to) {
                        rangeWidth = currentVisibleRange.to - currentVisibleRange.from;
                    }

                    setReplayIndex(selectedIndex);
                    replayIndexRef.current = selectedIndex;

                    // Calculate target visible range
                    const selectedTime = fullDataRef.current[selectedIndex]?.time;
                    let targetRange = null;

                    if (selectedTime && rangeWidth && rangeWidth > 0) {
                        const newFrom = selectedTime - rangeWidth / 2;
                        const newTo = selectedTime + rangeWidth / 2;

                        const firstTime = fullDataRef.current[0]?.time;
                        const lastAvailableTime = fullDataRef.current[selectedIndex]?.time;

                        if (firstTime && lastAvailableTime) {
                            let adjustedFrom = Math.max(firstTime, newFrom);
                            let adjustedTo = Math.min(lastAvailableTime, newTo);

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

                    // If no target range calculated, use a default
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
                    if (chartContainerRef?.current) {
                        chartContainerRef.current.style.cursor = 'default';
                    }

                    // Set visible range
                    if (targetRange && chartRef.current) {
                        try {
                            const timeScale = chartRef.current.timeScale();
                            timeScale.setVisibleRange(targetRange);

                            setTimeout(() => {
                                if (chartRef.current) {
                                    try {
                                        chartRef.current.timeScale().setVisibleRange(targetRange);
                                    } catch (e) {
                                        // Ignore
                                    }
                                }
                            }, 10);

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

        if (chartRef.current) {
            chartRef.current.subscribeClick(handleChartClick);
        }

        return () => {
            if (chartRef.current) {
                chartRef.current.unsubscribeClick(handleChartClick);
            }
        };
    }, [chartRef, mainSeriesRef, chartContainerRef, isSelectingReplayPoint, updateReplayData]);

    return {
        // State
        isReplayMode,
        isPlaying,
        replaySpeed,
        replayIndex,
        isSelectingReplayPoint,

        // Refs
        isReplayModeRef,
        fullDataRef,
        fadedSeriesRef,
        updateReplayDataRef,

        // Actions
        toggleReplay,
        setReplaySpeed,
        handleReplayPlayPause,
        handleReplayForward,
        handleReplayJumpTo,
        handleSliderChange,
        closeReplay,
        updateReplayData,
        stopReplay,
    };
}

export default useChartReplay;
