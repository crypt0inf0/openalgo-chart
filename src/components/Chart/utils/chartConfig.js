/**
 * Chart Configuration Constants
 * Centralized configuration for chart display and behavior
 */

// === Display Settings ===
export const DEFAULT_CANDLE_WINDOW = 235;       // Fixed number of candles to show
export const DEFAULT_RIGHT_OFFSET = 50;         // Right margin in candle units (~50 for TradingView-like future time display)
export const DEFAULT_VIEW_WINDOW = 200;         // Default view window for auto-fit
export const EXTENDED_VIEW_WINDOW = 300;        // Extended view window for larger displays

// === Data Loading Settings ===
export const PREFETCH_THRESHOLD = 126;          // Candles from oldest before prefetching more data
export const MIN_CANDLES_FOR_SCROLL_BACK = 50;  // Minimum candles before enabling scroll-back

// === Time Settings ===
export const IST_OFFSET_SECONDS = 19800;        // IST offset from UTC (5 hours 30 minutes)
export const FUTURE_TIME_CANDLES = 120;         // Number of future whitespace points for time axis

// === Pane Settings ===
export const DEFAULT_PANE_HEIGHT = 100;         // Default height for indicator panes
export const LARGE_PANE_HEIGHT = 120;           // Height for larger indicator panes (MACD, TPO)

// === Animation Settings ===
export const REPLAY_SPEEDS = [0.5, 1, 2, 4, 8]; // Available replay speeds

// === Chart Appearance Defaults ===
export const DEFAULT_CANDLE_UP_COLOR = '#089981';
export const DEFAULT_CANDLE_DOWN_COLOR = '#F23645';
export const DEFAULT_LINE_COLOR = '#2962FF';
