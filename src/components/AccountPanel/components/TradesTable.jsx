/**
 * TradesTable Component
 * Renders the trades table for AccountPanel with search and filter
 */
import React, { useState, useMemo, useCallback } from 'react';
import { Search, X, Filter } from 'lucide-react';
import styles from '../AccountPanel.module.css';
import { formatCurrency, sortData } from '../utils/accountFormatters';

const TradesTable = ({ trades, onRowClick }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        action: [],
        exchange: []
    });
    const [showFilters, setShowFilters] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    // Get unique values for filters
    const uniqueActions = useMemo(() => {
        return [...new Set(trades.map(t => t.action).filter(Boolean))];
    }, [trades]);

    const uniqueExchanges = useMemo(() => {
        return [...new Set(trades.map(t => t.exchange).filter(Boolean))];
    }, [trades]);

    // Filter and sort trades
    const sortedTrades = useMemo(() => {
        const filtered = trades
            .filter(trade => {
                // Search filter
                const matchesSearch = !searchTerm ||
                    trade.symbol?.toLowerCase().includes(searchTerm.toLowerCase());

                // Action filter
                const matchesAction = filters.action.length === 0 ||
                    filters.action.includes(trade.action);

                // Exchange filter
                const matchesExchange = filters.exchange.length === 0 ||
                    filters.exchange.includes(trade.exchange);

                return matchesSearch && matchesAction && matchesExchange;
            });

        // Apply sorting if configured, otherwise sort by timestamp
        if (sortConfig.key) {
            return sortData(filtered, sortConfig);
        }
        return filtered.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    }, [trades, searchTerm, filters, sortConfig]);

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
        setFilters({ action: [], exchange: [] });
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

    const hasActiveFilters = searchTerm || filters.action.length > 0 || filters.exchange.length > 0;

    if (trades.length === 0) {
        return (
            <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>📈</span>
                <p>No trades executed today</p>
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
                        {filters.action.length + filters.exchange.length}
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
                </div>
            )}

            {/* Results Count */}
            {hasActiveFilters && (
                <div className={styles.resultsCount}>
                    Showing {sortedTrades.length} of {trades.length} trades
                </div>
            )}

            {/* Table */}
            {sortedTrades.length === 0 ? (
                <div className={styles.emptyState}>
                    <span className={styles.emptyIcon}>🔍</span>
                    <p>No trades match your filters</p>
                    <button className={styles.clearFiltersBtn} onClick={handleClearFilters}>
                        Clear Filters
                    </button>
                </div>
            ) : (
                <div className={styles.tableWrapper}>
            <table className={styles.table}>
                <colgroup>
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '15%' }} />
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
                            className={`${styles.alignRight} ${styles.sortableHeader} ${sortConfig.key === 'average_price' ? styles.sorted : ''}`}
                            onClick={() => handleSort('average_price')}
                        >
                            Avg Price
                            {getSortIndicator('average_price') && (
                                <span className={`${styles.sortIndicator} ${styles.active}`}>
                                    {getSortIndicator('average_price')}
                                </span>
                            )}
                        </th>
                        <th
                            className={`${styles.alignRight} ${styles.sortableHeader} ${sortConfig.key === 'trade_value' ? styles.sorted : ''}`}
                            onClick={() => handleSort('trade_value')}
                        >
                            Value
                            {getSortIndicator('trade_value') && (
                                <span className={`${styles.sortIndicator} ${styles.active}`}>
                                    {getSortIndicator('trade_value')}
                                </span>
                            )}
                        </th>
                        <th className={styles.alignRight}>Charges</th>
                        <th className={styles.alignRight}>Trade ID</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedTrades.map((trade, idx) => {
                        const tradeValue = parseFloat(trade.trade_value || 0);
                        const charges = parseFloat(trade.charges || trade.brokerage || trade.fees || 0);
                        const tradeId = trade.tradeid || trade.trade_id || trade.orderid || '-';

                        return (
                            <tr
                                key={`${trade.orderid || 'trade'}-${trade.timestamp || ''}-${idx}`}
                                onClick={() => onRowClick(trade.symbol, trade.exchange)}
                                className={styles.clickableRow}
                            >
                                <td className={styles.timeCell}>{trade.timestamp}</td>
                                <td className={styles.symbolCell}>{trade.symbol}</td>
                                <td className={trade.action === 'BUY' ? styles.positive : styles.negative}>
                                    {trade.action}
                                </td>
                                <td className={styles.alignRight}>{trade.quantity}</td>
                                <td className={styles.alignRight}>{formatCurrency(trade.average_price)}</td>
                                <td className={styles.alignRight}>₹{formatCurrency(tradeValue)}</td>
                                <td className={`${styles.alignRight} ${styles.negative}`}>
                                    {charges > 0 ? `-${formatCurrency(charges)}` : '-'}
                                </td>
                                <td className={styles.alignRight}>
                                    <span className={styles.tradeId} title={tradeId}>
                                        {tradeId.length > 12 ? `${tradeId.substring(0, 12)}...` : tradeId}
                                    </span>
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

export default React.memo(TradesTable);
