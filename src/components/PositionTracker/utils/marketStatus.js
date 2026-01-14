/**
 * Market Status Utility
 * Functions for checking market open/close status
 */

import { MARKET_OPEN, MARKET_CLOSE } from '../constants/positionTrackerConstants';

/**
 * Get current market status
 * @returns {Object} { isOpen: boolean, status: string }
 */
export const getMarketStatus = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const day = now.getDay();

    // Weekend check
    if (day === 0 || day === 6) {
        return { isOpen: false, status: 'Weekend' };
    }

    const timeInMinutes = hours * 60 + minutes;
    const openTime = MARKET_OPEN.hour * 60 + MARKET_OPEN.minute;
    const closeTime = MARKET_CLOSE.hour * 60 + MARKET_CLOSE.minute;

    if (timeInMinutes >= openTime && timeInMinutes <= closeTime) {
        return { isOpen: true, status: 'Market Open' };
    } else if (timeInMinutes < openTime) {
        return { isOpen: false, status: 'Pre-Market' };
    } else {
        return { isOpen: false, status: 'Market Closed' };
    }
};

/**
 * Check if market is currently open
 * @returns {boolean}
 */
export const isMarketOpen = () => {
    return getMarketStatus().isOpen;
};

/**
 * Get time until market opens/closes in minutes
 * @returns {Object} { untilOpen: number, untilClose: number }
 */
export const getTimeUntilMarket = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeInMinutes = hours * 60 + minutes;

    const openTime = MARKET_OPEN.hour * 60 + MARKET_OPEN.minute;
    const closeTime = MARKET_CLOSE.hour * 60 + MARKET_CLOSE.minute;

    return {
        untilOpen: openTime - timeInMinutes,
        untilClose: closeTime - timeInMinutes,
    };
};

export default {
    getMarketStatus,
    isMarketOpen,
    getTimeUntilMarket,
};
