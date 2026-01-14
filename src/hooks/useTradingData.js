import { useState, useEffect, useRef, useCallback } from 'react';
import {
    getPositionBook,
    getOrderBook,
    getFunds,
    getHoldings,
    getTradeBook,
    subscribeToMultiTicker
} from '../services/openalgo';

/**
 * EVENT-DRIVEN Trading Data Hook
 *
 * Strategy:
 * 1. Fetch data immediately when authenticated
 * 2. Subscribe to price WebSocket for positions (existing)
 * 3. Use event-driven updates for orders (fetch after operations)
 * 4. Backup polling at 10 seconds (safety net for missed updates)
 *
 * This avoids aggressive polling while ensuring real-time updates.
 */
export const useTradingData = (isAuthenticated) => {
    const [positions, setPositions] = useState([]);
    const [orders, setOrders] = useState([]);
    const [funds, setFunds] = useState({});
    const [holdings, setHoldings] = useState([]);
    const [trades, setTrades] = useState([]);
    const [activeOrders, setActiveOrders] = useState([]);
    const [activePositions, setActivePositions] = useState([]);
    const [lastOrderUpdate, setLastOrderUpdate] = useState(Date.now());

    // Use refs to track if component is mounted to prevent state updates after unmount
    const isMounted = useRef(true);
    const fetchInProgress = useRef(false);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    // Shared fetch logic
    const fetchData = useCallback(async (source = 'auto') => {
        if (!isAuthenticated || fetchInProgress.current) return;

        fetchInProgress.current = true;
        try {
            console.log(`[useTradingData] Fetching data (source: ${source})`);

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
            const positionsList = Array.isArray(posData) ? posData : [];
            setPositions(positionsList);

            // Orders
            const orderList = Array.isArray(orderData.orders) ? orderData.orders : [];

            // Log order updates for debugging
            if (orderList.length > 0) {
                console.log('[useTradingData] Orders updated:', orderList.length, 'orders', `(source: ${source})`);
                const openOrders = orderList.filter(o => {
                    const status = (o.status || o.order_status || '').toUpperCase().replace(/\s+/g, '_');
                    return ['OPEN', 'PENDING', 'TRIGGER_PENDING', 'VALIDATION_PENDING'].includes(status);
                });
                if (openOrders.length > 0) {
                    console.log('[useTradingData] Open orders:', openOrders.map(o => ({
                        id: o.orderid,
                        symbol: o.symbol,
                        price: o.price,
                        status: o.order_status || o.status
                    })));
                }
            }

            setOrders(orderList);
            setLastOrderUpdate(Date.now());

            // Funds
            setFunds(fundsData || {});

            // Holdings
            const holdingsList = holdingsData && Array.isArray(holdingsData.holdings) ? holdingsData.holdings : [];
            setHoldings(holdingsList);

            // Trades
            const tradeList = Array.isArray(tradeData) ? tradeData : [];
            setTrades(tradeList);

            // Filter Active Orders for Chart
            const active = orderList.filter(o => {
                const status = (o.status || o.order_status || '').toUpperCase().replace(/\s+/g, '_');
                return ['OPEN', 'PENDING', 'TRIGGER_PENDING', 'VALIDATION_PENDING'].includes(status);
            });
            setActiveOrders(active);

            // Active Positions for Chart
            const activePos = positionsList.filter(p => parseFloat(p.quantity || 0) !== 0);
            setActivePositions(activePos);

        } catch (error) {
            console.error("[useTradingData] Error fetching trading data:", error);
        } finally {
            fetchInProgress.current = false;
        }
    }, [isAuthenticated]);

    // Initial fetch + backup polling (10 seconds - safety net only)
    useEffect(() => {
        if (!isAuthenticated) return;

        // Initial fetch
        fetchData('initial');

        // Backup polling every 10 seconds (safety net for missed updates)
        console.log('[useTradingData] Starting backup polling (10s interval)');
        const intervalId = setInterval(() => fetchData('backup-poll'), 10000);

        return () => {
            console.log('[useTradingData] Stopping backup polling');
            clearInterval(intervalId);
        };
    }, [isAuthenticated, fetchData]);

    // EVENT-DRIVEN: Manual refresh after order operations (modify/cancel/place)
    // This is called immediately after order operations for instant UI updates
    const refreshTradingData = useCallback(async () => {
        console.log('[useTradingData] EVENT-DRIVEN refresh triggered (order operation)');
        await fetchData('event-driven');
    }, [fetchData]);

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
