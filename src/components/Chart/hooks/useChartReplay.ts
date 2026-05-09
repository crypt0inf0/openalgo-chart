import { useState, useRef, useEffect, useCallback, RefObject } from 'react';
import { transformData } from '../utils/seriesFactories';
import { DEFAULT_VIEW_WINDOW } from '../utils/chartConfig';
import logger from '../../../utils/logger';

export interface UseChartReplayOptions {
    chartRef: RefObject<any>;
    mainSeriesRef: RefObject<any>;
    chartTypeRef: RefObject<string>;
    dataRef: RefObject<any[]>;
    priceScaleTimerRef?: RefObject<any>;
    chartContainerRef?: RefObject<HTMLDivElement>;
    indicatorsRef?: RefObject<any[]>;
    updateIndicators?: (data: any[], indicators: any[]) => void;
    updateAxisLabel?: () => void;
    onReplayModeChange?: (isReplay: boolean) => void;
}

export interface UseChartReplayReturn {
    isReplayMode: boolean;
    isPlaying: boolean;
    replayIndex: number | null;
    isReplayModeRef: RefObject<boolean>;
    fullDataRef: RefObject<any[]>;
    fadedSeriesRef: RefObject<any>;
    updateReplayDataRef: RefObject<((index: number, hideFeature?: boolean, preserveView?: boolean) => void) | null>;
    toggleReplay: () => void;
    handleReplayPlayPause: () => void;
    handleReplayForward: () => void;
    handleSliderChange: (index: number, hideFuture?: boolean) => void;
    closeReplay: () => void;
    updateReplayData: (index: number, hideFeature?: boolean, preserveView?: boolean) => void;
    stopReplay: () => void;
}

// Fixed playback speed: 1 bar per second
const REPLAY_INTERVAL_MS = 1000;

/**
 * Custom hook for chart replay mode functionality.
 * 3 states: Off → Paused → Playing
 * Slider drag and chart click both reposition the replay point.
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
}: UseChartReplayOptions): UseChartReplayReturn {
    const [isReplayMode, setIsReplayMode] = useState<boolean>(false);
    const isReplayModeRef = useRef<boolean>(false);

    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [replayIndex, setReplayIndex] = useState<number | null>(null);

    const fullDataRef = useRef<any[]>([]);
    const replayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const fadedSeriesRef = useRef<any>(null);

    const replayIndexRef = useRef<number | null>(null);
    const isPlayingRef = useRef<boolean>(false);
    const updateReplayDataRef = useRef<((index: number, hideFeature?: boolean, preserveView?: boolean) => void) | null>(null);

    useEffect(() => { isReplayModeRef.current = isReplayMode; }, [isReplayMode]);
    useEffect(() => { replayIndexRef.current = replayIndex; }, [replayIndex]);
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

    const stopReplay = useCallback(() => {
        if (replayIntervalRef.current) {
            clearInterval(replayIntervalRef.current);
            replayIntervalRef.current = null;
        }
    }, []);

    const updateReplayData = useCallback((index: number, hideFeature: boolean = true, preserveView: boolean = false) => {
        if (!mainSeriesRef.current || !fullDataRef.current || !chartRef.current) return;

        const clampedIndex = Math.max(0, Math.min(index, fullDataRef.current.length - 1));

        let currentVisibleRange: any = null;
        if (preserveView && chartRef.current) {
            try {
                currentVisibleRange = chartRef.current.timeScale().getVisibleLogicalRange();
            } catch (e) { /* ignore */ }
        }

        const pastData = fullDataRef.current.slice(0, clampedIndex + 1);

        if (hideFeature) {
            dataRef.current = pastData;
            mainSeriesRef.current.setData(transformData(pastData, chartTypeRef.current || 'candlestick'));
        } else {
            dataRef.current = fullDataRef.current;
            mainSeriesRef.current.setData(transformData(fullDataRef.current, chartTypeRef.current || 'candlestick'));
        }

        if (updateIndicators && indicatorsRef?.current) {
            updateIndicators(pastData, indicatorsRef.current);
        }

        if (updateAxisLabel) updateAxisLabel();

        if (priceScaleTimerRef?.current && pastData.length > 0) {
            const last = pastData[pastData.length - 1];
            if (last?.open !== undefined && last?.close !== undefined) {
                priceScaleTimerRef.current.updateCandleData(last.open, last.close);
            }
        }

        replayIndexRef.current = clampedIndex;

        if (preserveView && currentVisibleRange && chartRef.current) {
            try {
                setTimeout(() => {
                    chartRef.current.timeScale().setVisibleLogicalRange(currentVisibleRange);
                }, 0);
            } catch (e) { /* ignore */ }
        }
    }, [chartRef, mainSeriesRef, chartTypeRef, dataRef, priceScaleTimerRef, indicatorsRef, updateIndicators, updateAxisLabel]);

    useEffect(() => {
        updateReplayDataRef.current = updateReplayData;
    }, [updateReplayData]);

    const toggleReplay = useCallback(() => {
        setIsReplayMode(prev => {
            const entering = !prev;
            if (entering) {
                fullDataRef.current = [...(dataRef.current || [])];
                setIsPlaying(false);
                isPlayingRef.current = false;
                const startIndex = Math.max(0, (dataRef.current?.length || 1) - 1);
                setReplayIndex(startIndex);
                replayIndexRef.current = startIndex;
                setTimeout(() => {
                    updateReplayDataRef.current?.(startIndex, false);
                }, 0);
            } else {
                stopReplay();
                setIsPlaying(false);
                isPlayingRef.current = false;
                setReplayIndex(null);
                replayIndexRef.current = null;

                if (fadedSeriesRef.current && chartRef.current) {
                    try { chartRef.current.removeSeries(fadedSeriesRef.current); } catch (e) {
                        logger.warn('Error removing faded series:', e);
                    }
                    fadedSeriesRef.current = null;
                }

                if (mainSeriesRef.current && fullDataRef.current.length > 0) {
                    dataRef.current = fullDataRef.current;
                    mainSeriesRef.current.setData(transformData(fullDataRef.current, chartTypeRef.current || 'candlestick'));
                    if (updateIndicators && indicatorsRef?.current) {
                        updateIndicators(fullDataRef.current, indicatorsRef.current);
                    }
                }
            }

            if (onReplayModeChange) setTimeout(() => onReplayModeChange(entering), 0);
            return entering;
        });
    }, [chartRef, mainSeriesRef, chartTypeRef, dataRef, indicatorsRef, updateIndicators, stopReplay, onReplayModeChange]);

    const handleReplayPlayPause = useCallback(() => {
        setIsPlaying(prev => !prev);
    }, []);

    const handleReplayForward = useCallback(() => {
        const current = replayIndexRef.current;
        if (current !== null && current < fullDataRef.current.length - 1) {
            const next = current + 1;
            setReplayIndex(next);
            updateReplayData(next);
        }
    }, [updateReplayData]);

    const handleSliderChange = useCallback((index: number, hideFuture: boolean = true) => {
        if (index >= 0 && index < fullDataRef.current.length) {
            if (isPlayingRef.current) {
                setIsPlaying(false);
                isPlayingRef.current = false;
                stopReplay();
            }
            setReplayIndex(index);
            updateReplayData(index, hideFuture);
        }
    }, [updateReplayData, stopReplay]);

    const closeReplay = useCallback(() => {
        setIsReplayMode(false);
        if (onReplayModeChange) onReplayModeChange(false);
        if (mainSeriesRef.current && fullDataRef.current.length > 0) {
            dataRef.current = fullDataRef.current;
            mainSeriesRef.current.setData(transformData(fullDataRef.current, chartTypeRef.current || 'candlestick'));
            if (updateIndicators && indicatorsRef?.current) {
                updateIndicators(fullDataRef.current, indicatorsRef.current);
            }
        }
    }, [chartTypeRef, dataRef, mainSeriesRef, indicatorsRef, updateIndicators, onReplayModeChange]);

    // Auto-play at fixed 1 bar/second
    useEffect(() => {
        if (isPlaying && isReplayMode) {
            stopReplay();
            const current = replayIndexRef.current;
            if (current !== null) updateReplayData(current, true);

            replayIntervalRef.current = setInterval(() => {
                const idx = replayIndexRef.current;
                if (idx === null || idx >= fullDataRef.current.length - 1) {
                    setIsPlaying(false);
                    isPlayingRef.current = false;
                    return;
                }
                const next = idx + 1;
                setReplayIndex(next);
                updateReplayData(next, true);
            }, REPLAY_INTERVAL_MS);
        } else {
            stopReplay();
        }
        return () => stopReplay();
    }, [isPlaying, isReplayMode, updateReplayData, stopReplay]);

    // Chart click repositions replay (when paused)
    useEffect(() => {
        if (!chartRef.current || !isReplayMode || isPlaying) return;
        if (!mainSeriesRef.current) return;

        const handleClick = (param: any) => {
            if (!param || !fullDataRef.current?.length) return;
            if (isPlayingRef.current) return;

            try {
                let clickedTime: number | null = null;
                if (param.time) {
                    clickedTime = param.time;
                } else if (param.point) {
                    clickedTime = chartRef.current.timeScale().coordinateToTime(param.point.x);
                }
                if (!clickedTime) return;

                let clickedIndex = -1;
                let minDiff = Infinity;
                for (let i = 0; i < fullDataRef.current.length; i++) {
                    const diff = Math.abs(fullDataRef.current[i].time - clickedTime);
                    if (diff < minDiff) { minDiff = diff; clickedIndex = i; }
                }
                if (clickedIndex === -1) clickedIndex = fullDataRef.current.length - 1;
                clickedIndex = Math.max(0, Math.min(clickedIndex, fullDataRef.current.length - 1));

                let currentVisibleRange: any = null;
                try { currentVisibleRange = chartRef.current.timeScale().getVisibleRange(); } catch (e) { /* ignore */ }

                setReplayIndex(clickedIndex);
                replayIndexRef.current = clickedIndex;
                updateReplayData(clickedIndex, true);

                if (currentVisibleRange && chartRef.current) {
                    setTimeout(() => {
                        try {
                            const ts = chartRef.current.timeScale();
                            const clickedCandleTime = fullDataRef.current[clickedIndex]?.time;
                            if (clickedCandleTime && currentVisibleRange.to > clickedCandleTime) {
                                const width = currentVisibleRange.to - currentVisibleRange.from;
                                ts.setVisibleRange({ from: clickedCandleTime - width, to: clickedCandleTime });
                            } else {
                                ts.setVisibleRange(currentVisibleRange);
                            }
                        } catch (e) { /* ignore */ }
                    }, 0);
                }
            } catch (e) {
                logger.warn('Error handling replay click:', e);
            }
        };

        chartRef.current.subscribeClick(handleClick);
        return () => {
            if (chartRef.current) chartRef.current.unsubscribeClick(handleClick);
        };
    }, [chartRef, mainSeriesRef, isReplayMode, isPlaying, updateReplayData]);

    return {
        isReplayMode,
        isPlaying,
        replayIndex,
        isReplayModeRef,
        fullDataRef,
        fadedSeriesRef,
        updateReplayDataRef,
        toggleReplay,
        handleReplayPlayPause,
        handleReplayForward,
        handleSliderChange,
        closeReplay,
        updateReplayData,
        stopReplay,
    };
}

export default useChartReplay;
