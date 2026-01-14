import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { X, Grid3X3, LayoutGrid, BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import styles from './SectorHeatmapModal.module.css';
import { SECTORS, getSector } from '../PositionTracker/sectorMapping';

// Import extracted constants and utils
import { HEATMAP_MODES } from './constants';
import { calculateIntradayChange, getChangeColor, getTextColor, getBarWidth, formatVolume, formatPrice, calculateTreemapLayout } from './utils';

const SectorHeatmapModal = ({ isOpen, onClose, watchlistData, onSectorSelect, onSymbolSelect }) => {
  const [activeMode, setActiveMode] = useState('treemap');
  const [hoveredStock, setHoveredStock] = useState(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const resizeObserverRef = useRef(null);
  const treemapRef = useRef(null);

  // Memoized callback ref for treemap container - prevents infinite loops
  const setTreemapRef = useCallback((node) => {
    // Cleanup previous observer
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }

    treemapRef.current = node;

    if (node) {
      // Measure immediately, but only update if changed
      const rect = node.getBoundingClientRect();
      setContainerSize(prev => {
        if (prev.width === rect.width && prev.height === rect.height) return prev;
        return { width: rect.width, height: rect.height };
      });

      // Setup resize observer for future changes
      resizeObserverRef.current = new ResizeObserver(entries => {
        for (let entry of entries) {
          setContainerSize(prev => {
            if (prev.width === entry.contentRect.width && prev.height === entry.contentRect.height) return prev;
            return {
              width: entry.contentRect.width,
              height: entry.contentRect.height
            };
          });
        }
      });
      resizeObserverRef.current.observe(node);
    }
  }, []);

  // Cleanup resize observer on unmount
  useEffect(() => {
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, []);

  // Process stock data
  const stockData = useMemo(() => {
    if (!watchlistData || watchlistData.length === 0) return [];
    return watchlistData.map(item => ({
      symbol: item.symbol,
      exchange: item.exchange || 'NSE',
      ltp: parseFloat(item.last) || 0,
      change: calculateIntradayChange(item),
      volume: parseFloat(item.volume) || 0,
      sector: getSector(item.symbol),
      marketCap: parseFloat(item.marketCap) || parseFloat(item.volume) || 1000000, // Use volume as proxy if no market cap
    }));
  }, [watchlistData]);

  // Calculate sector-wise performance
  const sectorData = useMemo(() => {
    if (stockData.length === 0) return [];
    const sectorGroups = {};

    stockData.forEach(item => {
      const sector = item.sector;
      if (!sectorGroups[sector]) {
        sectorGroups[sector] = {
          sector,
          stocks: [],
          totalChange: 0,
          totalVolume: 0,
          totalMarketCap: 0,
        };
      }
      sectorGroups[sector].stocks.push(item);
      sectorGroups[sector].totalChange += item.change;
      sectorGroups[sector].totalVolume += item.volume;
      sectorGroups[sector].totalMarketCap += item.marketCap;
    });

    return Object.values(sectorGroups)
      .map(group => ({
        sector: group.sector,
        stockCount: group.stocks.length,
        avgChange: group.stocks.length > 0 ? group.totalChange / group.stocks.length : 0,
        totalVolume: group.totalVolume,
        totalMarketCap: group.totalMarketCap,
        stocks: group.stocks.sort((a, b) => b.marketCap - a.marketCap), // Sort stocks by market cap
      }))
      .filter(s => s.stockCount > 0)
      .sort((a, b) => b.totalMarketCap - a.totalMarketCap); // Sort sectors by total market cap
  }, [stockData]);

  // Calculate market stats
  const marketStats = useMemo(() => {
    if (stockData.length === 0) return { gainers: 0, losers: 0, unchanged: 0, avgChange: 0 };
    const gainers = stockData.filter(s => s.change > 0.1).length;
    const losers = stockData.filter(s => s.change < -0.1).length;
    const unchanged = stockData.length - gainers - losers;
    const avgChange = stockData.reduce((sum, s) => sum + s.change, 0) / stockData.length;
    return { gainers, losers, unchanged, avgChange };
  }, [stockData]);

  const handleRowClick = (sector) => {
    if (onSectorSelect) onSectorSelect(sector);
    onClose();
  };

  const handleStockClick = (stock, e) => {
    e?.stopPropagation();
    if (onSymbolSelect) onSymbolSelect({ symbol: stock.symbol, exchange: stock.exchange });
    onClose();
  };

  // Prepare treemap data with nested layout - EQUAL SIZED tiles for readability
  const treemapLayout = useMemo(() => {
    if (containerSize.width === 0 || containerSize.height === 0) return [];

    // Use stock COUNT for sector sizing (proportional representation)
    const totalStocks = stockData.length;
    const sectorItems = sectorData.map(s => ({
      ...s,
      value: s.stockCount, // Size by stock count, not market cap
    }));

    const sectorLayout = calculateTreemapLayout(
      sectorItems,
      0, 0,
      containerSize.width,
      containerSize.height
    );

    // Calculate stock layouts within each sector - EQUAL SIZE for all stocks
    return sectorLayout.map(sector => {
      // All stocks get equal value = equal sized tiles
      const stockItems = sector.stocks.map(stock => ({
        ...stock,
        value: 1, // Equal size for all stocks
      }));

      const padding = 2;
      const headerHeight = 22;
      const stockLayout = calculateTreemapLayout(
        stockItems,
        padding,
        headerHeight,
        Math.max(sector.width - padding * 2, 0),
        Math.max(sector.height - headerHeight - padding, 0)
      );

      return {
        ...sector,
        stockLayout,
      };
    });
  }, [sectorData, stockData.length, containerSize]);

  // Render Professional Treemap View
  const renderTreemapView = () => {
    return (
      <div className={styles.treemapWrapper}>
        <div className={styles.treemapContainer} ref={setTreemapRef}>
          {treemapLayout.map(sector => (
            <div
              key={sector.sector}
              className={styles.treemapSector}
              style={{
                left: sector.x,
                top: sector.y,
                width: sector.width,
                height: sector.height,
                borderColor: getChangeColor(sector.avgChange, false),
              }}
              onClick={() => handleRowClick(sector.sector)}
            >
              <div
                className={styles.treemapSectorHeader}
                style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
              >
                <span className={styles.treemapSectorName}>{sector.sector}</span>
                <span
                  className={styles.treemapSectorChange}
                  style={{ color: getChangeColor(sector.avgChange, false) }}
                >
                  {sector.avgChange >= 0 ? '+' : ''}{sector.avgChange.toFixed(2)}%
                </span>
              </div>

              {sector.stockLayout.map(stock => (
                <div
                  key={stock.symbol}
                  className={styles.treemapStock}
                  style={{
                    left: stock.x,
                    top: stock.y,
                    width: stock.width,
                    height: stock.height,
                    backgroundColor: getChangeColor(stock.change, true),
                  }}
                  onClick={(e) => handleStockClick(stock, e)}
                  onMouseEnter={() => setHoveredStock(stock)}
                  onMouseLeave={() => setHoveredStock(null)}
                >
                  <div className={styles.treemapStockContent}>
                    {/* Always show symbol if tile is visible */}
                    <span
                      className={styles.treemapSymbol}
                      style={{
                        fontSize: Math.max(Math.min(stock.width / 5.5, 16), 10),
                        color: getTextColor()
                      }}
                    >
                      {stock.symbol}
                    </span>
                    {/* Show % change if height allows */}
                    {stock.height > 35 && (
                      <span
                        className={styles.treemapChange}
                        style={{
                          fontSize: Math.max(Math.min(stock.width / 6, 14), 9),
                          color: getTextColor()
                        }}
                      >
                        {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%
                      </span>
                    )}
                    {/* Show price only if enough space */}
                    {stock.height > 55 && stock.width > 55 && (
                      <span
                        className={styles.treemapLtp}
                        style={{ color: 'rgba(255,255,255,0.85)' }}
                      >
                        ₹{formatPrice(stock.ltp)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Hover tooltip */}
        {hoveredStock && (
          <div className={styles.tooltip}>
            <div className={styles.tooltipHeader}>
              <span className={styles.tooltipSymbol}>{hoveredStock.symbol}</span>
              <span
                className={styles.tooltipChange}
                style={{ color: getChangeColor(hoveredStock.change, false) }}
              >
                {hoveredStock.change >= 0 ? '+' : ''}{hoveredStock.change.toFixed(2)}%
              </span>
            </div>
            <div className={styles.tooltipRow}>
              <span>LTP</span>
              <span>₹{formatPrice(hoveredStock.ltp)}</span>
            </div>
            <div className={styles.tooltipRow}>
              <span>Sector</span>
              <span>{hoveredStock.sector}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render Grid View (enhanced)
  const renderGridView = () => {
    const sortedStocks = [...stockData].sort((a, b) => b.change - a.change);

    return (
      <div className={styles.gridContainer}>
        {sortedStocks.map(stock => (
          <div
            key={`${stock.symbol}-${stock.exchange}`}
            className={styles.gridItem}
            style={{ backgroundColor: getChangeColor(stock.change, true) }}
            onClick={() => handleStockClick(stock)}
          >
            <span className={styles.gridSymbol} style={{ color: getTextColor(stock.change) }}>
              {stock.symbol}
            </span>
            <span className={styles.gridChange} style={{ color: getTextColor(stock.change) }}>
              {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%
            </span>
            <span className={styles.gridLtp}>₹{formatPrice(stock.ltp)}</span>
          </div>
        ))}
      </div>
    );
  };

  // Render Sector View (enhanced table)
  const renderSectorView = () => {
    const maxChange = Math.max(...sectorData.map(s => Math.abs(s.avgChange)), 1);

    return (
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.colSector}>Sector</th>
              <th className={styles.colStocks}>Stocks</th>
              <th className={styles.colChange}>Avg Change</th>
              <th className={styles.colBar}>Performance</th>
            </tr>
          </thead>
          <tbody>
            {sectorData.map(item => (
              <tr
                key={item.sector}
                className={styles.row}
                onClick={() => handleRowClick(item.sector)}
              >
                <td className={styles.sectorName}>
                  <div className={styles.sectorIndicator} style={{ backgroundColor: getChangeColor(item.avgChange, true) }} />
                  {item.sector}
                </td>
                <td className={styles.stockCount}>{item.stockCount}</td>
                <td className={styles.changeValue} style={{ color: getChangeColor(item.avgChange, false) }}>
                  {item.avgChange >= 0 ? '+' : ''}{item.avgChange.toFixed(2)}%
                </td>
                <td className={styles.barCell}>
                  <div className={styles.barContainer}>
                    <div
                      className={styles.bar}
                      style={{
                        width: `${getBarWidth(item.avgChange, maxChange)}%`,
                        backgroundColor: getChangeColor(item.avgChange, true),
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Render content based on active mode
  const renderContent = () => {
    if (stockData.length === 0) {
      return (
        <div className={styles.emptyState}>
          <Grid3X3 size={48} strokeWidth={1} />
          <p>No data available</p>
          <p className={styles.emptyHint}>Add stocks to your watchlist to see heatmap</p>
        </div>
      );
    }

    switch (activeMode) {
      case 'treemap': return renderTreemapView();
      case 'grid': return renderGridView();
      case 'sector': return renderSectorView();
      default: return renderTreemapView();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 className={styles.title}>Market Heatmap</h2>
            <div className={styles.marketStats}>
              <div className={styles.statItem}>
                <TrendingUp size={14} className={styles.statIconGreen} />
                <span className={styles.statValue}>{marketStats.gainers}</span>
              </div>
              <div className={styles.statItem}>
                <TrendingDown size={14} className={styles.statIconRed} />
                <span className={styles.statValue}>{marketStats.losers}</span>
              </div>
              <div className={`${styles.statItem} ${styles.statAvg}`}>
                <span
                  className={styles.statAvgValue}
                  style={{ color: getChangeColor(marketStats.avgChange, false) }}
                >
                  {marketStats.avgChange >= 0 ? '+' : ''}{marketStats.avgChange.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className={styles.modeTabs}>
          {HEATMAP_MODES.map(mode => {
            const IconComponent = mode.icon;
            return (
              <button
                key={mode.id}
                className={`${styles.modeTab} ${activeMode === mode.id ? styles.modeTabActive : ''}`}
                onClick={() => setActiveMode(mode.id)}
              >
                <IconComponent size={16} />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className={styles.content}>
          {renderContent()}
        </div>

        {/* Color Legend */}
        <div className={styles.footer}>
          <div className={styles.legend}>
            <div className={styles.legendItem}>
              <div className={styles.legendColor} style={{ background: 'linear-gradient(to right, #5C0618, #8B0A24, #B80F30, #D01238)' }} />
              <span>-4%</span>
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendColor} style={{ backgroundColor: '#3D1A1A' }} />
              <span>0%</span>
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendColor} style={{ background: 'linear-gradient(to right, #006B2C, #008235, #009A3E, #00B248)' }} />
              <span>+4%</span>
            </div>
          </div>
          <span className={styles.hint}>Click on stocks to view chart</span>
        </div>
      </div>
    </div>
  );
};

export default SectorHeatmapModal;
