/**
 * useColumnResize Hook
 * Handles column resizing logic for watchlist
 */
import { useState, useCallback, useRef, useEffect } from 'react';

const DEFAULT_COLUMN_WIDTHS = {
    symbol: 80,
    last: 65,
    chg: 55,
    chgP: 55
};

const MIN_COLUMN_WIDTH = 40;

/**
 * Hook for managing column resizing
 * @param {Object} initialWidths - Initial column widths (optional)
 * @returns {Object} Column resize state and handlers
 */
export const useColumnResize = (initialWidths = DEFAULT_COLUMN_WIDTHS) => {
    const [columnWidths, setColumnWidths] = useState(initialWidths);
    const [resizing, setResizing] = useState(null);
    const startXRef = useRef(0);
    const startWidthRef = useRef(0);

    const handleResizeStart = useCallback((e, column) => {
        e.preventDefault();
        e.stopPropagation();
        setResizing(column);
        startXRef.current = e.clientX;
        startWidthRef.current = columnWidths[column];
    }, [columnWidths]);

    useEffect(() => {
        if (!resizing) return;

        const handleMouseMove = (e) => {
            const diff = e.clientX - startXRef.current;
            const newWidth = Math.max(MIN_COLUMN_WIDTH, startWidthRef.current + diff);
            setColumnWidths(prev => ({
                ...prev,
                [resizing]: newWidth
            }));
        };

        const handleMouseUp = () => {
            setResizing(null);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizing]);

    return {
        columnWidths,
        setColumnWidths,
        resizing,
        handleResizeStart,
        MIN_COLUMN_WIDTH,
    };
};

export { DEFAULT_COLUMN_WIDTHS, MIN_COLUMN_WIDTH };
export default useColumnResize;
