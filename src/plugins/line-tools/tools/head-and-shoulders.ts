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
    LogicalPoint,
    ViewPoint,
    pointsToCoordinates,
    setupLineStyle,
    resetCanvasState,
    scaleCoordinate,
    distanceToSegment,
    HitTestResult,
    drawAnchor,
} from './base-types';

class HeadAndShouldersPaneRenderer implements IPrimitivePaneRenderer {
    _points: ViewPoint[];
    _options: HeadAndShouldersOptions;
    _selected: boolean;

    constructor(points: ViewPoint[], options: HeadAndShouldersOptions, selected: boolean) {
        this._points = points;
        this._options = options;
        this._selected = selected;
    }

    draw(target: CanvasRenderingTarget2D) {
        target.useBitmapCoordinateSpace(scope => {
            if (this._points.length < 2) {
                return;
            }

            const ctx = scope.context;

            // Convert points to pixel coordinates
            const pixelPoints: Array<{ x: number, y: number }> = [];
            for (const point of this._points) {
                if (point.x === null || point.y === null) continue;
                pixelPoints.push({
                    x: scaleCoordinate(point.x, scope.horizontalPixelRatio),
                    y: scaleCoordinate(point.y, scope.verticalPixelRatio)
                });
            }

            if (pixelPoints.length < 2) return;

            // Draw filled area under head (points 2, 3, 4) if we have enough points
            if (pixelPoints.length >= 5) {
                const p2 = pixelPoints[2]; // Left trough
                const p3 = pixelPoints[3]; // Head
                const p4 = pixelPoints[4]; // Right trough

                ctx.beginPath();
                ctx.moveTo(p2.x, p2.y);
                ctx.lineTo(p3.x, p3.y);
                ctx.lineTo(p4.x, p4.y);
                ctx.closePath();
                ctx.fillStyle = this._options.fillColor;
                ctx.fill();
            }

            // Draw main lines connecting all points
            setupLineStyle(ctx, {
                lineColor: this._options.lineColor,
                width: this._options.width,
                lineJoin: 'round',
                lineCap: 'round',
                globalAlpha: 1.0,
            });

            ctx.beginPath();
            ctx.moveTo(pixelPoints[0].x, pixelPoints[0].y);
            for (let i = 1; i < pixelPoints.length; i++) {
                ctx.lineTo(pixelPoints[i].x, pixelPoints[i].y);
            }
            ctx.stroke();

            // Draw neckline (dotted line through points 2 and 4) if we have enough points
            if (pixelPoints.length >= 5) {
                const p2 = pixelPoints[2]; // Left trough
                const p4 = pixelPoints[4]; // Right trough

                // Calculate slope for extension
                const slope = (p4.y - p2.y) / (p4.x - p2.x);
                const extendAmount = 500; // Extend by 500 pixels each direction

                const leftX = p2.x - extendAmount;
                const leftY = p2.y - slope * extendAmount;
                const rightX = p4.x + extendAmount;
                const rightY = p4.y + slope * extendAmount;

                ctx.save();
                ctx.setLineDash([5, 5]);
                ctx.strokeStyle = this._options.lineColor;
                ctx.lineWidth = 1 * scope.verticalPixelRatio;
                ctx.beginPath();
                ctx.moveTo(leftX, leftY);
                ctx.lineTo(rightX, rightY);
                ctx.stroke();
                ctx.restore();
            }

            // Draw labels
            ctx.font = `bold ${11 * scope.verticalPixelRatio}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';

            const labels: { index: number, label: string }[] = [
                { index: 1, label: 'Left Shoulder' },
                { index: 3, label: 'Head' },
                { index: 5, label: 'Right Shoulder' },
            ];

            for (const { index, label } of labels) {
                if (index >= pixelPoints.length) continue;

                const point = pixelPoints[index];
                const padding = 6 * scope.verticalPixelRatio;
                const textWidth = ctx.measureText(label).width;
                const boxWidth = textWidth + padding * 2;
                const boxHeight = 18 * scope.verticalPixelRatio;
                const boxX = point.x - boxWidth / 2;
                const boxY = point.y - boxHeight - 10 * scope.verticalPixelRatio;

                // Draw label background
                ctx.fillStyle = this._options.labelBackground;
                ctx.beginPath();
                ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 3 * scope.verticalPixelRatio);
                ctx.fill();

                // Draw label text
                ctx.fillStyle = this._options.labelTextColor;
                ctx.textBaseline = 'middle';
                ctx.fillText(label, point.x, boxY + boxHeight / 2);
            }

            // Draw anchors if selected
            if (this._selected) {
                for (const point of pixelPoints) {
                    drawAnchor(scope, point.x, point.y);
                }
            }

            resetCanvasState(ctx);
        });
    }
}

class HeadAndShouldersPaneView implements IPrimitivePaneView {
    _source: HeadAndShoulders;
    _points: ViewPoint[] = [];

    constructor(source: HeadAndShoulders) {
        this._source = source;
    }

    update() {
        this._points = pointsToCoordinates(
            this._source._points,
            this._source._chart,
            this._source._series
        );
    }

    renderer() {
        return new HeadAndShouldersPaneRenderer(this._points, this._source._options, this._source._selected);
    }
}

export interface HeadAndShouldersOptions {
    lineColor: string;
    width: number;
    fillColor: string;
    labelBackground: string;
    labelTextColor: string;
}

const defaultOptions: HeadAndShouldersOptions = {
    lineColor: '#089981',
    width: 2,
    fillColor: 'rgba(8, 153, 129, 0.2)',
    labelBackground: '#089981',
    labelTextColor: '#ffffff',
};

export class HeadAndShoulders implements ISeriesPrimitive<Time> {
    _chart: IChartApi;
    _series: ISeriesApi<keyof SeriesOptionsMap>;
    _points: LogicalPoint[];
    _paneViews: HeadAndShouldersPaneView[];
    _options: HeadAndShouldersOptions;
    _selected: boolean = false;

    constructor(
        chart: IChartApi,
        series: ISeriesApi<SeriesType>,
        points: LogicalPoint[],
        options?: Partial<HeadAndShouldersOptions>
    ) {
        this._chart = chart;
        this._series = series;
        this._points = points;
        this._options = {
            ...defaultOptions,
            ...options,
        };
        this._paneViews = [new HeadAndShouldersPaneView(this)];
    }

    public updatePoints(points: LogicalPoint[]) {
        this._points = points;
        this.updateAllViews();
    }

    public addPoint(point: LogicalPoint) {
        this._points.push(point);
        this.updateAllViews();
    }

    public setSelected(selected: boolean) {
        this._selected = selected;
        this.updateAllViews();
    }

    public updatePointByIndex(index: number, point: LogicalPoint) {
        if (index >= 0 && index < this._points.length) {
            this._points[index] = point;
            this.updateAllViews();
        }
    }

    public applyOptions(options: Partial<HeadAndShouldersOptions>): void {
        Object.assign(this._options, options);
        this.updateAllViews();
        this._chart.timeScale().applyOptions({});
    }

    public toolHitTest(x: number, y: number): HitTestResult | null {
        const timeScale = this._chart.timeScale();
        const series = this._series;

        const screenPoints = this._points.map(p => {
            const xCoord = timeScale.logicalToCoordinate(p.logical as Logical);
            const yCoord = series.priceToCoordinate(p.price);
            return { x: xCoord, y: yCoord };
        });

        // Check points (anchors)
        const threshold = 8;
        for (let i = 0; i < screenPoints.length; i++) {
            const p = screenPoints[i];
            if (p.x === null || p.y === null) continue;

            if (Math.hypot(x - p.x, y - p.y) < threshold) {
                return { hit: true, type: 'point', index: i };
            }
        }

        // Check line segments
        const lineThreshold = 5;
        for (let i = 0; i < screenPoints.length - 1; i++) {
            const p1 = screenPoints[i];
            const p2 = screenPoints[i + 1];

            if (p1.x === null || p1.y === null || p2.x === null || p2.y === null) continue;

            const dist = distanceToSegment({ x, y }, p1 as { x: number, y: number }, p2 as { x: number, y: number });
            if (dist < lineThreshold) {
                return { hit: true, type: 'line' };
            }
        }

        return null;
    }

    updateAllViews() {
        this._paneViews.forEach(pw => pw.update());
    }

    paneViews() {
        return this._paneViews;
    }
}
