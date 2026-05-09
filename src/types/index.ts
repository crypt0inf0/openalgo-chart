/**
 * Types Index
 * Central export for all type definitions
 *
 * Usage:
 * import type { Order, Position, ChartConfig } from '@/types';
 * import type { Exchange, OrderAction } from '@types/domain';
 */

// API Types
export * from './api';

// Domain Types
export * from './domain';

// UI Types - selectively export to avoid conflicts
export type {
  BaseComponentProps,
  WithChildren,
  ButtonVariant,
  ButtonSize,
  ButtonProps,
  InputProps,
  SelectOption,
  SelectProps,
  ModalProps,
  DialogProps,
  ToastType,
  ToastProps,
  TooltipPlacement,
  TooltipProps,
  TabItem,
  TabsProps,
  DropdownMenuItem,
  DropdownMenuProps,
  TableColumn,
  TableProps,
} from './ui/components';

export type {
  UserContextValue,
  OrderContextValue,
  TradingData,
  TradingDataContextValue,
  ThemeMode,
  ThemeContextValue,
  ToolContextValue,
  UIContextValue,
  WatchlistContextValue,
  ProviderProps,
} from './ui/context';

export type {
  UseDebouncedReturn,
  UseLocalStorageReturn,
  UseMediaQueryReturn,
  UseClickOutsideOptions,
  UseFocusTrapOptions,
  UseKeyboardNavReturn,
  UseChartReturn,
  UseIndicatorHandlersReturn,
  UseDrawingHandlersReturn,
  UseTradingDataReturn,
  OrderFormState,
  UseOrderFormReturn,
  UseVirtualScrollReturn,
  UseToastManagerReturn,
  UseSymbolSearchReturn,
} from './ui/hooks';

// Utility Types
export * from './utils';
