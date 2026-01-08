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

class CrossLinePaneRenderer implements IPrimitivePaneRenderer {
    private readonly _point: ViewPoint;
    private readonly _options: CrossLineOptions;
    private readonly _selected: boolean;

    constructor(
        point: ViewPoint,
        options: CrossLineOptions,
        selected: boolean
    ) {
        this._point = point;
        this._options = options;
        this._selected = selected;
    }

    draw(target: CanvasRenderingTarget2D): void {
        target.useBitmapCoordinateSpace(scope => {
            if (this._point.x === null || this._point.y === null) return;

            const ctx = scope.context;

            const x = scaleCoordinate(this._point.x, scope.horizontalPixelRatio);
            const y = scaleCoordinate(this._point.y, scope.verticalPixelRatio);
            const width = scope.mediaSize.width * scope.horizontalPixelRatio;
            const height = scope.mediaSize.height * scope.verticalPixelRatio;

            ctx.lineWidth = this._options.width;
            ctx.strokeStyle = this._options.lineColor;

            // Apply line style
            setLineStyle(ctx, this._options.lineStyle);

            // Horizontal Line
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();

            // Vertical Line
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();

            ctx.setLineDash([]);

            // Draw anchor when selected (at intersection)
            if (this._selected) {
                drawAnchor(scope, x, y);
            }
        });
    }
}

class CrossLinePaneView implements IPrimitivePaneView {
    private readonly _source: CrossLine;
    private _point: ViewPoint = { x: null, y: null };

    constructor(source: CrossLine) {
        this._source = source;
    }

    update(): void {
        this._point = pointToCoordinate(
            this._source._point,
            this._source._chart,
            this._source._series
        );
    }

    renderer(): CrossLinePaneRenderer {
        return new CrossLinePaneRenderer(
            this._point,
            this._source._options,
            this._source._selected
        );
    }
}

export interface CrossLineOptions {
    lineColor: string;
    width: number;
    lineStyle: number; // 0: Solid, 1: Dotted, 2: Dashed
}

const defaultOptions: CrossLineOptions = {
    lineColor: '#2962FF',
    width: 2,
    lineStyle: 2,
};

export class CrossLine implements ISeriesPrimitive<Time> {
    readonly _chart: IChartApi;
    readonly _series: ISeriesApi<keyof SeriesOptionsMap>;
    _point: LogicalPoint;
    private readonly _paneViews: CrossLinePaneView[];
    readonly _options: CrossLineOptions;
    _selected: boolean = false;

    constructor(
        chart: IChartApi,
        series: ISeriesApi<SeriesType>,
        point: LogicalPoint,
        options?: Partial<CrossLineOptions>
    ) {
        this._chart = chart;
        this._series = series;
        this._point = point;
        this._options = {
            ...defaultOptions,
            ...options,
        };
        this._paneViews = [new CrossLinePaneView(this)];
    }

    /**
     * Update the crosshair position
     */
    public updatePoint(point: LogicalPoint): void {
        this._point = point;
        this.updateAllViews();
    }

    public applyOptions(options: Partial<CrossLineOptions>): void {
        Object.assign(this._options, options);
        this.updateAllViews();
        this._chart.timeScale().applyOptions({});
    }

    /**
     * Update a specific anchor point by index (used for dragging)
     * For crossline, only index 0 exists and updates the point
     */
    public updatePointByIndex(index: number, point: { logical: number, price: number }): void {
        if (index === 0) {
            this._point = point;
            this.updateAllViews();
        }
    }

    /**
     * Set selection state and update visuals
     */
    public setSelected(selected: boolean): void {
        this._selected = selected;
        this.updateAllViews();
    }

    /**
     * Hit test to detect clicks near the crosshair intersection
     * @param x - Screen x coordinate
     * @param y - Screen y coordinate
     * @returns Hit test result indicating if crosshair was clicked
     */
    public toolHitTest(x: number, y: number): HitTestResult | null {
        const timeScale = this._chart.timeScale();
        const series = this._series;

        const xCoord = timeScale.logicalToCoordinate(this._point.logical as Logical);
        const yCoord = series.priceToCoordinate(this._point.price);

        if (xCoord === null || yCoord === null) return null;

        // Check if click is near the horizontal line
        const threshold = 5;
        if (Math.abs(y - yCoord) < threshold) {
            return { hit: true, type: 'line' };
        }

        // Check if click is near the vertical line
        if (Math.abs(x - xCoord) < threshold) {
            return { hit: true, type: 'line' };
        }

        // Check if click is near the intersection point
        if (Math.hypot(x - xCoord, y - yCoord) < 8) {
            return { hit: true, type: 'point' };
        }

        return null;
    }

    autoscaleInfo(): AutoscaleInfo | null {
        return null;
    }

    updateAllViews(): void {
        this._paneViews.forEach(pw => pw.update());
    }

    paneViews(): CrossLinePaneView[] {
        return this._paneViews;
    }
}
