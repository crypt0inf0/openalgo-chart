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
} from './base-types';

class DateRangePaneRenderer implements IPrimitivePaneRenderer {
    private readonly _p1: ViewPoint;
    private readonly _p2: ViewPoint;
    private readonly _options: DateRangeOptions;
    private readonly _selected: boolean;
    private readonly _source: DateRange;

    constructor(
        p1: ViewPoint,
        p2: ViewPoint,
        options: DateRangeOptions,
        selected: boolean,
        source: DateRange
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

            const width = xMax - xMin;

            const yMin = Math.min(y1Scaled, y2Scaled);
            const yMax = Math.max(y1Scaled, y2Scaled);
            const rectHeight = yMax - yMin;

            // Draw filled rectangle
            if (this._options.backgroundColor) {
                ctx.fillStyle = this._options.backgroundColor;
                ctx.fillRect(xMin, yMin, width, rectHeight);
            }

            // Draw border
            ctx.strokeStyle = this._options.borderColor;
            ctx.lineWidth = this._options.borderWidth * scope.verticalPixelRatio;
            ctx.strokeRect(xMin, yMin, width, rectHeight);

            // Draw horizontal center line with arrow
            const yMid = (y1Scaled + y2Scaled) / 2;
            const arrowSize = 10 * scope.verticalPixelRatio;

            ctx.beginPath();
            ctx.moveTo(xMin, yMid);
            ctx.lineTo(xMax, yMid);

            // Draw arrow pointing toward second point
            const xDiff = x2Scaled - x1Scaled;
            if (Math.abs(xDiff) > arrowSize) {
                let arrowX: number;
                if (xDiff > 0) {
                    // Point 2 is right of point 1 - arrow at right
                    arrowX = xMax;
                    ctx.moveTo(arrowX - arrowSize, yMid - arrowSize);
                    ctx.lineTo(arrowX, yMid);
                    ctx.lineTo(arrowX - arrowSize, yMid + arrowSize);
                } else {
                    // Point 2 is left of point 1 - arrow at left
                    arrowX = xMin;
                    ctx.moveTo(arrowX + arrowSize, yMid - arrowSize);
                    ctx.lineTo(arrowX, yMid);
                    ctx.lineTo(arrowX + arrowSize, yMid + arrowSize);
                }
            }
            ctx.stroke();

            // Calculate stats
            const logical1 = this._source._p1.logical;
            const logical2 = this._source._p2.logical;
            const bars = Math.abs(logical2 - logical1);

            // Estimate days (assuming daily bars for simplicity, or just show bars)
            const labelText = `${bars} bars`;

            // Draw label
            ctx.font = `bold ${14 * scope.verticalPixelRatio}px sans-serif`;
            ctx.fillStyle = this._options.borderColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(labelText, (xMin + xMax) / 2, yMin - 5 * scope.verticalPixelRatio);

            // Draw anchors when selected
            if (this._selected) {
                drawAnchor(scope, x1Scaled, y1Scaled);
                drawAnchor(scope, x2Scaled, y2Scaled);
                drawAnchor(scope, x1Scaled, y2Scaled);
                drawAnchor(scope, x2Scaled, y1Scaled);
            }
        });
    }
}

class DateRangePaneView implements IPrimitivePaneView {
    private readonly _source: DateRange;
    private _p1: ViewPoint = { x: null, y: null };
    private _p2: ViewPoint = { x: null, y: null };

    constructor(source: DateRange) {
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

    renderer(): DateRangePaneRenderer {
        return new DateRangePaneRenderer(
            this._p1,
            this._p2,
            this._source._options,
            this._source._selected,
            this._source
        );
    }
}

export interface DateRangeOptions {
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
}

const defaultOptions: DateRangeOptions = {
    backgroundColor: 'rgba(41, 98, 255, 0.2)',
    borderColor: 'rgb(41, 98, 255)',
    borderWidth: 2,
};

export class DateRange implements ISeriesPrimitive<Time> {
    readonly _chart: IChartApi;
    readonly _series: ISeriesApi<keyof SeriesOptionsMap>;
    _p1: LogicalPoint;
    _p2: LogicalPoint;
    private readonly _paneViews: DateRangePaneView[];
    readonly _options: DateRangeOptions;
    _selected: boolean = false;

    constructor(
        chart: IChartApi,
        series: ISeriesApi<SeriesType>,
        p1: LogicalPoint,
        p2: LogicalPoint,
        options?: Partial<DateRangeOptions>
    ) {
        this._chart = chart;
        this._series = series;
        this._p1 = p1;
        this._p2 = p2;
        this._options = {
            ...defaultOptions,
            ...options,
        };
        this._paneViews = [new DateRangePaneView(this)];
    }

    public updatePoints(p1: LogicalPoint, p2: LogicalPoint): void {
        this._p1 = p1;
        this._p2 = p2;
        this.updateAllViews();
    }

    public updatePointByIndex(index: number, point: LogicalPoint): void {
        if (index === 0) {
            this._p1 = point;
        } else {
            this._p2 = point;
        }
        this.updateAllViews();
    }

    public setSelected(selected: boolean): void {
        this._selected = selected;
        this.updateAllViews();
    }

    public applyOptions(options: Partial<DateRangeOptions>): void {
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

        // Check all 4 corner anchors to match the visual representation
        // Top-left (p1)
        if (Math.hypot(x - x1, y - y1) < threshold) return { hit: true, type: 'point', index: 0 };
        // Bottom-right (p2)
        if (Math.hypot(x - x2, y - y2) < threshold) return { hit: true, type: 'point', index: 1 };
        // Top-right corner
        if (Math.hypot(x - x2, y - y1) < threshold) return { hit: true, type: 'point', index: 1 };
        // Bottom-left corner
        if (Math.hypot(x - x1, y - y2) < threshold) return { hit: true, type: 'point', index: 0 };

        // Check inside
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);

        if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
            return { hit: true, type: 'shape' };
        }

        return null;
    }

    updateAllViews(): void {
        this._paneViews.forEach(pw => pw.update());
    }

    paneViews(): DateRangePaneView[] {
        return this._paneViews;
    }
}
