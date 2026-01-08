import React, { memo, useState, useEffect, useRef } from 'react';
import classNames from 'classnames';
import { ArrowUp, ArrowDown, Minus, X } from 'lucide-react';
import styles from './PositionTrackerItem.module.css';

const PositionTrackerItem = memo(({ item, isFocused, onClick, onRemove, showRemove, columnWidths }) => {
  const {
    symbol,
    exchange,
    ltp,
    volume,
    percentChange,
    currentRank,
    rankChange,
    isVolumeSpike,
  } = item;

  const [animationClass, setAnimationClass] = useState('');
  const prevRankChangeRef = useRef(rankChange);

  // Trigger animation when rank changes
  useEffect(() => {
    if (rankChange !== prevRankChangeRef.current) {
      if (rankChange > 0) {
        setAnimationClass(styles.rankUp);
      } else if (rankChange < 0) {
        setAnimationClass(styles.rankDown);
      }

      // Clear animation class after animation completes
      const timer = setTimeout(() => {
        setAnimationClass('');
      }, 500);

      prevRankChangeRef.current = rankChange;
      return () => clearTimeout(timer);
    }
  }, [rankChange]);

  // Movement indicator
  const renderMovementIndicator = () => {
    if (rankChange > 0) {
      return (
        <span className={classNames(styles.movement, styles.up)}>
          <ArrowUp size={12} />
          <span className={styles.changeNum}>{rankChange}</span>
        </span>
      );
    } else if (rankChange < 0) {
      return (
        <span className={classNames(styles.movement, styles.down)}>
          <ArrowDown size={12} />
          <span className={styles.changeNum}>{Math.abs(rankChange)}</span>
        </span>
      );
    }
    return (
      <span className={classNames(styles.movement, styles.neutral)}>
        <Minus size={12} />
      </span>
    );
  };

  // Format LTP with appropriate decimals
  const formatLtp = (price) => {
    if (price === null || price === undefined) return '--';
    return price >= 1000 ? price.toFixed(1) : price.toFixed(2);
  };

  // Format percent change
  const formatPercentChange = (pct) => {
    if (pct === null || pct === undefined) return '--';
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(2)}%`;
  };

  // Format volume with Indian number system (K, L, Cr)
  const formatVolume = (vol) => {
    if (vol === null || vol === undefined || vol === 0) return '--';
    if (vol >= 10000000) return `${(vol / 10000000).toFixed(1)}Cr`;
    if (vol >= 100000) return `${(vol / 100000).toFixed(1)}L`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
    return vol.toString();
  };

  // Display medal for top 3 ranks
  const getRankDisplay = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank;
  };

  const isPositive = percentChange >= 0;

  return (
    <div
      className={classNames(styles.item, animationClass, {
        [styles.focused]: isFocused,
      })}
      onClick={onClick}
      role="button"
    >
      <span className={styles.rank} style={columnWidths?.rank ? { width: columnWidths.rank } : undefined}>
        {getRankDisplay(currentRank)}
      </span>
      <span className={styles.spacer} />

      <span className={styles.moveCol} style={columnWidths?.move ? { width: columnWidths.move } : undefined}>
        {renderMovementIndicator()}
      </span>
      <span className={styles.spacer} />

      <span className={styles.symbolCol} style={columnWidths?.symbol ? { width: columnWidths.symbol, flex: 'none' } : undefined}>
        <span className={styles.symbolName}>{symbol}</span>
        {exchange && exchange !== 'NSE' && (
          <span className={styles.exchangeBadge}>{exchange}</span>
        )}
      </span>
      <span className={styles.spacer} />

      <span className={classNames(styles.ltp, isPositive ? styles.up : styles.down)} style={columnWidths?.ltp ? { width: columnWidths.ltp } : undefined}>
        {formatLtp(ltp)}
      </span>
      <span className={styles.spacer} />

      <span className={classNames(styles.change, isPositive ? styles.up : styles.down)} style={columnWidths?.change ? { width: columnWidths.change } : undefined}>
        {formatPercentChange(percentChange)}
      </span>
      <span className={styles.spacer} />

      <span className={styles.volume} style={columnWidths?.volume ? { width: columnWidths.volume } : undefined}>
        {isVolumeSpike && '🔥'}{formatVolume(volume)}
      </span>

      {showRemove && (
        <button
          className={styles.removeBtn}
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          title="Remove symbol"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
});

PositionTrackerItem.displayName = 'PositionTrackerItem';

export default PositionTrackerItem;
