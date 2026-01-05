import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import classNames from 'classnames';
import { Plus, X, Search, Upload } from 'lucide-react';
import styles from './PositionTracker.module.css';
import PositionTrackerItem from './PositionTrackerItem';
import PositionTrackerHeader from './PositionTrackerHeader';
import { getSector } from './sectorMapping';

// Market timing constants (IST)
const MARKET_OPEN = { hour: 9, minute: 15 };
const MARKET_CLOSE = { hour: 15, minute: 30 };

// Top N filter options
const TOP_N_OPTIONS = [5, 10, 15, 20];

const getMarketStatus = () => {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const day = now.getDay();

  if (day === 0 || day === 6) {
    return { isOpen: false, status: 'Weekend' };
  }

  const timeInMinutes = hours * 60 + minutes;
  const openTime = MARKET_OPEN.hour * 60 + MARKET_OPEN.minute;
  const closeTime = MARKET_CLOSE.hour * 60 + MARKET_CLOSE.minute;

  if (timeInMinutes >= openTime && timeInMinutes <= closeTime) {
    return { isOpen: true, status: 'Market Open' };
  } else if (timeInMinutes < openTime) {
    return { isOpen: false, status: 'Pre-Market' };
  } else {
    return { isOpen: false, status: 'Market Closed' };
  }
};

const PositionTracker = ({
  // List management props
  lists,
  activeListId,
  activeList,
  onSwitchList,
  onCreateList,
  onRenameList,
  onDeleteList,
  onCopyList,
  onClearList,
  // Settings props
  sourceMode,
  onSourceModeChange,
  // Symbol management
  customSymbols,
  onCustomSymbolsChange,
  // Filter props (from active list)
  filterMode,
  sectorFilter,
  topNCount,
  onFilterChange,
  // Data props
  watchlistData,        // Live data from App.jsx (already fetched)
  isLoading,            // Loading state from App.jsx
  onSymbolSelect,
  isAuthenticated,
}) => {
  const [showAddSymbol, setShowAddSymbol] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [marketState, setMarketState] = useState(() => getMarketStatus());
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [importText, setImportText] = useState('');
  const searchInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const previousRanksRef = useRef(new Map());
  const openingRanksRef = useRef(new Map()); // Stores rank at market open (9:15 AM)
  const hasSetOpeningRanks = useRef(false);  // Flag to capture only once per day

  // Default filter values if not provided
  const currentFilterMode = filterMode || 'all';
  const currentSectorFilter = sectorFilter || 'All';
  const currentTopNCount = topNCount || 10;

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
      // Custom mode - ONLY show symbols from this list's customSymbols
      // Get live price data from watchlistData if available
      dataToRank = (customSymbols || []).map(s => {
        const liveData = (watchlistData || []).find(
          item => item.symbol === s.symbol && (item.exchange || 'NSE') === (s.exchange || 'NSE')
        );
        if (liveData) {
          return {
            symbol: liveData.symbol,
            exchange: liveData.exchange || 'NSE',
            ltp: parseFloat(liveData.last) || 0,
            openPrice: parseFloat(liveData.open) || 0,
            volume: parseFloat(liveData.volume) || 0,
            percentChange: calculateIntradayChange(liveData),
            sector: getSector(liveData.symbol),
          };
        }
        // No live data yet - show placeholder
        return {
          symbol: s.symbol,
          exchange: s.exchange || 'NSE',
          ltp: 0,
          openPrice: 0,
          volume: 0,
          percentChange: 0,
          sector: getSector(s.symbol),
        };
      });
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

  // Compute available sectors dynamically from the current list's data
  const availableSectors = useMemo(() => {
    const sectorSet = new Set();
    displayData.forEach(item => {
      if (item.sector) {
        sectorSet.add(item.sector);
      }
    });
    // Sort sectors alphabetically, but keep "Other" at the end
    const sectors = Array.from(sectorSet).sort((a, b) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return a.localeCompare(b);
    });
    return ['All', ...sectors];
  }, [displayData]);

  // Apply filters (sector + gainers/losers)
  const filteredData = useMemo(() => {
    let data = displayData;

    // Apply sector filter
    if (currentSectorFilter !== 'All') {
      data = data.filter(item => item.sector === currentSectorFilter);
    }

    // Apply gainers/losers filter
    if (currentFilterMode === 'gainers') {
      return data
        .filter(item => item.percentChange > 0)
        .sort((a, b) => b.percentChange - a.percentChange)
        .slice(0, currentTopNCount);
    }

    if (currentFilterMode === 'losers') {
      return data
        .filter(item => item.percentChange < 0)
        .sort((a, b) => a.percentChange - b.percentChange)
        .slice(0, currentTopNCount);
    }

    return data;
  }, [displayData, currentFilterMode, currentSectorFilter, currentTopNCount]);

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

  // Parse symbols from text (handles comma, newline, space separated)
  const parseSymbols = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];

    // Split by newlines, commas, or multiple spaces
    const parts = text
      .split(/[\n,\s]+/)
      .map(s => s.trim().toUpperCase())
      .filter(s => s.length > 0 && /^[A-Z0-9&-]+$/.test(s)); // Valid symbol chars

    // Dedupe
    const unique = [...new Set(parts)];

    return unique.map(symbol => ({ symbol, exchange: 'NSE' }));
  }, []);

  // Handle import from text
  const handleImportText = useCallback(() => {
    if (!importText.trim()) return;

    const newSymbols = parseSymbols(importText);
    if (newSymbols.length === 0) return;

    // Merge with existing, avoiding duplicates
    const existingSet = new Set(
      (customSymbols || []).map(s => `${s.symbol}-${s.exchange}`)
    );

    const toAdd = newSymbols.filter(
      s => !existingSet.has(`${s.symbol}-${s.exchange}`)
    );

    if (toAdd.length > 0) {
      onCustomSymbolsChange([...(customSymbols || []), ...toAdd]);
    }

    setImportText('');
    setShowImportPanel(false);
  }, [importText, customSymbols, onCustomSymbolsChange, parseSymbols]);

  // Handle CSV file import
  const handleFileImport = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text !== 'string') return;

      const newSymbols = parseSymbols(text);
      if (newSymbols.length === 0) return;

      // Merge with existing, avoiding duplicates
      const existingSet = new Set(
        (customSymbols || []).map(s => `${s.symbol}-${s.exchange}`)
      );

      const toAdd = newSymbols.filter(
        s => !existingSet.has(`${s.symbol}-${s.exchange}`)
      );

      if (toAdd.length > 0) {
        onCustomSymbolsChange([...(customSymbols || []), ...toAdd]);
      }

      setShowImportPanel(false);
    };
    reader.readAsText(file);

    // Reset file input so same file can be selected again
    event.target.value = '';
  }, [customSymbols, onCustomSymbolsChange, parseSymbols]);

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
        // List management props
        lists={lists}
        activeListId={activeListId}
        activeList={activeList}
        onSwitchList={onSwitchList}
        onCreateList={onCreateList}
        onRenameList={onRenameList}
        onDeleteList={onDeleteList}
        onCopyList={onCopyList}
        onClearList={onClearList}
      />

      {/* Filter Tabs */}
      <div className={styles.filterTabs}>
        <button
          className={classNames(styles.filterTab, currentFilterMode === 'all' && styles.filterTabActive)}
          onClick={() => onFilterChange?.({ filterMode: 'all' })}
        >
          All
        </button>
        <button
          className={classNames(
            styles.filterTab,
            styles.filterTabGainers,
            currentFilterMode === 'gainers' && styles.filterTabActive
          )}
          onClick={() => onFilterChange?.({ filterMode: 'gainers' })}
        >
          Top {currentTopNCount} Gainers
        </button>
        <button
          className={classNames(
            styles.filterTab,
            styles.filterTabLosers,
            currentFilterMode === 'losers' && styles.filterTabActive
          )}
          onClick={() => onFilterChange?.({ filterMode: 'losers' })}
        >
          Top {currentTopNCount} Losers
        </button>
        {currentFilterMode !== 'all' && (
          <select
            className={styles.topNSelect}
            value={currentTopNCount}
            onChange={(e) => onFilterChange?.({ topNCount: Number(e.target.value) })}
          >
            {TOP_N_OPTIONS.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        )}
      </div>

      {/* Sector Filter - Dynamic based on stocks in current list */}
      <div className={styles.sectorFilter}>
        <select
          className={styles.sectorSelect}
          value={currentSectorFilter}
          onChange={(e) => onFilterChange?.({ sectorFilter: e.target.value })}
        >
          {availableSectors.map(sector => (
            <option key={sector} value={sector}>{sector}</option>
          ))}
        </select>
      </div>

      {/* Column Headers */}
      <div className={styles.columnHeaders}>
        <span className={styles.colRank}>#</span>
        <span className={styles.colMove}>Move</span>
        <span className={styles.colSymbol}>Symbol</span>
        <span className={styles.colLtp}>LTP</span>
        <span className={styles.colChange}>% Chg</span>
        <span className={styles.colVolume}>Vol</span>
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
          <div className={styles.itemList}>
            {filteredData.map((item) => (
              <PositionTrackerItem
                key={`${item.symbol}-${item.exchange}`}
                item={item}
                onClick={() => handleRowClick(item)}
                onRemove={sourceMode === 'custom' ? () => handleRemoveSymbol(item.symbol, item.exchange) : null}
                showRemove={sourceMode === 'custom'}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Symbol / Import Section (Custom mode only) */}
      {sourceMode === 'custom' && isAuthenticated && (
        <div className={styles.footer}>
          {showImportPanel ? (
            <div className={styles.importPanel}>
              <div className={styles.importHeader}>
                <span>Import Symbols</span>
                <button
                  className={styles.closeBtn}
                  onClick={() => {
                    setShowImportPanel(false);
                    setImportText('');
                  }}
                >
                  <X size={14} />
                </button>
              </div>
              <div className={styles.importBody}>
                <textarea
                  className={styles.importTextarea}
                  placeholder="Paste symbols (one per line or comma-separated)&#10;e.g., RELIANCE, TCS, INFY"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  rows={4}
                />
                <div className={styles.importActions}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    className={styles.hiddenFileInput}
                    onChange={handleFileImport}
                  />
                  <button
                    className={styles.uploadBtn}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={14} />
                    <span>Upload CSV</span>
                  </button>
                  <button
                    className={styles.addSymbolsBtn}
                    onClick={handleImportText}
                    disabled={!importText.trim()}
                  >
                    Add Symbols
                  </button>
                </div>
              </div>
            </div>
          ) : showAddSymbol ? (
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
            <div className={styles.footerButtons}>
              <button
                className={styles.addButton}
                onClick={() => setShowAddSymbol(true)}
              >
                <Plus size={16} />
                <span>Add Symbol</span>
              </button>
              <button
                className={styles.importButton}
                onClick={() => setShowImportPanel(true)}
              >
                <Upload size={16} />
                <span>Import</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PositionTracker;
