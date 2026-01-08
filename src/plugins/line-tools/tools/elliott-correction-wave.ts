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

class ElliottCorrectionWavePaneRenderer implements IPrimitivePaneRenderer {
    _points: ViewPoint[];
    _options: ElliottCorrectionWaveOptions;
    _selected: boolean;

    constructor(points: ViewPoint[], options: ElliottCorrectionWaveOptions, selected: boolean) {
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

            setupLineStyle(ctx, {
                lineColor: this._options.lineColor,
                width: this._options.width,
                lineJoin: 'round',
                lineCap: 'round',
                globalAlpha: 1.0,
            });

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

            // Draw lines
            ctx.beginPath();
            ctx.moveTo(pixelPoints[0].x, pixelPoints[0].y);
            for (let i = 1; i < pixelPoints.length; i++) {
                ctx.lineTo(pixelPoints[i].x, pixelPoints[i].y);
            }
            ctx.stroke();

            // Draw labels (0, A, B, C)
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = this._options.textColor;

            const labels = ['(0)', 'A', 'B', 'C'];
            for (let i = 0; i < pixelPoints.length; i++) {
                if (i >= labels.length) break;

                const point = pixelPoints[i];
                const label = labels[i];

                // Draw label background for better visibility
                const textWidth = ctx.measureText(label).width;
                const padding = 4;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.fillRect(point.x - textWidth / 2 - padding, point.y - 12, textWidth + padding * 2, 24);

                ctx.fillStyle = this._options.textColor;
                ctx.fillText(label, point.x, point.y);
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

class ElliottCorrectionWavePaneView implements IPrimitivePaneView {
    _source: ElliottCorrectionWave;
    _points: ViewPoint[] = [];

    constructor(source: ElliottCorrectionWave) {
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
        return new ElliottCorrectionWavePaneRenderer(this._points, this._source._options, this._source._selected);
    }
}

export interface ElliottCorrectionWaveOptions {
    lineColor: string;
    width: number;
    textColor: string;
}

const defaultOptions: ElliottCorrectionWaveOptions = {
    lineColor: '#2962FF',
    width: 2,
    textColor: '#2962FF',
};

export class ElliottCorrectionWave implements ISeriesPrimitive<Time> {
    _chart: IChartApi;
    _series: ISeriesApi<keyof SeriesOptionsMap>;
    _points: LogicalPoint[];
    _paneViews: ElliottCorrectionWavePaneView[];
    _options: ElliottCorrectionWaveOptions;
    _selected: boolean = false;

    constructor(
        chart: IChartApi,
        series: ISeriesApi<SeriesType>,
        points: LogicalPoint[],
        options?: Partial<ElliottCorrectionWaveOptions>
    ) {
        this._chart = chart;
        this._series = series;
        this._points = points;
        this._options = {
            ...defaultOptions,
            ...options,
        };
        this._paneViews = [new ElliottCorrectionWavePaneView(this)];
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

    public applyOptions(options: Partial<ElliottCorrectionWaveOptions>): void {
        Object.assign(this._options, options);
        this.updateAllViews();
        this._chart.timeScale().applyOptions({});
    }

    public toolHitTest(x: number, y: number): HitTestResult | null {
        const timeScale = this._chart.timeScale();
        const series = this._series;

        const screenPoints = this._points.map(p => {
            const xCoord = timeScale.logicalToCoordinate(p.logical as import('lightweight-charts').Logical);
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
