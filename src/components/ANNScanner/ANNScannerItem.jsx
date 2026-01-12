import React, { memo } from 'react';
import classNames from 'classnames';
import { TrendingUp, TrendingDown, Minus, Plus, Check } from 'lucide-react';
import styles from './ANNScannerItem.module.css';
import { calculateSignalStrength, getStrengthColor } from '../../services/annScannerService';

const ANNScannerItem = memo(({
  item,
  isFocused,
  onClick,
  columnWidths,
  // Delta/Comparison props
  isNew = false,
  signalFlipped = false,
  streakChange = 'same',
  previousStreak = 0,
  // Watchlist props
  isInWatchlist = false,
  onAddToWatchlist,
}) => {
  const { symbol, direction, streak, nnOutput, error } = item;

  // Calculate signal strength
  const signalStrength = calculateSignalStrength(nnOutput);
  const strengthColor = getStrengthColor(signalStrength);

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

  // Handle add to watchlist click
  const handleAddClick = (e) => {
    e.stopPropagation();
    if (onAddToWatchlist) {
      onAddToWatchlist({ symbol: item.symbol, exchange: item.exchange });
    }
  };

  // Calculate streak difference
  const streakDiff = streak - previousStreak;

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
        {/* Delta badges */}
        <div className={styles.badges}>
          {isNew && <span className={styles.newBadge}>NEW</span>}
          {signalFlipped && <span className={styles.flipBadge}>FLIP</span>}
        </div>
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

      {/* Signal Strength */}
      <div
        className={styles.colStrength}
        style={{ width: columnWidths.strength }}
        title={`Strength: ${signalStrength}%`}
      >
        {!error && (
          <div className={styles.strengthBar}>
            <div
              className={styles.strengthFill}
              style={{
                width: `${signalStrength}%`,
                backgroundColor: strengthColor,
              }}
            />
          </div>
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
            {/* Streak change arrow */}
            {streakChange === 'up' && (
              <span className={styles.deltaUp} title={`+${streakDiff}`}>↑</span>
            )}
            {streakChange === 'down' && (
              <span className={styles.deltaDown} title={`${streakDiff}`}>↓</span>
            )}
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

      {/* Add to Watchlist */}
      <div
        className={styles.colAction}
        style={{ width: columnWidths.action }}
      >
        {isInWatchlist ? (
          <span className={styles.inWatchlist} title="In watchlist">
            <Check size={12} />
          </span>
        ) : (
          <button
            className={styles.addBtn}
            onClick={handleAddClick}
            title="Add to watchlist"
          >
            <Plus size={12} />
          </button>
        )}
      </div>
    </div>
  );
});

ANNScannerItem.displayName = 'ANNScannerItem';

export default ANNScannerItem;
