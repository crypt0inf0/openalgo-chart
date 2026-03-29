import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { KeyboardEvent, ChangeEvent } from 'react';
import { X, Search, Plus, List, ChevronRight, Check, BarChart2 } from 'lucide-react';
import classNames from 'classnames';
import styles from './StockLibrary.module.css';
import { DISCOVER_SEGMENTS } from '../../data/stockLists';
import type { DiscoverGroup } from '../../data/stockLists';

interface SymbolItem {
    symbol: string;
    exchange: string;
}

interface WatchlistData {
    id: string;
    name: string;
    symbols?: (SymbolItem | string)[];
    isFavorite?: boolean;
}

export interface StockLibraryProps {
    watchlists: WatchlistData[];
    activeWatchlistId: string | null;
    onClose: () => void;
    onSwitchWatchlist: (id: string) => void;
    onCreateWatchlist: (name: string) => void;
    onImport: (symbols: SymbolItem[], watchlistId: string) => void;
    onSymbolSelect: (data: SymbolItem) => void;
}

const StockLibrary: React.FC<StockLibraryProps> = ({
    watchlists,
    activeWatchlistId,
    onClose,
    onSwitchWatchlist,
    onCreateWatchlist,
    onImport,
    onSymbolSelect,
}) => {
    const [tab, setTab] = useState<'my' | 'discover'>('my');
    const [search, setSearch] = useState('');
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
    const [showCreateInput, setShowCreateInput] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [addedFeedback, setAddedFeedback] = useState<string | null>(null);
    const createInputRef = useRef<HTMLInputElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Auto-focus search when opening Discover tab
    useEffect(() => {
        if (tab === 'discover' && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [tab]);

    // Focus create input
    useEffect(() => {
        if (showCreateInput && createInputRef.current) {
            createInputRef.current.focus();
        }
    }, [showCreateInput]);

    const handleCreateSubmit = useCallback(() => {
        const name = newListName.trim();
        if (name) {
            onCreateWatchlist(name);
            setNewListName('');
            setShowCreateInput(false);
        }
    }, [newListName, onCreateWatchlist]);

    const handleCreateKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handleCreateSubmit();
        if (e.key === 'Escape') { setShowCreateInput(false); setNewListName(''); }
    };

    // Add entire group to the active watchlist
    const handleAddGroup = useCallback((group: DiscoverGroup, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!activeWatchlistId) return;
        const symbols: SymbolItem[] = group.stocks.map(s => ({ symbol: s.symbol, exchange: s.exchange }));
        onImport(symbols, activeWatchlistId);
        setAddedFeedback(group.id);
        setTimeout(() => setAddedFeedback(null), 1500);
    }, [activeWatchlistId, onImport]);

    // Add single stock to the active watchlist
    const handleAddStock = useCallback((symbol: string, exchange: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!activeWatchlistId) return;
        onImport([{ symbol, exchange }], activeWatchlistId);
    }, [activeWatchlistId, onImport]);

    // Filtered discover data
    const filteredSegments = useMemo(() => {
        if (!search.trim()) return DISCOVER_SEGMENTS;
        const q = search.toLowerCase();
        return DISCOVER_SEGMENTS.map(seg => ({
            ...seg,
            groups: seg.groups
                .map(grp => ({
                    ...grp,
                    stocks: grp.stocks.filter(
                        s => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
                    ),
                }))
                .filter(grp => grp.name.toLowerCase().includes(q) || grp.stocks.length > 0),
        })).filter(seg => seg.groups.length > 0);
    }, [search]);

    // Auto-expand when searching
    useEffect(() => {
        if (search.trim()) {
            // Expand first group that has matching stocks
            for (const seg of filteredSegments) {
                for (const grp of seg.groups) {
                    if (grp.stocks.length > 0) {
                        setExpandedGroup(grp.id);
                        return;
                    }
                }
            }
        }
    }, [search, filteredSegments]);

    // Filtered My Lists
    const filteredWatchlists = useMemo(() => {
        if (!search.trim()) return watchlists;
        const q = search.toLowerCase();
        return watchlists.filter(wl => wl.name.toLowerCase().includes(q));
    }, [watchlists, search]);

    const symbolCount = (wl: WatchlistData): number => {
        if (!wl.symbols) return 0;
        return wl.symbols.filter(s => !(typeof s === 'string' && s.startsWith('###'))).length;
    };

    return (
        <div className={styles.overlay}>
            {/* Header */}
            <div className={styles.header}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--tv-color-text-primary)' }}>
                    Stock Library
                </span>
                <button className={styles.closeBtn} onClick={onClose} title="Close">
                    <X size={16} />
                </button>
            </div>

            {/* Tab Bar */}
            <div className={styles.tabBar}>
                <button
                    className={classNames(styles.tab, { [styles.tabActive]: tab === 'my' })}
                    onClick={() => setTab('my')}
                >
                    My lists
                </button>
                <button
                    className={classNames(styles.tab, { [styles.tabActive]: tab === 'discover' })}
                    onClick={() => setTab('discover')}
                >
                    Discover
                </button>
                <div className={styles.tabSpacer} />
                <button
                    className={styles.newListBtn}
                    onClick={() => { setShowCreateInput(true); setTab('my'); }}
                    title="Create new watchlist"
                >
                    <Plus size={13} />
                    New list
                </button>
            </div>

            {/* Search Bar */}
            <div className={styles.searchBar}>
                <Search size={14} className={styles.searchIcon} />
                <input
                    ref={searchInputRef}
                    type="text"
                    className={styles.searchInput}
                    placeholder={tab === 'my' ? 'Search lists...' : 'Search stocks & groups...'}
                    value={search}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                />
                {search && (
                    <button className={styles.clearSearchBtn} onClick={() => setSearch('')}>
                        <X size={13} />
                    </button>
                )}
            </div>

            {/* Create Input Row */}
            {showCreateInput && tab === 'my' && (
                <div className={styles.createListRow}>
                    <input
                        ref={createInputRef}
                        type="text"
                        className={styles.createListInput}
                        placeholder="New watchlist name"
                        value={newListName}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setNewListName(e.target.value)}
                        onKeyDown={handleCreateKeyDown}
                    />
                    <button
                        className={classNames(styles.iconBtn, styles.iconBtnGreen)}
                        onClick={handleCreateSubmit}
                        title="Create"
                        disabled={!newListName.trim()}
                    >
                        <Check size={14} />
                    </button>
                    <button
                        className={styles.iconBtn}
                        onClick={() => { setShowCreateInput(false); setNewListName(''); }}
                        title="Cancel"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Scrollable Content */}
            <div className={styles.content}>
                {/* ── My Lists Tab ── */}
                {tab === 'my' && (
                    <>
                        {filteredWatchlists.length === 0 ? (
                            <div className={styles.emptyState}>No watchlists found</div>
                        ) : (
                            filteredWatchlists.map(wl => (
                                <div
                                    key={wl.id}
                                    className={classNames(styles.myListItem, {
                                        [styles.myListItemActive]: wl.id === activeWatchlistId,
                                    })}
                                    onClick={() => { onSwitchWatchlist(wl.id); onClose(); }}
                                >
                                    <List size={14} className={styles.myListIcon} />
                                    <span className={styles.myListName}>{wl.name}</span>
                                    <span className={styles.myListCount}>{symbolCount(wl)}</span>
                                    {wl.id !== activeWatchlistId && (
                                        <div className={styles.myListActions}>
                                            <button
                                                className={styles.switchBtn}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSwitchWatchlist(wl.id);
                                                    onClose();
                                                }}
                                            >
                                                Switch
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </>
                )}

                {/* ── Discover Tab ── */}
                {tab === 'discover' && (
                    <>
                        {filteredSegments.length === 0 ? (
                            <div className={styles.emptyState}>No results for "{search}"</div>
                        ) : (
                            filteredSegments.map(segment => (
                                <div key={segment.id}>
                                    <div className={styles.segmentHeader}>{segment.name}</div>

                                    {segment.groups.map(group => {
                                        const isExpanded = expandedGroup === group.id;
                                        const isAdded = addedFeedback === group.id;

                                        return (
                                            <div key={group.id}>
                                                {/* Group Row */}
                                                <div
                                                    className={classNames(styles.groupRow, {
                                                        [styles.groupRowActive]: isExpanded,
                                                    })}
                                                    onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                                                >
                                                    <BarChart2
                                                        size={14}
                                                        className={classNames(styles.groupIcon, {
                                                            [styles.groupIconActive]: isExpanded,
                                                        })}
                                                    />
                                                    <span
                                                        className={classNames(styles.groupName, {
                                                            [styles.groupNameActive]: isExpanded,
                                                        })}
                                                    >
                                                        {group.name}
                                                    </span>

                                                    <div className={styles.groupActions}>
                                                        <span className={styles.groupCount}>
                                                            {group.stocks.length}
                                                        </span>
                                                        {activeWatchlistId && (
                                                            <button
                                                                className={styles.addGroupBtn}
                                                                onClick={(e) => handleAddGroup(group, e)}
                                                                title={`Add all ${group.stocks.length} stocks to watchlist`}
                                                            >
                                                                {isAdded ? '✓ Added' : '+ Add to my lists'}
                                                            </button>
                                                        )}
                                                    </div>

                                                    <ChevronRight
                                                        size={14}
                                                        className={classNames(styles.groupChevron, {
                                                            [styles.groupChevronOpen]: isExpanded,
                                                        })}
                                                    />
                                                </div>

                                                {/* Expanded Stock List */}
                                                {isExpanded && (
                                                    <div className={styles.stockList}>
                                                        {(search.trim() ? group.stocks : group.stocks).map(stock => (
                                                            <div
                                                                key={`${stock.symbol}-${stock.exchange}`}
                                                                className={styles.stockRow}
                                                                onClick={() => {
                                                                    onSymbolSelect({ symbol: stock.symbol, exchange: stock.exchange });
                                                                    onClose();
                                                                }}
                                                            >
                                                                <span className={styles.stockSymbol}>{stock.symbol}</span>
                                                                <span className={styles.stockName}>{stock.name}</span>
                                                                <span className={styles.stockExchange}>{stock.exchange}</span>
                                                                {activeWatchlistId && (
                                                                    <button
                                                                        className={styles.addStockBtn}
                                                                        title={`Add ${stock.symbol} to watchlist`}
                                                                        onClick={(e) => handleAddStock(stock.symbol, stock.exchange, e)}
                                                                    >
                                                                        <Plus size={13} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default React.memo(StockLibrary);
