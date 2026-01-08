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

class TextPaneRenderer implements IPrimitivePaneRenderer {
    private readonly _point: ViewPoint;
    private readonly _text: string;
    private readonly _options: TextOptions;
    private readonly _selected: boolean;

    constructor(
        point: ViewPoint,
        text: string,
        options: TextOptions,
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

            // Draw text
            ctx.font = `${this._options.fontSize}px ${this._options.fontFamily}`;
            ctx.fillStyle = this._options.color;
            ctx.textBaseline = 'middle';
            ctx.fillText(this._text, x, y);

            // Draw anchor when selected
            if (this._selected) {
                ctx.fillStyle = '#FFFFFF';
                ctx.strokeStyle = '#2962FF';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
            }
        });
    }
}

class TextPaneView implements IPrimitivePaneView {
    private readonly _source: Text;
    private _point: ViewPoint = { x: null, y: null };

    constructor(source: Text) {
        this._source = source;
    }

    update(): void {
        this._point = pointToCoordinate(
            this._source._point,
            this._source._chart,
            this._source._series
        );
    }

    renderer(): TextPaneRenderer {
        return new TextPaneRenderer(
            this._point,
            this._source._text,
            this._source._options,
            this._source._selected
        );
    }
}

export interface TextOptions {
    color: string;
    fontSize: number;
    fontFamily: string;
    locked?: boolean;
}

const defaultOptions: TextOptions = {
    color: 'rgb(0, 0, 0)',
    fontSize: 14,
    fontFamily: 'Arial',
    locked: false,
};

export class Text implements ISeriesPrimitive<Time> {
    readonly _chart: IChartApi;
    readonly _series: ISeriesApi<keyof SeriesOptionsMap>;
    _point: LogicalPoint;
    _text: string;
    private readonly _paneViews: TextPaneView[];
    readonly _options: TextOptions;
    _selected: boolean = false;
    _locked: boolean = false;
    _onTextEdit: ((newText: string) => void) | null = null;

    constructor(
        chart: IChartApi,
        series: ISeriesApi<SeriesType>,
        point: LogicalPoint,
        text: string,
        options?: Partial<TextOptions>
    ) {
        this._chart = chart;
        this._series = series;
        this._point = point;
        this._text = text;
        this._options = {
            ...defaultOptions,
            ...options,
        };
        this._paneViews = [new TextPaneView(this)];
    }

    /**
     * Update the position of the text
     */
    public updatePoint(point: LogicalPoint): void {
        this._point = point;
        this.updateAllViews();
    }

    /**
     * Update the text content
     */
    public updateText(text: string): void {
        this._text = text;
        this.updateAllViews();
    }

    /**
     * Set callback for text editing
     */
    public setOnTextEdit(callback: (newText: string) => void): void {
        this._onTextEdit = callback;
    }

    /**
     * Trigger text edit dialog
     */
    public editText(): void {
        if (this._onTextEdit) {
            this._onTextEdit(this._text);
        }
    }

    /**
     * Set selection state and update visuals
     */
    public setSelected(selected: boolean): void {
        this._selected = selected;
        this.updateAllViews();
    }

    public applyOptions(options: Partial<TextOptions>): void {
        Object.assign(this._options, options);
        this.updateAllViews();
        this._chart.timeScale().applyOptions({});
    }


    /**
     * Update a specific point by index
     */
    public updatePointByIndex(index: number, point: LogicalPoint): void {
        if (index === 0) {
            this._point = point;
            this.updateAllViews();
        }
    }

    /**
     * Hit test to detect clicks on text
     * @param x - Screen x coordinate
     * @param y - Screen y coordinate
     * @returns Hit test result indicating if text was clicked
     */
    public toolHitTest(x: number, y: number): HitTestResult | null {
        const timeScale = this._chart.timeScale();
        const series = this._series;

        const xCoord = timeScale.logicalToCoordinate(this._point.logical as Logical);
        const yCoord = series.priceToCoordinate(this._point.price);

        if (xCoord === null || yCoord === null) return null;

        // Approximate text bounding box
        // We don't have access to the canvas context here to measure text exactly,
        // but we can estimate based on font size and string length.
        const fontSize = this._options.fontSize;
        const charWidth = fontSize * 0.6; // Approximation
        const width = this._text.length * charWidth;
        const height = fontSize;

        // Text is drawn with textBaseline = 'middle', so y is center
        // x is start
        if (
            x >= xCoord &&
            x <= xCoord + width &&
            y >= yCoord - height / 2 &&
            y <= yCoord + height / 2
        ) {
            return { hit: true, type: 'point', index: 0 };
        }

        // Also check anchor point with small threshold
        if (Math.hypot(x - xCoord, y - yCoord) < 8) {
            return { hit: true, type: 'point', index: 0 };
        }

        return null;
    }

    updateAllViews(): void {
        this._paneViews.forEach(pw => pw.update());
    }

    paneViews(): TextPaneView[] {
        return this._paneViews;
    }
}
