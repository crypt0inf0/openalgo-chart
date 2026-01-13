/**
 * Symbol Handlers Hook
 * Manages symbol operations: change, compare, add to watchlist, remove from watchlist
 */

import { useCallback } from 'react';

// Comparison symbol colors
const COMPARISON_COLORS = ['#f57f17', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5'];

/**
 * Custom hook for symbol operations
 * @param {Object} params - Hook parameters
 * @param {string} params.searchMode - Current search mode ('switch', 'compare', 'add')
 * @param {Function} params.setCharts - State setter for charts
 * @param {string} params.activeChartId - Currently active chart ID
 * @param {Array} params.watchlistSymbols - Current watchlist symbols
 * @param {Function} params.setWatchlistsState - State setter for watchlists
 * @param {Function} params.setIsSearchOpen - State setter for search modal
 * @param {Function} params.setSearchMode - State setter for search mode
 * @returns {Object} Symbol handler functions
 */
export const useSymbolHandlers = ({
    searchMode,
    setCharts,
    activeChartId,
    watchlistSymbols,
    setWatchlistsState,
    setIsSearchOpen,
    setSearchMode
}) => {
    // Handle symbol selection based on search mode
    const handleSymbolChange = useCallback((symbolData) => {
        // Handle both string (legacy) and object format { symbol, exchange }
        const symbol = typeof symbolData === 'string' ? symbolData : symbolData.symbol;
        const exchange = typeof symbolData === 'string' ? 'NSE' : (symbolData.exchange || 'NSE');

        if (searchMode === 'switch') {
            setCharts(prev => prev.map(chart =>
                chart.id === activeChartId
                    ? { ...chart, symbol: symbol, exchange: exchange, strategyConfig: null }
                    : chart
            ));
        } else if (searchMode === 'compare') {
            setCharts(prev => prev.map(chart => {
                if (chart.id === activeChartId) {
                    const currentComparisons = chart.comparisonSymbols || [];
                    // Check both symbol AND exchange to allow same symbol from different exchanges
                    const exists = currentComparisons.find(c =>
                        c.symbol === symbol && c.exchange === exchange
                    );

                    if (exists) {
                        // Remove (match both symbol and exchange)
                        return {
                            ...chart,
                            comparisonSymbols: currentComparisons.filter(c =>
                                !(c.symbol === symbol && c.exchange === exchange)
                            )
                        };
                    } else {
                        // Add
                        const nextColor = COMPARISON_COLORS[currentComparisons.length % COMPARISON_COLORS.length];
                        return {
                            ...chart,
                            comparisonSymbols: [
                                ...currentComparisons,
                                { symbol: symbol, exchange: exchange, color: nextColor }
                            ]
                        };
                    }
                }
                return chart;
            }));
            // Do not close search in compare mode to allow multiple selections
        } else {
            // Add to watchlist mode
            // Check both symbol AND exchange to allow same symbol from different exchanges
            const existsInWatchlist = watchlistSymbols.some(s => {
                if (typeof s === 'string') return s === symbol;
                return s.symbol === symbol && s.exchange === exchange;
            });
            if (!existsInWatchlist) {
                setWatchlistsState(prev => ({
                    ...prev,
                    lists: prev.lists.map(wl =>
                        wl.id === prev.activeListId
                            ? { ...wl, symbols: [...wl.symbols, { symbol, exchange }] }
                            : wl
                    ),
                }));
            }
            setIsSearchOpen(false);
        }
    }, [searchMode, setCharts, activeChartId, watchlistSymbols, setWatchlistsState, setIsSearchOpen]);

    // Remove symbol from watchlist
    const handleRemoveFromWatchlist = useCallback((symbolData) => {
        const symbolToRemove = typeof symbolData === 'string' ? symbolData : symbolData.symbol;
        const exchangeToRemove = typeof symbolData === 'string' ? null : symbolData.exchange;
        setWatchlistsState(prev => ({
            ...prev,
            lists: prev.lists.map(wl =>
                wl.id === prev.activeListId
                    ? {
                        ...wl,
                        symbols: wl.symbols.filter(s => {
                            // If s is a string, compare by symbol name only
                            if (typeof s === 'string') return s !== symbolToRemove;
                            // If we have exchange info, match both symbol and exchange
                            if (exchangeToRemove) {
                                return !(s.symbol === symbolToRemove && s.exchange === exchangeToRemove);
                            }
                            // Fallback: match by symbol only (backward compatibility)
                            return s.symbol !== symbolToRemove;
                        })
                    }
                    : wl
            ),
        }));
    }, [setWatchlistsState]);

    // Open search in 'add to watchlist' mode
    const handleAddClick = useCallback(() => {
        setSearchMode('add');
        setIsSearchOpen(true);
    }, [setSearchMode, setIsSearchOpen]);

    // Open search in 'switch symbol' mode
    const handleSymbolClick = useCallback(() => {
        setSearchMode('switch');
        setIsSearchOpen(true);
    }, [setSearchMode, setIsSearchOpen]);

    // Open search in 'compare' mode
    const handleCompareClick = useCallback(() => {
        setSearchMode('compare');
        setIsSearchOpen(true);
    }, [setSearchMode, setIsSearchOpen]);

    return {
        handleSymbolChange,
        handleRemoveFromWatchlist,
        handleAddClick,
        handleSymbolClick,
        handleCompareClick
    };
};

export default useSymbolHandlers;
