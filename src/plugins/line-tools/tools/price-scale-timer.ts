import {
    ISeriesApi,
    Time,
    SeriesAttachedParameter,
    IChartApi,
    SeriesOptionsMap,
    ISeriesPrimitive,
    IPrimitivePaneView,
    IPrimitivePaneRenderer,
} from 'lightweight-charts';
import { CanvasRenderingTarget2D } from 'fancy-canvas';
// @ts-ignore - importing JS module from TS
import { getAccurateISTTimestamp } from '../../../services/timeService.js';

/**
 * Price Scale Timer Plugin
 * 
 * Displays a combined price label and countdown timer in a SINGLE box on the price axis.
 * Uses a custom pane renderer to draw multi-line text (price on top, timer below).
 */

export interface PriceScaleTimerOptions {
    /** Timeframe in seconds (e.g., 60 for 1m, 300 for 5m, 3600 for 1h) */
    timeframeSeconds: number;
    /** Text color for the label */
    textColor: string;
    /** Background color when price is going up (green) */
    upColor: string;
    /** Background color when price is going down (red) */
    downColor: string;
    /** Whether the entire plugin is visible */
    visible: boolean;
    /** Whether the timer portion is visible */
    showTimerText: boolean;
    /** Font size in pixels */
    fontSize: number;
}

const defaultOptions: PriceScaleTimerOptions = {
    timeframeSeconds: 300,
    textColor: '#FFFFFF',
    upColor: '#089981',
    downColor: '#f23645',
    visible: true,
    showTimerText: true,
    fontSize: 11,
};

/**
 * Custom renderer that draws price + timer box on the price scale
 */
class PriceTimerBoxRenderer implements IPrimitivePaneRenderer {
    private _priceText: string;
    private _timerText: string;
    private _showTimer: boolean;
    private _y: number;
    private _backgroundColor: string;
    private _textColor: string;
    private _fontSize: number;

    constructor(
        priceText: string,
        timerText: string,
        showTimer: boolean,
        y: number,
        backgroundColor: string,
        textColor: string,
        fontSize: number
    ) {
        this._priceText = priceText;
        this._timerText = timerText;
        this._showTimer = showTimer;
        this._y = y;
        this._backgroundColor = backgroundColor;
        this._textColor = textColor;
        this._fontSize = fontSize;
    }

    draw(target: CanvasRenderingTarget2D): void {
        target.useMediaCoordinateSpace(scope => {
            const ctx = scope.context;

            if (this._y < 0 || this._y > scope.mediaSize.height) return;

            const paddingX = 9; // Horizontal padding (before and after text)
            const paddingY = 4; // Vertical padding
            const lineHeight = this._fontSize + 3;

            // Use the same font as Lightweight Charts price scale with medium weight
            ctx.font = `500 ${this._fontSize}px -apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif`;

            const priceWidth = ctx.measureText(this._priceText).width;
            const timerWidth = this._showTimer ? ctx.measureText(this._timerText).width : 0;
            const maxTextWidth = Math.max(priceWidth, timerWidth);

            // Box width fits the content
            const boxWidth = maxTextWidth + paddingX * 2;
            const boxHeight = this._showTimer
                ? lineHeight * 2 + paddingY * 2
                : lineHeight + paddingY * 2;

            // Position box from the left edge of price scale area
            const boxX = 0;
            const boxY = this._y - boxHeight / 2;
            const borderRadius = 3; // Slight curve on edges

            // Draw background box with rounded corners on right side
            ctx.fillStyle = this._backgroundColor;
            ctx.beginPath();
            // Start from top-left (no curve on left since it's at edge)
            ctx.moveTo(boxX, boxY);
            // Top edge to top-right
            ctx.lineTo(boxX + boxWidth - borderRadius, boxY);
            // Top-right curve
            ctx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + borderRadius);
            // Right edge to bottom-right
            ctx.lineTo(boxX + boxWidth, boxY + boxHeight - borderRadius);
            // Bottom-right curve
            ctx.quadraticCurveTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - borderRadius, boxY + boxHeight);
            // Bottom edge to bottom-left
            ctx.lineTo(boxX, boxY + boxHeight);
            // Close path (left edge)
            ctx.closePath();
            ctx.fill();

            // Draw price text (left-aligned, full brightness)
            ctx.fillStyle = this._textColor;
            ctx.textBaseline = 'top';
            ctx.textAlign = 'left';
            ctx.fillText(this._priceText, boxX + paddingX, boxY + paddingY);

            // Draw timer text below price (if visible, slightly dimmer)
            if (this._showTimer && this._timerText) {
                // Make timer text 70% opacity (dimmer)
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.fillText(this._timerText, boxX + paddingX, boxY + paddingY + lineHeight);
            }
        });
    }
}

/**
 * Pane view for the combined price+timer box
 */
class PriceTimerBoxPaneView implements IPrimitivePaneView {
    private _source: PriceScaleTimer;
    private _priceText: string = '';
    private _y: number = -10000;

    constructor(source: PriceScaleTimer) {
        this._source = source;
    }

    update(): void {
        if (!this._source.isAttached()) {
            this._y = -10000;
            return;
        }

        const series = this._source.getSeries();
        if (!series) {
            this._y = -10000;
            return;
        }

        const lastValueData = series.lastValueData(false);
        if (!lastValueData || lastValueData.noData) {
            this._y = -10000;
            return;
        }

        const price = (lastValueData as any).price ?? (lastValueData as any).value;
        if (price === undefined || price === null) {
            this._y = -10000;
            return;
        }

        const priceCoordinate = series.priceToCoordinate(price);
        if (priceCoordinate === null) {
            this._y = -10000;
            return;
        }

        this._y = priceCoordinate;
        this._priceText = series.priceFormatter().format(price);
    }

    renderer(): IPrimitivePaneRenderer | null {
        const options = this._source.options();
        if (!options.visible || this._y < 0) {
            return null;
        }

        return new PriceTimerBoxRenderer(
            this._priceText,
            this._source.getCountdownText(),
            options.showTimerText,
            this._y,
            this._source.isBullish() ? options.upColor : options.downColor,
            options.textColor,
            options.fontSize
        );
    }
}

export class PriceScaleTimer implements ISeriesPrimitive<Time> {
    private _chart: IChartApi | undefined;
    private _series: ISeriesApi<keyof SeriesOptionsMap> | undefined;
    private _requestUpdate?: () => void;
    private _options: PriceScaleTimerOptions;
    private _paneViews: PriceTimerBoxPaneView[];
    private _intervalId: number | null = null;
    private _countdownText: string = '';
    private _isBullish: boolean = true;
    private _lastOpen: number | null = null;
    private _lastClose: number | null = null;

    constructor(options: Partial<PriceScaleTimerOptions> = {}) {
        this._options = { ...defaultOptions, ...options };
        this._paneViews = [new PriceTimerBoxPaneView(this)];
    }

    attached({ chart, series, requestUpdate }: SeriesAttachedParameter<Time>): void {
        this._chart = chart;
        this._series = series;
        this._requestUpdate = requestUpdate;

        this._subscribeToDataChanges();
        this._startInterval();
        this._updateCountdown();
        this.updateAllViews();
        this.requestUpdate();
    }

    detached(): void {
        this._stopInterval();
        this._unsubscribeFromDataChanges();
        this._chart = undefined;
        this._series = undefined;
        this._requestUpdate = undefined;
    }

    // Return price axis pane views to draw on the price scale
    priceAxisPaneViews(): IPrimitivePaneView[] {
        return this._paneViews;
    }

    private _dataChangedHandler: (() => void) | null = null;

    private _subscribeToDataChanges(): void {
        if (!this._series) return;

        this._dataChangedHandler = () => {
            this._updateBullishStateFromSeriesData();
        };

        this._series.subscribeDataChanged(this._dataChangedHandler);
        this._updateBullishStateFromSeriesData();
    }

    private _unsubscribeFromDataChanges(): void {
        if (this._series && this._dataChangedHandler) {
            this._series.unsubscribeDataChanged(this._dataChangedHandler);
            this._dataChangedHandler = null;
        }
    }

    private _updateBullishStateFromSeriesData(): void {
        if (!this._series || !this._chart) return;

        const lastValueData = this._series.lastValueData(false);
        if (lastValueData && !lastValueData.noData) {
            const currentPrice = (lastValueData as any).price ?? (lastValueData as any).value;
            const openPrice = (lastValueData as any).open;

            if (openPrice !== undefined && currentPrice !== undefined) {
                this._lastOpen = openPrice;
                this._lastClose = currentPrice;
                this._isBullish = currentPrice >= openPrice;
            } else if (currentPrice !== undefined && this._lastClose !== null) {
                this._lastClose = currentPrice;
            }
            this.updateAllViews();
            this.requestUpdate();
        }
    }

    private _startInterval(): void {
        if (this._intervalId !== null) return;

        this._intervalId = window.setInterval(() => {
            this._updateCountdown();
            this.updateAllViews();
            this.requestUpdate();
        }, 1000);
    }

    private _stopInterval(): void {
        if (this._intervalId !== null) {
            window.clearInterval(this._intervalId);
            this._intervalId = null;
        }
    }

    private _updateCountdown(): void {
        const timeframeSeconds = this._options.timeframeSeconds;
        // Use IST time from the frontend timeService instead of local time
        const now = Math.floor(getAccurateISTTimestamp());

        let candleOpenTime: number | null = null;

        if (this._series) {
            const lastValueData = this._series.lastValueData(false);
            if (lastValueData && !lastValueData.noData) {
                const time = (lastValueData as any).time;
                if (time !== undefined && time !== null) {
                    if (typeof time === 'number') {
                        candleOpenTime = time;
                    } else if (typeof time === 'object' && time.year !== undefined) {
                        const date = new Date(time.year, time.month - 1, time.day);
                        candleOpenTime = Math.floor(date.getTime() / 1000);
                    }
                }

                const open = (lastValueData as any).open;
                const close = (lastValueData as any).close ?? (lastValueData as any).price ?? (lastValueData as any).value;
                if (open !== undefined && close !== undefined) {
                    this._lastOpen = open;
                    this._lastClose = close;
                    this._isBullish = close >= open;
                }
            }
        }

        let secondsRemaining: number;

        if (candleOpenTime !== null) {
            const elapsedSinceOpen = now - candleOpenTime;
            secondsRemaining = timeframeSeconds - elapsedSinceOpen;

            if (secondsRemaining <= 0) {
                secondsRemaining = timeframeSeconds - ((-secondsRemaining) % timeframeSeconds);
                if (secondsRemaining === timeframeSeconds) {
                    secondsRemaining = 0;
                }
            }
        } else {
            const secondsIntoCandle = now % timeframeSeconds;
            secondsRemaining = timeframeSeconds - secondsIntoCandle;
        }

        this._countdownText = this._formatTime(secondsRemaining);
    }

    private _formatTime(totalSeconds: number): string {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return `${this._pad(hours)}:${this._pad(minutes)}:${this._pad(seconds)}`;
        }
        return `${this._pad(minutes)}:${this._pad(seconds)}`;
    }

    private _pad(num: number): string {
        return num.toString().padStart(2, '0');
    }

    public getCountdownText(): string {
        return this._countdownText;
    }

    public options(): PriceScaleTimerOptions {
        return this._options;
    }

    public applyOptions(options: Partial<PriceScaleTimerOptions>): void {
        this._options = { ...this._options, ...options };

        if (options.timeframeSeconds !== undefined) {
            this._updateCountdown();
        }

        this.updateAllViews();
        this.requestUpdate();
    }

    public setVisible(visible: boolean): void {
        this._options.visible = visible;
        if (visible) {
            this._startInterval();
        } else {
            this._stopInterval();
        }
        this.updateAllViews();
        this.requestUpdate();
    }

    public isVisible(): boolean {
        return this._options.visible;
    }

    public setTimerVisible(visible: boolean): void {
        this._options.showTimerText = visible;
        this.updateAllViews();
        this.requestUpdate();
    }

    public isTimerVisible(): boolean {
        return this._options.showTimerText;
    }

    public isAttached(): boolean {
        return this._series !== undefined && this._chart !== undefined;
    }

    public getSeries(): ISeriesApi<keyof SeriesOptionsMap> | undefined {
        return this._series;
    }

    public getChart(): IChartApi | undefined {
        return this._chart;
    }

    public isBullish(): boolean {
        return this._isBullish;
    }

    public updateCandleData(open: number, close: number): void {
        this._lastOpen = open;
        this._lastClose = close;
        this._isBullish = close >= open;
        this.updateAllViews();
        this.requestUpdate();
    }

    public getLastOHLC(): { open: number | null; close: number | null } {
        return { open: this._lastOpen, close: this._lastClose };
    }

    public updateAllViews(): void {
        this._paneViews.forEach(view => view.update());
    }

    protected requestUpdate(): void {
        if (this._requestUpdate) {
            this._requestUpdate();
        }
    }
}
