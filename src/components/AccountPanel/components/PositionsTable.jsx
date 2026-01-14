/**
 * PositionsTable Component
 * Renders the positions table for AccountPanel with search and filter
 */
import React, { useState, useMemo, useCallback } from 'react';
import { LogOut, Search, X, Filter } from 'lucide-react';
import styles from '../AccountPanel.module.css';
import { formatCurrency, sortData } from '../utils/accountFormatters';

const PositionsTable = ({ positions, onRowClick, onExitPosition, lastUpdateTime = {} }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        exchange: [],
        product: []
    });
    const [showFilters, setShowFilters] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    // Check if value was recently updated (within 1 second)
    const isRecentlyUpdated = (symbol, exchange) => {
        const key = `${symbol}-${exchange}`;
        const updateTime = lastUpdateTime[key];
        if (!updateTime) return false;
        return Date.now() - updateTime < 1000; // 1 second pulse
    };

    // Get unique values for filters
    const uniqueExchanges = useMemo(() => {
        return [...new Set(positions.map(p => p.exchange).filter(Boolean))];
    }, [positions]);

    const uniqueProducts = useMemo(() => {
        return [...new Set(positions.map(p => p.product).filter(Boolean))];
    }, [positions]);

    // Filter and sort positions
    const filteredPositions = useMemo(() => {
        const filtered = positions
            .filter(p => p.quantity !== 0) // Only open positions
            .filter(p => {
                // Search filter
                const matchesSearch = !searchTerm ||
                    p.symbol?.toLowerCase().includes(searchTerm.toLowerCase());

                // Exchange filter
                const matchesExchange = filters.exchange.length === 0 ||
                    filters.exchange.includes(p.exchange);

                // Product filter
                const matchesProduct = filters.product.length === 0 ||
                    filters.product.includes(p.product);

                return matchesSearch && matchesExchange && matchesProduct;
            });

        // Apply sorting if configured, otherwise sort by timestamp
        if (sortConfig.key) {
            return sortData(filtered, sortConfig);
        }
        return filtered.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    }, [positions, searchTerm, filters, sortConfig]);

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
        setFilters({ exchange: [], product: [] });
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

    const hasActiveFilters = searchTerm || filters.exchange.length > 0 || filters.product.length > 0;

    if (positions.filter(p => p.quantity !== 0).length === 0) {
        return (
            <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>📊</span>
                <p>No open positions</p>
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
                        {filters.exchange.length + filters.product.length}
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
                    Showing {filteredPositions.length} of {positions.filter(p => p.quantity !== 0).length} positions
                </div>
            )}

            {/* Table */}
            {filteredPositions.length === 0 ? (
                <div className={styles.emptyState}>
                    <span className={styles.emptyIcon}>🔍</span>
                    <p>No positions match your filters</p>
                    <button className={styles.clearFiltersBtn} onClick={handleClearFilters}>
                        Clear Filters
                    </button>
                </div>
            ) : (
                <div className={styles.tableWrapper}>
            <table className={styles.table}>
                <colgroup>
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '8%' }} />
                </colgroup>
                <thead>
                    <tr>
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
                        <th>Exchange</th>
                        <th>Product</th>
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
                            className={`${styles.alignRight} ${styles.sortableHeader} ${sortConfig.key === 'ltp' ? styles.sorted : ''}`}
                            onClick={() => handleSort('ltp')}
                        >
                            LTP
                            {getSortIndicator('ltp') && (
                                <span className={`${styles.sortIndicator} ${styles.active}`}>
                                    {getSortIndicator('ltp')}
                                </span>
                            )}
                        </th>
                        <th className={styles.alignRight}>Value</th>
                        <th
                            className={`${styles.alignRight} ${styles.sortableHeader} ${sortConfig.key === 'pnl' ? styles.sorted : ''}`}
                            onClick={() => handleSort('pnl')}
                        >
                            P&L
                            {getSortIndicator('pnl') && (
                                <span className={`${styles.sortIndicator} ${styles.active}`}>
                                    {getSortIndicator('pnl')}
                                </span>
                            )}
                        </th>
                        <th className={styles.alignRight}>P&L %</th>
                        <th className={styles.alignCenter}>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredPositions.map((pos, idx) => {
                        const pnl = parseFloat(pos.pnl || 0);
                        const avgPrice = parseFloat(pos.average_price || 0);
                        const ltp = parseFloat(pos.ltp || 0);
                        const qty = parseFloat(pos.quantity || 0);

                        // Calculate position value (current market value)
                        const positionValue = Math.abs(ltp * qty);

                        // Calculate P&L percentage
                        const costBasis = Math.abs(avgPrice * qty);
                        const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

                        // Check if recently updated for pulse animation
                        const isPulsing = isRecentlyUpdated(pos.symbol, pos.exchange);

                        return (
                            <tr
                                key={`${pos.symbol}-${pos.exchange}-${idx}`}
                                onClick={() => onRowClick(pos.symbol, pos.exchange)}
                                className={styles.clickableRow}
                            >
                                <td className={styles.symbolCell}>{pos.symbol}</td>
                                <td>{pos.exchange}</td>
                                <td>{pos.product}</td>
                                <td className={`${styles.alignRight} ${pos.quantity > 0 ? styles.positive : styles.negative}`}>
                                    {pos.quantity > 0 ? '+' : ''}{pos.quantity}
                                </td>
                                <td className={styles.alignRight}>{formatCurrency(avgPrice)}</td>
                                <td className={`${styles.alignRight} ${isPulsing ? styles.pulse : ''}`}>
                                    {formatCurrency(ltp)}
                                </td>
                                <td className={`${styles.alignRight} ${isPulsing ? styles.pulse : ''}`}>
                                    {formatCurrency(positionValue)}
                                </td>
                                <td className={`${styles.alignRight} ${pnl >= 0 ? styles.positive : styles.negative} ${isPulsing ? styles.pulse : ''}`}>
                                    {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                                </td>
                                <td className={`${styles.alignRight} ${pnlPercent >= 0 ? styles.positive : styles.negative} ${isPulsing ? styles.pulse : ''}`}>
                                    {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                                </td>
                                <td className={styles.alignCenter}>
                                    <button
                                        className={styles.exitBtn}
                                        onClick={(e) => onExitPosition(pos, e)}
                                        title={`Exit position - ${pos.quantity > 0 ? 'SELL' : 'BUY'} ${Math.abs(pos.quantity)} qty`}
                                    >
                                        <LogOut size={12} />
                                        <span>Exit</span>
                                    </button>
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

export default React.memo(PositionsTable);
