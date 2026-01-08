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
    distanceToSegment,
} from './base-types';

interface FibLevel {
    coeff: number;
    color: string;
}

class FibExtensionPaneRenderer implements IPrimitivePaneRenderer {
    private readonly _p1: ViewPoint;
    private readonly _p2: ViewPoint;
    private readonly _p3: ViewPoint;
    private readonly _p1Price: number;
    private readonly _p2Price: number;
    private readonly _p3Price: number;
    private readonly _priceToCoordinate: (price: number) => number | null;
    private readonly _options: FibExtensionOptions;
    private readonly _selected: boolean;

    constructor(
        p1: ViewPoint,
        p2: ViewPoint,
        p3: ViewPoint,
        p1Price: number,
        p2Price: number,
        p3Price: number,
        priceToCoordinate: (price: number) => number | null,
        options: FibExtensionOptions,
        selected: boolean
    ) {
        this._p1 = p1;
        this._p2 = p2;
        this._p3 = p3;
        this._p1Price = p1Price;
        this._p2Price = p2Price;
        this._p3Price = p3Price;
        this._priceToCoordinate = priceToCoordinate;
        this._options = options;
        this._selected = selected;
    }

    draw(target: CanvasRenderingTarget2D): void {
        target.useBitmapCoordinateSpace(scope => {
            if (
                this._p1.x === null || this._p1.y === null ||
                this._p2.x === null || this._p2.y === null ||
                this._p3.x === null || this._p3.y === null
            )
                return;

            const ctx = scope.context;

            const x1 = scaleCoordinate(this._p1.x, scope.horizontalPixelRatio);
            const x2 = scaleCoordinate(this._p2.x, scope.horizontalPixelRatio);
            const x3 = scaleCoordinate(this._p3.x, scope.horizontalPixelRatio);
            const y1 = scaleCoordinate(this._p1.y, scope.verticalPixelRatio);
            const y2 = scaleCoordinate(this._p2.y, scope.verticalPixelRatio);
            const y3 = scaleCoordinate(this._p3.y, scope.verticalPixelRatio);

            // Draw trend line A->B (dashed)
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(120, 120, 120, 0.5)';
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            // Draw retracement line B->C (dashed)
            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.lineTo(x3, y3);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw fib extension levels from point C
            const initialMove = this._p2Price - this._p1Price; // A to B move
            const startX = Math.min(x1, x2, x3);
            const endX = Math.max(x1, x2, x3);

            this._options.levels.forEach(level => {
                // Extension levels are projected from point C
                const levelPrice = this._p3Price + initialMove * level.coeff;
                const levelCoord = this._priceToCoordinate(levelPrice);

                if (levelCoord !== null) {
                    const y = scaleCoordinate(levelCoord, scope.verticalPixelRatio);

                    ctx.lineWidth = this._options.width;
                    ctx.strokeStyle = level.color;
                    ctx.beginPath();
                    ctx.moveTo(startX, y);
                    ctx.lineTo(endX, y);
                    ctx.stroke();

                    // Draw Label
                    ctx.font = '10px Arial';
                    ctx.fillStyle = level.color;
                    const percentage = (level.coeff * 100).toFixed(1);
                    ctx.fillText(`${percentage}% (${levelPrice.toFixed(2)})`, startX + 2, y - 2);
                }
            });

            // Draw anchors when selected
            if (this._selected) {
                drawAnchor(scope, x1, y1);
                drawAnchor(scope, x2, y2);
                drawAnchor(scope, x3, y3);
            }
        });
    }
}

class FibExtensionPaneView implements IPrimitivePaneView {
    private readonly _source: FibExtension;
    private _p1: ViewPoint = { x: null, y: null };
    private _p2: ViewPoint = { x: null, y: null };
    private _p3: ViewPoint = { x: null, y: null };

    constructor(source: FibExtension) {
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

    renderer(): FibExtensionPaneRenderer {
        return new FibExtensionPaneRenderer(
            this._p1,
            this._p2,
            this._p3,
            this._source._p1.price,
            this._source._p2.price,
            this._source._p3.price,
            (price: number) => this._source._series.priceToCoordinate(price),
            this._source._options,
            this._source._selected
        );
    }
}

export interface FibExtensionOptions {
    width: number;
    levels: FibLevel[];
}

const defaultOptions: FibExtensionOptions = {
    width: 1,
    levels: [
        { coeff: 0, color: '#787b86' },
        { coeff: 0.618, color: '#f44336' },
        { coeff: 1.0, color: '#4caf50' },
        { coeff: 1.618, color: '#2962ff' },
        { coeff: 2.618, color: '#9c27b0' },
        { coeff: 4.236, color: '#ff9800' },
    ],
};

export class FibExtension implements ISeriesPrimitive<Time> {
    readonly _chart: IChartApi;
    readonly _series: ISeriesApi<keyof SeriesOptionsMap>;
    _p1: LogicalPoint;
    _p2: LogicalPoint;
    _p3: LogicalPoint;
    private readonly _paneViews: FibExtensionPaneView[];
    readonly _options: FibExtensionOptions;
    _selected: boolean = false;

    constructor(
        chart: IChartApi,
        series: ISeriesApi<SeriesType>,
        p1: LogicalPoint,
        p2: LogicalPoint,
        p3: LogicalPoint,
        options?: Partial<FibExtensionOptions>
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
        this._paneViews = [new FibExtensionPaneView(this)];
    }

    public updatePoints(p1: LogicalPoint, p2: LogicalPoint, p3: LogicalPoint): void {
        this._p1 = p1;
        this._p2 = p2;
        this._p3 = p3;
        this.updateAllViews();
    }

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

    public setSelected(selected: boolean): void {
        this._selected = selected;
        this.updateAllViews();
    }

    public toolHitTest(x: number, y: number): HitTestResult | null {
        const timeScale = this._chart.timeScale();
        const series = this._series;

        const x1 = timeScale.logicalToCoordinate(this._p1.logical as Logical);
        const y1 = series.priceToCoordinate(this._p1.price);
        const x2 = timeScale.logicalToCoordinate(this._p2.logical as Logical);
        const y2 = series.priceToCoordinate(this._p2.price);
        const x3 = timeScale.logicalToCoordinate(this._p3.logical as Logical);
        const y3 = series.priceToCoordinate(this._p3.price);

        if (x1 === null || y1 === null || x2 === null || y2 === null || x3 === null || y3 === null)
            return null;

        // Check anchor points
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

        // Check base lines
        const dist1 = distanceToSegment({ x, y }, { x: x1, y: y1 }, { x: x2, y: y2 });
        const dist2 = distanceToSegment({ x, y }, { x: x2, y: y2 }, { x: x3, y: y3 });
        if (dist1 < 5 || dist2 < 5) {
            return { hit: true, type: 'line' };
        }

        // Check fib level lines
        const initialMove = this._p2.price - this._p1.price;
        const minX = Math.min(x1, x2, x3);
        const maxX = Math.max(x1, x2, x3);

        for (const level of this._options.levels) {
            const levelPrice = this._p3.price + initialMove * level.coeff;
            const levelCoord = series.priceToCoordinate(levelPrice);
            if (levelCoord !== null) {
                // Check if Y is close AND X is within the range
                if (Math.abs(y - levelCoord) < 5 && x >= minX && x <= maxX) {
                    return { hit: true, type: 'line' };
                }
            }
        }

        return null;
    }

    updateAllViews(): void {
        this._paneViews.forEach(pw => pw.update());
    }

    paneViews(): FibExtensionPaneView[] {
        return this._paneViews;
    }
}
