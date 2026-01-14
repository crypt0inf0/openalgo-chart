/**
 * PositionsTable Component
 * Renders the positions table for AccountPanel
 */
import React from 'react';
import { LogOut } from 'lucide-react';
import styles from '../AccountPanel.module.css';
import { formatCurrency } from '../utils/accountFormatters';

const PositionsTable = ({ positions, onRowClick, onExitPosition }) => {
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
                        <th>Symbol</th>
                        <th>Exchange</th>
                        <th>Product</th>
                        <th className={styles.alignRight}>Qty</th>
                        <th className={styles.alignRight}>Avg Price</th>
                        <th className={styles.alignRight}>LTP</th>
                        <th className={styles.alignRight}>Value</th>
                        <th className={styles.alignRight}>P&L</th>
                        <th className={styles.alignRight}>P&L %</th>
                        <th className={styles.alignCenter}>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {openPositions.map((pos, idx) => {
                        const pnl = parseFloat(pos.pnl || 0);
                        const avgPrice = parseFloat(pos.average_price || 0);
                        const ltp = parseFloat(pos.ltp || 0);
                        const qty = parseFloat(pos.quantity || 0);

                        // Calculate position value (current market value)
                        const positionValue = Math.abs(ltp * qty);

                        // Calculate P&L percentage
                        const costBasis = Math.abs(avgPrice * qty);
                        const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

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
                                <td className={styles.alignRight}>{formatCurrency(ltp)}</td>
                                <td className={styles.alignRight}>{formatCurrency(positionValue)}</td>
                                <td className={`${styles.alignRight} ${pnl >= 0 ? styles.positive : styles.negative}`}>
                                    {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                                </td>
                                <td className={`${styles.alignRight} ${pnlPercent >= 0 ? styles.positive : styles.negative}`}>
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
    );
};

export default React.memo(PositionsTable);
