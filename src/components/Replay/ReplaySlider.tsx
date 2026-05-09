import React, { useEffect, useRef, useState } from 'react';
import type { RefObject, MouseEvent as ReactMouseEvent } from 'react';
import styles from './ReplaySlider.module.css';
import logger from '../../utils/logger';

interface CandleData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
}

interface ChartApi {
    timeScale: () => {
        timeToCoordinate: (time: number) => number | null;
    };
}

export interface ReplaySliderProps {
    chartRef: RefObject<ChartApi | null>;
    isReplayMode: boolean;
    replayIndex: number | null;
    fullData: CandleData[] | null;
    onSliderChange?: (index: number, hideFuture: boolean) => void;
    containerRef: RefObject<HTMLDivElement | null>;
    isPlaying?: boolean;
}

const ReplaySlider: React.FC<ReplaySliderProps> = ({
    chartRef,
    isReplayMode,
    replayIndex,
    fullData,
    onSliderChange,
    containerRef,
    isPlaying = false
}) => {
    const [sliderPosition, setSliderPosition] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isMouseInChart, setIsMouseInChart] = useState(false);
    const [isHandleHovered, setIsHandleHovered] = useState(false);
    const [justClicked, setJustClicked] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const sliderRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Track playback state changes
    const prevIsPlayingRef = useRef(isPlaying);
    useEffect(() => {
        if (isPlaying && !prevIsPlayingRef.current) {
            setIsLocked(false);
            setJustClicked(false);
        } else if (!isPlaying && prevIsPlayingRef.current) {
            setIsLocked(true);
        }
        prevIsPlayingRef.current = isPlaying;
    }, [isPlaying]);

    // Lock slider when replayIndex changes from a click
    const prevReplayIndexRef = useRef(replayIndex);
    useEffect(() => {
        if (!isReplayMode || isPlaying) {
            prevReplayIndexRef.current = replayIndex;
            return;
        }

        if (replayIndex !== prevReplayIndexRef.current && replayIndex !== null) {
            setIsLocked(true);
            setJustClicked(true);
            setTimeout(() => setJustClicked(false), 150);
        }

        prevReplayIndexRef.current = replayIndex;
    }, [replayIndex, isReplayMode, isPlaying]);

    // Calculate slider position based on replay index
    useEffect(() => {
        if (!isReplayMode || !fullData || fullData.length === 0 || replayIndex === null) {
            return;
        }

        if (!isDragging && (!isMouseInChart || isLocked || isPlaying)) {
            const progress = (replayIndex + 1) / fullData.length;
            const containerWidth = containerRef?.current?.clientWidth || 0;
            const position = progress * containerWidth;
            setSliderPosition(position);
        }
    }, [replayIndex, fullData, isReplayMode, containerRef, isDragging, isMouseInChart, isLocked, isPlaying]);

    // Handle mouse move for slider follow within chart bounds
    useEffect(() => {
        if (!isReplayMode || !containerRef.current) return;

        const handleMouseMove = (e: globalThis.MouseEvent): void => {
            if (isLocked || justClicked || isPlaying) return;

            const rect = containerRef.current!.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const containerWidth = rect.width;

            if (x >= 0 && x <= containerWidth) {
                setIsMouseInChart(true);

                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                }

                animationFrameRef.current = requestAnimationFrame(() => {
                    setSliderPosition(x);
                });
            }
        };

        const handleMouseLeave = (): void => {
            setIsMouseInChart(false);
        };

        const handleMouseEnter = (e: globalThis.MouseEvent): void => {
            if (isLocked || isPlaying) return;

            setIsMouseInChart(true);
            const rect = containerRef.current!.getBoundingClientRect();
            const x = e.clientX - rect.left;
            if (x >= 0 && x <= rect.width) {
                setSliderPosition(x);
            }
        };

        const container = containerRef.current;
        container.addEventListener('mousemove', handleMouseMove);
        container.addEventListener('mouseleave', handleMouseLeave);
        container.addEventListener('mouseenter', handleMouseEnter);

        return () => {
            container.removeEventListener('mousemove', handleMouseMove);
            container.removeEventListener('mouseleave', handleMouseLeave);
            container.removeEventListener('mouseenter', handleMouseEnter);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isReplayMode, containerRef, justClicked, isLocked, isPlaying]);

    // Handle drag state changes
    useEffect(() => {
        if (!isDragging) return;

        let lastUpdateTime = 0;
        const throttleMs = 50;

        const handleMouseMove = (e: globalThis.MouseEvent): void => {
            if (!containerRef.current || !fullData || fullData.length === 0) return;

            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const containerWidth = rect.width;

            const clampedX = Math.max(0, Math.min(x, containerWidth));
            setSliderPosition(clampedX);

            const now = Date.now();
            if (now - lastUpdateTime >= throttleMs) {
                lastUpdateTime = now;

                const progress = clampedX / containerWidth;
                const newReplayIndex = Math.max(0, Math.min(Math.floor(progress * fullData.length), fullData.length - 1));

                if (onSliderChange) {
                    onSliderChange(newReplayIndex, false);
                }
            }
        };

        const handleMouseUp = (e: globalThis.MouseEvent): void => {
            setIsDragging(false);

            if (containerRef.current && fullData && fullData.length > 0) {
                const rect = containerRef.current.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const containerWidth = rect.width;
                const clampedX = Math.max(0, Math.min(x, containerWidth));
                const progress = clampedX / containerWidth;
                const finalIndex = Math.max(0, Math.min(Math.floor(progress * fullData.length), fullData.length - 1));

                setSliderPosition(clampedX);

                if (onSliderChange) {
                    onSliderChange(finalIndex, true);
                }
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, containerRef, fullData, onSliderChange]);

    if (!isReplayMode) return null;

    const showSlider = (isMouseInChart && !isLocked && !isPlaying) || isDragging;

    const getReplayPosition = (): number | null => {
        if (!chartRef.current || !fullData || replayIndex === null) return null;

        try {
            const timeScale = chartRef.current.timeScale();
            const replayTime = fullData[replayIndex]?.time;

            if (replayTime) {
                const x = timeScale.timeToCoordinate(replayTime);
                return x;
            }
        } catch (e) {
            logger.error('Error calculating replay position:', e);
        }

        return null;
    };

    const replayPosition = getReplayPosition();
    const showFadeOverlay = showSlider && !isLocked && !isPlaying;
    const fadePosition = sliderPosition;

    return (
        <>
            {/* Faded overlay for future candles */}
            {showFadeOverlay && fadePosition !== null && (
                <div
                    className={styles.fadeOverlay}
                    style={{
                        left: `${fadePosition}px`,
                        width: `calc(100% - ${fadePosition}px)`
                    }}
                />
            )}

            {/* Slider line and handle */}
            {showSlider && (
                <div
                    ref={sliderRef}
                    className={styles.sliderContainer}
                    style={{ left: `${sliderPosition}px` }}
                >
                    <div className={styles.sliderLine} />
                    <div
                        className={styles.sliderHandle}
                        onMouseDown={(e: ReactMouseEvent<HTMLDivElement>) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDragging(true);
                        }}
                        onMouseEnter={() => setIsHandleHovered(true)}
                        onMouseLeave={() => setIsHandleHovered(false)}
                    />
                    {/* Time tooltip */}
                    {(isHandleHovered || isDragging) && replayIndex !== null && fullData && replayIndex < fullData.length && (
                        <div className={styles.timeTooltip}>
                            {new Date(fullData[replayIndex].time * 1000).toLocaleString()}
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default ReplaySlider;
