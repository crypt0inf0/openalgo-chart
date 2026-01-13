/**
 * UI Handlers Hook
 * Manages UI state: panels, dialogs, toggles, and appearance settings
 */

import { useCallback } from 'react';

// Default chart appearance settings
const DEFAULT_CHART_APPEARANCE = {
    wickUpColor: '#089981',
    wickDownColor: '#F23645',
    borderUpColor: '#089981',
    borderDownColor: '#F23645',
    upColor: '#089981',
    downColor: '#F23645',
    lineColor: '#2962FF',
    areaTopColor: 'rgba(41, 98, 255, 0.3)',
    areaBottomColor: 'rgba(41, 98, 255, 0)',
    baselineTopFillColor1: 'rgba(38, 166, 154, 0.28)',
    baselineTopFillColor2: 'rgba(38, 166, 154, 0.05)',
    baselineBottomFillColor1: 'rgba(239, 83, 80, 0.05)',
    baselineBottomFillColor2: 'rgba(239, 83, 80, 0.28)',
    baselineTopLineColor: 'rgba(38, 166, 154, 1)',
    baselineBottomLineColor: 'rgba(239, 83, 80, 1)',
    rangeUpColor: '#089981',
    rangeDownColor: '#F23645'
};

// Default drawing options
const DEFAULT_DRAWING_OPTIONS = {
    lineColor: '#2962FF',
    lineWidth: 1,
    lineStyle: 0,
    fillColor: 'rgba(41, 98, 255, 0.2)',
    showLabel: true,
    fontSize: 12,
    fontFamily: 'Trebuchet MS',
    textColor: '#B2B5BE'
};

/**
 * Custom hook for UI operations
 * @param {Object} params - Hook parameters
 * @returns {Object} UI handler functions
 */
export const useUIHandlers = ({
    // Panel setters
    setActiveRightPanel,
    setUnreadAlertCount,
    setIsSettingsOpen,
    setIsTemplateDialogOpen,
    setIsChartTemplatesOpen,
    setIsOptionChainOpen,
    setOptionChainInitialSymbol,
    // Chart settings
    setChartType,
    setCharts,
    activeChartId,
    activeChart,
    chartType,
    chartAppearance,
    setChartAppearance,
    setLayout,
    setActiveChartId,
    setTheme,
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
    showToast
}) => {
    // Right panel toggle
    const handleRightPanelToggle = useCallback((panel) => {
        setActiveRightPanel(panel);
        if (panel === 'alerts') {
            setUnreadAlertCount(0);
        }
    }, [setActiveRightPanel, setUnreadAlertCount]);

    // Settings dialog
    const handleSettingsClick = useCallback(() => {
        setIsSettingsOpen(true);
    }, [setIsSettingsOpen]);

    // Layout template dialog
    const handleTemplatesClick = useCallback(() => {
        setIsTemplateDialogOpen(true);
    }, [setIsTemplateDialogOpen]);

    // Chart templates dialog
    const handleChartTemplatesClick = useCallback(() => {
        setIsChartTemplatesOpen(true);
    }, [setIsChartTemplatesOpen]);

    // Load chart template (indicators)
    const handleLoadChartTemplate = useCallback((template) => {
        if (!template) return;

        if (template.chartType) {
            setChartType(template.chartType);
        }

        if (template.indicators && Array.isArray(template.indicators)) {
            setCharts(prev => prev.map(chart =>
                chart.id === activeChartId
                    ? { ...chart, indicators: template.indicators }
                    : chart
            ));
        }

        if (template.appearance) {
            setChartAppearance(prev => ({ ...prev, ...template.appearance }));
        }

        showToast(`Loaded template: ${template.name}`, 'success');
    }, [activeChartId, setChartType, setCharts, setChartAppearance, showToast]);

    // Get current chart config for saving
    const getCurrentChartConfig = useCallback(() => {
        return {
            chartType,
            indicators: activeChart?.indicators || [],
            appearance: chartAppearance,
        };
    }, [chartType, activeChart, chartAppearance]);

    // Option chain dialog
    const handleOptionChainClick = useCallback(() => {
        setIsOptionChainOpen(true);
    }, [setIsOptionChainOpen]);

    // Option selection from option chain
    const handleOptionSelect = useCallback((symbol, exchange) => {
        setCharts(prev => prev.map(chart =>
            chart.id === activeChartId ? { ...chart, symbol, exchange } : chart
        ));
        setIsOptionChainOpen(false);
    }, [activeChartId, setCharts, setIsOptionChainOpen]);

    // Open option chain for specific symbol
    const handleOpenOptionChainForSymbol = useCallback((symbol, exchange) => {
        setOptionChainInitialSymbol({ symbol, exchange });
        setIsOptionChainOpen(true);
    }, [setOptionChainInitialSymbol, setIsOptionChainOpen]);

    // Load layout template
    const handleLoadTemplate = useCallback((template) => {
        if (!template) return;

        if (template.layout) {
            setLayout(template.layout);
        }

        if (template.chartType) {
            setChartType(template.chartType);
        }

        if (template.charts && Array.isArray(template.charts)) {
            const defaultIndicators = {
                sma: false,
                ema: false,
                rsi: { enabled: false, period: 14, color: '#7B1FA2' },
                macd: { enabled: false, fast: 12, slow: 26, signal: 9, macdColor: '#2962FF', signalColor: '#FF6D00' },
                bollingerBands: { enabled: false, period: 20, stdDev: 2 },
                volume: { enabled: false, colorUp: '#089981', colorDown: '#F23645' },
                atr: { enabled: false, period: 14, color: '#FF9800' },
                stochastic: { enabled: false, kPeriod: 14, dPeriod: 3, smooth: 3, kColor: '#2962FF', dColor: '#FF6D00' },
                vwap: { enabled: false, color: '#FF9800' },
                supertrend: { enabled: false, period: 10, multiplier: 3 },
                tpo: { enabled: false, blockSize: '30m', tickSize: 'auto' },
                firstCandle: { enabled: false, highlightColor: '#FFD700', highLineColor: '#ef5350', lowLineColor: '#26a69a' },
                priceActionRange: { enabled: false, supportColor: '#26a69a', resistanceColor: '#ef5350' }
            };

            const loadedCharts = template.charts.map((chart, index) => ({
                id: index + 1,
                symbol: chart.symbol || 'RELIANCE',
                exchange: chart.exchange || 'NSE',
                interval: chart.interval || '1d',
                indicators: { ...defaultIndicators, ...chart.indicators },
                comparisonSymbols: chart.comparisonSymbols || [],
            }));

            setCharts(loadedCharts);
            setActiveChartId(1);
        }

        if (template.appearance) {
            if (template.appearance.chartAppearance) {
                setChartAppearance(prev => ({ ...prev, ...template.appearance.chartAppearance }));
            }
            if (template.appearance.theme) {
                setTheme(template.appearance.theme);
            }
        }
    }, [setLayout, setChartType, setCharts, setActiveChartId, setChartAppearance, setTheme]);

    // Timer toggle
    const handleTimerToggle = useCallback(() => {
        setIsTimerVisible(prev => !prev);
    }, [setIsTimerVisible]);

    // Session break toggle
    const handleSessionBreakToggle = useCallback(() => {
        setIsSessionBreakVisible(prev => !prev);
    }, [setIsSessionBreakVisible]);

    // Chart appearance change
    const handleChartAppearanceChange = useCallback((newAppearance) => {
        setChartAppearance(prev => ({ ...prev, ...newAppearance }));
    }, [setChartAppearance]);

    // Reset chart appearance
    const handleResetChartAppearance = useCallback(() => {
        setChartAppearance(DEFAULT_CHART_APPEARANCE);
    }, [setChartAppearance]);

    // Drawing property change
    const handleDrawingPropertyChange = useCallback((property, value) => {
        setDrawingDefaults(prev => ({ ...prev, [property]: value }));
    }, [setDrawingDefaults]);

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
    const handleApiKeySaveFromSettings = useCallback((newApiKey) => {
        setApiKey(newApiKey);
        localStorage.setItem('oa_apikey', newApiKey);
    }, [setApiKey]);

    // WebSocket URL save
    const handleWebsocketUrlSave = useCallback((newUrl) => {
        setWebsocketUrl(newUrl);
        localStorage.setItem('oa_ws_url', newUrl);
    }, [setWebsocketUrl]);

    // Host URL save
    const handleHostUrlSave = useCallback((newUrl) => {
        setHostUrl(newUrl);
        localStorage.setItem('oa_host_url', newUrl);
    }, [setHostUrl]);

    // Username save
    const handleUsernameSave = useCallback((newUsername) => {
        setOpenalgoUsername(newUsername);
        localStorage.setItem('oa_username', newUsername);
    }, [setOpenalgoUsername]);

    return {
        handleRightPanelToggle,
        handleSettingsClick,
        handleTemplatesClick,
        handleChartTemplatesClick,
        handleLoadChartTemplate,
        getCurrentChartConfig,
        handleOptionChainClick,
        handleOptionSelect,
        handleOpenOptionChainForSymbol,
        handleLoadTemplate,
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
        handleUsernameSave
    };
};

export default useUIHandlers;
