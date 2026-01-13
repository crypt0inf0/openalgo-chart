/**
 * ChartContext - Centralized chart state management
 * Manages: charts array, active chart, layout, intervals, indicators
 */

import React, { createContext, useContext, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../constants/storageKeys';
import logger from '../utils/logger';

// Default chart configuration
const DEFAULT_CHART = {
    id: 1,
    symbol: 'NIFTY 50',
    exchange: 'NSE',
    interval: '1d',
    indicators: [],
    comparisonSymbols: [],
    strategyConfig: null
};

// Create context
const ChartContext = createContext(null);

/**
 * ChartProvider - Provides chart state to the app
 */
export const ChartProvider = ({ children }) => {
    // Layout state
    const [layout, setLayout] = useLocalStorage(STORAGE_KEYS.SAVED_LAYOUT + '_layout', '1');

    // Active chart ID
    const [activeChartId, setActiveChartId] = useState(1);

    // Charts array with localStorage persistence
    const [charts, setCharts] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.SAVED_LAYOUT);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && Array.isArray(parsed.charts) && parsed.charts.length > 0) {
                    return parsed.charts.map(chart => ({
                        ...DEFAULT_CHART,
                        ...chart,
                        indicators: chart.indicators || [],
                        comparisonSymbols: chart.comparisonSymbols || []
                    }));
                }
            }
        } catch (e) {
            logger.warn('[ChartContext] Failed to load saved charts:', e);
        }
        return [{ ...DEFAULT_CHART }];
    });

    // Refs for chart instances
    const chartRefs = useRef({});

    // Derived: Active chart object
    const activeChart = useMemo(
        () => charts.find(c => c.id === activeChartId) || charts[0],
        [charts, activeChartId]
    );

    // Derived: Current symbol/exchange/interval from active chart
    const currentSymbol = activeChart?.symbol || 'NIFTY 50';
    const currentExchange = activeChart?.exchange || 'NSE';
    const currentInterval = activeChart?.interval || '1d';

    // Auto-save charts to localStorage
    useEffect(() => {
        const layoutData = { layout, charts };
        try {
            localStorage.setItem(STORAGE_KEYS.SAVED_LAYOUT, JSON.stringify(layoutData));
            logger.debug('[ChartContext] Auto-saved layout:', { layout, chartsCount: charts.length });
        } catch (e) {
            logger.warn('[ChartContext] Failed to save layout:', e);
        }
    }, [layout, charts]);

    // Save interval to separate key for quick access
    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.INTERVAL, currentInterval);
    }, [currentInterval]);

    // ============ CHART HANDLERS ============

    // Update symbol for active chart
    const updateSymbol = useCallback((symbol, exchange = 'NSE') => {
        setCharts(prev => prev.map(chart =>
            chart.id === activeChartId
                ? { ...chart, symbol, exchange, strategyConfig: null }
                : chart
        ));
    }, [activeChartId]);

    // Update interval for active chart
    const updateInterval = useCallback((interval) => {
        setCharts(prev => prev.map(chart =>
            chart.id === activeChartId
                ? { ...chart, interval }
                : chart
        ));
    }, [activeChartId]);

    // ============ INDICATOR HANDLERS ============

    // Add indicator to active chart
    const addIndicator = useCallback((indicator) => {
        setCharts(prev => prev.map(chart => {
            if (chart.id !== activeChartId) return chart;
            return {
                ...chart,
                indicators: [...(chart.indicators || []), indicator]
            };
        }));
    }, [activeChartId]);

    // Remove indicator from active chart
    const removeIndicator = useCallback((indicatorId) => {
        setCharts(prev => prev.map(chart => {
            if (chart.id !== activeChartId) return chart;
            return {
                ...chart,
                indicators: (chart.indicators || []).filter(ind => ind.id !== indicatorId)
            };
        }));
    }, [activeChartId]);

    // Toggle indicator visibility
    const toggleIndicatorVisibility = useCallback((indicatorId) => {
        setCharts(prev => prev.map(chart => {
            if (chart.id !== activeChartId) return chart;
            return {
                ...chart,
                indicators: (chart.indicators || []).map(ind =>
                    ind.id === indicatorId ? { ...ind, visible: !ind.visible } : ind
                )
            };
        }));
    }, [activeChartId]);

    // Update indicator settings
    const updateIndicatorSettings = useCallback((indicatorId, newSettings) => {
        setCharts(prev => prev.map(chart => {
            if (chart.id !== activeChartId) return chart;
            return {
                ...chart,
                indicators: (chart.indicators || []).map(ind =>
                    ind.id === indicatorId ? { ...ind, ...newSettings } : ind
                )
            };
        }));
    }, [activeChartId]);

    // Set all indicators for active chart
    const setIndicators = useCallback((newIndicators) => {
        setCharts(prev => prev.map(chart => {
            if (chart.id !== activeChartId) return chart;
            return { ...chart, indicators: newIndicators };
        }));
    }, [activeChartId]);

    // ============ COMPARISON SYMBOLS ============

    // Add comparison symbol
    const addComparisonSymbol = useCallback((symbol, exchange, color) => {
        setCharts(prev => prev.map(chart => {
            if (chart.id !== activeChartId) return chart;
            const current = chart.comparisonSymbols || [];
            const exists = current.find(c => c.symbol === symbol && c.exchange === exchange);
            if (exists) return chart;
            return {
                ...chart,
                comparisonSymbols: [...current, { symbol, exchange, color }]
            };
        }));
    }, [activeChartId]);

    // Remove comparison symbol
    const removeComparisonSymbol = useCallback((symbol, exchange) => {
        setCharts(prev => prev.map(chart => {
            if (chart.id !== activeChartId) return chart;
            return {
                ...chart,
                comparisonSymbols: (chart.comparisonSymbols || []).filter(
                    c => !(c.symbol === symbol && c.exchange === exchange)
                )
            };
        }));
    }, [activeChartId]);

    // ============ STRATEGY CONFIG ============

    // Update strategy config for active chart
    const updateStrategyConfig = useCallback((config) => {
        setCharts(prev => prev.map(chart =>
            chart.id === activeChartId
                ? { ...chart, strategyConfig: config }
                : chart
        ));
    }, [activeChartId]);

    // ============ MULTI-CHART MANAGEMENT ============

    // Add new chart
    const addChart = useCallback(() => {
        const newId = Math.max(...charts.map(c => c.id)) + 1;
        const newChart = {
            ...DEFAULT_CHART,
            id: newId
        };
        setCharts(prev => [...prev, newChart]);
        setActiveChartId(newId);
        return newId;
    }, [charts]);

    // Remove chart
    const removeChart = useCallback((chartId) => {
        if (charts.length <= 1) return; // Keep at least one chart
        setCharts(prev => prev.filter(c => c.id !== chartId));
        if (activeChartId === chartId) {
            const remaining = charts.filter(c => c.id !== chartId);
            setActiveChartId(remaining[0]?.id || 1);
        }
    }, [charts, activeChartId]);

    // Get chart ref
    const getChartRef = useCallback((chartId) => {
        return chartRefs.current[chartId];
    }, []);

    // Context value
    const value = useMemo(() => ({
        // State
        charts,
        setCharts,
        activeChartId,
        setActiveChartId,
        layout,
        setLayout,
        chartRefs,

        // Derived
        activeChart,
        currentSymbol,
        currentExchange,
        currentInterval,

        // Chart handlers
        updateSymbol,
        updateInterval,

        // Indicator handlers
        addIndicator,
        removeIndicator,
        toggleIndicatorVisibility,
        updateIndicatorSettings,
        setIndicators,

        // Comparison symbols
        addComparisonSymbol,
        removeComparisonSymbol,

        // Strategy
        updateStrategyConfig,

        // Multi-chart
        addChart,
        removeChart,
        getChartRef
    }), [
        charts,
        activeChartId,
        layout,
        activeChart,
        currentSymbol,
        currentExchange,
        currentInterval,
        updateSymbol,
        updateInterval,
        addIndicator,
        removeIndicator,
        toggleIndicatorVisibility,
        updateIndicatorSettings,
        setIndicators,
        addComparisonSymbol,
        removeComparisonSymbol,
        updateStrategyConfig,
        addChart,
        removeChart,
        getChartRef
    ]);

    return (
        <ChartContext.Provider value={value}>
            {children}
        </ChartContext.Provider>
    );
};

/**
 * useChart hook - Access chart context
 */
export const useChart = () => {
    const context = useContext(ChartContext);
    if (!context) {
        throw new Error('useChart must be used within a ChartProvider');
    }
    return context;
};

export default ChartContext;
