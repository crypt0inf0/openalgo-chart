import { CanvasRenderingTarget2D } from 'fancy-canvas';
import {
    AutoscaleInfo,
    IChartApi,
    ISeriesApi,
    ISeriesPrimitive,
    IPrimitivePaneRenderer,
    IPrimitivePaneView,
    Logical,
    SeriesOptionsMap,
    SeriesType,
    Time,
} from 'lightweight-charts';
import {
    LogicalPoint,
    ViewPoint,
    HitTestResult,
    pointToCoordinate,
    isPointInRectangle,
    scaleCoordinate,
    drawAnchor,
} from './base-types';

class PriceRangePaneRenderer implements IPrimitivePaneRenderer {
    private readonly _p1: ViewPoint;
    private readonly _p2: ViewPoint;
    private readonly _options: PriceRangeOptions;
    private readonly _selected: boolean;
    private readonly _source: PriceRange;

    constructor(
        p1: ViewPoint,
        p2: ViewPoint,
        options: PriceRangeOptions,
        selected: boolean,
        source: PriceRange
    ) {
        this._p1 = p1;
        this._p2 = p2;
        this._options = options;
        this._selected = selected;
        this._source = source;
    }

    draw(target: CanvasRenderingTarget2D): void {
        target.useBitmapCoordinateSpace(scope => {
            if (
                this._p1.x === null ||
                this._p1.y === null ||
                this._p2.x === null ||
                this._p2.y === null
            )
                return;

            const ctx = scope.context;
            const x1Scaled = scaleCoordinate(this._p1.x, scope.horizontalPixelRatio);
            const y1Scaled = scaleCoordinate(this._p1.y, scope.verticalPixelRatio);
            const x2Scaled = scaleCoordinate(this._p2.x, scope.horizontalPixelRatio);
            const y2Scaled = scaleCoordinate(this._p2.y, scope.verticalPixelRatio);

            const xMin = Math.min(x1Scaled, x2Scaled);
            const xMax = Math.max(x1Scaled, x2Scaled);
            const yMin = Math.min(y1Scaled, y2Scaled);
            const yMax = Math.max(y1Scaled, y2Scaled);

            const width = xMax - xMin;
            const height = yMax - yMin;

            // Draw filled rectangle
            if (this._options.backgroundColor) {
                ctx.fillStyle = this._options.backgroundColor;
                ctx.fillRect(xMin, yMin, width, height);
            }

            // Draw border
            ctx.strokeStyle = this._options.borderColor;
            ctx.lineWidth = this._options.borderWidth * scope.verticalPixelRatio;
            ctx.strokeRect(xMin, yMin, width, height);

            // Draw vertical center line with arrow
            const xMid = (x1Scaled + x2Scaled) / 2;
            const arrowSize = 10 * scope.verticalPixelRatio;

            ctx.beginPath();
            ctx.moveTo(xMid, yMin);
            ctx.lineTo(xMid, yMax);

            // Draw arrow pointing toward second point
            const yDiff = y2Scaled - y1Scaled;
            if (Math.abs(yDiff) > arrowSize) {
                let arrowY: number;
                if (yDiff > 0) {
                    // Point 2 is below point 1 - arrow at bottom
                    arrowY = yMax;
                    ctx.moveTo(xMid - arrowSize, arrowY - arrowSize);
                    ctx.lineTo(xMid, arrowY);
                    ctx.lineTo(xMid + arrowSize, arrowY - arrowSize);
                } else {
                    // Point 2 is above point 1 - arrow at top
                    arrowY = yMin;
                    ctx.moveTo(xMid - arrowSize, arrowY + arrowSize);
                    ctx.lineTo(xMid, arrowY);
                    ctx.lineTo(xMid + arrowSize, arrowY + arrowSize);
                }
            }

            ctx.stroke();

            // Draw price difference label
            const price1 = this._source._p1.price;
            const price2 = this._source._p2.price;
            const priceDiff = Math.abs(price2 - price1);
            const percentChange = price1 !== 0 ? ((price2 - price1) / price1) * 100 : 0;

            // Format label text
            const prefix = price2 > price1 ? '+' : '';
            const labelText = `${prefix}${priceDiff.toFixed(2)} (${Math.abs(percentChange).toFixed(2)}%)`;

            // Position label at top or bottom based on direction (SWAPPED)
            const labelY = price2 > price1 ? yMin - 10 * scope.verticalPixelRatio : yMax + 25 * scope.verticalPixelRatio;

            // Draw label
            ctx.font = `bold ${14 * scope.verticalPixelRatio}px sans-serif`;
            ctx.fillStyle = this._options.borderColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = price2 > price1 ? 'bottom' : 'top';
            ctx.fillText(labelText, xMid, labelY);

            // Draw anchors when selected
            if (this._selected) {
                // 4 corners
                drawAnchor(scope, x1Scaled, y1Scaled);
                drawAnchor(scope, x2Scaled, y2Scaled);
                drawAnchor(scope, x1Scaled, y2Scaled);
                drawAnchor(scope, x2Scaled, y1Scaled);

                // 4 midpoints
                const yMid = (y1Scaled + y2Scaled) / 2;
                drawAnchor(scope, xMid, y1Scaled);     // top center
                drawAnchor(scope, xMid, y2Scaled);     // bottom center
                drawAnchor(scope, x1Scaled, yMid);     // left center
                drawAnchor(scope, x2Scaled, yMid);     // right center
            }
        });
    }
}

class PriceRangePaneView implements IPrimitivePaneView {
    private readonly _source: PriceRange;
    private _p1: ViewPoint = { x: null, y: null };
    private _p2: ViewPoint = { x: null, y: null };

    constructor(source: PriceRange) {
        this._source = source;
    }

    update(): void {
        this._p1 = pointToCoordinate(
            this._source._p1,
            this._source._chart,
            this._source._series
        );
        this._p2 = pointToCoordinate(
            this._source._p2,
            this._source._chart,
            this._source._series
        );
    }

    renderer(): PriceRangePaneRenderer {
        return new PriceRangePaneRenderer(
            this._p1,
            this._p2,
            this._source._options,
            this._source._selected,
            this._source
        );
    }
}

export interface PriceRangeOptions {
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    extendLeft?: boolean;
    extendRight?: boolean;
    locked?: boolean;
}

const defaultOptions: PriceRangeOptions = {
    backgroundColor: 'rgba(41, 98, 255, 0.2)',
    borderColor: 'rgb(41, 98, 255)',
    borderWidth: 2,
    extendLeft: false,
    extendRight: false,
    locked: false,
};

export class PriceRange implements ISeriesPrimitive<Time> {
    readonly _chart: IChartApi;
    readonly _series: ISeriesApi<keyof SeriesOptionsMap>;
    _p1: LogicalPoint;
    _p2: LogicalPoint;
    private readonly _paneViews: PriceRangePaneView[];
    readonly _options: PriceRangeOptions;

    _selected: boolean = false;
    _locked: boolean = false;

    constructor(
        chart: IChartApi,
        series: ISeriesApi<SeriesType>,
        p1: LogicalPoint,
        p2: LogicalPoint,
        options?: Partial<PriceRangeOptions>
    ) {
        this._chart = chart;
        this._series = series;
        this._p1 = p1;
        this._p2 = p2;

        this._options = {
            ...defaultOptions,
            ...options,
        };
        this._paneViews = [new PriceRangePaneView(this)];
    }

    public updatePoints(p1: LogicalPoint, p2: LogicalPoint): void {
        this._p1 = p1;
        this._p2 = p2;

        this.updateAllViews();
    }

    /**
     * Update a single anchor point by index (8 anchor points total)
     * First point (p1) stays fixed, only second point (p2) moves
     * @param index - Anchor index (0-7)
     * @param point - New logical point
     */
    public updatePointByIndex(index: number, point: LogicalPoint): void {
        switch (index) {
            case 0: // top-left corner (p1)
                this._p1 = point;
                break;
            case 1: // bottom-right corner (p2)
                this._p2 = point;
                break;
            case 2: // bottom-left corner (x1, y2) -> updates x1 (p1) and y2 (p2)
                this._p1 = { ...this._p1, logical: point.logical };
                this._p2 = { ...this._p2, price: point.price };
                break;
            case 3: // top-right corner (x2, y1) -> updates x2 (p2) and y1 (p1)
                this._p2 = { ...this._p2, logical: point.logical };
                this._p1 = { ...this._p1, price: point.price };
                break;
            case 4: // top center - update only price (top edge)
                // Assuming p1 is top, but we need to check min/max
                // Simplified: just update p1's price if it's the top one, or p2's
                // For simplicity in this tool, let's assume p1/p2 can be swapped implicitly by min/max logic in renderer
                // But here we need to know which point to update.
                // If we assume standard drawing (p1 top-left, p2 bottom-right), then top is p1.y
                // But user can draw in any direction.
                // Let's just update the Y of the point that is "top" (min price if price scale inverted? or max price?)
                // Actually, let's just stick to the corner logic which is more robust.
                // For midpoints, it's ambiguous without knowing orientation.
                // Let's disable midpoint dragging for now or map them to nearest corner logic?
                // The previous implementation was modifying p2 for everything which was wrong.
                // Let's implement basic corner dragging first as requested.
                break;
            case 5: // bottom center
                break;
            case 6: // left center
                break;
            case 7: // right center
                break;
        }

        this.updateAllViews();
    }

    public setSelected(selected: boolean): void {
        this._selected = selected;
        this.updateAllViews();
    }

    public applyOptions(options: Partial<PriceRangeOptions>): void {
        Object.assign(this._options, options);
        this.updateAllViews();
        this._chart.timeScale().applyOptions({});
    }

    public toolHitTest(x: number, y: number): HitTestResult | null {
        const timeScale = this._chart.timeScale();
        const series = this._series;

        const x1 = timeScale.logicalToCoordinate(this._p1.logical as Logical);
        const y1 = series.priceToCoordinate(this._p1.price);
        const x2 = timeScale.logicalToCoordinate(this._p2.logical as Logical);
        const y2 = series.priceToCoordinate(this._p2.price);

        if (x1 === null || y1 === null || x2 === null || y2 === null) return null;

        const threshold = 8;

        // Check 8 anchor points
        const xMin = Math.min(x1, x2);
        const xMax = Math.max(x1, x2);
        const yMin = Math.min(y1, y2);
        const yMax = Math.max(y1, y2);
        const xMid = (x1 + x2) / 2;
        const yMid = (y1 + y2) / 2;

        const anchors = [
            { x: x1, y: y1, index: 0 },     // corner 1
            { x: x2, y: y2, index: 1 },     // corner 2
            { x: x1, y: y2, index: 2 },     // corner 3
            { x: x2, y: y1, index: 3 },     // corner 4
            { x: xMid, y: yMin, index: 4 }, // top center
            { x: xMid, y: yMax, index: 5 }, // bottom center
            { x: xMin, y: yMid, index: 6 }, // left center
            { x: xMax, y: yMid, index: 7 }, // right center
        ];

        for (const anchor of anchors) {
            if (Math.hypot(x - anchor.x, y - anchor.y) < threshold) {
                return { hit: true, type: 'point', index: anchor.index };
            }
        }

        // Check if inside rectangle
        if (isPointInRectangle({ x, y }, { x1, y1, x2, y2 })) {
            return { hit: true, type: 'shape' };
        }

        return null;
    }

    autoscaleInfo(): AutoscaleInfo | null {
        return null;
    }

    updateAllViews(): void {
        this._paneViews.forEach(pw => pw.update());
    }

    paneViews(): PriceRangePaneView[] {
        return this._paneViews;
    }
}
