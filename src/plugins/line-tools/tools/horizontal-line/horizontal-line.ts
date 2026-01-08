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
    AutoscaleInfo,
} from 'lightweight-charts';
import {
    HitTestResult,
    scaleCoordinate,
    drawAnchor,
    setLineStyle,
} from './utils';

class HorizontalLinePaneRenderer implements IPrimitivePaneRenderer {
    private readonly _y: number | null;
    private readonly _options: HorizontalLineOptions;
    private readonly _selected: boolean;

    constructor(y: number | null, options: HorizontalLineOptions, selected: boolean) {
        this._y = y;
        this._options = options;
        this._selected = selected;
    }

    draw(target: CanvasRenderingTarget2D): void {
        target.useBitmapCoordinateSpace(scope => {
            if (this._y === null) return;

            const ctx = scope.context;
            const yScaled = scaleCoordinate(this._y, scope.verticalPixelRatio);
            const width = scope.mediaSize.width * scope.horizontalPixelRatio;

            // Draw line
            ctx.lineWidth = this._options.width;
            ctx.strokeStyle = this._options.lineColor;
            setLineStyle(ctx, this._options.lineStyle);
            ctx.beginPath();
            ctx.moveTo(0, yScaled);
            ctx.lineTo(width, yScaled);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw anchor when selected (on right edge)
            if (this._selected) {
                drawAnchor(scope, width - 30 * scope.horizontalPixelRatio, yScaled);
            }
        });
    }
}

class HorizontalLinePaneView implements IPrimitivePaneView {
    private readonly _source: HorizontalLine;
    private _y: number | null = null;

    constructor(source: HorizontalLine) {
        this._source = source;
    }

    update(): void {
        this._y = this._source._series.priceToCoordinate(this._source._price);
    }

    renderer(): HorizontalLinePaneRenderer {
        return new HorizontalLinePaneRenderer(
            this._y,
            this._source._options,
            this._source._selected
        );
    }
}

export interface HorizontalLineOptions {
    lineColor: string;
    width: number;
    lineStyle: number;
    locked?: boolean;
}

const defaultOptions: HorizontalLineOptions = {
    lineColor: '#2962FF',
    width: 2,
    lineStyle: 0,
    locked: false,
};

export class HorizontalLine implements ISeriesPrimitive<Time> {
    readonly _chart: IChartApi;
    readonly _series: ISeriesApi<keyof SeriesOptionsMap>;
    _price: number;
    private readonly _paneViews: HorizontalLinePaneView[];
    readonly _options: HorizontalLineOptions;
    _selected: boolean = false;
    _locked: boolean = false;

    constructor(
        chart: IChartApi,
        series: ISeriesApi<SeriesType>,
        price: number,
        options?: Partial<HorizontalLineOptions>
    ) {
        this._chart = chart;
        this._series = series;
        this._price = price;
        this._options = {
            ...defaultOptions,
            ...options,
        };
        this._paneViews = [new HorizontalLinePaneView(this)];
    }

    /**
     * Update the price level of the horizontal line
     */
    public updatePrice(price: number): void {
        this._price = price;
        this.updateAllViews();
    }

    public applyOptions(options: Partial<HorizontalLineOptions>): void {
        Object.assign(this._options, options);
        this.updateAllViews();
        this._chart.timeScale().applyOptions({});
    }

    /**
     * Update a specific anchor point by index (used for dragging)
     * For horizontal line, only index 0 exists and updates the price
     */
    public updatePointByIndex(index: number, point: { logical: number, price: number }): void {
        if (index === 0) {
            this._price = point.price;
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
     * Hit test to detect clicks on the horizontal line
     * @param _x - Screen x coordinate (unused)
     * @param y - Screen y coordinate
     * @returns Hit test result indicating if line was hit
     */
    public toolHitTest(x: number, y: number): HitTestResult | null {
        const yCoord = this._series.priceToCoordinate(this._price);
        if (yCoord === null) return null;

        // Check anchor point (at right edge)
        const chartElement = (this._chart as any).chartElement?.();
        const width = chartElement?.clientWidth || window.innerWidth;
        const anchorX = width - 30; // Matches renderer logic

        const threshold = 8;
        if (Math.hypot(x - anchorX, y - yCoord) < threshold) {
            return { hit: true, type: 'point', index: 0 };
        }

        // Check if click is near the horizontal line
        if (Math.abs(y - yCoord) < 5) {
            return { hit: true, type: 'line' };
        }

        return null;
    }

    autoscaleInfo(_startTimePoint: Logical, _endTimePoint: Logical): AutoscaleInfo | null {
        return null;
    }

    updateAllViews(): void {
        this._paneViews.forEach(pw => pw.update());
    }

    paneViews(): HorizontalLinePaneView[] {
        if ((this as any)._hiddenByVisibility) {
            return [];
        }
        return this._paneViews;
    }
}
