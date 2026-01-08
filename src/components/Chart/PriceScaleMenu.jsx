import React, { useEffect, useRef } from 'react';
import styles from './PriceScaleMenu.module.css';

/**
 * PriceScaleMenu - A context menu that appears when clicking the + button on the price scale
 * Provides options to add an alert or draw a horizontal line at the clicked price
 */
const PriceScaleMenu = ({
    visible,
    x,
    y,
    price,
    symbol,
    onAddAlert,
    onDrawHorizontalLine,
    onClose
}) => {
    const menuRef = useRef(null);

    // Close menu when clicking outside (left or right click)
    useEffect(() => {
        if (!visible) return;

        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        // Delay adding listener to avoid immediate close from the triggering click
        const timeoutId = setTimeout(() => {
            // Use capture phase to catch events before they reach the chart canvas
            document.addEventListener('mousedown', handleClickOutside, true);
            document.addEventListener('contextmenu', handleClickOutside, true);
            document.addEventListener('keydown', handleKeyDown);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('mousedown', handleClickOutside, true);
            document.removeEventListener('contextmenu', handleClickOutside, true);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [visible, onClose]);

    if (!visible) return null;

    // Format price for display
    const formattedPrice = price?.toFixed(2) ?? '0.00';

    return (
        <div
            ref={menuRef}
            className={styles.menu}
            style={{
                left: x,
                top: y,
                transform: 'translate(-100%, -50%)' // Position to the left and center vertically
            }}
        >
            <button
                className={styles.menuItem}
                onClick={() => {
                    onAddAlert();
                    onClose();
                }}
            >
                <div className={styles.menuItemContent}>
                    <svg className={styles.menuItemIcon} viewBox="0 0 18 18" fill="currentColor">
                        <path d="M9 2a5.5 5.5 0 0 0-5.5 5.5v3.67l-.87 1.74A.75.75 0 0 0 3.3 14h11.4a.75.75 0 0 0 .67-1.09l-.87-1.74V7.5A5.5 5.5 0 0 0 9 2zm0 14a2 2 0 0 1-2-2h4a2 2 0 0 1-2 2z" />
                    </svg>
                    <span className={styles.menuItemText}>
                        Add alert on {symbol} at {formattedPrice}
                    </span>
                </div>
                <span className={styles.menuItemShortcut}>Alt+A</span>
            </button>
            <button
                className={styles.menuItem}
                onClick={() => {
                    onDrawHorizontalLine();
                    onClose();
                }}
            >
                <div className={styles.menuItemContent}>
                    <svg className={styles.menuItemIcon} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <line x1="2" y1="9" x2="16" y2="9" />
                    </svg>
                    <span className={styles.menuItemText}>
                        Draw Horizontal Line at {formattedPrice}
                    </span>
                </div>
                <span className={styles.menuItemShortcut}>Alt+H</span>
            </button>
        </div>
    );
};

export default PriceScaleMenu;
