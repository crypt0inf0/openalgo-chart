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
    scaleCoordinate,
    drawAnchor,
    setLineStyle,
} from './base-types';
import { AutoscaleInfo } from 'lightweight-charts';

class TrianglePaneRenderer implements IPrimitivePaneRenderer {
    private readonly _p1: ViewPoint;
    private readonly _p2: ViewPoint;
    private readonly _p3: ViewPoint;
    private readonly _options: TriangleOptions;
    private readonly _selected: boolean;

    constructor(
        p1: ViewPoint,
        p2: ViewPoint,
        p3: ViewPoint,
        options: TriangleOptions,
        selected: boolean
    ) {
        this._p1 = p1;
        this._p2 = p2;
        this._p3 = p3;
        this._options = options;
        this._selected = selected;
    }

    draw(target: CanvasRenderingTarget2D): void {
        target.useBitmapCoordinateSpace(scope => {
            if (
                this._p1.x === null ||
                this._p1.y === null ||
                this._p2.x === null ||
                this._p2.y === null ||
                this._p3.x === null ||
                this._p3.y === null
            )
                return;

            const ctx = scope.context;

            const x1 = scaleCoordinate(this._p1.x, scope.horizontalPixelRatio);
            const y1 = scaleCoordinate(this._p1.y, scope.verticalPixelRatio);
            const x2 = scaleCoordinate(this._p2.x, scope.horizontalPixelRatio);
            const y2 = scaleCoordinate(this._p2.y, scope.verticalPixelRatio);
            const x3 = scaleCoordinate(this._p3.x, scope.horizontalPixelRatio);
            const y3 = scaleCoordinate(this._p3.y, scope.verticalPixelRatio);

            // Draw triangle
            ctx.lineWidth = this._options.width;
            ctx.strokeStyle = this._options.lineColor;
            ctx.lineWidth = this._options.width;
            ctx.strokeStyle = this._options.lineColor;
            ctx.fillStyle = this._options.backgroundColor;
            setLineStyle(ctx, this._options.lineStyle);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineTo(x3, y3);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Draw anchors when selected
            if (this._selected) {
                drawAnchor(scope, x1, y1);
                drawAnchor(scope, x2, y2);
                drawAnchor(scope, x3, y3);
            }
        });
    }
}

class TrianglePaneView implements IPrimitivePaneView {
    private readonly _source: Triangle;
    private _p1: ViewPoint = { x: null, y: null };
    private _p2: ViewPoint = { x: null, y: null };
    private _p3: ViewPoint = { x: null, y: null };

    constructor(source: Triangle) {
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
        this._p3 = pointToCoordinate(
            this._source._p3,
            this._source._chart,
            this._source._series
        );
    }

    renderer(): TrianglePaneRenderer {
        return new TrianglePaneRenderer(
            this._p1,
            this._p2,
            this._p3,
            this._source._options,
            this._source._selected
        );
    }
}

export interface TriangleOptions {
    lineColor: string;
    backgroundColor: string;
    width: number;
    lineStyle: number;
    locked?: boolean;
}

const defaultOptions: TriangleOptions = {
    lineColor: 'rgb(33, 150, 243)',
    backgroundColor: 'rgba(33, 150, 243, 0.2)',
    width: 1,
    lineStyle: 0,
    locked: false,
};

export class Triangle implements ISeriesPrimitive<Time> {
    readonly _chart: IChartApi;
    readonly _series: ISeriesApi<keyof SeriesOptionsMap>;
    _p1: LogicalPoint;
    _p2: LogicalPoint;
    _p3: LogicalPoint;
    private readonly _paneViews: TrianglePaneView[];
    readonly _options: TriangleOptions;
    _selected: boolean = false;
    _locked: boolean = false;

    constructor(
        chart: IChartApi,
        series: ISeriesApi<SeriesType>,
        p1: LogicalPoint,
        p2: LogicalPoint,
        p3: LogicalPoint,
        options?: Partial<TriangleOptions>
    ) {
        this._chart = chart;
        this._series = series;
        this._p1 = p1;
        this._p2 = p2;
        this._p3 = p3;
        this._options = {
            ...defaultOptions,
            ...options,
        };
        this._paneViews = [new TrianglePaneView(this)];
    }

    /**
     * Update all three points of the triangle
     */
    public updatePoints(p1: LogicalPoint, p2: LogicalPoint, p3: LogicalPoint): void {
        this._p1 = p1;
        this._p2 = p2;
        this._p3 = p3;
        this.updateAllViews();
    }

    /**
     * Update a single point by index
     * @param index - 0 for p1, 1 for p2, 2 for p3
     * @param point - New logical point
     */
    public updatePointByIndex(index: number, point: LogicalPoint): void {
        if (index === 0) {
            this._p1 = point;
        } else if (index === 1) {
            this._p2 = point;
        } else if (index === 2) {
            this._p3 = point;
        }
        this.updateAllViews();
    }

    /**
     * Set selection state and update visuals
     */
    public setSelected(selected: boolean): void {
        this._selected = selected;
        this.updateAllViews();
    }

    public applyOptions(options: Partial<TriangleOptions>): void {
        Object.assign(this._options, options);
        this.updateAllViews();
        this._chart.timeScale().applyOptions({});
    }

    /**
     * Hit test to detect clicks on anchor points or inside triangle
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
        const x3 = timeScale.logicalToCoordinate(this._p3.logical as Logical);
        const y3 = series.priceToCoordinate(this._p3.price);

        if (
            x1 === null ||
            y1 === null ||
            x2 === null ||
            y2 === null ||
            x3 === null ||
            y3 === null
        )
            return null;

        // Check anchor points first (higher priority)
        const threshold = 8;
        if (Math.hypot(x - x1, y - y1) < threshold) {
            return { hit: true, type: 'point', index: 0 };
        }
        if (Math.hypot(x - x2, y - y2) < threshold) {
            return { hit: true, type: 'point', index: 1 };
        }
        if (Math.hypot(x - x3, y - y3) < threshold) {
            return { hit: true, type: 'point', index: 2 };
        }

        // Check if inside triangle using barycentric coordinates
        if (this._isPointInTriangle({ x, y }, { x: x1, y: y1 }, { x: x2, y: y2 }, { x: x3, y: y3 })) {
            return { hit: true, type: 'shape' };
        }

        return null;
    }

    autoscaleInfo(): AutoscaleInfo | null {
        return null;
    }

    /**
     * Check if a point is inside a triangle using barycentric coordinates
     */
    private _isPointInTriangle(
        p: { x: number; y: number },
        v1: { x: number; y: number },
        v2: { x: number; y: number },
        v3: { x: number; y: number }
    ): boolean {
        const area = 0.5 * (-v2.y * v3.x + v1.y * (-v2.x + v3.x) + v1.x * (v2.y - v3.y) + v2.x * v3.y);
        const s = (1 / (2 * area)) * (v1.y * v3.x - v1.x * v3.y + (v3.y - v1.y) * p.x + (v1.x - v3.x) * p.y);
        const t = (1 / (2 * area)) * (v1.x * v2.y - v1.y * v2.x + (v1.y - v2.y) * p.x + (v2.x - v1.x) * p.y);

        return s >= 0 && t >= 0 && s + t <= 1;
    }

    updateAllViews(): void {
        this._paneViews.forEach(pw => pw.update());
    }

    paneViews(): TrianglePaneView[] {
        if ((this as any)._hiddenByVisibility) {
            return [];
        }
        return this._paneViews;
    }
}
