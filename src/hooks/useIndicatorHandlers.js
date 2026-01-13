/**
 * Indicator Handlers Hook
 * Manages indicator operations: add, remove, toggle visibility, update settings
 */

import { useCallback } from 'react';
import { indicatorConfigs } from '../components/IndicatorSettings/indicatorConfigs';

/**
 * Custom hook for indicator operations
 * @param {Object} params - Hook parameters
 * @param {Function} params.setCharts - State setter for charts
 * @param {string} params.activeChartId - Currently active chart ID
 * @returns {Object} Indicator handler functions
 */
export const useIndicatorHandlers = ({
    setCharts,
    activeChartId
}) => {
    // Update indicator settings (period, color, etc.)
    const updateIndicatorSettings = useCallback((newIndicators) => {
        setCharts(prev => prev.map(chart => {
            if (chart.id !== activeChartId) return chart;
            return { ...chart, indicators: newIndicators };
        }));
    }, [activeChartId, setCharts]);

    // Handler for adding a new indicator instance
    const handleAddIndicator = useCallback((type) => {
        setCharts(prev => prev.map(chart => {
            if (chart.id !== activeChartId) return chart;

            const config = indicatorConfigs[type];
            const defaultSettings = {};

            // Merge defaults from config inputs
            if (config && config.inputs) {
                config.inputs.forEach(input => {
                    if (input.default !== undefined) {
                        defaultSettings[input.key] = input.default;
                    }
                });
            }

            // Merge defaults from config styles
            if (config && config.style) {
                config.style.forEach(style => {
                    if (style.default !== undefined) {
                        defaultSettings[style.key] = style.default;
                    }
                });
            }

            // Fallback defaults for legacy/hardcoded types if config missing
            if (!config) {
                if (type === 'sma') Object.assign(defaultSettings, { period: 20, color: '#2196F3' });
                if (type === 'ema') Object.assign(defaultSettings, { period: 20, color: '#FF9800' });
                if (type === 'tpo') Object.assign(defaultSettings, { blockSize: '30m', tickSize: 'auto' });
            }

            const newIndicator = {
                ...defaultSettings,
                id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: type,
                visible: true
            };

            return {
                ...chart,
                indicators: [...(chart.indicators || []), newIndicator]
            };
        }));
    }, [activeChartId, setCharts]);

    // Handler for removing indicator from pane
    const handleIndicatorRemove = useCallback((id) => {
        setCharts(prev => prev.map(chart => {
            if (chart.id !== activeChartId) return chart;
            return {
                ...chart,
                indicators: (chart.indicators || []).filter(ind => ind.id !== id)
            };
        }));
    }, [activeChartId, setCharts]);

    // Handler for toggling indicator visibility (hide/show without removing)
    const handleIndicatorVisibilityToggle = useCallback((id) => {
        setCharts(prev => prev.map(chart => {
            if (chart.id !== activeChartId) return chart;
            return {
                ...chart,
                indicators: (chart.indicators || []).map(ind => {
                    if (ind.id === id) {
                        return { ...ind, visible: !ind.visible };
                    }
                    return ind;
                })
            };
        }));
    }, [activeChartId, setCharts]);

    // Handler for updating indicator settings from TradingView-style dialog
    const handleIndicatorSettings = useCallback((id, newSettings) => {
        setCharts(prev => prev.map(chart => {
            if (chart.id !== activeChartId) return chart;
            return {
                ...chart,
                indicators: (chart.indicators || []).map(ind => {
                    if (ind.id === id) {
                        return { ...ind, ...newSettings };
                    }
                    return ind;
                })
            };
        }));
    }, [activeChartId, setCharts]);

    return {
        updateIndicatorSettings,
        handleAddIndicator,
        handleIndicatorRemove,
        handleIndicatorVisibilityToggle,
        handleIndicatorSettings
    };
};

export default useIndicatorHandlers;
