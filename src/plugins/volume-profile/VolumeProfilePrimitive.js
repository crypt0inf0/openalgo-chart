/**
 * Enhanced Volume Profile Primitive for lightweight-charts
 * Supports Session, Fixed Range, and Composite profiles
 * Shows POC, VAH, VAL, HVN, LVN with multiple display modes
 */

import {
    COLORS,
    DEFAULT_SETTINGS,
    PROFILE_TYPES,
    DISPLAY_MODES,
    formatVolume,
    getVolumeBarColor,
} from './VolumeProfileConstants';

/**
 * Volume Profile Pane Renderer
 */
class VolumeProfilePaneRenderer {
    constructor(source) {
        this._source = source;
    }

    draw(target) {
        target.useBitmapCoordinateSpace((scope) => {
            const { context: ctx, bitmapSize, horizontalPixelRatio, verticalPixelRatio } = scope;
            const profileData = this._source._profileData;
            const options = this._source._options;
            const series = this._source._series;
            const chart = this._source._chart;

            if (!series || !chart || !profileData || !profileData.levels) return;

            const chartWidth = bitmapSize.width;
            const chartHeight = bitmapSize.height;

            const hRatio = horizontalPixelRatio;
            const vRatio = verticalPixelRatio;

            // Calculate profile area
            const profileWidth = options.width * hRatio;
            let profileX;

            switch (options.position) {
                case 'left':
                    profileX = 10 * hRatio;
                    break;
                case 'overlay':
                    profileX = chartWidth * 0.5 - profileWidth / 2;
                    break;
                case 'right':
                default:
                    profileX = chartWidth - profileWidth - 60 * hRatio;
                    break;
            }

            // Find max volume for scaling
            let maxVolume = 0;
            profileData.levels.forEach(level => {
                const total = level.buyVolume + level.sellVolume;
                maxVolume = Math.max(maxVolume, total);
            });

            if (maxVolume === 0) return;

            // Draw profile background
            ctx.fillStyle = COLORS.PROFILE_BACKGROUND;
            const minPrice = Math.min(...profileData.levels.map(l => l.price));
            const maxPrice = Math.max(...profileData.levels.map(l => l.price));
            const minY = series.priceToCoordinate(maxPrice);
            const maxY = series.priceToCoordinate(minPrice);

            if (minY !== null && maxY !== null) {
                ctx.fillRect(
                    profileX - 5 * hRatio,
                    minY * vRatio,
                    profileWidth + 10 * hRatio,
                    (maxY - minY) * vRatio
                );
            }

            // Draw Value Area shading first (background)
            if (options.showValueArea && profileData.vah && profileData.val) {
                this._drawValueArea(ctx, series, profileData, profileX, profileWidth, options, hRatio, vRatio);
            }

            // Draw volume bars
            profileData.levels.forEach(level => {
                const y = series.priceToCoordinate(level.price);
                if (y === null) return;

                const yPixel = y * vRatio;
                const rowHeight = this._calculateRowHeight(series, profileData.tickSize, vRatio);
                const totalVolume = level.buyVolume + level.sellVolume;
                const barWidth = (totalVolume / maxVolume) * profileWidth;

                // Draw based on display mode
                if (options.displayMode === DISPLAY_MODES.BID_ASK) {
                    this._drawBidAskBar(ctx, level, profileX, yPixel, rowHeight, barWidth, maxVolume, profileWidth, hRatio);
                } else if (options.displayMode === DISPLAY_MODES.DELTA) {
                    this._drawDeltaBar(ctx, level, profileX, yPixel, rowHeight, barWidth, options);
                } else {
                    this._drawTotalVolumeBar(ctx, level, profileX, yPixel, rowHeight, barWidth, options);
                }

                // Highlight POC
                if (options.showPOC && profileData.poc && Math.abs(level.price - profileData.poc) < (profileData.tickSize || 0.05) / 2) {
                    ctx.strokeStyle = COLORS.POC;
                    ctx.lineWidth = 2 * hRatio;
                    ctx.strokeRect(profileX, yPixel - rowHeight / 2, barWidth, rowHeight);
                }

                // Volume label
                if (options.showVolumeLabels && barWidth > 30 * hRatio) {
                    ctx.fillStyle = COLORS.TEXT_LABEL;
                    ctx.font = `${options.fontSize * vRatio}px Arial`;
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(formatVolume(totalVolume), profileX + 3 * hRatio, yPixel);
                }
            });

            // Draw POC line extended
            if (options.showPOC && options.extendPOC && profileData.poc) {
                this._drawPOCLine(ctx, series, profileData.poc, chartWidth, options, hRatio, vRatio);
            }

            // Draw VAH/VAL lines
            if (options.showVAH && profileData.vah) {
                this._drawVALine(ctx, series, profileData.vah, 'VAH', chartWidth, options, hRatio, vRatio);
            }
            if (options.showVAL && profileData.val) {
                this._drawVALine(ctx, series, profileData.val, 'VAL', chartWidth, options, hRatio, vRatio);
            }

            // Draw HVN markers
            if (options.showHVN && profileData.hvn) {
                profileData.hvn.forEach(price => {
                    this._drawHVNMarker(ctx, series, price, profileX, profileWidth, hRatio, vRatio);
                });
            }

            // Draw LVN markers
            if (options.showLVN && profileData.lvn) {
                profileData.lvn.forEach(price => {
                    this._drawLVNMarker(ctx, series, price, profileX, profileWidth, hRatio, vRatio);
                });
            }

            // Draw profile label
            ctx.fillStyle = COLORS.TEXT_SECONDARY;
            ctx.font = `${10 * vRatio}px Arial`;
            ctx.textAlign = 'left';
            ctx.fillText('Volume Profile', profileX, 15 * vRatio);
        });
    }

    _drawTotalVolumeBar(ctx, level, x, y, height, width, options) {
        ctx.fillStyle = options.volumeColor || COLORS.VOLUME_BAR;
        ctx.globalAlpha = options.opacity;
        ctx.fillRect(x, y - height / 2 + 1, width, height - 2);
        ctx.globalAlpha = 1;
    }

    _drawBidAskBar(ctx, level, x, y, height, totalWidth, maxVolume, profileWidth, hRatio) {
        const total = level.buyVolume + level.sellVolume;
        const buyWidth = total > 0 ? (level.buyVolume / total) * totalWidth : 0;
        const sellWidth = totalWidth - buyWidth;

        // Sell bar (left)
        if (sellWidth > 0) {
            ctx.fillStyle = COLORS.SELL_VOLUME;
            ctx.fillRect(x, y - height / 2 + 1, sellWidth, height - 2);
        }

        // Buy bar (right of sell)
        if (buyWidth > 0) {
            ctx.fillStyle = COLORS.BUY_VOLUME;
            ctx.fillRect(x + sellWidth, y - height / 2 + 1, buyWidth, height - 2);
        }
    }

    _drawDeltaBar(ctx, level, x, y, height, width, options) {
        const delta = level.buyVolume - level.sellVolume;
        const total = level.buyVolume + level.sellVolume;
        const deltaPercent = total > 0 ? (delta / total) * 100 : 0;

        // Color based on delta
        if (deltaPercent > 20) {
            ctx.fillStyle = COLORS.BUY_VOLUME;
        } else if (deltaPercent < -20) {
            ctx.fillStyle = COLORS.SELL_VOLUME;
        } else {
            ctx.fillStyle = COLORS.VOLUME_BAR;
        }

        ctx.globalAlpha = options.opacity;
        ctx.fillRect(x, y - height / 2 + 1, width, height - 2);
        ctx.globalAlpha = 1;
    }

    _drawValueArea(ctx, series, profileData, profileX, profileWidth, options, hRatio, vRatio) {
        const vahY = series.priceToCoordinate(profileData.vah);
        const valY = series.priceToCoordinate(profileData.val);

        if (vahY === null || valY === null) return;

        ctx.fillStyle = COLORS.VALUE_AREA_FILL;
        ctx.fillRect(
            profileX - 5 * hRatio,
            vahY * vRatio,
            profileWidth + 10 * hRatio,
            (valY - vahY) * vRatio
        );

        ctx.strokeStyle = COLORS.VALUE_AREA_BORDER;
        ctx.lineWidth = 1;
        ctx.strokeRect(
            profileX - 5 * hRatio,
            vahY * vRatio,
            profileWidth + 10 * hRatio,
            (valY - vahY) * vRatio
        );
    }

    _drawPOCLine(ctx, series, pocPrice, chartWidth, options, hRatio, vRatio) {
        const y = series.priceToCoordinate(pocPrice);
        if (y === null) return;

        const yPixel = y * vRatio;

        ctx.beginPath();
        ctx.strokeStyle = COLORS.POC_LINE;
        ctx.lineWidth = 2 * hRatio;
        ctx.setLineDash([5 * hRatio, 3 * hRatio]);
        ctx.moveTo(0, yPixel);
        ctx.lineTo(chartWidth, yPixel);
        ctx.stroke();
        ctx.setLineDash([]);

        // POC label
        ctx.fillStyle = COLORS.POC;
        ctx.font = `bold ${9 * vRatio}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText('POC', 5 * hRatio, yPixel - 3 * vRatio);
    }

    _drawVALine(ctx, series, price, label, chartWidth, options, hRatio, vRatio) {
        const y = series.priceToCoordinate(price);
        if (y === null) return;

        const yPixel = y * vRatio;

        ctx.beginPath();
        ctx.strokeStyle = COLORS.VAH;
        ctx.lineWidth = 1 * hRatio;
        ctx.setLineDash([3 * hRatio, 3 * hRatio]);
        ctx.moveTo(0, yPixel);
        ctx.lineTo(chartWidth, yPixel);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label
        ctx.fillStyle = COLORS.VAH;
        ctx.font = `${8 * vRatio}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText(label, 5 * hRatio, yPixel - 2 * vRatio);
    }

    _drawHVNMarker(ctx, series, price, profileX, profileWidth, hRatio, vRatio) {
        const y = series.priceToCoordinate(price);
        if (y === null) return;

        const yPixel = y * vRatio;

        // Small triangle marker
        ctx.beginPath();
        ctx.fillStyle = COLORS.HVN;
        ctx.moveTo(profileX + profileWidth + 5 * hRatio, yPixel);
        ctx.lineTo(profileX + profileWidth + 12 * hRatio, yPixel - 4 * vRatio);
        ctx.lineTo(profileX + profileWidth + 12 * hRatio, yPixel + 4 * vRatio);
        ctx.closePath();
        ctx.fill();
    }

    _drawLVNMarker(ctx, series, price, profileX, profileWidth, hRatio, vRatio) {
        const y = series.priceToCoordinate(price);
        if (y === null) return;

        const yPixel = y * vRatio;

        // Small circle marker
        ctx.beginPath();
        ctx.fillStyle = COLORS.LVN;
        ctx.arc(profileX + profileWidth + 8 * hRatio, yPixel, 3 * hRatio, 0, Math.PI * 2);
        ctx.fill();
    }

    _calculateRowHeight(series, tickSize, vRatio) {
        if (!tickSize) return 10 * vRatio;

        const y1 = series.priceToCoordinate(1000);
        const y2 = series.priceToCoordinate(1000 + tickSize);

        if (y1 !== null && y2 !== null) {
            return Math.max(Math.abs(y2 - y1) * vRatio, 6 * vRatio);
        }

        return 10 * vRatio;
    }
}

/**
 * Volume Profile Pane View
 */
class VolumeProfilePaneView {
    constructor(source) {
        this._source = source;
    }

    update() {}

    renderer() {
        return new VolumeProfilePaneRenderer(this._source);
    }

    zOrder() {
        return 'bottom';
    }
}

/**
 * Main Volume Profile Primitive class
 */
export class VolumeProfilePrimitive {
    constructor(options = {}) {
        this._options = { ...DEFAULT_SETTINGS, ...options };
        this._profileData = null;
        this._paneViews = [new VolumeProfilePaneView(this)];
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
     * Set volume profile data
     * @param {Object} data - { levels: Array, poc, vah, val, hvn, lvn, tickSize }
     */
    setData(data) {
        this._profileData = data;
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
        this._profileData = null;
        this.updateAllViews();
    }

    autoscaleInfo() {
        return null;
    }
}

export default VolumeProfilePrimitive;
