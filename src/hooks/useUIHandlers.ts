/**
 * UI Handlers Hook
 * Manages UI state: panels, dialogs, toggles, and appearance settings
 */

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { set, STORAGE_KEYS } from '../services/storageService';
import { CHART_COLORS } from '../utils/colorUtils';

// ==================== TYPES ====================

/** Chart colors structure */
interface ChartColorsType {
  UP: { primary: string };
  DOWN: { primary: string };
}

/** Chart appearance settings */
export interface ChartAppearance {
  wickUpColor: string;
  wickDownColor: string;
  borderUpColor: string;
  borderDownColor: string;
  upColor: string;
  downColor: string;
  lineColor: string;
  areaTopColor: string;
  areaBottomColor: string;
  baselineTopFillColor1: string;
  baselineTopFillColor2: string;
  baselineBottomFillColor1: string;
  baselineBottomFillColor2: string;
  baselineTopLineColor: string;
  baselineBottomLineColor: string;
  rangeUpColor: string;
  rangeDownColor: string;
}

/** Drawing options */
export interface DrawingDefaults {
  lineColor: string;
  lineWidth: number;
  lineStyle: number;
  fillColor: string;
  showLabel: boolean;
  fontSize: number;
  fontFamily: string;
  textColor: string;
  [key: string]: unknown;
}

/** Indicator settings */
export interface IndicatorSettings {
  id: string;
  type: string;
  visible: boolean;
  [key: string]: unknown;
}

/** Chart configuration */
export interface ChartConfig {
  id: number;
  symbol: string;
  exchange: string;
  interval: string;
  indicators: IndicatorSettings[];
  comparisonSymbols: unknown[];
  [key: string]: unknown;
}

/** Option chain symbol */
export interface OptionChainSymbol {
  symbol: string;
  exchange: string;
}

/** Toast function type */
export type ShowToastFn = (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;

/** Right panel type */
export type RightPanelType = 'alerts' | 'watchlist' | 'account' | null;

/** Hook parameters */
export interface UseUIHandlersParams {
  // Panel setters
  setActiveRightPanel: Dispatch<SetStateAction<RightPanelType>>;
  setIsSettingsOpen: Dispatch<SetStateAction<boolean>>;
  setIsOptionChainOpen: Dispatch<SetStateAction<boolean>>;
  setOptionChainInitialSymbol: Dispatch<SetStateAction<OptionChainSymbol | null>>;
  // Chart settings
  setCharts: Dispatch<SetStateAction<ChartConfig[]>>;
  activeChartId: number;
  chartAppearance: ChartAppearance;
  setChartAppearance: Dispatch<SetStateAction<ChartAppearance>>;
  // Timer/session
  setIsTimerVisible: Dispatch<SetStateAction<boolean>>;
  setIsSessionBreakVisible: Dispatch<SetStateAction<boolean>>;
  // Drawing
  setDrawingDefaults: Dispatch<SetStateAction<DrawingDefaults>>;
  // API settings
  setApiKey: Dispatch<SetStateAction<string>>;
  setWebsocketUrl: Dispatch<SetStateAction<string>>;
  setHostUrl: Dispatch<SetStateAction<string>>;
  setOpenalgoUsername: Dispatch<SetStateAction<string>>;
  // Toast
  showToast: ShowToastFn;
}

/** Hook return type */
export interface UseUIHandlersReturn {
  handleRightPanelToggle: (panel: RightPanelType) => void;
  handleSettingsClick: () => void;
  handleOptionChainClick: () => void;
  handleOptionSelect: (symbol: string, exchange: string) => void;
  handleOpenOptionChainForSymbol: (symbol: string, exchange: string) => void;
  handleTimerToggle: () => void;
  handleSessionBreakToggle: () => void;
  handleChartAppearanceChange: (newAppearance: Partial<ChartAppearance>) => void;
  handleResetChartAppearance: () => void;
  handleDrawingPropertyChange: (property: string, value: unknown) => void;
  handleResetDrawingDefaults: () => void;
  handleResetChart: () => void;
  handleApiKeySaveFromSettings: (newApiKey: string) => void;
  handleWebsocketUrlSave: (newUrl: string) => void;
  handleHostUrlSave: (newUrl: string) => void;
  handleUsernameSave: (newUsername: string) => void;
}

// ==================== CONSTANTS ====================

const typedChartColors = CHART_COLORS as ChartColorsType;

/** Default chart appearance settings */
const DEFAULT_CHART_APPEARANCE: ChartAppearance = {
  wickUpColor: typedChartColors.UP.primary,
  wickDownColor: typedChartColors.DOWN.primary,
  borderUpColor: typedChartColors.UP.primary,
  borderDownColor: typedChartColors.DOWN.primary,
  upColor: typedChartColors.UP.primary,
  downColor: typedChartColors.DOWN.primary,
  lineColor: '#2962FF',
  areaTopColor: 'rgba(41, 98, 255, 0.3)',
  areaBottomColor: 'rgba(41, 98, 255, 0)',
  baselineTopFillColor1: 'rgba(38, 166, 154, 0.28)',
  baselineTopFillColor2: 'rgba(38, 166, 154, 0.05)',
  baselineBottomFillColor1: 'rgba(239, 83, 80, 0.05)',
  baselineBottomFillColor2: 'rgba(239, 83, 80, 0.28)',
  baselineTopLineColor: 'rgba(38, 166, 154, 1)',
  baselineBottomLineColor: 'rgba(239, 83, 80, 1)',
  rangeUpColor: typedChartColors.UP.primary,
  rangeDownColor: typedChartColors.DOWN.primary,
};

/** Default drawing options */
const DEFAULT_DRAWING_OPTIONS: DrawingDefaults = {
  lineColor: '#2962FF',
  lineWidth: 1,
  lineStyle: 0,
  fillColor: 'rgba(41, 98, 255, 0.2)',
  showLabel: true,
  fontSize: 12,
  fontFamily: 'Trebuchet MS',
  textColor: '#B2B5BE',
};

// ==================== HOOK ====================

/**
 * Custom hook for UI operations
 * @param params - Hook parameters
 * @returns UI handler functions
 */
export const useUIHandlers = ({
  // Panel setters
  setActiveRightPanel,
  setIsSettingsOpen,
  setIsOptionChainOpen,
  setOptionChainInitialSymbol,
  // Chart settings
  setCharts,
  activeChartId,
  chartAppearance,
  setChartAppearance,
  // Timer/session
  setIsTimerVisible,
  setIsSessionBreakVisible,
  // Drawing
  setDrawingDefaults,
  // API settings
  setApiKey,
  setWebsocketUrl,
  setHostUrl,
  setOpenalgoUsername,
  // Toast
  showToast,
}: UseUIHandlersParams): UseUIHandlersReturn => {
  // Right panel toggle
  const handleRightPanelToggle = useCallback(
    (panel: RightPanelType) => {
      setActiveRightPanel(panel);
    },
    [setActiveRightPanel]
  );

  // Settings dialog
  const handleSettingsClick = useCallback(() => {
    setIsSettingsOpen(true);
  }, [setIsSettingsOpen]);

  // Option chain dialog
  const handleOptionChainClick = useCallback(() => {
    setIsOptionChainOpen(true);
  }, [setIsOptionChainOpen]);

  // Option selection from option chain
  const handleOptionSelect = useCallback(
    (symbol: string, exchange: string) => {
      setCharts((prev) =>
        prev.map((chart) => (chart.id === activeChartId ? { ...chart, symbol, exchange } : chart))
      );
      setIsOptionChainOpen(false);
    },
    [activeChartId, setCharts, setIsOptionChainOpen]
  );

  // Open option chain for specific symbol
  const handleOpenOptionChainForSymbol = useCallback(
    (symbol: string, exchange: string) => {
      setOptionChainInitialSymbol({ symbol, exchange });
      setIsOptionChainOpen(true);
    },
    [setOptionChainInitialSymbol, setIsOptionChainOpen]
  );

  // Timer toggle
  const handleTimerToggle = useCallback(() => {
    setIsTimerVisible((prev) => !prev);
  }, [setIsTimerVisible]);

  // Session break toggle
  const handleSessionBreakToggle = useCallback(() => {
    setIsSessionBreakVisible((prev) => !prev);
  }, [setIsSessionBreakVisible]);

  // Chart appearance change
  const handleChartAppearanceChange = useCallback(
    (newAppearance: Partial<ChartAppearance>) => {
      setChartAppearance((prev) => ({ ...prev, ...newAppearance } as ChartAppearance));
    },
    [setChartAppearance]
  );

  // Reset chart appearance
  const handleResetChartAppearance = useCallback(() => {
    setChartAppearance(DEFAULT_CHART_APPEARANCE);
  }, [setChartAppearance]);

  // Drawing property change
  const handleDrawingPropertyChange = useCallback(
    (property: string, value: unknown) => {
      setDrawingDefaults((prev) => ({ ...prev, [property]: value }));
    },
    [setDrawingDefaults]
  );

  // Reset drawing defaults
  const handleResetDrawingDefaults = useCallback(() => {
    setDrawingDefaults(DEFAULT_DRAWING_OPTIONS);
  }, [setDrawingDefaults]);

  // Reset all chart settings
  const handleResetChart = useCallback(() => {
    setChartAppearance(DEFAULT_CHART_APPEARANCE);
    setDrawingDefaults(DEFAULT_DRAWING_OPTIONS);
    showToast('Chart settings reset to default', 'success');
  }, [setChartAppearance, setDrawingDefaults, showToast]);

  // API key save
  const handleApiKeySaveFromSettings = useCallback(
    (newApiKey: string) => {
      setApiKey(newApiKey);
      set(STORAGE_KEYS.OA_API_KEY, newApiKey);
    },
    [setApiKey]
  );

  // WebSocket URL save
  const handleWebsocketUrlSave = useCallback(
    (newUrl: string) => {
      setWebsocketUrl(newUrl);
      set(STORAGE_KEYS.OA_WS_URL, newUrl);
    },
    [setWebsocketUrl]
  );

  // Host URL save
  const handleHostUrlSave = useCallback(
    (newUrl: string) => {
      setHostUrl(newUrl);
      set(STORAGE_KEYS.OA_HOST_URL, newUrl);
    },
    [setHostUrl]
  );

  // Username save
  const handleUsernameSave = useCallback(
    (newUsername: string) => {
      setOpenalgoUsername(newUsername);
      set(STORAGE_KEYS.OA_USERNAME, newUsername);
    },
    [setOpenalgoUsername]
  );

  return {
    handleRightPanelToggle,
    handleSettingsClick,
    handleOptionChainClick,
    handleOptionSelect,
    handleOpenOptionChainForSymbol,
    handleTimerToggle,
    handleSessionBreakToggle,
    handleChartAppearanceChange,
    handleResetChartAppearance,
    handleDrawingPropertyChange,
    handleResetDrawingDefaults,
    handleResetChart,
    handleApiKeySaveFromSettings,
    handleWebsocketUrlSave,
    handleHostUrlSave,
    handleUsernameSave,
  };
};

export default useUIHandlers;
