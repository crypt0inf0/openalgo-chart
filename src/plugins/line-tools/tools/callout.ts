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
    distanceToSegment,
} from './base-types';

class CalloutPaneRenderer implements IPrimitivePaneRenderer {
    private readonly _p1: ViewPoint;
    private readonly _p2: ViewPoint;
    private readonly _text: string;
    private readonly _options: CalloutOptions;
    private readonly _selected: boolean;

    constructor(
        p1: ViewPoint,
        p2: ViewPoint,
        text: string,
        options: CalloutOptions,
        selected: boolean
    ) {
        this._p1 = p1;
        this._p2 = p2;
        this._text = text;
        this._options = options;
        this._selected = selected;
    }

    draw(target: CanvasRenderingTarget2D): void {
        target.useMediaCoordinateSpace(scope => {
            if (this._p1.x === null || this._p1.y === null || this._p2.x === null || this._p2.y === null)
                return;

            const ctx = scope.context;

            const x1 = this._p1.x;
            const y1 = this._p1.y;
            const x2 = this._p2.x;
            const y2 = this._p2.y;

            // Draw line from anchor point to text box
            ctx.lineWidth = this._options.width;
            ctx.strokeStyle = this._options.lineColor;
            ctx.fillStyle = this._options.lineColor;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            // Draw circle at p1 (anchor point)
            ctx.beginPath();
            ctx.arc(x1, y1, 3, 0, 2 * Math.PI);
            ctx.fill();

            // Draw text box at p2 with rounded corners
            ctx.font = `${this._options.fontSize}px ${this._options.fontFamily}`;
            const textMetrics = ctx.measureText(this._text);
            const textWidth = textMetrics.width;
            const textHeight = this._options.fontSize * 1.2;
            const padding = 8;
            const borderRadius = 6;

            const boxX = x2;
            const boxY = y2 - textHeight / 2;
            const boxWidth = textWidth + padding * 2;
            const boxHeight = textHeight + padding * 2;

            // Draw rounded rectangle for background
            ctx.fillStyle = this._options.backgroundColor;
            ctx.beginPath();
            ctx.moveTo(boxX + borderRadius, boxY - padding);
            ctx.lineTo(boxX + boxWidth - borderRadius, boxY - padding);
            ctx.arcTo(boxX + boxWidth, boxY - padding, boxX + boxWidth, boxY - padding + borderRadius, borderRadius);
            ctx.lineTo(boxX + boxWidth, boxY - padding + boxHeight - borderRadius);
            ctx.arcTo(boxX + boxWidth, boxY - padding + boxHeight, boxX + boxWidth - borderRadius, boxY - padding + boxHeight, borderRadius);
            ctx.lineTo(boxX + borderRadius, boxY - padding + boxHeight);
            ctx.arcTo(boxX, boxY - padding + boxHeight, boxX, boxY - padding + boxHeight - borderRadius, borderRadius);
            ctx.lineTo(boxX, boxY - padding + borderRadius);
            ctx.arcTo(boxX, boxY - padding, boxX + borderRadius, boxY - padding, borderRadius);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = this._options.textColor;
            ctx.textBaseline = 'middle';
            ctx.fillText(this._text, boxX + padding, boxY + textHeight / 2);

            // Draw anchors when selected
            if (this._selected) {
                ctx.fillStyle = '#FFFFFF';
                ctx.strokeStyle = '#2962FF';
                ctx.lineWidth = 2;

                // Anchor point
                ctx.beginPath();
                ctx.arc(x1, y1, 6, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();

                // Text box point
                ctx.beginPath();
                ctx.arc(x2, y2, 6, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
            }
        });
    }
}

class CalloutPaneView implements IPrimitivePaneView {
    private readonly _source: Callout;
    private _p1: ViewPoint = { x: null, y: null };
    private _p2: ViewPoint = { x: null, y: null };

    constructor(source: Callout) {
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

    renderer(): CalloutPaneRenderer {
        return new CalloutPaneRenderer(
            this._p1,
            this._p2,
            this._source._text,
            this._source._options,
            this._source._selected
        );
    }
}

export interface CalloutOptions {
    lineColor: string;
    backgroundColor: string;
    textColor: string;
    width: number;
    fontSize: number;
    fontFamily: string;
}

const defaultOptions: CalloutOptions = {
    lineColor: 'rgb(33, 150, 243)',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    textColor: 'rgb(0, 0, 0)',
    width: 1,
    fontSize: 12,
    fontFamily: 'Arial',
};

export class Callout implements ISeriesPrimitive<Time> {
    readonly _chart: IChartApi;
    readonly _series: ISeriesApi<keyof SeriesOptionsMap>;
    _p1: LogicalPoint; // Anchor point
    _p2: LogicalPoint; // Text box point
    _text: string;
    private readonly _paneViews: CalloutPaneView[];
    readonly _options: CalloutOptions;
    _selected: boolean = false;
    _onTextEdit: ((newText: string) => void) | null = null;

    constructor(
        chart: IChartApi,
        series: ISeriesApi<SeriesType>,
        p1: LogicalPoint,
        p2: LogicalPoint,
        text: string,
        options?: Partial<CalloutOptions>
    ) {
        this._chart = chart;
        this._series = series;
        this._p1 = p1;
        this._p2 = p2;
        this._text = text;
        this._options = {
            ...defaultOptions,
            ...options,
        };
        this._paneViews = [new CalloutPaneView(this)];
    }

    /**
     * Update both points
     */
    public updatePoints(p1: LogicalPoint, p2: LogicalPoint): void {
        this._p1 = p1;
        this._p2 = p2;
        this.updateAllViews();
    }

    /**
     * Update a specific point by index
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

    public applyOptions(options: Partial<CalloutOptions>): void {
        Object.assign(this._options, options);
        this.updateAllViews();
        this._chart.timeScale().applyOptions({});
    }

    /**
     * Hit test to detect clicks on anchor points or line
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

        // Check anchor points
        const threshold = 8;
        if (Math.hypot(x - x1, y - y1) < threshold) {
            return { hit: true, type: 'point', index: 0 };
        }
        if (Math.hypot(x - x2, y - y2) < threshold) {
            return { hit: true, type: 'point', index: 1 };
        }

        // Check text box (approximate)
        const fontSize = this._options.fontSize;
        const estimatedWidth = this._text.length * fontSize * 0.6 + 20; // Approximate width + padding
        const estimatedHeight = fontSize * 1.2 + 10; // Height + padding

        // Text box is drawn starting at x2, centered vertically on y2
        if (x >= x2 && x <= x2 + estimatedWidth &&
            y >= y2 - estimatedHeight / 2 && y <= y2 + estimatedHeight / 2) {
            return { hit: true, type: 'point', index: 1 }; // Treat as dragging the text box point
        }

        // Check line
        const dist = distanceToSegment({ x, y }, { x: x1, y: y1 }, { x: x2, y: y2 });
        if (dist < 5) {
            return { hit: true, type: 'line' };
        }

        return null;
    }

    updateAllViews(): void {
        this._paneViews.forEach(pw => pw.update());
    }

    paneViews(): CalloutPaneView[] {
        return this._paneViews;
    }
}
