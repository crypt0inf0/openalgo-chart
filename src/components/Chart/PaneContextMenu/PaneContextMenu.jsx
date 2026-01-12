import React, { useEffect, useRef } from 'react';
import styles from './PaneContextMenu.module.css';

/**
 * TradingView-style context menu for indicator panes
 * Options: Maximize, Collapse, Move Up, Delete
 */
const PaneContextMenu = ({
    show,
    x,
    y,
    paneId,
    isMaximized,
    isCollapsed,
    canMoveUp,
    onMaximize,
    onCollapse,
    onMoveUp,
    onDelete,
    onClose
}) => {
    const menuRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        if (!show) return;

        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [show, onClose]);

    if (!show) return null;

    // Adjust position to stay within viewport
    const adjustedStyle = {
        left: x,
        top: y
    };

    return (
        <div
            ref={menuRef}
            className={styles.contextMenu}
            style={adjustedStyle}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Maximize Pane */}
            <button
                className={styles.menuItem}
                onClick={() => {
                    onMaximize(paneId);
                    onClose();
                }}
            >
                <span className={styles.menuIcon}>
                    {isMaximized ? (
                        // Restore icon
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M5 1h6a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V3a2 2 0 012-2zm0 1a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1V3a1 1 0 00-1-1H5z"/>
                            <path d="M3 5v6a2 2 0 002 2h6v1H5a3 3 0 01-3-3V5h1z"/>
                        </svg>
                    ) : (
                        // Maximize icon
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M3 3h10a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1zm0 1v8h10V4H3z"/>
                        </svg>
                    )}
                </span>
                <span className={styles.menuLabel}>
                    {isMaximized ? 'Restore pane' : 'Maximize pane'}
                </span>
                <span className={styles.menuShortcut}>Double click</span>
            </button>

            {/* Collapse Pane */}
            <button
                className={styles.menuItem}
                onClick={() => {
                    onCollapse(paneId);
                    onClose();
                }}
            >
                <span className={styles.menuIcon}>
                    {isCollapsed ? (
                        // Expand icon
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 4l4 4H4l4-4zm0 8l-4-4h8l-4 4z"/>
                        </svg>
                    ) : (
                        // Collapse icon
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M4 6l4 4 4-4H4z"/>
                        </svg>
                    )}
                </span>
                <span className={styles.menuLabel}>
                    {isCollapsed ? 'Expand pane' : 'Collapse pane'}
                </span>
                <span className={styles.menuShortcut}>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl+'}Double click</span>
            </button>

            {/* Move Pane Up */}
            <button
                className={`${styles.menuItem} ${!canMoveUp ? styles.disabled : ''}`}
                onClick={() => {
                    if (canMoveUp) {
                        onMoveUp(paneId);
                        onClose();
                    }
                }}
                disabled={!canMoveUp}
            >
                <span className={styles.menuIcon}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 3l5 5h-3v5H6V8H3l5-5z"/>
                    </svg>
                </span>
                <span className={styles.menuLabel}>Move pane up</span>
                <span className={styles.menuShortcut}></span>
            </button>

            <div className={styles.menuDivider} />

            {/* Delete Pane */}
            <button
                className={`${styles.menuItem} ${styles.deleteItem}`}
                onClick={() => {
                    onDelete(paneId);
                    onClose();
                }}
            >
                <span className={styles.menuIcon}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>
                        <path fillRule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                </span>
                <span className={styles.menuLabel}>Delete pane</span>
                <span className={styles.menuShortcut}></span>
            </button>
        </div>
    );
};

export default PaneContextMenu;
