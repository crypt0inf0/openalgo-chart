/**
 * OrderContext - Centralized state management for orders and positions
 *
 * Eliminates prop drilling through App → ChartGrid → ChartComponent → VisualTrading
 * Provides single source of truth for trading data across the application
 */

import React, { createContext, useContext } from 'react';
import { useTradingData } from '../hooks/useTradingData';
import { useOrderHandlers } from '../hooks/useOrderHandlers';
import { useUser } from './UserContext';

const OrderContext = createContext(null);

export const OrderProvider = ({ children, showToast }) => {
    const { isAuthenticated } = useUser();

    // Fetch trading data with event-driven updates
    const {
        positions,
        orders,
        funds,
        holdings,
        trades,
        activeOrders,
        activePositions,
        refreshTradingData
    } = useTradingData(isAuthenticated);

    // Order operation handlers
    const { handleModifyOrder, handleCancelOrder } = useOrderHandlers({
        activeOrders,
        showToast,
        refreshTradingData
    });

    const value = {
        // Raw data
        orders,
        positions,
        funds,
        holdings,
        trades,

        // Filtered data for chart visualization
        activeOrders,
        activePositions,

        // Operations
        onModifyOrder: handleModifyOrder,
        onCancelOrder: handleCancelOrder,
        refresh: refreshTradingData
    };

    return (
        <OrderContext.Provider value={value}>
            {children}
        </OrderContext.Provider>
    );
};

/**
 * Hook to consume order context
 * @returns {Object} Order context value
 * @throws {Error} If used outside OrderProvider
 */
export const useOrders = () => {
    const context = useContext(OrderContext);

    if (!context) {
        throw new Error('useOrders must be used within OrderProvider');
    }

    return context;
};

export default OrderContext;
