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
    isPointInRectangle,
    scaleCoordinate,
    drawAnchor,
} from './base-types';

class DatePriceRangePaneRenderer implements IPrimitivePaneRenderer {
    private readonly _p1: ViewPoint;
    private readonly _p2: ViewPoint;
    private readonly _options: DatePriceRangeOptions;
    private readonly _selected: boolean;
    private readonly _source: DatePriceRange;

    constructor(
        p1: ViewPoint,
        p2: ViewPoint,
        options: DatePriceRangeOptions,
        selected: boolean,
        source: DatePriceRange
    ) {
        this._p1 = p1;
        this._p2 = p2;
        this._options = options;
        this._selected = selected;
        this._source = source;
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

            const xMin = Math.min(x1Scaled, x2Scaled);
            const xMax = Math.max(x1Scaled, x2Scaled);
            const yMin = Math.min(y1Scaled, y2Scaled);
            const yMax = Math.max(y1Scaled, y2Scaled);

            const width = xMax - xMin;
            const height = yMax - yMin;

            // Draw filled rectangle
            if (this._options.backgroundColor) {
                ctx.fillStyle = this._options.backgroundColor;
                ctx.fillRect(xMin, yMin, width, height);
            }

            // Draw border
            ctx.strokeStyle = this._options.borderColor;
            ctx.lineWidth = this._options.borderWidth * scope.verticalPixelRatio;
            ctx.strokeRect(xMin, yMin, width, height);

            // Draw Arrows
            const arrowSize = 10 * scope.verticalPixelRatio;
            ctx.beginPath();

            // Horizontal Arrow (Center Y)
            const yMid = (y1Scaled + y2Scaled) / 2;
            ctx.moveTo(xMin, yMid);
            ctx.lineTo(xMax, yMid);

            // Horizontal Arrow Head
            const xDiff = x2Scaled - x1Scaled;
            if (Math.abs(xDiff) > arrowSize) {
                const arrowX = xDiff > 0 ? xMax : xMin;
                const direction = xDiff > 0 ? -1 : 1;
                ctx.moveTo(arrowX + (arrowSize * direction), yMid - arrowSize);
                ctx.lineTo(arrowX, yMid);
                ctx.lineTo(arrowX + (arrowSize * direction), yMid + arrowSize);
            }

            // Vertical Arrow (Center X)
            const xMid = (x1Scaled + x2Scaled) / 2;
            ctx.moveTo(xMid, yMin);
            ctx.lineTo(xMid, yMax);

            // Vertical Arrow Head
            const yDiff = y2Scaled - y1Scaled;
            if (Math.abs(yDiff) > arrowSize) {
                const arrowY = yDiff > 0 ? yMax : yMin;
                const direction = yDiff > 0 ? -1 : 1;
                ctx.moveTo(xMid - arrowSize, arrowY + (arrowSize * direction));
                ctx.lineTo(xMid, arrowY);
                ctx.lineTo(xMid + arrowSize, arrowY + (arrowSize * direction));
            }
            ctx.stroke();

            // Calculate Stats
            const price1 = this._source._p1.price;
            const price2 = this._source._p2.price;
            const priceDiff = price2 - price1;
            const percentChange = price1 !== 0 ? (priceDiff / price1) * 100 : 0;

            const logical1 = this._source._p1.logical;
            const logical2 = this._source._p2.logical;
            const bars = Math.abs(logical2 - logical1);

            // Format Strings
            const priceFormatter = this._source._series.priceFormatter();
            const formattedPriceDiff = priceFormatter.format(priceDiff);
            // Add + sign for positive numbers
            const priceSign = priceDiff > 0 ? '+' : '';
            const percentSign = percentChange > 0 ? '+' : '';

            const line1 = `${priceSign}${formattedPriceDiff} (${percentSign}${percentChange.toFixed(2)}%)`;
            const line2 = `${bars} bars`;

            // Draw Label Box
            ctx.font = `${12 * scope.verticalPixelRatio}px sans-serif`;
            const padding = 6 * scope.verticalPixelRatio;
            const lineHeight = 16 * scope.verticalPixelRatio;

            const metrics1 = ctx.measureText(line1);
            const metrics2 = ctx.measureText(line2);
            const textWidth = Math.max(metrics1.width, metrics2.width);
            const boxWidth = textWidth + (padding * 2);
            const boxHeight = (lineHeight * 2) + (padding * 2);

            // Position label below the rectangle, centered horizontally
            let labelX = xMid - (boxWidth / 2);
            let labelY = yMax + (10 * scope.verticalPixelRatio);

            // Ensure label stays within canvas bounds (simplified check)
            if (labelX < 0) labelX = 0;
            if (labelX + boxWidth > scope.mediaSize.width * scope.horizontalPixelRatio) {
                labelX = (scope.mediaSize.width * scope.horizontalPixelRatio) - boxWidth;
            }

            // Draw Label Background
            ctx.fillStyle = 'white';
            ctx.shadowColor = 'rgba(0,0,0,0.2)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetY = 2;
            ctx.fillRect(labelX, labelY, boxWidth, boxHeight);
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;

            // Draw Label Border (optional, maybe just shadow is enough, or thin border)
            ctx.strokeStyle = '#ccc';
            ctx.lineWidth = 1;
            ctx.strokeRect(labelX, labelY, boxWidth, boxHeight);

            // Draw Text
            ctx.fillStyle = '#333';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(line1, labelX + padding, labelY + padding);
            ctx.fillText(line2, labelX + padding, labelY + padding + lineHeight);

            // Draw anchors when selected
            if (this._selected) {
                drawAnchor(scope, x1Scaled, y1Scaled);
                drawAnchor(scope, x2Scaled, y2Scaled);
                drawAnchor(scope, x1Scaled, y2Scaled);
                drawAnchor(scope, x2Scaled, y1Scaled);
                drawAnchor(scope, xMid, y1Scaled);
                drawAnchor(scope, xMid, y2Scaled);
                drawAnchor(scope, x1Scaled, yMid);
                drawAnchor(scope, x2Scaled, yMid);
            }
        });
    }
}

class DatePriceRangePaneView implements IPrimitivePaneView {
    private readonly _source: DatePriceRange;
    private _p1: ViewPoint = { x: null, y: null };
    private _p2: ViewPoint = { x: null, y: null };

    constructor(source: DatePriceRange) {
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

    renderer(): DatePriceRangePaneRenderer {
        return new DatePriceRangePaneRenderer(
            this._p1,
            this._p2,
            this._source._options,
            this._source._selected,
            this._source
        );
    }
}

export interface DatePriceRangeOptions {
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
}

const defaultOptions: DatePriceRangeOptions = {
    backgroundColor: 'rgba(41, 98, 255, 0.2)',
    borderColor: 'rgb(41, 98, 255)',
    borderWidth: 2,
};

export class DatePriceRange implements ISeriesPrimitive<Time> {
    readonly _chart: IChartApi;
    readonly _series: ISeriesApi<keyof SeriesOptionsMap>;
    _p1: LogicalPoint;
    _p2: LogicalPoint;
    private readonly _paneViews: DatePriceRangePaneView[];
    readonly _options: DatePriceRangeOptions;

    _selected: boolean = false;

    constructor(
        chart: IChartApi,
        series: ISeriesApi<SeriesType>,
        p1: LogicalPoint,
        p2: LogicalPoint,
        options?: Partial<DatePriceRangeOptions>
    ) {
        this._chart = chart;
        this._series = series;
        this._p1 = p1;
        this._p2 = p2;

        this._options = {
            ...defaultOptions,
            ...options,
        };
        this._paneViews = [new DatePriceRangePaneView(this)];
    }

    public updatePoints(p1: LogicalPoint, p2: LogicalPoint): void {
        this._p1 = p1;
        this._p2 = p2;
        this.updateAllViews();
    }

    public updatePointByIndex(index: number, point: LogicalPoint): void {
        switch (index) {
            case 0: // top-left corner (p1)
                this._p1 = point;
                break;
            case 1: // bottom-right corner (p2)
                this._p2 = point;
                break;
            case 2: // bottom-left corner
                this._p1 = { ...this._p1, logical: point.logical };
                this._p2 = { ...this._p2, price: point.price };
                break;
            case 3: // top-right corner
                this._p2 = { ...this._p2, logical: point.logical };
                this._p1 = { ...this._p1, price: point.price };
                break;
            case 4: // top center
                // Update y of p1 or p2 depending on which is top
                // Simplified: assume p1 is top if p1.price > p2.price
                // Actually, just updating price of p1/p2 based on min/max logic is better but complex
                // Let's stick to simple corner updates for now or just update p1/p2 price directly
                // If we assume p1 is the 'start' point, we can just update p1.price?
                // No, let's just support corner dragging for now to be safe.
                break;
        }
        this.updateAllViews();
    }

    public setSelected(selected: boolean): void {
        this._selected = selected;
        this.updateAllViews();
    }

    public applyOptions(options: Partial<DatePriceRangeOptions>): void {
        Object.assign(this._options, options);
        this.updateAllViews();
        this._chart.timeScale().applyOptions({});
    }

    public toolHitTest(x: number, y: number): HitTestResult | null {
        const timeScale = this._chart.timeScale();
        const series = this._series;

        const x1 = timeScale.logicalToCoordinate(this._p1.logical as Logical);
        const y1 = series.priceToCoordinate(this._p1.price);
        const x2 = timeScale.logicalToCoordinate(this._p2.logical as Logical);
        const y2 = series.priceToCoordinate(this._p2.price);

        if (x1 === null || y1 === null || x2 === null || y2 === null) return null;

        const threshold = 8;
        const xMin = Math.min(x1, x2);
        const xMax = Math.max(x1, x2);
        const yMin = Math.min(y1, y2);
        const yMax = Math.max(y1, y2);
        const xMid = (x1 + x2) / 2;
        const yMid = (y1 + y2) / 2;

        const anchors = [
            { x: x1, y: y1, index: 0 },
            { x: x2, y: y2, index: 1 },
            { x: x1, y: y2, index: 2 },
            { x: x2, y: y1, index: 3 },
            { x: xMid, y: yMin, index: 4 },
            { x: xMid, y: yMax, index: 5 },
            { x: xMin, y: yMid, index: 6 },
            { x: xMax, y: yMid, index: 7 },
        ];

        for (const anchor of anchors) {
            if (Math.hypot(x - anchor.x, y - anchor.y) < threshold) {
                return { hit: true, type: 'point', index: anchor.index };
            }
        }

        if (isPointInRectangle({ x, y }, { x1, y1, x2, y2 })) {
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

    paneViews(): DatePriceRangePaneView[] {
        return this._paneViews;
    }
}
