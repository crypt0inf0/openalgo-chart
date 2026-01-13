/**
 * usePaneMenu Hook
 * Handles pane context menu operations (maximize, collapse, move, delete)
 */

import { useState, useCallback } from 'react';

/**
 * Custom hook for managing pane context menu and pane operations
 * @param {Object} options - Hook options
 * @param {React.RefObject} options.chartRef - Reference to the chart instance
 * @param {React.RefObject} options.indicatorPanesMap - Map of indicator IDs to pane instances
 * @param {Function} options.onIndicatorRemove - Callback when indicator is removed
 * @returns {Object} Pane menu state and handlers
 */
export const usePaneMenu = ({ chartRef, indicatorPanesMap, onIndicatorRemove }) => {
    // Pane context menu state
    const [paneContextMenu, setPaneContextMenu] = useState({
        show: false,
        x: 0,
        y: 0,
        paneId: null
    });

    // Track maximized and collapsed panes
    const [maximizedPane, setMaximizedPane] = useState(null);
    const [collapsedPanes, setCollapsedPanes] = useState(new Set());

    // Show pane context menu
    const handlePaneMenu = useCallback((paneId, x, y) => {
        setPaneContextMenu({ show: true, x, y, paneId });
    }, []);

    // Close pane context menu
    const closePaneMenu = useCallback(() => {
        setPaneContextMenu({ show: false, x: 0, y: 0, paneId: null });
    }, []);

    // Maximize/Restore pane
    const handleMaximizePane = useCallback((paneId) => {
        if (!chartRef.current) return;

        try {
            const allPanes = chartRef.current.panes ? chartRef.current.panes() : [];
            if (allPanes.length <= 1) return; // Only main pane, nothing to maximize

            if (maximizedPane === paneId) {
                // Restore all panes to their default heights
                allPanes.forEach((pane, index) => {
                    if (index === 0) return; // Skip main pane
                    try {
                        pane.setHeight(100); // Default height
                    } catch (e) { /* ignore */ }
                });
                setMaximizedPane(null);
            } else {
                // Maximize this pane, minimize others
                const targetPane = indicatorPanesMap.current.get(paneId);
                if (!targetPane) return;

                allPanes.forEach((pane, index) => {
                    if (index === 0) return; // Skip main pane
                    try {
                        if (pane === targetPane) {
                            pane.setHeight(300); // Maximized height
                        } else {
                            pane.setHeight(0); // Hide other panes
                        }
                    } catch (e) { /* ignore */ }
                });
                setMaximizedPane(paneId);
            }
        } catch (e) {
            console.warn('Error maximizing pane:', e);
        }
    }, [chartRef, indicatorPanesMap, maximizedPane]);

    // Collapse/Expand pane
    const handleCollapsePane = useCallback((paneId) => {
        if (!chartRef.current) return;

        try {
            const pane = indicatorPanesMap.current.get(paneId);
            if (!pane) return;

            const newCollapsed = new Set(collapsedPanes);
            if (collapsedPanes.has(paneId)) {
                // Expand
                pane.setHeight(100);
                newCollapsed.delete(paneId);
            } else {
                // Collapse
                pane.setHeight(20); // Collapsed height (just header)
                newCollapsed.add(paneId);
            }
            setCollapsedPanes(newCollapsed);
        } catch (e) {
            console.warn('Error collapsing pane:', e);
        }
    }, [chartRef, indicatorPanesMap, collapsedPanes]);

    // Move pane up
    const handleMovePaneUp = useCallback((paneId) => {
        if (!chartRef.current) return;

        try {
            const allPanes = chartRef.current.panes ? chartRef.current.panes() : [];
            const pane = indicatorPanesMap.current.get(paneId);
            if (!pane) return;

            const currentIndex = allPanes.indexOf(pane);
            if (currentIndex <= 1) return; // Can't move above main pane or already at top

            // Swap pane with the one above it using movePane API
            if (chartRef.current.movePane) {
                chartRef.current.movePane(currentIndex, currentIndex - 1);
            }
        } catch (e) {
            console.warn('Error moving pane:', e);
        }
    }, [chartRef, indicatorPanesMap]);

    // Delete pane (uses existing onIndicatorRemove)
    const handleDeletePane = useCallback((paneId) => {
        if (onIndicatorRemove) {
            onIndicatorRemove(paneId);
        }
    }, [onIndicatorRemove]);

    // Check if pane can move up (not first pane after main)
    const canPaneMoveUp = useCallback((paneId) => {
        if (!chartRef.current) return false;
        try {
            const allPanes = chartRef.current.panes ? chartRef.current.panes() : [];
            const pane = indicatorPanesMap.current.get(paneId);
            if (!pane) return false;
            const currentIndex = allPanes.indexOf(pane);
            return currentIndex > 1; // Index 0 is main, index 1 is first indicator pane
        } catch (e) {
            return false;
        }
    }, [chartRef, indicatorPanesMap]);

    return {
        // State
        paneContextMenu,
        maximizedPane,
        collapsedPanes,

        // Handlers
        handlePaneMenu,
        closePaneMenu,
        handleMaximizePane,
        handleCollapsePane,
        handleMovePaneUp,
        handleDeletePane,
        canPaneMoveUp
    };
};

export default usePaneMenu;
