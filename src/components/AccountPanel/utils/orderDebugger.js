/**
 * Order Debug Utility
 * Debug utility for diagnosing order cancellation issues
 */

import { isOpenOrderStatus } from './accountFormatters';

/**
 * Debug order cancellation issues
 * Analyzes order details and logs diagnostic information
 * @param {Object} order - Order object to debug
 */
export const debugOrderCancellation = (order) => {
    console.group('[Order Debug] Cancellation Analysis');

    console.log('Order Details:', {
        orderid: order.orderid,
        symbol: order.symbol,
        status: order.order_status,
        action: order.action,
        quantity: order.quantity,
        filledQty: order.filledqty || order.filled_quantity || 0,
        price: order.price,
        pricetype: order.pricetype,
        product: order.product,
        exchange: order.exchange,
        timestamp: order.timestamp
    });

    // Check if partially filled
    const filled = parseFloat(order.filledqty || order.filled_quantity || 0);
    const total = parseFloat(order.quantity || 0);

    if (filled > 0) {
        const remaining = total - filled;
        console.warn('⚠️ Order is partially filled:', {
            filled: filled,
            total: total,
            remaining: remaining,
            fillPercentage: ((filled / total) * 100).toFixed(2) + '%'
        });

        if (remaining === 0) {
            console.error('❌ Order is completely filled - cannot cancel!');
        } else {
            console.log('ℹ️ Some brokers allow canceling the remaining quantity');
        }
    } else {
        console.log('✓ Order is not filled yet');
    }

    // Check status
    const normalizedStatus = (order.order_status || '').toUpperCase().replace(/\s+/g, '_');
    const isCancellable = isOpenOrderStatus(order.order_status);

    console.log('Status Check:', {
        raw: order.order_status,
        normalized: normalizedStatus,
        isCancellable: isCancellable
    });

    if (!isCancellable) {
        console.error('❌ Order status is NOT cancellable');
        console.log('ℹ️ Cancellable statuses:', [
            'OPEN',
            'PENDING',
            'TRIGGER_PENDING',
            'AMO_REQ_RECEIVED',
            'VALIDATION_PENDING',
            'NOT_TRIGGERED',
            'AFTER_MARKET_ORDER',
            'PENDING_APPROVAL',
            'QUEUED'
        ]);
    } else {
        console.log('✓ Order status is cancellable');
    }

    // Check orderid format
    if (!order.orderid) {
        console.error('❌ Missing orderid!');
    } else if (typeof order.orderid !== 'string' || order.orderid.trim() === '') {
        console.error('❌ Invalid orderid format:', {
            type: typeof order.orderid,
            value: order.orderid
        });
    } else {
        console.log('✓ orderid present:', order.orderid);
    }

    // Check order type and price
    if (order.pricetype === 'SL' || order.pricetype === 'SL-M') {
        console.log('ℹ️ Stop Loss order:', {
            limitPrice: order.price,
            triggerPrice: order.trigger_price || order.triggerprice || 'N/A',
            isTriggered: order.order_status !== 'TRIGGER_PENDING'
        });
    }

    // Check time since order placed
    if (order.timestamp) {
        const orderTime = new Date(order.timestamp);
        const now = new Date();
        const ageMs = now - orderTime;
        const ageSeconds = (ageMs / 1000).toFixed(0);
        const ageMinutes = (ageMs / 60000).toFixed(1);

        console.log('ℹ️ Order age:', {
            placedAt: order.timestamp,
            ageSeconds: `${ageSeconds}s`,
            ageMinutes: `${ageMinutes}min`
        });

        if (ageMs < 1000) {
            console.warn('⚠️ Order is very new - broker might still be processing it');
        }
    }

    console.groupEnd();
};

/**
 * Debug order list
 * Analyzes all orders and provides summary
 * @param {Array} orders - Array of orders
 */
export const debugOrderList = (orders) => {
    console.group('[Order Debug] Order List Analysis');

    console.log('Total orders:', orders.length);

    const statusCounts = orders.reduce((acc, order) => {
        const status = order.order_status || 'UNKNOWN';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});

    console.log('Status breakdown:', statusCounts);

    const cancellableOrders = orders.filter(o => isOpenOrderStatus(o.order_status));
    console.log('Cancellable orders:', cancellableOrders.length);

    if (cancellableOrders.length > 0) {
        console.log('Cancellable order details:', cancellableOrders.map(o => ({
            orderid: o.orderid,
            symbol: o.symbol,
            status: o.order_status,
            action: o.action
        })));
    }

    console.groupEnd();
};

export default {
    debugOrderCancellation,
    debugOrderList
};
