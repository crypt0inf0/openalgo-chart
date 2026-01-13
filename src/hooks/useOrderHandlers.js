/**
 * Order Handlers Hook
 * Manages order operations: modify, cancel
 */

import { useCallback } from 'react';
import { modifyOrder, cancelOrder } from '../services/openalgo';

/**
 * Custom hook for order operations
 * @param {Object} params - Hook parameters
 * @param {Array} params.activeOrders - Current active orders
 * @param {Function} params.showToast - Toast notification function
 * @param {Function} params.refreshTradingData - Function to refresh trading data
 * @returns {Object} Order handler functions
 */
export const useOrderHandlers = ({
    activeOrders,
    showToast,
    refreshTradingData
}) => {
    // Modify an existing order
    const handleModifyOrder = useCallback(async (orderId, newPrice) => {
        // Debug: Log what we are looking for
        console.log('[App] handleModifyOrder called with:', { orderId, newPrice });

        // Find order to get other details
        // Check both orderid and order_id, and handle string/number mismatch
        const order = activeOrders.find(o =>
            String(o.orderid) === String(orderId) || String(o.order_id) === String(orderId)
        );

        if (!order) {
            if (process.env.NODE_ENV === 'development') {
                console.error('[App] Order mismatch! Available IDs:', activeOrders.map(o => o.orderid));
            }
            showToast(`Order ${orderId} not found`, 'error');
            return;
        }

        try {
            const payload = {
                orderid: orderId,
                strategy: 'Manual',
                exchange: order.exchange,
                symbol: order.symbol,
                action: order.action,
                product: order.product,
                pricetype: order.pricetype,
                price: newPrice,
                quantity: order.quantity,
                disclosed_quantity: order.disclosed_quantity || 0,
                trigger_price: (order.pricetype === 'SL' || order.pricetype === 'SL-M')
                    ? newPrice
                    : (parseFloat(order.trigger_price) || 0)
            };

            if (process.env.NODE_ENV === 'development') {
                console.log('[App] Modifying order:', payload);
            }

            const result = await modifyOrder(payload);

            if (result.status === 'success') {
                showToast(
                    `${order.action} ${order.symbol} @ ₹${parseFloat(newPrice).toFixed(2)} (Qty: ${order.quantity})`,
                    'success'
                );
                refreshTradingData();
            } else {
                showToast(result.message, 'error');
            }
        } catch (e) {
            if (process.env.NODE_ENV === 'development') {
                console.error('[App] Order modification error:', e);
            }
            showToast(e.message || 'Failed to modify order', 'error');
        }
    }, [activeOrders, showToast, refreshTradingData]);

    // Cancel an existing order
    const handleCancelOrder = useCallback(async (orderId) => {
        // Find order details
        // Check both orderid and order_id, and handle string/number mismatch
        const order = activeOrders.find(o =>
            String(o.orderid) === String(orderId) || String(o.order_id) === String(orderId)
        );

        if (!order) {
            console.error('[App] Cancel Order: Order not found', { orderId });
            showToast(`Order ${orderId} not found`, 'error');
            return;
        }

        try {
            const result = await cancelOrder({
                orderid: orderId,
                strategy: 'Manual'
            });

            if (result.status === 'success') {
                showToast(`Cancelled ${order.action} ${order.symbol}`, 'success');
                refreshTradingData();
            } else {
                showToast(result.message, 'error');
            }
        } catch (e) {
            if (process.env.NODE_ENV === 'development') {
                console.error('[App] Order cancellation error:', e);
            }
            showToast(e.message || 'Failed to cancel order', 'error');
        }
    }, [activeOrders, showToast, refreshTradingData]);

    return {
        handleModifyOrder,
        handleCancelOrder
    };
};

export default useOrderHandlers;
