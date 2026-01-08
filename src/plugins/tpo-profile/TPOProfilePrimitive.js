/**
 * TPO Profile Primitive for lightweight-charts
 * High-Contrast "Block + Letter" Rendering Style
 * 
 * Features:
 * - Each letter is drawn inside a solid colored block
 * - White text on colored background for maximum contrast
 * - Verdana Bold font for readability
 * - Profiles are positioned at their Session Start time
 */

import { getLetterColor, TPO_LINE_COLORS } from './TPOConstants';

const DEFAULT_OPTIONS = {
    // Display options
    visible: true,
    showLetters: true,
    showPOC: true,
    showValueArea: true,
    showInitialBalance: false,
    showVAH: true,
    showVAL: true,
    showPoorHigh: false,
    showPoorLow: false,
    useGradientColors: true,

    // Sizing - Optimized for Block+Letter style
    letterWidth: 14,
    letterHeight: 18,
    letterSpacing: 1,      // 1px gap between blocks
    maxLettersVisible: 40,

    // Colors
    pocColor: '#FFEB3B',     // Bright yellow
    pocLineWidth: 2,
    vahColor: '#26a69a',     // Teal
    valColor: '#ef5350',     // Red
    valueAreaColor: 'rgba(100, 181, 246, 0.1)', // Very faint background
    ibColor: 'rgba(255, 193, 7, 0.15)',
    ibBorderColor: '#FFC107',

    // Font
    fontSize: 10,
    fontFamily: 'Verdana, Arial, sans-serif',
};

/**
 * TPO Pane Renderer - handles actual Canvas2D drawing
 */
class TPOPaneRenderer {
    constructor(source) {
        this._source = source;
    }

    draw(target) {
        target.useBitmapCoordinateSpace((scope) => {
            const { context: ctx, bitmapSize, horizontalPixelRatio, verticalPixelRatio } = scope;
            const profiles = this._source._profiles;
            const options = this._source._options;
            const series = this._source._series;
            const chart = this._source._chart;

            if (!series || !chart || !profiles || profiles.length === 0 || options.visible === false) return;

            const timeScale = chart.timeScale();
            const chartWidth = bitmapSize.width;

            // Loop through ALL profiles
            for (const profile of profiles) {
                // Determine absolute X position based on time
                const startX = timeScale.timeToCoordinate(profile.sessionStart);

                // If startX is null, it means the start time is not currently visible on the time scale
                // If startX is null, check endX. If neither visible, skip.
                const endX = timeScale.timeToCoordinate(profile.sessionEnd);

                if (startX === null && endX === null) continue;

                // Handle valid StartX or fallback
                // If startX is null (offscreen left), we assume negative coordinate?
                // This is hard with lightweight-charts coordinate API. 
                // We'll trust whatever startX we get if it's not null, or 0 if it is but end matches?
                // For now, simple standard: skip if null.
                if (startX === null) continue;

                const scaledStartX = startX * horizontalPixelRatio;

                // Determine effective EndX for width calculation
                let scaledEndX;
                if (endX !== null) {
                    scaledEndX = endX * horizontalPixelRatio;
                } else {
                    // endX is null (offscreen right?).
                    // Assume enough space?
                    scaledEndX = chartWidth + 1000;
                }

                const availableWidth = scaledEndX - scaledStartX;

                // 1. Calculate Profile layout
                const maxCols = this._calculateMaxCols(profile, options);

                // Dynamic Block Sizing:
                // Calculate optimal block width to fit within session duration
                const idealBlockWidth = (availableWidth / Math.max(1, maxCols));
                const standardBlockWidth = options.letterWidth * horizontalPixelRatio;

                // Clamp:
                // - Max: standard letterWidth (don't get giant if zoomed way in)
                // - Min: 2px (don't vanish completely)
                // Note: idealBlockWidth is the LIMIT. We must be smaller than it to avoid overlap with NEXT session.
                // So we take min(standard, ideal).
                let blockWidth = Math.min(standardBlockWidth, idealBlockWidth);

                // Enforce minimum visibility
                // If blocks get smaller than 2px, we might still draw them as 1px lines potentially overlapping slightly, 
                // or we accept they are unreadable. 2px is a good minimum.
                blockWidth = Math.max(2 * horizontalPixelRatio, blockWidth);

                const profileWidth = maxCols * blockWidth;

                // Decide whether to show text (only if blocks are wide enough)
                const showText = blockWidth >= 8 * horizontalPixelRatio;

                // 2. Draw Value Area Background
                if (options.showValueArea && profile.vah && profile.val) {
                    this._drawValueArea(ctx, series, profile, options, scaledStartX, profileWidth, horizontalPixelRatio, verticalPixelRatio);
                }

                // 3. Draw Lines (POC, VAH, VAL)
                if (options.showPOC && profile.poc) {
                    this._drawPOCLine(ctx, series, profile.poc, options, scaledStartX, profileWidth, horizontalPixelRatio, verticalPixelRatio);
                }
                if (options.showVAH || options.showVAL) {
                    this._drawVALines(ctx, series, profile, options, scaledStartX, profileWidth, horizontalPixelRatio, verticalPixelRatio);
                }

                // 4. Draw Block+Letter TPO (Top Layer)
                this._drawTPOLetters(ctx, series, profile, options, scaledStartX, blockWidth, showText, horizontalPixelRatio, verticalPixelRatio);
            }
        });
    }

    _calculateMaxCols(profile, options) {
        let maxLen = 0;
        for (const levelData of profile.priceLevels.values()) {
            if (levelData.letters.size > maxLen) {
                maxLen = levelData.letters.size;
            }
        }
        return Math.min(maxLen, options.maxLettersVisible);
    }

    _drawTPOLetters(ctx, series, profile, options, startX, blockWidth, showText, hRatio, vRatio) {
        const fontSize = options.fontSize * vRatio;
        const rowHeight = options.letterHeight * vRatio;
        // Use reduced spacing if blocks are tiny
        const spacing = (blockWidth < 4 * hRatio) ? 0 : (1 * hRatio);

        if (showText) {
            ctx.font = `bold ${fontSize}px ${options.fontFamily}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
        }

        const sortedPrices = [...profile.priceLevels.keys()].sort((a, b) => b - a);

        for (const price of sortedPrices) {
            const levelData = profile.priceLevels.get(price);
            const y = series.priceToCoordinate(price);
            if (y === null) continue;

            const yPixel = Math.round(y * vRatio);
            const letters = [...levelData.letters].sort();

            let x = startX;

            letters.slice(0, options.maxLettersVisible).forEach((letter) => {
                let color = options.useGradientColors ? getLetterColor(letter) : '#26a69a';

                // Draw Solid background block
                ctx.fillStyle = color;
                ctx.fillRect(x, yPixel - rowHeight / 2 + 1, blockWidth - spacing, rowHeight - 2);

                // Draw White Text (only if space permits)
                if (showText) {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillText(letter, Math.round(x + (blockWidth - spacing) / 2), Math.round(yPixel + 1));
                }

                x += blockWidth;
            });

            // Overflow indicator
            if (letters.length > options.maxLettersVisible) {
                ctx.fillStyle = '#9E9E9E';
                if (showText) {
                    ctx.textAlign = 'left';
                    ctx.fillText('+', x + 2, yPixel);
                    ctx.textAlign = 'center';
                } else {
                    ctx.fillRect(x, yPixel - 2, 2 * hRatio, 4 * hRatio);
                }
            }
        }
    }

    _drawPOCLine(ctx, series, poc, options, startX, width, hRatio, vRatio) {
        const y = series.priceToCoordinate(poc);
        if (y === null) return;
        const yPixel = Math.round(y * vRatio);
        const endX = startX + width;

        ctx.beginPath();
        ctx.strokeStyle = options.pocColor;
        ctx.lineWidth = options.pocLineWidth * hRatio;
        ctx.setLineDash([6 * hRatio, 4 * hRatio]);
        ctx.moveTo(startX, yPixel);
        ctx.lineTo(endX + 30 * hRatio, yPixel); // Extend slightly
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = options.pocColor;
        ctx.font = `bold ${10 * vRatio}px ${options.fontFamily}`;
        ctx.textAlign = 'left';
        ctx.fillText('POC', endX + 32 * hRatio, yPixel + 3 * vRatio);
    }

    _drawVALines(ctx, series, profile, options, startX, width, hRatio, vRatio) {
        const endX = startX + width;

        if (options.showVAH && profile.vah) {
            const y = series.priceToCoordinate(profile.vah);
            if (y !== null) {
                const yPixel = Math.round(y * vRatio);
                ctx.beginPath();
                ctx.strokeStyle = options.vahColor;
                ctx.lineWidth = 1.5 * hRatio;
                ctx.setLineDash([4 * hRatio, 4 * hRatio]);
                ctx.moveTo(startX, yPixel);
                ctx.lineTo(endX, yPixel);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        if (options.showVAL && profile.val) {
            const y = series.priceToCoordinate(profile.val);
            if (y !== null) {
                const yPixel = Math.round(y * vRatio);
                ctx.beginPath();
                ctx.strokeStyle = options.valColor;
                ctx.lineWidth = 1.5 * hRatio;
                ctx.setLineDash([4 * hRatio, 4 * hRatio]);
                ctx.moveTo(startX, yPixel);
                ctx.lineTo(endX, yPixel);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
    }

    _drawValueArea(ctx, series, profile, options, startX, profileWidth, hRatio, vRatio) {
        const vahY = series.priceToCoordinate(profile.vah);
        const valY = series.priceToCoordinate(profile.val);
        if (vahY === null || valY === null) return;

        const top = Math.round(Math.min(vahY, valY) * vRatio);
        const bottom = Math.round(Math.max(vahY, valY) * vRatio);
        const height = bottom - top;

        ctx.fillStyle = options.valueAreaColor;
        // Draw background corresponding to profile width
        ctx.fillRect(startX, top, profileWidth, height);
    }
}

class TPOPaneView {
    constructor(source) { this._source = source; }
    update() { }
    renderer() { return new TPOPaneRenderer(this._source); }
    zOrder() { return 'top'; }
}

export class TPOProfilePrimitive {
    constructor(options = {}) {
        this._options = { ...DEFAULT_OPTIONS, ...options };
        this._profiles = [];
        this._paneViews = [new TPOPaneView(this)];
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
    paneViews() { return this._paneViews; }
    updateAllViews() {
        this._paneViews.forEach(view => view.update());
        this._requestUpdate?.();
    }
    setData(profiles) {
        this._profiles = profiles || [];
        this.updateAllViews();
    }
    options() { return this._options; }
    applyOptions(options) {
        this._options = { ...this._options, ...options };
        this.updateAllViews();
    }
    autoscaleInfo() { return null; }
}

export default TPOProfilePrimitive;
