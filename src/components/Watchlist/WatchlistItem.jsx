import React, { useCallback, useRef } from 'react';
import { X, GripVertical } from 'lucide-react';
import styles from './WatchlistItem.module.css';
import classNames from 'classnames';

/**
 * WatchlistItem - Individual symbol row in the watchlist
 * 
 * Features:
 * - Smart tooltip integration (hover shows full name after delay)
 * - Drag handle for reordering
 * - Delete button appears on hover
 * - Exchange flag icon
 * - Right-click context menu support
 */

const WatchlistItem = ({
    item,
    isActive,
    isFocused,
    isDragging,
    columnWidths,
    minColumnWidth,
    sortEnabled,
    index,
    onSelect,
    onRemove,
    onDragStart,
    onDragOver,
    onDragEnd,
    onDrop,
    onContextMenu,
    onMouseEnter,
    onMouseLeave,
    onMouseMove,
}) => {
    const itemRef = useRef(null);

    const handleClick = useCallback(() => {
        onSelect({ symbol: item.symbol, exchange: item.exchange });
    }, [item.symbol, item.exchange, onSelect]);

    const handleRemoveClick = useCallback((e) => {
        e.stopPropagation();
        onRemove({ symbol: item.symbol, exchange: item.exchange });
    }, [item.symbol, item.exchange, onRemove]);

    const handleContextMenu = useCallback((e) => {
        e.preventDefault();
        if (onContextMenu) {
            onContextMenu(e, item, index);
        }
    }, [onContextMenu, item, index]);

    const handleMouseEnter = useCallback((e) => {
        if (onMouseEnter) {
            const rect = itemRef.current?.getBoundingClientRect();
            onMouseEnter(e, item, rect);
        }
    }, [onMouseEnter, item]);

    const handleMouseLeave = useCallback(() => {
        if (onMouseLeave) {
            onMouseLeave();
        }
    }, [onMouseLeave]);

    const handleMouseMove = useCallback((e) => {
        if (onMouseMove) {
            onMouseMove(e);
        }
    }, [onMouseMove]);

    return (
        <div
            ref={itemRef}
            className={classNames(styles.item, {
                [styles.active]: isActive,
                [styles.focused]: isFocused,
                [styles.dragging]: isDragging,
            })}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseMove={handleMouseMove}
            draggable={!sortEnabled}
            onDragStart={(e) => onDragStart?.(e, index)}
            onDragOver={(e) => onDragOver?.(e, index)}
            onDragEnd={onDragEnd}
            onDrop={(e) => onDrop?.(e, index)}
        >
            {/* Drag handle - visible on hover */}
            <div className={styles.dragHandle}>
                <GripVertical size={12} />
            </div>

            {/* Symbol name */}
            <span
                className={styles.symbolName}
                style={{ width: columnWidths.symbol, minWidth: columnWidths.symbol }}
            >
                {item.symbol}
            </span>

            {/* Last price */}
            <span
                className={classNames(styles.last, {
                    [styles.up]: item.up,
                    [styles.down]: !item.up && item.chg !== 0,
                })}
                style={{ width: columnWidths.last, minWidth: minColumnWidth }}
            >
                {item.last}
            </span>

            {/* Change */}
            <span
                className={classNames(styles.chg, {
                    [styles.up]: item.up,
                    [styles.down]: !item.up && item.chg !== 0,
                })}
                style={{ width: columnWidths.chg, minWidth: minColumnWidth }}
            >
                {item.chg}
            </span>

            {/* Change % */}
            <span
                className={classNames(styles.chgP, {
                    [styles.up]: item.up,
                    [styles.down]: !item.up && item.chg !== 0,
                })}
                style={{ width: columnWidths.chgP, minWidth: minColumnWidth }}
            >
                {item.chgP}
            </span>

            {/* Remove button - appears on hover */}
            <button
                className={styles.removeBtn}
                onClick={handleRemoveClick}
                title="Remove from watchlist"
            >
                <X size={12} />
            </button>
        </div>
    );
};

export default React.memo(WatchlistItem);
