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
    roundToMinMove,
} from './base-types';

interface FibLevel {
    coeff: number;
    color: string;
}

class FibRetracementPaneRenderer implements IPrimitivePaneRenderer {
    private readonly _p1: ViewPoint;
    private readonly _p2: ViewPoint;
    private readonly _p1Price: number;
    private readonly _p2Price: number;
    private readonly _priceToCoordinate: (price: number) => number | null;
    private readonly _formatPrice: (price: number) => string;
    private readonly _minMove: number;
    private readonly _options: FibRetracementOptions;
    private readonly _selected: boolean;

    constructor(
        p1: ViewPoint,
        p2: ViewPoint,
        p1Price: number,
        p2Price: number,
        priceToCoordinate: (price: number) => number | null,
        formatPrice: (price: number) => string,
        minMove: number,
        options: FibRetracementOptions,
        selected: boolean
    ) {
        this._p1 = p1;
        this._p2 = p2;
        this._p1Price = p1Price;
        this._p2Price = p2Price;
        this._priceToCoordinate = priceToCoordinate;
        this._formatPrice = formatPrice;
        this._minMove = minMove;
        this._options = options;
        this._selected = selected;
    }

    draw(target: CanvasRenderingTarget2D): void {
        target.useBitmapCoordinateSpace(scope => {
            if (this._p1.x === null || this._p1.y === null || this._p2.x === null || this._p2.y === null)
                return;

            const ctx = scope.context;

            const x1 = scaleCoordinate(this._p1.x, scope.horizontalPixelRatio);
            const x2 = scaleCoordinate(this._p2.x, scope.horizontalPixelRatio);
            const y1 = scaleCoordinate(this._p1.y, scope.verticalPixelRatio);
            const y2 = scaleCoordinate(this._p2.y, scope.verticalPixelRatio);

            // Draw trend line (dashed)
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(120, 120, 120, 0.5)';
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw fib levels
            const priceDiff = this._p2Price - this._p1Price;
            const startX = Math.min(x1, x2);
            const endX = Math.max(x1, x2);

            this._options.levels.forEach(level => {
                // Calculate and round price to instrument precision
                const rawPrice = this._p2Price - priceDiff * level.coeff;
                const levelPrice = roundToMinMove(rawPrice, this._minMove);
                const levelCoord = this._priceToCoordinate(levelPrice);

                if (levelCoord !== null) {
                    const y = scaleCoordinate(levelCoord, scope.verticalPixelRatio);

                    ctx.lineWidth = this._options.width;
                    ctx.strokeStyle = level.color;
                    ctx.beginPath();
                    ctx.moveTo(startX, y);
                    ctx.lineTo(endX, y);
                    ctx.stroke();

                    // Draw Label with formatted price
                    ctx.font = '10px Arial';
                    ctx.fillStyle = level.color;
                    ctx.fillText(`${level.coeff} (${this._formatPrice(levelPrice)})`, startX + 2, y - 2);
                }
            });

            // Draw anchors when selected
            if (this._selected) {
                drawAnchor(scope, x1, y1);
                drawAnchor(scope, x2, y2);
            }
        });
    }
}

class FibRetracementPaneView implements IPrimitivePaneView {
    private readonly _source: FibRetracement;
    private _p1: ViewPoint = { x: null, y: null };
    private _p2: ViewPoint = { x: null, y: null };

    constructor(source: FibRetracement) {
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

    renderer(): FibRetracementPaneRenderer {
        const series = this._source._series;
        const minMove = series.options().priceFormat.minMove || 0.01;
        const priceFormatter = series.priceFormatter();
        return new FibRetracementPaneRenderer(
            this._p1,
            this._p2,
            this._source._p1.price,
            this._source._p2.price,
            (price: number) => series.priceToCoordinate(price),
            (price: number) => priceFormatter.format(price),
            minMove,
            this._source._options,
            this._source._selected
        );
    }
}

export interface FibRetracementOptions {
    width: number;
    levels: FibLevel[];
}

const defaultOptions: FibRetracementOptions = {
    width: 1,
    levels: [
        { coeff: 0, color: '#787b86' },
        { coeff: 0.236, color: '#f23645' },
        { coeff: 0.382, color: '#81c784' },
        { coeff: 0.5, color: '#4caf50' },
        { coeff: 0.618, color: '#089981' },
        { coeff: 0.786, color: '#64b5f6' },
        { coeff: 1, color: '#787b86' },
        { coeff: 1.618, color: '#2962ff' },
        { coeff: 2.618, color: '#f23645' },
        { coeff: 3.618, color: '#9c27b0' },
        { coeff: 4.236, color: '#e91e63' },
    ],
};

export class FibRetracement implements ISeriesPrimitive<Time> {
    readonly _chart: IChartApi;
    readonly _series: ISeriesApi<keyof SeriesOptionsMap>;
    _p1: LogicalPoint;
    _p2: LogicalPoint;
    private readonly _paneViews: FibRetracementPaneView[];
    readonly _options: FibRetracementOptions;
    _selected: boolean = false;

    constructor(
        chart: IChartApi,
        series: ISeriesApi<SeriesType>,
        p1: LogicalPoint,
        p2: LogicalPoint,
        options?: Partial<FibRetracementOptions>
    ) {
        this._chart = chart;
        this._series = series;
        this._p1 = p1;
        this._p2 = p2;
        this._options = {
            ...defaultOptions,
            ...options,
        };
        this._paneViews = [new FibRetracementPaneView(this)];
    }

    /**
     * Update both anchor points
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
        if (index === 0) {
            this._p1 = point;
        } else if (index === 1) {
            this._p2 = point;
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

    public applyOptions(options: Partial<FibRetracementOptions>): void {
        Object.assign(this._options, options);
        this.updateAllViews();
        this._chart.timeScale().applyOptions({});
    }

    /**
     * Hit test to detect clicks on anchor points or fib levels
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

        // Check anchor points first
        const threshold = 8;
        if (Math.hypot(x - x1, y - y1) < threshold) {
            return { hit: true, type: 'point', index: 0 };
        }
        if (Math.hypot(x - x2, y - y2) < threshold) {
            return { hit: true, type: 'point', index: 1 };
        }

        // Check base line
        const dist = distanceToSegment({ x, y }, { x: x1, y: y1 }, { x: x2, y: y2 });
        if (dist < 5) {
            return { hit: true, type: 'line' };
        }

        // Check fib level lines
        const priceDiff = this._p2.price - this._p1.price;
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);

        for (const level of this._options.levels) {
            const levelPrice = this._p2.price - priceDiff * level.coeff;
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

    paneViews(): FibRetracementPaneView[] {
        if ((this as any)._hiddenByVisibility) {
            return [];
        }
        return this._paneViews;
    }
}
