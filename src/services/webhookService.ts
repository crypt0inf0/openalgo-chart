/**
 * Webhook Service
 * Handles sending POST requests when alerts trigger.
 * Supports both OpenAlgo trading API and custom webhook URLs.
 */

import { getApiKey, getApiBase } from './openalgo.js';
import logger from '../utils/logger.js';

export interface WebhookPayload {
    symbol: string;
    exchange: string;
    price: number;
    direction: 'up' | 'down';
    condition: string;
    timestamp: number;
    message?: string;
    close?: number;
}

export interface OpenAlgoPayload {
    apikey: string;
    strategy: string;
    symbol: string;
    action: 'BUY' | 'SELL';
    exchange: string;
    pricetype: 'MARKET' | 'LIMIT';
    product: 'MIS' | 'CNC' | 'NRML';
    quantity: string;
    price: string;
    trigger_price: string;
    disclosed_quantity: string;
}

/**
 * Check if a symbol is an index (cannot place orders on indices)
 */
function isIndexSymbol(symbol: string, exchange: string): boolean {
    // Common index patterns
    const indexPatterns = [
        /^NIFTY$/i,
        /^BANKNIFTY$/i,
        /^FINNIFTY$/i,
        /^MIDCPNIFTY$/i,
        /^SENSEX$/i,
        /^BANKEX$/i,
    ];

    // Check if exchange is an index exchange
    const isIndexExchange = exchange.toUpperCase().includes('INDEX') ||
        exchange.toUpperCase() === 'NSE_INDEX' ||
        exchange.toUpperCase() === 'BSE_INDEX';

    if (isIndexExchange) return true;

    // Check if symbol matches index patterns
    return indexPatterns.some(pattern => pattern.test(symbol));
}

export interface OpenAlgoSettings {
    action: 'BUY' | 'SELL';
    product: 'MIS' | 'CNC' | 'NRML';
    quantity: number;
    pricetype: 'MARKET' | 'LIMIT';
}

/**
 * Process message template by replacing {{variables}} with actual values.
 */
export function processMessageTemplate(template: string, data: WebhookPayload): string {
    if (!template) return '';

    return template
        .replace(/\{\{symbol\}\}/gi, data.symbol || '')
        .replace(/\{\{exchange\}\}/gi, data.exchange || '')
        .replace(/\{\{price\}\}/gi, String(data.price || ''))
        .replace(/\{\{direction\}\}/gi, data.direction || '')
        .replace(/\{\{condition\}\}/gi, data.condition || '')
        .replace(/\{\{time\}\}/gi, new Date(data.timestamp).toLocaleTimeString())
        .replace(/\{\{close\}\}/gi, String(data.close || data.price || ''));
}

/**
 * Send POST request to a custom webhook URL.
 * If the message is valid JSON, it will be sent as-is.
 * Otherwise, it will be wrapped in a simple object.
 */
export async function sendWebhook(url: string, payload: WebhookPayload): Promise<{ success: boolean; error?: string }> {
    if (!url) {
        logger.warn('[WebhookService] No webhook URL provided');
        return { success: false, error: 'No webhook URL provided' };
    }

    try {
        logger.info(`[WebhookService] Sending webhook to ${url}`);

        // Process the message template with variable substitution
        const processedMessage = payload.message
            ? processMessageTemplate(payload.message, payload)
            : '';

        // Determine what to send as the body
        let bodyContent: string;

        if (processedMessage) {
            // Try to parse the message as JSON - if it's valid JSON, use it directly
            try {
                const parsed = JSON.parse(processedMessage);
                bodyContent = JSON.stringify(parsed);
                logger.info('[WebhookService] Sending custom JSON payload');
            } catch {
                // Not valid JSON, send as a simple message wrapper
                bodyContent = JSON.stringify({ message: processedMessage });
                logger.info('[WebhookService] Sending message as wrapper');
            }
        } else {
            // No message template, send the default payload
            bodyContent = JSON.stringify({
                symbol: payload.symbol,
                exchange: payload.exchange,
                price: payload.price,
                direction: payload.direction,
                condition: payload.condition,
                timestamp: payload.timestamp,
            });
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: bodyContent,
        });

        if (!response.ok) {
            const text = await response.text();
            logger.error(`[WebhookService] Webhook failed with status ${response.status}: ${text}`);

            // Try to parse error message from response
            let errorMessage = `Webhook failed (${response.status})`;
            try {
                const errorJson = JSON.parse(text);
                if (errorJson.message) {
                    errorMessage = typeof errorJson.message === 'string'
                        ? errorJson.message
                        : JSON.stringify(errorJson.message);
                }
            } catch {
                // Use raw text if not JSON
                if (text) errorMessage = text.slice(0, 200);
            }

            return { success: false, error: errorMessage };
        }

        logger.info('[WebhookService] Webhook sent successfully');
        return { success: true };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('[WebhookService] Failed to send webhook:', errorMsg);
        return { success: false, error: errorMsg };
    }
}

/**
 * Send order to OpenAlgo via the placeorder API.
 */
export async function sendOpenAlgoOrder(
    symbol: string,
    exchange: string,
    settings: OpenAlgoSettings
): Promise<{ success: boolean; orderid?: string; error?: string }> {
    // Check if symbol is an index - cannot place orders on indices
    if (isIndexSymbol(symbol, exchange)) {
        const errorMsg = `Cannot place orders on index symbol: ${symbol}. Use index futures/options instead.`;
        logger.warn(`[WebhookService] ${errorMsg}`);
        return { success: false, error: errorMsg };
    }

    const apiKey = getApiKey();
    if (!apiKey) {
        logger.warn('[WebhookService] No OpenAlgo API key available');
        return { success: false, error: 'No API key. Please login to OpenAlgo first.' };
    }

    const apiBase = getApiBase();
    const url = `${apiBase}/placeorder`;

    // Build the complete OpenAlgo payload
    const payload: OpenAlgoPayload = {
        apikey: apiKey,
        strategy: 'Chart Alert',
        symbol: symbol,
        action: settings.action,
        exchange: exchange,
        pricetype: settings.pricetype,
        product: settings.product,
        quantity: String(settings.quantity),
        price: '0',
        trigger_price: '0',
        disclosed_quantity: '0',
    };

    try {
        logger.info(`[WebhookService] Placing OpenAlgo order: ${settings.action} ${settings.quantity} ${symbol}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok || data.status === 'error') {
            const errorMsg = data.message || `HTTP ${response.status}`;
            logger.error(`[WebhookService] OpenAlgo order failed: ${errorMsg}`);
            return { success: false, error: errorMsg };
        }

        logger.info(`[WebhookService] OpenAlgo order placed successfully: ${data.orderid}`);
        return { success: true, orderid: data.orderid };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('[WebhookService] Failed to place OpenAlgo order:', errorMsg);
        return { success: false, error: errorMsg };
    }
}

/**
 * Send notification to Telegram via OpenAlgo API.
 */
export async function sendTelegramNotification(
    message: string,
    priority: number = 7
): Promise<{ success: boolean; error?: string }> {
    const apiKey = getApiKey();
    if (!apiKey) {
        logger.warn('[WebhookService] No OpenAlgo API key available for Telegram');
        return { success: false, error: 'No API key. Please login to OpenAlgo first.' };
    }

    // Get username from localStorage (OpenAlgo login username)
    const username = localStorage.getItem('oa_username') || '';
    if (!username) {
        logger.warn('[WebhookService] No username found. Please login to OpenAlgo.');
        return { success: false, error: 'No username found. Please login to OpenAlgo.' };
    }

    const apiBase = getApiBase();
    const url = `${apiBase}/telegram/notify`;

    const payload = {
        apikey: apiKey,
        username: username,
        message: message,
        priority: priority
    };

    try {
        logger.info(`[WebhookService] Sending Telegram notification: ${message.slice(0, 50)}...`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok || data.status === 'error') {
            const errorMsg = data.message || `HTTP ${response.status}`;
            logger.error(`[WebhookService] Telegram notification failed: ${errorMsg}`);
            return { success: false, error: errorMsg };
        }

        logger.info('[WebhookService] Telegram notification sent successfully');
        return { success: true };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('[WebhookService] Failed to send Telegram notification:', errorMsg);
        return { success: false, error: errorMsg };
    }
}

/**
 * Process alert trigger and send appropriate notifications.
 * Called when an alert is triggered.
 */
export async function processAlertWebhook(
    alertData: {
        symbol: string;
        exchange: string;
        price: number;
        direction: 'up' | 'down';
        condition: string;
        close: number;
    },
    webhookSettings: {
        enabled: boolean;
        mode: 'openalgo' | 'custom';
        url?: string;
        message?: string;
        openalgoSettings?: OpenAlgoSettings;
    }
): Promise<{ success: boolean; message: string }> {
    if (!webhookSettings.enabled) {
        return { success: true, message: 'Webhook disabled' };
    }

    const payload: WebhookPayload = {
        symbol: alertData.symbol,
        exchange: alertData.exchange,
        price: alertData.price,
        direction: alertData.direction,
        condition: alertData.condition,
        timestamp: Date.now(),
        close: alertData.close,
        message: webhookSettings.message,
    };

    logger.info('[WebhookService] processAlertWebhook called with:', {
        mode: webhookSettings.mode,
        hasOpenAlgoSettings: !!webhookSettings.openalgoSettings,
        hasUrl: !!webhookSettings.url,
        url: webhookSettings.url ? '[REDACTED]' : undefined
    });

    // Use OpenAlgo mode by default, or when explicitly set to openalgo
    const isOpenAlgoMode = webhookSettings.mode === 'openalgo' || !webhookSettings.mode;

    if (isOpenAlgoMode) {
        // Always use OpenAlgo path when mode is openalgo, with sensible defaults
        const settings = webhookSettings.openalgoSettings || {
            action: 'BUY' as const,
            product: 'MIS' as const,
            quantity: 1,
            pricetype: 'MARKET' as const,
        };

        logger.info('[WebhookService] Using OpenAlgo mode');
        const result = await sendOpenAlgoOrder(
            alertData.symbol,
            alertData.exchange,
            settings
        );
        return {
            success: result.success,
            message: result.success
                ? `Order placed: ${result.orderid}`
                : `Order failed: ${result.error}`,
        };
    } else if (webhookSettings.mode === 'custom' && webhookSettings.url) {
        // Check if custom URL is pointing to localhost - route through proxy to avoid CORS
        let targetUrl = webhookSettings.url;

        // Transform localhost URLs to go through the Vite proxy
        // e.g., http://127.0.0.1:5000/api/v1/placesmartorder -> /api/v1/placesmartorder
        if (targetUrl.includes('127.0.0.1:5000') || targetUrl.includes('localhost:5000')) {
            try {
                const urlObj = new URL(targetUrl);
                targetUrl = urlObj.pathname; // e.g., /api/v1/placesmartorder
                logger.info('[WebhookService] Routing localhost URL through proxy:', targetUrl);
            } catch (e) {
                logger.warn('[WebhookService] Failed to parse URL, using as-is');
            }
        }

        logger.info('[WebhookService] Using custom webhook mode to:', targetUrl);
        const result = await sendWebhook(targetUrl, payload);
        return {
            success: result.success,
            message: result.success ? 'Webhook sent' : (result.error || 'Webhook failed'),
        };
    }

    logger.warn('[WebhookService] Invalid webhook configuration');
    return { success: false, message: 'Invalid webhook configuration' };
}
