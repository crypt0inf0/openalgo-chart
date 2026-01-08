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
} from './base-types';

class PriceLabelPaneRenderer implements IPrimitivePaneRenderer {
    private readonly _point: ViewPoint;
    private readonly _text: string;
    private readonly _options: PriceLabelOptions;
    private readonly _selected: boolean;

    constructor(
        point: ViewPoint,
        text: string,
        options: PriceLabelOptions,
        selected: boolean
    ) {
        this._point = point;
        this._text = text;
        this._options = options;
        this._selected = selected;
    }

    draw(target: CanvasRenderingTarget2D): void {
        target.useMediaCoordinateSpace(scope => {
            if (this._point.x === null || this._point.y === null) return;

            const ctx = scope.context;
            const x = this._point.x;
            const y = this._point.y;

            // Draw anchor circle
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.strokeStyle = this._options.backgroundColor;
            ctx.lineWidth = 1;
            ctx.stroke();

            // Label dimensions
            ctx.font = `bold ${this._options.fontSize}px ${this._options.fontFamily}`;
            const textMetrics = ctx.measureText(this._text);
            const textWidth = textMetrics.width;
            const paddingX = 8;
            const paddingY = 6;
            const textHeight = this._options.fontSize;
            const boxWidth = textWidth + paddingX * 2;
            const boxHeight = textHeight + paddingY * 2;

            // Offset label to top-right
            const offsetDist = 20;
            const boxX = x + offsetDist;
            const boxY = y - offsetDist - boxHeight;

            const radius = 4;

            ctx.fillStyle = this._options.backgroundColor;
            ctx.strokeStyle = this._options.backgroundColor;
            ctx.lineWidth = 1;

            // Draw bubble with pointer
            ctx.beginPath();
            // Start at bottom-left corner of box (excluding pointer)
            ctx.moveTo(boxX + radius, boxY + boxHeight);

            // Pointer
            // Pointing to (x + 5, y - 5) to leave space for the circle
            const pointerTipX = x + 4;
            const pointerTipY = y - 4;

            // Draw pointer from bottom-left of box
            ctx.lineTo(boxX + 10, boxY + boxHeight); // Start of pointer base on box
            ctx.lineTo(pointerTipX, pointerTipY); // Tip
            ctx.lineTo(boxX, boxY + boxHeight - 10); // End of pointer base on box

            // Left edge
            ctx.lineTo(boxX, boxY + radius);
            ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);

            // Top edge
            ctx.lineTo(boxX + boxWidth - radius, boxY);
            ctx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + radius);

            // Right edge
            ctx.lineTo(boxX + boxWidth, boxY + boxHeight - radius);
            ctx.quadraticCurveTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - radius, boxY + boxHeight);

            // Bottom edge
            ctx.lineTo(boxX + radius, boxY + boxHeight);

            ctx.fill();
            ctx.stroke();

            // Draw text
            ctx.fillStyle = this._options.textColor;
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'left';
            ctx.fillText(this._text, boxX + paddingX, boxY + boxHeight / 2);

            // Draw selection halo
            if (this._selected) {
                ctx.strokeStyle = '#2962FF';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, 2 * Math.PI);
                ctx.stroke();
            }
        });
    }
}

class PriceLabelPaneView implements IPrimitivePaneView {
    private readonly _source: PriceLabel;
    private _point: ViewPoint = { x: null, y: null };

    constructor(source: PriceLabel) {
        this._source = source;
    }

    update(): void {
        this._point = pointToCoordinate(
            this._source._point,
            this._source._chart,
            this._source._series
        );
    }

    renderer(): PriceLabelPaneRenderer {
        return new PriceLabelPaneRenderer(
            this._point,
            this._source._text,
            this._source._options,
            this._source._selected
        );
    }
}

export interface PriceLabelOptions {
    backgroundColor: string;
    textColor: string;
    fontSize: number;
    fontFamily: string;
}

const defaultOptions: PriceLabelOptions = {
    backgroundColor: '#2962FF',
    textColor: '#FFFFFF',
    fontSize: 12,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

export class PriceLabel implements ISeriesPrimitive<Time> {
    readonly _chart: IChartApi;
    readonly _series: ISeriesApi<keyof SeriesOptionsMap>;
    _point: LogicalPoint;
    _text: string;
    private readonly _paneViews: PriceLabelPaneView[];
    readonly _options: PriceLabelOptions;
    _selected: boolean = false;

    constructor(
        chart: IChartApi,
        series: ISeriesApi<SeriesType>,
        point: LogicalPoint,
        text: string,
        options?: Partial<PriceLabelOptions>
    ) {
        this._chart = chart;
        this._series = series;
        this._point = point;
        this._text = text;
        this._options = {
            ...defaultOptions,
            ...options,
        };
        this._paneViews = [new PriceLabelPaneView(this)];
    }

    public updatePoint(point: LogicalPoint): void {
        this._point = point;
        this.updateAllViews();
    }

    public updateText(text: string): void {
        this._text = text;
        this.updateAllViews();
    }

    public setSelected(selected: boolean): void {
        this._selected = selected;
        this.updateAllViews();
    }

    public applyOptions(options: Partial<PriceLabelOptions>): void {
        Object.assign(this._options, options);
        this.updateAllViews();
        this._chart.timeScale().applyOptions({});
    }

    public updatePointByIndex(index: number, point: LogicalPoint): void {
        if (index === 0) {
            this._point = point;
            this.updateAllViews();
        }
    }

    public toolHitTest(x: number, y: number): HitTestResult | null {
        const timeScale = this._chart.timeScale();
        const series = this._series;

        const xCoord = timeScale.logicalToCoordinate(this._point.logical as Logical);
        const yCoord = series.priceToCoordinate(this._point.price);

        if (xCoord === null || yCoord === null) return null;

        // Check anchor point
        if (Math.hypot(x - xCoord, y - yCoord) < 10) {
            return { hit: true, type: 'point', index: 0 };
        }

        // Check label box (approximate)
        // This is a bit harder without exact dimensions from canvas, but we can estimate
        // Box is roughly at (x+20, y-20-height)
        const offsetDist = 20;
        const height = this._options.fontSize + 12;
        const width = this._text.length * 8 + 16; // Rough estimate

        const boxX = xCoord + offsetDist;
        const boxY = yCoord - offsetDist - height;

        if (x >= boxX && x <= boxX + width && y >= boxY && y <= boxY + height) {
            return { hit: true, type: 'point', index: 0 };
        }

        return null;
    }

    updateAllViews(): void {
        this._paneViews.forEach(pw => pw.update());
    }

    paneViews(): PriceLabelPaneView[] {
        return this._paneViews;
    }
}
