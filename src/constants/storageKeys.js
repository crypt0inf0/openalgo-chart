/**
 * Centralized localStorage key constants
 * Prevents typos and enables easy refactoring
 */

export const STORAGE_KEYS = {
  // OpenAlgo API Settings
  OA_API_KEY: 'oa_apikey',
  OA_HOST_URL: 'oa_host_url',
  OA_WS_URL: 'oa_ws_url',
  OA_USERNAME: 'oa_username',
  OA_LOG_LEVEL: 'oa_log_level',

  // Chart Settings
  THEME: 'tv_theme',
  INTERVAL: 'tv_interval',
  LAST_NONFAV_INTERVAL: 'tv_last_nonfav_interval',
  FAV_INTERVALS: 'tv_fav_intervals_v2',
  CUSTOM_INTERVALS: 'tv_custom_intervals',
  CHART_APPEARANCE: 'tv_chart_appearance',
  SAVED_LAYOUT: 'tv_saved_layout',

  // Alerts
  ALERTS: 'tv_alerts',
  CHART_ALERTS: 'tv_chart_alerts',
  ALERT_LOGS: 'tv_alert_logs',

  // Watchlist
  WATCHLIST: 'tv_watchlist',
  WATCHLISTS: 'tv_watchlists',
  WATCHLIST_WIDTH: 'tv_watchlist_width',

  // Drawing Tools
  DRAWING_DEFAULTS: 'tv_drawing_defaults',
  DRAWING_TEMPLATES: 'tv_drawing_templates',
  FAVORITE_DRAWING_TOOLS: 'tv_favorite_drawing_tools',
  FLOATING_TOOLBAR_POS: 'tv_floating_toolbar_pos',

  // Panels
  ACCOUNT_PANEL_OPEN: 'tv_account_panel_open',
  ACCOUNT_PANEL_HEIGHT: 'tv_account_panel_height',
  POSITION_TRACKER_SETTINGS: 'tv_position_tracker_settings',

  // Option Chain
  OPTION_CHAIN_STRIKE_COUNT: 'optionChainStrikeCount',
  SHOW_OI_LINES: 'tv_show_oi_lines',

  // Templates
  TEMPLATE_FAVORITES: 'tv_template_favorites',
  LAYOUT_TEMPLATES: 'tv_layout_templates',

  // Command Palette
  RECENT_COMMANDS: 'tv_recent_commands',

  // Symbol History
  SYMBOL_FAVORITES: 'tv_symbol_favorites',
  RECENT_SYMBOLS: 'tv_recent_symbols',

  // Sync
  CLOUD_SYNC_DONE: '_cloud_sync_done',
};

/**
 * Helper to get a storage key with optional prefix
 */
export const getStorageKey = (key, prefix = '') => {
  return prefix ? `${prefix}_${key}` : key;
};

export default STORAGE_KEYS;
