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
 * Check if order status is open/pending (cancellable)
 * @param {string} status - Order status
 * @returns {boolean}
 */
export const isOpenOrderStatus = (status) => {
    const s = (status || '').toUpperCase().replace(/\s+/g, '_');

    // Expanded list of cancellable statuses across different brokers
    const cancellableStatuses = [
        'OPEN',
        'PENDING',
        'TRIGGER_PENDING',
        'AMO_REQ_RECEIVED',
        'VALIDATION_PENDING',
        'NOT_TRIGGERED',        // For stop loss orders not yet triggered
        'AFTER_MARKET_ORDER',   // AMO variant used by some brokers
        'PENDING_APPROVAL',     // Some brokers require approval
        'QUEUED'                // Order in queue waiting to be processed
    ];

    return cancellableStatuses.includes(s);
};

/**
 * Calculate order statistics from order list
 * @param {Array} orders - Orders array
 * @returns {Object} { open, completed, rejected }
 */
export const calculateOrderStats = (orders) => {
    return (orders || []).reduce((acc, o) => {
        const status = o.status || o.order_status || '';
        // Use isOpenOrderStatus to check if order is open/pending
        if (isOpenOrderStatus(status)) acc.open++;
        else if (['COMPLETE', 'COMPLETED'].includes(status.toUpperCase().replace(/\s+/g, '_'))) acc.completed++;
        else if (['REJECTED', 'CANCELLED', 'CANCELED'].includes(status.toUpperCase().replace(/\s+/g, '_'))) acc.rejected++;
        return acc;
    }, { open: 0, completed: 0, rejected: 0 });
};

/**
 * Sort data array by a specific key
 * @param {Array} data - Data array to sort
 * @param {Object} sortConfig - Sort configuration { key, direction }
 * @returns {Array} Sorted data array
 */
export const sortData = (data, sortConfig) => {
    if (!sortConfig || !sortConfig.key) return data;

    return [...data].sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        // Handle null/undefined values
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        // Numeric comparison
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }

        // Try to parse as numbers if strings contain numeric values
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) {
            return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
        }

        // String comparison
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();

        if (sortConfig.direction === 'asc') {
            return aStr.localeCompare(bStr);
        } else {
            return bStr.localeCompare(aStr);
        }
    });
};

/**
 * Format timestamp to human-readable time for closed positions
 * @param {string} timestamp - ISO timestamp
 * @returns {string} - "2:30 PM" or "Today 2:30 PM"
 */
export const formatClosedTime = (timestamp) => {
    if (!timestamp) return '-';

    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const timeString = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    return isToday ? timeString : `${date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} ${timeString}`;
};

export default {
    formatCurrency,
    formatPnL,
    isOpenOrderStatus,
    calculateOrderStats,
    sortData,
    formatClosedTime,
};
