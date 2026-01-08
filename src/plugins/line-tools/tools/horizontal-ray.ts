import { CanvasRenderingTarget2D } from 'fancy-canvas';
import {
    IChartApi,
    ISeriesApi,
    ISeriesPrimitive,
    IPrimitivePaneRenderer,
    IPrimitivePaneView,
    SeriesOptionsMap,
    SeriesType,
    Time,
    Logical,
} from 'lightweight-charts';
import {
    HitTestResult,
    scaleCoordinate,
    drawAnchor,
    LogicalPoint,
    setLineStyle,
} from './base-types';
import { AutoscaleInfo } from 'lightweight-charts';

class HorizontalRayPaneRenderer implements IPrimitivePaneRenderer {
    private readonly _x: number | null;
    private readonly _y: number | null;
    private readonly _options: HorizontalRayOptions;
    private readonly _selected: boolean;

    constructor(x: number | null, y: number | null, options: HorizontalRayOptions, selected: boolean) {
        this._x = x;
        this._y = y;
        this._options = options;
        this._selected = selected;
    }

    draw(target: CanvasRenderingTarget2D): void {
        target.useBitmapCoordinateSpace(scope => {
            if (this._x === null || this._y === null) return;

            const ctx = scope.context;
            const xScaled = scaleCoordinate(this._x, scope.horizontalPixelRatio);
            const yScaled = scaleCoordinate(this._y, scope.verticalPixelRatio);
            const width = scope.mediaSize.width * scope.horizontalPixelRatio;

            // Draw ray from x to right edge
            ctx.lineWidth = this._options.width;
            ctx.strokeStyle = this._options.lineColor;
            setLineStyle(ctx, this._options.lineStyle);
            ctx.beginPath();
            ctx.moveTo(xScaled, yScaled);
            ctx.lineTo(width, yScaled);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw anchor when selected (at start point)
            if (this._selected) {
                drawAnchor(scope, xScaled, yScaled);
            }
        });
    }
}

class HorizontalRayPaneView implements IPrimitivePaneView {
    private readonly _source: HorizontalRay;
    private _x: number | null = null;
    private _y: number | null = null;

    constructor(source: HorizontalRay) {
        this._source = source;
    }

    update(): void {
        const timeScale = this._source._chart.timeScale();
        this._x = timeScale.logicalToCoordinate(this._source._point.logical as Logical);
        this._y = this._source._series.priceToCoordinate(this._source._point.price);
    }

    renderer(): HorizontalRayPaneRenderer {
        return new HorizontalRayPaneRenderer(
            this._x,
            this._y,
            this._source._options,
            this._source._selected
        );
    }
}

export interface HorizontalRayOptions {
    lineColor: string;
    width: number;
    lineStyle: number;
}

const defaultOptions: HorizontalRayOptions = {
    lineColor: '#2962FF',
    width: 2,
    lineStyle: 0,
};

export class HorizontalRay implements ISeriesPrimitive<Time> {
    readonly _chart: IChartApi;
    readonly _series: ISeriesApi<keyof SeriesOptionsMap>;
    _point: LogicalPoint;
    private readonly _paneViews: HorizontalRayPaneView[];
    readonly _options: HorizontalRayOptions;
    _selected: boolean = false;

    constructor(
        chart: IChartApi,
        series: ISeriesApi<SeriesType>,
        point: LogicalPoint,
        options?: Partial<HorizontalRayOptions>
    ) {
        this._chart = chart;
        this._series = series;
        this._point = point;
        this._options = {
            ...defaultOptions,
            ...options,
        };
        this._paneViews = [new HorizontalRayPaneView(this)];
    }

    /**
     * Update the point of the horizontal ray
     */
    public updatePoint(point: LogicalPoint): void {
        this._point = point;
        this.updateAllViews();
    }

    public applyOptions(options: Partial<HorizontalRayOptions>): void {
        Object.assign(this._options, options);
        this.updateAllViews();
        this._chart.timeScale().applyOptions({});
    }

    /**
     * Update a specific anchor point by index (used for dragging)
     * For horizontal ray, only index 0 exists and updates the point
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
     * Hit test to detect clicks on the horizontal ray
     * @param x - Screen x coordinate
     * @param y - Screen y coordinate
     * @returns Hit test result indicating if line was hit
     */
    public toolHitTest(x: number, y: number): HitTestResult | null {
        const timeScale = this._chart.timeScale();
        const xCoord = timeScale.logicalToCoordinate(this._point.logical as Logical);
        const yCoord = this._series.priceToCoordinate(this._point.price);

        if (xCoord === null || yCoord === null) return null;

        // Check anchor point first
        const threshold = 8;
        if (Math.hypot(x - xCoord, y - yCoord) < threshold) {
            return { hit: true, type: 'point', index: 0 };
        }

        // Check line (must be to the right of start point)
        if (x >= xCoord && Math.abs(y - yCoord) < 5) {
            return { hit: true, type: 'line' };
        }

        return null;
    }

    autoscaleInfo(): AutoscaleInfo | null {
        return null;
    }

    updateAllViews(): void {
        this._paneViews.forEach(pw => pw.update());
    }

    paneViews(): HorizontalRayPaneView[] {
        return this._paneViews;
    }
}
