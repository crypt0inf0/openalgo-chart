/**
 * Trading Service - OpenAlgo API Integration
 * Handles order placement, positions, and order book
 */

import { getApiBase } from './openalgo';

/**
 * Place an order via OpenAlgo API
 * @param {Object} params - Order parameters
 * @param {string} params.symbol - Trading symbol
 * @param {string} params.exchange - Exchange (NSE, BSE, NFO, etc.)
 * @param {string} params.action - BUY or SELL
 * @param {string} params.product - Product type (MIS, CNC, NRML)
 * @param {string} params.pricetype - Price type (MARKET, LIMIT, SL, SL-M)
 * @param {number} params.quantity - Order quantity
 * @param {number} [params.price] - Limit price (required for LIMIT orders)
 * @param {number} [params.trigger_price] - Trigger price (for SL orders)
 * @param {string} [params.strategy] - Strategy name (default: 'OpenAlgoChart')
 * @param {string} mode - Trading mode: 'live' or 'sandbox'
 * @returns {Promise<Object>} Order response
 */
export const placeOrder = async (params, mode = 'sandbox') => {
    const apiKey = localStorage.getItem('oa_apikey');
    if (!apiKey) {
        throw new Error('API key not configured. Please set it in Settings.');
    }

    const orderData = {
        apikey: apiKey,
        strategy: params.strategy || 'OpenAlgoChart',
        exchange: params.exchange || 'NSE',
        symbol: params.symbol,
        action: params.action,
        product: params.product || 'MIS',
        pricetype: params.pricetype || 'MARKET',
        quantity: String(params.quantity),
    };

    // Add price for LIMIT orders
    if (params.pricetype === 'LIMIT' && params.price) {
        orderData.price = String(params.price);
    }

    // Add trigger price for SL orders
    if (params.trigger_price) {
        orderData.trigger_price = String(params.trigger_price);
    }

    // Use analyze mode endpoint for sandbox
    const endpoint = mode === 'sandbox'
        ? `${getApiBase()}/placesmartorder`  // Smart order handles position sizing
        : `${getApiBase()}/placeorder`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderData),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Order placement failed');
        }

        return data;
    } catch (error) {
        console.error('Order placement error:', error);
        throw error;
    }
};

/**
 * Get open positions from broker
 * @returns {Promise<Array>} List of positions
 */
export const getPositions = async () => {
    const apiKey = localStorage.getItem('oa_apikey');
    if (!apiKey) {
        return [];
    }

    try {
        const response = await fetch(`${getApiBase()}/positionbook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ apikey: apiKey }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Failed to fetch positions:', data);
            return [];
        }

        return data.data || [];
    } catch (error) {
        console.error('Error fetching positions:', error);
        return [];
    }
};

/**
 * Get order book (pending and executed orders)
 * @returns {Promise<Array>} List of orders
 */
export const getOrderBook = async () => {
    const apiKey = localStorage.getItem('oa_apikey');
    if (!apiKey) {
        return [];
    }

    try {
        const response = await fetch(`${getApiBase()}/orderbook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ apikey: apiKey }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Failed to fetch order book:', data);
            return [];
        }

        return data.data || [];
    } catch (error) {
        console.error('Error fetching order book:', error);
        return [];
    }
};

/**
 * Get holdings
 * @returns {Promise<Array>} List of holdings
 */
export const getHoldings = async () => {
    const apiKey = localStorage.getItem('oa_apikey');
    if (!apiKey) {
        return [];
    }

    try {
        const response = await fetch(`${getApiBase()}/holdings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ apikey: apiKey }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Failed to fetch holdings:', data);
            return [];
        }

        return data.data || [];
    } catch (error) {
        console.error('Error fetching holdings:', error);
        return [];
    }
};

/**
 * Cancel an order
 * @param {string} orderId - Order ID to cancel
 * @returns {Promise<Object>} Cancel response
 */
export const cancelOrder = async (orderId) => {
    const apiKey = localStorage.getItem('oa_apikey');
    if (!apiKey) {
        throw new Error('API key not configured');
    }

    try {
        const response = await fetch(`${getApiBase()}/cancelorder`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                apikey: apiKey,
                orderid: orderId,
                strategy: 'OpenAlgoChart',
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Order cancellation failed');
        }

        return data;
    } catch (error) {
        console.error('Order cancellation error:', error);
        throw error;
    }
};

/**
 * Close all positions (square off)
 * @returns {Promise<Object>} Close response
 */
export const closeAllPositions = async () => {
    const apiKey = localStorage.getItem('oa_apikey');
    if (!apiKey) {
        throw new Error('API key not configured');
    }

    try {
        const response = await fetch(`${getApiBase()}/closeposition`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                apikey: apiKey,
                strategy: 'OpenAlgoChart',
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Position close failed');
        }

        return data;
    } catch (error) {
        console.error('Position close error:', error);
        throw error;
    }
};

/**
 * Get account funds and margins
 * @returns {Promise<Object>} Funds data
 */
export const getFunds = async () => {
    const apiKey = localStorage.getItem('oa_apikey');
    if (!apiKey) {
        return null;
    }

    try {
        const response = await fetch(`${getApiBase()}/funds`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ apikey: apiKey }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Failed to fetch funds:', data);
            return null;
        }

        return data.data || data;
    } catch (error) {
        console.error('Error fetching funds:', error);
        return null;
    }
};

/**
 * Modify an existing order
 * @param {string} orderId - Order ID to modify
 * @param {Object} params - Modified order parameters
 * @returns {Promise<Object>} Modify response
 */
export const modifyOrder = async (orderId, params) => {
    const apiKey = localStorage.getItem('oa_apikey');
    if (!apiKey) {
        throw new Error('API key not configured');
    }

    try {
        const response = await fetch(`${getApiBase()}/modifyorder`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                apikey: apiKey,
                orderid: orderId,
                strategy: 'OpenAlgoChart',
                ...params,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Order modification failed');
        }

        return data;
    } catch (error) {
        console.error('Order modification error:', error);
        throw error;
    }
};

/**
 * Square off a single position
 * @param {string} symbol - Symbol to square off
 * @param {string} exchange - Exchange
 * @param {string} product - Product type
 * @returns {Promise<Object>} Square off response
 */
export const squareOffPosition = async (symbol, exchange, product = 'MIS') => {
    const apiKey = localStorage.getItem('oa_apikey');
    if (!apiKey) {
        throw new Error('API key not configured');
    }

    try {
        const response = await fetch(`${getApiBase()}/closeposition`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                apikey: apiKey,
                strategy: 'OpenAlgoChart',
                symbol,
                exchange,
                product,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Square off failed');
        }

        return data;
    } catch (error) {
        console.error('Square off error:', error);
        throw error;
    }
};

/**
 * Get trade book (executed trades)
 * @returns {Promise<Array>} List of trades
 */
export const getTradeBook = async () => {
    const apiKey = localStorage.getItem('oa_apikey');
    if (!apiKey) {
        return [];
    }

    try {
        const response = await fetch(`${getApiBase()}/tradebook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ apikey: apiKey }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Failed to fetch trade book:', data);
            return [];
        }

        return data.data || [];
    } catch (error) {
        console.error('Error fetching trade book:', error);
        return [];
    }
};

export default {
    placeOrder,
    getPositions,
    getOrderBook,
    getHoldings,
    cancelOrder,
    closeAllPositions,
    getFunds,
    modifyOrder,
    squareOffPosition,
    getTradeBook,
};
