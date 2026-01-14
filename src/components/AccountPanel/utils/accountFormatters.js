/**
 * Account Panel Formatters
 * Utility functions for formatting currency and P&L values
 */

/**
 * Format currency values in Indian locale
 * @param {number|string} value - Value to format
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (value) => {
    if (value === null || value === undefined) return '0.00';
    const num = parseFloat(value);
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Format P&L with sign and color indicator
 * @param {number|string} value - P&L value
 * @returns {Object} { value: string, isPositive: boolean }
 */
export const formatPnL = (value) => {
    const num = parseFloat(value) || 0;
    const formatted = formatCurrency(Math.abs(num));
    const sign = num >= 0 ? '+' : '-';
    return { value: `${sign}${formatted}`, isPositive: num >= 0 };
};

/**
 * Check if order status is open/pending
 * @param {string} status - Order status
 * @returns {boolean}
 */
export const isOpenOrderStatus = (status) => {
    const s = (status || '').toUpperCase().replace(/\s+/g, '_');
    return ['OPEN', 'PENDING', 'TRIGGER_PENDING', 'AMO_REQ_RECEIVED', 'VALIDATION_PENDING'].includes(s);
};

/**
 * Calculate order statistics from order list
 * @param {Array} orders - Orders array
 * @returns {Object} { open, completed, rejected }
 */
export const calculateOrderStats = (orders) => {
    return (orders || []).reduce((acc, o) => {
        const s = (o.status || o.order_status || '').toUpperCase().replace(/\s+/g, '_');
        if (['OPEN', 'PENDING', 'TRIGGER_PENDING', 'AMO_REQ_RECEIVED', 'VALIDATION_PENDING'].includes(s)) acc.open++;
        else if (['COMPLETE', 'COMPLETED'].includes(s)) acc.completed++;
        else if (['REJECTED', 'CANCELLED', 'CANCELED'].includes(s)) acc.rejected++;
        return acc;
    }, { open: 0, completed: 0, rejected: 0 });
};

export default {
    formatCurrency,
    formatPnL,
    isOpenOrderStatus,
    calculateOrderStats,
};
