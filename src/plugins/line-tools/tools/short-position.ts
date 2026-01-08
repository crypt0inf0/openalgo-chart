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
    scaleCoordinate,
    drawAnchor,
    roundToMinMove,
    calculateRiskRewardTarget,
} from './base-types';


class ShortPositionPaneRenderer implements IPrimitivePaneRenderer {
    private readonly _p1: ViewPoint; // Entry
    private readonly _p2: ViewPoint; // Stop Loss
    private readonly _p3: ViewPoint; // Take Profit
    private readonly _options: ShortPositionOptions;
    private readonly _selected: boolean;

    constructor(
        p1: ViewPoint,
        p2: ViewPoint,
        p3: ViewPoint,
        options: ShortPositionOptions,
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

            const minX = Math.min(x1, x2, x3);
            const maxX = Math.max(x1, x2, x3);
            const width = Math.max(maxX - minX, 50 * scope.horizontalPixelRatio); // Minimum width
            const rightX = minX + width;

            // Draw Profit Zone (Green) - Between Entry (y1) and Target (y3)
            // For Short: Target (y3) is BELOW Entry (y1), so y3 > y1 in pixel coords (y increases downwards)
            ctx.fillStyle = this._options.profitColor;
            ctx.globalAlpha = this._options.zoneOpacity;
            ctx.fillRect(minX, Math.min(y1, y3), width, Math.abs(y3 - y1));

            // Draw Loss Zone (Red) - Between Entry (y1) and Stop (y2)
            // For Short: Stop (y2) is ABOVE Entry (y1), so y2 < y1 in pixel coords
            ctx.fillStyle = this._options.lossColor;
            ctx.fillRect(minX, Math.min(y1, y2), width, Math.abs(y2 - y1));

            ctx.globalAlpha = 1.0;

            // Draw Lines
            ctx.lineWidth = this._options.lineWidth;
            ctx.lineCap = 'butt';

            // Entry Line
            ctx.strokeStyle = this._options.lineColor;
            ctx.beginPath();
            ctx.moveTo(minX, y1);
            ctx.lineTo(rightX, y1);
            ctx.stroke();

            // Target Line
            ctx.strokeStyle = this._options.profitLineColor;
            ctx.beginPath();
            ctx.moveTo(minX, y3);
            ctx.lineTo(rightX, y3);
            ctx.stroke();

            // Stop Line
            ctx.strokeStyle = this._options.lossLineColor;
            ctx.beginPath();
            ctx.moveTo(minX, y2);
            ctx.lineTo(rightX, y2);
            ctx.stroke();

            // Draw Anchors if selected
            if (this._selected) {
                drawAnchor(scope, x1, y1, '#FFFFFF', '#2962FF'); // Entry
                drawAnchor(scope, x2, y2, '#FFFFFF', '#FF0000'); // Stop
                drawAnchor(scope, x3, y3, '#FFFFFF', '#00FF00'); // Target
            }
        });
    }
}

class ShortPositionPaneView implements IPrimitivePaneView {
    private readonly _source: ShortPosition;
    private _p1: ViewPoint = { x: null, y: null };
    private _p2: ViewPoint = { x: null, y: null };
    private _p3: ViewPoint = { x: null, y: null };

    constructor(source: ShortPosition) {
        this._source = source;
    }

    update(): void {
        this._p1 = pointToCoordinate(this._source._p1, this._source._chart, this._source._series);
        this._p2 = pointToCoordinate(this._source._p2, this._source._chart, this._source._series);
        this._p3 = pointToCoordinate(this._source._p3, this._source._chart, this._source._series);
    }

    renderer(): ShortPositionPaneRenderer {
        return new ShortPositionPaneRenderer(
            this._p1,
            this._p2,
            this._p3,
            this._source._options,
            this._source._selected
        );
    }
}

export interface ShortPositionOptions {
    lineColor: string;
    profitColor: string;
    lossColor: string;
    profitLineColor: string;
    lossLineColor: string;
    lineWidth: number;
    zoneOpacity: number;
    textColor: string;
    locked?: boolean;
}

const defaultOptions: ShortPositionOptions = {
    lineColor: '#787B86',
    profitColor: 'rgba(0, 255, 0, 0.2)',
    lossColor: 'rgba(255, 0, 0, 0.2)',
    profitLineColor: '#00FF00',
    lossLineColor: '#FF0000',
    lineWidth: 1,
    zoneOpacity: 0.2,
    textColor: '#FFFFFF',
    locked: false,
};

export class ShortPosition implements ISeriesPrimitive<Time> {
    readonly _chart: IChartApi;
    readonly _series: ISeriesApi<keyof SeriesOptionsMap>;
    _p1: LogicalPoint; // Entry
    _p2: LogicalPoint; // Stop Loss
    _p3: LogicalPoint; // Take Profit
    private readonly _paneViews: ShortPositionPaneView[];
    readonly _options: ShortPositionOptions;
    _selected: boolean = false;
    _locked: boolean = false;
    private _isAutoTarget: boolean = true; // Track if target is auto-calculated

    constructor(
        chart: IChartApi,
        series: ISeriesApi<SeriesType>,
        p1: LogicalPoint,
        p2: LogicalPoint,
        p3?: LogicalPoint,
        options?: Partial<ShortPositionOptions>
    ) {
        this._chart = chart;
        this._series = series;
        this._p1 = p1;
        this._p2 = p2;
        // Auto-calculate p3 if not provided
        if (p3) {
            this._p3 = p3;
            this._isAutoTarget = false;
        } else {
            this._p3 = this.calculateProfitTarget(p1, p2);
        }
        this._options = {
            ...defaultOptions,
            ...options,
        };
        this._paneViews = [new ShortPositionPaneView(this)];
    }

    /**
     * Calculate profit target at 3R (3x Risk)
     */
    public calculateProfitTarget(entry: LogicalPoint, stop: LogicalPoint): LogicalPoint {
        const minMove = this._series.options().priceFormat.minMove || 0.01;
        const targetPrice = calculateRiskRewardTarget(entry.price, stop.price, 3, minMove);
        return {
            logical: stop.logical,
            price: targetPrice,
        };
    }

    /**
     * Get the current Risk:Reward ratio
     */
    public getRiskRewardRatio(): number {
        const minMove = this._series.options().priceFormat.minMove || 0.01;
        const entryPrice = roundToMinMove(this._p1.price, minMove);
        const stopPrice = roundToMinMove(this._p2.price, minMove);
        const targetPrice = roundToMinMove(this._p3.price, minMove);

        const risk = Math.abs(entryPrice - stopPrice);
        const reward = Math.abs(targetPrice - entryPrice);

        if (risk <= 0) return 0;
        return reward / risk;
    }

    /**
     * Check if this is a valid short position (entry < stop)
     */
    public isValidShort(): boolean {
        return this._p1.price < this._p2.price;
    }

    public updatePoints(p1: LogicalPoint, p2: LogicalPoint, p3: LogicalPoint): void {
        this._p1 = p1;
        this._p2 = p2;
        this._p3 = p3;
        this.updateAllViews();
    }

    public updatePointByIndex(index: number, point: LogicalPoint): void {
        // Logic:
        // 0 (Entry): Move the whole tool (maintain relative distances)
        // 1 (Stop): Move only Stop point (p2), recalculate target if auto
        // 2 (Target): Move only Target point (p3), disable auto mode
        const minMove = this._series.options().priceFormat.minMove || 0.01;

        if (index === 0) {
            const deltaLogical = point.logical - this._p1.logical;
            const deltaPrice = point.price - this._p1.price;

            this._p1 = point;
            this._p2 = { logical: this._p2.logical + deltaLogical, price: this._p2.price + deltaPrice };
            this._p3 = { logical: this._p3.logical + deltaLogical, price: this._p3.price + deltaPrice };
        } else if (index === 1) {
            this._p2 = point;
            // Recalculate target if in auto mode
            if (this._isAutoTarget) {
                this._p3 = this.calculateProfitTarget(this._p1, this._p2);
            } else {
                // Ensure target stays on correct side of entry
                const isShort = this._p1.price < this._p2.price;
                if (isShort) {
                    this._p3.price = Math.min(this._p3.price, this._p1.price - minMove);
                } else {
                    this._p3.price = Math.max(this._p3.price, this._p1.price + minMove);
                }
            }
        } else if (index === 2) {
            this._p3 = point;
            this._isAutoTarget = false; // User is manually adjusting target
        }

        this.updateAllViews();
    }

    public setSelected(selected: boolean): void {
        this._selected = selected;
        this.updateAllViews();
    }

    public toolHitTest(x: number, y: number): HitTestResult | null {
        const timeScale = this._chart.timeScale();
        const series = this._series;

        const x1 = timeScale.logicalToCoordinate(this._p1.logical as Logical);
        const y1 = series.priceToCoordinate(this._p1.price);
        const x2 = timeScale.logicalToCoordinate(this._p2.logical as Logical);
        const y2 = series.priceToCoordinate(this._p2.price);
        const x3 = timeScale.logicalToCoordinate(this._p3.logical as Logical);
        const y3 = series.priceToCoordinate(this._p3.price);

        if (x1 === null || y1 === null || x2 === null || y2 === null || x3 === null || y3 === null) return null;

        // Check anchors
        const threshold = 8;
        if (Math.hypot(x - x1, y - y1) < threshold) return { hit: true, type: 'point', index: 0 };
        if (Math.hypot(x - x2, y - y2) < threshold) return { hit: true, type: 'point', index: 1 };
        if (Math.hypot(x - x3, y - y3) < threshold) return { hit: true, type: 'point', index: 2 };

        // Check zones
        const minX = Math.min(x1, x2, x3);
        const maxX = Math.max(x1, x2, x3);
        const pixelRatio = window.devicePixelRatio || 1;
        const width = Math.max(maxX - minX, 50 * pixelRatio); // Use same logic as renderer (approx)
        const rightX = minX + width;

        // Check if inside the bounding box of the tool
        const topY = Math.min(y1, y2, y3);
        const bottomY = Math.max(y1, y2, y3);

        if (x >= minX && x <= rightX && y >= topY && y <= bottomY) {
            return { hit: true, type: 'shape' };
        }

        return null;
    }

    autoscaleInfo(): AutoscaleInfo | null {
        return null; // Don't affect autoscale for now
    }

    updateAllViews(): void {
        this._paneViews.forEach(pw => pw.update());
    }

    paneViews(): ShortPositionPaneView[] {
        return this._paneViews;
    }
}
