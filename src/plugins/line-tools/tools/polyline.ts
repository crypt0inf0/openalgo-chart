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

/**
 * Unified polyline renderer
 * Handles Brush, Highlighter, and Path rendering with different styles
 */
class PolylinePaneRenderer implements IPrimitivePaneRenderer {
    _points: ViewPoint[];
    _options: PolylineOptions;
    _selected: boolean;

    constructor(points: ViewPoint[], options: PolylineOptions, selected: boolean) {
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
                globalAlpha: this._options.opacity,
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

            ctx.beginPath();
            ctx.moveTo(pixelPoints[0].x, pixelPoints[0].y);

            if (pixelPoints.length === 2) {
                ctx.lineTo(pixelPoints[1].x, pixelPoints[1].y);
            } else if (this._options.useSmoothCurve === false) {
                // Path tool: use straight lines connecting points
                for (let i = 1; i < pixelPoints.length; i++) {
                    ctx.lineTo(pixelPoints[i].x, pixelPoints[i].y);
                }
            } else {
                // Brush/Highlighter: Quadratic Bezier Midpoint Algorithm
                // This creates a very smooth curve by using the points as control points
                // and the midpoints between them as the start/end points of the curves.

                // Move to the first point
                ctx.moveTo(pixelPoints[0].x, pixelPoints[0].y);

                let i = 1;
                for (; i < pixelPoints.length - 2; i++) {
                    const xc = (pixelPoints[i].x + pixelPoints[i + 1].x) / 2;
                    const yc = (pixelPoints[i].y + pixelPoints[i + 1].y) / 2;
                    ctx.quadraticCurveTo(pixelPoints[i].x, pixelPoints[i].y, xc, yc);
                }

                // Curve through the last two points
                ctx.quadraticCurveTo(
                    pixelPoints[i].x,
                    pixelPoints[i].y,
                    pixelPoints[i + 1].x,
                    pixelPoints[i + 1].y
                );
            }

            ctx.stroke();

            // Draw anchors if selected and not smooth curve (Path tool)
            if (this._selected && !this._options.useSmoothCurve) {
                for (const point of pixelPoints) {
                    drawAnchor(scope, point.x, point.y);
                }
            }

            resetCanvasState(ctx);
        });
    }
}

class PolylinePaneView implements IPrimitivePaneView {
    _source: Polyline;
    _points: ViewPoint[] = [];

    constructor(source: Polyline) {
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
        return new PolylinePaneRenderer(this._points, this._source._options, this._source._selected);
    }
}

export interface PolylineOptions {
    lineColor: string;
    width: number;
    opacity: number;
    useSmoothCurve?: boolean; // If false, uses straight lines; if true or undefined, uses Bezier curves
    locked?: boolean;
}

// Preset configurations for different variants
export const PolylinePresets = {
    brush: {
        lineColor: 'rgba(0, 0, 0, 0.8)',
        width: 2,
        opacity: 1.0,
        useSmoothCurve: true, // Smooth curves for brush strokes
    } as PolylineOptions,
    highlighter: {
        lineColor: 'rgba(255, 235, 59, 0.6)',
        width: 20,
        opacity: 0.6,
        useSmoothCurve: true, // Smooth curves for highlighter
    } as PolylineOptions,
    path: {
        lineColor: 'rgba(33, 150, 243, 1)',
        width: 2,
        opacity: 1.0,
        useSmoothCurve: false, // Straight lines for path tool
    } as PolylineOptions,
};

const defaultOptions: PolylineOptions = {
    lineColor: 'rgba(0, 0, 0, 0.8)',
    width: 2,
    opacity: 1.0,
    useSmoothCurve: true,
    locked: false,
};

/**
 * Unified Polyline tool (replaces Brush, Highlighter, and Path)
 * Use PolylinePresets for variant-specific defaults
 */
export class Polyline implements ISeriesPrimitive<Time> {
    _chart: IChartApi;
    _series: ISeriesApi<keyof SeriesOptionsMap>;
    _points: LogicalPoint[];
    _paneViews: PolylinePaneView[];
    _options: PolylineOptions;

    _selected: boolean = false;
    _locked: boolean = false;

    constructor(
        chart: IChartApi,
        series: ISeriesApi<SeriesType>,
        points: LogicalPoint[],
        options?: Partial<PolylineOptions>
    ) {
        this._chart = chart;
        this._series = series;
        this._points = points;
        this._options = {
            ...defaultOptions,
            ...options,
        };
        this._paneViews = [new PolylinePaneView(this)];
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

    public applyOptions(options: Partial<PolylineOptions>): void {
        Object.assign(this._options, options);
        this.updateAllViews();
        this._chart.timeScale().applyOptions({});
    }

    public updatePointByIndex(index: number, point: LogicalPoint) {
        if (index >= 0 && index < this._points.length) {
            this._points[index] = point;
            this.updateAllViews();
        }
    }

    public toolHitTest(x: number, y: number): HitTestResult | null {
        const timeScale = this._chart.timeScale();
        const series = this._series;

        // Convert all points to screen coordinates
        const screenPoints = this._points.map(p => {
            const xCoord = timeScale.logicalToCoordinate(p.logical as import('lightweight-charts').Logical);
            const yCoord = series.priceToCoordinate(p.price);
            return { x: xCoord, y: yCoord };
        });

        // Check points (anchors)
        // Only show/hit anchors for Path tool (not smooth curves like Brush)
        if (!this._options.useSmoothCurve) {
            const threshold = 8;
            for (let i = 0; i < screenPoints.length; i++) {
                const p = screenPoints[i];
                if (p.x === null || p.y === null) continue;

                if (Math.hypot(x - p.x, y - p.y) < threshold) {
                    return { hit: true, type: 'point', index: i };
                }
            }
        }

        // Check line segments
        // For smooth curves this is an approximation, but for Path it's exact
        // Use a threshold based on line width to ensure thicker lines (Highlighter) are clickable
        const lineThreshold = Math.max(5, (this._options.width / 2) + 2);
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

// Re-export LogicalPoint for backward compatibility
export type { LogicalPoint } from './base-types';

// Export legacy names for backward compatibility
export { Polyline as Brush };
export { Polyline as Highlighter };
export { Polyline as Path };

// Export options types with legacy names
export type BrushOptions = PolylineOptions;
export type HighlighterOptions = PolylineOptions;
export type PathOptions = PolylineOptions;
