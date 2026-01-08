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

class ParallelChannelPaneRenderer implements IPrimitivePaneRenderer {
    private readonly _p1: ViewPoint;
    private readonly _p2: ViewPoint;
    private readonly _p3: ViewPoint;
    private readonly _options: ParallelChannelOptions;
    private readonly _selected: boolean;

    constructor(
        p1: ViewPoint,
        p2: ViewPoint,
        p3: ViewPoint,
        options: ParallelChannelOptions,
        selected: boolean
    ) {
        this._p1 = p1;
        this._p2 = p2;
        this._p3 = p3;
        this._options = options;
        this._selected = selected;
    }

    draw(target: CanvasRenderingTarget2D): void {
        target.useBitmapCoordinateSpace(scope => {
            if (
                this._p1.x === null ||
                this._p1.y === null ||
                this._p2.x === null ||
                this._p2.y === null ||
                this._p3.x === null ||
                this._p3.y === null
            )
                return;

            const ctx = scope.context;

            const x1 = scaleCoordinate(this._p1.x, scope.horizontalPixelRatio);
            const y1 = scaleCoordinate(this._p1.y, scope.verticalPixelRatio);
            const x2 = scaleCoordinate(this._p2.x, scope.horizontalPixelRatio);
            const y2 = scaleCoordinate(this._p2.y, scope.verticalPixelRatio);
            const x3 = scaleCoordinate(this._p3.x, scope.horizontalPixelRatio);
            const y3 = scaleCoordinate(this._p3.y, scope.verticalPixelRatio);

            // P1-P2 is the Top Edge
            const x1_top = x1;
            const y1_top = y1;
            const x2_top = x2;
            const y2_top = y2;

            // Calculate vertical offset for Bottom Edge
            let verticalOffset = 0;
            if (x2 !== x1) {
                const m = (y2 - y1) / (x2 - x1);
                const y_projected = y1 + m * (x3 - x1);
                verticalOffset = y3 - y_projected;
            }

            // Bottom Edge coordinates
            const y1_bot = y1 + verticalOffset;
            const y2_bot = y2 + verticalOffset;
            const x1_bot = x1;
            const x2_bot = x2;

            // Middle line coordinates
            const y1_mid = y1 + verticalOffset / 2;
            const y2_mid = y2 + verticalOffset / 2;

            ctx.lineWidth = this._options.width;
            ctx.strokeStyle = this._options.lineColor;
            ctx.fillStyle = this._options.backgroundColor;
            setLineStyle(ctx, this._options.lineStyle);

            // Draw Channel Background
            ctx.beginPath();
            ctx.moveTo(x1_top, y1_top);
            ctx.lineTo(x2_top, y2_top);
            ctx.lineTo(x2_bot, y2_bot);
            ctx.lineTo(x1_bot, y1_bot);
            ctx.closePath();
            ctx.fill();

            // Draw Top Edge
            ctx.beginPath();
            ctx.moveTo(x1_top, y1_top);
            ctx.lineTo(x2_top, y2_top);
            ctx.stroke();

            // Draw Bottom Edge
            ctx.beginPath();
            ctx.moveTo(x1_bot, y1_bot);
            ctx.lineTo(x2_bot, y2_bot);
            ctx.stroke();

            // Draw Vertical Connectors
            ctx.beginPath();
            ctx.moveTo(x1_top, y1_top);
            ctx.lineTo(x1_bot, y1_bot);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x2_top, y2_top);
            ctx.lineTo(x2_bot, y2_bot);
            ctx.stroke();

            // Draw Center Line (Dashed)
            if (this._options.showMiddle) {
                ctx.setLineDash([5 * scope.horizontalPixelRatio, 5 * scope.horizontalPixelRatio]);
                ctx.beginPath();
                ctx.moveTo(x1, y1_mid);
                ctx.lineTo(x2, y2_mid);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Draw anchors when selected
            if (this._selected) {
                drawAnchor(scope, x1_top, y1_top);
                drawAnchor(scope, x2_top, y2_top);
                drawAnchor(scope, x1_bot, y1_bot);
                drawAnchor(scope, x2_bot, y2_bot);
            }
        });
    }
}

class ParallelChannelPaneView implements IPrimitivePaneView {
    private readonly _source: ParallelChannel;
    private _p1: ViewPoint = { x: null, y: null };
    private _p2: ViewPoint = { x: null, y: null };
    private _p3: ViewPoint = { x: null, y: null };

    constructor(source: ParallelChannel) {
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

    renderer(): ParallelChannelPaneRenderer {
        return new ParallelChannelPaneRenderer(
            this._p1,
            this._p2,
            this._p3,
            this._source._options,
            this._source._selected
        );
    }
}

export interface ParallelChannelOptions {
    lineColor: string;
    backgroundColor: string;
    width: number;
    lineStyle: number;
    showMiddle: boolean;
    locked?: boolean;
}

const defaultOptions: ParallelChannelOptions = {
    lineColor: 'rgb(33, 150, 243)',
    backgroundColor: 'rgba(33, 150, 243, 0.2)',
    width: 1,
    lineStyle: 0,
    showMiddle: true,
    locked: false,
};

export class ParallelChannel implements ISeriesPrimitive<Time> {
    readonly _chart: IChartApi;
    readonly _series: ISeriesApi<keyof SeriesOptionsMap>;
    _p1: LogicalPoint;
    _p2: LogicalPoint;
    _p3: LogicalPoint;
    private readonly _paneViews: ParallelChannelPaneView[];
    readonly _options: ParallelChannelOptions;
    _selected: boolean = false;
    _locked: boolean = false;

    constructor(
        chart: IChartApi,
        series: ISeriesApi<SeriesType>,
        p1: LogicalPoint,
        p2: LogicalPoint,
        p3: LogicalPoint,
        options?: Partial<ParallelChannelOptions>
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
        this._paneViews = [new ParallelChannelPaneView(this)];
    }

    /**
     * Update all three points of the channel
     */
    public updatePoints(p1: LogicalPoint, p2: LogicalPoint, p3: LogicalPoint): void {
        this._p1 = p1;
        this._p2 = p2;
        this._p3 = p3;
        this.updateAllViews();
    }

    /**
     * Update a single point by index
     * @param index - 0 for p1, 1 for p2, 2 for p3
     * @param point - New logical point
     */
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

    /**
     * Set selection state and update visuals
     */
    public setSelected(selected: boolean): void {
        this._selected = selected;
        this.updateAllViews();
    }

    public applyOptions(options: Partial<ParallelChannelOptions>): void {
        Object.assign(this._options, options);
        this.updateAllViews();
        this._chart.timeScale().applyOptions({});
    }

    /**
     * Hit test to detect clicks on anchors or inside channel
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
        const x3 = timeScale.logicalToCoordinate(this._p3.logical as Logical);
        const y3 = series.priceToCoordinate(this._p3.price);

        if (
            x1 === null ||
            y1 === null ||
            x2 === null ||
            y2 === null ||
            x3 === null ||
            y3 === null
        )
            return null;

        // Calculate channel corners
        let verticalOffset = 0;
        if (x2 !== x1) {
            const m = (y2 - y1) / (x2 - x1);
            const y_projected = y1 + m * (x3 - x1);
            verticalOffset = y3 - y_projected;
        } else {
            // Vertical line case: offset is just y difference since x is constant
            // However, for a vertical channel, "parallel" means shifted in X, not Y.
            // But the current implementation seems to assume Y-shift for "parallel" lines.
            // If x1 === x2, the slope is infinite.
            // Let's assume for vertical lines, we use the X difference as the width/offset?
            // Or if we stick to the current logic where p3 defines a vertical offset:
            // If x1 === x2, the projection of p3 onto the line x=x1 is (x1, y3).
            // So the offset is 0 if we project strictly.
            // But usually parallel channel on vertical line means shifting horizontally.
            // Given the current implementation uses verticalOffset added to Y, it supports slanted channels.
            // For a perfectly vertical channel, we might want to support horizontal width.
            // But to keep it simple and fix the division by zero/logic:
            verticalOffset = y3 - y1; // Fallback to simple difference
        }

        // Check anchor points (all four corners)
        const threshold = 8;
        if (Math.hypot(x - x1, y - y1) < threshold) {
            return { hit: true, type: 'point', index: 0 };
        }
        if (Math.hypot(x - x2, y - y2) < threshold) {
            return { hit: true, type: 'point', index: 1 };
        }
        if (Math.hypot(x - x1, y - (y1 + verticalOffset)) < threshold) {
            return { hit: true, type: 'point', index: 2 }; // Bottom-left (derived from p3)
        }
        if (Math.hypot(x - x2, y - (y2 + verticalOffset)) < threshold) {
            return { hit: true, type: 'point', index: 2 }; // Bottom-right (derived)
        }

        // Check if inside channel (simplified - inside the quadrilateral)
        // For now, just check if reasonably close to the channel area
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2, y1 + verticalOffset, y2 + verticalOffset);
        const maxY = Math.max(y1, y2, y1 + verticalOffset, y2 + verticalOffset);

        if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
            return { hit: true, type: 'shape' };
        }

        return null;
    }

    autoscaleInfo(): AutoscaleInfo | null {
        return null;
    }

    updateAllViews(): void {
        this._paneViews.forEach(pw => pw.update());
    }

    paneViews(): ParallelChannelPaneView[] {
        return this._paneViews;
    }
}
