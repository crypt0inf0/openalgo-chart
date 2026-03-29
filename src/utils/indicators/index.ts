/**
 * Indicators Module
 * Central export point for all technical indicators
 */

// Type exports
export * from './types';

// Moving Averages
export { calculateSMA } from './sma';
export { calculateEMA } from './ema';

// Oscillators
export { calculateRSI } from './rsi';
export { calculateStochastic } from './stochastic';

// Momentum
export { calculateMACD } from './macd';

// Volatility
export { calculateBollingerBands } from './bollingerBands';
export { calculateATR } from './atr';

// Trend
export { calculateSupertrend } from './supertrend';

// Volume
export { calculateVolume, calculateVolumeMA, calculateEnhancedVolume } from './volume';
export { calculateVWAP, calculateBuyVWAP, calculateSellVWAP, calculateAnchoredVWAP, calculateVWAPBands, calculateAllVWAPs } from './vwap';

// Market Profile
export { calculateTPO, tpoToRenderData, getTPOStats } from './tpo';

// First Red Candle Strategy
export { calculateFirstCandle, getLatestFirstCandle } from './firstCandle';

// Price Action Range Strategy
export { calculatePriceActionRange, getLatestPriceActionRange } from './priceActionRange';

// Range Breakout Strategy (Opening Range 9:30-10:00)
export { calculateRangeBreakout, getLatestRangeBreakout } from './rangeBreakout';

// ANN Strategy (Artificial Neural Network)
export { calculateANNStrategy, getLatestANNSignal } from './annStrategy';

// Hilenga-Milenga Indicator
export { calculateHilengaMilenga, getLatestHilengaMilenga } from './hilengaMilenga';

// ADX - Trend Strength
export { calculateADX } from './avg_directional_index';

// Ichimoku Cloud
export { calculateIchimoku, getCloudData } from './ichimoku';

// Pivot Points
export { calculatePivotPoints } from './pivotPoints';

// Red Candle Zones
export { calculateRedCandleZones } from './redCandleZones';

// Market Bias
export { calculateMarketBias } from './marketBias';
export type { MarketBiasResult } from './marketBias';

// SR Volume Boxes
export { calculateSRVolumeBoxes } from './srVolumeBoxes';
export type { SRVolumeBoxesResult, SRBox } from './srVolumeBoxes';

// Time Utilities (IST market hours, time windows)
export * from './timeUtils';

// TPO Calculations
export * from './tpoCalculations';

// TPO Renderer
export * from './tpoRenderer';

// Risk Calculator
export {
    calculateRiskPosition,
    autoDetectSide,
    validateRiskParams,
    validateRiskParamsDetailed
} from './riskCalculator';
export type {
    TradeSide,
    RiskCalculationParams,
    RiskCalculationSuccess,
    RiskCalculationError,
    RiskCalculationResult,
    FormattedRiskResult,
    RiskValidationParams,
    RiskValidationResult,
    DetailedValidationErrors,
    DetailedValidationResult
} from './riskCalculator';

// Risk Calculator Chart
export {
    createRiskCalculatorPrimitive,
    removeRiskCalculatorPrimitive,
    initRiskCalculatorPrimitiveRef,
    updateRiskCalculatorLines,
    removeRiskCalculatorLines,
    initRiskCalculatorLinesRef
} from './riskCalculatorChart';
export type {
    RiskCalculatorColors,
    RiskCalculatorSettings,
    CreatePrimitiveParams,
    RemovePrimitiveParams,
    PrimitiveRef,
    LinesRef
} from './riskCalculatorChart';
