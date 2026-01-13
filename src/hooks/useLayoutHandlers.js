/**
 * Layout Handlers Hook
 * Manages chart layout operations: change layout, maximize/restore, save layout
 */

import { useCallback } from 'react';
import { saveUserPreferences } from '../services/openalgo';

// Keys to sync with cloud when saving layout
const SYNC_KEYS = [
    'tv_saved_layout', 'tv_watchlists', 'tv_theme', 'tv_fav_intervals_v2',
    'tv_custom_intervals', 'tv_drawing_defaults', 'tv_alerts', 'tv_alert_logs',
    'tv_last_nonfav_interval', 'tv_interval', 'tv_chart_appearance',
    'tv_drawing_templates', 'tv_template_favorites', 'tv_symbol_favorites',
    'tv_recent_symbols', 'tv_layout_templates', 'tv_favorite_drawing_tools',
    'tv_floating_toolbar_pos', 'tv_recent_commands'
];

/**
 * Custom hook for layout operations
 * @param {Object} params - Hook parameters
 * @param {string} params.layout - Current layout value
 * @param {Function} params.setLayout - State setter for layout
 * @param {Array} params.charts - Current charts array
 * @param {Function} params.setCharts - State setter for charts
 * @param {Object} params.activeChart - Currently active chart object
 * @param {string|number} params.activeChartId - Currently active chart ID
 * @param {Function} params.setActiveChartId - State setter for active chart ID
 * @param {boolean} params.isMaximized - Whether chart is maximized
 * @param {Function} params.setIsMaximized - State setter for maximized state
 * @param {Object} params.prevLayoutRef - Ref to store previous layout
 * @param {Function} params.showSnapshotToast - Function to show snapshot toast
 * @param {Function} params.showToast - Toast notification function
 * @returns {Object} Layout handler functions
 */
export const useLayoutHandlers = ({
    layout,
    setLayout,
    charts,
    setCharts,
    activeChart,
    activeChartId,
    setActiveChartId,
    isMaximized,
    setIsMaximized,
    prevLayoutRef,
    showSnapshotToast,
    showToast
}) => {
    // Handle layout change (1, 2, 3, 4 charts)
    const handleLayoutChange = useCallback((newLayout) => {
        setLayout(newLayout);
        const count = parseInt(newLayout);
        setCharts(prev => {
            const newCharts = [...prev];
            if (newCharts.length < count) {
                // Add new charts with empty indicators array
                for (let i = newCharts.length; i < count; i++) {
                    newCharts.push({
                        id: i + 1,
                        symbol: activeChart.symbol,
                        exchange: activeChart.exchange || 'NSE',
                        interval: activeChart.interval,
                        indicators: [],
                        comparisonSymbols: [],
                        strategyConfig: null
                    });
                }
            } else if (newCharts.length > count) {
                // Remove charts
                newCharts.splice(count);
            }
            return newCharts;
        });
        // Ensure active chart is valid
        if (activeChartId > count) {
            setActiveChartId(1);
        }
    }, [setLayout, setCharts, activeChart, activeChartId, setActiveChartId]);

    // Handle Alt+click maximize/restore for split charts
    const handleMaximizeChart = useCallback((chartId) => {
        if (!isMaximized) {
            // Maximize: save current layout and switch to single chart
            prevLayoutRef.current = layout;
            setIsMaximized(true);
            setLayout('1');
            setActiveChartId(chartId);
        } else {
            // Restore: go back to previous layout
            setIsMaximized(false);
            if (prevLayoutRef.current && prevLayoutRef.current !== '1') {
                setLayout(prevLayoutRef.current);
            }
            prevLayoutRef.current = null;
        }
    }, [isMaximized, layout, setIsMaximized, setLayout, setActiveChartId, prevLayoutRef]);

    // Save layout to localStorage and cloud
    const handleSaveLayout = useCallback(async () => {
        const layoutData = {
            layout,
            charts
        };
        try {
            // Save to localStorage
            localStorage.setItem('tv_saved_layout', JSON.stringify(layoutData));

            // Immediately sync to cloud
            const prefsToSave = {};
            SYNC_KEYS.forEach(key => {
                const value = localStorage.getItem(key);
                if (value !== null) {
                    prefsToSave[key] = value;
                }
            });

            const success = await saveUserPreferences(prefsToSave);
            if (success) {
                showSnapshotToast('Layout saved to cloud');
            } else {
                showSnapshotToast('Layout saved locally');
            }
        } catch (error) {
            console.error('Failed to save layout:', error);
            showToast('Failed to save layout', 'error');
        }
    }, [layout, charts, showSnapshotToast, showToast]);

    return {
        handleLayoutChange,
        handleMaximizeChart,
        handleSaveLayout
    };
};

export default useLayoutHandlers;
