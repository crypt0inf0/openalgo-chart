import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, X, Check, Star } from 'lucide-react';
import styles from './SymbolSearch.module.css';
import { searchSymbols } from '../../services/openalgo';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useKeyboardNav, useListNavigation } from '../../hooks/useKeyboardNav';
import { useSymbolHistory } from '../../hooks/useSymbolHistory';
import { fuzzySearch } from '../../utils/fuzzySearch';

// Import extracted components, constants, and utils
import { HighlightText } from './components';
import { FILTER_TABS } from './constants';
import { getSymbolIcon, getInstrumentTypeLabel, getExchangeBadge } from './utils';

const SymbolSearch = ({ isOpen, onClose, onSelect, addedSymbols = [], isCompareMode = false, initialValue = '', onInitialValueUsed }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [symbols, setSymbols] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [defaultSymbols, setDefaultSymbols] = useState([]);
    const [activeFilterIndex, setActiveFilterIndex] = useState(0);
    const [activeResultIndex, setActiveResultIndex] = useState(0);

    const activeFilter = FILTER_TABS[activeFilterIndex];

    // Symbol history for favorites and recents
    const {
        favorites,
        recentSymbols,
        isFavorite,
        toggleFavorite,
        addToRecent,
        getRecentExcludingFavorites,
    } = useSymbolHistory();

    // Focus trap for accessibility
    const focusTrapRef = useFocusTrap(isOpen, { autoFocus: false });

    // Escape key to close
    useKeyboardNav({
        enabled: isOpen,
        onEscape: onClose,
    });

    // Apply initial value when modal opens with a pre-filled character
    useEffect(() => {
        if (isOpen && initialValue) {
            setSearchTerm(initialValue);
            // Clear the initial value after using it
            if (onInitialValueUsed) {
                onInitialValueUsed();
            }
        }
    }, [isOpen, initialValue, onInitialValueUsed]);

    // Load default popular symbols on open
    useEffect(() => {
        let mounted = true;

        if (isOpen && defaultSymbols.length === 0) {
            const defaultList = [
                { symbol: 'NIFTY', exchange: 'NSE_INDEX', instrumenttype: 'INDEX', name: 'Nifty 50 Index' },
                { symbol: 'BANKNIFTY', exchange: 'NSE_INDEX', instrumenttype: 'INDEX', name: 'Nifty Bank Index' },
                { symbol: 'CNXSMALLCAP', exchange: 'NSE_INDEX', instrumenttype: 'INDEX', name: 'Nifty SmallCap 100 Index' },
                { symbol: 'NIFTY_MID_SELECT', exchange: 'NSE_INDEX', instrumenttype: 'INDEX', name: 'Nifty MidCap Select Index' },
                { symbol: 'CNXIT', exchange: 'NSE_INDEX', instrumenttype: 'INDEX', name: 'Nifty IT Index' },
                { symbol: 'CNXFINANCE', exchange: 'NSE_INDEX', instrumenttype: 'INDEX', name: 'Nifty Financial Services Index' },
                { symbol: 'RELIANCE', exchange: 'NSE', instrumenttype: 'EQ', name: 'Reliance Industries Ltd' },
                { symbol: 'TCS', exchange: 'NSE', instrumenttype: 'EQ', name: 'Tata Consultancy Services' },
                { symbol: 'INFY', exchange: 'NSE', instrumenttype: 'EQ', name: 'Infosys Ltd' },
                { symbol: 'HDFCBANK', exchange: 'NSE', instrumenttype: 'EQ', name: 'HDFC Bank Ltd' },
            ];
            if (mounted) {
                setDefaultSymbols(defaultList);
            }
        }

        return () => {
            mounted = false;
        };
    }, [isOpen, defaultSymbols.length]);

    // Debounced search with API filters
    useEffect(() => {
        if (!searchTerm || searchTerm.length < 2) {
            setSymbols([]);
            return;
        }

        const timeoutId = setTimeout(async () => {
            setIsLoading(true);
            try {
                // Search without filters to get all results, then filter client-side
                const results = await searchSymbols(searchTerm);

                const transformed = (results || []).map(s => ({
                    symbol: s.symbol || s.tradingsymbol || s.name,
                    exchange: s.exchange || 'NSE',
                    instrumenttype: s.instrumenttype || 'EQ',
                    name: s.name || s.description || s.symbol,
                    expiry: s.expiry || null,
                    strike: s.strike || null,
                }));

                // Apply client-side filtering based on active filter
                let filtered = transformed;
                if (activeFilter.label !== 'All') {
                    filtered = transformed.filter(s => {
                        const instType = s.instrumenttype?.toUpperCase() || '';
                        const exch = s.exchange?.toUpperCase() || '';

                        switch (activeFilter.label) {
                            case 'Stocks':
                                // Stocks are EQ instruments on NSE or BSE
                                return instType === 'EQ' && (exch === 'NSE' || exch === 'BSE');
                            case 'Futures':
                                // Futures are FUT instruments
                                return instType === 'FUT';
                            case 'Options':
                                // Options are CE or PE instruments
                                return instType === 'CE' || instType === 'PE';
                            case 'Indices':
                                // Indices are on NSE_INDEX or BSE_INDEX exchanges
                                return exch === 'NSE_INDEX' || exch === 'BSE_INDEX' || exch.includes('INDEX');
                            default:
                                return true;
                        }
                    });
                }

                // Sort results to prioritize exact/closer matches
                const query = searchTerm.toUpperCase().replace(/\s+/g, '');
                const sorted = filtered.sort((a, b) => {
                    const symA = a.symbol.toUpperCase();
                    const symB = b.symbol.toUpperCase();
                    const nameA = (a.name || '').toUpperCase();
                    const nameB = (b.name || '').toUpperCase();

                    // Priority 1: Exact symbol match
                    const exactA = symA === query || symA === query.replace('50', '') || symA === 'NIFTY';
                    const exactB = symB === query || symB === query.replace('50', '') || symB === 'NIFTY';
                    if (exactA && !exactB) return -1;
                    if (exactB && !exactA) return 1;

                    // Priority 2: Symbol starts with query
                    const startsA = symA.startsWith(query.split(' ')[0]);
                    const startsB = symB.startsWith(query.split(' ')[0]);
                    if (startsA && !startsB) return -1;
                    if (startsB && !startsA) return 1;

                    // Priority 3: Name contains "50 Index" for nifty 50 searches
                    if (query.includes('50') || query.includes('NIFTY')) {
                        const is50A = nameA.includes('50') && nameA.includes('INDEX');
                        const is50B = nameB.includes('50') && nameB.includes('INDEX');
                        if (is50A && !is50B) return -1;
                        if (is50B && !is50A) return 1;
                    }

                    // Priority 4: Shorter symbol names first (more specific)
                    return symA.length - symB.length;
                });

                setSymbols(sorted.slice(0, 50));
            } catch (err) {
                console.error('Error searching symbols:', err);
                setSymbols([]);
            } finally {
                setIsLoading(false);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchTerm, activeFilter]);

    // Filter default symbols based on active filter
    const filteredDefaultSymbols = useMemo(() => {
        if (activeFilter.label === 'All') return defaultSymbols;

        return defaultSymbols.filter(s => {
            if (activeFilter.exchange === 'NSE_INDEX') {
                return s.exchange === 'NSE_INDEX' || s.exchange === 'BSE_INDEX';
            }
            if (activeFilter.instrumenttype) {
                return s.instrumenttype === activeFilter.instrumenttype;
            }
            if (activeFilter.label === 'Options') {
                return s.instrumenttype === 'CE' || s.instrumenttype === 'PE';
            }
            return true;
        });
    }, [defaultSymbols, activeFilter]);

    const displaySymbols = useMemo(() => {
        if (searchTerm && searchTerm.length >= 2) {
            return symbols;
        }
        return filteredDefaultSymbols;
    }, [searchTerm, symbols, filteredDefaultSymbols]);

    // Reset active result index when results change
    useEffect(() => {
        setActiveResultIndex(0);
    }, [displaySymbols]);

    const handleSelect = useCallback((sym) => {
        // Add to recent history
        addToRecent(sym);
        onSelect({ symbol: sym.symbol, exchange: sym.exchange });
        if (!isCompareMode) {
            onClose();
        }
    }, [onSelect, onClose, isCompareMode, addToRecent]);

    // List keyboard navigation (after handleSelect is defined)
    useListNavigation({
        enabled: isOpen && displaySymbols.length > 0,
        itemCount: displaySymbols.length,
        activeIndex: activeResultIndex,
        setActiveIndex: setActiveResultIndex,
        onSelect: (index) => {
            const sym = displaySymbols[index];
            if (sym) handleSelect(sym);
        },
    });

    const handleFilterChange = (index) => {
        setActiveFilterIndex(index);
        if (searchTerm && searchTerm.length >= 2) {
            setSymbols([]);
        }
    };

    // Handle favorite toggle with event stop propagation
    const handleFavoriteClick = useCallback((e, sym) => {
        e.stopPropagation();
        toggleFavorite(sym);
    }, [toggleFavorite]);

    // Get recent symbols that aren't in favorites (to avoid duplication)
    const recentExcludingFavorites = useMemo(() => {
        return getRecentExcludingFavorites();
    }, [getRecentExcludingFavorites]);

    // Filter favorites based on active filter
    const filteredFavorites = useMemo(() => {
        if (!isCompareMode && activeFilter.label === 'All') return favorites;

        return favorites.filter(s => {
            const instType = s.instrumenttype?.toUpperCase() || '';
            const exch = s.exchange?.toUpperCase() || '';

            switch (activeFilter.label) {
                case 'Stocks':
                    return instType === 'EQ' && (exch === 'NSE' || exch === 'BSE');
                case 'Futures':
                    return instType === 'FUT';
                case 'Options':
                    return instType === 'CE' || instType === 'PE';
                case 'Indices':
                    return exch === 'NSE_INDEX' || exch === 'BSE_INDEX' || exch.includes('INDEX');
                default:
                    return true;
            }
        });
    }, [favorites, activeFilter, isCompareMode]);

    // Filter recent symbols based on active filter
    const filteredRecent = useMemo(() => {
        if (!isCompareMode && activeFilter.label === 'All') return recentExcludingFavorites;

        return recentExcludingFavorites.filter(s => {
            const instType = s.instrumenttype?.toUpperCase() || '';
            const exch = s.exchange?.toUpperCase() || '';

            switch (activeFilter.label) {
                case 'Stocks':
                    return instType === 'EQ' && (exch === 'NSE' || exch === 'BSE');
                case 'Futures':
                    return instType === 'FUT';
                case 'Options':
                    return instType === 'CE' || instType === 'PE';
                case 'Indices':
                    return exch === 'NSE_INDEX' || exch === 'BSE_INDEX' || exch.includes('INDEX');
                default:
                    return true;
            }
        });
    }, [recentExcludingFavorites, activeFilter, isCompareMode]);

    if (!isOpen) return null;

    // Helper to check if a symbol is already added (checks both symbol AND exchange)
    const isSymbolAdded = (sym) => {
        return addedSymbols.some(added => {
            const addedSymbol = typeof added === 'string' ? added : added.symbol;
            const addedExchange = typeof added === 'string' ? null : added.exchange;
            // If addedExchange is available, check both symbol and exchange
            // Otherwise, fall back to just symbol check for backward compatibility
            if (addedExchange) {
                return addedSymbol === sym.symbol && addedExchange === sym.exchange;
            }
            return addedSymbol === sym.symbol;
        });
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div
                ref={focusTrapRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="symbol-search-title"
                className={styles.modal}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Title Header */}
                <div className={styles.titleHeader}>
                    <h2 id="symbol-search-title" className={styles.title}>
                        {isCompareMode ? 'Compare symbol' : 'Symbol Search'}
                    </h2>
                    <button
                        className={styles.closeBtn}
                        onClick={onClose}
                        aria-label="Close search"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Search Input */}
                <div className={styles.searchRow}>
                    <div className={styles.searchContainer}>
                        <Search size={18} className={styles.searchIcon} aria-hidden="true" />
                        <input
                            type="text"
                            className={styles.input}
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                            aria-label="Search for symbols"
                            aria-describedby="search-results-count"
                        />
                    </div>
                </div>
                <div id="search-results-count" className="sr-only" aria-live="polite">
                    {displaySymbols.length} results available
                </div>

                {/* Added Symbols Section (Compare Mode) */}
                {isCompareMode && addedSymbols.length > 0 && (
                    <div className={styles.addedSection}>
                        <div className={styles.sectionHeader}>ADDED SYMBOLS</div>
                        {addedSymbols.map((added, idx) => {
                            const sym = typeof added === 'string'
                                ? { symbol: added, exchange: 'NSE', name: added }
                                : added;
                            const icon = getSymbolIcon(sym.symbol, sym.exchange, sym.instrumenttype);
                            const typeLabel = getInstrumentTypeLabel(sym.exchange, sym.instrumenttype, sym.symbol);
                            const exchangeBadge = getExchangeBadge(sym.exchange);

                            return (
                                <div key={`added-${idx}`} className={`${styles.item} ${styles.addedItem}`}>
                                    <div
                                        className={styles.symbolIcon}
                                        style={{ backgroundColor: icon.bgColor, color: icon.color }}
                                    >
                                        {icon.text}
                                    </div>
                                    <div className={styles.itemSymbol}>{sym.symbol}</div>
                                    <div className={styles.itemDesc}>{sym.name || sym.symbol}</div>
                                    <div className={styles.itemMeta}>
                                        {typeLabel && <span className={styles.typeLabel}>{typeLabel}</span>}
                                        <span className={styles.exchangeBadge}>{exchangeBadge}</span>
                                        <div
                                            className={styles.checkIcon}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelect(sym);
                                            }}
                                        >
                                            <Check size={20} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Filter Tabs */}
                {!isCompareMode && (
                    <div className={styles.filterTabs}>
                        {FILTER_TABS.map((tab, index) => (
                            <button
                                key={tab.label}
                                className={`${styles.filterTab} ${activeFilterIndex === index ? styles.filterTabActive : ''}`}
                                onClick={() => handleFilterChange(index)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Results Container */}
                <div className={styles.list} role="listbox" aria-label="Search results">
                    {isLoading && (
                        <div className={styles.loading} role="status">Searching...</div>
                    )}

                    {/* Favorites Section - shown when not searching */}
                    {!isLoading && !searchTerm && filteredFavorites.length > 0 && !isCompareMode && (
                        <>
                            <div className={styles.sectionLabel}>
                                <Star size={12} className={styles.sectionIcon} />
                                FAVORITES
                            </div>
                            {filteredFavorites.map((s, index) => {
                                const icon = getSymbolIcon(s.symbol, s.exchange, s.instrumenttype);
                                const typeLabel = getInstrumentTypeLabel(s.exchange, s.instrumenttype, s.symbol);
                                const exchangeBadge = getExchangeBadge(s.exchange);

                                return (
                                    <div
                                        key={`fav-${s.exchange}-${s.symbol}`}
                                        className={`${styles.item} ${styles.favoriteItem}`}
                                        onClick={() => handleSelect(s)}
                                    >
                                        <button
                                            className={`${styles.starButton} ${styles.starActive}`}
                                            onClick={(e) => handleFavoriteClick(e, s)}
                                            aria-label="Remove from favorites"
                                        >
                                            <Star size={16} fill="currentColor" />
                                        </button>
                                        <div
                                            className={styles.symbolIcon}
                                            style={{ backgroundColor: icon.bgColor, color: icon.color }}
                                        >
                                            {icon.text}
                                        </div>
                                        <div className={styles.itemSymbol}>{s.symbol}</div>
                                        <div className={styles.itemDesc}>{s.name || s.symbol}</div>
                                        <div className={styles.itemMeta}>
                                            {typeLabel && <span className={styles.typeLabel}>{typeLabel}</span>}
                                            <span className={styles.exchangeBadge}>{exchangeBadge}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}

                    {/* Recent Section - shown when not searching */}
                    {!isLoading && !searchTerm && filteredRecent.length > 0 && !isCompareMode && (
                        <>
                            <div className={styles.sectionLabel}>
                                RECENT
                            </div>
                            {filteredRecent.map((s, index) => {
                                const icon = getSymbolIcon(s.symbol, s.exchange, s.instrumenttype);
                                const typeLabel = getInstrumentTypeLabel(s.exchange, s.instrumenttype, s.symbol);
                                const exchangeBadge = getExchangeBadge(s.exchange);
                                const symbolIsFavorite = isFavorite(s);

                                return (
                                    <div
                                        key={`recent-${s.exchange}-${s.symbol}`}
                                        className={styles.item}
                                        onClick={() => handleSelect(s)}
                                    >
                                        <button
                                            className={`${styles.starButton} ${symbolIsFavorite ? styles.starActive : ''}`}
                                            onClick={(e) => handleFavoriteClick(e, s)}
                                            aria-label={symbolIsFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                        >
                                            <Star size={16} fill={symbolIsFavorite ? 'currentColor' : 'none'} />
                                        </button>
                                        <div
                                            className={styles.symbolIcon}
                                            style={{ backgroundColor: icon.bgColor, color: icon.color }}
                                        >
                                            {icon.text}
                                        </div>
                                        <div className={styles.itemSymbol}>{s.symbol}</div>
                                        <div className={styles.itemDesc}>{s.name || s.symbol}</div>
                                        <div className={styles.itemMeta}>
                                            {typeLabel && <span className={styles.typeLabel}>{typeLabel}</span>}
                                            <span className={styles.exchangeBadge}>{exchangeBadge}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}

                    {/* Default/Popular Section - shown when not searching and no favorites/recent */}
                    {!isLoading && !searchTerm && (filteredFavorites.length > 0 || filteredRecent.length > 0) && filteredDefaultSymbols.length > 0 && !isCompareMode && (
                        <div className={styles.sectionLabel}>POPULAR</div>
                    )}

                    {/* Search Results / Default Symbols */}
                    {!isLoading && displaySymbols.map((s, index) => {
                        // Skip if already shown in favorites or recent
                        if (!searchTerm && !isCompareMode) {
                            const isInFavorites = filteredFavorites.some(f => f.symbol === s.symbol && f.exchange === s.exchange);
                            const isInRecent = filteredRecent.some(r => r.symbol === s.symbol && r.exchange === s.exchange);
                            if (isInFavorites || isInRecent) return null;
                        }

                        const icon = getSymbolIcon(s.symbol, s.exchange, s.instrumenttype);
                        const typeLabel = getInstrumentTypeLabel(s.exchange, s.instrumenttype, s.symbol);
                        const exchangeBadge = getExchangeBadge(s.exchange);
                        const isAdded = isCompareMode && isSymbolAdded(s);
                        const isKeyboardActive = index === activeResultIndex;
                        const symbolIsFavorite = isFavorite(s);

                        return (
                            <div
                                key={`${s.exchange}-${s.symbol}-${index}`}
                                id={`symbol-option-${index}`}
                                role="option"
                                aria-selected={isKeyboardActive}
                                className={`${styles.item} ${isAdded ? styles.addedItem : ''} ${isKeyboardActive ? styles.keyboardActive : ''}`}
                                onClick={() => handleSelect(s)}
                            >
                                {/* Star Button */}
                                <button
                                    className={`${styles.starButton} ${symbolIsFavorite ? styles.starActive : ''}`}
                                    onClick={(e) => handleFavoriteClick(e, s)}
                                    aria-label={symbolIsFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                >
                                    <Star size={16} fill={symbolIsFavorite ? 'currentColor' : 'none'} />
                                </button>

                                {/* Symbol Icon */}
                                <div
                                    className={styles.symbolIcon}
                                    style={{
                                        backgroundColor: icon.bgColor,
                                        color: icon.color
                                    }}
                                >
                                    {icon.text}
                                </div>

                                {/* Symbol Name */}
                                <div className={styles.itemSymbol}>
                                    <HighlightText text={s.symbol} highlight={searchTerm} />
                                </div>

                                {/* Description */}
                                <div className={styles.itemDesc}>
                                    <HighlightText text={s.name} highlight={searchTerm} />
                                </div>

                                {/* Type + Exchange + Check */}
                                <div className={styles.itemMeta}>
                                    {typeLabel && (
                                        <span className={styles.typeLabel}>{typeLabel}</span>
                                    )}
                                    <span className={styles.exchangeBadge}>{exchangeBadge}</span>
                                    {isAdded && (
                                        <div
                                            className={styles.checkIcon}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelect(s);
                                            }}
                                        >
                                            <Check size={20} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {!isLoading && displaySymbols.length === 0 && searchTerm.length >= 2 && (
                        <div className={styles.noResults}>No symbols found</div>
                    )}
                </div>


            </div>
        </div>
    );
};

export default SymbolSearch;
