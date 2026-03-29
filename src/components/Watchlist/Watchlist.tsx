import React, { useState, useMemo, useCallback, useRef } from 'react';
import type { KeyboardEvent, DragEvent, MouseEvent } from 'react';
import { Plus, Library } from 'lucide-react';
import styles from './Watchlist.module.css';
import classNames from 'classnames';
import WatchlistSelector from './WatchlistSelector';
import WatchlistItem from './WatchlistItem';
import WatchlistSection from './WatchlistSection';
import SymbolTooltip from './SymbolTooltip';
import ContextMenu from './ContextMenu';
import StockLibrary from './StockLibrary';
import { useSmartTooltip } from '../../hooks/useSmartTooltip';

// Import extracted hooks
import { useColumnResize, DEFAULT_COLUMN_WIDTHS, MIN_COLUMN_WIDTH } from './hooks';

// Import constants
import { SYMBOL_FULL_NAMES, isMarketOpenNow } from './constants/watchlistConstants';

interface WatchlistItemData {
    symbol: string;
    exchange: string;
    last: string | number;
    chg: string | number;
    chgP: string | number;
    up: boolean;
    globalIndex?: number;
}

type WatchlistItem_or_Section = WatchlistItemData | string;

interface SymbolData {
    symbol: string;
    exchange: string;
}

interface WatchlistData {
    id: string;
    name: string;
    symbols?: WatchlistItem_or_Section[];
    isFavorite?: boolean;
    favoriteEmoji?: string;
}

interface SortConfig {
    key: string | null;
    direction: 'asc' | 'desc';
}

interface ContextMenuState {
    isVisible: boolean;
    position: { x: number; y: number };
    item: WatchlistItemData | null;
    index: number | null;
}

interface GroupedItems {
    section: string | null;
    items: WatchlistItemData[];
    sectionIndex: number | null;
}

export interface WatchlistProps {
    currentSymbol?: string;
    currentExchange?: string;
    items: WatchlistItem_or_Section[];
    onSymbolSelect: (data: SymbolData) => void;
    onAddClick?: () => void;
    onRemoveClick: (data: SymbolData) => void;
    onReorder?: (items: WatchlistItem_or_Section[]) => void;
    isLoading?: boolean;
    // Multiple watchlists props
    watchlists?: WatchlistData[];
    activeWatchlistId?: string | null;
    onSwitchWatchlist?: (id: string) => void;
    onCreateWatchlist?: (name: string) => void;
    onRenameWatchlist?: (id: string, name: string) => void;
    onDeleteWatchlist?: (id: string) => void;
    onClearWatchlist?: (id: string) => void;
    onCopyWatchlist?: (id: string, newName: string) => void;
    // Section management
    onAddSection?: (name: string, index: number) => void;
    onRenameSection?: (oldTitle: string, newTitle: string) => void;
    onDeleteSection?: (title: string) => void;
    collapsedSections?: string[];
    onToggleSection?: (title: string) => void;
    // Track selected symbol for add section above
    selectedSymbolIndex?: number | null;
    // Import/Export props
    onExport?: (id: string) => void;
    onImport?: (symbols: SymbolData[], watchlistId: string) => void;
    // Favorites props
    favoriteWatchlists?: WatchlistData[];
    onToggleFavorite?: (id: string, emoji: string | null) => void;
    // Stock Library
    showStockLibrary?: boolean;
    onToggleStockLibrary?: () => void;
}

const SkeletonRow: React.FC = () => (
    <div className={styles.skeletonItem}>
        <div className={classNames(styles.skeletonCell, styles.skeletonSymbol)} />
        <div className={classNames(styles.skeletonCell, styles.skeletonPrice)} />
        <div className={classNames(styles.skeletonCell, styles.skeletonChange)} />
        <div className={classNames(styles.skeletonCell, styles.skeletonPercent)} />
    </div>
);

const Watchlist: React.FC<WatchlistProps> = ({
    currentSymbol,
    currentExchange = 'NSE',
    items,
    onSymbolSelect,
    onAddClick,
    onRemoveClick,
    onReorder,
    isLoading = false,
    // Multiple watchlists props
    watchlists = [],
    activeWatchlistId = null,
    onSwitchWatchlist,
    onCreateWatchlist,
    onRenameWatchlist,
    onDeleteWatchlist,
    onClearWatchlist,
    onCopyWatchlist,
    // Section management
    onAddSection,
    onRenameSection,
    onDeleteSection,
    collapsedSections = [],
    onToggleSection,
    // Track selected symbol for add section above
    selectedSymbolIndex = null,
    // Import/Export props
    onExport,
    onImport,
    // Favorites props
    favoriteWatchlists = [],
    onToggleFavorite,
    // Stock Library
    showStockLibrary: showStockLibraryProp,
    onToggleStockLibrary,
}) => {
    const [showLibraryInternal, setShowLibraryInternal] = useState(false);
    const showLibrary = showStockLibraryProp !== undefined ? showStockLibraryProp : showLibraryInternal;
    const toggleLibrary = onToggleStockLibrary ?? (() => setShowLibraryInternal(v => !v));
    const hasMultipleWatchlists = watchlists.length > 0 && onSwitchWatchlist;
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [draggedSection, setDraggedSection] = useState<string | null>(null);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const listRef = useRef<HTMLDivElement>(null);

    // Use extracted column resize hook
    const { columnWidths, resizing, handleResizeStart } = useColumnResize();

    // Smart tooltip state
    const tooltip = useSmartTooltip();

    // Context menu state
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        isVisible: false,
        position: { x: 0, y: 0 },
        item: null,
        index: null,
    });

    const handleSort = useCallback((key: string): void => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key) {
            if (sortConfig.direction === 'asc') {
                direction = 'desc';
            } else {
                setSortConfig({ key: null, direction: 'asc' });
                return;
            }
        }
        setSortConfig({ key, direction });
    }, [sortConfig]);

    const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, index: number): void => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData('text/plain', index.toString());
    }, []);

    const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, index: number): void => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
    }, []);

    const handleDragEnd = useCallback((): void => {
        setDraggedIndex(null);
    }, []);

    const handleDrop = useCallback((e: DragEvent<HTMLDivElement>, dropIndex: number): void => {
        e.preventDefault();
        e.stopPropagation();

        if (draggedIndex === null || draggedIndex === dropIndex) {
            setDraggedIndex(null);
            return;
        }

        const newItems = [...items];
        const [draggedItem] = newItems.splice(draggedIndex, 1);
        newItems.splice(dropIndex, 0, draggedItem);

        if (onReorder) onReorder(newItems);
        setDraggedIndex(null);
    }, [draggedIndex, items, onReorder]);

    // Section drag handlers
    const handleSectionDragStart = useCallback((e: DragEvent<HTMLDivElement>, sectionTitle: string, sectionIdx: number): void => {
        setDraggedSection(sectionTitle);
        setDraggedIndex(sectionIdx);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData('text/plain', sectionIdx.toString());
    }, []);

    const handleSectionDragEnd = useCallback((): void => {
        setDraggedSection(null);
        setDraggedIndex(null);
    }, []);

    // Section drop
    const handleSectionDrop = useCallback((e: DragEvent<HTMLDivElement>, sectionIndex: number, targetSectionTitle: string): void => {
        e.preventDefault();
        e.stopPropagation();

        const data = e.dataTransfer.getData('text/plain');
        const draggedIdx = parseInt(data, 10);

        if (isNaN(draggedIdx) || draggedIdx === sectionIndex) {
            setDraggedIndex(null);
            setDraggedSection(null);
            return;
        }

        const newItems = [...items];
        const [draggedItem] = newItems.splice(draggedIdx, 1);
        const insertIndex = draggedIdx < sectionIndex ? sectionIndex : sectionIndex + 1;
        newItems.splice(insertIndex, 0, draggedItem);

        if (onReorder) onReorder(newItems);
        setDraggedIndex(null);
        setDraggedSection(null);
    }, [items, onReorder]);

    const handleItemMouseEnter = useCallback((e: MouseEvent<HTMLDivElement>, item: WatchlistItemData, rect?: DOMRect): void => {
        const fullName = (SYMBOL_FULL_NAMES as Record<string, string>)[item.symbol] || item.symbol;
        const isMarketOpen = isMarketOpenNow(item.exchange);

        tooltip.showTooltip(
            {
                fullName,
                symbol: item.symbol,
                exchange: item.exchange,
                dataType: 'Real-time',
                isMarketOpen,
            } as any,
            rect?.left || e.clientX,
            rect?.bottom || e.clientY
        );
    }, [tooltip]);

    const handleItemMouseLeave = useCallback((): void => {
        tooltip.hideTooltip();
    }, [tooltip]);

    const handleItemMouseMove = useCallback((e: MouseEvent<HTMLDivElement>): void => {
        if (tooltip.isVisible) {
            tooltip.updatePosition(e.clientX, e.clientY);
        }
    }, [tooltip]);

    // Context menu handlers
    const handleContextMenu = useCallback((e: MouseEvent<HTMLDivElement>, item: WatchlistItemData, index: number): void => {
        e.preventDefault();
        setContextMenu({
            isVisible: true,
            position: { x: e.clientX, y: e.clientY },
            item,
            index,
        });
    }, []);

    const handleCloseContextMenu = useCallback((): void => {
        setContextMenu(prev => ({ ...prev, isVisible: false }));
    }, []);

    // Generate next section name
    const getNextSectionName = useCallback((): string => {
        const sectionNames = items
            .filter((item): item is string => typeof item === 'string' && item.startsWith('###'))
            .map(s => s.replace('###', ''));

        const existingNumbers = sectionNames
            .map(title => {
                const match = title.match(/^SECTION\s+(\d+)$/i);
                return match ? parseInt(match[1], 10) : 0;
            })
            .filter(n => n > 0);
        const maxNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
        return `SECTION ${maxNum + 1}`;
    }, [items]);

    const handleAddSectionAbove = useCallback((): void => {
        if (onAddSection && contextMenu.index !== null) {
            const sectionName = getNextSectionName();
            onAddSection(sectionName, contextMenu.index);
        }
    }, [onAddSection, contextMenu.index, getNextSectionName]);

    const handleMoveToTop = useCallback((): void => {
        if (contextMenu.index !== null && contextMenu.index > 0) {
            const newItems = [...items];
            const [movedItem] = newItems.splice(contextMenu.index, 1);
            newItems.unshift(movedItem);
            if (onReorder) onReorder(newItems);
        }
    }, [contextMenu.index, items, onReorder]);

    const handleMoveToBottom = useCallback((): void => {
        if (contextMenu.index !== null && contextMenu.index < items.length - 1) {
            const newItems = [...items];
            const [movedItem] = newItems.splice(contextMenu.index, 1);
            newItems.push(movedItem);
            if (onReorder) onReorder(newItems);
        }
    }, [contextMenu.index, items, onReorder]);

    const handleRemoveFromMenu = useCallback((): void => {
        if (contextMenu.item) {
            onRemoveClick({ symbol: contextMenu.item.symbol, exchange: contextMenu.item.exchange });
        }
    }, [contextMenu.item, onRemoveClick]);

    const sortedItems = useMemo((): WatchlistItem_or_Section[] => {
        if (!sortConfig.key) return items;

        const result: WatchlistItem_or_Section[] = [];
        let currentGroup: WatchlistItemData[] = [];

        function sortGroup(group: WatchlistItemData[]): WatchlistItemData[] {
            return [...group].sort((a, b) => {
                const key = sortConfig.key as keyof WatchlistItemData;
                let aValue = a[key];
                let bValue = b[key];

                if (['last', 'chg', 'chgP'].includes(sortConfig.key!)) {
                    aValue = parseFloat(String(aValue)) || 0;
                    bValue = parseFloat(String(bValue)) || 0;
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        for (const item of items) {
            if (typeof item === 'string' && item.startsWith('###')) {
                if (currentGroup.length > 0) {
                    result.push(...sortGroup(currentGroup));
                }
                result.push(item);
                currentGroup = [];
            } else {
                currentGroup.push(item as WatchlistItemData);
            }
        }
        if (currentGroup.length > 0) {
            result.push(...sortGroup(currentGroup));
        }

        return result;
    }, [items, sortConfig]);

    // Group items by section
    const groupedItems = useMemo((): GroupedItems[] => {
        const groups: GroupedItems[] = [];
        let currentSection: string | null = null;
        let currentItems: WatchlistItemData[] = [];

        for (let i = 0; i < sortedItems.length; i++) {
            const item = sortedItems[i];

            if (typeof item === 'string' && item.startsWith('###')) {
                if (currentItems.length > 0 || currentSection !== null) {
                    groups.push({
                        section: currentSection,
                        items: currentItems,
                        sectionIndex: currentSection !== null ? i - currentItems.length - 1 : null
                    });
                }
                currentSection = item.replace('###', '');
                currentItems = [];
            } else {
                currentItems.push({ ...(item as WatchlistItemData), globalIndex: i });
            }
        }

        if (currentItems.length > 0 || currentSection !== null) {
            groups.push({
                section: currentSection,
                items: currentItems,
                sectionIndex: currentSection !== null
                    ? sortedItems.length - currentItems.length - 1
                    : null
            });
        }

        if (groups.length === 0) {
            groups.push({ section: null, items: [], sectionIndex: null });
        }

        return groups;
    }, [sortedItems]);

    // Get flat list of stock items for keyboard navigation
    const stockItems = useMemo((): WatchlistItemData[] => {
        return sortedItems.filter((item): item is WatchlistItemData =>
            typeof item !== 'string' || !item.startsWith('###')
        );
    }, [sortedItems]);

    // Keyboard navigation handler
    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>): void => {
        if (stockItems.length === 0) return;

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

    // Wrapper for onSymbolSelect
    const handleSymbolSelect = useCallback((symData: SymbolData): void => {
        const idx = stockItems.findIndex(
            i => i.symbol === symData.symbol && i.exchange === (symData.exchange || 'NSE')
        );
        if (idx >= 0) {
            setFocusedIndex(idx);
        }
        onSymbolSelect(symData);
    }, [stockItems, onSymbolSelect]);

    return (
        <div
            className={classNames(styles.watchlist, { [styles.isResizing]: resizing })}
            onMouseLeave={() => tooltip.reset()}
        >
            <div className={styles.header}>
                {hasMultipleWatchlists ? (
                    <WatchlistSelector
                        watchlists={watchlists}
                        activeId={activeWatchlistId}
                        onSwitch={onSwitchWatchlist!}
                        onCreate={onCreateWatchlist!}
                        onRename={onRenameWatchlist!}
                        onDelete={onDeleteWatchlist!}
                        onClear={onClearWatchlist}
                        onCopy={onCopyWatchlist}
                        onAddSection={() => {
                            const sectionName = getNextSectionName();
                            const insertIndex = selectedSymbolIndex !== null ? selectedSymbolIndex : items.length;
                            onAddSection?.(sectionName, insertIndex);
                        }}
                        onExport={onExport}
                        onImport={onImport}
                        onToggleFavorite={onToggleFavorite}
                    />
                ) : (
                    <span className={styles.title}>Watchlist</span>
                )}

                <div className={styles.actions}>
                    <span title="Stock Library – browse &amp; discover stocks" style={{ cursor: 'pointer' }}>
                        <Library
                            size={16}
                            className={classNames(styles.icon, { [styles.iconActive]: showLibrary })}
                            onClick={toggleLibrary}
                        />
                    </span>
                    <span title="Add symbol"><Plus size={16} className={styles.icon} onClick={onAddClick} /></span>
                </div>
            </div>

            {/* Quick-access favorites bar */}
            {favoriteWatchlists.length > 0 && (
                <div className={styles.quickAccessRow}>
                    {favoriteWatchlists.map(wl => (
                        <button
                            key={wl.id}
                            className={classNames(styles.quickAccessBtn, {
                                [styles.active]: wl.id === activeWatchlistId,
                            })}
                            onClick={() => onSwitchWatchlist?.(wl.id)}
                            title={wl.name}
                        >
                            {wl.favoriteEmoji || wl.name.charAt(0)}
                        </button>
                    ))}
                </div>
            )}

            <div className={styles.columnHeaders}>
                <span
                    className={styles.colSymbol}
                    style={{ width: columnWidths.symbol, minWidth: columnWidths.symbol }}
                    onClick={() => handleSort('symbol')}
                >
                    Symbol {sortConfig.key === 'symbol' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </span>
                <div
                    className={styles.resizeHandle}
                    onMouseDown={(e) => handleResizeStart(e, 'symbol')}
                />
                <span
                    className={styles.colLast}
                    style={{ width: columnWidths.last, minWidth: MIN_COLUMN_WIDTH }}
                    onClick={() => handleSort('last')}
                >
                    Last {sortConfig.key === 'last' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </span>
                <div
                    className={styles.resizeHandle}
                    onMouseDown={(e) => handleResizeStart(e, 'last')}
                />
                <span
                    className={styles.colChg}
                    style={{ width: columnWidths.chg, minWidth: MIN_COLUMN_WIDTH }}
                    onClick={() => handleSort('chg')}
                >
                    Chg {sortConfig.key === 'chg' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </span>
                <div
                    className={styles.resizeHandle}
                    onMouseDown={(e) => handleResizeStart(e, 'chg')}
                />
                <span
                    className={styles.colChgP}
                    style={{ width: columnWidths.chgP, minWidth: MIN_COLUMN_WIDTH }}
                    onClick={() => handleSort('chgP')}
                >
                    Chg% {sortConfig.key === 'chgP' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </span>
            </div>

            {/* Stock Library overlay */}
            {showLibrary && (
                <StockLibrary
                    watchlists={watchlists as any}
                    activeWatchlistId={activeWatchlistId}
                    onClose={toggleLibrary}
                    onSwitchWatchlist={onSwitchWatchlist ?? (() => {})}
                    onCreateWatchlist={onCreateWatchlist ?? (() => {})}
                    onImport={onImport ?? (() => {})}
                    onSymbolSelect={onSymbolSelect}
                />
            )}

            <div
                className={styles.list}
                ref={listRef}
                tabIndex={0}
                onKeyDown={handleKeyDown}
            >
                {isLoading ? (
                    Array.from({ length: 5 }).map((_, index) => (
                        <SkeletonRow key={`skeleton-${index}`} />
                    ))
                ) : sortedItems.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Plus size={24} />
                        <p>No symbols in watchlist</p>
                    </div>
                ) : (
                    groupedItems.map((group, groupIndex) => {
                        const sectionStartIndex = group.sectionIndex ?? 0;

                        return (
                            <React.Fragment key={`group-${groupIndex}`}>
                                {group.section && (
                                    <WatchlistSection
                                        title={group.section}
                                        isCollapsed={collapsedSections?.includes(group.section)}
                                        isDragging={draggedSection === group.section}
                                        onToggle={() => onToggleSection?.(group.section!)}
                                        onRename={(oldTitle, newTitle) => onRenameSection?.(oldTitle, newTitle)}
                                        onDelete={(title) => onDeleteSection?.(title)}
                                        sectionIndex={sectionStartIndex}
                                        onDragStart={handleSectionDragStart}
                                        onDragOver={handleDragOver}
                                        onDragEnd={handleSectionDragEnd}
                                        onDrop={handleSectionDrop}
                                    >
                                        {group.items.map((item) => {
                                            const globalIndex = sortedItems.findIndex(
                                                i => typeof i !== 'string' && i.symbol === item.symbol && i.exchange === item.exchange
                                            );
                                            const stockIndex = stockItems.findIndex(
                                                i => i.symbol === item.symbol && i.exchange === item.exchange
                                            );
                                            return (
                                                <WatchlistItem
                                                    key={`${item.symbol}-${item.exchange}`}
                                                    item={item}
                                                    isActive={currentSymbol === item.symbol && currentExchange === (item.exchange || 'NSE')}
                                                    isFocused={stockIndex === focusedIndex}
                                                    isDragging={draggedIndex === globalIndex}
                                                    columnWidths={columnWidths}
                                                    minColumnWidth={MIN_COLUMN_WIDTH}
                                                    sortEnabled={!!sortConfig.key}
                                                    index={globalIndex}
                                                    onSelect={handleSymbolSelect}
                                                    onRemove={onRemoveClick}
                                                    onDragStart={handleDragStart}
                                                    onDragOver={handleDragOver}
                                                    onDragEnd={handleDragEnd}
                                                    onDrop={handleDrop}
                                                    onContextMenu={handleContextMenu}
                                                    onMouseEnter={handleItemMouseEnter}
                                                    onMouseLeave={handleItemMouseLeave}
                                                    onMouseMove={handleItemMouseMove}
                                                />
                                            );
                                        })}
                                    </WatchlistSection>
                                )}
                                {!group.section && group.items.map((item) => {
                                    const globalIndex = sortedItems.findIndex(
                                        i => typeof i !== 'string' && i.symbol === item.symbol && i.exchange === item.exchange
                                    );
                                    const stockIndex = stockItems.findIndex(
                                        i => i.symbol === item.symbol && i.exchange === item.exchange
                                    );
                                    return (
                                        <WatchlistItem
                                            key={`${item.symbol}-${item.exchange}`}
                                            item={item}
                                            isActive={currentSymbol === item.symbol && currentExchange === (item.exchange || 'NSE')}
                                            isFocused={stockIndex === focusedIndex}
                                            isDragging={draggedIndex === globalIndex}
                                            columnWidths={columnWidths}
                                            minColumnWidth={MIN_COLUMN_WIDTH}
                                            sortEnabled={!!sortConfig.key}
                                            index={globalIndex}
                                            onSelect={handleSymbolSelect}
                                            onRemove={onRemoveClick}
                                            onDragStart={handleDragStart}
                                            onDragOver={handleDragOver}
                                            onDragEnd={handleDragEnd}
                                            onDrop={handleDrop}
                                            onContextMenu={handleContextMenu}
                                            onMouseEnter={handleItemMouseEnter}
                                            onMouseLeave={handleItemMouseLeave}
                                            onMouseMove={handleItemMouseMove}
                                        />
                                    );
                                })}
                            </React.Fragment>
                        );
                    })
                )}
            </div>

            {/* Smart Tooltip */}
            <SymbolTooltip
                isVisible={tooltip.isVisible}
                content={tooltip.content as any}
                position={tooltip.position}
            />

            {/* Context Menu */}
            <ContextMenu
                isVisible={contextMenu.isVisible}
                position={contextMenu.position}
                onClose={handleCloseContextMenu}
                onAddSection={handleAddSectionAbove}
                onMoveToTop={handleMoveToTop}
                onMoveToBottom={handleMoveToBottom}
                onRemove={handleRemoveFromMenu}
            />
        </div>
    );
};

export default React.memo(Watchlist);
