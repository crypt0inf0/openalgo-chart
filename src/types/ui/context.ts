/**
 * UI Context Types
 * Types for React context values
 */

import type { ReactNode } from 'react';
import type { Order, Position, Holding, Trade, Funds } from '../api';
import type { DrawingType, Drawing } from '../domain/chart';

/** User context value */
export interface UserContextValue {
  apiKey: string | null;
  setApiKey: (key: string | null) => void;
  isAuthenticated: boolean;
  broker?: string;
}

/** Order context value */
export interface OrderContextValue {
  showOrderModal: boolean;
  setShowOrderModal: (show: boolean) => void;
  orderModalSymbol: string | null;
  orderModalExchange: string | null;
  orderModalAction: 'BUY' | 'SELL' | null;
  orderModalPrice: number | null;
  openOrderModal: (params: {
    symbol: string;
    exchange: string;
    action?: 'BUY' | 'SELL';
    price?: number;
  }) => void;
  closeOrderModal: () => void;
}

/** Trading data for context */
export interface TradingData {
  orders: Order[];
  positions: Position[];
  holdings: Holding[];
  trades: Trade[];
  funds: Funds | null;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

/** Trading data context value */
export interface TradingDataContextValue extends TradingData {
  refresh: () => Promise<void>;
  refreshOrders: () => Promise<void>;
  refreshPositions: () => Promise<void>;
  refreshHoldings: () => Promise<void>;
  refreshTrades: () => Promise<void>;
  refreshFunds: () => Promise<void>;
}

/** Theme mode */
export type ThemeMode = 'light' | 'dark' | 'system';

/** Theme context value */
export interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  resolvedTheme: 'light' | 'dark';
  toggleTheme: () => void;
}

/** Tool context value */
export interface ToolContextValue {
  activeTool: DrawingType | 'cursor' | 'crosshair' | 'measure';
  setActiveTool: (tool: DrawingType | 'cursor' | 'crosshair' | 'measure') => void;
  selectedDrawing: Drawing | null;
  setSelectedDrawing: (drawing: Drawing | null) => void;
  drawingColor: string;
  setDrawingColor: (color: string) => void;
  drawingLineWidth: number;
  setDrawingLineWidth: (width: number) => void;
  drawingLineStyle: 'solid' | 'dashed' | 'dotted';
  setDrawingLineStyle: (style: 'solid' | 'dashed' | 'dotted') => void;
  isDrawingMode: boolean;
  favoriteTools: DrawingType[];
  addFavoriteTool: (tool: DrawingType) => void;
  removeFavoriteTool: (tool: DrawingType) => void;
}

/** UI context value */
export interface UIContextValue {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  bottomPanelTab: string | null;
  setBottomPanelTab: (tab: string | null) => void;
  rightPanelTab: string | null;
  setRightPanelTab: (tab: string | null) => void;
  showCommandPalette: boolean;
  setShowCommandPalette: (show: boolean) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  showShortcuts: boolean;
  setShowShortcuts: (show: boolean) => void;
}

/** Watchlist context value */
export interface WatchlistContextValue {
  watchlists: Array<{
    id: string;
    name: string;
    items: Array<{ symbol: string; exchange: string }>;
  }>;
  activeWatchlistId: string;
  setActiveWatchlistId: (id: string) => void;
  addWatchlist: (name: string) => void;
  removeWatchlist: (id: string) => void;
  renameWatchlist: (id: string, name: string) => void;
  addSymbol: (watchlistId: string, symbol: string, exchange: string) => void;
  removeSymbol: (watchlistId: string, symbol: string, exchange: string) => void;
  reorderSymbols: (watchlistId: string, fromIndex: number, toIndex: number) => void;
}

/** Provider props helper */
export interface ProviderProps {
  children: ReactNode;
}
