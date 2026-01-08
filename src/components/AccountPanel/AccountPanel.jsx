import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, X, Wallet, Minus, Maximize2, Minimize2 } from 'lucide-react';
import styles from './AccountPanel.module.css';
import { getFunds, getPositionBook, getOrderBook, getHoldings, getTradeBook, ping } from '../../services/openalgo';

// Tab definitions
const TABS = [
    { id: 'positions', label: 'Positions' },
    { id: 'orders', label: 'Orders' },
    { id: 'holdings', label: 'Holdings' },
    { id: 'trades', label: 'Trades' },
];

// Format currency values
const formatCurrency = (value) => {
    if (value === null || value === undefined) return '0.00';
    const num = parseFloat(value);
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Format P&L with color class
const formatPnL = (value) => {
    const num = parseFloat(value) || 0;
    const formatted = formatCurrency(Math.abs(num));
    const sign = num >= 0 ? '+' : '-';
    return { value: `${sign}${formatted}`, isPositive: num >= 0 };
};

const AccountPanel = ({
    isOpen,
    onClose,
    isAuthenticated,
    onSymbolSelect,
    isMinimized = false,
    onMinimize,
    isMaximized = false,
    onMaximize,
    isToolbarVisible = true,
    // Data props from parent (optional, to avoid duplicate fetching)
    positions: propPositions,
    orders: propOrders,
    holdings: propHoldings,
    trades: propTrades,
    funds: propFunds
}) => {
    const [activeTab, setActiveTab] = useState('positions');
    const [isLoading, setIsLoading] = useState(false);
    const [brokerName, setBrokerName] = useState('');
    const [lastRefresh, setLastRefresh] = useState(null);

    // Data states
    const [funds, setFunds] = useState(null);
    const [positions, setPositions] = useState([]);
    const [orders, setOrders] = useState({ orders: [], statistics: {} });
    const [holdings, setHoldings] = useState({ holdings: [], statistics: {} });
    const [trades, setTrades] = useState([]);

    // Sync props to state if provided
    useEffect(() => {
        if (propFunds) setFunds(propFunds);
        if (propPositions) setPositions(propPositions);
        // App passes orders array, we expect object with orders array
        if (propOrders) setOrders(prev => ({ ...prev, orders: propOrders }));
        // App passes holdings array, we expect object with holdings array
        if (propHoldings) setHoldings(prev => ({ ...prev, holdings: propHoldings }));
        if (propTrades) setTrades(propTrades);
    }, [propFunds, propPositions, propOrders, propHoldings, propTrades]);

    // Fetch all account data
    // Calculate order stats locally to ensure consistency with table (handling Trigger Pending etc.)
    const orderStats = (orders.orders || []).reduce((acc, o) => {
        const s = (o.status || o.order_status || '').toUpperCase().replace(/\s+/g, '_');
        if (['OPEN', 'PENDING', 'TRIGGER_PENDING', 'AMO_REQ_RECEIVED', 'VALIDATION_PENDING'].includes(s)) acc.open++;
        else if (['COMPLETE', 'COMPLETED'].includes(s)) acc.completed++;
        else if (['REJECTED', 'CANCELLED', 'CANCELED'].includes(s)) acc.rejected++;
        return acc;
    }, { open: 0, completed: 0, rejected: 0 });

    const fetchAccountData = useCallback(async () => {
        if (!isAuthenticated) return;

        setIsLoading(true);
        try {
            const [fundsData, positionsData, ordersData, holdingsData, tradesData, pingData] = await Promise.all([
                getFunds(),
                getPositionBook(),
                getOrderBook(),
                getHoldings(),
                getTradeBook(),
                ping()
            ]);

            setFunds(fundsData);
            setPositions(positionsData || []);
            setOrders(ordersData || { orders: [], statistics: {} });
            setHoldings(holdingsData || { holdings: [], statistics: {} });
            setTrades(tradesData || []);
            if (pingData?.broker) {
                setBrokerName(pingData.broker);
            }
            setLastRefresh(new Date());
        } catch (error) {
            console.error('[AccountPanel] Error fetching data:', error);
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated]);

    // Fetch data when panel opens, ONLY if not provided via props
    useEffect(() => {
        // If props are provided (we check orders as a proxy), active fetching is handled by parent
        const isManaged = !!propOrders;

        if (isOpen && isAuthenticated && !isManaged) {
            fetchAccountData();

            // Auto-refresh every 30 seconds when panel is open
            const interval = setInterval(fetchAccountData, 30000);
            return () => clearInterval(interval);
        }
    }, [isOpen, isAuthenticated, fetchAccountData, propOrders]);

    // Removed the separate interval useEffect as it is now combined above


    // Calculate P&L summary from positions
    const calculatePnLSummary = () => {
        let unrealizedPnL = 0;
        let realizedPnL = 0;

        positions.forEach(pos => {
            // Calculate unrealized P&L for open positions
            if (pos.quantity !== 0) {
                unrealizedPnL += parseFloat(pos.pnl || 0);
            }
        });

        // Add realized P&L from today's trades
        trades.forEach(trade => {
            if (trade.action === 'SELL') {
                realizedPnL += parseFloat(trade.trade_value || 0) - (parseFloat(trade.average_price || 0) * parseFloat(trade.quantity || 0));
            }
        });

        return { unrealizedPnL, realizedPnL };
    };

    const { unrealizedPnL, realizedPnL } = calculatePnLSummary();
    const availableMargin = parseFloat(funds?.availablecash || 0);

    // Handle row click to navigate to symbol
    const handleRowClick = (symbol, exchange) => {
        if (onSymbolSelect) {
            onSymbolSelect({ symbol, exchange: exchange || 'NSE' });
        }
    };

    if (!isOpen) return null;

    // Render positions table
    const renderPositions = () => {
        // Filter out positions with 0 quantity and sort by timestamp (latest first)
        const openPositions = positions
            .filter(p => p.quantity !== 0)
            .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

        if (openPositions.length === 0) {
            return (
                <div className={styles.emptyState}>
                    <span className={styles.emptyIcon}>📊</span>
                    <p>No open positions</p>
                </div>
            );
        }

        return (
            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <colgroup>
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '16%' }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Symbol</th>
                            <th>Exchange</th>
                            <th>Product</th>
                            <th className={styles.alignRight}>Qty</th>
                            <th className={styles.alignRight}>Avg Price</th>
                            <th className={styles.alignRight}>LTP</th>
                            <th className={styles.alignRight}>P&L</th>
                        </tr>
                    </thead>
                    <tbody>
                        {openPositions.map((pos, idx) => {
                            const pnl = parseFloat(pos.pnl || 0);
                            return (
                                <tr
                                    key={`${pos.symbol}-${pos.exchange}-${idx}`}
                                    onClick={() => handleRowClick(pos.symbol, pos.exchange)}
                                    className={styles.clickableRow}
                                >
                                    <td className={styles.symbolCell}>{pos.symbol}</td>
                                    <td>{pos.exchange}</td>
                                    <td>{pos.product}</td>
                                    <td className={`${styles.alignRight} ${pos.quantity > 0 ? styles.positive : styles.negative}`}>
                                        {pos.quantity > 0 ? '+' : ''}{pos.quantity}
                                    </td>
                                    <td className={styles.alignRight}>{formatCurrency(pos.average_price)}</td>
                                    <td className={styles.alignRight}>{formatCurrency(pos.ltp)}</td>
                                    <td className={`${styles.alignRight} ${pnl >= 0 ? styles.positive : styles.negative}`}>
                                        {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    // Render orders table
    const renderOrders = () => {
        let orderList = orders.orders || [];

        // Sort orders: OPEN orders first, then by timestamp (latest first)
        orderList = [...orderList].sort((a, b) => {
            // Normalize status: uppercase and replace spaces with underscores
            const normalizeStatus = (s) => (s || '').toUpperCase().replace(/\s+/g, '_');
            const statusA = normalizeStatus(a.order_status);
            const statusB = normalizeStatus(b.order_status);

            // Define open statuses
            const isOpenA = ['OPEN', 'PENDING', 'TRIGGER_PENDING', 'AMO_REQ_RECEIVED'].includes(statusA);
            const isOpenB = ['OPEN', 'PENDING', 'TRIGGER_PENDING', 'AMO_REQ_RECEIVED'].includes(statusB);

            // If one is open and other isn't, open comes first
            if (isOpenA && !isOpenB) return -1;
            if (!isOpenA && isOpenB) return 1;

            // Otherwise sort by timestamp (latest first)
            return (b.timestamp || '').localeCompare(a.timestamp || '');
        });

        if (orderList.length === 0) {
            return (
                <div className={styles.emptyState}>
                    <span className={styles.emptyIcon}>📋</span>
                    <p>No orders found for today</p>
                </div>
            );
        }

        return (
            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <colgroup>
                        <col style={{ width: '18%' }} />
                        <col style={{ width: '18%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '14%' }} />
                        <col style={{ width: '20%' }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Symbol</th>
                            <th>Action</th>
                            <th>Type</th>
                            <th className={styles.alignRight}>Qty</th>
                            <th className={styles.alignRight}>Price</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orderList.map((order, idx) => (
                            <tr
                                key={order.orderid || idx}
                                onClick={() => handleRowClick(order.symbol, order.exchange)}
                                className={styles.clickableRow}
                            >
                                <td className={styles.timeCell}>{order.timestamp}</td>
                                <td className={styles.symbolCell}>{order.symbol}</td>
                                <td className={order.action === 'BUY' ? styles.positive : styles.negative}>
                                    {order.action}
                                </td>
                                <td>{order.pricetype}</td>
                                <td className={styles.alignRight}>{order.quantity}</td>
                                <td className={styles.alignRight}>{formatCurrency(order.price)}</td>
                                <td>
                                    <span className={`${styles.statusBadge} ${styles[`status${order.order_status}`]}`}>
                                        {order.order_status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    // Render holdings table
    const renderHoldings = () => {
        // Sort holdings by timestamp (latest first)
        const holdingsList = (holdings.holdings || []).sort((a, b) =>
            (b.timestamp || '').localeCompare(a.timestamp || '')
        );

        if (holdingsList.length === 0) {
            return (
                <div className={styles.emptyState}>
                    <span className={styles.emptyIcon}>💼</span>
                    <p>No holdings found in your demat account</p>
                </div>
            );
        }

        return (
            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <colgroup>
                        <col style={{ width: '30%' }} />
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '20%' }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Symbol</th>
                            <th>Exchange</th>
                            <th className={styles.alignRight}>Qty</th>
                            <th className={styles.alignRight}>P&L</th>
                            <th className={styles.alignRight}>P&L %</th>
                        </tr>
                    </thead>
                    <tbody>
                        {holdingsList.map((holding, idx) => {
                            const pnl = parseFloat(holding.pnl || 0);
                            const pnlPercent = parseFloat(holding.pnlpercent || 0);
                            return (
                                <tr
                                    key={`${holding.symbol}-${idx}`}
                                    onClick={() => handleRowClick(holding.symbol, holding.exchange)}
                                    className={styles.clickableRow}
                                >
                                    <td className={styles.symbolCell}>{holding.symbol}</td>
                                    <td>{holding.exchange}</td>
                                    <td className={styles.alignRight}>{holding.quantity}</td>
                                    <td className={`${styles.alignRight} ${pnl >= 0 ? styles.positive : styles.negative}`}>
                                        {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                                    </td>
                                    <td className={`${styles.alignRight} ${pnlPercent >= 0 ? styles.positive : styles.negative}`}>
                                        {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    // Render trades table
    const renderTrades = () => {
        // Sort trades by timestamp (latest first)
        const sortedTrades = [...trades].sort((a, b) =>
            (b.timestamp || '').localeCompare(a.timestamp || '')
        );

        if (sortedTrades.length === 0) {
            return (
                <div className={styles.emptyState}>
                    <span className={styles.emptyIcon}>📈</span>
                    <p>No trades executed today</p>
                </div>
            );
        }

        return (
            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <colgroup>
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '25%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '20%' }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Symbol</th>
                            <th>Action</th>
                            <th className={styles.alignRight}>Qty</th>
                            <th className={styles.alignRight}>Avg Price</th>
                            <th className={styles.alignRight}>Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedTrades.map((trade, idx) => (
                            <tr
                                key={trade.orderid || idx}
                                onClick={() => handleRowClick(trade.symbol, trade.exchange)}
                                className={styles.clickableRow}
                            >
                                <td className={styles.timeCell}>{trade.timestamp}</td>
                                <td className={styles.symbolCell}>{trade.symbol}</td>
                                <td className={trade.action === 'BUY' ? styles.positive : styles.negative}>
                                    {trade.action}
                                </td>
                                <td className={styles.alignRight}>{trade.quantity}</td>
                                <td className={styles.alignRight}>{formatCurrency(trade.average_price)}</td>
                                <td className={styles.alignRight}>₹{formatCurrency(trade.trade_value)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    // Render content based on active tab
    const renderContent = () => {
        switch (activeTab) {
            case 'positions':
                return renderPositions();
            case 'orders':
                return renderOrders();
            case 'holdings':
                return renderHoldings();
            case 'trades':
                return renderTrades();
            default:
                return renderPositions();
        }
    };

    return (
        <div className={styles.accountPanel}>
            {/* Header */}
            <div className={`${styles.header} ${!isToolbarVisible ? styles.noToolbar : ''}`}>
                <div className={styles.headerLeft}>
                    <Wallet size={16} className={styles.headerIcon} />
                    <span className={styles.title}>Account Manager</span>
                    {brokerName && (
                        <span className={styles.brokerBadge}>{brokerName}</span>
                    )}
                </div>

                <div className={styles.headerCenter}>
                    <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Unrealized P&L</span>
                        <span className={`${styles.summaryValue} ${unrealizedPnL >= 0 ? styles.positive : styles.negative}`}>
                            {unrealizedPnL >= 0 ? '+' : ''}₹{formatCurrency(unrealizedPnL)}
                        </span>
                    </div>
                    <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Realized P&L</span>
                        <span className={`${styles.summaryValue} ${realizedPnL >= 0 ? styles.positive : styles.negative}`}>
                            {realizedPnL >= 0 ? '+' : ''}₹{formatCurrency(realizedPnL)}
                        </span>
                    </div>
                    <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Margin</span>
                        <span className={styles.summaryValue}>₹{formatCurrency(availableMargin)}</span>
                    </div>
                </div>

                <div className={styles.headerRight}>
                    <button
                        className={styles.refreshBtn}
                        onClick={fetchAccountData}
                        disabled={isLoading}
                        title="Refresh data"
                    >
                        <RefreshCw size={14} className={isLoading ? styles.spinning : ''} />
                    </button>
                    <button
                        className={styles.controlBtn}
                        onClick={onMinimize}
                        title={isMinimized ? "Restore panel" : "Minimize panel"}
                    >
                        <Minus size={14} />
                    </button>
                    <button
                        className={styles.controlBtn}
                        onClick={onMaximize}
                        title={isMaximized ? "Restore size" : "Maximize panel"}
                    >
                        {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                    <button className={styles.closeBtn} onClick={onClose} title="Close panel">
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Tabs - hidden when minimized */}
            {!isMinimized && (
                <div className={`${styles.tabs} ${!isToolbarVisible ? styles.noToolbar : ''}`}>
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                            {tab.id === 'positions' && positions.filter(p => p.quantity !== 0).length > 0 && (
                                <span className={styles.tabBadge}>{positions.filter(p => p.quantity !== 0).length}</span>
                            )}
                            {tab.id === 'orders' && orderStats.open > 0 && (
                                <span className={styles.tabBadge}>{orderStats.open}</span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Content - hidden when minimized */}
            {!isMinimized && (
                <>
                    <div className={`${styles.content} ${!isToolbarVisible ? styles.noToolbar : ''}`}>
                        {!isAuthenticated ? (
                            <div className={styles.emptyState}>
                                <p>Connect to OpenAlgo to view account data</p>
                            </div>
                        ) : isLoading && positions.length === 0 ? (
                            <div className={styles.loading}>
                                <RefreshCw size={24} className={styles.spinning} />
                                <p>Loading account data...</p>
                            </div>
                        ) : (
                            renderContent()
                        )}
                    </div>
                    {/* Footer Stats - Pinned to bottom */}
                    {isAuthenticated && !isLoading && (
                        <div className={`${styles.footer} ${!isToolbarVisible ? styles.noToolbar : ''}`}>
                            {activeTab === 'orders' && (
                                <div className={styles.orderStats}>
                                    <span>Open: {orderStats.open}</span>
                                    <span>Completed: {orderStats.completed}</span>
                                    <span>Rejected: {orderStats.rejected}</span>
                                </div>
                            )}
                            {activeTab === 'holdings' && holdings.statistics && (
                                <div className={styles.holdingStats}>
                                    <span>Total Value: ₹{formatCurrency(holdings.statistics.totalholdingvalue)}</span>
                                    <span className={holdings.statistics.totalprofitandloss >= 0 ? styles.positive : styles.negative}>
                                        Total P&L: ₹{formatCurrency(holdings.statistics.totalprofitandloss)} ({holdings.statistics.totalpnlpercentage?.toFixed(2)}%)
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default React.memo(AccountPanel);
