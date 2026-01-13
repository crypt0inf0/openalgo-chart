import { useState, useEffect, useCallback } from 'react';
import { getJSON, setJSON, STORAGE_KEYS } from '../services/storageService';

const MAX_RECENT = 10;

/**
 * Normalize symbol data to consistent format
 */
const normalizeSymbol = (sym) => {
    if (!sym) return null;

    if (typeof sym === 'string') {
        return { symbol: sym, exchange: 'NSE' };
    }

    return {
        symbol: sym.symbol || sym.tradingsymbol || '',
        exchange: sym.exchange || 'NSE',
        name: sym.name || sym.description || sym.symbol || '',
        instrumenttype: sym.instrumenttype || 'EQ',
    };
};

/**
 * Check if two symbols are the same
 */
const isSameSymbol = (a, b) => {
    const normA = normalizeSymbol(a);
    const normB = normalizeSymbol(b);

    if (!normA || !normB) return false;

    return normA.symbol === normB.symbol && normA.exchange === normB.exchange;
};

/**
 * Hook for managing symbol favorites and recent history
 * @returns {Object} Symbol history state and handlers
 */
export const useSymbolHistory = () => {
    // Favorites state
    const [favorites, setFavorites] = useState(() => {
        const saved = getJSON(STORAGE_KEYS.SYMBOL_FAVORITES, []);
        return Array.isArray(saved) ? saved : [];
    });

    // Recent symbols state
    const [recentSymbols, setRecentSymbols] = useState(() => {
        const saved = getJSON(STORAGE_KEYS.RECENT_SYMBOLS, []);
        return Array.isArray(saved) ? saved : [];
    });

    // Persist favorites to localStorage
    useEffect(() => {
        setJSON(STORAGE_KEYS.SYMBOL_FAVORITES, favorites);
    }, [favorites]);

    // Persist recent symbols to localStorage
    useEffect(() => {
        setJSON(STORAGE_KEYS.RECENT_SYMBOLS, recentSymbols);
    }, [recentSymbols]);

    /**
     * Check if a symbol is favorited
     */
    const isFavorite = useCallback((sym) => {
        return favorites.some(fav => isSameSymbol(fav, sym));
    }, [favorites]);

    /**
     * Toggle favorite status for a symbol
     */
    const toggleFavorite = useCallback((sym) => {
        const normalized = normalizeSymbol(sym);
        if (!normalized || !normalized.symbol) return;

        setFavorites(prev => {
            const exists = prev.some(fav => isSameSymbol(fav, normalized));

            if (exists) {
                // Remove from favorites
                return prev.filter(fav => !isSameSymbol(fav, normalized));
            } else {
                // Add to favorites
                return [normalized, ...prev];
            }
        });
    }, []);

    /**
     * Add a symbol to recent history
     */
    const addToRecent = useCallback((sym) => {
        const normalized = normalizeSymbol(sym);
        if (!normalized || !normalized.symbol) return;

        setRecentSymbols(prev => {
            // Remove if already exists (will re-add at top)
            const filtered = prev.filter(recent => !isSameSymbol(recent, normalized));

            // Add to beginning and limit to MAX_RECENT
            return [normalized, ...filtered].slice(0, MAX_RECENT);
        });
    }, []);

    /**
     * Remove a symbol from recent history
     */
    const removeFromRecent = useCallback((sym) => {
        setRecentSymbols(prev => prev.filter(recent => !isSameSymbol(recent, sym)));
    }, []);

    /**
     * Clear all recent history
     */
    const clearRecent = useCallback(() => {
        setRecentSymbols([]);
    }, []);

    /**
     * Clear all favorites
     */
    const clearFavorites = useCallback(() => {
        setFavorites([]);
    }, []);

    /**
     * Get recent symbols excluding favorites (to avoid duplication in UI)
     */
    const getRecentExcludingFavorites = useCallback(() => {
        return recentSymbols.filter(recent => !isFavorite(recent));
    }, [recentSymbols, isFavorite]);

    return {
        // State
        favorites,
        recentSymbols,

        // Checkers
        isFavorite,

        // Actions
        toggleFavorite,
        addToRecent,
        removeFromRecent,
        clearRecent,
        clearFavorites,

        // Derived
        getRecentExcludingFavorites,

        // Utilities
        normalizeSymbol,
        isSameSymbol,
    };
};

export default useSymbolHistory;
