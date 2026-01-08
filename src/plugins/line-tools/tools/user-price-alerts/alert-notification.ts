import { AlertCondition } from '../line-tool-alert-manager';
import { AlertNotificationSettings } from './state';
import { processAlertWebhook, sendTelegramNotification, processMessageTemplate, WebhookPayload } from '../../../../services/webhookService';

export interface AlertNotificationData {
    alertId: string;
    symbol: string;
    exchange?: string;
    price: string; // Formatted price string
    numericPrice?: number; // Actual numeric price for webhook
    closePrice?: number; // Close price that triggered the alert
    timestamp: number;
    direction: 'up' | 'down';
    condition: AlertCondition;
    onEdit?: (data: AlertNotificationData) => void;
    notificationSettings?: AlertNotificationSettings;
}

import { LineToolManager } from '../../line-tool-manager';

export class AlertNotification {
    private _container: HTMLElement | null;
    private _notifications: Map<string, HTMLElement> = new Map();
    private _manager: LineToolManager | null;
    private _dismissTimeouts: Map<string, number> = new Map(); // RC-5

    constructor(manager: LineToolManager) {
        this._manager = manager;
        this._injectStyles();
        this._container = this._createContainer();
        document.body.appendChild(this._container);
    }

    private _injectStyles(): void {
        const styleId = 'alert-notification-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .alert-notifications-container {
                position: fixed;
                /* Position set by JS */
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 12px;
                pointer-events: none;
                font-family: -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif;
            }

            .alert-notification {
                background: #F5F8FA;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                padding: 16px;
                min-width: 320px;
                max-width: 400px;
                display: flex;
                align-items: flex-start;
                gap: 12px;
                animation: slideIn 0.3s ease-out;
                pointer-events: auto;
            }

            .alert-notification.dismissing {
                animation: slideOut 0.3s ease-out;
            }

            .alert-notification-icon {
                font-size: 24px;
                line-height: 1;
                flex-shrink: 0;
            }

            .alert-notification-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .alert-notification-header {
                font-size: 14px;
                font-weight: 600;
                color: #131722;
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .alert-notification-message {
                font-size: 13px;
                color: #131722;
                font-weight: 500;
            }

            .alert-notification-footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-top: 6px;
            }

            .alert-notification-edit {
                font-size: 12px;
                color: #2962FF;
                text-decoration: none;
                cursor: pointer;
            }

            .alert-notification-edit:hover {
                text-decoration: underline;
            }

            .alert-notification-timestamp {
                font-size: 11px;
                color: #787B86;
            }

            .alert-notification-close {
                background: none;
                border: none;
                font-size: 24px;
                line-height: 1;
                color: #787B86;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                border-radius: 4px;
                transition: all 0.2s ease;
                z-index: 1;
            }

            .alert-notification-close:hover {
                background: rgba(0, 0, 0, 0.05);
                color: #131722;
            }

            @keyframes slideIn {
                from { opacity: 0; transform: translateX(100%); }
                to { opacity: 1; transform: translateX(0); }
            }

            @keyframes slideOut {
                from { opacity: 1; transform: translateX(0); }
                to { opacity: 0; transform: translateX(100%); }
            }
        `;
        document.head.appendChild(style);
    }

    public show(data: AlertNotificationData): void {
        if (!this._container) return;

        const settings = data.notificationSettings;

        // Check if toast notification is enabled (default: true)
        const showToast = settings?.showToast !== false;

        // Check if sound is enabled (default: true)
        const playSound = settings?.playSound !== false;

        // Check if webhook is enabled
        const sendWebhook = settings?.webhookEnabled === true;

        // Show toast notification if enabled
        if (showToast) {
            // Update position before showing
            this._updatePosition();

            // If notification already exists for this alert, dismiss it first
            if (this._notifications.has(data.alertId)) {
                this.dismiss(data.alertId);
            }

            const notification = this._createNotification(data);
            this._container.appendChild(notification);
            this._notifications.set(data.alertId, notification);

            // Auto-dismiss after 60 seconds (RC-5)
            const timeoutId = window.setTimeout(() => {
                this._dismissTimeouts.delete(data.alertId);
                this.dismiss(data.alertId);
            }, 60000);
            this._dismissTimeouts.set(data.alertId, timeoutId);
        }

        // Play sound if enabled
        if (playSound) {
            this._playAlarm();
        }

        // Send webhook if enabled
        if (sendWebhook && settings) {
            this._sendWebhook(data, settings);
        }

        // Send Telegram notification if enabled
        if (settings?.telegramEnabled) {
            this._sendTelegram(data, settings);
        }
    }

    private async _sendWebhook(data: AlertNotificationData, settings: AlertNotificationSettings): Promise<void> {
        try {
            const result = await processAlertWebhook(
                {
                    symbol: data.symbol,
                    exchange: data.exchange || 'NSE',
                    price: data.numericPrice || parseFloat(data.price) || 0,
                    direction: data.direction,
                    condition: data.condition,
                    close: data.closePrice || data.numericPrice || parseFloat(data.price) || 0,
                },
                {
                    enabled: settings.webhookEnabled,
                    mode: settings.webhookMode || 'openalgo',
                    url: settings.webhookUrl,
                    message: settings.message,
                    // Always provide openalgoSettings when mode is openalgo (or default)
                    openalgoSettings: (settings.webhookMode || 'openalgo') === 'openalgo' ? {
                        action: settings.openalgoAction || 'BUY',
                        product: settings.openalgoProduct || 'MIS',
                        quantity: settings.openalgoQuantity || 1,
                        pricetype: settings.openalgoPricetype || 'MARKET',
                    } : undefined,
                }
            );

            if (!result.success) {
                console.error('[AlertNotification] Webhook failed:', result.message);
                // Show error toast notification
                this._showWebhookResultToast(false, result.message);
            } else {
                console.log('[AlertNotification] Webhook sent:', result.message);
                // Show success toast notification
                this._showWebhookResultToast(true, result.message);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error('[AlertNotification] Webhook error:', errorMsg);
            this._showWebhookResultToast(false, errorMsg);
        }
    }

    private async _sendTelegram(data: AlertNotificationData, settings: AlertNotificationSettings): Promise<void> {
        try {
            // Build the payload for message template processing
            const payload: WebhookPayload = {
                symbol: data.symbol,
                exchange: data.exchange || 'NSE',
                price: data.numericPrice || parseFloat(data.price) || 0,
                direction: data.direction,
                condition: data.condition,
                timestamp: Date.now(),
                close: data.closePrice || data.numericPrice || parseFloat(data.price) || 0,
            };

            // Process message template or use default
            const message = settings.message
                ? processMessageTemplate(settings.message, payload)
                : `🔔 Alert: ${data.symbol} ${data.condition} ${data.price}`;

            // Send to Telegram with priority 7 (high - for price alerts)
            const result = await sendTelegramNotification(message, 7);

            if (!result.success) {
                console.error('[AlertNotification] Telegram failed:', result.error);
                this._showWebhookResultToast(false, `Telegram: ${result.error}`);
            } else {
                console.log('[AlertNotification] Telegram sent successfully');
                this._showWebhookResultToast(true, 'Telegram notification sent');
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error('[AlertNotification] Telegram error:', errorMsg);
            this._showWebhookResultToast(false, `Telegram: ${errorMsg}`);
        }
    }

    private _showWebhookResultToast(success: boolean, message: string): void {
        // Dispatch custom event for App.jsx to handle via standard Toast
        const event = new CustomEvent('oa-show-toast', {
            detail: {
                message: success ? `✓ ${message}` : `✗ ${message}`,
                type: success ? 'success' : 'error'
            }
        });
        window.dispatchEvent(event);
        return; // Stop here to prevent duplicate "old" popup for webhooks

        // Original logic below is kept but unreachable for webhooks (plugin handles its own visual alerts separately)
        // Create a toast for webhook result
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 50px;
            right: 50px;
            padding: 12px 40px 12px 16px;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            z-index: 10001;
            max-width: 400px;
            word-wrap: break-word;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
            background: ${success ? 'linear-gradient(135deg, #10B981, #059669)' : 'linear-gradient(135deg, #EF4444, #DC2626)'};
        `;

        // Content span
        const content = document.createElement('span');
        content.textContent = success ? `✓ ${message}` : `✗ ${message}`;
        toast.appendChild(content);

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            background: transparent;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            padding: 0 4px;
            line-height: 1;
            opacity: 0.8;
        `;
        closeBtn.onmouseover = () => closeBtn.style.opacity = '1';
        closeBtn.onmouseout = () => closeBtn.style.opacity = '0.8';
        closeBtn.onclick = () => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        };
        toast.appendChild(closeBtn);

        // Add animation keyframes if not already added
        if (!document.getElementById('webhook-toast-style')) {
            const style = document.createElement('style');
            style.id = 'webhook-toast-style';
            style.textContent = `
                @keyframes slideIn {
                    from { opacity: 0; transform: translateX(20px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(toast);

        // Auto-dismiss after 60 seconds
        const timeoutId = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 60000);

        // Clear timeout if manually closed
        closeBtn.onclick = () => {
            clearTimeout(timeoutId);
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        };
    }

    private _playAlarm(): void {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;

            const ctx = new AudioContext();
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.type = "square";          // matches uploaded alarm tone
            oscillator.frequency.value = 2048;   // ~2kHz sharp alarm pitch

            const now = ctx.currentTime;

            /**
             * 3 seconds total:
             * beep ON 150ms → OFF 150ms repeating
             * Each cycle = 0.30s → 3s total = 10 pulses
             */
            for (let i = 0; i < 10; i++) {
                const t = now + i * 0.30;
                gainNode.gain.setValueAtTime(1.0, t);        // beep
                gainNode.gain.setValueAtTime(0.0, t + 0.15);  // off pause
            }

            oscillator.start(now);
            oscillator.stop(now + 3.1);         // full alarm = 3 seconds (10 pulses * 0.3s)

            oscillator.onended = () => ctx.close();  // cleanup

        } catch (error) {
            console.error("Alarm sound failed:", error);
        }
    }

    private _updatePosition(): void {
        if (!this._container || !this._manager) return;

        const chartRect = this._manager.getChartRect();
        if (chartRect) {
            // 30px from left, 15px from bottom (relative to chart)
            // Since container is fixed, we use client coordinates
            const left = chartRect.left + 15;
            const bottom = window.innerHeight - chartRect.bottom + 30;

            this._container.style.left = `${left}px`;
            this._container.style.bottom = `${bottom}px`;
            this._container.style.top = 'auto';
            this._container.style.right = 'auto';
        } else {
            // Fallback
            this._container.style.left = '20px';
            this._container.style.bottom = '20px';
            this._container.style.top = 'auto';
            this._container.style.right = 'auto';
        }
    }

    public dismiss(alertId: string): void {
        // Clear timeout if exists (RC-5)
        const timeoutId = this._dismissTimeouts.get(alertId);
        if (timeoutId) {
            clearTimeout(timeoutId);
            this._dismissTimeouts.delete(alertId);
        }

        const notification = this._notifications.get(alertId);
        if (notification) {
            notification.classList.add('dismissing');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                this._notifications.delete(alertId);
            }, 300);
        }
    }

    public destroy(): void {
        // Clear all timeouts
        this._dismissTimeouts.forEach((timeoutId) => {
            clearTimeout(timeoutId);
        });
        this._dismissTimeouts.clear();

        this._notifications.forEach((_, alertId) => {
            this.dismiss(alertId);
        });
        if (this._container && this._container.parentNode) {
            this._container.parentNode.removeChild(this._container);
        }
        this._container = null;
        this._manager = null;
    }

    private _createContainer(): HTMLElement {
        const container = document.createElement('div');
        container.className = 'alert-notifications-container';
        return container;
    }

    private _createNotification(data: AlertNotificationData): HTMLElement {
        const notification = document.createElement('div');
        notification.className = 'alert-notification';

        // Alert icon (coin emoji)
        const iconDiv = document.createElement('div');
        iconDiv.className = 'alert-notification-icon';
        iconDiv.textContent = '🪙';
        notification.appendChild(iconDiv);

        // Content section
        const contentDiv = document.createElement('div');
        contentDiv.className = 'alert-notification-content';

        // Header with "Alert on SYMBOL"
        const headerDiv = document.createElement('div');
        headerDiv.className = 'alert-notification-header';
        headerDiv.textContent = `Alert on ${data.symbol}`;
        contentDiv.appendChild(headerDiv);

        // Message with crossing price
        const messageDiv = document.createElement('div');
        messageDiv.className = 'alert-notification-message';
        // Format message based on condition
        let action = 'Crossing';
        if (data.condition === 'crossing_up') action = 'Crossing Up';
        else if (data.condition === 'crossing_down') action = 'Crossing Down';
        else if (data.condition === 'entering') action = 'Entering';
        else if (data.condition === 'exiting') action = 'Exiting';
        else if (data.condition === 'inside') action = 'Inside';
        else if (data.condition === 'outside') action = 'Outside';

        messageDiv.textContent = `${data.symbol} ${action} ${data.price}`;
        contentDiv.appendChild(messageDiv);

        // Footer with edit link and timestamp
        const footerDiv = document.createElement('div');
        footerDiv.className = 'alert-notification-footer';

        const editLink = document.createElement('a');
        editLink.className = 'alert-notification-edit';
        editLink.href = '#';
        editLink.textContent = 'Edit alert';
        editLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (data.onEdit) {
                data.onEdit(data);
            }
        });
        footerDiv.appendChild(editLink);

        const timestamp = document.createElement('span');
        timestamp.className = 'alert-notification-timestamp';
        timestamp.textContent = this._formatTime(data.timestamp);
        footerDiv.appendChild(timestamp);

        contentDiv.appendChild(footerDiv);
        notification.appendChild(contentDiv);

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'alert-notification-close';
        closeBtn.innerHTML = '×';
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.dismiss(data.alertId);
        });
        notification.appendChild(closeBtn);

        return notification;
    }

    private _formatTime(timestamp: number): string {
        const date = new Date(timestamp);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }
}
