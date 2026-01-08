import { useEffect, useRef } from 'react';
import { loadDrawings, saveDrawings } from '../services/openalgo';

/**
 * Hook to handle loading and auto-saving of drawings.
 * @param {Object} manager - LineToolManager instance
 * @param {string} symbol - Current symbol
 * @param {string} exchange - Current exchange
 * @param {string} interval - Current interval
 */
export const useChartDrawings = (manager, symbol, exchange, interval) => {
    // Keep track of the current manager to ensure we don't attach listeners multiple times if manager identity is stable but other deps change
    const managerRef = useRef(null);

    useEffect(() => {
        if (!manager || !symbol) return;

        managerRef.current = manager;

        // Load saved drawings from backend
        const loadSavedDrawings = async () => {
            console.log('[ChartComponent] loadSavedDrawings called for:', symbol, exchange, interval);
            try {
                const drawings = await loadDrawings(symbol, exchange, interval);
                console.log('[ChartComponent] loadDrawings result:', drawings);
                if (drawings && drawings.length > 0 && manager.importDrawings) {
                    console.log('[ChartComponent] Importing', drawings.length, 'drawings...');
                    manager.importDrawings(drawings, true);
                    console.log('[ChartComponent] Import complete!');
                } else {
                    console.log('[ChartComponent] No drawings to import or importDrawings not available');
                }
            } catch (error) {
                console.warn('[ChartComponent] Failed to load saved drawings:', error);
            }
        };
        loadSavedDrawings();

        // Set up debounced auto-save for drawings
        let saveTimeout = null;
        const autoSaveDrawings = () => {
            if (saveTimeout) clearTimeout(saveTimeout);
            saveTimeout = setTimeout(async () => {
                try {
                    if (manager.exportDrawings) {
                        const drawings = manager.exportDrawings();
                        await saveDrawings(symbol, exchange, interval, drawings);
                        console.log('[ChartComponent] Auto-saved', drawings.length, 'drawings');
                    }
                } catch (error) {
                    console.warn('[ChartComponent] Failed to auto-save drawings:', error);
                }
            }, 1000); // Debounce 1 second
        };

        // Connect auto-save to LineToolManager's onDrawingsChanged callback
        if (manager.setOnDrawingsChanged) {
            manager.setOnDrawingsChanged(() => {
                console.log('[ChartComponent] Drawing changed, triggering auto-save...');
                autoSaveDrawings();
            });
        }

        // Store autoSave function for external access
        manager._autoSaveDrawings = autoSaveDrawings;

        return () => {
            if (saveTimeout) clearTimeout(saveTimeout);
            // Cleanup listeners if LineToolManager supports it (it currently might not, but this is best practice)
        };
    }, [manager, symbol, exchange, interval]);
};
