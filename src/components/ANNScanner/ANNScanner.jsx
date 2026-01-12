import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import classNames from 'classnames';
import { RefreshCw, Brain, AlertCircle } from 'lucide-react';
import styles from './ANNScanner.module.css';
import ANNScannerItem from './ANNScannerItem';
import { scanStocks, sortResults, filterResults } from '../../services/annScannerService';
import { getStockList, STOCK_LIST_OPTIONS } from '../../data/stockLists';

// Default column widths
const DEFAULT_COLUMN_WIDTHS = {
  symbol: 85,
  signal: 55,
  streak: 55,
  nnOutput: 65,
};

const MIN_COLUMN_WIDTH = 40;

const ANNScanner = ({
  watchlistSymbols = [],
  onSymbolSelect,
  isAuthenticated,
}) => {
  // State
  const [source, setSource] = useState('watchlist');
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('streak');
  const [sortDir, setSortDir] = useState('desc');
  const [results, setResults] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState(null);
  const [lastScanTime, setLastScanTime] = useState(null);
  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);
  const [resizing, setResizing] = useState(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Refs
  const abortControllerRef = useRef(null);
  const listRef = useRef(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // Get stocks to scan based on source
  const stocksToScan = useMemo(() => {
    if (source === 'watchlist') {
      return watchlistSymbols.map(s => ({
        symbol: s.symbol,
        exchange: s.exchange || 'NSE',
        name: s.symbol,
      }));
    }
    return getStockList(source);
  }, [source, watchlistSymbols]);

  // Handle scan
  const handleScan = useCallback(async () => {
    if (stocksToScan.length === 0) {
      setError('No stocks to scan. Add stocks to your watchlist or select a different source.');
      return;
    }

    // Cancel any existing scan
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsScanning(true);
    setError(null);
    setProgress({ current: 0, total: stocksToScan.length });
    setResults([]);

    try {
      const scanResults = await scanStocks(
        stocksToScan,
        { threshold: 0.0014, daysToFetch: 60, delayMs: 100 },
        (current, total, result) => {
          setProgress({ current, total });
          // Update results incrementally
          setResults(prev => [...prev, result]);
        },
        abortControllerRef.current.signal
      );

      setLastScanTime(new Date());
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError('Scan failed: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setIsScanning(false);
    }
  }, [stocksToScan]);

  // Cancel scan on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Filter and sort results
  const displayResults = useMemo(() => {
    let filtered = filterResults(results, filter);
    return sortResults(filtered, sortBy, sortDir);
  }, [results, filter, sortBy, sortDir]);

  // Handle sort click
  const handleSortClick = useCallback((column) => {
    if (sortBy === column) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
  }, [sortBy]);

  // Column resize handlers
  const handleResizeStart = useCallback((e, column) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(column);
    startXRef.current = e.clientX;
    startWidthRef.current = columnWidths[column];
  }, [columnWidths]);

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e) => {
      const diff = e.clientX - startXRef.current;
      const newWidth = Math.max(MIN_COLUMN_WIDTH, startWidthRef.current + diff);
      setColumnWidths(prev => ({
        ...prev,
        [resizing]: newWidth
      }));
    };

    const handleMouseUp = () => {
      setResizing(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (displayResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => prev < 0 ? 0 : Math.min(prev + 1, displayResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => prev < 0 ? 0 : Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault();
      const item = displayResults[focusedIndex];
      if (item) onSymbolSelect({ symbol: item.symbol, exchange: item.exchange });
    }
  }, [displayResults, focusedIndex, onSymbolSelect]);

  // Handle row click
  const handleRowClick = useCallback((item, index) => {
    setFocusedIndex(index);
    onSymbolSelect({ symbol: item.symbol, exchange: item.exchange });
  }, [onSymbolSelect]);

  // Get sort indicator
  const getSortIndicator = (column) => {
    if (sortBy !== column) return null;
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  // Render skeleton
  const renderSkeleton = () => (
    <div className={styles.skeletonContainer}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={styles.skeletonRow}>
          <div className={styles.skeletonCell} style={{ width: '85px' }} />
          <div className={styles.skeletonCell} style={{ width: '55px' }} />
          <div className={styles.skeletonCell} style={{ width: '55px' }} />
          <div className={styles.skeletonCell} style={{ width: '65px' }} />
        </div>
      ))}
    </div>
  );

  // Render empty state
  const renderEmptyState = () => (
    <div className={styles.emptyState}>
      <Brain size={32} className={styles.emptyIcon} />
      <p className={styles.emptyTitle}>No scan results</p>
      <p className={styles.emptySubtitle}>
        Click the refresh button to scan stocks for ANN signals
      </p>
    </div>
  );

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.title}>
          <Brain size={16} />
          <span>ANN Scanner</span>
        </div>
        <button
          className={classNames(styles.refreshBtn, { [styles.spinning]: isScanning })}
          onClick={handleScan}
          disabled={isScanning || !isAuthenticated}
          title={isScanning ? 'Scanning...' : 'Scan stocks'}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Source Selector */}
      <div className={styles.sourceRow}>
        <select
          className={styles.sourceSelect}
          value={source}
          onChange={(e) => setSource(e.target.value)}
          disabled={isScanning}
        >
          {STOCK_LIST_OPTIONS.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.name}</option>
          ))}
        </select>
        <span className={styles.stockCount}>
          {stocksToScan.length} stocks
        </span>
      </div>

      {/* Filter Tabs */}
      <div className={styles.filterTabs}>
        <button
          className={classNames(styles.filterTab, { [styles.active]: filter === 'all' })}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={classNames(styles.filterTab, styles.longTab, { [styles.active]: filter === 'long' })}
          onClick={() => setFilter('long')}
        >
          Long
        </button>
        <button
          className={classNames(styles.filterTab, styles.shortTab, { [styles.active]: filter === 'short' })}
          onClick={() => setFilter('short')}
        >
          Short
        </button>
      </div>

      {/* Progress Bar */}
      {isScanning && (
        <div className={styles.progressContainer}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <span className={styles.progressText}>
            Scanning {progress.current}/{progress.total}...
          </span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className={styles.errorMessage}>
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Column Headers */}
      <div className={classNames(styles.columnHeaders, { [styles.isResizing]: resizing })}>
        <span
          className={styles.colSymbol}
          style={{ width: columnWidths.symbol, minWidth: MIN_COLUMN_WIDTH }}
          onClick={() => handleSortClick('symbol')}
        >
          Symbol{getSortIndicator('symbol')}
        </span>
        <div className={styles.resizeHandle} onMouseDown={(e) => handleResizeStart(e, 'symbol')} />
        <span
          className={styles.colSignal}
          style={{ width: columnWidths.signal, minWidth: MIN_COLUMN_WIDTH }}
          onClick={() => handleSortClick('direction')}
        >
          Signal{getSortIndicator('direction')}
        </span>
        <div className={styles.resizeHandle} onMouseDown={(e) => handleResizeStart(e, 'signal')} />
        <span
          className={styles.colStreak}
          style={{ width: columnWidths.streak, minWidth: MIN_COLUMN_WIDTH }}
          onClick={() => handleSortClick('streak')}
        >
          Streak{getSortIndicator('streak')}
        </span>
        <div className={styles.resizeHandle} onMouseDown={(e) => handleResizeStart(e, 'streak')} />
        <span
          className={styles.colNnOutput}
          style={{ width: columnWidths.nnOutput, minWidth: MIN_COLUMN_WIDTH }}
          onClick={() => handleSortClick('nnOutput')}
        >
          NN Out{getSortIndicator('nnOutput')}
        </span>
      </div>

      {/* Content Area */}
      <div className={styles.content}>
        {!isAuthenticated ? (
          <div className={styles.emptyState}>
            <AlertCircle size={32} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>API not connected</p>
            <p className={styles.emptySubtitle}>
              Connect to OpenAlgo API to scan stocks
            </p>
          </div>
        ) : isScanning && results.length === 0 ? (
          renderSkeleton()
        ) : displayResults.length === 0 && !isScanning ? (
          renderEmptyState()
        ) : (
          <div
            className={styles.itemList}
            ref={listRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
          >
            {displayResults.map((item, index) => (
              <ANNScannerItem
                key={`${item.symbol}-${item.exchange}`}
                item={item}
                isFocused={index === focusedIndex}
                onClick={() => handleRowClick(item, index)}
                columnWidths={columnWidths}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {lastScanTime && !isScanning && (
        <div className={styles.footer}>
          <span className={styles.lastScan}>
            Last scan: {lastScanTime.toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>
  );
};

export default ANNScanner;
