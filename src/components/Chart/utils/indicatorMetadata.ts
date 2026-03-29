/**
 * Indicator Metadata Registry
 *
 * Central registry defining cleanup requirements and characteristics for all indicators.
 * This metadata is used by the unified cleanup engine to properly remove indicators
 * and their associated resources (series, panes, price lines, primitives).
 */

import logger from '../../../utils/logger';

/**
 * Cleanup type constants defining how each indicator should be cleaned up
 */
export const INDICATOR_CLEANUP_TYPES = {
  SIMPLE_SERIES: 'simple_series',       // Single series (SMA, EMA, VWAP, ATR, etc.)
  MULTI_SERIES: 'multi_series',         // Multiple series in one object (MACD, Bollinger, etc.)
  SERIES_ARRAY: 'series_array',         // Array of series (First Candle, Range Breakout, PAR)
  PRIMITIVE: 'primitive',               // Attached primitives (TPO, Risk Calculator)
  COMPLEX: 'complex'                    // Complex with multiple cleanup steps
} as const;

export type IndicatorCleanupType = typeof INDICATOR_CLEANUP_TYPES[keyof typeof INDICATOR_CLEANUP_TYPES];

export interface IndicatorMetadata {
  cleanupType: IndicatorCleanupType;
  pane: string;
  hasPane: boolean;
  hasPriceLines?: boolean;
  priceLineKeys?: string[];
  seriesKeys?: string[];
  hasPrimitive?: boolean;
  primitiveRef?: string;
  attachedTo?: string;
  arrayRef?: string;
  hasMarkers?: boolean;
  description: string;
}

/**
 * Main indicator metadata registry
 * Each indicator type defines its cleanup requirements and characteristics
 */
export const INDICATOR_REGISTRY: Record<string, IndicatorMetadata> = {
  // ==================== SIMPLE OVERLAYS ====================
  sma: {
    cleanupType: INDICATOR_CLEANUP_TYPES.SIMPLE_SERIES,
    pane: 'main',
    hasPane: false,
    hasPriceLines: false,
    description: 'Simple Moving Average'
  },

  ema: {
    cleanupType: INDICATOR_CLEANUP_TYPES.SIMPLE_SERIES,
    pane: 'main',
    hasPane: false,
    hasPriceLines: false,
    description: 'Exponential Moving Average'
  },

  vwap: {
    cleanupType: INDICATOR_CLEANUP_TYPES.SIMPLE_SERIES,
    pane: 'main',
    hasPane: false,
    hasPriceLines: false,
    description: 'Volume Weighted Average Price'
  },

  supertrend: {
    cleanupType: INDICATOR_CLEANUP_TYPES.SIMPLE_SERIES,
    pane: 'main',
    hasPane: false,
    hasPriceLines: false,
    description: 'Supertrend Indicator'
  },

  volume: {
    cleanupType: INDICATOR_CLEANUP_TYPES.SIMPLE_SERIES,
    pane: 'main',
    hasPane: false,
    hasPriceLines: false,
    description: 'Volume Bars'
  },

  // ==================== MULTI-SERIES OVERLAYS ====================
  bollingerBands: {
    cleanupType: INDICATOR_CLEANUP_TYPES.MULTI_SERIES,
    pane: 'main',
    hasPane: false,
    hasPriceLines: false,
    seriesKeys: ['basis', 'upper', 'lower'],
    description: 'Bollinger Bands'
  },

  ichimoku: {
    cleanupType: INDICATOR_CLEANUP_TYPES.MULTI_SERIES,
    pane: 'main',
    hasPane: false,
    hasPriceLines: false,
    seriesKeys: ['tenkan', 'kijun', 'senkouA', 'senkouB', 'chikou'],
    description: 'Ichimoku Cloud'
  },

  pivotPoints: {
    cleanupType: INDICATOR_CLEANUP_TYPES.MULTI_SERIES,
    pane: 'main',
    hasPane: false,
    hasPriceLines: false,
    seriesKeys: ['pivot', 'r1', 'r2', 'r3', 's1', 's2', 's3'],
    description: 'Pivot Points'
  },

  // ==================== OSCILLATORS WITH PANES ====================
  rsi: {
    cleanupType: INDICATOR_CLEANUP_TYPES.SIMPLE_SERIES,
    pane: 'rsi',
    hasPane: true,
    hasPriceLines: true,
    priceLineKeys: ['_obLine', '_osLine'],
    description: 'Relative Strength Index'
  },

  stochastic: {
    cleanupType: INDICATOR_CLEANUP_TYPES.MULTI_SERIES,
    pane: 'stochastic',
    hasPane: true,
    hasPriceLines: false,
    seriesKeys: ['kLine', 'dLine'],
    description: 'Stochastic Oscillator'
  },

  macd: {
    cleanupType: INDICATOR_CLEANUP_TYPES.MULTI_SERIES,
    pane: 'macd',
    hasPane: true,
    hasPriceLines: false,
    seriesKeys: ['macdLine', 'signalLine', 'histogram'],
    description: 'Moving Average Convergence Divergence'
  },

  atr: {
    cleanupType: INDICATOR_CLEANUP_TYPES.SIMPLE_SERIES,
    pane: 'atr',
    hasPane: true,
    hasPriceLines: false,
    description: 'Average True Range'
  },

  adx: {
    cleanupType: INDICATOR_CLEANUP_TYPES.MULTI_SERIES,
    pane: 'adx',
    hasPane: true,
    hasPriceLines: true,
    priceLineKeys: ['_strongTrendLine', '_weakTrendLine'],
    seriesKeys: ['adxLine', 'plusDILine', 'minusDILine'],
    description: 'Average Directional Index'
  },

  // ==================== COMPLEX STRATEGIES ====================
  annStrategy: {
    cleanupType: INDICATOR_CLEANUP_TYPES.MULTI_SERIES,
    pane: 'ann',
    hasPane: true,
    hasPriceLines: true,
    priceLineKeys: ['_thresholdLine', '_zeroLine'],
    seriesKeys: ['predictionLine', 'areaFill'],
    hasMarkers: true,
    description: 'Artificial Neural Network Strategy'
  },

  hilengaMilenga: {
    cleanupType: INDICATOR_CLEANUP_TYPES.MULTI_SERIES,
    pane: 'hilengaMilenga',
    hasPane: true,
    hasPriceLines: true,
    priceLineKeys: ['_midLine'],
    seriesKeys: ['rsiLine', 'emaLine', 'wmaLine', 'bullFill', 'bearFill'],
    description: 'Hilenga-Milenga Oscillator'
  },

  // ==================== PRIMITIVES ====================
  tpo: {
    cleanupType: INDICATOR_CLEANUP_TYPES.PRIMITIVE,
    pane: 'main',
    hasPane: false,
    hasPrimitive: true,
    primitiveRef: 'tpoProfileRef',
    attachedTo: 'main',
    description: 'Time Price Opportunity (TPO) Profile'
  },

  riskCalculator: {
    cleanupType: INDICATOR_CLEANUP_TYPES.PRIMITIVE,
    pane: 'main',
    hasPane: false,
    hasPrimitive: true,
    primitiveRef: 'riskCalculatorPrimitiveRef',
    attachedTo: 'main',
    hasPriceLines: false,
    description: 'Risk Calculator with Position Sizing'
  },

  // ==================== ARRAY-BASED STRATEGIES ====================
  firstCandle: {
    cleanupType: INDICATOR_CLEANUP_TYPES.SERIES_ARRAY,
    pane: 'main',
    hasPane: false,
    arrayRef: 'firstCandleSeriesRef',
    hasMarkers: true,
    description: 'First Red Candle Strategy'
  },

  rangeBreakout: {
    cleanupType: INDICATOR_CLEANUP_TYPES.SERIES_ARRAY,
    pane: 'main',
    hasPane: false,
    arrayRef: 'rangeBreakoutSeriesRef',
    hasMarkers: true,
    description: 'Opening Range Breakout Strategy'
  },

  priceActionRange: {
    cleanupType: INDICATOR_CLEANUP_TYPES.SERIES_ARRAY,
    pane: 'main',
    hasPane: false,
    arrayRef: 'priceActionRangeSeriesRef',
    hasMarkers: true,
    description: 'Price Action Range Strategy'
  },

  cpr: {
    cleanupType: INDICATOR_CLEANUP_TYPES.SERIES_ARRAY,
    pane: 'main',
    hasPane: false,
    arrayRef: 'cprSeriesRef',
    description: 'Central Pivot Range (Pivot, BC, TC)'
  },

  // ==================== PINE SCRIPT ====================
  pine: {
    cleanupType: INDICATOR_CLEANUP_TYPES.SIMPLE_SERIES,
    pane: 'dynamic', // Can be 'main' or separate pane depending on indicator
    hasPane: true,   // May have separate pane for non-overlay indicators
    hasPriceLines: false,
    description: 'Pine Script Custom Indicator'
  }
};

/**
 * Get metadata for a specific indicator type
 */
export function getIndicatorMetadata(indicatorType: string): IndicatorMetadata | null {
  return INDICATOR_REGISTRY[indicatorType] || null;
}

/**
 * Check if an indicator type exists in the registry
 */
export function isValidIndicatorType(indicatorType: string): boolean {
  return indicatorType in INDICATOR_REGISTRY;
}

/**
 * Get all indicators of a specific cleanup type
 */
export function getIndicatorsByCleanupType(cleanupType: IndicatorCleanupType): string[] {
  return Object.keys(INDICATOR_REGISTRY).filter(
    key => INDICATOR_REGISTRY[key].cleanupType === cleanupType
  );
}

/**
 * Get all indicators that have a separate pane
 */
export function getIndicatorsWithPane(): string[] {
  return Object.keys(INDICATOR_REGISTRY).filter(
    key => INDICATOR_REGISTRY[key].hasPane === true
  );
}

/**
 * Get all indicators that have price lines
 */
export function getIndicatorsWithPriceLines(): string[] {
  return Object.keys(INDICATOR_REGISTRY).filter(
    key => INDICATOR_REGISTRY[key].hasPriceLines === true
  );
}

/**
 * Get all indicators that use primitives
 */
export function getIndicatorsWithPrimitives(): string[] {
  return Object.keys(INDICATOR_REGISTRY).filter(
    key => INDICATOR_REGISTRY[key].hasPrimitive === true
  );
}

/**
 * Get all indicators that use array-based series
 */
export function getArrayBasedIndicators(): string[] {
  return Object.keys(INDICATOR_REGISTRY).filter(
    key => INDICATOR_REGISTRY[key].cleanupType === INDICATOR_CLEANUP_TYPES.SERIES_ARRAY
  );
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  totalIndicators: number;
}

/**
 * Validate that all required metadata fields are present
 * Useful for development/testing
 */
export function validateMetadataRegistry(): ValidationResult {
  const errors: string[] = [];

  Object.keys(INDICATOR_REGISTRY).forEach(type => {
    const metadata = INDICATOR_REGISTRY[type];

    // Required fields
    if (!metadata.cleanupType) {
      errors.push(`${type}: Missing cleanupType`);
    }
    if (!metadata.pane) {
      errors.push(`${type}: Missing pane`);
    }
    if (metadata.hasPane === undefined) {
      errors.push(`${type}: Missing hasPane`);
    }

    // Conditional fields based on cleanup type
    if (metadata.cleanupType === INDICATOR_CLEANUP_TYPES.MULTI_SERIES && !metadata.seriesKeys) {
      errors.push(`${type}: Multi-series indicator missing seriesKeys`);
    }
    if (metadata.cleanupType === INDICATOR_CLEANUP_TYPES.SERIES_ARRAY && !metadata.arrayRef) {
      errors.push(`${type}: Array-based indicator missing arrayRef`);
    }
    if (metadata.cleanupType === INDICATOR_CLEANUP_TYPES.PRIMITIVE && !metadata.primitiveRef) {
      errors.push(`${type}: Primitive indicator missing primitiveRef`);
    }
    if (metadata.hasPriceLines && !metadata.priceLineKeys) {
      errors.push(`${type}: Has price lines but missing priceLineKeys`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    totalIndicators: Object.keys(INDICATOR_REGISTRY).length
  };
}

// Auto-validate in development
if (process.env.NODE_ENV === 'development') {
  const validation = validateMetadataRegistry();
  if (!validation.valid) {
    logger.warn('Indicator Metadata Registry Validation Errors:', validation.errors);
  }
}
