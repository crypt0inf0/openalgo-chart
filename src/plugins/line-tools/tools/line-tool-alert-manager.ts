import { TrendLine } from './trend-line';
import { HorizontalLine } from './horizontal-line/horizontal-line';
import { HorizontalRay } from './horizontal-ray';
import { VerticalLine } from './vertical-line';
import { Rectangle } from './rectangle';
import { ParallelChannel } from './parallel-channel';

export type LineTool = TrendLine | HorizontalLine | HorizontalRay | VerticalLine | Rectangle | ParallelChannel;
export type AlertCondition = 'crossing' | 'crossing_up' | 'crossing_down' | 'entering' | 'exiting' | 'inside' | 'outside';

export class LineToolAlertManager {
    /**
     * Calculate the price on the line tool at a specific logical index
     * Only applicable for line-like tools (TrendLine, HorizontalLine, HorizontalRay)
     */
    public static getPriceAtLogical(tool: LineTool, logical: number): number | null {
        if (tool instanceof TrendLine) {
            return tool.getPriceAtLogical(logical);
        } else if (tool instanceof HorizontalLine) {
            return tool._price;
        } else if (tool instanceof HorizontalRay) {
            // Horizontal Ray logic: same as horizontal line but check start point
            if (logical >= tool._point.logical) {
                return tool._point.price;
            }
            return null;
        }
        return null;
    }

    /**
     * Check if a bar triggers an alert condition for a given tool
     */
    public static checkAlert(
        tool: LineTool,
        bar: { high: number, low: number, close: number, open: number },
        logical: number,
        condition: AlertCondition
    ): boolean {
        if (tool instanceof TrendLine || tool instanceof HorizontalLine || tool instanceof HorizontalRay) {
            return this.checkLineCrossing(tool, bar, logical, condition);
        } else if (tool instanceof VerticalLine) {
            return this.checkVerticalCrossing(tool, logical, condition);
        } else if (tool instanceof Rectangle) {
            return this.checkRectangleAlert(tool, bar, logical, condition);
        } else if (tool instanceof ParallelChannel) {
            return this.checkChannelAlert(tool, bar, logical, condition);
        }
        return false;
    }

    private static checkLineCrossing(
        tool: TrendLine | HorizontalLine | HorizontalRay,
        bar: { high: number, low: number, close: number, open: number },
        logical: number,
        condition: AlertCondition
    ): boolean {
        const linePrice = this.getPriceAtLogical(tool, logical);
        if (linePrice === null) return false;

        const isTouching = linePrice >= bar.low && linePrice <= bar.high;

        if (condition === 'crossing') {
            return isTouching;
        } else if (condition === 'crossing_up') {
            return isTouching && bar.close >= linePrice;
        } else if (condition === 'crossing_down') {
            return isTouching && bar.close <= linePrice;
        }
        return false;
    }

    private static checkVerticalCrossing(
        tool: VerticalLine,
        logical: number,
        condition: AlertCondition
    ): boolean {
        if (condition !== 'crossing') return false;
        // Check if the current bar's logical index matches the vertical line's logical index
        // Since logical indices are integers (mostly), exact match should work.
        // However, we might want to check if we just passed it?
        // For now, exact match on the current bar being processed.
        return Math.round(logical) === Math.round(tool._logical);
    }

    private static checkRectangleAlert(
        tool: Rectangle,
        bar: { high: number, low: number, close: number, open: number },
        logical: number,
        condition: AlertCondition
    ): boolean {
        const p1 = tool._p1;
        const p2 = tool._p2;

        if (p1.logical === null || p1.price === null || p2.logical === null || p2.price === null) return false;

        const minLogical = Math.min(p1.logical, p2.logical);
        const maxLogical = Math.max(p1.logical, p2.logical);
        const minPrice = Math.min(p1.price, p2.price);
        const maxPrice = Math.max(p1.price, p2.price);

        // Check if bar is within the logical range of the rectangle
        if (logical < minLogical || logical > maxLogical) {
            // Outside logical range
            if (condition === 'outside') return true;
            if (condition === 'exiting') {
                // If we were inside previously? We don't have history here.
                // Assuming "Exiting" means "Just moved out".
                // Without history, we can't strictly detect "Exiting" from inside.
                // But if we assume the check happens on every bar:
                // If the bar *just* exited, it might be partially inside or just outside?
                // Let's rely on the bar's relation to the box.
                return false;
            }
            return false;
        }

        // Bar is within logical range (x-axis)
        // Check price (y-axis)

        // Inside: Entire bar is inside? Or just Close? Or High/Low overlap?
        // Usually "Inside" means price is within the range.
        // Let's use Close price for simplicity, or High/Low for strictness.
        // TradingView "Inside Channel" usually means the price is currently inside.

        const isCloseInside = bar.close >= minPrice && bar.close <= maxPrice;
        const isOpenInside = bar.open >= minPrice && bar.open <= maxPrice;

        if (condition === 'inside') {
            return isCloseInside;
        } else if (condition === 'outside') {
            return !isCloseInside;
        } else if (condition === 'entering') {
            // Entered: Open was outside, Close is inside
            return !isOpenInside && isCloseInside;
        } else if (condition === 'exiting') {
            // Exited: Open was inside, Close is outside
            return isOpenInside && !isCloseInside;
        }

        return false;
    }

    private static checkChannelAlert(
        tool: ParallelChannel,
        bar: { high: number, low: number, close: number, open: number },
        logical: number,
        condition: AlertCondition
    ): boolean {
        const p1 = tool._p1;
        const p2 = tool._p2;
        const p3 = tool._p3;

        if (p1.logical === null || p1.price === null ||
            p2.logical === null || p2.price === null ||
            p3.logical === null || p3.price === null) return false;

        // Channel logic:
        // Top line defined by p1-p2.
        // Bottom line is parallel, passing through p3? Or offset by p3?
        // In the renderer:
        // m = (y2 - y1) / (x2 - x1)
        // y_projected = y1 + m * (x3 - x1)
        // verticalOffset = y3 - y_projected
        // y_top = y1 + m * (x - x1)
        // y_bottom = y_top + verticalOffset

        // We need to calculate these prices at the current logical index.

        // Check logical bounds (min/max of p1, p2, p3? usually p1-p2 defines length)
        // Parallel channel usually extends infinitely or is finite segment?
        // The renderer draws p1-p2 segment and p1_bot-p2_bot segment.
        // So it's bounded by x1 and x2.

        const minLogical = Math.min(p1.logical, p2.logical);
        const maxLogical = Math.max(p1.logical, p2.logical);

        if (logical < minLogical || logical > maxLogical) return false;

        let topPrice: number;
        let bottomPrice: number;

        if (p1.logical === p2.logical) {
            // Vertical channel?
            return false;
        }

        const m = (p2.price - p1.price) / (p2.logical - p1.logical);
        const y_at_x = p1.price + m * (logical - p1.logical);

        // Calculate offset
        // Project p3 onto the line defined by p1-p2
        // y_projected_p3 = p1.price + m * (p3.logical - p1.logical)
        // offset = p3.price - y_projected_p3
        const y_projected_p3 = p1.price + m * (p3.logical - p1.logical);
        const offset = p3.price - y_projected_p3;

        topPrice = y_at_x;
        bottomPrice = y_at_x + offset;

        // Ensure top is actually higher (numerically, price)
        const upper = Math.max(topPrice, bottomPrice);
        const lower = Math.min(topPrice, bottomPrice);

        const isCloseInside = bar.close >= lower && bar.close <= upper;
        const isOpenInside = bar.open >= lower && bar.open <= upper;

        if (condition === 'inside') {
            return isCloseInside;
        } else if (condition === 'outside') {
            return !isCloseInside;
        } else if (condition === 'entering') {
            return !isOpenInside && isCloseInside;
        } else if (condition === 'exiting') {
            return isOpenInside && !isCloseInside;
        }

        return false;
    }
}
