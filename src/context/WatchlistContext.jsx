/**
 * WatchlistContext - Centralized watchlist state management
 * Manages: multiple watchlists, active watchlist, symbols, sections, real-time data
 */

import React, { createContext, useContext, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { STORAGE_KEYS } from '../constants/storageKeys';
import logger from '../utils/logger';

// Local safeParseJSON to avoid import issues
const safeParseJSON = (value, fallback = null) => {
    if (value === null || value === undefined) {
        return fallback;
    }
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

// Default watchlist configuration
const DEFAULT_WATCHLIST = {
    id: 'wl_default',
    name: 'Watchlist 1',
    symbols: [],
    isFavorite: false,
    collapsedSections: []
};

/**
 * Migrate old watchlist format to new multi-watchlist format
 */
const migrateWatchlistData = () => {
    const newData = safeParseJSON(localStorage.getItem(STORAGE_KEYS.WATCHLISTS), null);

    // If new format exists, validate and use it
    if (newData && newData.lists && Array.isArray(newData.lists)) {
        // Filter out any old Favorites watchlist
        newData.lists = newData.lists.filter(wl => wl.id !== 'wl_favorites');
        // Ensure at least one watchlist exists
        if (newData.lists.length === 0) {
            newData.lists.push({ ...DEFAULT_WATCHLIST });
            newData.activeListId = 'wl_default';
        }
        // Update activeListId if it was pointing to favorites
        if (newData.activeListId === 'wl_favorites') {
            newData.activeListId = newData.lists[0].id;
        }
        return newData;
    }

    // Check for old format
    const oldData = safeParseJSON(localStorage.getItem(STORAGE_KEYS.WATCHLIST), null);

    if (oldData && Array.isArray(oldData) && oldData.length > 0) {
        // Migrate old format to new format
        return {
            lists: [{
                ...DEFAULT_WATCHLIST,
                symbols: oldData.map(s => typeof s === 'string' ? { symbol: s, exchange: 'NSE' } : s),
            }],
            activeListId: 'wl_default',
        };
    }

    // Return default
    return {
        lists: [{ ...DEFAULT_WATCHLIST }],
        activeListId: 'wl_default',
    };
};

// Create context
const WatchlistContext = createContext(null);

/**
 * WatchlistProvider - Provides watchlist state to the app
 */
export const WatchlistProvider = ({ children }) => {
    // Core watchlist state
    const [watchlistsState, setWatchlistsState] = useState(migrateWatchlistData);

    // Real-time watchlist data (ticker data for symbols)
    const [watchlistData, setWatchlistData] = useState([]);
    const [watchlistLoading, setWatchlistLoading] = useState(true);

    // Derived: Active watchlist object
    const activeWatchlist = useMemo(
        () => watchlistsState.lists.find(wl => wl.id === watchlistsState.activeListId) || watchlistsState.lists[0],
        [watchlistsState.lists, watchlistsState.activeListId]
    );

    // Derived: Symbols from active watchlist
    const watchlistSymbols = useMemo(
        () => activeWatchlist?.symbols || [],
        [activeWatchlist]
    );

    // Derived: Favorite watchlists for quick-access bar
    const favoriteWatchlists = useMemo(
        () => watchlistsState.lists.filter(wl => wl.isFavorite),
        [watchlistsState.lists]
    );

    // Key for tracking symbol changes (for WebSocket subscriptions)
    const watchlistSymbolsKey = useMemo(() => {
        const symbolSet = watchlistSymbols
            .filter(s => typeof s !== 'string' || !s.startsWith('###'))
            .map(s => typeof s === 'string' ? s : `${s.symbol}-${s.exchange || 'NSE'}`)
            .sort()
            .join(',');
        return `${watchlistsState.activeListId}:${symbolSet}`;
    }, [watchlistSymbols, watchlistsState.activeListId]);

    // Auto-save to localStorage
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEYS.WATCHLISTS, JSON.stringify(watchlistsState));
            logger.debug('[WatchlistContext] Saved watchlists');
        } catch (e) {
            logger.warn('[WatchlistContext] Failed to save:', e);
        }
    }, [watchlistsState]);

    // ============ WATCHLIST CRUD HANDLERS ============

    // Create new watchlist
    const createWatchlist = useCallback((name) => {
        const newId = 'wl_' + Date.now();
        setWatchlistsState(prev => ({
            ...prev,
            lists: [...prev.lists, { ...DEFAULT_WATCHLIST, id: newId, name }],
            activeListId: newId,
        }));
        return newId;
    }, []);

    // Rename watchlist
    const renameWatchlist = useCallback((id, newName) => {
        setWatchlistsState(prev => ({
            ...prev,
            lists: prev.lists.map(wl =>
                wl.id === id ? { ...wl, name: newName } : wl
            ),
        }));
    }, []);

    // Delete watchlist
    const deleteWatchlist = useCallback((id) => {
        setWatchlistsState(prev => {
            if (prev.lists.length <= 1) return prev; // Keep at least one
            const newLists = prev.lists.filter(wl => wl.id !== id);
            return {
                lists: newLists,
                activeListId: prev.activeListId === id
                    ? newLists[0]?.id || 'wl_default'
                    : prev.activeListId,
            };
        });
    }, []);

    // Switch active watchlist
    const switchWatchlist = useCallback((id) => {
        setWatchlistsState(prev => ({ ...prev, activeListId: id }));
    }, []);

    // Toggle favorite status
    const toggleWatchlistFavorite = useCallback((id, emoji = null) => {
        setWatchlistsState(prev => ({
            ...prev,
            lists: prev.lists.map(wl => {
                if (wl.id !== id) return wl;
                if (emoji) {
                    return { ...wl, isFavorite: true, favoriteEmoji: emoji };
                } else {
                    return { ...wl, isFavorite: false, favoriteEmoji: undefined };
                }
            }),
        }));
    }, []);

    // Clear all symbols from watchlist
    const clearWatchlist = useCallback((id) => {
        setWatchlistsState(prev => ({
            ...prev,
            lists: prev.lists.map(wl =>
                wl.id === id ? { ...wl, symbols: [], collapsedSections: [] } : wl
            ),
        }));
        setWatchlistData([]);
    }, []);

    // Copy watchlist
    const copyWatchlist = useCallback((id, newName) => {
        const sourceList = watchlistsState.lists.find(wl => wl.id === id);
        if (!sourceList) return null;

        const newId = 'wl_' + Date.now();
        const copiedList = {
            ...sourceList,
            id: newId,
            name: newName,
            isFavorite: false,
            favoriteEmoji: undefined
        };

        setWatchlistsState(prev => ({
            ...prev,
            lists: [...prev.lists, copiedList],
            activeListId: newId,
        }));
        return newId;
    }, [watchlistsState.lists]);

    // ============ SYMBOL HANDLERS ============

    // Add symbol to active watchlist
    const addSymbol = useCallback((symbol, exchange = 'NSE') => {
        setWatchlistsState(prev => {
            const activeList = prev.lists.find(wl => wl.id === prev.activeListId);
            if (!activeList) return prev;

            // Check if already exists
            const exists = activeList.symbols.some(s => {
                if (typeof s === 'string') return s === symbol;
                return s.symbol === symbol && s.exchange === exchange;
            });
            if (exists) return prev;

            return {
                ...prev,
                lists: prev.lists.map(wl =>
                    wl.id === prev.activeListId
                        ? { ...wl, symbols: [...wl.symbols, { symbol, exchange }] }
                        : wl
                ),
            };
        });
    }, []);

    // Remove symbol from active watchlist
    const removeSymbol = useCallback((symbol, exchange = null) => {
        setWatchlistsState(prev => ({
            ...prev,
            lists: prev.lists.map(wl =>
                wl.id === prev.activeListId
                    ? {
                        ...wl,
                        symbols: wl.symbols.filter(s => {
                            if (typeof s === 'string') return s !== symbol;
                            if (exchange) {
                                return !(s.symbol === symbol && s.exchange === exchange);
                            }
                            return s.symbol !== symbol;
                        })
                    }
                    : wl
            ),
        }));
    }, []);

    // Reorder symbols in watchlist
    const reorderSymbols = useCallback((newItems) => {
        setWatchlistsState(prev => ({
            ...prev,
            lists: prev.lists.map(wl =>
                wl.id === prev.activeListId ? { ...wl, symbols: newItems } : wl
            ),
        }));
        // Optimistically update data order
        setWatchlistData(prev => {
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
    }, []);

    // ============ SECTION HANDLERS ============

    // Add section at index
    const addSection = useCallback((sectionTitle, index) => {
        setWatchlistsState(prev => {
            const activeList = prev.lists.find(wl => wl.id === prev.activeListId);
            if (!activeList) return prev;

            const currentSymbols = [...(activeList.symbols || [])];
            currentSymbols.splice(index, 0, `###${sectionTitle}`);

            return {
                ...prev,
                lists: prev.lists.map(wl =>
                    wl.id === prev.activeListId
                        ? { ...wl, symbols: currentSymbols }
                        : wl
                ),
            };
        });
    }, []);

    // Toggle section collapse
    const toggleSection = useCallback((sectionTitle) => {
        setWatchlistsState(prev => {
            const activeList = prev.lists.find(wl => wl.id === prev.activeListId);
            if (!activeList) return prev;

            const collapsed = activeList.collapsedSections || [];
            const isCollapsed = collapsed.includes(sectionTitle);

            return {
                ...prev,
                lists: prev.lists.map(wl =>
                    wl.id === prev.activeListId
                        ? {
                            ...wl,
                            collapsedSections: isCollapsed
                                ? collapsed.filter(s => s !== sectionTitle)
                                : [...collapsed, sectionTitle]
                        }
                        : wl
                ),
            };
        });
    }, []);

    // Rename section
    const renameSection = useCallback((oldTitle, newTitle) => {
        setWatchlistsState(prev => {
            const activeList = prev.lists.find(wl => wl.id === prev.activeListId);
            if (!activeList) return prev;

            const currentSymbols = [...(activeList.symbols || [])];
            const oldMarker = `###${oldTitle}`;
            const newMarker = `###${newTitle}`;

            const sectionIndex = currentSymbols.findIndex(s => s === oldMarker);
            if (sectionIndex !== -1) {
                currentSymbols[sectionIndex] = newMarker;
            }

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
    }, []);

    // Delete section
    const deleteSection = useCallback((sectionTitle) => {
        setWatchlistsState(prev => {
            const activeList = prev.lists.find(wl => wl.id === prev.activeListId);
            if (!activeList) return prev;

            const sectionMarker = `###${sectionTitle}`;
            const filteredSymbols = (activeList.symbols || []).filter(s => s !== sectionMarker);
            const collapsedSections = (activeList.collapsedSections || []).filter(s => s !== sectionTitle);

            return {
                ...prev,
                lists: prev.lists.map(wl =>
                    wl.id === prev.activeListId
                        ? { ...wl, symbols: filteredSymbols, collapsedSections }
                        : wl
                ),
            };
        });
    }, []);

    // ============ IMPORT/EXPORT ============

    // Export watchlist to CSV
    const exportWatchlist = useCallback((id) => {
        const watchlist = watchlistsState.lists.find(wl => wl.id === id);
        if (!watchlist) return;

        const symbols = (watchlist.symbols || [])
            .filter(s => typeof s !== 'string' || !s.startsWith('###'));

        const csvContent = symbols
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

        return symbols.length;
    }, [watchlistsState.lists]);

    // Import symbols from array
    const importSymbols = useCallback((symbols, id) => {
        if (!symbols || symbols.length === 0) return 0;

        let imported = 0;
        setWatchlistsState(prev => ({
            ...prev,
            lists: prev.lists.map(wl => {
                if (wl.id !== id) return wl;

                const existingSymbols = new Set(
                    (wl.symbols || [])
                        .filter(s => typeof s !== 'string' || !s.startsWith('###'))
                        .map(s => typeof s === 'string' ? s : s.symbol)
                );

                const newSymbols = symbols.filter(s => !existingSymbols.has(s.symbol));
                imported = newSymbols.length;

                return {
                    ...wl,
                    symbols: [...(wl.symbols || []), ...newSymbols]
                };
            })
        }));

        return imported;
    }, []);

    // Context value
    const value = useMemo(() => ({
        // State
        watchlistsState,
        setWatchlistsState,
        watchlistData,
        setWatchlistData,
        watchlistLoading,
        setWatchlistLoading,

        // Derived
        activeWatchlist,
        watchlistSymbols,
        favoriteWatchlists,
        watchlistSymbolsKey,

        // Watchlist CRUD
        createWatchlist,
        renameWatchlist,
        deleteWatchlist,
        switchWatchlist,
        toggleWatchlistFavorite,
        clearWatchlist,
        copyWatchlist,

        // Symbol handlers
        addSymbol,
        removeSymbol,
        reorderSymbols,

        // Section handlers
        addSection,
        toggleSection,
        renameSection,
        deleteSection,

        // Import/Export
        exportWatchlist,
        importSymbols
    }), [
        watchlistsState,
        watchlistData,
        watchlistLoading,
        activeWatchlist,
        watchlistSymbols,
        favoriteWatchlists,
        watchlistSymbolsKey,
        createWatchlist,
        renameWatchlist,
        deleteWatchlist,
        switchWatchlist,
        toggleWatchlistFavorite,
        clearWatchlist,
        copyWatchlist,
        addSymbol,
        removeSymbol,
        reorderSymbols,
        addSection,
        toggleSection,
        renameSection,
        deleteSection,
        exportWatchlist,
        importSymbols
    ]);

    return (
        <WatchlistContext.Provider value={value}>
            {children}
        </WatchlistContext.Provider>
    );
};

/**
 * useWatchlist hook - Access watchlist context
 */
export const useWatchlist = () => {
    const context = useContext(WatchlistContext);
    if (!context) {
        throw new Error('useWatchlist must be used within a WatchlistProvider');
    }
    return context;
};

export default WatchlistContext;
