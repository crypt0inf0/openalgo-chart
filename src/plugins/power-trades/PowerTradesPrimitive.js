/**
 * Power Trades Primitive for lightweight-charts
 * Visualizes large trades as bubbles on the chart
 * Detects trades that exceed volume threshold within time window
 */

import {
    COLORS,
    DEFAULT_SETTINGS,
    formatVolume,
    getBubbleColor,
    calculateBubbleRadius,
} from './PowerTradesConstants';

/**
 * Power Trades Pane Renderer
 */
class PowerTradesPaneRenderer {
    constructor(source) {
        this._source = source;
    }

    draw(target) {
        target.useBitmapCoordinateSpace((scope) => {
            const { context: ctx, bitmapSize, horizontalPixelRatio, verticalPixelRatio } = scope;
            const powerTrades = this._source._powerTrades;
            const options = this._source._options;
            const series = this._source._series;
            const chart = this._source._chart;

            if (!series || !chart || !powerTrades || powerTrades.length === 0 || !options.enabled) return;

            const timeScale = chart.timeScale();
            const hRatio = horizontalPixelRatio;
            const vRatio = verticalPixelRatio;

            // Filter trades based on settings
            let filteredTrades = [...powerTrades];
            if (options.showBuyOnly) {
                filteredTrades = filteredTrades.filter(t => t.side === 'buy');
            } else if (options.showSellOnly) {
                filteredTrades = filteredTrades.filter(t => t.side === 'sell');
            }

            // Limit history
            if (options.maxHistoryCount > 0) {
                filteredTrades = filteredTrades.slice(-options.maxHistoryCount);
            }

            if (filteredTrades.length === 0) return;

            // Calculate volume range for bubble sizing
            const volumes = filteredTrades.map(t => t.volume);
            const minVolume = Math.min(...volumes);
            const maxVolume = Math.max(...volumes);

            // Draw each power trade bubble
            filteredTrades.forEach((trade, index) => {
                const x = timeScale.timeToCoordinate(trade.time);
                const y = series.priceToCoordinate(trade.price);

                if (x === null || y === null) return;

                const xPixel = x * hRatio;
                const yPixel = y * vRatio;

                // Calculate bubble size
                const isHighAlert = trade.volume >= options.volumeThreshold * options.alertVolumeMultiplier;
                const radius = calculateBubbleRadius(
                    trade.volume,
                    minVolume,
                    maxVolume,
                    options.minBubbleRadius * hRatio,
                    options.maxBubbleRadius * hRatio
                );

                // Get colors
                const colors = getBubbleColor(trade.side, isHighAlert);

                // Draw bubble
                if (options.showBubbles) {
                    this._drawBubble(ctx, xPixel, yPixel, radius, colors, options, isHighAlert, hRatio, vRatio);
                }

                // Draw line to price (optional)
                if (options.showLines) {
                    this._drawPriceLine(ctx, xPixel, yPixel, radius, colors, vRatio);
                }

                // Draw label
                if (options.showLabels && radius > 15 * hRatio) {
                    this._drawLabel(ctx, xPixel, yPixel, trade, options, hRatio, vRatio);
                }
            });

            // Draw legend
            this._drawLegend(ctx, filteredTrades.length, options, bitmapSize.width, hRatio, vRatio);
        });
    }

    _drawBubble(ctx, x, y, radius, colors, options, isHighAlert, hRatio, vRatio) {
        ctx.save();
        ctx.globalAlpha = options.opacity;

        // Fill
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = colors.fill;
        ctx.fill();

        // Stroke
        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = isHighAlert ? 3 * hRatio : 2 * hRatio;
        ctx.stroke();

        // Pulse effect for high alert
        if (isHighAlert && options.pulseOnNew) {
            ctx.beginPath();
            ctx.arc(x, y, radius * 1.3, 0, Math.PI * 2);
            ctx.strokeStyle = colors.stroke;
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = 1 * hRatio;
            ctx.setLineDash([3 * hRatio, 3 * hRatio]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.restore();
    }

    _drawPriceLine(ctx, x, y, radius, colors, vRatio) {
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        ctx.setLineDash([2, 2]);

        // Vertical line from bubble to edge
        ctx.moveTo(x, y + radius);
        ctx.lineTo(x, y + radius + 20 * vRatio);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.restore();
    }

    _drawLabel(ctx, x, y, trade, options, hRatio, vRatio) {
        ctx.save();

        // Volume text
        ctx.font = `bold ${options.fontSize * vRatio}px Arial`;
        ctx.fillStyle = COLORS.TEXT_PRIMARY;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(formatVolume(trade.volume), x, y);

        // Side indicator (small arrow or text)
        const sideIndicator = trade.side === 'buy' ? '▲' : '▼';
        ctx.font = `${(options.fontSize - 2) * vRatio}px Arial`;
        ctx.fillStyle = trade.side === 'buy' ? COLORS.BUY_BUBBLE : COLORS.SELL_BUBBLE;
        ctx.fillText(sideIndicator, x, y + 10 * vRatio);

        ctx.restore();
    }

    _drawLegend(ctx, count, options, chartWidth, hRatio, vRatio) {
        ctx.save();

        const legendX = chartWidth - 10 * hRatio;
        const legendY = 15 * vRatio;

        ctx.fillStyle = COLORS.TEXT_SECONDARY;
        ctx.font = `${10 * vRatio}px Arial`;
        ctx.textAlign = 'right';
        ctx.fillText(`Power Trades: ${count}`, legendX, legendY);

        ctx.restore();
    }
}

/**
 * Power Trades Price Line Renderer
 * Draws horizontal lines at power trade price levels
 */
class PowerTradesPriceLineRenderer {
    constructor(source) {
        this._source = source;
    }

    draw(target) {
        target.useBitmapCoordinateSpace((scope) => {
            const { context: ctx, bitmapSize, horizontalPixelRatio, verticalPixelRatio } = scope;
            const powerTrades = this._source._powerTrades;
            const options = this._source._options;
            const series = this._source._series;

            if (!series || !powerTrades || powerTrades.length === 0 || !options.enabled) return;

            const chartWidth = bitmapSize.width;
            const hRatio = horizontalPixelRatio;
            const vRatio = verticalPixelRatio;

            // Only show lines for recent high-alert trades
            const highAlertTrades = powerTrades.filter(
                t => t.volume >= options.volumeThreshold * options.alertVolumeMultiplier
            ).slice(-5);

            highAlertTrades.forEach(trade => {
                const y = series.priceToCoordinate(trade.price);
                if (y === null) return;

                const yPixel = y * vRatio;
                const colors = getBubbleColor(trade.side, true);

                ctx.beginPath();
                ctx.strokeStyle = colors.stroke;
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.4;
                ctx.setLineDash([5 * hRatio, 5 * hRatio]);
                ctx.moveTo(0, yPixel);
                ctx.lineTo(chartWidth, yPixel);
                ctx.stroke();
                ctx.setLineDash([]);
            });
        });
    }
}

/**
 * Power Trades Pane View
 */
class PowerTradesPaneView {
    constructor(source) {
        this._source = source;
    }

    update() {}

    renderer() {
        return new PowerTradesPaneRenderer(this._source);
    }

    zOrder() {
        return 'top';
    }
}

/**
 * Power Trades Price Line View
 */
class PowerTradesPriceLineView {
    constructor(source) {
        this._source = source;
    }

    update() {}

    renderer() {
        return new PowerTradesPriceLineRenderer(this._source);
    }

    zOrder() {
        return 'bottom';
    }
}

/**
 * Main Power Trades Primitive class
 */
export class PowerTradesPrimitive {
    constructor(options = {}) {
        this._options = { ...DEFAULT_SETTINGS, ...options };
        this._powerTrades = [];
        this._paneViews = [new PowerTradesPaneView(this)];
        this._priceLineViews = [new PowerTradesPriceLineView(this)];
        this._chart = null;
        this._series = null;
        this._requestUpdate = null;

        // Real-time detection state
        this._tickBuffer = [];
        this._lastDetectionTime = 0;
    }

    attached({ chart, series, requestUpdate }) {
        this._chart = chart;
        this._series = series;
        this._requestUpdate = requestUpdate;
    }

    detached() {
        this._chart = null;
        this._series = null;
        this._requestUpdate = null;
    }

    paneViews() {
        return this._paneViews;
    }

    priceAxisViews() {
        return [];
    }

    timeAxisViews() {
        return [];
    }

    updateAllViews() {
        this._paneViews.forEach(view => view.update());
        this._priceLineViews.forEach(view => view.update());
        this._requestUpdate?.();
    }

    /**
     * Add a detected power trade
     * @param {Object} trade - { time, price, volume, side }
     */
    addPowerTrade(trade) {
        // Check for duplicates
        const isDuplicate = this._powerTrades.some(
            t => t.time === trade.time && t.price === trade.price
        );

        if (!isDuplicate) {
            this._powerTrades.push(trade);

            // Limit history
            if (this._options.maxHistoryCount > 0 &&
                this._powerTrades.length > this._options.maxHistoryCount * 1.5) {
                this._powerTrades = this._powerTrades.slice(-this._options.maxHistoryCount);
            }

            this.updateAllViews();
        }
    }

    /**
     * Process incoming tick for real-time detection
     * @param {Object} tick - { time, price, volume, side }
     */
    processTick(tick) {
        if (!this._options.enabled) return;

        const now = Date.now();

        // Add to buffer
        this._tickBuffer.push({
            ...tick,
            receivedTime: now,
        });

        // Clean old ticks from buffer
        const windowStart = now - this._options.timeWindowMs;
        this._tickBuffer = this._tickBuffer.filter(t => t.receivedTime >= windowStart);

        // Check for power trade (aggregate volume in window)
        const totalVolume = this._tickBuffer.reduce((sum, t) => sum + t.volume, 0);

        if (totalVolume >= this._options.volumeThreshold) {
            // Calculate weighted average price
            const vwap = this._tickBuffer.reduce((sum, t) => sum + t.price * t.volume, 0) / totalVolume;

            // Determine dominant side
            const buyVolume = this._tickBuffer.filter(t => t.side === 'buy').reduce((s, t) => s + t.volume, 0);
            const sellVolume = this._tickBuffer.filter(t => t.side === 'sell').reduce((s, t) => s + t.volume, 0);
            const dominantSide = buyVolume > sellVolume ? 'buy' : 'sell';

            // Create power trade
            const powerTrade = {
                time: Math.floor(tick.time / 1000), // Convert to seconds for chart
                price: vwap,
                volume: totalVolume,
                side: dominantSide,
                tickCount: this._tickBuffer.length,
            };

            this.addPowerTrade(powerTrade);

            // Clear buffer after detection
            this._tickBuffer = [];
            this._lastDetectionTime = now;
        }
    }

    /**
     * Set power trades data (for historical display)
     * @param {Array} trades - Array of power trade objects
     */
    setData(trades) {
        this._powerTrades = trades || [];
        this.updateAllViews();
    }

    /**
     * Get current power trades
     * @returns {Array}
     */
    getPowerTrades() {
        return [...this._powerTrades];
    }

    /**
     * Get recent power trades (last N)
     * @param {number} count
     * @returns {Array}
     */
    getRecentPowerTrades(count = 10) {
        return this._powerTrades.slice(-count);
    }

    options() {
        return this._options;
    }

    applyOptions(options) {
        this._options = { ...this._options, ...options };
        this.updateAllViews();
    }

    clearData() {
        this._powerTrades = [];
        this._tickBuffer = [];
        this.updateAllViews();
    }

    autoscaleInfo() {
        return null;
    }
}

export default PowerTradesPrimitive;
