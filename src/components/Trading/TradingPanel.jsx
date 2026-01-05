import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './TradingPanel.module.css';
import classNames from 'classnames';
import { ChevronUp, ChevronDown, RefreshCw, X, Edit2, Trash2, TrendingUp, TrendingDown, DollarSign, Briefcase, Clock, ChevronsUp } from 'lucide-react';
import { getPositions, getOrderBook, getHoldings, closeAllPositions, cancelOrder, getFunds } from '../../services/tradingService';

// Tab definitions matching Upstox structure
const MAIN_TABS = [
    { id: 'positions', label: 'Positions', icon: TrendingUp },
    { id: 'orders', label: 'Orders', icon: Clock },
    { id: 'funds', label: 'Funds', icon: DollarSign },
    { id: 'holdings', label: 'Holdings', icon: Briefcase },
    { id: 'closedPositions', label: 'Closed Positions', icon: ChevronsUp },
];

// Order sub-tabs
const ORDER_SUB_TABS = [
    { id: 'all', label: 'All' },
    { id: 'working', label: 'Working' },
    { id: 'filled', label: 'Filled' },
    { id: 'cancelled', label: 'Cancelled' },
    { id: 'rejected', label: 'Rejected' },
];

const TradingPanel = ({
    isOpen,
    onToggle,
    tradingMode = 'sandbox',
    onSymbolSelect,
    isAuthenticated,
    watchlistData = [],
    onPlaceOrder,
    theme = 'dark',
}) => {
    const [activeTab, setActiveTab] = useState('positions');
    const [orderSubTab, setOrderSubTab] = useState('all');
    const [positions, setPositions] = useState([]);
    const [closedPositions, setClosedPositions] = useState([]);
    const [orders, setOrders] = useState([]);
    const [holdings, setHoldings] = useState([]);
    const [funds, setFunds] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // P&L Summaries
    const [todaysPnL, setTodaysPnL] = useState(0);
    const [totalPositionsPnL, setTotalPositionsPnL] = useState(0);
    const [holdingsPnL, setHoldingsPnL] = useState(0);

    // Resizable panel
    const [panelHeight, setPanelHeight] = useState(280);
    const [isResizing, setIsResizing] = useState(false);
    const panelRef = useRef(null);
    const startYRef = useRef(0);
    const startHeightRef = useRef(0);

    // Fetch data based on active tab
    const fetchData = useCallback(async () => {
        if (!isAuthenticated) return;

        setIsLoading(true);
        setError('');

        try {
            if (activeTab === 'positions' || activeTab === 'closedPositions') {
                const data = await getPositions();
                // Separate open and closed positions
                const open = data.filter(pos => parseInt(pos.netqty) !== 0);
                const closed = data.filter(pos => parseInt(pos.netqty) === 0);
                setPositions(open);
                setClosedPositions(closed);

                // Calculate total P&L
                const pnl = open.reduce((sum, pos) => sum + (parseFloat(pos.pnl) || 0), 0);
                setTotalPositionsPnL(pnl);
            } else if (activeTab === 'orders') {
                const data = await getOrderBook();
                setOrders(data);
            } else if (activeTab === 'holdings') {
                const data = await getHoldings();
                setHoldings(data);
                // Calculate holdings P&L
                const pnl = data.reduce((sum, h) => sum + (parseFloat(h.pnl) || 0), 0);
                setHoldingsPnL(pnl);
            } else if (activeTab === 'funds') {
                // Fetch funds from OpenAlgo API
                const data = await getFunds();
                if (data) {
                    // OpenAlgo returns: { availablecash, collateral, utilizeddebits, ... }
                    setFunds({
                        availableBalance: parseFloat(data.availablecash) || 0,
                        collateral: parseFloat(data.collateral) || 0,
                        marginUtilized: parseFloat(data.utilizeddebits) || 0,
                        m2mUnrealized: parseFloat(data.m2munrealized) || 0,
                        m2mRealized: parseFloat(data.m2mrealized) || 0,
                    });
                } else {
                    setFunds(null);
                    setError('Unable to fetch funds data');
                }
            }
        } catch (err) {
            setError(err.message || 'Failed to fetch data');
        } finally {
            setIsLoading(false);
        }
    }, [activeTab, isAuthenticated]);

    // Fetch data when tab changes or panel opens
    useEffect(() => {
        if (isOpen && isAuthenticated) {
            fetchData();
        }
    }, [isOpen, activeTab, fetchData, isAuthenticated]);

    // Auto-refresh every 5 seconds for positions
    useEffect(() => {
        if (!isOpen || activeTab !== 'positions' || !isAuthenticated) return;
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, [isOpen, activeTab, fetchData, isAuthenticated]);

    // Update positions with live prices from watchlist
    useEffect(() => {
        if (positions.length === 0 || watchlistData.length === 0) return;

        const priceMap = new Map(
            watchlistData.map(item => [`${item.symbol}-${item.exchange}`, parseFloat(item.last)])
        );

        const updatedPositions = positions.map(pos => {
            const key = `${pos.symbol}-${pos.exchange || 'NSE'}`;
            const ltp = priceMap.get(key);
            if (ltp) {
                const avgPrice = parseFloat(pos.averageprice) || 0;
                const qty = parseInt(pos.netqty) || 0;
                const unrealisedPnL = (ltp - avgPrice) * qty;
                return { ...pos, ltp, unrealisedPnL };
            }
            return pos;
        });

        setPositions(updatedPositions);
        const pnl = updatedPositions.reduce((sum, pos) => sum + (pos.unrealisedPnL || 0), 0);
        setTotalPositionsPnL(pnl);
    }, [watchlistData]);

    // Resize handlers
    const handleResizeStart = (e) => {
        e.preventDefault();
        setIsResizing(true);
        startYRef.current = e.clientY;
        startHeightRef.current = panelHeight;
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing) return;
            const diff = startYRef.current - e.clientY;
            const newHeight = Math.min(Math.max(startHeightRef.current + diff, 150), 600);
            setPanelHeight(newHeight);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    // Order handlers
    const handleCancelOrder = async (orderId) => {
        if (!window.confirm('Cancel this order?')) return;
        try {
            await cancelOrder(orderId);
            fetchData();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleSquareOff = async (position) => {
        if (!window.confirm(`Square off ${position.symbol}?`)) return;
        const action = parseInt(position.netqty) > 0 ? 'SELL' : 'BUY';
        onPlaceOrder?.({
            symbol: position.symbol,
            exchange: position.exchange || 'NSE',
            action,
            quantity: Math.abs(parseInt(position.netqty)),
            product: position.product || 'MIS',
            pricetype: 'MARKET',
        });
    };

    const handleSquareOffAll = async () => {
        if (!window.confirm('Square off ALL positions?')) return;
        try {
            await closeAllPositions();
            fetchData();
        } catch (err) {
            setError(err.message);
        }
    };

    // Filter orders by sub-tab
    const getFilteredOrders = () => {
        if (orderSubTab === 'all') return orders;
        const statusMap = {
            working: ['PENDING', 'OPEN', 'TRIGGER PENDING'],
            filled: ['COMPLETE', 'EXECUTED', 'FILLED'],
            cancelled: ['CANCELLED'],
            rejected: ['REJECTED'],
        };
        const statuses = statusMap[orderSubTab] || [];
        return orders.filter(o => statuses.includes(o.status?.toUpperCase()));
    };

    // Render Positions Tab
    const renderPositions = () => {
        if (positions.length === 0) {
            return <div className={styles.empty}>No open positions</div>;
        }

        return (
            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Symbol</th>
                            <th>Exchange</th>
                            <th>Side</th>
                            <th>Product</th>
                            <th>Net Qty</th>
                            <th>Avg Price</th>
                            <th>LTP</th>
                            <th>Realised P&L</th>
                            <th>Unrealised P&L</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {positions.map((pos, idx) => {
                            const qty = parseInt(pos.netqty) || 0;
                            const side = qty > 0 ? 'LONG' : 'SHORT';
                            const unrealisedPnL = pos.unrealisedPnL || 0;
                            const realisedPnL = parseFloat(pos.realised) || 0;

                            return (
                                <tr
                                    key={idx}
                                    className={classNames(styles.dataRow, unrealisedPnL >= 0 ? styles.profitRow : styles.lossRow)}
                                    onClick={() => onSymbolSelect?.({ symbol: pos.symbol, exchange: pos.exchange || 'NSE' })}
                                >
                                    <td className={styles.symbolCell}>
                                        <span className={styles.symbol}>{pos.symbol}</span>
                                    </td>
                                    <td>{pos.exchange || 'NSE'}</td>
                                    <td>
                                        <span className={classNames(styles.sideBadge, side === 'LONG' ? styles.long : styles.short)}>
                                            {side}
                                        </span>
                                    </td>
                                    <td>{pos.product || 'MIS'}</td>
                                    <td className={styles.qty}>{Math.abs(qty)}</td>
                                    <td>{parseFloat(pos.averageprice || 0).toFixed(2)}</td>
                                    <td className={styles.ltp}>{pos.ltp ? pos.ltp.toFixed(2) : '-'}</td>
                                    <td className={classNames(styles.pnl, realisedPnL >= 0 ? styles.profit : styles.loss)}>
                                        {realisedPnL >= 0 ? '+' : ''}₹{realisedPnL.toFixed(2)}
                                    </td>
                                    <td className={classNames(styles.pnl, unrealisedPnL >= 0 ? styles.profit : styles.loss)}>
                                        {unrealisedPnL >= 0 ? '+' : ''}₹{unrealisedPnL.toFixed(2)}
                                    </td>
                                    <td className={styles.actions} onClick={(e) => e.stopPropagation()}>
                                        <button
                                            className={styles.actionBtn}
                                            onClick={() => handleSquareOff(pos)}
                                            title="Square Off"
                                        >
                                            <X size={14} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    // Render Orders Tab
    const renderOrders = () => {
        const filteredOrders = getFilteredOrders();

        return (
            <div className={styles.ordersContainer}>
                {/* Sub-tabs */}
                <div className={styles.subTabs}>
                    {ORDER_SUB_TABS.map(tab => (
                        <button
                            key={tab.id}
                            className={classNames(styles.subTab, orderSubTab === tab.id && styles.active)}
                            onClick={() => setOrderSubTab(tab.id)}
                        >
                            {tab.label}
                            {tab.id !== 'all' && (
                                <span className={styles.subTabCount}>
                                    {orders.filter(o => {
                                        const statusMap = {
                                            working: ['PENDING', 'OPEN', 'TRIGGER PENDING'],
                                            filled: ['COMPLETE', 'EXECUTED', 'FILLED'],
                                            cancelled: ['CANCELLED'],
                                            rejected: ['REJECTED'],
                                        };
                                        return statusMap[tab.id]?.includes(o.status?.toUpperCase());
                                    }).length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {filteredOrders.length === 0 ? (
                    <div className={styles.empty}>No orders</div>
                ) : (
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Symbol</th>
                                    <th>Exchange</th>
                                    <th>Status</th>
                                    <th>Time</th>
                                    <th>Product</th>
                                    <th>Side</th>
                                    <th>Qty</th>
                                    <th>Traded Qty</th>
                                    <th>Price</th>
                                    <th>Order Type</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrders.map((order, idx) => (
                                    <tr key={idx} className={styles.dataRow}>
                                        <td className={styles.symbolCell}>
                                            <span className={styles.symbol}>{order.symbol}</span>
                                        </td>
                                        <td>{order.exchange || 'NSE'}</td>
                                        <td>
                                            <span className={classNames(styles.statusBadge, styles[order.status?.toLowerCase()])}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td>{order.timestamp || order.ordertime || '-'}</td>
                                        <td>{order.product || 'MIS'}</td>
                                        <td>
                                            <span className={classNames(styles.sideBadge, order.action === 'BUY' ? styles.long : styles.short)}>
                                                {order.action}
                                            </span>
                                        </td>
                                        <td>{order.quantity}</td>
                                        <td>{order.filledqty || 0}</td>
                                        <td>{order.price || 'MKT'}</td>
                                        <td>{order.pricetype}</td>
                                        <td className={styles.actions}>
                                            {['PENDING', 'OPEN'].includes(order.status?.toUpperCase()) && (
                                                <>
                                                    <button className={styles.actionBtn} title="Modify">
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        className={classNames(styles.actionBtn, styles.danger)}
                                                        onClick={() => handleCancelOrder(order.orderid)}
                                                        title="Cancel"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    // Render Funds Tab
    const renderFunds = () => {
        if (!funds) {
            return <div className={styles.empty}>Loading funds...</div>;
        }

        return (
            <div className={styles.fundsContainer}>
                <div className={styles.fundsGrid}>
                    <div className={styles.fundCard}>
                        <span className={styles.fundLabel}>Available Cash</span>
                        <span className={classNames(styles.fundValue, styles.highlight)}>
                            ₹{funds.availableBalance?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div className={styles.fundCard}>
                        <span className={styles.fundLabel}>Collateral</span>
                        <span className={styles.fundValue}>
                            ₹{funds.collateral?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div className={styles.fundCard}>
                        <span className={styles.fundLabel}>Margin Used</span>
                        <span className={styles.fundValue}>
                            ₹{funds.marginUtilized?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div className={styles.fundCard}>
                        <span className={styles.fundLabel}>M2M Unrealized</span>
                        <span className={classNames(styles.fundValue, (funds.m2mUnrealized || 0) >= 0 ? styles.profit : styles.loss)}>
                            {(funds.m2mUnrealized || 0) >= 0 ? '+' : ''}₹{funds.m2mUnrealized?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div className={styles.fundCard}>
                        <span className={styles.fundLabel}>M2M Realized</span>
                        <span className={classNames(styles.fundValue, (funds.m2mRealized || 0) >= 0 ? styles.profit : styles.loss)}>
                            {(funds.m2mRealized || 0) >= 0 ? '+' : ''}₹{funds.m2mRealized?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            </div>
        );
    };


    // Render Holdings Tab
    const renderHoldings = () => {
        if (holdings.length === 0) {
            return <div className={styles.empty}>No holdings</div>;
        }

        return (
            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Symbol</th>
                            <th>Net Qty</th>
                            <th>Avg Price</th>
                            <th>LTP</th>
                            <th>Investment</th>
                            <th>Current Value</th>
                            <th>Day P&L</th>
                            <th>Day %</th>
                            <th>Overall P&L</th>
                            <th>Overall %</th>
                        </tr>
                    </thead>
                    <tbody>
                        {holdings.map((holding, idx) => {
                            const qty = parseInt(holding.quantity) || 0;
                            const avgPrice = parseFloat(holding.averageprice) || 0;
                            const ltp = parseFloat(holding.ltp) || 0;
                            const investment = qty * avgPrice;
                            const currentValue = qty * ltp;
                            const overallPnL = currentValue - investment;
                            const overallPct = investment > 0 ? (overallPnL / investment) * 100 : 0;
                            const dayPnL = parseFloat(holding.daypnl) || 0;
                            const dayPct = parseFloat(holding.daypnlpct) || 0;

                            return (
                                <tr
                                    key={idx}
                                    className={classNames(styles.dataRow, overallPnL >= 0 ? styles.profitRow : styles.lossRow)}
                                    onClick={() => onSymbolSelect?.({ symbol: holding.symbol, exchange: holding.exchange || 'NSE' })}
                                >
                                    <td className={styles.symbolCell}>
                                        <span className={styles.symbol}>{holding.symbol}</span>
                                    </td>
                                    <td>{qty}</td>
                                    <td>₹{avgPrice.toFixed(2)}</td>
                                    <td className={styles.ltp}>₹{ltp.toFixed(2)}</td>
                                    <td>₹{investment.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td>₹{currentValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td className={classNames(styles.pnl, dayPnL >= 0 ? styles.profit : styles.loss)}>
                                        {dayPnL >= 0 ? '+' : ''}₹{dayPnL.toFixed(2)}
                                    </td>
                                    <td className={classNames(styles.pnl, dayPnL >= 0 ? styles.profit : styles.loss)}>
                                        {dayPct >= 0 ? '+' : ''}{dayPct.toFixed(2)}%
                                    </td>
                                    <td className={classNames(styles.pnl, overallPnL >= 0 ? styles.profit : styles.loss)}>
                                        {overallPnL >= 0 ? '+' : ''}₹{overallPnL.toFixed(2)}
                                    </td>
                                    <td className={classNames(styles.pnl, overallPnL >= 0 ? styles.profit : styles.loss)}>
                                        {overallPct >= 0 ? '+' : ''}{overallPct.toFixed(2)}%
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    // Render Closed Positions Tab
    const renderClosedPositions = () => {
        if (closedPositions.length === 0) {
            return <div className={styles.empty}>No closed positions today</div>;
        }

        return (
            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Symbol</th>
                            <th>Exchange</th>
                            <th>Product</th>
                            <th>Buy Qty</th>
                            <th>Buy Avg</th>
                            <th>Sell Qty</th>
                            <th>Sell Avg</th>
                            <th>Realised P&L</th>
                        </tr>
                    </thead>
                    <tbody>
                        {closedPositions.map((pos, idx) => {
                            const realisedPnL = parseFloat(pos.realised) || parseFloat(pos.pnl) || 0;

                            return (
                                <tr
                                    key={idx}
                                    className={classNames(styles.dataRow, realisedPnL >= 0 ? styles.profitRow : styles.lossRow)}
                                >
                                    <td className={styles.symbolCell}>
                                        <span className={styles.symbol}>{pos.symbol}</span>
                                    </td>
                                    <td>{pos.exchange || 'NSE'}</td>
                                    <td>{pos.product || 'MIS'}</td>
                                    <td>{pos.buyqty || 0}</td>
                                    <td>₹{parseFloat(pos.buyavg || 0).toFixed(2)}</td>
                                    <td>{pos.sellqty || 0}</td>
                                    <td>₹{parseFloat(pos.sellavg || 0).toFixed(2)}</td>
                                    <td className={classNames(styles.pnl, realisedPnL >= 0 ? styles.profit : styles.loss)}>
                                        {realisedPnL >= 0 ? '+' : ''}₹{realisedPnL.toFixed(2)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    // Collapsed state - floating summary bar
    if (!isOpen) {
        return (
            <div className={styles.collapsedBar} onClick={onToggle}>
                <div className={styles.expandBtn}>
                    <ChevronUp size={16} />
                    <span>Trading Panel</span>
                </div>
                <div className={styles.pnlCards}>
                    <div className={classNames(styles.pnlCard, totalPositionsPnL >= 0 ? styles.profit : styles.loss)}>
                        <span className={styles.pnlLabel}>Positions</span>
                        <span className={styles.pnlValue}>
                            {totalPositionsPnL >= 0 ? '+' : ''}₹{totalPositionsPnL.toFixed(2)}
                        </span>
                    </div>
                    <div className={classNames(styles.pnlCard, holdingsPnL >= 0 ? styles.profit : styles.loss)}>
                        <span className={styles.pnlLabel}>Holdings</span>
                        <span className={styles.pnlValue}>
                            {holdingsPnL >= 0 ? '+' : ''}₹{holdingsPnL.toFixed(2)}
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={panelRef}
            className={classNames(styles.panel, theme === 'light' && styles.light)}
            style={{ height: panelHeight }}
        >
            {/* Resize Handle */}
            <div
                className={styles.resizeHandle}
                onMouseDown={handleResizeStart}
            />

            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.tabs}>
                        {MAIN_TABS.map(tab => {
                            const Icon = tab.icon;
                            const count = tab.id === 'positions' ? positions.length :
                                tab.id === 'orders' ? orders.length : 0;
                            return (
                                <button
                                    key={tab.id}
                                    className={classNames(styles.tab, activeTab === tab.id && styles.active)}
                                    onClick={() => setActiveTab(tab.id)}
                                >
                                    <Icon size={14} />
                                    <span>{tab.label}</span>
                                    {count > 0 && (
                                        <span className={styles.tabBadge}>{count}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className={styles.headerRight}>
                    {/* P&L Summary Cards */}
                    <div className={styles.pnlSummary}>
                        <div className={classNames(styles.pnlItem, todaysPnL >= 0 ? styles.profit : styles.loss)}>
                            <span className={styles.pnlLabel}>Today's P&L</span>
                            <span className={styles.pnlValue}>
                                {todaysPnL >= 0 ? '+' : ''}₹{todaysPnL.toFixed(2)}
                            </span>
                        </div>
                        <div className={classNames(styles.pnlItem, totalPositionsPnL >= 0 ? styles.profit : styles.loss)}>
                            <span className={styles.pnlLabel}>Positions P&L</span>
                            <span className={styles.pnlValue}>
                                {totalPositionsPnL >= 0 ? '+' : ''}₹{totalPositionsPnL.toFixed(2)}
                            </span>
                        </div>
                        <div className={classNames(styles.pnlItem, holdingsPnL >= 0 ? styles.profit : styles.loss)}>
                            <span className={styles.pnlLabel}>Holdings P&L</span>
                            <span className={styles.pnlValue}>
                                {holdingsPnL >= 0 ? '+' : ''}₹{holdingsPnL.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    <div className={styles.headerActions}>
                        <button
                            className={styles.iconBtn}
                            onClick={fetchData}
                            title="Refresh"
                        >
                            <RefreshCw size={14} className={isLoading ? styles.spinning : ''} />
                        </button>

                        {activeTab === 'positions' && positions.length > 0 && (
                            <button
                                className={classNames(styles.iconBtn, styles.exitAllBtn)}
                                onClick={handleSquareOffAll}
                            >
                                Exit All
                            </button>
                        )}

                        <button className={styles.iconBtn} onClick={onToggle}>
                            <ChevronDown size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Mode Indicator */}
            <div className={classNames(
                styles.modeBar,
                tradingMode === 'live' ? styles.live : styles.sandbox
            )}>
                {tradingMode === 'live' ? '⚠️ LIVE TRADING' : '🔵 SANDBOX MODE'}
            </div>

            {/* Content */}
            <div className={styles.content}>
                {!isAuthenticated ? (
                    <div className={styles.notConnected}>
                        Connect to OpenAlgo to view trading data
                    </div>
                ) : isLoading && positions.length === 0 ? (
                    <div className={styles.loading}>Loading...</div>
                ) : error ? (
                    <div className={styles.error}>{error}</div>
                ) : (
                    <>
                        {activeTab === 'positions' && renderPositions()}
                        {activeTab === 'orders' && renderOrders()}
                        {activeTab === 'funds' && renderFunds()}
                        {activeTab === 'holdings' && renderHoldings()}
                        {activeTab === 'closedPositions' && renderClosedPositions()}
                    </>
                )}
            </div>
        </div>
    );
};

export default TradingPanel;
