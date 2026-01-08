import { BitmapCoordinatesRenderingScope } from 'fancy-canvas';
import {
    Coordinate,
    IChartApi,
    ISeriesApi,
    Logical,
    SeriesOptionsMap,
} from 'lightweight-charts';

/**
 * Logical point representation using logical index and price.
 * This is the standard coordinate system for all line tools.
 */
export interface LogicalPoint {
    logical: number;
    price: number;
}

/**
 * View point representation in screen coordinates.
 * Used internally by renderers for drawing.
 */
export interface ViewPoint {
    x: Coordinate | null;
    y: Coordinate | null;
}

/**
 * Result of a hit test operation.
 * Indicates what part of a drawing tool was clicked.
 */
export interface HitTestResult {
    hit: boolean;
    type: 'point' | 'line' | 'shape';
    index?: number; // For multi-point tools, indicates which point was hit
}

/**
 * Canvas rendering style options.
 */
export interface LineStyle {
    lineColor: string;
    width: number;
    lineJoin?: CanvasLineJoin;
    lineCap?: CanvasLineCap;
    globalAlpha?: number;
}

/**
 * Convert array of LogicalPoints to ViewPoints (screen coordinates).
 * @param points - Array of logical points to convert
 * @param chart - Chart API instance
 * @param series - Series API instance
 * @returns Array of view points with screen coordinates
 */
export function pointsToCoordinates(
    points: LogicalPoint[],
    chart: IChartApi,
    series: ISeriesApi<keyof SeriesOptionsMap>
): ViewPoint[] {
    const timeScale = chart.timeScale();
    return points.map(point => ({
        x: timeScale.logicalToCoordinate(point.logical as Logical),
        y: series.priceToCoordinate(point.price),
    }));
}

/**
 * Convert a single LogicalPoint to ViewPoint.
 * @param point - Logical point to convert
 * @param chart - Chart API instance
 * @param series - Series API instance
 * @returns View point with screen coordinates
 */
export function pointToCoordinate(
    point: LogicalPoint,
    chart: IChartApi,
    series: ISeriesApi<keyof SeriesOptionsMap>
): ViewPoint {
    const timeScale = chart.timeScale();
    return {
        x: timeScale.logicalToCoordinate(point.logical as Logical),
        y: series.priceToCoordinate(point.price),
    };
}

/**
 * Calculate the shortest distance from a point to a line segment.
 * Used for hit-testing line-based tools.
 * @param p - Point to test
 * @param v - First endpoint of line segment
 * @param w - Second endpoint of line segment
 * @returns Distance in pixels
 */
export function distanceToSegment(
    p: { x: number; y: number },
    v: { x: number; y: number },
    w: { x: number; y: number }
): number {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

/**
 * Check if a point is inside a rectangle.
 * @param p - Point to test
 * @param rect - Rectangle defined by two opposite corners
 * @returns True if point is inside rectangle
 */
export function isPointInRectangle(
    p: { x: number; y: number },
    rect: { x1: number; y1: number; x2: number; y2: number }
): boolean {
    const minX = Math.min(rect.x1, rect.x2);
    const maxX = Math.max(rect.x1, rect.x2);
    const minY = Math.min(rect.y1, rect.y2);
    const maxY = Math.max(rect.y1, rect.y2);
    return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
}

/**
 * Check if a point is inside a circle.
 * @param p - Point to test
 * @param center - Center of circle
 * @param radius - Radius of circle
 * @returns True if point is inside circle
 */
export function isPointInCircle(
    p: { x: number; y: number },
    center: { x: number; y: number },
    radius: number
): boolean {
    return Math.hypot(p.x - center.x, p.y - center.y) <= radius;
}

/**
 * Setup line style on canvas context.
 * @param ctx - Canvas rendering context
 * @param style - Line style options
 */
export function setupLineStyle(ctx: CanvasRenderingContext2D, style: LineStyle): void {
    ctx.strokeStyle = style.lineColor;
    ctx.lineWidth = style.width;
    if (style.lineJoin) ctx.lineJoin = style.lineJoin;
    if (style.lineCap) ctx.lineCap = style.lineCap;
    if (style.globalAlpha !== undefined) ctx.globalAlpha = style.globalAlpha;
}

/**
 * Reset canvas state to defaults to prevent side effects.
 * @param ctx - Canvas rendering context
 */
export function resetCanvasState(ctx: CanvasRenderingContext2D): void {
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'butt';
    ctx.globalAlpha = 1.0;
    ctx.setLineDash([]);
}

/**
 * Sets the line dash pattern based on the style index.
 * 0: Solid
 * 1: Dotted
 * 2: Dashed
 * 3: Large Dashed
 * 4: Sparse Dotted
 * @param ctx - Canvas rendering context
 * @param style - Style index (0-4)
 */
export function setLineStyle(ctx: CanvasRenderingContext2D, style: number): void {
    const dashPatterns = [
        [],             // 0: Solid
        [2, 2],         // 1: Dotted
        [6, 6],         // 2: Dashed
        [10, 10],       // 3: Large Dashed
        [2, 10],        // 4: Sparse Dotted
    ];
    const pattern = dashPatterns[style] || dashPatterns[0];
    ctx.setLineDash(pattern);
}

/**
 * Draw a selection anchor point (small circle).
 * Standard visual indicator for selected drawing tools.
 * @param scope - Bitmap coordinate scope
 * @param x - X coordinate in scaled pixels
 * @param y - Y coordinate in scaled pixels
 * @param fillColor - Fill color (default white)
 * @param strokeColor - Stroke color (default blue)
 */
export function drawAnchor(
    scope: BitmapCoordinatesRenderingScope,
    x: number,
    y: number,
    fillColor: string = '#FFFFFF',
    strokeColor: string = '#2962FF'
): void {
    const ctx = scope.context;
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 6 * scope.horizontalPixelRatio, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
}

/**
 * Scale coordinates to bitmap pixel ratio.
 * @param coord - Coordinate to scale
 * @param pixelRatio - Pixel ratio from scope
 * @returns Rounded scaled coordinate
 */
export function scaleCoordinate(coord: number, pixelRatio: number): number {
    return Math.round(coord * pixelRatio);
}
