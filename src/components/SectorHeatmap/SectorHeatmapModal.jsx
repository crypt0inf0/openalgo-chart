import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import styles from './SectorHeatmapModal.module.css';
import { SECTORS, getSector } from '../PositionTracker/sectorMapping';

const HEATMAP_MODES = [
  { id: 'sector', label: 'Sector' },
  { id: 'treemap', label: 'Treemap' },
  { id: 'grid', label: 'Grid' },
];

const SectorHeatmapModal = ({ isOpen, onClose, watchlistData, onSectorSelect, onSymbolSelect }) => {
  const [activeMode, setActiveMode] = useState('sector');

  // Calculate intraday change from open (same as Position Flow)
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

  // Process stock data with all needed fields
  const stockData = useMemo(() => {
    if (!watchlistData || watchlistData.length === 0) return [];

    return watchlistData.map(item => ({
      symbol: item.symbol,
      exchange: item.exchange || 'NSE',
      ltp: parseFloat(item.last) || 0,
      change: calculateIntradayChange(item),
      volume: parseFloat(item.volume) || 0,
      sector: getSector(item.symbol),
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
        };
      }

      sectorGroups[sector].stocks.push(item);
      sectorGroups[sector].totalChange += item.change;
      sectorGroups[sector].totalVolume += item.volume;
    });

    return Object.values(sectorGroups)
      .map(group => ({
        sector: group.sector,
        stockCount: group.stocks.length,
        avgChange: group.stocks.length > 0 ? group.totalChange / group.stocks.length : 0,
        totalVolume: group.totalVolume,
        stocks: group.stocks,
      }))
      .filter(s => s.stockCount > 0)
      .sort((a, b) => b.avgChange - a.avgChange);
  }, [stockData]);

  // Volume-sorted stocks
  const volumeSortedStocks = useMemo(() => {
    const hasVolume = stockData.some(s => s.volume > 0);
    if (hasVolume) {
      return [...stockData]
        .filter(s => s.volume > 0)
        .sort((a, b) => b.volume - a.volume);
    }
    // Fallback: sort by absolute change when no volume data available
    return [...stockData].sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }, [stockData]);

  // Get color based on change value
  const getChangeColor = (change) => {
    if (change > 2) return '#089981';
    if (change > 1) return '#26a69a';
    if (change > 0.3) return '#4db6ac';
    if (change > 0) return '#80cbc4';
    if (change > -0.3) return '#ff9800';
    if (change > -1) return '#ef5350';
    if (change > -2) return '#e53935';
    return '#f23645';
  };

  // Get background color with opacity for grid/treemap
  const getBackgroundColor = (change) => {
    const intensity = Math.min(Math.abs(change) / 3, 1);
    if (change >= 0) {
      return `rgba(8, 153, 129, ${0.2 + intensity * 0.6})`;
    }
    return `rgba(242, 54, 69, ${0.2 + intensity * 0.6})`;
  };

  // Calculate bar width percentage
  const getBarWidth = (change, maxChange) => {
    return Math.min((Math.abs(change) / Math.max(maxChange, 1)) * 100, 100);
  };

  // Format volume
  const formatVolume = (vol) => {
    if (vol >= 10000000) return `${(vol / 10000000).toFixed(1)}Cr`;
    if (vol >= 100000) return `${(vol / 100000).toFixed(1)}L`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
    return vol.toString();
  };

  const handleRowClick = (sector) => {
    if (onSectorSelect) {
      onSectorSelect(sector);
    }
    onClose();
  };

  const handleStockClick = (stock) => {
    if (onSymbolSelect) {
      onSymbolSelect({ symbol: stock.symbol, exchange: stock.exchange });
    }
    onClose();
  };

  // Render Sector View (Table)
  const renderSectorView = () => {
    const maxChange = Math.max(...sectorData.map(s => Math.abs(s.avgChange)), 1);

    return (
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.colSector}>Sector</th>
            <th className={styles.colStocks}>Stocks</th>
            <th className={styles.colChange}>Avg Chg</th>
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
              <td className={styles.sectorName}>{item.sector}</td>
              <td className={styles.stockCount}>{item.stockCount}</td>
              <td className={styles.changeValue} style={{ color: getChangeColor(item.avgChange) }}>
                {item.avgChange >= 0 ? '+' : ''}{item.avgChange.toFixed(2)}%
              </td>
              <td className={styles.barCell}>
                <div className={styles.barContainer}>
                  <div
                    className={styles.bar}
                    style={{
                      width: `${getBarWidth(item.avgChange, maxChange)}%`,
                      backgroundColor: getChangeColor(item.avgChange),
                    }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  // Render Treemap View
  const renderTreemapView = () => {
    // Calculate total volume for proportional sizing
    const totalVolume = stockData.reduce((sum, s) => sum + s.volume, 0);
    const totalStocks = stockData.length;

    // Group by sector for treemap
    const treemapData = sectorData.map(sector => ({
      ...sector,
      // Size based on total volume of sector, fallback to stock count if no volume
      size: totalVolume > 0
        ? (sector.totalVolume / totalVolume) * 100
        : (sector.stockCount / totalStocks) * 100,
    }));

    return (
      <div className={styles.treemapContainer}>
        {treemapData.map(sector => (
          <div
            key={sector.sector}
            className={styles.treemapSector}
            style={{
              flex: `${sector.stockCount} 1 ${Math.max(sector.stockCount * 25, 100)}px`,
              backgroundColor: getBackgroundColor(sector.avgChange),
            }}
            onClick={() => handleRowClick(sector.sector)}
          >
            <div className={styles.treemapSectorHeader}>
              <span className={styles.treemapSectorName}>{sector.sector}</span>
              <span
                className={styles.treemapSectorChange}
                style={{ color: getChangeColor(sector.avgChange) }}
              >
                {sector.avgChange >= 0 ? '+' : ''}{sector.avgChange.toFixed(2)}%
              </span>
            </div>
            <div className={styles.treemapStocks}>
              {sector.stocks.map(stock => (
                <div
                  key={stock.symbol}
                  className={styles.treemapStock}
                  style={{ backgroundColor: getBackgroundColor(stock.change) }}
                  onClick={(e) => { e.stopPropagation(); handleStockClick(stock); }}
                  title={`${stock.symbol}: ${stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)}%`}
                >
                  <span className={styles.treemapSymbol}>{stock.symbol}</span>
                  <span className={styles.treemapChange}>
                    {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render Grid View
  const renderGridView = () => {
    const sortedStocks = [...stockData].sort((a, b) => b.change - a.change);

    return (
      <div className={styles.gridContainer}>
        {sortedStocks.map(stock => (
          <div
            key={`${stock.symbol}-${stock.exchange}`}
            className={styles.gridItem}
            style={{ backgroundColor: getBackgroundColor(stock.change) }}
            onClick={() => handleStockClick(stock)}
            title={`${stock.symbol} (${stock.sector})`}
          >
            <span className={styles.gridSymbol}>{stock.symbol}</span>
            <span className={styles.gridChange}>
              {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%
            </span>
            <span className={styles.gridLtp}>{stock.ltp.toFixed(2)}</span>
          </div>
        ))}
      </div>
    );
  };

  // Render Volume View
  const renderVolumeView = () => {
    const maxVolume = Math.max(...volumeSortedStocks.map(s => s.volume), 1);

    return (
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.colSymbol}>Symbol</th>
            <th className={styles.colSectorSmall}>Sector</th>
            <th className={styles.colVolume}>Volume</th>
            <th className={styles.colChange}>% Chg</th>
            <th className={styles.colBar}>Activity</th>
          </tr>
        </thead>
        <tbody>
          {volumeSortedStocks.slice(0, 30).map(stock => (
            <tr
              key={`${stock.symbol}-${stock.exchange}`}
              className={styles.row}
              onClick={() => handleStockClick(stock)}
            >
              <td className={styles.symbolName}>{stock.symbol}</td>
              <td className={styles.sectorSmall}>{stock.sector}</td>
              <td className={styles.volumeValue}>{formatVolume(stock.volume)}</td>
              <td className={styles.changeValue} style={{ color: getChangeColor(stock.change) }}>
                {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%
              </td>
              <td className={styles.barCell}>
                <div className={styles.barContainer}>
                  <div
                    className={styles.bar}
                    style={{
                      width: `${(stock.volume / maxVolume) * 100}%`,
                      backgroundColor: getChangeColor(stock.change),
                    }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  // Render content based on active mode
  const renderContent = () => {
    if (stockData.length === 0) {
      return (
        <div className={styles.emptyState}>
          <p>No data available</p>
          <p className={styles.emptyHint}>Add stocks to your watchlist to see heatmap</p>
        </div>
      );
    }

    switch (activeMode) {
      case 'sector':
        return renderSectorView();
      case 'treemap':
        return renderTreemapView();
      case 'grid':
        return renderGridView();
      case 'volume':
        return renderVolumeView();
      default:
        return renderSectorView();
    }
  };

  // Get footer hint based on mode
  const getFooterHint = () => {
    switch (activeMode) {
      case 'sector':
        return 'Click on a sector to filter Position Flow';
      case 'treemap':
        return 'Click sector header to filter, or stock to view chart';
      case 'grid':
        return 'Click on a stock to view its chart';
      case 'volume':
        return 'Showing top 30 stocks by volume. Click to view chart';
      default:
        return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Market Heatmap</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className={styles.modeTabs}>
          {HEATMAP_MODES.map(mode => (
            <button
              key={mode.id}
              className={`${styles.modeTab} ${activeMode === mode.id ? styles.modeTabActive : ''}`}
              onClick={() => setActiveMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className={styles.content}>
          {renderContent()}
        </div>

        <div className={styles.footer}>
          <span className={styles.hint}>{getFooterHint()}</span>
        </div>
      </div>
    </div>
  );
};

export default SectorHeatmapModal;
