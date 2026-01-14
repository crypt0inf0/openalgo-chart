import { useCallback, useEffect } from 'react';

/**
 * Custom hook for option chain keyboard navigation
 * Handles arrow keys for row/column navigation and Enter for selection
 */
export function useOptionChainKeyboard({
    chainData,
    focusedRow,
    setFocusedRow,
    focusedCol,
    setFocusedCol,
    onOptionClick,
    onClose,
}) {
    // Keyboard navigation handler
    const handleKeyDown = useCallback((e) => {
        if (chainData.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocusedRow(prev => prev < 0 ? 0 : Math.min(prev + 1, chainData.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusedRow(prev => prev < 0 ? 0 : Math.max(prev - 1, 0));
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            setFocusedCol(prev => prev === 'ce' ? 'pe' : 'ce');
        } else if (e.key === 'Enter' && focusedRow >= 0 && focusedRow < chainData.length) {
            e.preventDefault();
            const row = chainData[focusedRow];
            const symbol = focusedCol === 'ce' ? row.ce?.symbol : row.pe?.symbol;
            if (symbol) onOptionClick(symbol);
        } else if (e.key === 'Escape') {
            onClose();
        }
    }, [chainData, focusedRow, focusedCol, setFocusedRow, setFocusedCol, onOptionClick, onClose]);

    // Click handler that also updates focus
    const handleCellClick = useCallback((rowIndex, col, symbol) => {
        setFocusedRow(rowIndex);
        setFocusedCol(col);
        onOptionClick(symbol);
    }, [setFocusedRow, setFocusedCol, onOptionClick]);

    return {
        handleKeyDown,
        handleCellClick,
    };
}

export default useOptionChainKeyboard;
