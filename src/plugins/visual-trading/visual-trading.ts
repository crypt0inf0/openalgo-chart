
import {
    IChartApi,
    ISeriesApi,
    ISeriesPrimitive,
    SeriesAttachedParameter,
    SeriesType,
    Time,
    Coordinate,
    MouseEventParams,
} from 'lightweight-charts';
import { VisualTradingPaneView } from './pane-view';
import { OrderRendererData } from './renderer';

interface VisualTradingOptions {
    orders: any[];
    positions: any[];
    onModifyOrder: (orderId: string, newPrice: number) => void;
    onCancelOrder: (orderId: string) => void;
}

export class VisualTrading implements ISeriesPrimitive<Time> {
    private _chart: IChartApi | undefined;
    private _series: ISeriesApi<SeriesType> | undefined;
    private _paneViews: VisualTradingPaneView[];
    private _options: VisualTradingOptions;

    private _hoveredOrderId: string | null = null;
    private _draggingOrderId: string | null = null;
    private _dragStartY: number = 0;
    private _lastCrosshairY: number | null = null;
    private _lastCrosshairX: number | null = null;
    private _hoveredRemove: boolean = false; // Track if hovering over X button

    // Cache for order prices during drag to show visual feedback
    private _dragPrices: Map<string, number> = new Map();
    private _requestUpdate: () => void = () => { };

    // Performance optimization: cache rendered data
    private _cachedRendererData: OrderRendererData | null = null;
    private _dataVersion: number = 0;

    constructor(options: VisualTradingOptions) {
        this._options = options;
        this._paneViews = [new VisualTradingPaneView()];
    }

    attached(param: SeriesAttachedParameter<Time>) {
        this._chart = param.chart;
        this._series = param.series;
        this._requestUpdate = param.requestUpdate;

        // Subscribe to mouse events for interactivity
        // Note: Lightweight Charts primitive mouse handling is tricky.
        this._chart.subscribeCrosshairMove(this._handleCrosshairMove);
        this._chart.subscribeClick(this._handleClick);

        // Native DOM events for robust dragging (matching LineToolManager)
        const chartElement = (this._chart as any).chartElement?.();
        if (chartElement) {
            chartElement.addEventListener('mousedown', this._mouseDownHandler);
            window.addEventListener('mouseup', this._mouseUpHandler);
            window.addEventListener('mousemove', this._mouseMoveHandler);
        }
    }

    detached() {
        if (this._chart) {
            this._chart.unsubscribeCrosshairMove(this._handleCrosshairMove);
            this._chart.unsubscribeClick(this._handleClick);

            const chartElement = (this._chart as any).chartElement?.();
            if (chartElement) {
                chartElement.removeEventListener('mousedown', this._mouseDownHandler);
            }
        }
        window.removeEventListener('mouseup', this._mouseUpHandler);
        window.removeEventListener('mousemove', this._mouseMoveHandler);

        this._requestUpdate = () => { };
    }

    paneViews() {
        return this._paneViews;
    }

    updateAllViews() {
        this._paneViews.forEach(pw => pw.update(this._getRendererData()));
        this._requestUpdate();
    }

    setData(orders: any[], positions: any[]) {
        this._options.orders = orders;
        this._options.positions = positions;

        // Invalidate cache when data changes
        this._dataVersion++;
        this._cachedRendererData = null;

        this.updateAllViews();
    }

    setCallbacks(callbacks: { onModifyOrder?: (id: string, price: number) => void; onCancelOrder?: (id: string) => void }) {
        if (callbacks.onModifyOrder) this._options.onModifyOrder = callbacks.onModifyOrder;
        if (callbacks.onCancelOrder) this._options.onCancelOrder = callbacks.onCancelOrder;
    }

    // Native Event Handlers
    private _mouseDownHandler = (event: MouseEvent) => {
        if (this._hoveredRemove) {
            // Clicked Close
            if (this._hoveredOrderId) {
                this._options.onCancelOrder(this._hoveredOrderId);
                // Prevent default to avoid side effects
                event.preventDefault();
                event.stopPropagation();
            }
            return;
        }

        if (this._hoveredOrderId) {
            this._draggingOrderId = this._hoveredOrderId;

            // Lock chart interactions during drag
            if (this._chart) {
                this._chart.applyOptions({
                    handleScroll: false,
                    handleScale: false,
                    kineticScroll: { touch: false, mouse: false }
                });
            }

            // Set initial price
            const chartElement = (this._chart as any).chartElement?.();
            const rect = chartElement?.getBoundingClientRect();
            if (rect && this._series) {
                const y = event.clientY - rect.top;
                const price = this._series.coordinateToPrice(y as Coordinate);
                if (price !== null) {
                    this._dragPrices.set(this._draggingOrderId, price);
                }
            }

            event.preventDefault();
        }
    };

    private _mouseMoveHandler = (event: MouseEvent) => {
        if (!this._draggingOrderId || !this._series || !this._chart) return;

        const chartElement = (this._chart as any).chartElement?.();
        const rect = chartElement?.getBoundingClientRect();
        if (!rect) return;

        const y = event.clientY - rect.top;
        const price = this._series.coordinateToPrice(y as Coordinate);

        if (price !== null) {
            this._dragPrices.set(this._draggingOrderId, price);
            this.updateAllViews();
        }
    };

    private _mouseUpHandler = (event: MouseEvent) => {
        if (this._draggingOrderId) {
            const price = this._dragPrices.get(this._draggingOrderId);

            if (price !== undefined) {
                this._options.onModifyOrder(this._draggingOrderId, price);
            }

            this._draggingOrderId = null;
            this._dragPrices.clear();

            // Re-enable chart interactions
            if (this._chart) {
                this._chart.applyOptions({
                    handleScroll: true,
                    handleScale: true,
                    kineticScroll: { touch: true, mouse: true }
                });
            }

            this.updateAllViews();
        }
    };

    private _isDragging(): boolean {
        return this._draggingOrderId !== null;
    }

    private _getRendererData(): OrderRendererData {
        if (!this._series) return { orders: [], positions: [] };

        // Performance optimization: Return cached data if not dragging and cache is valid
        // During drag, we need to recalculate to show real-time price feedback
        if (this._cachedRendererData && !this._isDragging()) {
            return this._cachedRendererData;
        }

        // Calculate fresh data
        const data = this._calculateRendererData();

        // Cache the result if not dragging (dragging shows temporary state)
        if (!this._isDragging()) {
            this._cachedRendererData = data;
        }

        return data;
    }

    private _calculateRendererData(): OrderRendererData {
        if (!this._series) return { orders: [], positions: [] };

        const positions = this._options.positions.map(pos => {
            const price = parseFloat(pos.average_price);
            const y = this._series?.priceToCoordinate(price) ?? null;
            if (y === null) return null;

            const pnl = parseFloat(pos.pnl || 0);
            const color = pnl >= 0 ? '#10B981' : '#EF4444'; // Green/Red

            return {
                y: y as number,
                color,
                text: `${pos.quantity} ${pos.symbol} @ ${price} (${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)})`,
                lineWidth: 2
            };
        }).filter(p => p !== null);

        const orders = this._options.orders.map(order => {
            // Determine base price to display (Price for LIMIT, Trigger Price for SL/SL-M)
            let price = parseFloat(order.price);
            const isSLOrder = order.pricetype === 'SL' || order.pricetype === 'SL-M';

            if (isSLOrder) {
                const triggerPrice = parseFloat(order.trigger_price || order.triggerprice);
                if (!isNaN(triggerPrice) && triggerPrice > 0) {
                    price = triggerPrice;
                }
            }

            // If dragging, OVERRIDE with the temporary drag price
            if (this._dragPrices.has(order.orderid)) {
                price = this._dragPrices.get(order.orderid)!;
            }

            // Skip if price is still invalid
            if (isNaN(price) || price <= 0) return null;

            const y = this._series?.priceToCoordinate(price) ?? null;
            if (y === null) {
                // Price is outside visible scale, skip rendering
                return null;
            }

            const isBuy = order.action === 'BUY';
            // Use different colors for SL orders - red for sell SL (stop loss exit), green for buy SL (stop loss entry)
            let color = isBuy ? '#3B82F6' : '#F59E0B'; // Blue / Orange for regular orders
            if (isSLOrder) {
                color = isBuy ? '#10B981' : '#EF4444'; // Green / Red for SL orders
            }
            const hovered = this._hoveredOrderId === order.orderid;

            // Build label text - show order type for SL orders
            const orderTypeLabel = isSLOrder ? ` ${order.pricetype}` : '';
            const priceLabel = isSLOrder ? `@ ${price.toFixed(2)} (trigger)` : `@ ${price.toFixed(2)}`;

            return {
                id: order.orderid || order.order_id,
                y: y as number,
                color,
                text: `${order.action}${orderTypeLabel} ${order.quantity} ${priceLabel}`,
                hovered,
                hoverRemove: hovered && this._hoveredRemove,
                lineWidth: 1,
                lineStyle: [4, 4] // Dashed
            };
        }).filter(p => p !== null);

        // console.log('[VisualTrading] Render Data:', { ordersCount: orders.length });

        return {
            positions: positions as any[],
            orders: orders as any[]
        };
    }

    // Helper functions matching constants in renderer
    private _calculateLabelWidth(textLength: number) {
        // approximate width calculation matching renderer
        const averageWidthPerCharacter = 6;
        const removeButtonWidth = 26;
        const centreLabelInlinePadding = 9;
        const dynamicPadding = textLength > 25 ? Math.min(25, (textLength - 25) * 1.5) : 3;
        return (
            centreLabelInlinePadding * 2 +
            removeButtonWidth +
            dynamicPadding +
            textLength * averageWidthPerCharacter
        );
    }

    private _isHoveringRemoveButton(
        mouseX: number,
        mouseY: number,
        timescaleWidth: number,
        alertY: number,
        textLength: number
    ): boolean {
        const centreLabelHeight = 20;
        const removeButtonWidth = 26;
        const paddingRight = 60; // Must match renderer.ts paddingRight

        const distanceY = Math.abs(mouseY - alertY);
        if (distanceY > centreLabelHeight / 2) return false;

        // Button is always anchored to the right edge
        const buttonRight = timescaleWidth - paddingRight;
        const buttonLeft = buttonRight - removeButtonWidth;

        return mouseX >= buttonLeft && mouseX <= buttonRight;
    }

    // Interaction Handlers

    private _handleCrosshairMove = (param: MouseEventParams) => {
        if (!param.point || !this._series) return;

        if (!param.point || !this._series) return;

        const y = param.point.y;
        this._lastCrosshairY = y;
        this._lastCrosshairX = param.point.x; // Track X for close button hit test

        // Hit test orders
        // We assume 10px hit radius
        let foundOrder = null;
        const data = this._getRendererData(); // Now optimized with caching!

        for (const order of data.orders) {
            if (Math.abs(order.y - y) < 10) {
                foundOrder = order.id;
                break;
            }
        }

        if (this._hoveredOrderId !== foundOrder) {
            this._hoveredOrderId = foundOrder;
            this._hoveredRemove = false;
        }

        // Check for remove button hover if over an order
        if (this._hoveredOrderId && this._lastCrosshairX && this._series && this._chart) {
            const data = this._getRendererData();
            const order = data.orders.find(o => o.id === this._hoveredOrderId);
            if (order) {
                const width = this._chart.timeScale().width();
                const isHoveringRemove = this._isHoveringRemoveButton(
                    this._lastCrosshairX,
                    this._lastCrosshairY!,
                    width,
                    order.y,
                    order.text.length
                );
                this._hoveredRemove = isHoveringRemove;
            }
        } else {
            this._hoveredRemove = false;
        }

        this.updateAllViews();

        // Change cursor
        document.body.style.cursor = this._hoveredOrderId ? (this._hoveredRemove ? 'pointer' : 'grab') : 'default';
    };

    private _handleClick = (param: MouseEventParams) => {
        // Handled by native mousedown
    };



    public getHoveredOrderId(): string | null {
        return this._hoveredOrderId;
    }
}
