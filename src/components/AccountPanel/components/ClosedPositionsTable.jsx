/**
 * ClosedPositionsTable Component
 * Renders closed positions (quantity === 0) with realized P&L
 */
import React, { useState, useMemo, useCallback } from 'react';
import { Search, X, Filter } from 'lucide-react';
import styles from '../AccountPanel.module.css';
import { formatCurrency, sortData, formatClosedTime } from '../utils/accountFormatters';

const ClosedPositionsTable = ({ positions, onRowClick }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        exchange: [],
        product: []
    });
    const [showFilters, setShowFilters] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });

    // Get unique values for filters
    const uniqueExchanges = useMemo(() => {
        return [...new Set(positions.filter(p => p.quantity === 0).map(p => p.exchange).filter(Boolean))];
    }, [positions]);

    const uniqueProducts = useMemo(() => {
        return [...new Set(positions.filter(p => p.quantity === 0).map(p => p.product).filter(Boolean))];
    }, [positions]);

    // Filter and sort closed positions
    const filteredPositions = useMemo(() => {
        const filtered = positions
            .filter(p => p.quantity === 0) // Only closed positions
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

        // Apply sorting if configured, otherwise sort by timestamp (most recent first)
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

    if (positions.filter(p => p.quantity === 0).length === 0) {
        return (
            <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>📊</span>
                <p>No closed positions</p>
            </div>
        );
    }

    return (
        <div className={`${styles.tableContainer} ${styles.closedPositionsTable}`}>
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
                    Showing {filteredPositions.length} of {positions.filter(p => p.quantity === 0).length} closed positions
                </div>
            )}

            {/* Table */}
            {filteredPositions.length === 0 ? (
                <div className={styles.emptyState}>
                    <span className={styles.emptyIcon}>🔍</span>
                    <p>No closed positions match your filters</p>
                    <button className={styles.clearFiltersBtn} onClick={handleClearFilters}>
                        Clear Filters
                    </button>
                </div>
            ) : (
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <colgroup>
                            <col style={{ width: '18%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '12%' }} />
                            <col style={{ width: '12%' }} />
                            <col style={{ width: '13%' }} />
                            <col style={{ width: '13%' }} />
                            <col style={{ width: '12%' }} />
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
                                    className={`${styles.alignRight} ${styles.sortableHeader} ${sortConfig.key === 'average_price' ? styles.sorted : ''}`}
                                    onClick={() => handleSort('average_price')}
                                >
                                    Entry Price
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
                                    Exit Price
                                    {getSortIndicator('ltp') && (
                                        <span className={`${styles.sortIndicator} ${styles.active}`}>
                                            {getSortIndicator('ltp')}
                                        </span>
                                    )}
                                </th>
                                <th
                                    className={`${styles.alignRight} ${styles.sortableHeader} ${sortConfig.key === 'day_pnl' ? styles.sorted : ''}`}
                                    onClick={() => handleSort('day_pnl')}
                                >
                                    Day P&L
                                    {getSortIndicator('day_pnl') && (
                                        <span className={`${styles.sortIndicator} ${styles.active}`}>
                                            {getSortIndicator('day_pnl')}
                                        </span>
                                    )}
                                </th>
                                <th
                                    className={`${styles.alignRight} ${styles.sortableHeader} ${sortConfig.key === 'pnl' ? styles.sorted : ''}`}
                                    onClick={() => handleSort('pnl')}
                                >
                                    Overall P&L
                                    {getSortIndicator('pnl') && (
                                        <span className={`${styles.sortIndicator} ${styles.active}`}>
                                            {getSortIndicator('pnl')}
                                        </span>
                                    )}
                                </th>
                                <th
                                    className={`${styles.alignRight} ${styles.sortableHeader} ${sortConfig.key === 'timestamp' ? styles.sorted : ''}`}
                                    onClick={() => handleSort('timestamp')}
                                >
                                    Closed At
                                    {getSortIndicator('timestamp') && (
                                        <span className={`${styles.sortIndicator} ${styles.active}`}>
                                            {getSortIndicator('timestamp')}
                                        </span>
                                    )}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPositions.map((pos, idx) => {
                                const dayPnl = parseFloat(pos.day_pnl || pos.pnl || 0);
                                const overallPnl = parseFloat(pos.pnl || 0);
                                const avgPrice = parseFloat(pos.average_price || 0);
                                const exitPrice = parseFloat(pos.ltp || 0);

                                return (
                                    <tr
                                        key={`${pos.symbol}-${pos.exchange}-${idx}`}
                                        onClick={() => onRowClick && onRowClick(pos.symbol, pos.exchange)}
                                        className={styles.clickableRow}
                                    >
                                        <td className={styles.symbolCell}>{pos.symbol}</td>
                                        <td>{pos.exchange}</td>
                                        <td>{pos.product}</td>
                                        <td className={styles.alignRight}>{formatCurrency(avgPrice)}</td>
                                        <td className={styles.alignRight}>{formatCurrency(exitPrice)}</td>
                                        <td className={`${styles.alignRight} ${dayPnl >= 0 ? styles.positive : styles.negative}`}>
                                            {dayPnl >= 0 ? '+' : ''}{formatCurrency(dayPnl)}
                                        </td>
                                        <td className={`${styles.alignRight} ${overallPnl >= 0 ? styles.positive : styles.negative}`}>
                                            {overallPnl >= 0 ? '+' : ''}{formatCurrency(overallPnl)}
                                        </td>
                                        <td className={`${styles.alignRight} ${styles.timeCell}`}>
                                            {formatClosedTime(pos.timestamp)}
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

export default React.memo(ClosedPositionsTable);
