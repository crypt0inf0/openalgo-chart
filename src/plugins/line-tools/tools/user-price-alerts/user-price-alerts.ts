import {
	IChartApi,
	ISeriesApi,
	ISeriesPrimitive,
	IPrimitivePaneView,
	PrimitiveHoveredItem,
	SeriesAttachedParameter,
	SeriesType,
	Time,
} from 'lightweight-charts';
import {
	averageWidthPerCharacter,
	buttonWidth,
	centreLabelHeight,
	centreLabelInlinePadding,
	clockIconPaths,
	clockPlusIconPaths,
	removeButtonWidth,
	showCentreLabelDistance,
} from './constants';
import { AlertRendererData, IRendererData } from './irenderer-data';
import { MouseHandlers, MousePosition } from './mouse';
import { UserAlertPricePaneView } from './pane-view';
import { UserAlertInfo, UserAlertsState, AlertNotificationSettings, DEFAULT_NOTIFICATION_SETTINGS } from './state';
import { AlertEditDialog } from './alert-edit-dialog';
import { Delegate } from '../../../../helpers/delegate';
import { LineToolAlertManager, LineTool, AlertCondition } from '../line-tool-alert-manager';

import { VerticalLine } from '../vertical-line';
import { Rectangle } from '../rectangle';
import { ParallelChannel } from '../parallel-channel';

export interface AlertCrossing {
	alertId: string;
	alertPrice: number;
	crossingPrice: number;
	direction: 'up' | 'down';
	condition: AlertCondition;
	timestamp: number;
	// New fields for webhook support
	notifications?: AlertNotificationSettings;
	symbol?: string;
	exchange?: string;
	closePrice?: number;
}

export class UserPriceAlerts
	extends UserAlertsState
	implements ISeriesPrimitive<Time> {
	private _chart: IChartApi | undefined = undefined;
	private _series: ISeriesApi<SeriesType> | undefined = undefined;
	private _mouseHandlers: MouseHandlers;

	private _paneViews: UserAlertPricePaneView[] = [];
	private _pricePaneViews: UserAlertPricePaneView[] = [];

	private _lastMouseUpdate: MousePosition | null = null;
	private _currentCursor: string | null = null;

	private _symbolName: string = '';
	private _exchange: string = 'NSE';
	private _dragState: { alertId: string; startY: number } | null = null;
	private _hasDragged: boolean = false;
	private _onAlertTriggered: Delegate<AlertCrossing> = new Delegate();
	private _onPriceScaleClicked: Delegate<{ price: number; x: number; y: number }> = new Delegate();
	private _editDialog: AlertEditDialog;

	private _requestUpdate: (() => void) | undefined;
	private _onDataChangedBound: (() => void) | undefined; // RC-2

	constructor() {
		super();
		this._mouseHandlers = new MouseHandlers();
		this._editDialog = new AlertEditDialog();
	}

	attached({ chart, series, requestUpdate }: SeriesAttachedParameter<Time>) {
		this._chart = chart;
		this._series = series;
		this._requestUpdate = requestUpdate;
		this._paneViews = [new UserAlertPricePaneView(false)];
		this._pricePaneViews = [new UserAlertPricePaneView(true)];
		this._mouseHandlers.attached(chart, series);
		this._mouseHandlers.mouseMoved().subscribe(mouseUpdate => {
			this._lastMouseUpdate = mouseUpdate;
			requestUpdate();
		}, this);

		// Subscribe to data changes to trigger alerts based on real price action (RC-2)
		this._onDataChangedBound = this._onDataChanged.bind(this);
		(this._series as any).subscribeDataChanged(this._onDataChangedBound);

		this._mouseHandlers.clicked().subscribe(mousePosition => {
			// If we just finished dragging, ignore the click (don't open edit dialog)
			if (this._hasDragged) {
				this._hasDragged = false;
				return;
			}

			if (mousePosition && this._series) {
				if (this._isHovering(mousePosition)) {
					const price = this._series.coordinateToPrice(mousePosition.y);
					if (price) {
						// Fire event for external handling (e.g., context menu)
						// If there are subscribers, let them handle it
						if (this._onPriceScaleClicked.hasListeners()) {
							// Get the chart container position to calculate absolute coordinates
							const chartElement = this._chart?.chartElement();
							if (chartElement) {
								const rect = chartElement.getBoundingClientRect();
								// Get the price scale width to position menu to its left
								const priceScaleWidth = this._chart?.priceScale('right')?.width() ?? 60;
								this._onPriceScaleClicked.fire({
									price,
									x: rect.right - priceScaleWidth - 2, // Position further left of price scale
									y: rect.top + mousePosition.y
								});
							}
						} else {
							// No external handler, open dialog directly
							this.openEditDialog('new', { price, condition: 'crossing' });
						}
						requestUpdate();
					}
				}
				if (this._hoveringID) {
					this.removeAlert(this._hoveringID);
					requestUpdate();
					return;
				}

				// Check if clicking on an alert label to edit
				const editAlertId = this._getHoveringAlertId(mousePosition, false);
				if (editAlertId) {
					this.openEditDialog(editAlertId);
				}
			}
		}, this);
		this._mouseHandlers.mouseDown().subscribe(mousePosition => {
			this._hasDragged = false;
			if (mousePosition && this._series) {
				// Check if clicking on an alert label (not remove button)
				const hoveringAlertId = this._getHoveringAlertId(mousePosition, false);
				if (hoveringAlertId) {
					this._dragState = { alertId: hoveringAlertId, startY: mousePosition.y };
					// Lock chart during drag
					if (this._chart) {
						this._chart.applyOptions({
							handleScroll: false,
							handleScale: false,
							kineticScroll: { touch: false, mouse: false }
						});
					}
				}
			}
		}, this);
		this._mouseHandlers.mouseUp().subscribe(() => {
			if (this._dragState) {
				// Unlock chart after drag
				if (this._chart) {
					this._chart.applyOptions({
						handleScroll: true,
						handleScale: true,
						kineticScroll: { touch: true, mouse: true }
					});
				}
			}
			this._dragState = null;
		}, this);
		this._mouseHandlers.mouseMoved().subscribe(mousePosition => {
			// Handle dragging
			if (this._dragState && mousePosition && this._series) {
				// Check for significant movement to consider it a drag
				if (Math.abs(mousePosition.y - this._dragState.startY) > 5) {
					this._hasDragged = true;
				}

				const newPrice = this._series.coordinateToPrice(mousePosition.y);
				if (newPrice !== null) {
					this.updateAlertPrice(this._dragState.alertId, newPrice);
					requestUpdate();
				}
			}
		}, this);
	}

	detached() {
		if (this._series && this._onDataChangedBound) {
			(this._series as any).unsubscribeDataChanged(this._onDataChangedBound);
		}
		this._mouseHandlers.mouseMoved().unsubscribeAll(this);
		this._mouseHandlers.clicked().unsubscribeAll(this);
		this._mouseHandlers.mouseDown().unsubscribeAll(this);
		this._mouseHandlers.mouseUp().unsubscribeAll(this);
		this._mouseHandlers.detached();
		this._series = undefined;
		this._requestUpdate = undefined;
		this._onDataChangedBound = undefined;
	}

	paneViews(): readonly IPrimitivePaneView[] {
		return this._paneViews;
	}

	priceAxisPaneViews(): readonly IPrimitivePaneView[] {
		return this._pricePaneViews;
	}

	private _onDataChanged() {
		if (this._series) {
			// Get the latest bar data
			// Assuming the series has a method to get data or we can get it via other means
			// In many implementations, series.data() returns the array.
			// We need to cast to any to access potentially internal or extended methods
			const data = (this._series as any).data?.();
			if (data && data.length > 0) {
				const lastBar = data[data.length - 1];
				this.checkPriceCrossings(lastBar);
				this.updateAllViews();
				this._requestUpdate?.();
			}
		}
	}

	updateAllViews(): void {
		// Update trendline alert prices to follow the line
		if (this._chart && this._series) {
			const data = (this._series as any).data?.();
			if (data && data.length > 0) {
				const lastBar = data[data.length - 1];
				const timeScale = this._chart.timeScale();
				// @ts-ignore
				const coordinate = timeScale.timeToCoordinate(lastBar.time);
				if (coordinate !== null) {
					// @ts-ignore
					const logical = timeScale.coordinateToLogical(coordinate);
					if (logical !== null) {
						this.alerts().forEach(alert => {
							if (alert.type === 'tool' && alert.toolRef) {
								const price = LineToolAlertManager.getPriceAtLogical(alert.toolRef, logical);
								if (price !== null) {
									alert.price = price;
								}
							}
						});
					}
				}
			}
		}

		const alerts = this.alerts();
		const rendererData = this._calculateRendererData(
			alerts,
			this._lastMouseUpdate
		);
		this._currentCursor = null;
		if (
			rendererData?.button?.hovering ||
			rendererData?.alerts.some(alert => alert.showHover && alert.hoverRemove)
		) {
			this._currentCursor = 'pointer';
		}
		this._paneViews.forEach(pv => pv.update(rendererData));
		this._pricePaneViews.forEach(pv => pv.update(rendererData));
	}

	hitTest(): PrimitiveHoveredItem | null {
		if (!this._currentCursor) return null;
		return {
			cursorStyle: this._currentCursor,
			externalId: 'user-alerts-primitive',
			zOrder: 'top',
		};
	}

	setSymbolName(name: string, exchange?: string) {
		this._symbolName = name;
		if (exchange) {
			this._exchange = exchange;
		}
	}

	public openEditDialog(alertId: string, initialData?: { price: number, condition: AlertCondition }) {
		const alert = this.alerts().find(a => a.id === alertId);

		const data = alert ? {
			alertId: alert.id,
			price: alert.price,
			condition: alert.condition || 'crossing',
			symbol: alert.symbol || this._symbolName,
			exchange: alert.exchange || this._exchange,
			isTrendline: alert.type === 'tool',
			notifications: alert.notifications || { ...DEFAULT_NOTIFICATION_SETTINGS },
		} : (initialData ? {
			alertId: alertId,
			price: initialData.price,
			condition: initialData.condition,
			symbol: this._symbolName,
			exchange: this._exchange,
			isTrendline: false,
			notifications: { ...DEFAULT_NOTIFICATION_SETTINGS },
		} : null);

		if (!data) return;

		this._editDialog.show(data, (result) => {
			if (alert) {
				this.updateAlert(result.alertId, result.price, result.condition, result.notifications);
				// Also update symbol/exchange if needed
				const updatedAlert = this._alerts.get(result.alertId);
				if (updatedAlert) {
					updatedAlert.symbol = result.symbol;
					updatedAlert.exchange = result.exchange;
				}
			} else {
				// Create a new alert with notification settings
				const newId = this.addAlertWithCondition(result.price, result.condition);
				const newAlert = this._alerts.get(newId);
				if (newAlert) {
					newAlert.notifications = result.notifications;
					newAlert.symbol = result.symbol;
					newAlert.exchange = result.exchange;
					this._alertsChanged.fire();
				}
			}
		});
	}

	public openToolAlertDialog(tool: LineTool) {
		// Use a temporary ID or handle 'new' logic
		// We want to create a new alert for this tool
		let initialPrice = 0;
		// Try to get a price from the tool to pre-fill
		// For TrendLine/Ray/Extended: p2.price
		// For Horizontal: price
		// For others: maybe 0 or current price?
		if ('_p2' in tool && tool._p2 && typeof tool._p2.price === 'number') {
			initialPrice = tool._p2.price;
		} else if ('_price' in tool && typeof tool._price === 'number') {
			initialPrice = tool._price;
		} else if ('_point' in tool && tool._point && typeof tool._point.price === 'number') {
			initialPrice = tool._point.price;
		}

		let toolType: 'line' | 'shape' | 'vertical' = 'line';
		if (tool instanceof VerticalLine) toolType = 'vertical';
		else if (tool instanceof Rectangle || tool instanceof ParallelChannel) toolType = 'shape';

		const data = {
			alertId: 'new_tool',
			price: initialPrice,
			condition: (toolType === 'shape' ? 'entering' : 'crossing') as AlertCondition,
			symbol: this._symbolName,
			isTrendline: true, // UI flag, maybe rename in dialog
			toolType: toolType
		};

		this._editDialog.show(data, (result) => {
			// Create the alert
			const id = this.addToolAlert(tool, result.condition);
			if ('setAlertId' in tool) {
				(tool as any).setAlertId(id);
			}
		});
	}

	public alertTriggered(): Delegate<AlertCrossing> {
		return this._onAlertTriggered;
	}

	public priceScaleClicked(): Delegate<{ price: number; x: number; y: number }> {
		return this._onPriceScaleClicked;
	}

	/**
	 * Check current candle against all alerts for crossings
	 */
	public checkPriceCrossings(bar: any): void {
		if (!bar) return;

		// Use High and Low for crossing detection if available (Candlestick/Bar series)
		// Fallback to close/value for Line/Area series
		const high = bar.high !== undefined ? bar.high : (bar.value !== undefined ? bar.value : bar.close);
		const low = bar.low !== undefined ? bar.low : (bar.value !== undefined ? bar.value : bar.close);
		const close = bar.close !== undefined ? bar.close : (bar.value !== undefined ? bar.value : high);

		const alerts = this.alerts();
		const triggeredAlertIds: string[] = [];

		for (const alert of alerts) {
			let triggered = false;
			const condition = alert.condition || 'crossing';

			if (alert.type === 'tool' && alert.toolRef) {
				const timeScale = this._chart?.timeScale();
				// @ts-ignore
				if (timeScale && bar.time) {
					// @ts-ignore
					const logical = timeScale.coordinateToLogical(timeScale.timeToCoordinate(bar.time) || 0);
					if (logical !== null) {
						// Get the line price at current logical index for position tracking
						const linePrice = LineToolAlertManager.getPriceAtLogical(alert.toolRef, logical);

						if (linePrice !== null) {
							// Determine current price position relative to line tool
							const currentPosition: 'above' | 'below' | 'at' = close > linePrice ? 'above' : (close < linePrice ? 'below' : 'at');

							// If initialPricePosition is not set, initialize it and skip triggering this candle
							if (!alert.initialPricePosition || alert.initialPricePosition === 'unknown') {
								alert.initialPricePosition = currentPosition === 'at' ? 'unknown' : currentPosition;
								continue; // Skip triggering on the first check
							}

							// Check if the line price is within the candle's range
							const isTouching = linePrice >= low && linePrice <= high;

							// For a true crossing, price must have moved from one side to the other
							const hasCrossedFromAbove = alert.initialPricePosition === 'above' && close <= linePrice;
							const hasCrossedFromBelow = alert.initialPricePosition === 'below' && close >= linePrice;

							if (condition === 'crossing') {
								triggered = isTouching && (hasCrossedFromAbove || hasCrossedFromBelow);
							} else if (condition === 'crossing_up') {
								triggered = isTouching && hasCrossedFromBelow && close >= linePrice;
							} else if (condition === 'crossing_down') {
								triggered = isTouching && hasCrossedFromAbove && close <= linePrice;
							}

							// Update position for future checks
							if (!isTouching && currentPosition !== 'at') {
								alert.initialPricePosition = currentPosition;
							}
						} else {
							// Fallback to original checkAlert for tools without line price (VerticalLine, Rectangle, ParallelChannel)
							triggered = LineToolAlertManager.checkAlert(alert.toolRef, bar, logical, condition);
						}
					}
				}
			} else {
				// Price Alert Check
				// Check if the alert price is within the candle's range
				const isCrossing = alert.price >= low && alert.price <= high;

				// Determine current price position relative to alert
				const currentPosition: 'above' | 'below' | 'at' = close > alert.price ? 'above' : (close < alert.price ? 'below' : 'at');

				// If initialPricePosition is not set, initialize it and skip triggering this candle
				// This prevents immediate triggers when placing alerts within the current candle's range
				if (!alert.initialPricePosition || alert.initialPricePosition === 'unknown') {
					// Set initial position based on close price
					alert.initialPricePosition = currentPosition === 'at' ? 'unknown' : currentPosition;
					continue; // Skip triggering on the first check
				}

				// For a true crossing, price must have moved from one side to the other
				const hasCrossedFromAbove = alert.initialPricePosition === 'above' && close <= alert.price;
				const hasCrossedFromBelow = alert.initialPricePosition === 'below' && close >= alert.price;

				if (condition === 'crossing') {
					// Trigger if price has crossed from either direction
					triggered = isCrossing && (hasCrossedFromAbove || hasCrossedFromBelow);
				} else if (condition === 'crossing_up') {
					// Trigger only if crossing from below
					triggered = isCrossing && hasCrossedFromBelow && close >= alert.price;
				} else if (condition === 'crossing_down') {
					// Trigger only if crossing from above
					triggered = isCrossing && hasCrossedFromAbove && close <= alert.price;
				}

				// Update the position for future checks (if price moved significantly away)
				if (!isCrossing && currentPosition !== 'at') {
					// Price has moved away from the alert line, update position
					alert.initialPricePosition = currentPosition;
				}
			}

			if (triggered) {
				const crossing: AlertCrossing = {
					alertId: alert.id,
					alertPrice: alert.price,
					crossingPrice: close,
					direction: close > alert.price ? 'up' : 'down',
					condition: alert.condition || 'crossing',
					timestamp: Date.now(),
					// Include notification settings and context for webhook
					notifications: alert.notifications,
					symbol: alert.symbol || this._symbolName,
					exchange: alert.exchange || this._exchange,
					closePrice: close,
				};
				this._onAlertTriggered.fire(crossing);
				triggeredAlertIds.push(alert.id);
			}
		}

		// Remove triggered alerts (one-shot)
		triggeredAlertIds.forEach(id => this.removeAlert(id));
	}

	_isHovering(mousePosition: MousePosition | null): boolean {
		return Boolean(
			mousePosition &&
			mousePosition.xPositionRelativeToPriceScale >= 1 &&
			mousePosition.xPositionRelativeToPriceScale < buttonWidth
		);
	}

	_isHoveringRemoveButton(
		mousePosition: MousePosition | null,
		timescaleWidth: number,
		alertY: number,
		textLength: number
	): boolean {
		if (!mousePosition || !timescaleWidth) return false;
		const distanceY = Math.abs(mousePosition.y - alertY);
		if (distanceY > centreLabelHeight / 2) return false;
		const labelWidth =
			centreLabelInlinePadding * 2 +
			removeButtonWidth +
			textLength * averageWidthPerCharacter;
		const buttonCentreX =
			(timescaleWidth + labelWidth - removeButtonWidth) * 0.5;
		const distanceX = Math.abs(mousePosition.x - buttonCentreX);
		return distanceX <= removeButtonWidth / 2;
	}

	private _hoveringID: string = '';

	/**
	 * We are calculating this here instead of within a view
	 * because the data is identical for both Renderers so lets
	 * rather calculate it once here.
	 */
	_calculateRendererData(
		alertsInfo: UserAlertInfo[],
		mousePosition: MousePosition | null
	): IRendererData | null {
		if (!this._series) return null;
		const priceFormatter = this._series.priceFormatter();

		const showCrosshair = mousePosition && !mousePosition.overTimeScale;
		const showButton = showCrosshair;
		const crosshairPrice =
			mousePosition && this._series.coordinateToPrice(mousePosition.y);
		const crosshairPriceText = priceFormatter.format(crosshairPrice ?? -100);

		let closestDistance = Infinity;
		let closestIndex: number = -1;

		const alerts: (AlertRendererData & { price: number; id: string })[] =
			alertsInfo.map((alertInfo, index) => {
				const y = this._series!.priceToCoordinate(alertInfo.price) ?? -100;
				if (mousePosition?.y && y >= 0) {
					const distance = Math.abs(mousePosition.y - y);
					if (distance < closestDistance) {
						closestIndex = index;
						closestDistance = distance;
					}
				}
				return {
					y,
					showHover: false,
					price: alertInfo.price,
					id: alertInfo.id,
				};
			});
		this._hoveringID = '';
		if (closestIndex >= 0 && closestDistance < showCentreLabelDistance) {
			const timescaleWidth = this._chart?.timeScale().width() ?? 0;
			const a = alerts[closestIndex];
			const text = `${this._symbolName} crossing ${this._series
				.priceFormatter()
				.format(a.price)}`;
			const hoverRemove = this._isHoveringRemoveButton(
				mousePosition,
				timescaleWidth,
				a.y,
				text.length
			);
			alerts[closestIndex] = {
				...alerts[closestIndex],
				showHover: true,
				text,
				hoverRemove,
			};
			if (hoverRemove) this._hoveringID = a.id;
		}
		return {
			alertIcon: clockIconPaths,
			alerts,
			button: showButton
				? {
					hovering: this._isHovering(mousePosition),
					hoverColor: '#50535E',
					crosshairLabelIcon: clockPlusIconPaths,
				}
				: null,
			color: '#131722',
			crosshair: showCrosshair
				? {
					y: mousePosition.y,
					text: crosshairPriceText,
				}
				: null,
		};
	}

	/**
	 * Get the ID of the alert being hovered, optionally checking for remove button
	 */
	_getHoveringAlertId(mousePosition: MousePosition | null, checkRemoveButton: boolean): string | null {
		if (!mousePosition || !this._series || !this._chart) return null;
		const alerts = this.alerts();
		let closestDistance = Infinity;
		let closestIndex = -1;

		for (let i = 0; i < alerts.length; i++) {
			const y = this._series.priceToCoordinate(alerts[i].price) ?? -100;
			if (y >= 0) {
				const distance = Math.abs(mousePosition.y - y);
				if (distance < closestDistance) {
					closestIndex = i;
					closestDistance = distance;
				}
			}
		}

		if (closestIndex >= 0 && closestDistance < showCentreLabelDistance) {
			if (checkRemoveButton) {
				const timescaleWidth = this._chart.timeScale().width();
				const alertInfo = alerts[closestIndex];
				const y = this._series.priceToCoordinate(alertInfo.price) ?? -100;
				const text = `${this._symbolName} crossing ${this._series.priceFormatter().format(alertInfo.price)}`;
				const hoverRemove = this._isHoveringRemoveButton(mousePosition, timescaleWidth, y, text.length);
				if (!hoverRemove) return null; // Not hovering remove button
			}
			return alerts[closestIndex].id;
		}

		return null;
	}
	public addToolAlert(tool: LineTool, condition: AlertCondition): string {
		const id = this._getNewId();
		let initialPrice = 0;
		if ('_p2' in tool && tool._p2 && typeof tool._p2.price === 'number') {
			initialPrice = tool._p2.price;
		} else if ('_price' in tool && typeof tool._price === 'number') {
			initialPrice = tool._price;
		} else if ('_point' in tool && tool._point && typeof tool._point.price === 'number') {
			initialPrice = tool._point.price;
		}

		// Try to calculate current price on tool if applicable
		if (this._series && this._chart) {
			const data = (this._series as any).data?.();
			if (data && data.length > 0) {
				const lastBar = data[data.length - 1];
				const timeScale = this._chart.timeScale();
				// @ts-ignore
				const coordinate = timeScale.timeToCoordinate(lastBar.time);
				if (coordinate !== null) {
					// @ts-ignore
					const logical = timeScale.coordinateToLogical(coordinate);
					if (logical !== null) {
						const price = LineToolAlertManager.getPriceAtLogical(tool, logical);
						if (price !== null) {
							initialPrice = price;
						}
					}
				}
			}
		}

		const userAlert: UserAlertInfo = {
			price: initialPrice,
			id,
			condition,
			type: 'tool',
			toolRef: tool
		};
		this._alerts.set(id, userAlert);
		this._alertAdded.fire(userAlert);
		this._alertsChanged.fire();
		return id;
	}
}
