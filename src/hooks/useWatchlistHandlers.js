/**
 * Watchlist Handlers Hook
 * Manages all watchlist-related operations: create, rename, delete, reorder, sections, etc.
 */

import { useCallback } from 'react';

/**
 * Custom hook for watchlist operations
 * @param {Object} params - Hook parameters
 * @param {Function} params.setWatchlistsState - State setter for watchlists
 * @param {Function} params.setWatchlistData - State setter for watchlist data
 * @param {Object} params.watchlistsState - Current watchlists state
 * @param {Function} params.showToast - Toast notification function
 * @returns {Object} Watchlist handler functions
 */
export const useWatchlistHandlers = ({
    setWatchlistsState,
    setWatchlistData,
    watchlistsState,
    showToast
}) => {
    // Reorder symbols in watchlist
    const handleWatchlistReorder = useCallback((newItems) => {
        // newItems can contain both symbol objects and ###section strings
        setWatchlistsState(prev => ({
            ...prev,
            lists: prev.lists.map(wl =>
                wl.id === prev.activeListId ? { ...wl, symbols: newItems } : wl
            ),
        }));
        // Optimistically update data order - only for actual symbols, not section markers
        setWatchlistData(prev => {
            // Use composite key (symbol-exchange) for proper mapping
            const dataMap = new Map(prev.map(item => [`${item.symbol}-${item.exchange || 'NSE'}`, item]));
            return newItems
                .filter(item => typeof item !== 'string' || !item.startsWith('###'))
                .map(sym => {
                    const key = typeof sym === 'string'
                        ? `${sym}-NSE`
                        : `${sym.symbol}-${sym.exchange || 'NSE'}`;
                    return dataMap.get(key);
                })
                .filter(Boolean);
        });
    }, [setWatchlistsState, setWatchlistData]);

    // Create new watchlist
    const handleCreateWatchlist = useCallback((name) => {
        const newId = 'wl_' + Date.now();
        setWatchlistsState(prev => ({
            ...prev,
            lists: [...prev.lists, { id: newId, name, symbols: [] }],
            activeListId: newId,
        }));
    }, [setWatchlistsState]);

    // Rename watchlist
    const handleRenameWatchlist = useCallback((id, newName) => {
        setWatchlistsState(prev => ({
            ...prev,
            lists: prev.lists.map(wl =>
                wl.id === id ? { ...wl, name: newName } : wl
            ),
        }));
        showToast(`Watchlist renamed to: ${newName}`, 'success');
    }, [setWatchlistsState, showToast]);

    // Delete watchlist
    const handleDeleteWatchlist = useCallback((id) => {
        setWatchlistsState(prev => {
            // Prevent deleting the last watchlist
            if (prev.lists.length <= 1) {
                showToast('Cannot delete the only watchlist', 'warning');
                return prev;
            }

            const newLists = prev.lists.filter(wl => wl.id !== id);

            return {
                lists: newLists,
                activeListId: prev.activeListId === id
                    ? newLists[0]?.id || 'wl_default'
                    : prev.activeListId,
            };
        });
    }, [setWatchlistsState, showToast]);

    // Switch active watchlist
    const handleSwitchWatchlist = useCallback((id) => {
        setWatchlistsState(prev => ({ ...prev, activeListId: id }));
    }, [setWatchlistsState]);

    // Toggle favorite status for a watchlist with optional emoji
    const handleToggleWatchlistFavorite = useCallback((id, emoji) => {
        setWatchlistsState(prev => ({
            ...prev,
            lists: prev.lists.map(wl => {
                if (wl.id !== id) return wl;
                // If emoji provided, favorite with that emoji; if null, unfavorite
                if (emoji) {
                    return { ...wl, isFavorite: true, favoriteEmoji: emoji };
                } else {
                    return { ...wl, isFavorite: false, favoriteEmoji: undefined };
                }
            }),
        }));
    }, [setWatchlistsState]);

    // Clear all symbols from a watchlist
    const handleClearWatchlist = useCallback((id) => {
        setWatchlistsState(prev => ({
            ...prev,
            lists: prev.lists.map(wl =>
                wl.id === id ? { ...wl, symbols: [], sections: [] } : wl
            ),
        }));
        setWatchlistData([]);
        showToast('Watchlist cleared', 'success');
    }, [setWatchlistsState, setWatchlistData, showToast]);

    // Copy a watchlist
    const handleCopyWatchlist = useCallback((id, newName) => {
        const sourcelist = watchlistsState.lists.find(wl => wl.id === id);
        if (!sourcelist) return;

        const newId = 'wl_' + Date.now();
        const copiedList = {
            ...sourcelist,
            id: newId,
            name: newName,
            isFavorite: false,
            isFavorites: false,
        };

        setWatchlistsState(prev => ({
            ...prev,
            lists: [...prev.lists, copiedList],
            activeListId: newId,
        }));
        showToast(`Created copy: ${newName}`, 'success');
    }, [watchlistsState.lists, setWatchlistsState, showToast]);

    // Export watchlist to CSV
    const handleExportWatchlist = useCallback((id) => {
        const watchlist = watchlistsState.lists.find(wl => wl.id === id);
        if (!watchlist) return;

        const symbols = watchlist.symbols || [];
        const csvContent = symbols
            .filter(s => typeof s !== 'string' || !s.startsWith('###'))
            .map(s => {
                const symbol = typeof s === 'string' ? s : s.symbol;
                const exchange = typeof s === 'string' ? 'NSE' : (s.exchange || 'NSE');
                return `${symbol},${exchange}`;
            })
            .join('\n');

        const blob = new Blob([`symbol,exchange\n${csvContent}`], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${watchlist.name || 'watchlist'}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`Exported ${symbols.filter(s => typeof s !== 'string' || !s.startsWith('###')).length} symbols`, 'success');
    }, [watchlistsState.lists, showToast]);

    // Import symbols to watchlist from CSV
    const handleImportWatchlist = useCallback((symbols, id) => {
        if (!symbols || symbols.length === 0) return;

        setWatchlistsState(prev => ({
            ...prev,
            lists: prev.lists.map(wl => {
                if (wl.id !== id) return wl;
                // Get existing symbol names to avoid duplicates
                const existingSymbols = new Set(
                    (wl.symbols || [])
                        .filter(s => typeof s !== 'string' || !s.startsWith('###'))
                        .map(s => typeof s === 'string' ? s : s.symbol)
                );
                // Filter out duplicates
                const newSymbols = symbols.filter(s => !existingSymbols.has(s.symbol));
                return {
                    ...wl,
                    symbols: [...(wl.symbols || []), ...newSymbols]
                };
            })
        }));
        showToast(`Imported ${symbols.length} symbols`, 'success');
    }, [setWatchlistsState, showToast]);

    // Add a section to the watchlist at a specific index
    const handleAddSection = useCallback((sectionTitle, index) => {
        setWatchlistsState(prev => {
            const activeList = prev.lists.find(wl => wl.id === prev.activeListId);
            if (!activeList) return prev;

            // Insert the section marker string at the specified index
            const currentSymbols = [...(activeList.symbols || [])];
            const sectionMarker = `###${sectionTitle}`;
            currentSymbols.splice(index, 0, sectionMarker);

            return {
                ...prev,
                lists: prev.lists.map(wl =>
                    wl.id === prev.activeListId
                        ? { ...wl, symbols: currentSymbols }
                        : wl
                ),
            };
        });
    }, [setWatchlistsState]);

    // Toggle section collapse state
    const handleToggleSection = useCallback((sectionTitle) => {
        setWatchlistsState(prev => {
            const activeList = prev.lists.find(wl => wl.id === prev.activeListId);
            if (!activeList) return prev;

            const collapsedSections = activeList.collapsedSections || [];
            const isCollapsed = collapsedSections.includes(sectionTitle);

            return {
                ...prev,
                lists: prev.lists.map(wl =>
                    wl.id === prev.activeListId
                        ? {
                            ...wl,
                            collapsedSections: isCollapsed
                                ? collapsedSections.filter(s => s !== sectionTitle)
                                : [...collapsedSections, sectionTitle]
                        }
                        : wl
                ),
            };
        });
    }, [setWatchlistsState]);

    // Rename a section
    const handleRenameSection = useCallback((oldTitle, newTitle) => {
        setWatchlistsState(prev => {
            const activeList = prev.lists.find(wl => wl.id === prev.activeListId);
            if (!activeList) return prev;

            const currentSymbols = [...(activeList.symbols || [])];
            const oldMarker = `###${oldTitle}`;
            const newMarker = `###${newTitle}`;

            // Find and replace the section marker
            const sectionIndex = currentSymbols.findIndex(s => s === oldMarker);
            if (sectionIndex !== -1) {
                currentSymbols[sectionIndex] = newMarker;
            }

            // Also update collapsed sections if the renamed section was collapsed
            const collapsedSections = (activeList.collapsedSections || []).map(
                s => s === oldTitle ? newTitle : s
            );

            return {
                ...prev,
                lists: prev.lists.map(wl =>
                    wl.id === prev.activeListId
                        ? { ...wl, symbols: currentSymbols, collapsedSections }
                        : wl
                ),
            };
        });
    }, [setWatchlistsState]);

    // Delete a section (removes ###SECTION string, keeps symbols after it)
    const handleDeleteSection = useCallback((sectionTitle) => {
        setWatchlistsState(prev => {
            const activeList = prev.lists.find(wl => wl.id === prev.activeListId);
            if (!activeList) return prev;

            const currentSymbols = [...(activeList.symbols || [])];
            const sectionMarker = `###${sectionTitle}`;

            // Remove the section marker string
            const filteredSymbols = currentSymbols.filter(s => s !== sectionMarker);

            // Also remove from collapsed sections
            const collapsedSections = (activeList.collapsedSections || []).filter(
                s => s !== sectionTitle
            );

            return {
                ...prev,
                lists: prev.lists.map(wl =>
                    wl.id === prev.activeListId
                        ? { ...wl, symbols: filteredSymbols, collapsedSections }
                        : wl
                ),
            };
        });
    }, [setWatchlistsState]);

    return {
        handleWatchlistReorder,
        handleCreateWatchlist,
        handleRenameWatchlist,
        handleDeleteWatchlist,
        handleSwitchWatchlist,
        handleToggleWatchlistFavorite,
        handleClearWatchlist,
        handleCopyWatchlist,
        handleExportWatchlist,
        handleImportWatchlist,
        handleAddSection,
        handleToggleSection,
        handleRenameSection,
        handleDeleteSection
    };
};

export default useWatchlistHandlers;
