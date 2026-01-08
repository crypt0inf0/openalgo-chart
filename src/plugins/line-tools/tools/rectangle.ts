import { CanvasRenderingTarget2D } from 'fancy-canvas';
import {
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
    setLineStyle,
} from './base-types';
import { AutoscaleInfo } from 'lightweight-charts';

class RectanglePaneRenderer implements IPrimitivePaneRenderer {
    private readonly _p1: ViewPoint;
    private readonly _p2: ViewPoint;
    private readonly _options: RectangleOptions;
    private readonly _selected: boolean;

    constructor(
        p1: ViewPoint,
        p2: ViewPoint,
        options: RectangleOptions,
        selected: boolean
    ) {
        this._p1 = p1;
        this._p2 = p2;
        this._options = options;
        this._selected = selected;
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

            const x1 = scaleCoordinate(this._p1.x, scope.horizontalPixelRatio);
            const y1 = scaleCoordinate(this._p1.y, scope.verticalPixelRatio);
            const x2 = scaleCoordinate(this._p2.x, scope.horizontalPixelRatio);
            const y2 = scaleCoordinate(this._p2.y, scope.verticalPixelRatio);

            const width = x2 - x1;
            const height = y2 - y1;

            // Draw rectangle
            ctx.lineWidth = this._options.width;
            ctx.strokeStyle = this._options.lineColor;
            ctx.lineWidth = this._options.width;
            ctx.strokeStyle = this._options.lineColor;
            ctx.fillStyle = this._options.backgroundColor;
            setLineStyle(ctx, this._options.lineStyle);

            ctx.beginPath();
            ctx.rect(x1, y1, width, height);
            ctx.fill();
            ctx.stroke();

            // Draw anchors when selected
            if (this._selected) {
                // 4 corner anchors
                drawAnchor(scope, x1, y1); // Top-Left (0)
                drawAnchor(scope, x2, y2); // Bottom-Right (1)
                drawAnchor(scope, x1, y2); // Bottom-Left (2)
                drawAnchor(scope, x2, y1); // Top-Right (3)
                // 4 midpoint anchors
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;
                drawAnchor(scope, x1, midY); // Middle-Left (4)
                drawAnchor(scope, x2, midY); // Middle-Right (5)
                drawAnchor(scope, midX, y1); // Top-Center (6)
                drawAnchor(scope, midX, y2); // Bottom-Center (7)
            }
        });
    }
}

class RectanglePaneView implements IPrimitivePaneView {
    private readonly _source: Rectangle;
    private _p1: ViewPoint = { x: null, y: null };
    private _p2: ViewPoint = { x: null, y: null };

    constructor(source: Rectangle) {
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

    renderer(): RectanglePaneRenderer {
        return new RectanglePaneRenderer(
            this._p1,
            this._p2,
            this._source._options,
            this._source._selected
        );
    }
}

export interface RectangleOptions {
    lineColor: string;
    width: number;
    backgroundColor: string;
    lineStyle: number;
    locked?: boolean;
}

const defaultOptions: RectangleOptions = {
    lineColor: 'rgb(41, 98, 255)',
    width: 2,
    backgroundColor: 'rgba(41, 98, 255, 0.2)',
    lineStyle: 0,
    locked: false,
};

export class Rectangle implements ISeriesPrimitive<Time> {
    readonly _chart: IChartApi;
    readonly _series: ISeriesApi<keyof SeriesOptionsMap>;
    _p1: LogicalPoint;
    _p2: LogicalPoint;
    private readonly _paneViews: RectanglePaneView[];
    readonly _options: RectangleOptions;
    _selected: boolean = false;
    _locked: boolean = false;

    constructor(
        chart: IChartApi,
        series: ISeriesApi<SeriesType>,
        p1: LogicalPoint,
        p2: LogicalPoint,
        options?: Partial<RectangleOptions>
    ) {
        this._chart = chart;
        this._series = series;
        this._p1 = p1;
        this._p2 = p2;
        this._options = {
            ...defaultOptions,
            ...options,
        };
        this._paneViews = [new RectanglePaneView(this)];
    }

    /**
     * Update both anchor points of the rectangle
     */
    public updatePoints(p1: LogicalPoint, p2: LogicalPoint): void {
        this._p1 = p1;
        this._p2 = p2;
        this.updateAllViews();
    }

    /**
     * Update a single anchor point by index
     * @param index - 0 for p1, 1 for p2
     * @param point - New logical point
     */
    public updatePointByIndex(index: number, point: LogicalPoint): void {
        const minLogical = Math.min(this._p1.logical, this._p2.logical);
        const maxLogical = Math.max(this._p1.logical, this._p2.logical);
        const minPrice = Math.min(this._p1.price, this._p2.price);
        const maxPrice = Math.max(this._p1.price, this._p2.price);

        switch (index) {
            case 0: // Top-Left: updates min logical and max price
                this._p1 = point;
                break;
            case 1: // Bottom-Right: updates max logical and min price
                this._p2 = point;
                break;
            case 2: // Bottom-Left: updates min logical (x1) and min price (y2)
                this._p1 = { ...this._p1, logical: point.logical };
                this._p2 = { ...this._p2, price: point.price };
                break;
            case 3: // Top-Right: updates max logical (x2) and max price (y1)
                this._p2 = { ...this._p2, logical: point.logical };
                this._p1 = { ...this._p1, price: point.price };
                break;
            case 4: // Middle-Left: only updates min logical (left side)
                this._p1 = { ...this._p1, logical: point.logical };
                break;
            case 5: // Middle-Right: only updates max logical (right side)
                this._p2 = { ...this._p2, logical: point.logical };
                break;
            case 6: // Top-Center: only updates max price (top)
                this._p1 = { ...this._p1, price: point.price };
                break;
            case 7: // Bottom-Center: only updates min price (bottom)
                this._p2 = { ...this._p2, price: point.price };
                break;
        }
        this.updateAllViews();
    }

    /**
     * Get the calculated position of any of the 8 anchor handles.
     * Handles 0-1 are the stored points, 2-7 are calculated virtual anchors.
     */
    public getAnchorPoint(index: number): LogicalPoint | null {
        const minLogical = Math.min(this._p1.logical, this._p2.logical);
        const maxLogical = Math.max(this._p1.logical, this._p2.logical);
        const minPrice = Math.min(this._p1.price, this._p2.price);
        const maxPrice = Math.max(this._p1.price, this._p2.price);
        const midLogical = (minLogical + maxLogical) / 2;
        const midPrice = (minPrice + maxPrice) / 2;

        switch (index) {
            case 0: return { logical: minLogical, price: maxPrice }; // Top-Left
            case 1: return { logical: maxLogical, price: minPrice }; // Bottom-Right
            case 2: return { logical: minLogical, price: minPrice }; // Bottom-Left
            case 3: return { logical: maxLogical, price: maxPrice }; // Top-Right
            case 4: return { logical: minLogical, price: midPrice }; // Middle-Left
            case 5: return { logical: maxLogical, price: midPrice }; // Middle-Right
            case 6: return { logical: midLogical, price: maxPrice }; // Top-Center
            case 7: return { logical: midLogical, price: minPrice }; // Bottom-Center
            default: return null;
        }
    }

    /**
     * Normalize points so p1 is always Top-Left and p2 is always Bottom-Right.
     */
    public normalize(): void {
        const minLogical = Math.min(this._p1.logical, this._p2.logical);
        const maxLogical = Math.max(this._p1.logical, this._p2.logical);
        const minPrice = Math.min(this._p1.price, this._p2.price);
        const maxPrice = Math.max(this._p1.price, this._p2.price);

        this._p1 = { logical: minLogical, price: maxPrice }; // Top-Left
        this._p2 = { logical: maxLogical, price: minPrice }; // Bottom-Right
    }

    /**
     * Set selection state and update visuals
     */
    public setSelected(selected: boolean): void {
        this._selected = selected;
        this.updateAllViews();
    }

    public applyOptions(options: Partial<RectangleOptions>): void {
        Object.assign(this._options, options);
        this.updateAllViews();
        this._chart.timeScale().applyOptions({});
    }

    /**
     * Hit test to detect clicks on anchors or inside rectangle
     * @param x - Screen x coordinate
     * @param y - Screen y coordinate
     * @returns Hit test result indicating what was clicked
     */
    public toolHitTest(x: number, y: number): HitTestResult | null {
        const timeScale = this._chart.timeScale();
        const series = this._series;

        const x1 = timeScale.logicalToCoordinate(this._p1.logical as Logical);
        const y1 = series.priceToCoordinate(this._p1.price);
        const x2 = timeScale.logicalToCoordinate(this._p2.logical as Logical);
        const y2 = series.priceToCoordinate(this._p2.price);

        if (x1 === null || y1 === null || x2 === null || y2 === null) return null;

        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;

        // Check all 8 anchor points (higher priority)
        const threshold = 8;
        const anchors = [
            { x: minX, y: minY, index: 0 }, // Top-Left
            { x: maxX, y: maxY, index: 1 }, // Bottom-Right
            { x: minX, y: maxY, index: 2 }, // Bottom-Left
            { x: maxX, y: minY, index: 3 }, // Top-Right
            { x: minX, y: midY, index: 4 }, // Middle-Left
            { x: maxX, y: midY, index: 5 }, // Middle-Right
            { x: midX, y: minY, index: 6 }, // Top-Center
            { x: midX, y: maxY, index: 7 }, // Bottom-Center
        ];

        for (const anchor of anchors) {
            if (Math.hypot(x - anchor.x, y - anchor.y) < threshold) {
                return { hit: true, type: 'point', index: anchor.index };
            }
        }

        // Check if inside rectangle
        if (isPointInRectangle({ x, y }, { x1: minX, y1: minY, x2: maxX, y2: maxY })) {
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

    paneViews(): RectanglePaneView[] {
        if ((this as any)._hiddenByVisibility) {
            return [];
        }
        return this._paneViews;
    }
}
