/**
 * Context Index
 * Central export for all context providers
 */

// User Context
export {
  UserProvider,
  useUser,
  type UserContextValue,
  type User,
  type UserProviderProps,
} from './UserContext';

// Theme Context
export {
  ThemeProvider,
  useTheme,
  type ThemeContextValue,
  type Theme,
  type ThemeProviderProps,
} from './ThemeContext';

// Order Context
export {
  OrderProvider,
  useOrders,
  type OrderContextValue,
  type Order,
  type Position,
  type Funds,
  type Holding,
  type Trade,
  type ShowToastFn,
  type OrderProviderProps,
} from './OrderContext';

// Tool Context
export {
  ToolProvider,
  useTool,
  DRAWING_TOOLS,
  type ToolContextValue,
  type DrawingTool,
  type ToolProviderProps,
} from './ToolContext';

// UI Context
export {
  UIProvider,
  useUI,
  type UIContextValue,
  type SearchMode,
  type RightPanelType,
  type UIProviderProps,
} from './UIContext';

// Watchlist Context
export {
  WatchlistProvider,
  useWatchlist,
  type WatchlistContextValue,
  type Watchlist,
  type WatchlistsState,
  type WatchlistSymbol,
  type WatchlistItemData,
  type WatchlistProviderProps,
} from './WatchlistContext';
