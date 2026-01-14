import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import classNames from 'classnames';
import { Plus, X, Search } from 'lucide-react';
import styles from './PositionTracker.module.css';
import PositionTrackerItem from './PositionTrackerItem';
import PositionTrackerHeader from './PositionTrackerHeader';
import { SECTORS, getSector } from './sectorMapping';

// Import extracted constants and utils
import { MARKET_OPEN, MARKET_CLOSE, TOP_N_OPTIONS, DEFAULT_COLUMN_WIDTHS, MIN_COLUMN_WIDTH } from './constants';
import { getMarketStatus } from './utils';

const PositionTracker = ({
  sourceMode,
  customSymbols,
  watchlistData,        // Live data from App.jsx (already fetched)
  isLoading,            // Loading state from App.jsx
  onSourceModeChange,
  onCustomSymbolsChange,
  onSymbolSelect,
  isAuthenticated,
}) => {
  const [showAddSymbol, setShowAddSymbol] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [marketState, setMarketState] = useState(() => getMarketStatus());
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'gainers' | 'losers'
  const [sectorFilter, setSectorFilter] = useState('All');
  const [topNCount, setTopNCount] = useState(10);
  const [focusedIndex, setFocusedIndex] = useState(-1); // Keyboard navigation
  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);
  const [resizing, setResizing] = useState(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);
  const previousRanksRef = useRef(new Map());
  const openingRanksRef = useRef(new Map()); // Stores rank at market open (9:15 AM)
  const hasSetOpeningRanks = useRef(false);  // Flag to capture only once per day
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // Update market status every minute
  useEffect(() => {
    const checkStatus = () => setMarketState(getMarketStatus());
    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  // Focus search input when add symbol panel opens
  useEffect(() => {
    if (showAddSymbol && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showAddSymbol]);

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

  // Calculate % change from opening price (intraday) instead of prev_close
  const calculateIntradayChange = (item) => {
    const ltp = parseFloat(item.last) || 0;
    const openPrice = parseFloat(item.open) || 0;

    // Use opening price for intraday % change calculation
    if (openPrice > 0 && ltp > 0) {
      return ((ltp - openPrice) / openPrice) * 100;
    }
    // Fallback to chgP (based on prev_close) if open not available
    return parseFloat(item.chgP) || 0;
  };

  // Process and rank the data
  const rankedData = useMemo(() => {
    let dataToRank = [];

    if (sourceMode === 'watchlist') {
      // Use the live watchlist data directly
      dataToRank = (watchlistData || []).map(item => ({
        symbol: item.symbol,
        exchange: item.exchange || 'NSE',
        ltp: parseFloat(item.last) || 0,
        openPrice: parseFloat(item.open) || 0,
        volume: parseFloat(item.volume) || 0,
        percentChange: calculateIntradayChange(item),
        sector: getSector(item.symbol),
      }));
    } else {
      // Custom mode - filter watchlistData to only show custom symbols
      const customSet = new Set(
        (customSymbols || []).map(s => `${s.symbol}-${s.exchange || 'NSE'}`)
      );
      dataToRank = (watchlistData || [])
        .filter(item => customSet.has(`${item.symbol}-${item.exchange || 'NSE'}`))
        .map(item => ({
          symbol: item.symbol,
          exchange: item.exchange || 'NSE',
          ltp: parseFloat(item.last) || 0,
          openPrice: parseFloat(item.open) || 0,
          volume: parseFloat(item.volume) || 0,
          percentChange: calculateIntradayChange(item),
          sector: getSector(item.symbol),
        }));
    }

    // Sort by percent change (descending - highest gainers first)
    const sorted = [...dataToRank].sort((a, b) => b.percentChange - a.percentChange);

    // Calculate ranks
    return sorted.map((item, index) => {
      const key = `${item.symbol}-${item.exchange}`;
      const previousRank = previousRanksRef.current.get(key) ?? (index + 1);
      const currentRank = index + 1;
      const rankChange = previousRank - currentRank;

      // Update previous rank for next render
      previousRanksRef.current.set(key, currentRank);

      return {
        ...item,
        currentRank,
        previousRank,
        rankChange,
      };
    });
  }, [watchlistData, sourceMode, customSymbols]);

  // Capture opening ranks once when market opens (for daily movement tracking)
  useEffect(() => {
    // Only capture opening ranks once when market is open and data is available
    if (marketState.isOpen && rankedData.length > 0 && !hasSetOpeningRanks.current) {
      rankedData.forEach(item => {
        const key = `${item.symbol}-${item.exchange}`;
        openingRanksRef.current.set(key, item.currentRank);
      });
      hasSetOpeningRanks.current = true;
    }

    // Reset flag when market closes (for next day)
    if (!marketState.isOpen) {
      hasSetOpeningRanks.current = false;
      openingRanksRef.current.clear();
    }
  }, [marketState.isOpen, rankedData]);

  // Calculate rank change from opening and volume spike detection
  const displayData = useMemo(() => {
    // Calculate average volume for spike detection
    const totalVolume = rankedData.reduce((sum, item) => sum + (item.volume || 0), 0);
    const avgVolume = rankedData.length > 0 ? totalVolume / rankedData.length : 0;
    const spikeThreshold = avgVolume * 2; // Volume spike = > 2x average

    return rankedData.map(item => {
      const key = `${item.symbol}-${item.exchange}`;
      const openingRank = openingRanksRef.current.get(key);

      return {
        ...item,
        // Show movement from opening rank (positive = moved up)
        rankChange: openingRank !== undefined
          ? openingRank - item.currentRank
          : 0,
        // Flag for volume spike indicator
        isVolumeSpike: item.volume > spikeThreshold,
      };
    });
  }, [rankedData]);

  // Filter data based on sector and filter mode
  const filteredData = useMemo(() => {
    // Apply sector filter first
    let data = displayData;
    if (sectorFilter !== 'All') {
      data = data.filter(item => item.sector === sectorFilter);
    }

    // Then apply gainers/losers filter
    if (filterMode === 'all') return data;

    if (filterMode === 'gainers') {
      // Filter positive % change, sort descending, take top N
      return data
        .filter(item => item.percentChange > 0)
        .sort((a, b) => b.percentChange - a.percentChange)
        .slice(0, topNCount);
    }

    if (filterMode === 'losers') {
      // Filter negative % change, sort by most negative first, take top N
      return data
        .filter(item => item.percentChange < 0)
        .sort((a, b) => a.percentChange - b.percentChange)
        .slice(0, topNCount);
    }

    return data;
  }, [displayData, filterMode, sectorFilter, topNCount]);

  const handleAddSymbol = useCallback((symbol, exchange = 'NSE') => {
    if (sourceMode !== 'custom') return;

    const exists = (customSymbols || []).some(
      s => s.symbol === symbol && s.exchange === exchange
    );
    if (!exists) {
      onCustomSymbolsChange([...(customSymbols || []), { symbol, exchange }]);
    }
    setSearchQuery('');
    setShowAddSymbol(false);
  }, [sourceMode, customSymbols, onCustomSymbolsChange]);

  const handleRemoveSymbol = useCallback((symbol, exchange) => {
    if (sourceMode !== 'custom') return;

    onCustomSymbolsChange(
      (customSymbols || []).filter(s => !(s.symbol === symbol && s.exchange === exchange))
    );
  }, [sourceMode, customSymbols, onCustomSymbolsChange]);

  const handleRowClick = useCallback((item) => {
    onSymbolSelect({ symbol: item.symbol, exchange: item.exchange });
  }, [onSymbolSelect]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e) => {
    if (filteredData.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => prev < 0 ? 0 : Math.min(prev + 1, filteredData.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => prev < 0 ? 0 : Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && focusedIndex >= 0 && focusedIndex < filteredData.length) {
      e.preventDefault();
      const item = filteredData[focusedIndex];
      if (item) onSymbolSelect({ symbol: item.symbol, exchange: item.exchange });
    }
  }, [filteredData, focusedIndex, onSymbolSelect]);

  // Click handler that also updates focusedIndex
  const handleItemClick = useCallback((item, index) => {
    setFocusedIndex(index);
    onSymbolSelect({ symbol: item.symbol, exchange: item.exchange });
  }, [onSymbolSelect]);

  // Render loading skeleton
  const renderSkeleton = () => (
    <div className={styles.skeletonContainer}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={styles.skeletonRow}>
          <div className={styles.skeletonCell} style={{ width: '32px' }} />
          <div className={styles.skeletonCell} style={{ width: '40px' }} />
          <div className={styles.skeletonCell} style={{ width: '70px' }} />
          <div className={styles.skeletonCell} style={{ width: '70px' }} />
          <div className={styles.skeletonCell} style={{ width: '60px' }} />
          <div className={styles.skeletonCell} style={{ width: '55px' }} />
        </div>
      ))}
    </div>
  );

  // Render empty state
  const renderEmptyState = () => (
    <div className={styles.emptyState}>
      <p className={styles.emptyTitle}>
        {sourceMode === 'watchlist'
          ? 'No symbols in watchlist'
          : 'No symbols added'}
      </p>
      <p className={styles.emptySubtitle}>
        {sourceMode === 'watchlist'
          ? 'Add symbols to your watchlist to track positions'
          : 'Click + to add symbols to track'}
      </p>
    </div>
  );

  return (
    <div className={styles.positionTracker}>
      <PositionTrackerHeader
        sourceMode={sourceMode}
        onSourceModeChange={onSourceModeChange}
        marketStatus={marketState.status}
        isMarketOpen={marketState.isOpen}
        symbolCount={rankedData.length}
      />

      {/* Filter Tabs */}
      <div className={styles.filterTabs}>
        <button
          className={`${styles.filterTab} ${filterMode === 'all' ? styles.filterTabActive : ''}`}
          onClick={() => setFilterMode('all')}
        >
          All
        </button>
        <button
          className={`${styles.filterTab} ${styles.filterTabGainers} ${filterMode === 'gainers' ? styles.filterTabActive : ''}`}
          onClick={() => setFilterMode('gainers')}
        >
          Top {topNCount} Gainers
        </button>
        <button
          className={`${styles.filterTab} ${styles.filterTabLosers} ${filterMode === 'losers' ? styles.filterTabActive : ''}`}
          onClick={() => setFilterMode('losers')}
        >
          Top {topNCount} Losers
        </button>
        <select
          className={styles.topNSelect}
          value={topNCount}
          onChange={(e) => setTopNCount(Number(e.target.value))}
        >
          {TOP_N_OPTIONS.map(n => (
            <option key={n} value={n}>Top {n}</option>
          ))}
        </select>
      </div>

      {/* Sector Filter */}
      <div className={styles.sectorFilter}>
        <select
          className={styles.sectorSelect}
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
        >
          {SECTORS.map(sector => (
            <option key={sector} value={sector}>{sector}</option>
          ))}
        </select>
      </div>

      {/* Column Headers */}
      <div className={classNames(styles.columnHeaders, { [styles.isResizing]: resizing })}>
        <span className={styles.colRank} style={{ width: columnWidths.rank, minWidth: MIN_COLUMN_WIDTH }}>#</span>
        <div className={styles.resizeHandle} onMouseDown={(e) => handleResizeStart(e, 'rank')} />
        <span className={styles.colMove} style={{ width: columnWidths.move, minWidth: MIN_COLUMN_WIDTH }}>Move</span>
        <div className={styles.resizeHandle} onMouseDown={(e) => handleResizeStart(e, 'move')} />
        <span className={styles.colSymbol} style={{ width: columnWidths.symbol, minWidth: MIN_COLUMN_WIDTH }}>Symbol</span>
        <div className={styles.resizeHandle} onMouseDown={(e) => handleResizeStart(e, 'symbol')} />
        <span className={styles.colLtp} style={{ width: columnWidths.ltp, minWidth: MIN_COLUMN_WIDTH }}>LTP</span>
        <div className={styles.resizeHandle} onMouseDown={(e) => handleResizeStart(e, 'ltp')} />
        <span className={styles.colChange} style={{ width: columnWidths.change, minWidth: MIN_COLUMN_WIDTH }}>% Chg</span>
        <div className={styles.resizeHandle} onMouseDown={(e) => handleResizeStart(e, 'change')} />
        <span className={styles.colVolume} style={{ width: columnWidths.volume, minWidth: MIN_COLUMN_WIDTH }}>Vol</span>
        {sourceMode === 'custom' && <span className={styles.colAction} />}
      </div>

      {/* Content Area */}
      <div className={styles.content}>
        {!isAuthenticated ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>API not connected</p>
            <p className={styles.emptySubtitle}>
              Connect to OpenAlgo API to track positions
            </p>
          </div>
        ) : isLoading ? (
          renderSkeleton()
        ) : filteredData.length === 0 ? (
          renderEmptyState()
        ) : (
          <div
            className={styles.itemList}
            ref={listRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
          >
            {filteredData.map((item, index) => (
              <PositionTrackerItem
                key={`${item.symbol}-${item.exchange}`}
                item={item}
                isFocused={index === focusedIndex}
                onClick={() => handleItemClick(item, index)}
                onRemove={sourceMode === 'custom' ? () => handleRemoveSymbol(item.symbol, item.exchange) : null}
                showRemove={sourceMode === 'custom'}
                columnWidths={columnWidths}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Symbol Button (Custom mode only) */}
      {sourceMode === 'custom' && isAuthenticated && (
        <div className={styles.footer}>
          {showAddSymbol ? (
            <div className={styles.addSymbolPanel}>
              <div className={styles.searchInputWrapper}>
                <Search size={14} className={styles.searchIcon} />
                <input
                  ref={searchInputRef}
                  type="text"
                  className={styles.searchInput}
                  placeholder="Enter symbol (e.g., RELIANCE)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery.trim()) {
                      handleAddSymbol(searchQuery.trim());
                    } else if (e.key === 'Escape') {
                      setShowAddSymbol(false);
                      setSearchQuery('');
                    }
                  }}
                />
                <button
                  className={styles.cancelBtn}
                  onClick={() => {
                    setShowAddSymbol(false);
                    setSearchQuery('');
                  }}
                >
                  <X size={14} />
                </button>
              </div>
              <p className={styles.addHint}>Press Enter to add, Escape to cancel</p>
            </div>
          ) : (
            <button
              className={styles.addButton}
              onClick={() => setShowAddSymbol(true)}
            >
              <Plus size={16} />
              <span>Add Symbol</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default PositionTracker;
