/**
 * useWatchlistKeyboard Hook
 * Handles keyboard navigation for watchlist
 */
import { useState, useCallback } from 'react';

/**
 * Hook for keyboard navigation in watchlist
 * @param {Array} stockItems - Filtered stock items (excluding sections)
 * @param {Function} onSymbolSelect - Callback when symbol is selected
 * @returns {Object} Keyboard navigation state and handlers
 */
export const useWatchlistKeyboard = (stockItems, onSymbolSelect) => {
    const [focusedIndex, setFocusedIndex] = useState(-1);

    const handleKeyDown = useCallback((e) => {
        if (!stockItems || stockItems.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocusedIndex(prev => {
                const newIndex = prev < 0 ? 0 : Math.min(prev + 1, stockItems.length - 1);
                return newIndex;
            });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusedIndex(prev => {
                const newIndex = prev < 0 ? 0 : Math.max(prev - 1, 0);
                return newIndex;
            });
        } else if (e.key === 'Enter' && focusedIndex >= 0 && focusedIndex < stockItems.length) {
            e.preventDefault();
            const item = stockItems[focusedIndex];
            if (item && item.symbol) {
                onSymbolSelect({ symbol: item.symbol, exchange: item.exchange || 'NSE' });
            }
        }
    }, [stockItems, focusedIndex, onSymbolSelect]);

    // Wrapper for onSymbolSelect that also updates focusedIndex
    const handleSymbolSelect = useCallback((symData) => {
        const idx = stockItems.findIndex(
            i => i.symbol === symData.symbol && i.exchange === (symData.exchange || 'NSE')
        );
        if (idx >= 0) {
            setFocusedIndex(idx);
        }
        onSymbolSelect(symData);
    }, [stockItems, onSymbolSelect]);

    return {
        focusedIndex,
        setFocusedIndex,
        handleKeyDown,
        handleSymbolSelect,
    };
};

export default useWatchlistKeyboard;
