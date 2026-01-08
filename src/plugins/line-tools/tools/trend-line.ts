import { CanvasRenderingTarget2D } from 'fancy-canvas';
import {
	AutoscaleInfo,
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
	scaleCoordinate,
	drawAnchor,
	setLineStyle,
} from './base-types';
import { Point, extendAndClipLineSegment, getArrowPoints } from './geometry';

class TrendLinePaneRenderer implements IPrimitivePaneRenderer {
	private readonly _p1: ViewPoint;
	private readonly _p2: ViewPoint;
	private readonly _options: TrendLineOptions;
	private readonly _selected: boolean;

	constructor(
		p1: ViewPoint,
		p2: ViewPoint,
		options: TrendLineOptions,
		selected: boolean
	) {
		this._p1 = p1;
		this._p2 = p2;
		this._options = options;
		this._selected = selected;
	}

	draw(target: CanvasRenderingTarget2D): void {
		target.useBitmapCoordinateSpace(scope => {
			if (
				this._p1.x === null ||
				this._p1.y === null ||
				this._p2.x === null ||
				this._p2.y === null
			)
				return;

			const ctx = scope.context;
			const x1Scaled = scaleCoordinate(this._p1.x, scope.horizontalPixelRatio);
			const y1Scaled = scaleCoordinate(this._p1.y, scope.verticalPixelRatio);
			const x2Scaled = scaleCoordinate(this._p2.x, scope.horizontalPixelRatio);
			const y2Scaled = scaleCoordinate(this._p2.y, scope.verticalPixelRatio);

			const p1 = new Point(x1Scaled, y1Scaled);
			const p2 = new Point(x2Scaled, y2Scaled);

			// Handle extensions
			const width = scope.mediaSize.width * scope.horizontalPixelRatio;
			const height = scope.mediaSize.height * scope.verticalPixelRatio;

			const segment = extendAndClipLineSegment(
				p1,
				p2,
				width,
				height,
				!!this._options.extendLeft,
				!!this._options.extendRight
			);

			if (segment) {
				ctx.lineWidth = this._options.width;
				ctx.strokeStyle = this._options.lineColor;
				ctx.lineCap = 'butt';
				setLineStyle(ctx, this._options.lineStyle || 0);
				ctx.beginPath();
				ctx.moveTo(segment[0].x, segment[0].y);
				ctx.lineTo(segment[1].x, segment[1].y);
				ctx.stroke();
				ctx.setLineDash([]);
			}

			// Draw arrows
			if (this._options.leftEnd === 1) { // Arrow
				this._drawArrow(ctx, p2, p1, this._options.width);
			}
			if (this._options.rightEnd === 1) { // Arrow
				this._drawArrow(ctx, p1, p2, this._options.width);
			}

			// Draw anchors when selected
			if (this._selected) {
				drawAnchor(scope, x1Scaled, y1Scaled);
				drawAnchor(scope, x2Scaled, y2Scaled);
			}
		});
	}

	private _drawArrow(ctx: CanvasRenderingContext2D, from: Point, to: Point, width: number) {
		const arrowPoints = getArrowPoints(from, to, width);
		if (arrowPoints.length === 0) return;

		ctx.beginPath();
		for (const [p1, p2] of arrowPoints) {
			ctx.moveTo(p1.x, p1.y);
			ctx.lineTo(p2.x, p2.y);
		}
		ctx.stroke();
	}
}

class TrendLinePaneView implements IPrimitivePaneView {
	private readonly _source: TrendLine;
	private _p1: ViewPoint = { x: null, y: null };
	private _p2: ViewPoint = { x: null, y: null };

	constructor(source: TrendLine) {
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

	renderer(): TrendLinePaneRenderer {
		return new TrendLinePaneRenderer(
			this._p1,
			this._p2,
			this._source._options,
			this._source._selected
		);
	}
}

export interface TrendLineOptions {
	lineColor: string;
	width: number;
	lineStyle?: number; // 0: Solid, 1: Dotted, 2: Dashed, 3: Large Dashed, 4: Sparse Dotted
	extendLeft?: boolean;
	extendRight?: boolean;
	leftEnd?: number; // 0: Normal, 1: Arrow
	rightEnd?: number; // 0: Normal, 1: Arrow
	locked?: boolean;
}

const defaultOptions: TrendLineOptions = {
	lineColor: 'rgb(0, 0, 0)',
	width: 2,
	lineStyle: 0,
	extendLeft: false,
	extendRight: false,
	leftEnd: 0,
	rightEnd: 0,
	locked: false,
};

export class TrendLine implements ISeriesPrimitive<Time> {
	readonly _chart: IChartApi;
	readonly _series: ISeriesApi<keyof SeriesOptionsMap>;
	_p1: LogicalPoint;
	_p2: LogicalPoint;
	private readonly _paneViews: TrendLinePaneView[];
	_options: TrendLineOptions;
	_selected: boolean = false;
	_locked: boolean = false;
	_alertId?: string;

	constructor(
		chart: IChartApi,
		series: ISeriesApi<SeriesType>,
		p1: LogicalPoint,
		p2: LogicalPoint,
		options?: Partial<TrendLineOptions>
	) {
		this._chart = chart;
		this._series = series;
		this._p1 = p1;
		this._p2 = p2;
		this._options = {
			...defaultOptions,
			...options,
		};
		this._paneViews = [new TrendLinePaneView(this)];
	}

	/**
	 * Update both points of the trend line
	 */
	public updatePoints(p1: LogicalPoint, p2: LogicalPoint): void {
		this._p1 = p1;
		this._p2 = p2;
		this.updateAllViews();
	}

	/**
	 * Update a single point by index
	 * @param index - 0 for p1, 1 for p2
	 * @param point - New logical point
	 */
	public updatePointByIndex(index: number, point: LogicalPoint): void {
		if (index === 0) {
			this._p1 = point;
		} else if (index === 1) {
			this._p2 = point;
		}
		this.updateAllViews();
	}

	public setAlertId(id: string | undefined): void {
		this._alertId = id;
	}

	public getPriceAtLogical(logical: number): number | null {
		// Basic linear interpolation
		if (this._p1.logical === null || this._p1.price === null ||
			this._p2.logical === null || this._p2.price === null) {
			return null;
		}

		if (this._p1.logical === this._p2.logical) return null; // Vertical line

		const m = (this._p2.price - this._p1.price) / (this._p2.logical - this._p1.logical);
		const price = this._p1.price + m * (logical - this._p1.logical);

		// Check extensions
		if (!this._options.extendLeft && logical < Math.min(this._p1.logical, this._p2.logical)) return null;
		if (!this._options.extendRight && logical > Math.max(this._p1.logical, this._p2.logical)) return null;

		return price;
	}

	public setSelected(selected: boolean): void {
		this._selected = selected;
		this.updateAllViews();
	}

	public applyOptions(options: Partial<TrendLineOptions>): void {
		this._options = { ...this._options, ...options };
		this.updateAllViews();
		this._chart.timeScale().applyOptions({}); // Trigger repaint
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

		// Check anchor points first (higher priority)
		const threshold = 8;
		if (Math.hypot(x - x1, y - y1) < threshold) {
			return { hit: true, type: 'point', index: 0 };
		}
		if (Math.hypot(x - x2, y - y2) < threshold) {
			return { hit: true, type: 'point', index: 1 };
		}

		// Check line
		// Use extendAndClipLineSegment logic to get the visible line segment
		const chartElement = (this._chart as any).chartElement?.();
		const width = chartElement?.clientWidth || window.innerWidth;
		const height = chartElement?.clientHeight || window.innerHeight;

		const p1 = new Point(x1, y1);
		const p2 = new Point(x2, y2);

		const segment = extendAndClipLineSegment(
			p1,
			p2,
			width,
			height,
			!!this._options.extendLeft,
			!!this._options.extendRight
		);

		if (segment) {
			const dist = distanceToSegment({ x, y }, segment[0], segment[1]);
			if (dist < 5) {
				return { hit: true, type: 'line' };
			}
		} else {
			// Fallback to simple segment check if no extension or clipping failed
			const dist = distanceToSegment({ x, y }, { x: x1, y: y1 }, { x: x2, y: y2 });
			if (dist < 5) {
				return { hit: true, type: 'line' };
			}
		}

		return null;
	}

	autoscaleInfo(): AutoscaleInfo | null {
		return null;
	}

	updateAllViews(): void {
		this._paneViews.forEach(pw => pw.update());
	}

	paneViews(): TrendLinePaneView[] {
		// Return empty when hidden by visibility interval
		if ((this as any)._hiddenByVisibility) {
			return [];
		}
		return this._paneViews;
	}
}
