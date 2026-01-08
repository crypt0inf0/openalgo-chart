import { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
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
    HitTestResult,
    scaleCoordinate,
    drawAnchor,
    setLineStyle,
} from './base-types';

class VerticalLinePaneRenderer implements IPrimitivePaneRenderer {
    private readonly _x: number | null;
    private readonly _text: string;
    private readonly _options: VerticalLineOptions;
    private readonly _selected: boolean;

    constructor(x: number | null, text: string, options: VerticalLineOptions, selected: boolean) {
        this._x = x;
        this._text = text;
        this._options = options;
        this._selected = selected;
    }

    draw(target: CanvasRenderingTarget2D): void {
        target.useBitmapCoordinateSpace(scope => {
            if (this._x === null) return;

            const ctx = scope.context;
            const xScaled = scaleCoordinate(this._x, scope.horizontalPixelRatio);
            const height = scope.mediaSize.height * scope.verticalPixelRatio;

            // Draw line
            ctx.lineWidth = this._options.width;
            ctx.strokeStyle = this._options.lineColor;
            setLineStyle(ctx, this._options.lineStyle);
            ctx.beginPath();
            ctx.moveTo(xScaled, 0);
            ctx.lineTo(xScaled, height);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw label
            if (this._options.showLabel && this._text) {
                this._drawTextLabel(scope, this._text, xScaled, height - 20 * scope.verticalPixelRatio);
            }

            // Draw anchor when selected (at bottom)
            if (this._selected) {
                drawAnchor(scope, xScaled, height - 30 * scope.verticalPixelRatio);
            }
        });
    }

    private _drawTextLabel(scope: BitmapCoordinatesRenderingScope, text: string, x: number, y: number): void {
        const ctx = scope.context;
        ctx.font = '12px Arial';
        ctx.beginPath();
        const padding = 4 * scope.horizontalPixelRatio;
        const textWidth = ctx.measureText(text).width;
        const height = 16 * scope.verticalPixelRatio;

        ctx.fillStyle = this._options.labelBackgroundColor;
        ctx.roundRect(x - textWidth / 2 - padding, y - height / 2, textWidth + padding * 2, height, 4);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = this._options.labelTextColor;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(text, x, y);
        ctx.textAlign = 'left'; // Reset
    }
}

class VerticalLinePaneView implements IPrimitivePaneView {
    private readonly _source: VerticalLine;
    private _x: number | null = null;

    constructor(source: VerticalLine) {
        this._source = source;
    }

    update(): void {
        const timeScale = this._source._chart.timeScale();
        this._x = timeScale.logicalToCoordinate(this._source._logical);
    }

    renderer(): VerticalLinePaneRenderer {
        return new VerticalLinePaneRenderer(
            this._x,
            '', // Could show time/date here if needed
            this._source._options,
            this._source._selected
        );
    }
}

export interface VerticalLineOptions {
    lineColor: string;
    width: number;
    lineStyle: number;
    showLabel: boolean;
    labelBackgroundColor: string;
    labelTextColor: string;
    locked?: boolean;
}

const defaultOptions: VerticalLineOptions = {
    lineColor: '#2962FF',
    width: 2,
    lineStyle: 0,
    showLabel: false, // Default to false since we don't have time text
    labelBackgroundColor: 'rgba(255, 255, 255, 0.85)',
    labelTextColor: 'rgb(0, 0, 0)',
    locked: false,
};

export class VerticalLine implements ISeriesPrimitive<Time> {
    readonly _chart: IChartApi;
    readonly _series: ISeriesApi<keyof SeriesOptionsMap>;
    _logical: Logical;
    private readonly _paneViews: VerticalLinePaneView[];
    _options: VerticalLineOptions;
    _selected: boolean = false;
    _locked: boolean = false;

    constructor(
        chart: IChartApi,
        series: ISeriesApi<SeriesType>,
        logical: Logical,
        options?: Partial<VerticalLineOptions>
    ) {
        this._chart = chart;
        this._series = series;
        this._logical = logical;
        this._options = {
            ...defaultOptions,
            ...options,
        };
        this._paneViews = [new VerticalLinePaneView(this)];
    }

    /**
     * Update the logical position of the vertical line
     */
    public updatePosition(logical: Logical): void {
        this._logical = logical;
        this.updateAllViews();
    }

    /**
     * Set selection state and update visuals
     */
    public setSelected(selected: boolean): void {
        this._selected = selected;
        this.updateAllViews();
    }

    public applyOptions(options: Partial<VerticalLineOptions>): void {
        Object.assign(this._options, options);
        this.updateAllViews();
        this._chart.timeScale().applyOptions({}); // Trigger repaint
    }

    /**
     * Update a specific anchor point by index (used for dragging)
     * For vertical line, only index 0 exists and updates the logical position
     */
    public updatePointByIndex(index: number, point: { logical: number, price: number }): void {
        if (index === 0) {
            this._logical = point.logical as Logical;
            this.updateAllViews();
        }
    }

    /**
     * Hit test to detect clicks on the vertical line
     * @param x - Screen x coordinate
     * @param _y - Screen y coordinate (unused)
     * @returns Hit test result indicating if line was hit
     */
    public toolHitTest(x: number, y: number): HitTestResult | null {
        const timeScale = this._chart.timeScale();
        const xCoord = timeScale.logicalToCoordinate(this._logical);
        if (xCoord === null) return null;

        // Check anchor point (at bottom)
        const chartElement = (this._chart as any).chartElement?.();
        const height = chartElement?.clientHeight || window.innerHeight;
        const anchorY = height - 30; // Matches renderer logic

        const threshold = 8;
        if (Math.hypot(x - xCoord, y - anchorY) < threshold) {
            return { hit: true, type: 'point', index: 0 };
        }

        // Check if click is near the vertical line
        if (Math.abs(x - xCoord) < 5) {
            return { hit: true, type: 'line' };
        }

        return null;
    }

    updateAllViews(): void {
        this._paneViews.forEach(pw => pw.update());
    }

    paneViews(): VerticalLinePaneView[] {
        if ((this as any)._hiddenByVisibility) {
            return [];
        }
        return this._paneViews;
    }
}
