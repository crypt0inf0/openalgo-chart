/**
 * Treemap Layout Algorithm
 * Squarified treemap implementation for heatmap visualization
 */

/**
 * Squarified Treemap Algorithm
 * Calculates optimal tile positions for treemap layout
 * @param {Array} items - Array of items with value property
 * @param {number} x - Starting X position
 * @param {number} y - Starting Y position
 * @param {number} width - Available width
 * @param {number} height - Available height
 * @returns {Array} Items with x, y, width, height properties
 */
export const calculateTreemapLayout = (items, x, y, width, height) => {
    if (items.length === 0 || width <= 0 || height <= 0) return [];

    const totalValue = items.reduce((sum, item) => sum + item.value, 0);
    if (totalValue <= 0) return [];

    const result = [];
    let remaining = [...items];
    let currentX = x;
    let currentY = y;
    let currentWidth = width;
    let currentHeight = height;

    while (remaining.length > 0) {
        const isHorizontal = currentWidth >= currentHeight;
        const mainSide = isHorizontal ? currentHeight : currentWidth;

        // Find the best row using squarified algorithm
        let row = [remaining[0]];
        let rowValue = remaining[0].value;
        let worstRatio = Infinity;

        for (let i = 1; i < remaining.length; i++) {
            const testRow = [...row, remaining[i]];
            const testValue = rowValue + remaining[i].value;
            const rowWidth = (testValue / totalValue) * (isHorizontal ? currentWidth : currentHeight);

            // Calculate worst aspect ratio in current test row
            let testWorst = 0;
            testRow.forEach(item => {
                const itemHeight = (item.value / testValue) * mainSide;
                const ratio = Math.max(rowWidth / itemHeight, itemHeight / rowWidth);
                testWorst = Math.max(testWorst, ratio);
            });

            if (testWorst <= worstRatio) {
                row = testRow;
                rowValue = testValue;
                worstRatio = testWorst;
            } else {
                break;
            }
        }

        // Layout the row
        const rowFraction = rowValue / totalValue;
        const rowSize = isHorizontal
            ? rowFraction * currentWidth
            : rowFraction * currentHeight;

        let offset = 0;
        row.forEach(item => {
            const itemFraction = item.value / rowValue;
            const itemSize = itemFraction * mainSide;

            if (isHorizontal) {
                result.push({
                    ...item,
                    x: currentX,
                    y: currentY + offset,
                    width: rowSize,
                    height: itemSize,
                });
            } else {
                result.push({
                    ...item,
                    x: currentX + offset,
                    y: currentY,
                    width: itemSize,
                    height: rowSize,
                });
            }
            offset += itemSize;
        });

        // Update remaining and area
        remaining = remaining.slice(row.length);
        if (isHorizontal) {
            currentX += rowSize;
            currentWidth -= rowSize;
        } else {
            currentY += rowSize;
            currentHeight -= rowSize;
        }
    }

    return result;
};

export default calculateTreemapLayout;
