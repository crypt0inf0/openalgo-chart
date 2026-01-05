import { CanvasRenderingTarget2D } from 'fancy-canvas';
import {
    Coordinate,
    DataChangedScope,
    ISeriesPrimitive,
    IPrimitivePaneRenderer,
    IPrimitivePaneView,
    SeriesAttachedParameter,
    SeriesDataItemTypeMap,
    PrimitivePaneViewZOrder,
    SeriesType,
    Time,
} from 'lightweight-charts';
import { PluginBase } from '../../plugin-base';

interface SessionLineRendererData {
    x: Coordinate | number;
    isSessionStart: boolean;
}

class SessionHighlightingPaneRenderer implements IPrimitivePaneRenderer {
    _viewData: SessionHighlightingViewData;
    constructor(data: SessionHighlightingViewData) {
        this._viewData = data;
    }
    draw(target: CanvasRenderingTarget2D) {
        const points: SessionLineRendererData[] = this._viewData.data;
        target.useBitmapCoordinateSpace(scope => {
            const ctx = scope.context;
            const height = scope.bitmapSize.height;
            const maxX = scope.bitmapSize.width;

            // Draw dashed vertical lines at session starts
            ctx.strokeStyle = this._viewData.options.lineColor;
            ctx.lineWidth = this._viewData.options.lineWidth * scope.horizontalPixelRatio;
            ctx.setLineDash([5 * scope.verticalPixelRatio, 3 * scope.verticalPixelRatio]);

            points.forEach(point => {
                if (!point.isSessionStart) return;

                const xScaled = Math.round(point.x * scope.horizontalPixelRatio);
                if (xScaled < 0 || xScaled > maxX) return;

                ctx.beginPath();
                ctx.moveTo(xScaled, 0);
                ctx.lineTo(xScaled, height);
                ctx.stroke();
            });

            // Reset line dash
            ctx.setLineDash([]);
        });
    }
}

interface SessionHighlightingViewData {
    data: SessionLineRendererData[];
    options: Required<SessionHighlightingOptions>;
    barWidth: number;
}

class SessionHighlightingPaneView implements IPrimitivePaneView {
    _source: SessionHighlighting;
    _data: SessionHighlightingViewData;

    constructor(source: SessionHighlighting) {
        this._source = source;
        this._data = {
            data: [],
            barWidth: 6,
            options: this._source._options,
        };
    }

    update() {
        try {
            // Defensive check: ensure source and chart are available
            if (!this._source || !this._source._sessionMarkers) {
                return;
            }

            // Check if chart is accessible (plugin might be detached)
            let timeScale;
            try {
                timeScale = this._source.chart.timeScale();
            } catch (e) {
                // Chart might be disposed or plugin not attached
                return;
            }

            if (!timeScale) {
                return;
            }

            this._data.data = this._source._sessionMarkers.map(d => {
                return {
                    x: timeScale.timeToCoordinate(d.time) ?? -100,
                    isSessionStart: d.isSessionStart,
                };
            });
            this._data.options = this._source._options;
        } catch (error) {
            console.warn('[SessionHighlighting] Error in update:', error);
        }
    }

    renderer() {
        return new SessionHighlightingPaneRenderer(this._data);
    }

    zOrder(): PrimitivePaneViewZOrder {
        return 'bottom';
    }
}

export interface SessionHighlightingOptions {
    lineColor?: string;
    lineWidth?: number;
}

const defaults: Required<SessionHighlightingOptions> = {
    lineColor: '#363A45',
    lineWidth: 1,
};

interface SessionMarkerData {
    time: Time;
    isSessionStart: boolean;
}

// Session start times map: date string (YYYY-MM-DD) -> epoch timestamp in seconds
export type SessionStartTimesMap = Map<string, number>;

export class SessionHighlighting
    extends PluginBase
    implements ISeriesPrimitive<Time> {
    _paneViews: SessionHighlightingPaneView[];
    _seriesData: SeriesDataItemTypeMap[SeriesType][] = [];
    _sessionMarkers: SessionMarkerData[] = [];
    _options: Required<SessionHighlightingOptions>;
    _sessionStartTimes: SessionStartTimesMap | null = null;

    constructor(
        options: SessionHighlightingOptions = {}
    ) {
        super();
        this._options = { ...defaults, ...options };
        this._paneViews = [new SessionHighlightingPaneView(this)];
    }

    /**
     * Set session start times from API data
     * @param sessionStartTimes Map of date (YYYY-MM-DD) to session start epoch (seconds)
     */
    setSessionStartTimes(sessionStartTimes: SessionStartTimesMap): void {
        this._sessionStartTimes = sessionStartTimes;
        this.dataUpdated('full');
    }

    updateAllViews() {
        this._paneViews.forEach(pw => pw.update());
    }

    paneViews() {
        return this._paneViews;
    }

    attached(p: SeriesAttachedParameter<Time>): void {
        super.attached(p);
        this.dataUpdated('full');
    }

    dataUpdated(_scope: DataChangedScope) {
        // Get series data with safety check
        let data;
        try {
            data = this.series.data();
        } catch (e) {
            console.warn('[SessionHighlighting] Cannot get series data:', e);
            return;
        }

        // Early return if no data
        if (!data || data.length === 0) {
            console.log('[SessionHighlighting] No data available, skipping dataUpdated');
            return;
        }

        console.log('[SessionHighlighting] dataUpdated called with', data.length, 'candles, sessionStartTimes:', this._sessionStartTimes?.size || 0);

        // Detect session starts by date changes between consecutive candles
        // This works regardless of whether we have API session data
        let prevDateStr: string | null = null;

        this._sessionMarkers = data.map(dataPoint => {
            const time = dataPoint.time as number;
            const date = new Date(time * 1000);
            const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format

            // Mark as session start when date changes from previous candle
            const isSessionStart = prevDateStr !== null && prevDateStr !== dateStr;
            prevDateStr = dateStr;

            return {
                time: dataPoint.time,
                isSessionStart: isSessionStart,
            };
        });

        // Count how many session starts we detected
        const sessionStartCount = this._sessionMarkers.filter(m => m.isSessionStart).length;
        console.log('[SessionHighlighting] Detected', sessionStartCount, 'session starts');

        this.updateAllViews();
        this.requestUpdate();
    }
}
