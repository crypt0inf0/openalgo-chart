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
            console.error('[App] Order mismatch! Available IDs:', activeOrders.map(o => o.orderid));
            showToast(`Order ${orderId} not found`, 'error');
            return;
        }

        try {
            // Round price to 2 decimal places for Indian markets
            const roundedPrice = parseFloat(newPrice.toFixed(2));

            const payload = {
                orderid: orderId,
                strategy: order.strategy || 'MANUAL',  // Use order's strategy or default to MANUAL
                exchange: order.exchange,
                symbol: order.symbol,
                action: order.action,
                product: order.product,
                pricetype: order.pricetype,
                price: roundedPrice,
                quantity: parseInt(order.quantity),
                disclosed_quantity: parseInt(order.disclosed_quantity || 0),
                trigger_price: (order.pricetype === 'SL' || order.pricetype === 'SL-M')
                    ? roundedPrice  // For SL orders, dragging modifies trigger price
                    : (parseFloat(order.trigger_price) || 0)
            };

            console.log('[App] Modifying order with payload:', payload);

            const result = await modifyOrder(payload);

            console.log('[App] Modify order result:', result);

            if (result.status === 'success') {
                showToast(
                    `Modified: ${order.action} ${order.symbol} @ ₹${roundedPrice} (Qty: ${order.quantity})`,
                    'success'
                );
                // Refresh trading data to update UI
                refreshTradingData();
            } else {
                console.error('[App] Modify order failed:', result.message);
                showToast(`Modify failed: ${result.message}`, 'error');
            }
        } catch (e) {
            console.error('[App] Order modification error:', e);
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
