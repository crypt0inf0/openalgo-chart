/**
 * OrdersTable Component
 * Renders the orders table for AccountPanel with search and filter
 */
import React, { useState, useMemo, useCallback } from 'react';
import { XCircle, Search, X, Filter, Edit } from 'lucide-react';
import styles from '../AccountPanel.module.css';
import { formatCurrency, isOpenOrderStatus, sortData } from '../utils/accountFormatters';

const OrdersTable = ({ orders, onRowClick, onCancelOrder, onModifyOrder }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        action: [],
        status: [],
        exchange: [],
        product: []
    });
    const [showFilters, setShowFilters] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    // Get unique values for filters
    const uniqueActions = useMemo(() => {
        return [...new Set(orders.map(o => o.action).filter(Boolean))];
    }, [orders]);

    const uniqueStatuses = useMemo(() => {
        return [...new Set(orders.map(o => o.order_status).filter(Boolean))];
    }, [orders]);

    const uniqueExchanges = useMemo(() => {
        return [...new Set(orders.map(o => o.exchange).filter(Boolean))];
    }, [orders]);

    const uniqueProducts = useMemo(() => {
        return [...new Set(orders.map(o => o.product).filter(Boolean))];
    }, [orders]);

    // Filter and sort orders
    const sortedOrders = useMemo(() => {
        const normalizeStatus = (s) => (s || '').toUpperCase().replace(/\s+/g, '_');

        const filtered = orders
            .filter(order => {
                // Search filter
                const matchesSearch = !searchTerm ||
                    order.symbol?.toLowerCase().includes(searchTerm.toLowerCase());

                // Action filter
                const matchesAction = filters.action.length === 0 ||
                    filters.action.includes(order.action);

                // Status filter
                const matchesStatus = filters.status.length === 0 ||
                    filters.status.includes(order.order_status);

                // Exchange filter
                const matchesExchange = filters.exchange.length === 0 ||
                    filters.exchange.includes(order.exchange);

                // Product filter
                const matchesProduct = filters.product.length === 0 ||
                    filters.product.includes(order.product);

                return matchesSearch && matchesAction && matchesStatus &&
                       matchesExchange && matchesProduct;
            });

        // Apply sorting if configured, otherwise default sort
        if (sortConfig.key) {
            return sortData(filtered, sortConfig);
        }

        return filtered.sort((a, b) => {
            const statusA = normalizeStatus(a.order_status);
            const statusB = normalizeStatus(b.order_status);

            const isOpenA = ['OPEN', 'PENDING', 'TRIGGER_PENDING', 'AMO_REQ_RECEIVED'].includes(statusA);
            const isOpenB = ['OPEN', 'PENDING', 'TRIGGER_PENDING', 'AMO_REQ_RECEIVED'].includes(statusB);

            if (isOpenA && !isOpenB) return -1;
            if (!isOpenA && isOpenB) return 1;

            return (b.timestamp || '').localeCompare(a.timestamp || '');
        });
    }, [orders, searchTerm, filters, sortConfig]);

    // Handle filter toggle
    const handleFilterToggle = useCallback((filterType, value) => {
        setFilters(prev => {
            const currentFilters = prev[filterType];
            const newFilters = currentFilters.includes(value)
                ? currentFilters.filter(v => v !== value)
                : [...currentFilters, value];
            return { ...prev, [filterType]: newFilters };
        });
    }, []);

    // Clear all filters
    const handleClearFilters = useCallback(() => {
        setSearchTerm('');
        setFilters({ action: [], status: [], exchange: [], product: [] });
    }, []);

    // Handle column sorting
    const handleSort = useCallback((key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    }, []);

    // Get sort indicator
    const getSortIndicator = (key) => {
        if (sortConfig.key !== key) return null;
        return sortConfig.direction === 'asc' ? '↑' : '↓';
    };

    const hasActiveFilters = searchTerm || filters.action.length > 0 ||
        filters.status.length > 0 || filters.exchange.length > 0 || filters.product.length > 0;

    if (orders.length === 0) {
        return (
            <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>📋</span>
                <p>No orders found for today</p>
            </div>
        );
    }

    return (
        <div className={styles.tableContainer}>
            {/* Search and Filter Bar */}
            <div className={styles.tableControls}>
                <div className={styles.searchBar}>
                    <Search size={14} className={styles.searchIcon} />
                    <input
                        type="text"
                        placeholder="Search symbol..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={styles.searchInput}
                    />
                    {searchTerm && (
                        <X
                            size={14}
                            className={styles.clearIcon}
                            onClick={() => setSearchTerm('')}
                        />
                    )}
                </div>

                <button
                    className={`${styles.filterBtn} ${hasActiveFilters ? styles.filterActive : ''}`}
                    onClick={() => setShowFilters(!showFilters)}
                    title="Toggle filters"
                >
                    <Filter size={14} />
                    <span>Filters</span>
                    {hasActiveFilters && <span className={styles.filterCount}>
                        {filters.action.length + filters.status.length + filters.exchange.length + filters.product.length}
                    </span>}
                </button>

                {hasActiveFilters && (
                    <button
                        className={styles.clearFiltersBtn}
                        onClick={handleClearFilters}
                        title="Clear all filters"
                    >
                        <X size={12} />
                        <span>Clear</span>
                    </button>
                )}
            </div>

            {/* Filter Dropdowns */}
            {showFilters && (
                <div className={styles.filterPanel}>
                    <div className={styles.filterGroup}>
                        <label>Action</label>
                        <div className={styles.filterOptions}>
                            {uniqueActions.map(action => (
                                <label key={action} className={styles.filterOption}>
                                    <input
                                        type="checkbox"
                                        checked={filters.action.includes(action)}
                                        onChange={() => handleFilterToggle('action', action)}
                                    />
                                    <span>{action}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className={styles.filterGroup}>
                        <label>Status</label>
                        <div className={styles.filterOptions}>
                            {uniqueStatuses.map(status => (
                                <label key={status} className={styles.filterOption}>
                                    <input
                                        type="checkbox"
                                        checked={filters.status.includes(status)}
                                        onChange={() => handleFilterToggle('status', status)}
                                    />
                                    <span>{status}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className={styles.filterGroup}>
                        <label>Exchange</label>
                        <div className={styles.filterOptions}>
                            {uniqueExchanges.map(exchange => (
                                <label key={exchange} className={styles.filterOption}>
                                    <input
                                        type="checkbox"
                                        checked={filters.exchange.includes(exchange)}
                                        onChange={() => handleFilterToggle('exchange', exchange)}
                                    />
                                    <span>{exchange}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className={styles.filterGroup}>
                        <label>Product</label>
                        <div className={styles.filterOptions}>
                            {uniqueProducts.map(product => (
                                <label key={product} className={styles.filterOption}>
                                    <input
                                        type="checkbox"
                                        checked={filters.product.includes(product)}
                                        onChange={() => handleFilterToggle('product', product)}
                                    />
                                    <span>{product}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Results Count */}
            {hasActiveFilters && (
                <div className={styles.resultsCount}>
                    Showing {sortedOrders.length} of {orders.length} orders
                </div>
            )}

            {/* Table */}
            {sortedOrders.length === 0 ? (
                <div className={styles.emptyState}>
                    <span className={styles.emptyIcon}>🔍</span>
                    <p>No orders match your filters</p>
                    <button className={styles.clearFiltersBtn} onClick={handleClearFilters}>
                        Clear Filters
                    </button>
                </div>
            ) : (
                <div className={styles.tableWrapper}>
            <table className={styles.table}>
                <colgroup>
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '13%' }} />
                </colgroup>
                <thead>
                    <tr>
                        <th
                            className={`${styles.sortableHeader} ${sortConfig.key === 'timestamp' ? styles.sorted : ''}`}
                            onClick={() => handleSort('timestamp')}
                        >
                            Time
                            {getSortIndicator('timestamp') && (
                                <span className={`${styles.sortIndicator} ${styles.active}`}>
                                    {getSortIndicator('timestamp')}
                                </span>
                            )}
                        </th>
                        <th
                            className={`${styles.sortableHeader} ${sortConfig.key === 'symbol' ? styles.sorted : ''}`}
                            onClick={() => handleSort('symbol')}
                        >
                            Symbol
                            {getSortIndicator('symbol') && (
                                <span className={`${styles.sortIndicator} ${styles.active}`}>
                                    {getSortIndicator('symbol')}
                                </span>
                            )}
                        </th>
                        <th>Action</th>
                        <th>Type</th>
                        <th
                            className={`${styles.alignRight} ${styles.sortableHeader} ${sortConfig.key === 'quantity' ? styles.sorted : ''}`}
                            onClick={() => handleSort('quantity')}
                        >
                            Qty
                            {getSortIndicator('quantity') && (
                                <span className={`${styles.sortIndicator} ${styles.active}`}>
                                    {getSortIndicator('quantity')}
                                </span>
                            )}
                        </th>
                        <th
                            className={`${styles.alignRight} ${styles.sortableHeader} ${sortConfig.key === 'price' ? styles.sorted : ''}`}
                            onClick={() => handleSort('price')}
                        >
                            Limit Price
                            {getSortIndicator('price') && (
                                <span className={`${styles.sortIndicator} ${styles.active}`}>
                                    {getSortIndicator('price')}
                                </span>
                            )}
                        </th>
                        <th
                            className={`${styles.alignRight} ${styles.sortableHeader} ${sortConfig.key === 'average_price' ? styles.sorted : ''}`}
                            onClick={() => handleSort('average_price')}
                        >
                            Fill Price
                            {getSortIndicator('average_price') && (
                                <span className={`${styles.sortIndicator} ${styles.active}`}>
                                    {getSortIndicator('average_price')}
                                </span>
                            )}
                        </th>
                        <th>Status</th>
                        <th className={styles.alignCenter}>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedOrders.map((order, idx) => {
                        const canCancel = isOpenOrderStatus(order.order_status);
                        const totalQty = parseFloat(order.quantity || 0);
                        const filledQty = parseFloat(order.filledqty || order.filled_quantity || 0);
                        const pendingQty = totalQty - filledQty;
                        const avgPrice = parseFloat(order.average_price || 0);
                        const limitPrice = parseFloat(order.price || 0);

                        // Determine quantity display
                        let qtyDisplay;
                        if (filledQty > 0 && filledQty < totalQty) {
                            qtyDisplay = `${filledQty}/${totalQty}`;
                        } else {
                            qtyDisplay = totalQty.toString();
                        }

                        return (
                            <tr
                                key={order.orderid || idx}
                                onClick={() => onRowClick(order.symbol, order.exchange)}
                                className={styles.clickableRow}
                            >
                                <td className={styles.timeCell}>{order.timestamp}</td>
                                <td className={styles.symbolCell}>{order.symbol}</td>
                                <td className={order.action === 'BUY' ? styles.positive : styles.negative}>
                                    {order.action}
                                </td>
                                <td>{order.pricetype}</td>
                                <td className={styles.alignRight}>
                                    {qtyDisplay}
                                    {filledQty > 0 && filledQty < totalQty && (
                                        <span className={styles.partialFill} title={`${pendingQty} pending`}> ⏳</span>
                                    )}
                                </td>
                                <td className={styles.alignRight}>{formatCurrency(limitPrice)}</td>
                                <td className={styles.alignRight}>
                                    {avgPrice > 0 ? formatCurrency(avgPrice) : '-'}
                                </td>
                                <td>
                                    <span className={`${styles.statusBadge} ${styles[`status${order.order_status}`]}`}>
                                        {order.order_status}
                                    </span>
                                </td>
                                <td className={styles.alignCenter}>
                                    {canCancel ? (
                                        <div className={styles.actionButtons}>
                                            <button
                                                className={styles.modifyBtn}
                                                onClick={(e) => onModifyOrder(order, e)}
                                                title="Modify order"
                                            >
                                                <Edit size={12} />
                                                <span>Modify</span>
                                            </button>
                                            <button
                                                className={styles.cancelBtn}
                                                onClick={(e) => onCancelOrder(order, e)}
                                                title="Cancel order"
                                            >
                                                <XCircle size={12} />
                                                <span>Cancel</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <span className={styles.noAction}>-</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
            )}
        </div>
    );
};

export default React.memo(OrdersTable);
