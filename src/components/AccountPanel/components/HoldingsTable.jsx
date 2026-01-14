/**
 * HoldingsTable Component
 * Renders the holdings table for AccountPanel
 */
import React from 'react';
import styles from '../AccountPanel.module.css';
import { formatCurrency } from '../utils/accountFormatters';

const HoldingsTable = ({ holdings, onRowClick }) => {
    // Sort holdings by timestamp (latest first)
    const sortedHoldings = [...(holdings || [])].sort((a, b) =>
        (b.timestamp || '').localeCompare(a.timestamp || '')
    );

    if (sortedHoldings.length === 0) {
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
                        <th>Symbol</th>
                        <th>Exchange</th>
                        <th className={styles.alignRight}>Qty</th>
                        <th className={styles.alignRight}>Avg Cost</th>
                        <th className={styles.alignRight}>LTP</th>
                        <th className={styles.alignRight}>Value</th>
                        <th className={styles.alignRight}>P&L</th>
                        <th className={styles.alignRight}>P&L %</th>
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
    );
};

export default React.memo(HoldingsTable);
