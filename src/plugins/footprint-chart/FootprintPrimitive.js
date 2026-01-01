/**
 * Footprint Chart Primitive for lightweight-charts
 * Implements ISeriesPrimitive interface to render Footprint/Cluster charts
 *
 * This primitive renders:
 * - Buy/Sell volume at each price level within candles
 * - Delta (buy-sell) color coding
 * - Imbalance highlighting (yellow cells)
 * - POC (Point of Control) per bar
 * - Multiple display presets (Delta Profile, Bid-Ask, Classic, etc.)
 */

import {
    COLORS,
    DEFAULT_SETTINGS,
    FOOTPRINT_PRESETS,
    getDeltaColor,
    getDeltaGradient,
    getImbalanceColor,
    formatVolume,
    formatDelta,
    getTickSize,
} from './FootprintConstants';

/**
 * Footprint Pane Renderer - handles Canvas2D drawing
 */
class FootprintPaneRenderer {
    constructor(source) {
        this._source = source;
    }

    draw(target) {
        target.useBitmapCoordinateSpace((scope) => {
            const { context: ctx, bitmapSize, horizontalPixelRatio, verticalPixelRatio } = scope;
            const footprints = this._source._footprints;
            const options = this._source._options;
            const series = this._source._series;
            const chart = this._source._chart;

            if (!series || !chart || !footprints || footprints.length === 0) return;

            const chartWidth = bitmapSize.width;
            const chartHeight = bitmapSize.height;
            const timeScale = chart.timeScale();

            // Get visible range
            const visibleRange = timeScale.getVisibleLogicalRange();
            if (!visibleRange) return;

            const hRatio = horizontalPixelRatio;
            const vRatio = verticalPixelRatio;

            // Draw each footprint bar
            footprints.forEach((fp, index) => {
                if (!fp || !fp.levels || fp.levels.size === 0) return;

                // Check if bar is in visible range
                const barX = timeScale.timeToCoordinate(fp.time);
                if (barX === null) return;

                const barXPixel = barX * hRatio;

                // Calculate bar width based on time scale
                const barWidth = this._calculateBarWidth(timeScale, fp.time, hRatio);

                // Draw footprint based on preset
                switch (options.preset) {
                    case FOOTPRINT_PRESETS.DELTA_PROFILE:
                        this._drawDeltaProfile(ctx, series, fp, barXPixel, barWidth, options, hRatio, vRatio);
                        break;
                    case FOOTPRINT_PRESETS.BID_ASK_PROFILE:
                        this._drawBidAskProfile(ctx, series, fp, barXPixel, barWidth, options, hRatio, vRatio);
                        break;
                    case FOOTPRINT_PRESETS.VOLUME_PROFILE:
                        this._drawVolumeProfile(ctx, series, fp, barXPixel, barWidth, options, hRatio, vRatio);
                        break;
                    case FOOTPRINT_PRESETS.CLASSIC:
                    default:
                        this._drawClassicFootprint(ctx, series, fp, barXPixel, barWidth, options, hRatio, vRatio);
                        break;
                }

                // Draw POC marker if enabled
                if (options.showPOC && fp.poc) {
                    this._drawPOCMarker(ctx, series, fp.poc, barXPixel, barWidth, options, hRatio, vRatio);
                }
            });
        });
    }

    _calculateBarWidth(timeScale, time, hRatio) {
        // Get approximate bar width from time scale
        const coord1 = timeScale.timeToCoordinate(time);
        const coord2 = timeScale.timeToCoordinate(time + 60); // Assume 1 minute for calculation

        if (coord1 !== null && coord2 !== null) {
            return Math.abs(coord2 - coord1) * hRatio * 0.8; // 80% of available width
        }

        return 60 * hRatio; // Default width
    }

    /**
     * Draw Delta Profile preset - shows delta value with color gradient
     */
    _drawDeltaProfile(ctx, series, fp, barX, barWidth, options, hRatio, vRatio) {
        const levels = Array.from(fp.levels.entries()).sort((a, b) => b[0] - a[0]);
        const cellWidth = Math.min(barWidth, options.cellWidth * hRatio);

        levels.forEach(([price, data]) => {
            const y = series.priceToCoordinate(price);
            if (y === null) return;

            const yPixel = y * vRatio;
            const cellHeight = this._calculateCellHeight(series, fp.tickSize, vRatio);

            // Calculate delta percentage
            const totalVolume = data.buyVolume + data.sellVolume;
            const deltaPercent = totalVolume > 0 ? (data.delta / totalVolume) * 100 : 0;

            // Draw cell background with delta gradient
            ctx.fillStyle = getDeltaGradient(deltaPercent);
            ctx.fillRect(
                barX - cellWidth / 2,
                yPixel - cellHeight / 2,
                cellWidth,
                cellHeight
            );

            // Draw imbalance highlight if present
            if (options.showImbalances && data.imbalance) {
                ctx.strokeStyle = getImbalanceColor(data.imbalance, data.imbalanceStrength || 1);
                ctx.lineWidth = 2 * hRatio;
                ctx.strokeRect(
                    barX - cellWidth / 2,
                    yPixel - cellHeight / 2,
                    cellWidth,
                    cellHeight
                );
            }

            // Draw delta text
            if (options.showDeltaText && cellHeight > 8 * vRatio) {
                ctx.fillStyle = COLORS.TEXT_LIGHT;
                ctx.font = `${options.fontSize * vRatio}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(formatDelta(data.delta), barX, yPixel);
            }
        });
    }

    /**
     * Draw Bid-Ask Profile preset - stacked buy/sell bars
     */
    _drawBidAskProfile(ctx, series, fp, barX, barWidth, options, hRatio, vRatio) {
        const levels = Array.from(fp.levels.entries()).sort((a, b) => b[0] - a[0]);
        const cellWidth = Math.min(barWidth, options.cellWidth * hRatio);
        const halfWidth = cellWidth / 2;

        // Find max volume for scaling
        let maxVolume = 0;
        levels.forEach(([price, data]) => {
            maxVolume = Math.max(maxVolume, data.buyVolume, data.sellVolume);
        });

        levels.forEach(([price, data]) => {
            const y = series.priceToCoordinate(price);
            if (y === null) return;

            const yPixel = y * vRatio;
            const cellHeight = this._calculateCellHeight(series, fp.tickSize, vRatio);

            // Calculate bar widths proportional to volume
            const buyBarWidth = maxVolume > 0 ? (data.buyVolume / maxVolume) * halfWidth : 0;
            const sellBarWidth = maxVolume > 0 ? (data.sellVolume / maxVolume) * halfWidth : 0;

            // Draw sell bar (left side, extending left)
            if (sellBarWidth > 0) {
                ctx.fillStyle = COLORS.SELL_BAR;
                ctx.fillRect(
                    barX - sellBarWidth,
                    yPixel - cellHeight / 2 + 1,
                    sellBarWidth,
                    cellHeight - 2
                );
            }

            // Draw buy bar (right side, extending right)
            if (buyBarWidth > 0) {
                ctx.fillStyle = COLORS.BUY_BAR;
                ctx.fillRect(
                    barX,
                    yPixel - cellHeight / 2 + 1,
                    buyBarWidth,
                    cellHeight - 2
                );
            }

            // Draw imbalance highlight
            if (options.showImbalances && data.imbalance) {
                ctx.fillStyle = COLORS.IMBALANCE_BUY;
                ctx.globalAlpha = 0.3;
                ctx.fillRect(
                    barX - halfWidth,
                    yPixel - cellHeight / 2,
                    cellWidth,
                    cellHeight
                );
                ctx.globalAlpha = 1;
            }

            // Draw volume text
            if (options.showVolumeText && cellHeight > 10 * vRatio) {
                ctx.fillStyle = COLORS.TEXT_SECONDARY;
                ctx.font = `${(options.fontSize - 2) * vRatio}px Arial`;

                // Sell volume on left
                ctx.textAlign = 'right';
                ctx.fillText(formatVolume(data.sellVolume), barX - 2 * hRatio, yPixel + 3 * vRatio);

                // Buy volume on right
                ctx.textAlign = 'left';
                ctx.fillText(formatVolume(data.buyVolume), barX + 2 * hRatio, yPixel + 3 * vRatio);
            }
        });
    }

    /**
     * Draw Volume Profile preset - total volume bars
     */
    _drawVolumeProfile(ctx, series, fp, barX, barWidth, options, hRatio, vRatio) {
        const levels = Array.from(fp.levels.entries()).sort((a, b) => b[0] - a[0]);
        const cellWidth = Math.min(barWidth, options.cellWidth * hRatio);

        // Find max volume for scaling
        let maxVolume = 0;
        levels.forEach(([price, data]) => {
            maxVolume = Math.max(maxVolume, data.buyVolume + data.sellVolume);
        });

        levels.forEach(([price, data]) => {
            const y = series.priceToCoordinate(price);
            if (y === null) return;

            const yPixel = y * vRatio;
            const cellHeight = this._calculateCellHeight(series, fp.tickSize, vRatio);
            const totalVolume = data.buyVolume + data.sellVolume;

            // Calculate bar width proportional to volume
            const volumeBarWidth = maxVolume > 0 ? (totalVolume / maxVolume) * cellWidth : 0;

            // Draw volume bar with delta color
            const deltaPercent = totalVolume > 0 ? (data.delta / totalVolume) * 100 : 0;
            ctx.fillStyle = getDeltaColor(deltaPercent);
            ctx.fillRect(
                barX - volumeBarWidth / 2,
                yPixel - cellHeight / 2 + 1,
                volumeBarWidth,
                cellHeight - 2
            );

            // Highlight POC level
            if (fp.poc && Math.abs(price - fp.poc) < fp.tickSize / 2) {
                ctx.strokeStyle = COLORS.POC;
                ctx.lineWidth = 2 * hRatio;
                ctx.strokeRect(
                    barX - cellWidth / 2,
                    yPixel - cellHeight / 2,
                    cellWidth,
                    cellHeight
                );
            }
        });
    }

    /**
     * Draw Classic Footprint - bid x ask numeric display
     */
    _drawClassicFootprint(ctx, series, fp, barX, barWidth, options, hRatio, vRatio) {
        const levels = Array.from(fp.levels.entries()).sort((a, b) => b[0] - a[0]);
        const cellWidth = Math.min(barWidth, options.cellWidth * hRatio);

        levels.forEach(([price, data]) => {
            const y = series.priceToCoordinate(price);
            if (y === null) return;

            const yPixel = y * vRatio;
            const cellHeight = this._calculateCellHeight(series, fp.tickSize, vRatio);

            // Draw cell background
            const deltaPercent = (data.buyVolume + data.sellVolume) > 0
                ? (data.delta / (data.buyVolume + data.sellVolume)) * 100
                : 0;
            ctx.fillStyle = getDeltaGradient(deltaPercent);
            ctx.globalAlpha = 0.5;
            ctx.fillRect(
                barX - cellWidth / 2,
                yPixel - cellHeight / 2,
                cellWidth,
                cellHeight
            );
            ctx.globalAlpha = 1;

            // Draw cell border
            ctx.strokeStyle = COLORS.CELL_BORDER;
            ctx.lineWidth = 1;
            ctx.strokeRect(
                barX - cellWidth / 2,
                yPixel - cellHeight / 2,
                cellWidth,
                cellHeight
            );

            // Draw imbalance highlight
            if (options.showImbalances && data.imbalance) {
                ctx.fillStyle = COLORS.IMBALANCE_BUY;
                ctx.globalAlpha = 0.4;
                ctx.fillRect(
                    barX - cellWidth / 2,
                    yPixel - cellHeight / 2,
                    cellWidth,
                    cellHeight
                );
                ctx.globalAlpha = 1;
            }

            // Draw text: "sellVol x buyVol"
            if (cellHeight > 10 * vRatio) {
                ctx.fillStyle = COLORS.TEXT_PRIMARY;
                ctx.font = `${options.fontSize * vRatio}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                const text = `${formatVolume(data.sellVolume)} x ${formatVolume(data.buyVolume)}`;
                ctx.fillText(text, barX, yPixel);
            }
        });
    }

    /**
     * Draw POC marker
     */
    _drawPOCMarker(ctx, series, pocPrice, barX, barWidth, options, hRatio, vRatio) {
        const y = series.priceToCoordinate(pocPrice);
        if (y === null) return;

        const yPixel = y * vRatio;
        const cellWidth = Math.min(barWidth, options.cellWidth * hRatio);

        // Draw POC indicator line
        ctx.beginPath();
        ctx.strokeStyle = COLORS.POC;
        ctx.lineWidth = 2 * hRatio;
        ctx.moveTo(barX - cellWidth / 2 - 5 * hRatio, yPixel);
        ctx.lineTo(barX - cellWidth / 2, yPixel);
        ctx.stroke();

        // Draw small arrow
        ctx.beginPath();
        ctx.fillStyle = COLORS.POC;
        ctx.moveTo(barX - cellWidth / 2 - 5 * hRatio, yPixel - 3 * vRatio);
        ctx.lineTo(barX - cellWidth / 2, yPixel);
        ctx.lineTo(barX - cellWidth / 2 - 5 * hRatio, yPixel + 3 * vRatio);
        ctx.closePath();
        ctx.fill();
    }

    /**
     * Calculate cell height based on tick size
     */
    _calculateCellHeight(series, tickSize, vRatio) {
        if (!tickSize) return 12 * vRatio;

        const y1 = series.priceToCoordinate(1000);
        const y2 = series.priceToCoordinate(1000 + tickSize);

        if (y1 !== null && y2 !== null) {
            return Math.max(Math.abs(y2 - y1) * vRatio, 8 * vRatio);
        }

        return 12 * vRatio;
    }
}

/**
 * Footprint Pane View - creates renderer for drawing
 */
class FootprintPaneView {
    constructor(source) {
        this._source = source;
    }

    update() {
        // Called when chart needs to update
    }

    renderer() {
        return new FootprintPaneRenderer(this._source);
    }

    zOrder() {
        return 'bottom'; // Draw behind candlesticks
    }
}

/**
 * Main Footprint Primitive class
 * Implements ISeriesPrimitive interface for lightweight-charts
 */
export class FootprintPrimitive {
    constructor(options = {}) {
        this._options = { ...DEFAULT_SETTINGS, ...options };
        this._footprints = [];
        this._paneViews = [new FootprintPaneView(this)];
        this._chart = null;
        this._series = null;
        this._requestUpdate = null;
    }

    /**
     * Called when primitive is attached to a series
     */
    attached({ chart, series, requestUpdate }) {
        this._chart = chart;
        this._series = series;
        this._requestUpdate = requestUpdate;
    }

    /**
     * Called when primitive is detached from series
     */
    detached() {
        this._chart = null;
        this._series = null;
        this._requestUpdate = null;
    }

    /**
     * Returns pane views for rendering
     */
    paneViews() {
        return this._paneViews;
    }

    /**
     * Trigger re-render of all views
     */
    updateAllViews() {
        this._paneViews.forEach(view => view.update());
        this._requestUpdate?.();
    }

    /**
     * Set footprint data
     * @param {Array} footprints - Array of footprint data per candle
     * Each footprint: { time, levels: Map<price, FootprintLevel>, poc, tickSize }
     */
    setData(footprints) {
        this._footprints = footprints || [];
        this.updateAllViews();
    }

    /**
     * Add a single footprint (for real-time updates)
     * @param {Object} footprint
     */
    addFootprint(footprint) {
        // Find existing footprint for this time and update, or add new
        const existingIndex = this._footprints.findIndex(fp => fp.time === footprint.time);
        if (existingIndex >= 0) {
            this._footprints[existingIndex] = footprint;
        } else {
            this._footprints.push(footprint);

            // Keep only last N footprints
            if (this._footprints.length > this._options.maxBarsToShow) {
                this._footprints.shift();
            }
        }
        this.updateAllViews();
    }

    /**
     * Get current options
     */
    options() {
        return this._options;
    }

    /**
     * Update options and re-render
     */
    applyOptions(options) {
        this._options = { ...this._options, ...options };
        this.updateAllViews();
    }

    /**
     * Clear all footprint data
     */
    clearData() {
        this._footprints = [];
        this.updateAllViews();
    }

    /**
     * Autoscale info - return null to not affect chart scaling
     */
    autoscaleInfo() {
        return null;
    }
}

export default FootprintPrimitive;
