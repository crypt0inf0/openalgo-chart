import { useState, useEffect, useRef } from 'react';
import {
    getPositionBook,
    getOrderBook,
    getFunds,
    getHoldings,
    getTradeBook
} from '../services/openalgo';

export const useTradingData = (isAuthenticated) => {
    const [positions, setPositions] = useState([]);
    const [orders, setOrders] = useState([]);
    const [funds, setFunds] = useState({});
    const [holdings, setHoldings] = useState([]);
    const [trades, setTrades] = useState([]);
    const [activeOrders, setActiveOrders] = useState([]);
    const [activePositions, setActivePositions] = useState([]);

    // Use refs to track if component is mounted to prevent state updates after unmount
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    useEffect(() => {
        let intervalId;

        const fetchData = async () => {
            if (!isAuthenticated) return;

            try {
                // Fetch all data in parallel
                const [posData, orderData, fundsData, holdingsData, tradeData] = await Promise.all([
                    getPositionBook(),
                    getOrderBook(),
                    getFunds(),
                    getHoldings(),
                    getTradeBook()
                ]);

                if (!isMounted.current) return;

                // Positions
                // getPositionBook returns array directly in service implementation or []
                const positionsList = Array.isArray(posData) ? posData : [];
                setPositions(positionsList);

                if (positionsList.length > 0) {
                    console.log('[useTradingData] Positions:', positionsList);
                }

                // Orders
                // getOrderBook returns { orders: [], statistics: {} }
                const orderList = Array.isArray(orderData.orders) ? orderData.orders : [];
                setOrders(orderList);

                // Funds
                setFunds(fundsData || {});

                // Holdings
                const holdingsList = holdingsData && Array.isArray(holdingsData.holdings) ? holdingsData.holdings : [];
                setHoldings(holdingsList);

                // Trades
                const tradeList = Array.isArray(tradeData) ? tradeData : [];
                setTrades(tradeList);

                // Filter Active Orders for Chart
                // Status: OPEN, TRIGGER PENDING (with normalization), VALIDATION PENDING
                const active = orderList.filter(o => {
                    // Check both status and order_status fields for compatibility
                    const status = (o.status || o.order_status || '').toUpperCase().replace(/\s+/g, '_'); // Normalize "Trigger Pending" -> "TRIGGER_PENDING"
                    return ['OPEN', 'PENDING', 'TRIGGER_PENDING', 'VALIDATION_PENDING'].includes(status);
                });
                setActiveOrders(active);

                // Active Positions for Chart (non-closed)
                // Assuming all positions in book are open unless quantity is 0
                // Some brokers remove closed positions from the book immediately
                const activePos = positionsList.filter(p => parseFloat(p.quantity || 0) !== 0);
                setActivePositions(activePos);

            } catch (error) {
                console.error("Error fetching trading data:", error);
            }
        };

        // Initial fetch
        fetchData();

        // Poll every 3 seconds
        intervalId = setInterval(fetchData, 3000);

        return () => clearInterval(intervalId);
    }, [isAuthenticated]);

    // Function to manually refresh data (e.g. after placing an order)
    const refreshTradingData = async () => {
        if (!isAuthenticated) return;

        try {
            const [posData, orderData, fundsData, holdingsData, tradeData] = await Promise.all([
                getPositionBook(),
                getOrderBook(),
                getFunds(),
                getHoldings(),
                getTradeBook()
            ]);

            if (!isMounted.current) return;

            const positionsList = Array.isArray(posData) ? posData : [];
            setPositions(positionsList);

            const orderList = Array.isArray(orderData.orders) ? orderData.orders : [];
            setOrders(orderList);

            setFunds(fundsData || {});

            setHoldings(holdingsData && Array.isArray(holdingsData.holdings) ? holdingsData.holdings : []);

            setTrades(Array.isArray(tradeData) ? tradeData : []);

            const active = orderList.filter(o => {
                const status = (o.status || '').toUpperCase().replace(/\s+/g, '_');
                return ['OPEN', 'PENDING', 'TRIGGER_PENDING', 'VALIDATION_PENDING'].includes(status);
            });
            setActiveOrders(active);

            const activePos = positionsList.filter(p => parseFloat(p.quantity || 0) !== 0);
            setActivePositions(activePos);

        } catch (error) {
            console.error("Error refreshing trading data:", error);
        }
    };

    return {
        positions,
        orders,
        funds,
        holdings,
        trades,
        activeOrders,
        activePositions,
        refreshTradingData
    };
};
