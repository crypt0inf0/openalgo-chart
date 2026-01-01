/**
 * Cumulative Delta Primitive for lightweight-charts
 * Renders cumulative delta as a line overlay on the price chart
 */

import {
    COLORS,
    DEFAULT_DELTA_SETTINGS,
    getCDLineColor,
    formatDeltaValue,
} from './DeltaConstants';

/**
 * Cumulative Delta Pane Renderer
 */
class CumulativeDeltaPaneRenderer {
    constructor(source) {
        this._source = source;
    }

    draw(target) {
        target.useBitmapCoordinateSpace((scope) => {
            const { context: ctx, bitmapSize, horizontalPixelRatio, verticalPixelRatio } = scope;
            const cdData = this._source._cdData;
            const options = this._source._options;
            const series = this._source._series;
            const chart = this._source._chart;

            if (!series || !chart || !cdData || cdData.length === 0) return;

            const chartWidth = bitmapSize.width;
            const chartHeight = bitmapSize.height;
            const timeScale = chart.timeScale();

            const hRatio = horizontalPixelRatio;
            const vRatio = verticalPixelRatio;

            // Calculate CD range for scaling
            let minCD = Infinity;
            let maxCD = -Infinity;
            cdData.forEach(d => {
                minCD = Math.min(minCD, d.cumulativeDelta);
                maxCD = Math.max(maxCD, d.cumulativeDelta);
            });

            const cdRange = maxCD - minCD;
            if (cdRange === 0) return;

            // Scale CD to chart height (use right portion of chart)
            const cdAreaWidth = 100 * hRatio;
            const cdAreaLeft = chartWidth - cdAreaWidth - 10 * hRatio;
            const cdAreaTop = 50 * vRatio;
            const cdAreaHeight = chartHeight - 100 * vRatio;

            // Draw CD line
            ctx.beginPath();
            ctx.strokeStyle = options.cdLineColor || COLORS.CD_LINE_UP;
            ctx.lineWidth = options.cdLineWidth * hRatio;
            ctx.lineJoin = 'round';

            let isFirst = true;
            let prevCD = 0;

            cdData.forEach((d, idx) => {
                const barX = timeScale.timeToCoordinate(d.time);
                if (barX === null) return;

                const barXPixel = barX * hRatio;

                // Calculate Y position based on CD value
                const normalizedCD = (d.cumulativeDelta - minCD) / cdRange;
                const yPixel = cdAreaTop + cdAreaHeight * (1 - normalizedCD);

                if (isFirst) {
                    ctx.moveTo(barXPixel, yPixel);
                    isFirst = false;
                } else {
                    // Change color based on direction
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.strokeStyle = getCDLineColor(d.cumulativeDelta, prevCD);
                    ctx.moveTo(barXPixel, yPixel);
                }

                ctx.lineTo(barXPixel, yPixel);
                prevCD = d.cumulativeDelta;

                // Draw divergence markers
                if (options.showDivergences && d.divergence) {
                    this._drawDivergenceMarker(ctx, barXPixel, yPixel, d.divergence, hRatio, vRatio);
                }
            });

            ctx.stroke();

            // Draw zero reference line
            if (minCD <= 0 && maxCD >= 0) {
                const zeroY = cdAreaTop + cdAreaHeight * (1 - (-minCD) / cdRange);
                ctx.beginPath();
                ctx.strokeStyle = COLORS.ZERO_LINE;
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]);
                ctx.moveTo(0, zeroY);
                ctx.lineTo(chartWidth, zeroY);
                ctx.stroke();
                ctx.setLineDash([]);

                // Label
                ctx.fillStyle = COLORS.TEXT_SECONDARY;
                ctx.font = `${9 * vRatio}px Arial`;
                ctx.textAlign = 'right';
                ctx.fillText('CD: 0', chartWidth - 5 * hRatio, zeroY - 3 * vRatio);
            }

            // Draw current CD value
            if (cdData.length > 0) {
                const lastCD = cdData[cdData.length - 1].cumulativeDelta;
                ctx.fillStyle = lastCD >= 0 ? COLORS.CD_LINE_UP : COLORS.CD_LINE_DOWN;
                ctx.font = `bold ${11 * vRatio}px Arial`;
                ctx.textAlign = 'right';
                ctx.fillText(
                    `CD: ${formatDeltaValue(lastCD)}`,
                    chartWidth - 5 * hRatio,
                    15 * vRatio
                );
            }
        });
    }

    _drawDivergenceMarker(ctx, x, y, divergenceType, hRatio, vRatio) {
        const size = 6 * hRatio;

        ctx.beginPath();
        ctx.fillStyle = divergenceType === 'bullish'
            ? COLORS.BULLISH_DIVERGENCE
            : COLORS.BEARISH_DIVERGENCE;

        if (divergenceType === 'bullish') {
            // Upward triangle
            ctx.moveTo(x, y - size);
            ctx.lineTo(x - size / 2, y);
            ctx.lineTo(x + size / 2, y);
        } else {
            // Downward triangle
            ctx.moveTo(x, y + size);
            ctx.lineTo(x - size / 2, y);
            ctx.lineTo(x + size / 2, y);
        }

        ctx.closePath();
        ctx.fill();
    }
}

/**
 * Cumulative Delta Pane View
 */
class CumulativeDeltaPaneView {
    constructor(source) {
        this._source = source;
    }

    update() {}

    renderer() {
        return new CumulativeDeltaPaneRenderer(this._source);
    }

    zOrder() {
        return 'top'; // Draw on top of candles
    }
}

/**
 * Main Cumulative Delta Primitive class
 */
export class CumulativeDeltaPrimitive {
    constructor(options = {}) {
        this._options = { ...DEFAULT_DELTA_SETTINGS, ...options };
        this._cdData = [];
        this._paneViews = [new CumulativeDeltaPaneView(this)];
        this._chart = null;
        this._series = null;
        this._requestUpdate = null;
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

    updateAllViews() {
        this._paneViews.forEach(view => view.update());
        this._requestUpdate?.();
    }

    /**
     * Set cumulative delta data
     * @param {Array<{time: number, delta: number, cumulativeDelta: number, divergence?: string}>} data
     */
    setData(data) {
        this._cdData = data || [];
        this.updateAllViews();
    }

    /**
     * Add or update a CD point
     */
    addCDPoint(cdPoint) {
        const existingIndex = this._cdData.findIndex(d => d.time === cdPoint.time);
        if (existingIndex >= 0) {
            this._cdData[existingIndex] = cdPoint;
        } else {
            this._cdData.push(cdPoint);
        }
        this.updateAllViews();
    }

    options() {
        return this._options;
    }

    applyOptions(options) {
        this._options = { ...this._options, ...options };
        this.updateAllViews();
    }

    clearData() {
        this._cdData = [];
        this.updateAllViews();
    }

    autoscaleInfo() {
        return null;
    }
}

export default CumulativeDeltaPrimitive;
