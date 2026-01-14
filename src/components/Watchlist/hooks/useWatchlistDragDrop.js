/**
 * useWatchlistDragDrop Hook
 * Handles drag and drop logic for watchlist items and sections
 */
import { useState, useCallback } from 'react';

/**
 * Hook for managing watchlist drag and drop
 * @param {Array} items - Watchlist items array
 * @param {Function} onReorder - Callback when items are reordered
 * @returns {Object} Drag and drop state and handlers
 */
export const useWatchlistDragDrop = (items, onReorder) => {
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [draggedSection, setDraggedSection] = useState(null);

    // Item drag handlers
    const handleDragStart = useCallback((e, index) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData('text/plain', index.toString());
    }, []);

    const handleDragOver = useCallback((e) => {
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

        if (onReorder) onReorder(newItems);
        setDraggedIndex(null);
    }, [draggedIndex, items, onReorder]);

    // Section drag handlers
    const handleSectionDragStart = useCallback((e, sectionTitle, sectionIdx) => {
        setDraggedSection(sectionTitle);
        setDraggedIndex(sectionIdx);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData('text/plain', sectionIdx.toString());
    }, []);

    const handleSectionDragEnd = useCallback(() => {
        setDraggedSection(null);
        setDraggedIndex(null);
    }, []);

    const handleSectionDrop = useCallback((e, sectionIndex) => {
        e.preventDefault();
        e.stopPropagation();

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

    return {
        // State
        draggedIndex,
        draggedSection,
        // Item handlers
        handleDragStart,
        handleDragOver,
        handleDragEnd,
        handleDrop,
        // Section handlers
        handleSectionDragStart,
        handleSectionDragEnd,
        handleSectionDrop,
    };
};

export default useWatchlistDragDrop;
