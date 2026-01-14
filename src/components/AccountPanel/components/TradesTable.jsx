/**
 * TradesTable Component
 * Renders the trades table for AccountPanel
 */
import React from 'react';
import styles from '../AccountPanel.module.css';
import { formatCurrency } from '../utils/accountFormatters';

const TradesTable = ({ trades, onRowClick }) => {
    // Sort trades by timestamp (latest first)
    const sortedTrades = [...(trades || [])].sort((a, b) =>
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
                        <th>Time</th>
                        <th>Symbol</th>
                        <th>Action</th>
                        <th className={styles.alignRight}>Qty</th>
                        <th className={styles.alignRight}>Avg Price</th>
                        <th className={styles.alignRight}>Value</th>
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
    );
};

export default React.memo(TradesTable);
