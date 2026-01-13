/**
 * Interval Handlers Hook
 * Manages chart interval operations: change, toggle favorite, add/remove custom
 */

import { useCallback } from 'react';
import {
    VALID_INTERVAL_UNITS,
    DEFAULT_FAVORITE_INTERVALS,
    isValidIntervalValue
} from '../utils/appUtils';

/**
 * Custom hook for interval operations
 * @param {Object} params - Hook parameters
 * @param {Function} params.setCharts - State setter for charts
 * @param {string} params.activeChartId - Currently active chart ID
 * @param {Array} params.favoriteIntervals - Current favorite intervals
 * @param {Function} params.setFavoriteIntervals - Setter for favorite intervals
 * @param {Function} params.setLastNonFavoriteInterval - Setter for last non-favorite interval
 * @param {Array} params.customIntervals - Current custom intervals
 * @param {Function} params.setCustomIntervals - Setter for custom intervals
 * @param {string} params.currentInterval - Currently selected interval
 * @param {Function} params.showToast - Toast notification function
 * @returns {Object} Interval handler functions
 */
export const useIntervalHandlers = ({
    setCharts,
    activeChartId,
    favoriteIntervals,
    setFavoriteIntervals,
    setLastNonFavoriteInterval,
    customIntervals,
    setCustomIntervals,
    currentInterval,
    showToast
}) => {
    // Handle interval change - track non-favorite selections
    const handleIntervalChange = useCallback((newInterval) => {
        setCharts(prev => prev.map(chart =>
            chart.id === activeChartId ? { ...chart, interval: newInterval } : chart
        ));

        // If the new interval is not a favorite, save it as the last non-favorite
        if (!favoriteIntervals.includes(newInterval)) {
            setLastNonFavoriteInterval(newInterval);
        }
    }, [setCharts, activeChartId, favoriteIntervals, setLastNonFavoriteInterval]);

    // Toggle favorite status for an interval
    const handleToggleFavorite = useCallback((interval) => {
        if (!isValidIntervalValue(interval)) {
            showToast('Invalid interval provided', 'error');
            return;
        }
        setFavoriteIntervals(prev =>
            prev.includes(interval) ? prev.filter(i => i !== interval) : [...prev, interval]
        );
    }, [setFavoriteIntervals, showToast]);

    // Add a new custom interval
    const handleAddCustomInterval = useCallback((value, unit) => {
        const numericValue = parseInt(value, 10);
        if (!Number.isFinite(numericValue) || numericValue <= 0) {
            showToast('Enter a valid number greater than 0', 'error');
            return;
        }
        const unitNormalized = VALID_INTERVAL_UNITS.has(unit) ? unit : null;
        if (!unitNormalized) {
            showToast('Invalid interval unit', 'error');
            return;
        }
        const newValue = `${numericValue}${unitNormalized}`;

        if (!isValidIntervalValue(newValue)) {
            showToast('Invalid interval format', 'error');
            return;
        }

        // Check if already exists in default or custom
        if (DEFAULT_FAVORITE_INTERVALS.includes(newValue) || customIntervals.some(i => i.value === newValue)) {
            showToast('Interval already available!', 'info');
            return;
        }

        const newInterval = { value: newValue, label: newValue, isCustom: true };
        setCustomIntervals(prev => [...prev, newInterval]);
        showToast('Custom interval added successfully!', 'success');
    }, [customIntervals, setCustomIntervals, showToast]);

    // Remove a custom interval
    const handleRemoveCustomInterval = useCallback((intervalValue) => {
        setCustomIntervals(prev => prev.filter(i => i.value !== intervalValue));
        // Also remove from favorites if present
        setFavoriteIntervals(prev => prev.filter(i => i !== intervalValue));
        // If current interval is removed, switch to default
        if (currentInterval === intervalValue) {
            handleIntervalChange('1d');
        }
    }, [setCustomIntervals, setFavoriteIntervals, currentInterval, handleIntervalChange]);

    return {
        handleIntervalChange,
        handleToggleFavorite,
        handleAddCustomInterval,
        handleRemoveCustomInterval
    };
};

export default useIntervalHandlers;
