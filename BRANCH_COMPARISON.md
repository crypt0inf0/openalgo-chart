# Branch Comparison: `update` → `micro`

## Summary
- **Total Commits:** 51
- **Files Changed:** 119
- **Lines Added:** ~10,905
- **Lines Removed:** ~5,225
- **Net Change:** +5,680 lines

---

## Commits (Newest First)

| Commit | Description |
|--------|-------------|
| `8f1d1f1` | fix: Use correct parameter name in updateIndicators for PAR indicator |
| `fd1d879` | fix: Resolve temporal dead zone errors in App.jsx and module exports |
| `f275422` | feat: Add utility hooks and color system |
| `a140b1d` | feat: Add Web Worker for heavy indicator calculations |
| `aeb4bb6` | feat: Add WatchlistContext for centralized watchlist state management |
| `8332b92` | feat: Add ChartContext for centralized chart state management |
| `ab3e3b7` | revert: Roll back TypeScript migration, keep utilities as JavaScript |
| `02c80a4` | chore: Convert logger, fuzzySearch, soundManager to TypeScript |
| `740824b` | refactor: Convert 3 more files to TypeScript |
| `248e8ef` | feat: Add TypeScript support with gradual migration setup |
| `d0fd02a` | feat: Integrate context providers into app root |
| `0469b1a` | perf: Add useMemo and lazy loading for better performance |
| `58f710c` | feat: Add AlertContext for centralized alert state management |
| `0f4275b` | feat: Add ToolContext for centralized drawing tool state management |
| `0cdcb18` | feat: Add UIContext for centralized modal/dialog state management |
| `bb34a9f` | feat: Add error handling utilities for resilience patterns |
| `fdf4a3c` | refactor: Add centralized storage service and deduplicate safeParseJSON |
| `ad684b3` | fix: Implement Price Action Range indicator and fix useMemo dependencies |
| `075d43a` | refactor: Extract ANN Scanner handlers to useANNScanner hook |
| `50649e2` | refactor: Extract chartDataService.js from openalgo.js |
| `049485c` | refactor: Extract preferencesService.js from openalgo.js |
| `d6898d3` | refactor: Extract instrumentService.js from openalgo.js |
| `d91f7e6` | refactor: Extract options API service from openalgo.js |
| `1eb1b15` | refactor: Extract drawings service from openalgo.js |
| `d45aeb7` | refactor: Use shared timeUtils in annStrategy indicator |
| `3cb8de3` | refactor: Use shared timeUtils in priceActionRange indicator |
| `a82f403` | refactor: Extract UI handlers to useUIHandlers hook |
| `56fb2d9` | refactor: Extract tool handlers to useToolHandlers hook |
| `44a03f1` | refactor: Extract alert handlers to useAlertHandlers hook |
| `2d72cfe` | refactor: Extract layout handlers from App.jsx to useLayoutHandlers hook |
| `0a3ed4f` | refactor: Extract symbol handlers from App.jsx to useSymbolHandlers hook |
| `a879efb` | refactor: Extract order handlers from App.jsx to useOrderHandlers hook |
| `c8c8687` | refactor: Extract interval handlers from App.jsx to useIntervalHandlers hook |
| `7a0d6e5` | refactor: Extract indicator handlers from App.jsx to useIndicatorHandlers hook |
| `ace8a43` | refactor: Extract watchlist handlers from App.jsx to useWatchlistHandlers hook |
| `2616b02` | refactor: Extract services from openalgo.js |
| `70c8c8f` | refactor: Extract utilities from App.jsx to appUtils.js |
| `455fc00` | chore: Remove unused imports from ChartComponent |
| `88c550e` | refactor: Extract indicator update logic to indicatorUpdaters.js |
| `90cf823` | refactor: Extract ChartContextMenu and indicator creation factories |
| `23ff661` | refactor: Extract MeasureOverlay and OHLCHeader components |
| `72c7c2b` | chore: Add hooks index for Chart component |
| `556895b` | refactor: Extract usePaneMenu hook from ChartComponent |
| `7ee094f` | chore: Export chartConfig from utils index |
| `e7677ad` | refactor: Extract chart configuration constants |
| `739a5f9` | refactor: Extract formatTimeDiff to chartHelpers |
| `5c24fb0` | refactor: Extract addFutureWhitespacePoints to chartHelpers |
| `6573a73` | refactor: Use transformData from seriesFactories |
| `a8fc787` | refactor: Use seriesFactories for chart series creation |
| `8345999` | refactor: Extract utilities and alert functions from ChartComponent |
| `6f0e394` | refactor: Add chart utilities and consolidate alert service |
| `304b947` | refactor: Extract shared time utilities and add storage constants |

---

## Key Changes by Category

### Bug Fixes
- Fixed `activeIndicators` undefined error (parameter name fix)
- Fixed temporal dead zone errors in App.jsx
- Fixed Price Action Range indicator and useMemo dependencies

### New Features
- Web Worker for heavy indicator calculations
- Color utility system
- TypeScript support (later reverted to keep JavaScript)

### Architecture Improvements

#### New Context Providers
| File | Purpose |
|------|---------|
| `src/context/WatchlistContext.jsx` | Centralized watchlist state |
| `src/context/ChartContext.jsx` | Centralized chart state |
| `src/context/AlertContext.jsx` | Centralized alert state |
| `src/context/ToolContext.jsx` | Drawing tool state |
| `src/context/UIContext.jsx` | Modal/dialog state |

#### New Custom Hooks
| File | Purpose |
|------|---------|
| `src/hooks/useANNScanner.js` | ANN Scanner logic |
| `src/hooks/useAlertHandlers.js` | Alert operations |
| `src/hooks/useIndicatorHandlers.js` | Indicator operations |
| `src/hooks/useIntervalHandlers.js` | Timeframe handling |
| `src/hooks/useLayoutHandlers.js` | Layout management |
| `src/hooks/useOrderHandlers.js` | Order operations |
| `src/hooks/useSymbolHandlers.js` | Symbol management |
| `src/hooks/useToolHandlers.js` | Drawing tools |
| `src/hooks/useUIHandlers.js` | UI interactions |
| `src/hooks/useWatchlistHandlers.js` | Watchlist operations |
| `src/hooks/useIndicatorWorker.js` | Web Worker interface |
| `src/hooks/useOptionChainData.js` | Option chain data |
| `src/hooks/useVirtualScroll.jsx` | Virtual scrolling |

#### New Services (Extracted from openalgo.js)
| File | Purpose |
|------|---------|
| `src/services/accountService.js` | Account operations |
| `src/services/chartDataService.js` | Chart data fetching |
| `src/services/drawingsService.js` | Drawing persistence |
| `src/services/instrumentService.js` | Instrument search |
| `src/services/optionsApiService.js` | Options API |
| `src/services/orderService.js` | Order management |
| `src/services/preferencesService.js` | User preferences |
| `src/services/storageService.js` | LocalStorage operations |
| `src/services/apiConfig.js` | API configuration |

#### New Utilities
| File | Purpose |
|------|---------|
| `src/utils/appUtils.js` | App-level utilities |
| `src/utils/colorUtils.js` | Color manipulation |
| `src/utils/errorUtils.js` | Error handling patterns |
| `src/utils/indicators/timeUtils.js` | Time calculations |
| `src/utils/indicators/annStrategy.js` | ANN Strategy indicator |
| `src/constants/storageKeys.js` | Storage key constants |

#### Chart Component Refactoring
| File | Purpose |
|------|---------|
| `src/components/Chart/ChartContextMenu.jsx` | Context menu component |
| `src/components/Chart/MeasureOverlay.jsx` | Measure tool overlay |
| `src/components/Chart/OHLCHeader.jsx` | OHLC display header |
| `src/components/Chart/hooks/usePaneMenu.js` | Pane menu hook |
| `src/components/Chart/utils/chartConfig.js` | Chart configuration |
| `src/components/Chart/utils/chartHelpers.js` | Helper functions |
| `src/components/Chart/utils/indicatorCreators.js` | Indicator factories |
| `src/components/Chart/utils/indicatorUpdaters.js` | Indicator updates |
| `src/components/Chart/utils/seriesFactories.js` | Series creation |

#### Web Worker
| File | Purpose |
|------|---------|
| `src/workers/indicatorWorker.js` | Heavy calculations offloaded |

---

## File Size Reduction

| File | Change |
|------|--------|
| `src/App.jsx` | Reduced by ~1,500 lines |
| `src/components/Chart/ChartComponent.jsx` | Reduced by ~800 lines |
| `src/services/openalgo.js` | Reduced by ~1,400 lines |

---

## Performance Improvements
- Added `useMemo` optimizations
- Lazy loading for components
- Web Worker for indicator calculations
- Virtual scrolling support

---

## Testing Status
- All modals working (Settings, Sector Heatmap, Option Chain)
- No JavaScript runtime errors
- Build passes successfully
- All indicators functional

---

*Generated on: 2026-01-13*
*Comparison: `update` branch → `micro` branch*
