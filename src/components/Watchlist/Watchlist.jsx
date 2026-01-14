import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Plus } from 'lucide-react';
import styles from './Watchlist.module.css';
import classNames from 'classnames';
import WatchlistSelector from './WatchlistSelector';
import WatchlistItem from './WatchlistItem';
import WatchlistSection from './WatchlistSection';
import SymbolTooltip from './SymbolTooltip';
import ContextMenu from './ContextMenu';
import { useSmartTooltip } from '../../hooks/useSmartTooltip';

// Import extracted hooks
import { useColumnResize, DEFAULT_COLUMN_WIDTHS, MIN_COLUMN_WIDTH } from './hooks';

// Import constants
import { SYMBOL_FULL_NAMES, isMarketOpenNow } from './constants/watchlistConstants';

const SkeletonRow = () => (
    <div className={styles.skeletonItem}>
        <div className={classNames(styles.skeletonCell, styles.skeletonSymbol)} />
        <div className={classNames(styles.skeletonCell, styles.skeletonPrice)} />
        <div className={classNames(styles.skeletonCell, styles.skeletonChange)} />
        <div className={classNames(styles.skeletonCell, styles.skeletonPercent)} />
    </div>
);

const Watchlist = ({
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
    // Section management (TradingView model: sections are ### strings in items array)
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
}) => {
    const hasMultipleWatchlists = watchlists.length > 0 && onSwitchWatchlist;
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [draggedSection, setDraggedSection] = useState(null); // Track dragged section
    const [focusedIndex, setFocusedIndex] = useState(-1); // Keyboard navigation
    const listRef = useRef(null);

    // Use extracted column resize hook
    const { columnWidths, resizing, handleResizeStart } = useColumnResize();

    // Smart tooltip state
    const tooltip = useSmartTooltip();

    // Context menu state
    const [contextMenu, setContextMenu] = useState({
        isVisible: false,
        position: { x: 0, y: 0 },
        item: null,
        index: null,
    });

    const handleSort = useCallback((key) => {
        let direction = 'asc';
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

    const handleDragStart = useCallback((e, index) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = "move";
        // Set data for cross-browser compatibility
        e.dataTransfer.setData('text/plain', index.toString());
    }, []);

    const handleDragOver = useCallback((e, index) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
    }, []);

    const handleDragEnd = useCallback(() => {
        setDraggedIndex(null);
    }, []);

    const handleDrop = useCallback((e, dropIndex) => {
        e.preventDefault();
        e.stopPropagation();

        if (draggedIndex === null || draggedIndex === dropIndex) {
            setDraggedIndex(null);
            return;
        }

        const newItems = [...items];
        const [draggedItem] = newItems.splice(draggedIndex, 1);
        newItems.splice(dropIndex, 0, draggedItem);

        // With flat array model, just reorder and pass the whole array
        if (onReorder) onReorder(newItems);
        setDraggedIndex(null);
    }, [draggedIndex, items, onReorder]);

    // Section drag handlers - with flat array, sections are just items in the array
    const handleSectionDragStart = useCallback((e, sectionTitle, sectionIdx) => {
        setDraggedSection(sectionTitle);
        setDraggedIndex(sectionIdx); // Track the section's index in the array
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData('text/plain', sectionIdx.toString());
    }, []);

    const handleSectionDragEnd = useCallback(() => {
        setDraggedSection(null);
        setDraggedIndex(null);
    }, []);

    // Section drop - for dropping items onto section headers
    const handleSectionDrop = useCallback((e, sectionIndex, targetSectionTitle) => {
        e.preventDefault();
        e.stopPropagation();

        // Get dragged item index from dataTransfer
        const data = e.dataTransfer.getData('text/plain');
        const draggedIdx = parseInt(data, 10);

        if (isNaN(draggedIdx) || draggedIdx === sectionIndex) {
            setDraggedIndex(null);
            setDraggedSection(null);
            return;
        }

        // Move the dragged item to right after the section header
        const newItems = [...items];
        const [draggedItem] = newItems.splice(draggedIdx, 1);

        // Insert right after the section marker
        const insertIndex = draggedIdx < sectionIndex ? sectionIndex : sectionIndex + 1;
        newItems.splice(insertIndex, 0, draggedItem);

        if (onReorder) onReorder(newItems);
        setDraggedIndex(null);
        setDraggedSection(null);
    }, [items, onReorder]);

    const handleItemMouseEnter = useCallback((e, item, rect) => {
        const fullName = SYMBOL_FULL_NAMES[item.symbol] || item.symbol;
        const isMarketOpen = isMarketOpenNow(item.exchange);

        tooltip.showTooltip(
            {
                fullName,
                symbol: item.symbol,
                exchange: item.exchange,
                dataType: 'Real-time',
                isMarketOpen,
            },
            rect?.left || e.clientX,
            rect?.bottom || e.clientY
        );
    }, [tooltip]);

    const handleItemMouseLeave = useCallback(() => {
        tooltip.hideTooltip();
    }, [tooltip]);

    const handleItemMouseMove = useCallback((e) => {
        if (tooltip.isVisible) {
            tooltip.updatePosition(e.clientX, e.clientY);
        }
    }, [tooltip]);

    // Context menu handlers
    const handleContextMenu = useCallback((e, item, index) => {
        e.preventDefault();
        setContextMenu({
            isVisible: true,
            position: { x: e.clientX, y: e.clientY },
            item,
            index,
        });
    }, []);

    const handleCloseContextMenu = useCallback(() => {
        setContextMenu(prev => ({ ...prev, isVisible: false }));
    }, []);

    // Generate next section name like "SECTION 1", "SECTION 2"...
    const getNextSectionName = useCallback(() => {
        // Extract section names from items (### prefixed strings)
        const sectionNames = items
            .filter(item => typeof item === 'string' && item.startsWith('###'))
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

    const handleAddSectionAbove = useCallback(() => {
        if (onAddSection && contextMenu.index !== null) {
            const sectionName = getNextSectionName();
            onAddSection(sectionName, contextMenu.index);
        }
    }, [onAddSection, contextMenu.index, getNextSectionName]);

    const handleMoveToTop = useCallback(() => {
        if (contextMenu.index !== null && contextMenu.index > 0) {
            const newItems = [...items];
            const [movedItem] = newItems.splice(contextMenu.index, 1);
            newItems.unshift(movedItem);
            // With flat array model, pass items directly (includes section markers)
            if (onReorder) onReorder(newItems);
        }
    }, [contextMenu.index, items, onReorder]);

    const handleMoveToBottom = useCallback(() => {
        if (contextMenu.index !== null && contextMenu.index < items.length - 1) {
            const newItems = [...items];
            const [movedItem] = newItems.splice(contextMenu.index, 1);
            newItems.push(movedItem);
            // With flat array model, pass items directly (includes section markers)
            if (onReorder) onReorder(newItems);
        }
    }, [contextMenu.index, items, onReorder]);

    const handleRemoveFromMenu = useCallback(() => {
        if (contextMenu.item) {
            onRemoveClick({ symbol: contextMenu.item.symbol, exchange: contextMenu.item.exchange });
        }
    }, [contextMenu.item, onRemoveClick]);

    const sortedItems = useMemo(() => {
        // If no sorting, return items as-is
        if (!sortConfig.key) return items;

        // With TradingView model, we sort WITHIN sections, not across them
        // Split into groups, sort each group, then reassemble
        const result = [];
        let currentGroup = [];

        for (const item of items) {
            if (typeof item === 'string' && item.startsWith('###')) {
                // Sort the accumulated group before section marker
                if (currentGroup.length > 0) {
                    result.push(...sortGroup(currentGroup));
                }
                // Add section marker
                result.push(item);
                currentGroup = [];
            } else {
                currentGroup.push(item);
            }
        }
        // Sort and add final group
        if (currentGroup.length > 0) {
            result.push(...sortGroup(currentGroup));
        }

        function sortGroup(group) {
            return [...group].sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                if (['last', 'chg', 'chgP'].includes(sortConfig.key)) {
                    aValue = parseFloat(aValue) || 0;
                    bValue = parseFloat(bValue) || 0;
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [items, sortConfig]);

    // Group items by section (TradingView model: ### prefixed strings are section markers)
    const groupedItems = useMemo(() => {
        const groups = [];
        let currentSection = null;
        let currentItems = [];

        // Walk through all items - they can be symbol objects or ###section strings
        for (let i = 0; i < sortedItems.length; i++) {
            const item = sortedItems[i];

            // Check if this is a section marker (string starting with ###)
            if (typeof item === 'string' && item.startsWith('###')) {
                // Save previous group if it has content
                if (currentItems.length > 0 || currentSection !== null) {
                    groups.push({
                        section: currentSection,
                        items: currentItems,
                        sectionIndex: currentSection !== null ? i - currentItems.length - 1 : null
                    });
                }
                // Start new section
                currentSection = item.replace('###', '');
                currentItems = [];
            } else {
                // Regular symbol item
                currentItems.push({ ...item, globalIndex: i });
            }
        }

        // Push final group
        if (currentItems.length > 0 || currentSection !== null) {
            groups.push({
                section: currentSection,
                items: currentItems,
                sectionIndex: currentSection !== null
                    ? sortedItems.length - currentItems.length - 1
                    : null
            });
        }

        // If no groups at all, create one empty group
        if (groups.length === 0) {
            groups.push({ section: null, items: [], sectionIndex: null });
        }

        return groups;
    }, [sortedItems]);

    // Get flat list of stock items (excluding sections) for keyboard navigation
    const stockItems = useMemo(() => {
        return sortedItems.filter(item => typeof item !== 'string' || !item.startsWith('###'));
    }, [sortedItems]);

    // Keyboard navigation handler
    const handleKeyDown = useCallback((e) => {
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

    // Wrapper for onSymbolSelect that also updates focusedIndex
    const handleSymbolSelect = useCallback((symData) => {
        // Find the index of the selected stock in stockItems
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
                        onSwitch={onSwitchWatchlist}
                        onCreate={onCreateWatchlist}
                        onRename={onRenameWatchlist}
                        onDelete={onDeleteWatchlist}
                        onClear={onClearWatchlist}
                        onCopy={onCopyWatchlist}
                        onAddSection={() => {
                            // If a symbol is selected (has context), add above it
                            // Otherwise add at bottom with auto-generated name
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
                    <Plus size={16} className={styles.icon} onClick={onAddClick} title="Add symbol" />
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
                        // sectionIndex comes from groupedItems (calculated during grouping)
                        const sectionStartIndex = group.sectionIndex ?? 0;

                        return (
                            <React.Fragment key={`group-${groupIndex}`}>
                                {group.section && (
                                    <WatchlistSection
                                        title={group.section}
                                        isCollapsed={collapsedSections?.includes(group.section)}
                                        isDragging={draggedSection === group.section}
                                        onToggle={() => onToggleSection?.(group.section)}
                                        onRename={(oldTitle, newTitle) => onRenameSection?.(oldTitle, newTitle)}
                                        onDelete={(title) => onDeleteSection?.(title)}
                                        sectionIndex={sectionStartIndex}
                                        onDragStart={handleSectionDragStart}
                                        onDragOver={handleDragOver}
                                        onDragEnd={handleSectionDragEnd}
                                        onDrop={handleSectionDrop}
                                    >
                                        {group.items.map((item, index) => {
                                            const globalIndex = sortedItems.findIndex(
                                                i => i.symbol === item.symbol && i.exchange === item.exchange
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
                                {!group.section && group.items.map((item, index) => {
                                    const globalIndex = sortedItems.findIndex(
                                        i => i.symbol === item.symbol && i.exchange === item.exchange
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
                content={tooltip.content}
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
