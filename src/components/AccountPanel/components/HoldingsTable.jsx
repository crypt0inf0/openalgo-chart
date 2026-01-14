/**
 * HoldingsTable Component
 * Renders the holdings table for AccountPanel with search and filter
 */
import React, { useState, useMemo, useCallback } from 'react';
import { Search, X, Filter } from 'lucide-react';
import styles from '../AccountPanel.module.css';
import { formatCurrency, sortData } from '../utils/accountFormatters';

const HoldingsTable = ({ holdings, onRowClick }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        exchange: []
    });
    const [showFilters, setShowFilters] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    // Get unique values for filters
    const uniqueExchanges = useMemo(() => {
        return [...new Set(holdings.map(h => h.exchange).filter(Boolean))];
    }, [holdings]);

    // Filter and sort holdings
    const sortedHoldings = useMemo(() => {
        const filtered = holdings
            .filter(holding => {
                // Search filter
                const matchesSearch = !searchTerm ||
                    holding.symbol?.toLowerCase().includes(searchTerm.toLowerCase());

                // Exchange filter
                const matchesExchange = filters.exchange.length === 0 ||
                    filters.exchange.includes(holding.exchange);

                return matchesSearch && matchesExchange;
            });

        // Apply sorting if configured, otherwise sort by timestamp
        if (sortConfig.key) {
            return sortData(filtered, sortConfig);
        }
        return filtered.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    }, [holdings, searchTerm, filters, sortConfig]);

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
        setFilters({ exchange: [] });
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

    const hasActiveFilters = searchTerm || filters.exchange.length > 0;

    if (holdings.length === 0) {
        return (
            <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>💼</span>
                <p>No holdings found in your demat account</p>
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
                        {filters.exchange.length}
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
                </div>
            )}

            {/* Results Count */}
            {hasActiveFilters && (
                <div className={styles.resultsCount}>
                    Showing {sortedHoldings.length} of {holdings.length} holdings
                </div>
            )}

            {/* Table */}
            {sortedHoldings.length === 0 ? (
                <div className={styles.emptyState}>
                    <span className={styles.emptyIcon}>🔍</span>
                    <p>No holdings match your filters</p>
                    <button className={styles.clearFiltersBtn} onClick={handleClearFilters}>
                        Clear Filters
                    </button>
                </div>
            ) : (
                <div className={styles.tableWrapper}>
            <table className={styles.table}>
                <colgroup>
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '12%' }} />
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
                        <th className={styles.alignRight}>Avg Cost</th>
                        <th
                            className={`${styles.alignRight} ${styles.sortableHeader} ${sortConfig.key === 'close' ? styles.sorted : ''}`}
                            onClick={() => handleSort('close')}
                        >
                            LTP
                            {getSortIndicator('close') && (
                                <span className={`${styles.sortIndicator} ${styles.active}`}>
                                    {getSortIndicator('close')}
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
                        <th
                            className={`${styles.alignRight} ${styles.sortableHeader} ${sortConfig.key === 'pnlpercent' ? styles.sorted : ''}`}
                            onClick={() => handleSort('pnlpercent')}
                        >
                            P&L %
                            {getSortIndicator('pnlpercent') && (
                                <span className={`${styles.sortIndicator} ${styles.active}`}>
                                    {getSortIndicator('pnlpercent')}
                                </span>
                            )}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {sortedHoldings.map((holding, idx) => {
                        const pnl = parseFloat(holding.pnl || 0);
                        const pnlPercent = parseFloat(holding.pnlpercent || 0);
                        const qty = parseFloat(holding.quantity || 0);
                        const ltp = parseFloat(holding.close || holding.ltp || 0);

                        // Calculate average cost from P&L if not provided directly
                        // Formula: avgCost = (currentValue - pnl) / qty
                        const currentValue = ltp * qty;
                        const costValue = currentValue - pnl;
                        const avgCost = qty > 0 ? costValue / qty : 0;

                        return (
                            <tr
                                key={`${holding.symbol}-${idx}`}
                                onClick={() => onRowClick(holding.symbol, holding.exchange)}
                                className={styles.clickableRow}
                            >
                                <td className={styles.symbolCell}>{holding.symbol}</td>
                                <td>{holding.exchange}</td>
                                <td className={styles.alignRight}>{qty}</td>
                                <td className={styles.alignRight}>{formatCurrency(avgCost)}</td>
                                <td className={styles.alignRight}>{formatCurrency(ltp)}</td>
                                <td className={styles.alignRight}>{formatCurrency(currentValue)}</td>
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
            )}
        </div>
    );
};

export default React.memo(HoldingsTable);
