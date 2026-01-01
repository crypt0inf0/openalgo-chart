/**
 * Bar Statistics Primitive for lightweight-charts
 * Displays per-bar volume metrics in a grid panel below the chart
 */

const COLORS = {
    BACKGROUND: 'rgba(30, 34, 45, 0.95)',
    BORDER: 'rgba(255, 255, 255, 0.1)',
    HEADER_BG: 'rgba(42, 46, 57, 0.9)',
    TEXT_PRIMARY: '#D1D4DC',
    TEXT_SECONDARY: '#787B86',
    TEXT_POSITIVE: '#26A69A',
    TEXT_NEGATIVE: '#EF5350',
    ROW_HOVER: 'rgba(255, 255, 255, 0.05)',
    POC_HIGHLIGHT: 'rgba(255, 152, 0, 0.2)',
};

const DEFAULT_SETTINGS = {
    // Display options
    showPanel: true,
    panelHeight: 120,

    // Metrics to show
    showVolume: true,
    showDelta: true,
    showDeltaPercent: true,
    showPOC: true,
    showVWAP: true,
    showBuyVWAP: false,
    showSellVWAP: false,
    showTrades: false,

    // Styling
    fontSize: 10,
    headerFontSize: 9,
    columnWidth: 80,
};

/**
 * Format number for display
 */
const formatNumber = (num, decimals = 2) => {
    if (num === undefined || num === null || isNaN(num)) return '-';
    if (Math.abs(num) >= 10000000) return `${(num / 10000000).toFixed(1)}Cr`;
    if (Math.abs(num) >= 100000) return `${(num / 100000).toFixed(1)}L`;
    if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(decimals);
};

/**
 * Bar Stats Pane Renderer
 */
class BarStatsPaneRenderer {
    constructor(source) {
        this._source = source;
    }

    draw(target) {
        target.useBitmapCoordinateSpace((scope) => {
            const { context: ctx, bitmapSize, horizontalPixelRatio, verticalPixelRatio } = scope;
            const barStats = this._source._barStats;
            const options = this._source._options;
            const series = this._source._series;
            const chart = this._source._chart;

            if (!series || !chart || !barStats || barStats.length === 0 || !options.showPanel) return;

            const chartWidth = bitmapSize.width;
            const chartHeight = bitmapSize.height;
            const timeScale = chart.timeScale();

            const hRatio = horizontalPixelRatio;
            const vRatio = verticalPixelRatio;

            // Panel dimensions
            const panelHeight = options.panelHeight * vRatio;
            const panelTop = chartHeight - panelHeight;

            // Draw panel background
            ctx.fillStyle = COLORS.BACKGROUND;
            ctx.fillRect(0, panelTop, chartWidth, panelHeight);

            // Draw header row
            const headerHeight = 20 * vRatio;
            ctx.fillStyle = COLORS.HEADER_BG;
            ctx.fillRect(0, panelTop, chartWidth, headerHeight);

            // Build column headers based on enabled metrics
            const columns = this._getColumns(options);
            const rowHeight = (panelHeight - headerHeight) / Math.min(barStats.length, 5);

            // Draw headers
            ctx.fillStyle = COLORS.TEXT_SECONDARY;
            ctx.font = `${options.headerFontSize * vRatio}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            let headerX = 60 * hRatio; // Leave space for time column
            ctx.textAlign = 'left';
            ctx.fillText('Time', 5 * hRatio, panelTop + headerHeight / 2);

            columns.forEach(col => {
                ctx.textAlign = 'center';
                ctx.fillText(col.label, headerX + col.width * hRatio / 2, panelTop + headerHeight / 2);
                headerX += col.width * hRatio;
            });

            // Draw data rows (most recent bars)
            const visibleBars = barStats.slice(-5).reverse();
            visibleBars.forEach((stat, rowIndex) => {
                const rowY = panelTop + headerHeight + rowIndex * rowHeight;

                // Alternate row background
                if (rowIndex % 2 === 0) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
                    ctx.fillRect(0, rowY, chartWidth, rowHeight);
                }

                // Time column
                ctx.fillStyle = COLORS.TEXT_PRIMARY;
                ctx.font = `${options.fontSize * vRatio}px Arial`;
                ctx.textAlign = 'left';
                const time = new Date(stat.time * 1000);
                ctx.fillText(
                    time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
                    5 * hRatio,
                    rowY + rowHeight / 2
                );

                // Data columns
                let dataX = 60 * hRatio;
                columns.forEach(col => {
                    const value = stat[col.key];
                    ctx.textAlign = 'center';

                    // Color based on value type
                    if (col.key === 'delta' || col.key === 'deltaPercent') {
                        ctx.fillStyle = value >= 0 ? COLORS.TEXT_POSITIVE : COLORS.TEXT_NEGATIVE;
                    } else {
                        ctx.fillStyle = COLORS.TEXT_PRIMARY;
                    }

                    let displayValue = formatNumber(value, col.decimals || 2);
                    if (col.key === 'deltaPercent' && value !== undefined) {
                        displayValue = `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
                    }

                    ctx.fillText(displayValue, dataX + col.width * hRatio / 2, rowY + rowHeight / 2);
                    dataX += col.width * hRatio;
                });
            });

            // Draw panel border
            ctx.strokeStyle = COLORS.BORDER;
            ctx.lineWidth = 1;
            ctx.strokeRect(0, panelTop, chartWidth, panelHeight);

            // Draw "Bar Stats" label
            ctx.fillStyle = COLORS.TEXT_SECONDARY;
            ctx.font = `bold ${10 * vRatio}px Arial`;
            ctx.textAlign = 'right';
            ctx.fillText('Bar Stats', chartWidth - 10 * hRatio, panelTop + headerHeight / 2);
        });
    }

    _getColumns(options) {
        const columns = [];

        if (options.showVolume) {
            columns.push({ label: 'Volume', key: 'totalVolume', width: 70, decimals: 0 });
        }
        if (options.showDelta) {
            columns.push({ label: 'Delta', key: 'delta', width: 70, decimals: 0 });
        }
        if (options.showDeltaPercent) {
            columns.push({ label: 'Delta%', key: 'deltaPercent', width: 60, decimals: 1 });
        }
        if (options.showPOC) {
            columns.push({ label: 'POC', key: 'poc', width: 70, decimals: 2 });
        }
        if (options.showVWAP) {
            columns.push({ label: 'VWAP', key: 'vwap', width: 70, decimals: 2 });
        }
        if (options.showBuyVWAP) {
            columns.push({ label: 'BVWAP', key: 'buyVwap', width: 70, decimals: 2 });
        }
        if (options.showSellVWAP) {
            columns.push({ label: 'SVWAP', key: 'sellVwap', width: 70, decimals: 2 });
        }
        if (options.showTrades) {
            columns.push({ label: 'Trades', key: 'totalTrades', width: 60, decimals: 0 });
        }

        return columns;
    }
}

/**
 * Bar Stats Pane View
 */
class BarStatsPaneView {
    constructor(source) {
        this._source = source;
    }

    update() {}

    renderer() {
        return new BarStatsPaneRenderer(this._source);
    }

    zOrder() {
        return 'top';
    }
}

/**
 * Main Bar Stats Primitive class
 */
export class BarStatsPrimitive {
    constructor(options = {}) {
        this._options = { ...DEFAULT_SETTINGS, ...options };
        this._barStats = [];
        this._paneViews = [new BarStatsPaneView(this)];
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
     * Set bar statistics data
     * @param {Array} data - Array of per-bar statistics
     */
    setData(data) {
        this._barStats = data || [];
        this.updateAllViews();
    }

    addBarStats(stats) {
        const existingIndex = this._barStats.findIndex(s => s.time === stats.time);
        if (existingIndex >= 0) {
            this._barStats[existingIndex] = stats;
        } else {
            this._barStats.push(stats);
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
        this._barStats = [];
        this.updateAllViews();
    }

    autoscaleInfo() {
        return null;
    }
}

export default BarStatsPrimitive;
