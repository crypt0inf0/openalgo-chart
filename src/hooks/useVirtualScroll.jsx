/**
 * useVirtualScroll Hook
 * Efficient rendering of large lists by only rendering visible items
 *
 * Usage:
 *   const { visibleItems, containerProps, totalHeight, startIndex } = useVirtualScroll({
 *     items: myLargeArray,
 *     itemHeight: 40,
 *     containerHeight: 400,
 *     overscan: 5
 *   });
 *
 *   return (
 *     <div {...containerProps}>
 *       <div style={{ height: totalHeight, position: 'relative' }}>
 *         {visibleItems.map((item, idx) => (
 *           <div key={item.id} style={{ position: 'absolute', top: (startIndex + idx) * 40 }}>
 *             {item.content}
 *           </div>
 *         ))}
 *       </div>
 *     </div>
 *   );
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

/**
 * Virtual scroll hook for efficiently rendering large lists
 *
 * @param {Object} options - Configuration options
 * @param {Array} options.items - Array of items to render
 * @param {number} options.itemHeight - Height of each item in pixels
 * @param {number} options.containerHeight - Height of the container in pixels
 * @param {number} options.overscan - Number of items to render outside visible area (default: 3)
 * @param {Function} options.getItemHeight - Optional function to get dynamic item height
 * @returns {Object} Virtual scroll state and handlers
 */
export const useVirtualScroll = (options = {}) => {
    const {
        items = [],
        itemHeight = 40,
        containerHeight = 400,
        overscan = 3,
        getItemHeight = null
    } = options;

    const [scrollTop, setScrollTop] = useState(0);
    const containerRef = useRef(null);
    const rafRef = useRef(null);

    // Calculate total height
    const totalHeight = useMemo(() => {
        if (getItemHeight) {
            // Dynamic heights
            return items.reduce((sum, item, index) => sum + getItemHeight(item, index), 0);
        }
        // Fixed height
        return items.length * itemHeight;
    }, [items, itemHeight, getItemHeight]);

    // Calculate visible range
    const { startIndex, endIndex, offsetY } = useMemo(() => {
        if (items.length === 0) {
            return { startIndex: 0, endIndex: 0, offsetY: 0 };
        }

        if (getItemHeight) {
            // Dynamic heights - need to calculate cumulative heights
            let cumulativeHeight = 0;
            let start = 0;
            let end = 0;
            let foundStart = false;

            for (let i = 0; i < items.length; i++) {
                const height = getItemHeight(items[i], i);

                if (!foundStart && cumulativeHeight + height > scrollTop) {
                    start = Math.max(0, i - overscan);
                    foundStart = true;
                }

                if (cumulativeHeight > scrollTop + containerHeight) {
                    end = Math.min(items.length, i + overscan);
                    break;
                }

                cumulativeHeight += height;
            }

            if (!foundStart) start = 0;
            if (end === 0) end = items.length;

            // Calculate offset for start index
            let offset = 0;
            for (let i = 0; i < start; i++) {
                offset += getItemHeight(items[i], i);
            }

            return { startIndex: start, endIndex: end, offsetY: offset };
        }

        // Fixed height calculation
        const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
        const visibleCount = Math.ceil(containerHeight / itemHeight);
        const end = Math.min(items.length, start + visibleCount + overscan * 2);

        return {
            startIndex: start,
            endIndex: end,
            offsetY: start * itemHeight
        };
    }, [items, itemHeight, containerHeight, overscan, scrollTop, getItemHeight]);

    // Get visible items
    const visibleItems = useMemo(() => {
        return items.slice(startIndex, endIndex);
    }, [items, startIndex, endIndex]);

    // Scroll handler with RAF throttling
    const handleScroll = useCallback((event) => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
        }

        rafRef.current = requestAnimationFrame(() => {
            const target = event.target;
            setScrollTop(target.scrollTop);
        });
    }, []);

    // Scroll to index
    const scrollToIndex = useCallback((index, align = 'start') => {
        if (!containerRef.current || index < 0 || index >= items.length) {
            return;
        }

        let targetScrollTop;

        if (getItemHeight) {
            // Calculate position for dynamic heights
            let position = 0;
            for (let i = 0; i < index; i++) {
                position += getItemHeight(items[i], i);
            }
            targetScrollTop = position;

            if (align === 'center') {
                const itemH = getItemHeight(items[index], index);
                targetScrollTop = position - (containerHeight - itemH) / 2;
            } else if (align === 'end') {
                const itemH = getItemHeight(items[index], index);
                targetScrollTop = position - containerHeight + itemH;
            }
        } else {
            // Fixed height
            targetScrollTop = index * itemHeight;

            if (align === 'center') {
                targetScrollTop = index * itemHeight - (containerHeight - itemHeight) / 2;
            } else if (align === 'end') {
                targetScrollTop = index * itemHeight - containerHeight + itemHeight;
            }
        }

        containerRef.current.scrollTop = Math.max(0, Math.min(targetScrollTop, totalHeight - containerHeight));
    }, [items, itemHeight, containerHeight, totalHeight, getItemHeight]);

    // Scroll to top
    const scrollToTop = useCallback(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = 0;
        }
    }, []);

    // Scroll to bottom
    const scrollToBottom = useCallback(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = totalHeight - containerHeight;
        }
    }, [totalHeight, containerHeight]);

    // Check if scrolled to top/bottom
    const isAtTop = scrollTop <= 0;
    const isAtBottom = scrollTop >= totalHeight - containerHeight - 1;

    // Cleanup RAF on unmount
    useEffect(() => {
        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, []);

    // Container props to spread on the scrollable container
    const containerProps = {
        ref: containerRef,
        onScroll: handleScroll,
        style: {
            height: containerHeight,
            overflow: 'auto',
            position: 'relative'
        }
    };

    // Inner container props for the full-height div
    const innerProps = {
        style: {
            height: totalHeight,
            position: 'relative'
        }
    };

    // Get item style based on index
    const getItemStyle = useCallback((index) => {
        if (getItemHeight) {
            // Dynamic - need to calculate position
            let position = 0;
            for (let i = 0; i < startIndex + index; i++) {
                position += getItemHeight(items[i], i);
            }
            return {
                position: 'absolute',
                top: position,
                left: 0,
                right: 0,
                height: getItemHeight(items[startIndex + index], startIndex + index)
            };
        }

        // Fixed height
        return {
            position: 'absolute',
            top: (startIndex + index) * itemHeight,
            left: 0,
            right: 0,
            height: itemHeight
        };
    }, [startIndex, itemHeight, items, getItemHeight]);

    return {
        // Visible items to render
        visibleItems,

        // Indices
        startIndex,
        endIndex,

        // Dimensions
        totalHeight,
        offsetY,
        containerHeight,

        // Scroll state
        scrollTop,
        isAtTop,
        isAtBottom,

        // Props to spread
        containerProps,
        innerProps,
        getItemStyle,

        // Refs
        containerRef,

        // Actions
        scrollToIndex,
        scrollToTop,
        scrollToBottom
    };
};

/**
 * Simple virtual list component for common use cases
 */
export const VirtualList = ({
    items,
    itemHeight,
    containerHeight,
    renderItem,
    overscan = 3,
    className = '',
    style = {}
}) => {
    const {
        visibleItems,
        containerProps,
        innerProps,
        getItemStyle,
        startIndex
    } = useVirtualScroll({
        items,
        itemHeight,
        containerHeight,
        overscan
    });

    return (
        <div {...containerProps} className={className} style={{ ...containerProps.style, ...style }}>
            <div {...innerProps}>
                {visibleItems.map((item, index) => (
                    <div key={item.id || startIndex + index} style={getItemStyle(index)}>
                        {renderItem(item, startIndex + index)}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default useVirtualScroll;
