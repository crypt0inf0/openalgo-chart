import { Delegate } from '../../../../helpers/delegate';
import { LineTool, AlertCondition } from '../line-tool-alert-manager';

/**
 * Notification settings for an alert.
 * Controls how the user is notified when an alert triggers.
 */
export interface AlertNotificationSettings {
	showToast: boolean;        // Show popup notification (default: true)
	playSound: boolean;        // Play alarm sound (default: true)
	webhookEnabled: boolean;   // Enable webhook (default: false)
	webhookUrl?: string;       // Custom webhook URL
	webhookMode?: 'openalgo' | 'custom'; // Webhook type
	// OpenAlgo specific settings
	openalgoAction?: 'BUY' | 'SELL';
	openalgoProduct?: 'MIS' | 'CNC' | 'NRML';
	openalgoQuantity?: number;
	openalgoPricetype?: 'MARKET' | 'LIMIT';
	// Custom message template
	message?: string; // Template with {{variables}}
	// Telegram notification
	telegramEnabled?: boolean; // Send alert to Telegram
}

/**
 * Default notification settings for new alerts.
 */
export const DEFAULT_NOTIFICATION_SETTINGS: AlertNotificationSettings = {
	showToast: true,
	playSound: true,
	webhookEnabled: false,
	webhookMode: 'openalgo',
	openalgoAction: 'BUY',
	openalgoProduct: 'MIS',
	openalgoQuantity: 1,
	openalgoPricetype: 'MARKET',
	message: '{{symbol}} {{condition}} {{price}}',
	telegramEnabled: false
};

export interface UserAlertInfo {
	id: string;
	price: number;
	condition?: AlertCondition;
	type?: 'price' | 'tool';
	toolRef?: LineTool;
	/** Tracks where the close price was relative to the alert when created ('above', 'below', or 'unknown').
	 * This is used to prevent immediate triggers when placing alerts within the current candle's range.
	 * Once a true crossing happens, this is set to 'unknown' to enable further triggers.
	 */
	initialPricePosition?: 'above' | 'below' | 'unknown';
	// Notification settings
	notifications?: AlertNotificationSettings;
	// Symbol context for webhook
	symbol?: string;
	exchange?: string;
}

/**
 * Serializable alert data for localStorage persistence.
 * Excludes toolRef which cannot be serialized.
 */
export interface SerializableAlert {
	id: string;
	price: number;
	condition: AlertCondition;
	type: 'price' | 'tool';
	createdAt: number;
	// Notification settings
	notifications?: AlertNotificationSettings;
	symbol?: string;
	exchange?: string;
}

export class UserAlertsState {
	protected _alertAdded: Delegate<UserAlertInfo> = new Delegate();
	protected _alertRemoved: Delegate<string> = new Delegate();
	protected _alertChanged: Delegate<UserAlertInfo> = new Delegate();
	protected _alertsChanged: Delegate = new Delegate();
	protected _alerts: Map<string, UserAlertInfo>;

	constructor() {
		this._alerts = new Map();
		this._alertsChanged.subscribe(() => {
			this._updateAlertsArray();
		}, this);
	}

	destroy() {
		// TODO: add more destroying 💥
		this._alertsChanged.unsubscribeAll(this);
	}

	alertAdded(): Delegate<UserAlertInfo> {
		return this._alertAdded;
	}

	alertRemoved(): Delegate<string> {
		return this._alertRemoved;
	}

	alertChanged(): Delegate<UserAlertInfo> {
		return this._alertChanged;
	}

	alertsChanged(): Delegate {
		return this._alertsChanged;
	}

	addAlert(price: number): string {
		return this.addAlertWithCondition(price, 'crossing');
	}

	addAlertWithCondition(price: number, condition: AlertCondition): string {
		const id = this._getNewId();
		const userAlert: UserAlertInfo = {
			price,
			id,
			condition,
		};
		this._alerts.set(id, userAlert);
		this._alertAdded.fire(userAlert);
		this._alertsChanged.fire();
		return id;
	}

	removeAlert(id: string) {
		if (!this._alerts.has(id)) return;
		this._alerts.delete(id);
		this._alertRemoved.fire(id);
		this._alertsChanged.fire();
	}

	updateAlertPrice(id: string, newPrice: number) {
		const alert = this._alerts.get(id);
		if (!alert) return;
		alert.price = newPrice;
		this._alertChanged.fire(alert);
		this._alertsChanged.fire();
	}

	updateAlert(id: string, newPrice: number, condition: AlertCondition, notifications?: AlertNotificationSettings) {
		const alert = this._alerts.get(id);
		if (!alert) return;
		alert.price = newPrice;
		alert.condition = condition;
		if (notifications) {
			alert.notifications = notifications;
		}
		this._alertChanged.fire(alert);
		this._alertsChanged.fire();
	}

	alerts() {
		return this._alertsArray;
	}

	_alertsArray: UserAlertInfo[] = [];
	_updateAlertsArray() {
		this._alertsArray = Array.from(this._alerts.values()).sort((a, b) => {
			return b.price - a.price;
		});
	}

	protected _getNewId(): string {
		let id = Math.round(Math.random() * 1000000).toString(16);
		while (this._alerts.has(id)) {
			id = Math.round(Math.random() * 1000000).toString(16);
		}
		return id;
	}

	/**
	 * Export alerts as serializable JSON for localStorage persistence.
	 * Only exports price alerts (not tool alerts which have non-serializable refs).
	 */
	exportAlerts(): SerializableAlert[] {
		const serializable: SerializableAlert[] = [];
		this._alerts.forEach((alert) => {
			// Only export price alerts, not tool alerts (toolRef can't be serialized)
			if (alert.type !== 'tool') {
				serializable.push({
					id: alert.id,
					price: alert.price,
					condition: alert.condition || 'crossing',
					type: 'price',
					createdAt: Date.now(),
					notifications: alert.notifications,
					symbol: alert.symbol,
					exchange: alert.exchange,
				});
			}
		});
		return serializable;
	}

	/**
	 * Import alerts from serialized JSON (from localStorage).
	 * Fires alertsChanged but not individual alertAdded for each.
	 * Skips alerts that have already been triggered.
	 */
	importAlerts(alerts: SerializableAlert[]): void {
		if (!Array.isArray(alerts)) return;

		for (const alertData of alerts) {
			if (!alertData.id || typeof alertData.price !== 'number') continue;

			// Skip alerts that have already been triggered
			if ((alertData as any).triggered) continue;

			const userAlert: UserAlertInfo = {
				id: alertData.id,
				price: alertData.price,
				condition: alertData.condition || 'crossing',
				type: 'price',
				notifications: alertData.notifications,
				symbol: alertData.symbol,
				exchange: alertData.exchange,
			};
			this._alerts.set(alertData.id, userAlert);
		}

		if (alerts.length > 0) {
			this._alertsChanged.fire();
		}
	}

	/**
	 * Clear all alerts (used when switching symbols).
	 * Fires alertsChanged but not individual alertRemoved for each.
	 */
	clearAlerts(): void {
		if (this._alerts.size === 0) return;
		this._alerts.clear();
		this._alertsChanged.fire();
	}
}
