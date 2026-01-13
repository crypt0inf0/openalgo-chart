/**
 * Account Service
 * Trading account operations - funds, positions, orders, holdings
 */

import logger from '../utils/logger.js';
import { getApiKey, getApiBase } from './apiConfig';

/**
 * Ping API - Check connectivity and validate API key
 * @returns {Promise<Object|null>} { broker, message } on success, null on error
 */
export const ping = async () => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) return null;

        const response = await fetch(`${getApiBase()}/ping`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ apikey: apiKey })
        });

        if (!response.ok) {
            logger.warn('[OpenAlgo] Ping failed:', response.status);
            return null;
        }

        const data = await response.json();
        if (data.status === 'success') {
            return data.data;
        }
        return null;
    } catch (error) {
        console.error('[OpenAlgo] Ping error:', error);
        return null;
    }
};

/**
 * Get Funds - Fetch account balance and margin details
 * @returns {Promise<Object|null>} { availablecash, collateral, m2mrealized, m2munrealized, utiliseddebits }
 */
export const getFunds = async () => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) return null;

        const response = await fetch(`${getApiBase()}/funds`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ apikey: apiKey })
        });

        if (!response.ok) {
            logger.warn('[OpenAlgo] Funds API failed:', response.status);
            return null;
        }

        const data = await response.json();
        if (data.status === 'success') {
            return data.data;
        }
        return null;
    } catch (error) {
        console.error('[OpenAlgo] Funds error:', error);
        return null;
    }
};

/**
 * Get Position Book - Fetch current open positions
 * @returns {Promise<Array>} Array of position objects
 */
export const getPositionBook = async () => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) return [];

        const response = await fetch(`${getApiBase()}/positionbook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ apikey: apiKey })
        });

        if (!response.ok) {
            logger.warn('[OpenAlgo] PositionBook API failed:', response.status);
            return [];
        }

        const data = await response.json();
        if (data.status === 'success') {
            return data.data || [];
        }
        return [];
    } catch (error) {
        console.error('[OpenAlgo] PositionBook error:', error);
        return [];
    }
};

/**
 * Get Order Book - Fetch all orders with statistics
 * @returns {Promise<Object>} { orders: [], statistics: {} }
 */
export const getOrderBook = async () => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) return { orders: [], statistics: {} };

        const response = await fetch(`${getApiBase()}/orderbook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ apikey: apiKey })
        });

        if (!response.ok) {
            logger.warn('[OpenAlgo] OrderBook API failed:', response.status);
            return { orders: [], statistics: {} };
        }

        const data = await response.json();
        if (data.status === 'success') {
            return data.data || { orders: [], statistics: {} };
        }
        return { orders: [], statistics: {} };
    } catch (error) {
        console.error('[OpenAlgo] OrderBook error:', error);
        return { orders: [], statistics: {} };
    }
};

/**
 * Get Trade Book - Fetch executed trades
 * @returns {Promise<Array>} Array of trade objects
 */
export const getTradeBook = async () => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) return [];

        const response = await fetch(`${getApiBase()}/tradebook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ apikey: apiKey })
        });

        if (!response.ok) {
            logger.warn('[OpenAlgo] TradeBook API failed:', response.status);
            return [];
        }

        const data = await response.json();
        if (data.status === 'success') {
            return data.data || [];
        }
        return [];
    } catch (error) {
        console.error('[OpenAlgo] TradeBook error:', error);
        return [];
    }
};

/**
 * Get Holdings - Fetch long-term stock holdings with P&L
 * @returns {Promise<Object>} { holdings: [], statistics: {} }
 */
export const getHoldings = async () => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) return { holdings: [], statistics: {} };

        const response = await fetch(`${getApiBase()}/holdings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ apikey: apiKey })
        });

        if (!response.ok) {
            logger.warn('[OpenAlgo] Holdings API failed:', response.status);
            return { holdings: [], statistics: {} };
        }

        const data = await response.json();
        if (data.status === 'success') {
            return data.data || { holdings: [], statistics: {} };
        }
        return { holdings: [], statistics: {} };
    } catch (error) {
        console.error('[OpenAlgo] Holdings error:', error);
        return { holdings: [], statistics: {} };
    }
};
