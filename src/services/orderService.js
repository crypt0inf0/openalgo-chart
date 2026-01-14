/**
 * Order Service
 * Order management operations - place, modify, cancel orders
 */

import logger from '../utils/logger.js';
import { getApiKey, getApiBase } from './apiConfig';

/**
 * Place a new order
 * @param {Object} orderDetails - Order details
 * @param {string} orderDetails.symbol - Trading symbol
 * @param {string} orderDetails.exchange - Exchange (NSE, NFO, etc.)
 * @param {string} orderDetails.action - BUY or SELL
 * @param {string} orderDetails.quantity - Quantity
 * @param {string} orderDetails.product - MIS, CNC, NRML
 * @param {string} orderDetails.pricetype - MARKET, LIMIT, SL, SL-M
 * @param {number} orderDetails.price - Price (for LIMIT/SL)
 * @param {number} orderDetails.trigger_price - Trigger Price (for SL/SL-M)
 * @param {string} orderDetails.strategy - Strategy name (optional)
 * @returns {Promise<Object>} { orderid, status, message }
 */
export const placeOrder = async (orderDetails) => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) throw new Error('API Key not found');

        const requestBody = {
            apikey: apiKey,
            strategy: orderDetails.strategy || 'MANUAL',
            exchange: orderDetails.exchange || 'NSE',
            symbol: orderDetails.symbol,
            action: orderDetails.action,
            quantity: parseInt(orderDetails.quantity, 10),
            product: orderDetails.product || 'MIS',
            pricetype: orderDetails.pricetype || 'MARKET',
            price: parseFloat(orderDetails.price || 0),
            trigger_price: parseFloat(orderDetails.trigger_price || 0),
            disclosed_quantity: 0
        };

        logger.debug('[OpenAlgo] Place Order request:', requestBody);

        const response = await fetch(`${getApiBase()}/placeorder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Order failed: ${response.status}`);
        }

        const data = await response.json();
        logger.debug('[OpenAlgo] Place Order response:', data);

        if (data.status === 'success') {
            return {
                orderid: data.orderid,
                status: 'success',
                message: data.message
            };
        } else {
            return {
                status: 'error',
                message: data.message || 'Unknown error'
            };
        }
    } catch (error) {
        console.error('[OpenAlgo] Place Order error:', error);
        return {
            status: 'error',
            message: error.message
        };
    }
};

/**
 * Modify an existing order
 * @param {Object} orderDetails - Order modification details
 * @returns {Promise<Object>} { orderid, status, message }
 */
export const modifyOrder = async (orderDetails) => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) throw new Error('API Key not found');

        const requestBody = {
            apikey: apiKey,
            ...orderDetails
        };

        logger.debug('[OpenAlgo] Modify Order request:', requestBody);

        const response = await fetch(`${getApiBase()}/modifyorder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Modify order failed: ${response.status}`);
        }

        const data = await response.json();
        logger.debug('[OpenAlgo] Modify Order response:', data);

        if (data.status === 'success') {
            return {
                orderid: data.orderid,
                status: 'success',
                message: data.message
            };
        } else {
            return {
                status: 'error',
                message: data.message || 'Unknown error'
            };
        }
    } catch (error) {
        console.error('[OpenAlgo] Modify Order error:', error);
        return {
            status: 'error',
            message: error.message
        };
    }
};

/**
 * Cancel an existing order
 * @param {string|Object} orderDetails - Order ID or object with orderid/order
 * @returns {Promise<Object>} { status, message, brokerResponse }
 */
export const cancelOrder = async (orderDetails) => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) throw new Error('API Key not found');

        // Handle multiple input formats: string, { orderid }, or { order: {...} }
        const order = orderDetails.order || orderDetails;
        const orderid = typeof order === 'string' ? order : order.orderid;

        // Log the order details being sent for debugging
        console.log('[OrderService] Cancel Order Request:', {
            orderid: orderid,
            symbol: order.symbol || 'N/A',
            status: order.order_status || 'N/A',
            action: order.action || 'N/A',
            quantity: order.quantity || 'N/A',
            timestamp: new Date().toISOString()
        });

        const requestBody = {
            apikey: apiKey,
            orderid: orderid,
            strategy: order.strategy || 'MANUAL'  // Required by broker API
        };

        logger.debug('[OpenAlgo] Cancel Order request:', requestBody);

        const response = await fetch(`${getApiBase()}/cancelorder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));

            // Log the full error response
            console.error('[OrderService] Cancel Order HTTP Error:', {
                status: response.status,
                statusText: response.statusText,
                errorData: errorData
            });

            throw new Error(errorData.message || `Cancel order failed: ${response.status}`);
        }

        const data = await response.json();

        // Log the full response for debugging
        console.log('[OrderService] Cancel Order Response:', {
            status: response.status,
            data: data,
            success: data.status === 'success',
            timestamp: new Date().toISOString()
        });

        logger.debug('[OpenAlgo] Cancel Order response:', data);

        if (data.status === 'success') {
            return {
                status: 'success',
                message: data.message
            };
        } else {
            // Include broker response in error for better debugging
            console.error('[OrderService] Cancel failed:', data.message);
            return {
                status: 'error',
                message: data.message || 'Unknown error',
                brokerResponse: data
            };
        }
    } catch (error) {
        console.error('[OpenAlgo] Cancel Order error:', error);
        return {
            status: 'error',
            message: error.message,
            errorType: 'network'
        };
    }
};
