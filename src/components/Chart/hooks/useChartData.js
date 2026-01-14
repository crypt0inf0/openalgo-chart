import { useEffect, useRef, useCallback } from 'react';
import { getKlines, getHistoricalKlines, subscribeToTicker } from '../../../services/openalgo';
import { combineMultiLegOHLC } from '../../../services/optionChain';
import { getAccurateISTTimestamp, syncTimeWithAPI, shouldResync } from '../../../services/timeService';
import { intervalToSeconds } from '../../../utils/timeframes';
import { logger } from '../../../utils/logger.js';
import { transformData } from '../utils/seriesFactories';
import { addFutureWhitespacePoints } from '../utils/chartHelpers';
import {
    DEFAULT_CANDLE_WINDOW,
    PREFETCH_THRESHOLD,
    IST_OFFSET_SECONDS,
} from '../utils/chartConfig';

/**
 * Custom hook for chart data fetching, WebSocket subscription, and scroll-back loading
 */
export function useChartData({
    chartRef,
    mainSeriesRef,
    chartTypeRef,
    dataRef,
    symbol,
    exchange,
    interval,
    strategyConfig,
    isReplayModeRef,
    priceScaleTimerRef,
    updateIndicators,
    updateAxisLabel,
    updateOhlcFromLatest,
    applyDefaultCandlePosition,
    indicatorsRef,
    onDataLoaded,
}) {
    // WebSocket refs
    const wsRef = useRef(null);
    const strategyWsRefs = useRef({}); // Map: legId -> WebSocket
    const strategyDataRef = useRef({}); // Map: legId -> data array
    const strategyLatestRef = useRef({}); // Map: legId -> latest price

    // Historical data scroll loading refs
    const isLoadingOlderDataRef = useRef(false);
    const hasMoreHistoricalDataRef = useRef(true);
    const oldestLoadedTimeRef = useRef(null);
    const abortControllerRef = useRef(null);

    // Symbol refs for closures
    const symbolRef = useRef(symbol);
    const exchangeRef = useRef(exchange);
    const intervalRef = useRef(interval);

    // Keep refs in sync with props
    useEffect(() => { symbolRef.current = symbol; }, [symbol]);
    useEffect(() => { exchangeRef.current = exchange; }, [exchange]);
    useEffect(() => { intervalRef.current = interval; }, [interval]);

    // Load older historical data when user scrolls back
    const loadOlderData = useCallback(async () => {
        if (isLoadingOlderDataRef.current || !hasMoreHistoricalDataRef.current) return;
        if (!oldestLoadedTimeRef.current || !mainSeriesRef.current || !dataRef.current) return;
        if (isReplayModeRef?.current) return;

        isLoadingOlderDataRef.current = true;

        try {
            const oldestTime = oldestLoadedTimeRef.current;
            const oldestDate = new Date((oldestTime - IST_OFFSET_SECONDS) * 1000);

            const endDate = new Date(oldestDate);
            endDate.setDate(endDate.getDate() - 1);

            const startDate = new Date(endDate);
            const currentSymbol = symbolRef.current;
            const currentExchange = exchangeRef.current;
            const currentInterval = intervalRef.current;
            const currentIndicators = indicatorsRef?.current;

            if (currentInterval.includes('m') || currentInterval.includes('h')) {
                startDate.setDate(startDate.getDate() - 30);
            } else {
                startDate.setFullYear(startDate.getFullYear() - 1);
            }

            const formatDate = (d) => d.toISOString().split('T')[0];

            logger.debug('[ScrollBack] Loading older data:', {
                symbol: currentSymbol,
                exchange: currentExchange,
                interval: currentInterval,
                startDate: formatDate(startDate),
                endDate: formatDate(endDate)
            });

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
                return;
            }

            // Filter out any candles that might overlap
            const existingOldestTime = dataRef.current[0]?.time || 0;
            const filteredOlderData = olderData.filter(d => d.time < existingOldestTime);

            if (filteredOlderData.length === 0) {
                logger.debug('[ScrollBack] All fetched data overlaps, no more available');
                hasMoreHistoricalDataRef.current = false;
                return;
            }

            logger.debug('[ScrollBack] Prepending', filteredOlderData.length, 'older candles');

            // Save current visible range
            const timeScale = chartRef.current.timeScale();
            let currentLogicalRange = null;
            try {
                currentLogicalRange = timeScale.getVisibleLogicalRange();
            } catch (e) {
                // Ignore
            }

            // Prepend older data
            const prependCount = filteredOlderData.length;
            const newData = [...filteredOlderData, ...dataRef.current];
            dataRef.current = newData;

            oldestLoadedTimeRef.current = newData[0].time;

            const activeType = chartTypeRef.current;
            const transformedData = transformData(newData, activeType);
            mainSeriesRef.current.setData(transformedData);

            // Restore visible range shifted by prepended count
            if (currentLogicalRange) {
                try {
                    const newFrom = currentLogicalRange.from + prependCount;
                    const newTo = currentLogicalRange.to + prependCount;
                    timeScale.setVisibleLogicalRange({ from: newFrom, to: newTo });
                } catch (e) {
                    console.warn('[ScrollBack] Failed to restore visible range:', e);
                }
            }

            // Update indicators
            if (updateIndicators && currentIndicators) {
                updateIndicators(newData, currentIndicators);
            }

        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('[ScrollBack] Error loading older data:', error);
            }
        } finally {
            isLoadingOlderDataRef.current = false;
        }
    }, [chartRef, mainSeriesRef, chartTypeRef, dataRef, isReplayModeRef, indicatorsRef, updateIndicators]);

    // Handle visible time range change for scroll-back loading
    const handleVisibleTimeRangeChange = useCallback((logicalRange) => {
        if (!logicalRange) return;

        const fromIndex = Math.round(logicalRange.from);
        if (fromIndex <= PREFETCH_THRESHOLD && hasMoreHistoricalDataRef.current && !isLoadingOlderDataRef.current) {
            logger.debug('[ScrollBack] Prefetching older data (user is', fromIndex, 'candles from oldest)');
            loadOlderData();
        }
    }, [loadOlderData]);

    // Main data loading effect
    useEffect(() => {
        if (!chartRef.current) return;

        let cancelled = false;
        let indicatorFrame = null;
        const abortController = new AbortController();

        // Close existing WebSocket
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        // Close all strategy WebSocket connections
        Object.values(strategyWsRefs.current).forEach(ws => {
            if (ws?.close) ws.close();
        });
        strategyWsRefs.current = {};

        // Reset scroll-back refs
        isLoadingOlderDataRef.current = false;
        hasMoreHistoricalDataRef.current = true;
        oldestLoadedTimeRef.current = null;
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }

        const loadData = async () => {
            try {
                let data;

                // Check if we're in strategy mode (multi-leg)
                if (strategyConfig && strategyConfig.legs?.length >= 2) {
                    const strategyExchange = strategyConfig.exchange || 'NFO';
                    const legDataPromises = strategyConfig.legs.map(leg =>
                        getKlines(leg.symbol, strategyExchange, interval, 1000, abortController.signal)
                    );
                    const legDataArrays = await Promise.all(legDataPromises);

                    if (cancelled) return;

                    strategyDataRef.current = {};
                    strategyConfig.legs.forEach((leg, i) => {
                        strategyDataRef.current[leg.id] = legDataArrays[i];
                    });

                    data = combineMultiLegOHLC(legDataArrays, strategyConfig.legs);
                    logger.debug('[Strategy] Combined data length:', data.length);
                } else {
                    data = await getKlines(symbol, exchange, interval, 1000, abortController.signal);
                }

                if (cancelled) return;

                if (Array.isArray(data) && data.length > 0 && mainSeriesRef.current) {
                    dataRef.current = data;
                    oldestLoadedTimeRef.current = data[0].time;

                    const activeType = chartTypeRef.current;
                    const transformedData = transformData(data, activeType);
                    const intervalSeconds = intervalToSeconds(interval);
                    const dataWithFuture = addFutureWhitespacePoints(transformedData, intervalSeconds);
                    mainSeriesRef.current.setData(dataWithFuture);

                    // Notify that data is loaded
                    if (onDataLoaded) {
                        onDataLoaded(data, intervalSeconds);
                    }

                    if (indicatorFrame) cancelAnimationFrame(indicatorFrame);
                    indicatorFrame = requestAnimationFrame(() => {
                        if (!cancelled && updateIndicators && indicatorsRef?.current) {
                            updateIndicators(data, indicatorsRef.current);
                        }
                    });

                    applyDefaultCandlePosition?.(transformedData.length, DEFAULT_CANDLE_WINDOW);

                    setTimeout(() => {
                        if (!cancelled) {
                            updateAxisLabel?.();
                        }
                    }, 50);

                    // Set up WebSocket subscriptions
                    if (strategyConfig && strategyConfig.legs?.length >= 2) {
                        setupStrategyWebSockets(strategyConfig, cancelled);
                    } else {
                        setupRegularWebSocket(cancelled);
                    }
                } else {
                    dataRef.current = [];
                    mainSeriesRef.current?.setData([]);
                }
            } catch (error) {
                if (error.name === 'AbortError') return;
                console.error('Error loading chart data:', error);
            }
        };

        // Setup strategy mode WebSockets
        const setupStrategyWebSockets = (config, cancelled) => {
            const strategyExchange = config.exchange || 'NFO';

            const handleStrategyTick = (legConfig) => (ticker) => {
                if (cancelled || !ticker) return;

                const closePrice = Number(ticker.close);
                if (!Number.isFinite(closePrice) || closePrice <= 0) return;

                strategyLatestRef.current[legConfig.id] = closePrice;

                const allLegsHaveTicks = config.legs.every(
                    leg => strategyLatestRef.current[leg.id] != null
                );
                if (!allLegsHaveTicks) return;

                const combinedClose = config.legs.reduce((sum, leg) => {
                    const price = strategyLatestRef.current[leg.id];
                    const multiplier = leg.direction === 'buy' ? 1 : -1;
                    const qty = leg.quantity || 1;
                    return sum + (multiplier * qty * price);
                }, 0);

                updateCandleWithTick(combinedClose, cancelled);
            };

            config.legs.forEach(leg => {
                strategyWsRefs.current[leg.id] = subscribeToTicker(
                    leg.symbol,
                    strategyExchange,
                    interval,
                    handleStrategyTick(leg)
                );
            });
        };

        // Setup regular WebSocket
        const setupRegularWebSocket = (cancelled) => {
            wsRef.current = subscribeToTicker(symbol, exchange, interval, (ticker) => {
                if (cancelled || !ticker) return;

                const closePrice = Number(ticker.close);
                const tickVolume = Number(ticker.volume) || 0;
                if (!Number.isFinite(closePrice) || closePrice <= 0) {
                    console.warn('Received invalid close price:', ticker);
                    return;
                }

                updateCandleWithTick(closePrice, cancelled, tickVolume);
            });
        };

        // Update candle with tick data
        const updateCandleWithTick = (closePrice, cancelled, tickVolume = 0) => {
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
                    open: closePrice,
                    high: closePrice,
                    low: closePrice,
                    close: closePrice,
                    volume: tickVolume,
                };
                currentData.push(candle);
            } else {
                const existingCandle = currentData[lastIndex];
                candle = {
                    time: lastCandleTime,
                    open: existingCandle.open,
                    high: Math.max(existingCandle.high, closePrice),
                    low: Math.min(existingCandle.low, closePrice),
                    close: closePrice,
                    volume: tickVolume,
                };
                currentData[lastIndex] = candle;
            }

            dataRef.current = currentData;
            const currentChartType = chartTypeRef.current;
            const transformedCandle = transformData([candle], currentChartType)[0];

            if (transformedCandle && mainSeriesRef.current && !isReplayModeRef?.current) {
                try {
                    const transformedFullData = transformData(currentData, currentChartType);
                    const dataWithFuture = addFutureWhitespacePoints(transformedFullData, intervalSeconds);
                    mainSeriesRef.current.setData(dataWithFuture);
                } catch (setDataErr) {
                    console.warn('[WebSocket] Failed to update chart:', setDataErr);
                }

                updateAxisLabel?.();
                updateOhlcFromLatest?.();

                if (priceScaleTimerRef?.current) {
                    priceScaleTimerRef.current.updateCandleData(candle.open, candle.close);
                }
            }
        };

        loadData();

        return () => {
            cancelled = true;
            if (indicatorFrame) cancelAnimationFrame(indicatorFrame);
            abortController.abort();
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            Object.values(strategyWsRefs.current).forEach(ws => {
                if (ws) ws.close();
            });
            strategyWsRefs.current = {};
            strategyLatestRef.current = {};
            strategyDataRef.current = {};
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbol, exchange, interval, strategyConfig]);

    return {
        // Refs
        wsRef,
        strategyWsRefs,
        strategyDataRef,
        strategyLatestRef,
        isLoadingOlderDataRef,
        hasMoreHistoricalDataRef,
        oldestLoadedTimeRef,
        abortControllerRef,
        symbolRef,
        exchangeRef,
        intervalRef,

        // Callbacks
        loadOlderData,
        handleVisibleTimeRangeChange,
    };
}

export default useChartData;
