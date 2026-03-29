import React, { useState, useCallback, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import classNames from 'classnames';
import { RefreshCw, Target, AlertCircle, X } from 'lucide-react';
import styles from './CPRScanner.module.css';
import {
  sortCPRResults, filterCPRResults, getCPRWidthColor,
  type CPRScanResult, type CPRSortField, type CPRFilterType,
} from '../../services/cprScannerService';
import { getStockList, STOCK_LIST_OPTIONS } from '../../data/stockLists';

interface StockItem { symbol: string; exchange: string; name?: string; }
interface SymbolData { symbol: string; exchange: string; }

export interface CPRScannerProps {
  watchlistSymbols?: SymbolData[];
  onSymbolSelect: (data: SymbolData) => void;
  onAddToWatchlist?: (data: SymbolData) => void;
  isAuthenticated: boolean;
  showToast?: (message: string, type: string) => void;

  // Scanner state (lifted to App)
  isScanning: boolean;
  results: CPRScanResult[];
  progress: { current: number; total: number };
  lastScanTime: Date | null;
  scanError: string | null;
  narrowThreshold: number;
  onNarrowThresholdChange: (v: number) => void;

  onStartScan: (stocks: StockItem[], threshold: number, showToast?: (m: string, t: string) => void) => void;
  onCancelScan: () => void;
}

const CPRScanner: React.FC<CPRScannerProps> = ({
  watchlistSymbols = [],
  onSymbolSelect,
  onAddToWatchlist,
  isAuthenticated,
  showToast,
  isScanning,
  results,
  progress,
  lastScanTime,
  scanError,
  narrowThreshold,
  onNarrowThresholdChange,
  onStartScan,
  onCancelScan,
}) => {
  const [source, setSource]         = useState('fno');
  const [filter, setFilter]         = useState<CPRFilterType>('all');
  const [sortBy, setSortBy]         = useState<CPRSortField>('cprWidthPct');
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('asc');
  const [thresholdInput, setThresholdInput] = useState(String(narrowThreshold));

  // Build stocks list from source
  const stocksToScan = useMemo((): StockItem[] => {
    if (source === 'watchlist') {
      return watchlistSymbols.map(s => ({ symbol: s.symbol, exchange: s.exchange || 'NSE' }));
    }
    return getStockList(source) as StockItem[];
  }, [source, watchlistSymbols]);

  const handleScan = useCallback(() => {
    if (stocksToScan.length === 0) return;
    onStartScan(stocksToScan, narrowThreshold, showToast);
  }, [stocksToScan, narrowThreshold, showToast, onStartScan]);

  const handleSortClick = useCallback((col: CPRSortField) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  }, [sortBy]);

  const handleThresholdBlur = () => {
    const v = parseFloat(thresholdInput);
    if (!isNaN(v) && v > 0) onNarrowThresholdChange(v);
    else setThresholdInput(String(narrowThreshold));
  };

  const displayResults = useMemo(() => {
    const filtered = filterCPRResults(results, filter);
    return sortCPRResults(filtered, sortBy, sortDir);
  }, [results, filter, sortBy, sortDir]);

  const narrowCount = useMemo(() => results.filter(r => r.isNarrow && !r.error).length, [results]);

  const getSortArrow = (col: CPRSortField) => {
    if (sortBy !== col) return null;
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.title}>
          <Target size={15} />
          <span>CPR Scanner</span>
          {results.length > 0 && !isScanning && (
            <span className={styles.narrowBadge}>{narrowCount} narrow</span>
          )}
        </div>
        <div className={styles.headerControls}>
          {isScanning ? (
            <button className={styles.cancelBtn} onClick={onCancelScan} title="Cancel scan">
              <X size={14} />
            </button>
          ) : (
            <button
              className={styles.refreshBtn}
              onClick={handleScan}
              disabled={!isAuthenticated || stocksToScan.length === 0}
              title="Scan stocks"
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Controls row: source + threshold */}
      <div className={styles.controlsRow}>
        <select
          className={styles.sourceSelect}
          value={source}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setSource(e.target.value)}
          disabled={isScanning}
        >
          {STOCK_LIST_OPTIONS.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.name}</option>
          ))}
        </select>
        <div className={styles.thresholdWrap} title="CPR Width % threshold for Narrow classification">
          <span className={styles.thresholdLabel}>{'<'}</span>
          <input
            className={styles.thresholdInput}
            type="number"
            value={thresholdInput}
            step="0.1"
            min="0.01"
            max="5"
            onChange={e => setThresholdInput(e.target.value)}
            onBlur={handleThresholdBlur}
            disabled={isScanning}
          />
          <span className={styles.thresholdLabel}>%</span>
        </div>
        <span className={styles.stockCount}>{stocksToScan.length} stocks</span>
      </div>

      {/* Filter Tabs */}
      <div className={styles.filterTabs}>
        <button className={classNames(styles.filterTab, { [styles.active]: filter === 'all' })} onClick={() => setFilter('all')}>All</button>
        <button className={classNames(styles.filterTab, styles.narrowTab, { [styles.active]: filter === 'narrow' })} onClick={() => setFilter('narrow')}>Narrow</button>
        <button className={classNames(styles.filterTab, styles.wideTab, { [styles.active]: filter === 'wide' })} onClick={() => setFilter('wide')}>Wide</button>
      </div>

      {/* Progress Bar */}
      {isScanning && (
        <div className={styles.progressContainer}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%' }}
            />
          </div>
          <span className={styles.progressText}>
            {progress.current}/{progress.total} scanned...
          </span>
        </div>
      )}

      {/* Error */}
      {scanError && (
        <div className={styles.errorMessage}>
          <AlertCircle size={13} />
          <span>{scanError}</span>
        </div>
      )}

      {/* Column Headers */}
      {displayResults.length > 0 && (
        <div className={styles.columnHeaders}>
          <span className={styles.colSymbol} onClick={() => handleSortClick('symbol')}>
            Symbol{getSortArrow('symbol')}
          </span>
          <span className={styles.colWidth} onClick={() => handleSortClick('cprWidthPct')}>
            Width%{getSortArrow('cprWidthPct')}
          </span>
          <span className={styles.colLTP} onClick={() => handleSortClick('ltp')}>
            LTP{getSortArrow('ltp')}
          </span>
          <span className={styles.colChg} onClick={() => handleSortClick('changePct')}>
            Chg%{getSortArrow('changePct')}
          </span>
          <span className={styles.colVol} onClick={() => handleSortClick('volume')}>
            Volume{getSortArrow('volume')}
          </span>
          <span className={styles.colAction}>+</span>
        </div>
      )}

      {/* Content */}
      <div className={styles.content}>
        {!isAuthenticated ? (
          <div className={styles.emptyState}>
            <AlertCircle size={28} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>API not connected</p>
            <p className={styles.emptySubtitle}>Connect to OpenAlgo API to scan stocks</p>
          </div>
        ) : isScanning && results.length === 0 ? (
          <div className={styles.skeletonContainer}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className={styles.skeletonRow}>
                <div className={styles.skeletonCell} style={{ width: '70px' }} />
                <div className={styles.skeletonCell} style={{ width: '50px' }} />
                <div className={styles.skeletonCell} style={{ width: '55px' }} />
                <div className={styles.skeletonCell} style={{ width: '45px' }} />
                <div className={styles.skeletonCell} style={{ width: '45px' }} />
              </div>
            ))}
          </div>
        ) : displayResults.length === 0 && !isScanning ? (
          <div className={styles.emptyState}>
            <Target size={28} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>No results yet</p>
            <p className={styles.emptySubtitle}>Click scan (↻) to find narrow CPR stocks</p>
          </div>
        ) : (
          <div className={styles.itemList}>
            {displayResults.map(item => (
              <div
                key={`${item.symbol}-${item.exchange}`}
                className={classNames(styles.row, { [styles.narrowRow]: item.isNarrow, [styles.errorRow]: !!item.error })}
                onClick={() => !item.error && onSymbolSelect({ symbol: item.symbol, exchange: item.exchange })}
                title={item.error ?? `${item.symbol} — CPR Width: ${item.cprWidthPct?.toFixed(3)}%`}
              >
                <span className={styles.colSymbol}>
                  <span className={styles.symbol}>{item.symbol}</span>
                  {item.isNarrow && <span className={styles.narrowDot} />}
                </span>
                <span
                  className={styles.colWidth}
                  style={{ color: getCPRWidthColor(item.cprWidthPct) }}
                >
                  {item.error ? '—' : item.cprWidthPct !== null ? `${item.cprWidthPct.toFixed(3)}%` : '—'}
                </span>
                <span className={styles.colLTP}>
                  {item.ltp !== null ? item.ltp.toFixed(2) : '—'}
                </span>
                <span className={classNames(styles.colChg, {
                  [styles.positiveNum]: (item.changePct || 0) > 0,
                  [styles.negativeNum]: (item.changePct || 0) < 0
                })}>
                  {item.changePct !== null ? `${item.changePct > 0 ? '+' : ''}${item.changePct.toFixed(2)}%` : '—'}
                </span>
                <span className={styles.colVol}>
                  {item.volume !== null ? item.volume.toLocaleString() : '—'}
                </span>
                <span
                  className={styles.colAction}
                  onClick={e => {
                    e.stopPropagation();
                    if (onAddToWatchlist) onAddToWatchlist({ symbol: item.symbol, exchange: item.exchange });
                  }}
                  title="Add to watchlist"
                >
                  +
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {lastScanTime && !isScanning && (
        <div className={styles.footer}>
          <span className={styles.lastScan}>Last: {lastScanTime.toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  );
};

export default CPRScanner;
