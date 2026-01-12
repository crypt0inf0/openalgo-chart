import React, { memo } from 'react';
import classNames from 'classnames';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import styles from './ANNScannerItem.module.css';

const ANNScannerItem = memo(({
  item,
  isFocused,
  onClick,
  columnWidths,
}) => {
  const { symbol, direction, streak, nnOutput, error } = item;

  // Format NN output
  const formatNnOutput = (value) => {
    if (value === null || value === undefined) return '-';
    const sign = value >= 0 ? '+' : '';
    return sign + value.toFixed(4);
  };

  // Get signal badge class
  const getSignalClass = () => {
    if (direction === 'LONG') return styles.signalLong;
    if (direction === 'SHORT') return styles.signalShort;
    return styles.signalNone;
  };

  // Get signal icon
  const SignalIcon = () => {
    if (direction === 'LONG') return <TrendingUp size={12} />;
    if (direction === 'SHORT') return <TrendingDown size={12} />;
    return <Minus size={12} />;
  };

  return (
    <div
      className={classNames(styles.item, {
        [styles.focused]: isFocused,
        [styles.hasError]: error,
      })}
      onClick={onClick}
    >
      {/* Symbol */}
      <div
        className={styles.colSymbol}
        style={{ width: columnWidths.symbol }}
        title={item.name || symbol}
      >
        <span className={styles.symbolText}>{symbol}</span>
      </div>

      {/* Signal */}
      <div
        className={styles.colSignal}
        style={{ width: columnWidths.signal }}
      >
        {error ? (
          <span className={styles.errorBadge} title={error}>ERR</span>
        ) : (
          <span className={classNames(styles.signalBadge, getSignalClass())}>
            <SignalIcon />
            <span>{direction || '-'}</span>
          </span>
        )}
      </div>

      {/* Streak */}
      <div
        className={styles.colStreak}
        style={{ width: columnWidths.streak }}
      >
        {error ? (
          '-'
        ) : streak > 0 ? (
          <span className={classNames(styles.streakValue, {
            [styles.streakLong]: direction === 'LONG',
            [styles.streakShort]: direction === 'SHORT',
          })}>
            {streak}d
          </span>
        ) : (
          <span className={styles.streakNone}>-</span>
        )}
      </div>

      {/* NN Output */}
      <div
        className={styles.colNnOutput}
        style={{ width: columnWidths.nnOutput }}
      >
        <span className={classNames(styles.nnValue, {
          [styles.nnPositive]: nnOutput > 0,
          [styles.nnNegative]: nnOutput < 0,
        })}>
          {formatNnOutput(nnOutput)}
        </span>
      </div>
    </div>
  );
});

ANNScannerItem.displayName = 'ANNScannerItem';

export default ANNScannerItem;
