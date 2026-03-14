/**
 * Indicator Data Manager
 * Manages indicator calculations and data caching for alert evaluation
 */

import {
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateStochastic,
  calculateSupertrend,
  calculateVWAP,
  calculateSMA,
  calculateEMA,
  calculateATR,
} from '../utils/indicators';
import { calculateUTBotAlerts } from '../utils/indicators/utBotAlerts';
import logger from '../utils/logger';

// ==================== TYPES ====================

/** OHLC candle data */
interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | undefined;
}

/** RSI indicator config */
interface RSIConfig {
  enabled?: boolean | undefined;
  period?: number | undefined;
}

/** MACD indicator config */
interface MACDConfig {
  enabled?: boolean | undefined;
  fast?: number | undefined;
  slow?: number | undefined;
  signal?: number | undefined;
}

/** Bollinger Bands config */
interface BollingerBandsConfig {
  enabled?: boolean | undefined;
  period?: number | undefined;
  stdDev?: number | undefined;
}

/** Stochastic config */
interface StochasticConfig {
  enabled?: boolean | undefined;
  kPeriod?: number | undefined;
  dPeriod?: number | undefined;
  smooth?: number | undefined;
}

/** Supertrend config */
interface SupertrendConfig {
  enabled?: boolean | undefined;
  period?: number | undefined;
  multiplier?: number | undefined;
}

/** VWAP config */
interface VWAPConfig {
  enabled?: boolean | undefined;
}

/** SMA config */
interface SMAConfig {
  period?: number | undefined;
}

/** EMA config */
interface EMAConfig {
  period?: number | undefined;
}

/** ATR config */
interface ATRConfig {
  enabled?: boolean | undefined;
  period?: number | undefined;
}

/** Indicators configuration */
interface IndicatorsConfig {
  rsi?: RSIConfig | undefined;
  macd?: MACDConfig | undefined;
  bollingerBands?: BollingerBandsConfig | undefined;
  stochastic?: StochasticConfig | undefined;
  supertrend?: SupertrendConfig | undefined;
  vwap?: VWAPConfig | undefined;
  sma?: SMAConfig | undefined;
  ema?: EMAConfig | undefined;
  atr?: ATRConfig | undefined;
  utBotAlerts?: { keyValues?: number; atrPeriod?: number } | undefined;
}

/** RSI data point */
interface RSIDataPoint {
  time: number;
  value: number;
}

/** MACD data point */
interface MACDDataPoint {
  time: number;
  MACD: number;
  signal: number;
  histogram: number;
}

/** Bollinger Bands data point */
interface BollingerDataPoint {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

/** Stochastic data point */
interface StochasticDataPoint {
  time: number;
  k: number;
  d: number;
}

/** Supertrend data point */
interface SupertrendDataPoint {
  time: number;
  supertrend: number;
  direction: number;
}

/** VWAP data point */
interface VWAPDataPoint {
  time: number;
  value: number;
}

/** Simple value data point */
interface ValueDataPoint {
  time: number;
  value: number;
}

/** RSI result */
interface RSIResult {
  value: number | undefined;
  previous: number | undefined;
  time: number | undefined;
}

/** MACD result */
interface MACDResult {
  macd: number | undefined;
  signal: number | undefined;
  histogram: number | undefined;
  previous: {
    macd: number | undefined;
    signal: number | undefined;
    histogram: number | undefined;
    previous?: {
      macd: number | undefined;
      signal: number | undefined;
      histogram: number | undefined;
    };
  };
  time: number | undefined;
}

/** Bollinger Bands result */
interface BollingerResult {
  upper: number | undefined;
  middle: number | undefined;
  lower: number | undefined;
  previous: {
    upper: number | undefined;
    middle: number | undefined;
    lower: number | undefined;
  };
  time: number | undefined;
}

/** Stochastic result */
interface StochasticResult {
  k: number | undefined;
  d: number | undefined;
  previous: {
    k: number | undefined;
    d: number | undefined;
  };
  time: number | undefined;
}

/** Supertrend result */
interface SupertrendResult {
  supertrend: number | undefined;
  direction: number | undefined;
  previous: {
    supertrend: number | undefined;
    direction: number | undefined;
  };
  time: number | undefined;
}

/** VWAP result */
interface VWAPResult {
  value: number | undefined;
  previous: number | undefined;
  time: number | undefined;
}

/** Simple value result */
interface ValueResult {
  value: number | undefined;
  previous: number | undefined;
  time: number | undefined;
}

/** All indicators result */
interface IndicatorResults {
  rsi?: RSIResult | undefined;
  macd?: MACDResult | undefined;
  bollingerBands?: BollingerResult | undefined;
  stochastic?: StochasticResult | undefined;
  supertrend?: SupertrendResult | undefined;
  vwap?: VWAPResult | undefined;
  sma?: ValueResult | undefined;
  ema?: ValueResult | undefined;
  atr?: ValueResult | undefined;
  utBotAlerts?: any | undefined;
}

/** Cache entry */
interface CacheEntry {
  timestamp: number;
  indicators: IndicatorResults;
  ohlcData: Candle[];
}

/** Worker message */
interface WorkerMessage {
  id: string;
  success: boolean;
  result: unknown;
  error?: string | undefined;
  type?: string | undefined;
}

/** Worker promise handlers */
interface WorkerPromiseHandlers {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

/** Indicator context */
interface IndicatorContext {
  symbol: string;
  exchange: string;
  interval: string;
}

/** Current/previous indicator value */
interface IndicatorValue {
  current: Record<string, unknown> | null;
  previous: Record<string, unknown> | null;
}

export class IndicatorDataManager {
  /**
   * Cache for indicator values per symbol-interval
   */
  private cache: Map<string, CacheEntry>;

  /**
   * Cache duration in milliseconds (30 seconds)
   */
  private cacheDuration: number;

  /**
   * Max history length to send to worker
   */
  private MAX_HISTORY_LENGTH: number;

  /**
   * Web Worker instance
   */
  private worker: Worker | null;
  private workerPromiseMap: Map<string, WorkerPromiseHandlers>;

  constructor() {
    this.cache = new Map();
    this.cacheDuration = 30000;
    this.MAX_HISTORY_LENGTH = 2000;
    this.worker = null;
    this.workerPromiseMap = new Map();

    this.initWorker();
  }

  /**
   * Initialize Web Worker
   */
  initWorker(): void {
    if (typeof Worker !== 'undefined') {
      try {
        // Vite worker import syntax
        this.worker = new Worker(new URL('../workers/indicatorWorker.js', import.meta.url), {
          type: 'module',
        });

        this.worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
          const { id, success, result, error, type } = event.data;

          if (id && this.workerPromiseMap.has(id)) {
            const handlers = this.workerPromiseMap.get(id);
            if (handlers) {
              this.workerPromiseMap.delete(id);

              if (success) {
                handlers.resolve(result);
              } else {
                handlers.reject(new Error(error || 'Worker error'));
              }
            }
          } else if (type === 'ready') {
            logger.info('[IndicatorDataManager] Worker ready');
          }
        };

        this.worker.onerror = (error: ErrorEvent) => {
          logger.error('[IndicatorDataManager] Worker error:', error);
        };
      } catch (e) {
        logger.error('[IndicatorDataManager] Failed to initialize worker:', e);
      }
    }
  }

  /**
   * Terminate worker
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * Get cache key for a symbol-interval combination
   */
  getCacheKey(symbol: string, exchange: string, interval: string): string {
    return `${symbol}:${exchange}:${interval}`;
  }

  /**
   * Get current indicator values for a symbol
   */
  getIndicatorValues(
    symbol: string,
    exchange: string,
    interval: string,
    indicators: IndicatorsConfig,
    ohlcData: Candle[]
  ): IndicatorResults {
    const cacheKey = this.getCacheKey(symbol, exchange, interval);

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.indicators;
    }

    // OPTIMIZATION: Slice data for main thread calculation too
    const slicedData =
      ohlcData.length > this.MAX_HISTORY_LENGTH
        ? ohlcData.slice(-this.MAX_HISTORY_LENGTH)
        : ohlcData;

    const indicatorData = this.calculateAllIndicators(indicators, slicedData);

    // Cache the results
    this.cache.set(cacheKey, {
      timestamp: Date.now(),
      indicators: indicatorData,
      ohlcData: ohlcData.slice(-2), // Keep last 2 bars for comparison
    });

    return indicatorData;
  }

  /**
   * Calculate all active indicators (Main Thread - Sync)
   */
  calculateAllIndicators(indicators: IndicatorsConfig, ohlcData: Candle[]): IndicatorResults {
    if (!ohlcData || ohlcData.length < 2) {
      return {};
    }

    const results: IndicatorResults = {};

    // RSI
    if (indicators.rsi?.enabled) {
      const rsiData = calculateRSI(ohlcData, indicators.rsi.period || 14) as RSIDataPoint[] | null;
      if (rsiData && rsiData.length >= 2) {
        const latest = rsiData[rsiData.length - 1];
        const previous = rsiData[rsiData.length - 2];
        results.rsi = {
          value: latest?.value,
          previous: previous?.value,
          time: latest?.time,
        };
      }
    }

    // MACD
    if (indicators.macd?.enabled) {
      const macdData = calculateMACD(
        ohlcData,
        indicators.macd.fast || 12,
        indicators.macd.slow || 26,
        indicators.macd.signal || 9
      ) as any | null;
      if (macdData && macdData.length >= 2) {
        const latest = macdData[macdData.length - 1];
        const previous = macdData[macdData.length - 2];
        results.macd = {
          macd: latest?.MACD,
          signal: latest?.signal,
          histogram: latest?.histogram,
          previous: {
            macd: previous?.MACD,
            signal: previous?.signal,
            histogram: previous?.histogram,
            previous: {
              macd: previous?.MACD,
              signal: previous?.signal,
              histogram: previous?.histogram,
            },
          },
          time: latest?.time,
        };
      }
    }

    // Bollinger Bands
    if (indicators.bollingerBands?.enabled) {
      const bbData = calculateBollingerBands(
        ohlcData,
        indicators.bollingerBands.period || 20,
        indicators.bollingerBands.stdDev || 2
      ) as any | null;
      if (bbData && bbData.length >= 2) {
        const latest = bbData[bbData.length - 1];
        const previous = bbData[bbData.length - 2];
        results.bollingerBands = {
          upper: latest?.upper,
          middle: latest?.middle,
          lower: latest?.lower,
          previous: {
            upper: previous?.upper,
            middle: previous?.middle,
            lower: previous?.lower,
          },
          time: latest?.time,
        };
      }
    }

    // Stochastic
    if (indicators.stochastic?.enabled) {
      const stochData = calculateStochastic(
        ohlcData,
        indicators.stochastic.kPeriod || 14,
        indicators.stochastic.dPeriod || 3,
        indicators.stochastic.smooth || 3
      ) as any | null;
      if (stochData && stochData.length >= 2) {
        const latest = stochData[stochData.length - 1];
        const previous = stochData[stochData.length - 2];
        results.stochastic = {
          k: latest?.k,
          d: latest?.d,
          previous: {
            k: previous?.k,
            d: previous?.d,
          },
          time: latest?.time,
        };
      }
    }

    // Supertrend
    if (indicators.supertrend?.enabled) {
      const supertrendData = calculateSupertrend(
        ohlcData,
        indicators.supertrend.period || 10,
        indicators.supertrend.multiplier || 3
      ) as any | null;
      if (supertrendData && supertrendData.length >= 2) {
        const latest = supertrendData[supertrendData.length - 1];
        const previous = supertrendData[supertrendData.length - 2];
        results.supertrend = {
          supertrend: latest?.supertrend,
          direction: latest?.direction,
          previous: {
            supertrend: previous?.supertrend,
            direction: previous?.direction,
          },
          time: latest?.time,
        };
      }
    }

    // VWAP
    if (indicators.vwap?.enabled) {
      const vwapData = calculateVWAP(ohlcData) as VWAPDataPoint[] | null;
      if (vwapData && vwapData.length >= 2) {
        const latest = vwapData[vwapData.length - 1];
        const previous = vwapData[vwapData.length - 2];
        results.vwap = {
          value: latest?.value,
          previous: previous?.value,
          time: latest?.time,
        };
      }
    }

    // SMA
    if (indicators.sma) {
      const smaData = calculateSMA(ohlcData, indicators.sma.period || 20) as ValueDataPoint[] | null;
      if (smaData && smaData.length >= 2) {
        const latest = smaData[smaData.length - 1];
        const previous = smaData[smaData.length - 2];
        results.sma = {
          value: latest?.value,
          previous: previous?.value,
          time: latest?.time,
        };
      }
    }

    // EMA
    if (indicators.ema) {
      const emaData = calculateEMA(ohlcData, indicators.ema.period || 20) as ValueDataPoint[] | null;
      if (emaData && emaData.length >= 2) {
        const latest = emaData[emaData.length - 1];
        const previous = emaData[emaData.length - 2];
        results.ema = {
          value: latest?.value,
          previous: previous?.value,
          time: latest?.time,
        };
      }
    }

    // ATR
    if (indicators.atr?.enabled) {
      const atrData = calculateATR(ohlcData, indicators.atr.period || 14) as ValueDataPoint[] | null;
      if (atrData && atrData.length >= 2) {
        const latest = atrData[atrData.length - 1];
        const previous = atrData[atrData.length - 2];
        results.atr = {
          value: latest?.value,
          previous: previous?.value,
          time: latest?.time,
        };
      }
    }

    // UT Bot Alerts
    if (indicators.utBotAlerts) {
      const utBotData = calculateUTBotAlerts(
        ohlcData as any,
        indicators.utBotAlerts.keyValues || 1,
        indicators.utBotAlerts.atrPeriod || 10
      );
      if (utBotData && utBotData.length >= 2) {
        const latest = utBotData[utBotData.length - 1];
        const previous = utBotData[utBotData.length - 2];
        results.utBotAlerts = {
          buy: latest?.buy,
          sell: latest?.sell,
          trailingStop: latest?.trailingStop,
          previous: {
            buy: previous?.buy,
            sell: previous?.sell,
            trailingStop: previous?.trailingStop,
          },
          time: latest?.time,
        };
      }
    }

    return results;
  }

  /**
   * Run calculation on worker
   */
  runWorkerTask(
    type: string,
    data: Candle[],
    options: Record<string, number> = {}
  ): Promise<unknown> {
    if (!this.worker) return Promise.reject(new Error('Worker not initialized'));

    const id = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      this.workerPromiseMap.set(id, { resolve, reject });

      // Timeout safety
      setTimeout(() => {
        if (this.workerPromiseMap.has(id)) {
          this.workerPromiseMap.delete(id);
          reject(new Error('Worker task timed out'));
        }
      }, 10000); // 10s timeout

      this.worker!.postMessage({ type, id, data, options });
    });
  }

  /**
   * Calculate a specific indicator for alert evaluation (Async - Worker optimized)
   */
  async calculateIndicator(
    indicatorId: string,
    _context: IndicatorContext,
    ohlcData: Candle[]
  ): Promise<IndicatorValue | null> {
    if (!indicatorId || !ohlcData || !Array.isArray(ohlcData) || ohlcData.length < 2) {
      logger.warn(`[IndicatorDataManager] Invalid parameters for calculateIndicator: ${indicatorId}`);
      return null;
    }

    try {
      // Slice data for performance
      const slicedData =
        ohlcData.length > this.MAX_HISTORY_LENGTH
          ? ohlcData.slice(-this.MAX_HISTORY_LENGTH)
          : ohlcData;

      let current: Record<string, unknown> | null = null;
      let previous: Record<string, unknown> | null = null;

      let workerResult: unknown = null;
      const type = indicatorId.toLowerCase();

      switch (type) {
        case 'rsi': {
          workerResult = await this.runWorkerTask('rsi', slicedData, { period: 14 });
          const rsiResult = workerResult as ValueDataPoint[] | null;
          if (rsiResult && rsiResult.length >= 2) {
            const latest = rsiResult[rsiResult.length - 1];
            const prev = rsiResult[rsiResult.length - 2];
            current = { value: latest?.value, time: latest?.time };
            previous = { value: prev?.value, time: prev?.time };
          }
          break;
        }

        case 'macd': {
          workerResult = await this.runWorkerTask('macd', slicedData, {
            fast: 12,
            slow: 26,
            signal: 9,
          });
          const macdResult = workerResult as any | null;
          if (macdResult && macdResult.length >= 2) {
            const latest = macdResult[macdResult.length - 1];
            const prev = macdResult[macdResult.length - 2];
            current = {
              macd: latest?.MACD,
              signal: latest?.signal,
              histogram: latest?.histogram,
              time: latest?.time,
            };
            previous = {
              macd: prev?.MACD,
              signal: prev?.signal,
              histogram: prev?.histogram,
              time: prev?.time,
            };
          }
          break;
        }

        case 'bollingerbands':
        case 'bollinger': {
          workerResult = await this.runWorkerTask('bollingerBands', slicedData, {
            period: 20,
            stdDev: 2,
          });
          const bbResult = workerResult as any | null;
          if (bbResult && bbResult.length >= 2) {
            const latest = bbResult[bbResult.length - 1];
            const prev = bbResult[bbResult.length - 2];
            current = {
              upper: latest?.upper,
              middle: latest?.middle,
              lower: latest?.lower,
              time: latest?.time,
            };
            previous = {
              upper: prev?.upper,
              middle: prev?.middle,
              lower: prev?.lower,
              time: prev?.time,
            };
          }
          break;
        }

        case 'stochastic': {
          workerResult = await this.runWorkerTask('stochastic', slicedData, {
            kPeriod: 14,
            dPeriod: 3,
            smooth: 3,
          });
          const stochResult = workerResult as any | null;
          if (stochResult && stochResult.length >= 2) {
            const latest = stochResult[stochResult.length - 1];
            const prev = stochResult[stochResult.length - 2];
            current = { k: latest?.k, d: latest?.d, time: latest?.time };
            previous = { k: prev?.k, d: prev?.d, time: prev?.time };
          }
          break;
        }

        case 'supertrend': {
          workerResult = await this.runWorkerTask('supertrend', slicedData, {
            period: 10,
            multiplier: 3,
          });
          const stResult = workerResult as any | null;
          if (stResult && stResult.length >= 2) {
            const latest = stResult[stResult.length - 1];
            const prev = stResult[stResult.length - 2];
            current = {
              supertrend: latest?.supertrend,
              direction: latest?.direction,
              time: latest?.time,
            };
            previous = {
              supertrend: prev?.supertrend,
              direction: prev?.direction,
              time: prev?.time,
            };
          }
          break;
        }

        case 'vwap': {
          workerResult = await this.runWorkerTask('vwap', slicedData);
          const vwapResult = workerResult as VWAPDataPoint[] | null;
          if (vwapResult && vwapResult.length >= 2) {
            const latest = vwapResult[vwapResult.length - 1];
            const prev = vwapResult[vwapResult.length - 2];
            current = { value: latest?.value, time: latest?.time };
            previous = { value: prev?.value, time: prev?.time };
          }
          break;
        }

        case 'sma': {
          workerResult = await this.runWorkerTask('sma', slicedData, { period: 20 });
          const smaResult = workerResult as ValueDataPoint[] | null;
          if (smaResult && smaResult.length >= 2) {
            const latest = smaResult[smaResult.length - 1];
            const prev = smaResult[smaResult.length - 2];
            current = { value: latest?.value, time: latest?.time };
            previous = { value: prev?.value, time: prev?.time };
          }
          break;
        }

        case 'ema': {
          workerResult = await this.runWorkerTask('ema', slicedData, { period: 20 });
          const emaResult = workerResult as ValueDataPoint[] | null;
          if (emaResult && emaResult.length >= 2) {
            const latest = emaResult[emaResult.length - 1];
            const prev = emaResult[emaResult.length - 2];
            current = { value: latest?.value, time: latest?.time };
            previous = { value: prev?.value, time: prev?.time };
          }
          break;
        }

        case 'atr': {
          workerResult = await this.runWorkerTask('atr', slicedData, { period: 14 });
          const atrResult = workerResult as ValueDataPoint[] | null;
          if (atrResult && atrResult.length >= 2) {
            const latest = atrResult[atrResult.length - 1];
            const prev = atrResult[atrResult.length - 2];
            current = { value: latest?.value, time: latest?.time };
            previous = { value: prev?.value, time: prev?.time };
          }
          break;
        }

        case 'utbotalerts': {
          // Main thread execution for smaller indicators works perfectly fine
          const utBotResult = calculateUTBotAlerts(slicedData as any, 1, 10);
          if (utBotResult && utBotResult.length >= 2) {
            const latest = utBotResult[utBotResult.length - 1];
            const prev = utBotResult[utBotResult.length - 2];
            current = {
                buy: latest?.buy,
                sell: latest?.sell,
                trailingStop: latest?.trailingStop,
                time: latest?.time
            };
            previous = {
                buy: prev?.buy,
                sell: prev?.sell,
                trailingStop: prev?.trailingStop,
                time: prev?.time
            };
          }
          break;
        }

        default:
          logger.warn(`[IndicatorDataManager] Unknown indicator ID: ${indicatorId}`);
          return null;
      }

      if (current && previous) {
        return { current, previous };
      }

      return null;
    } catch (error) {
      logger.error(`[IndicatorDataManager] Error calculating indicator ${indicatorId}:`, error);
      return null;
    }
  }

  /**
   * Get specific indicator value
   */
  getIndicatorValue(
    symbol: string,
    exchange: string,
    interval: string,
    indicatorId: string
  ): IndicatorResults[keyof IndicatorResults] | null {
    const cacheKey = this.getCacheKey(symbol, exchange, interval);
    const cached = this.cache.get(cacheKey);

    if (!cached) {
      return null;
    }

    return cached.indicators[indicatorId as keyof IndicatorResults] || null;
  }

  /**
   * Clear cache for a specific symbol-interval
   */
  clearCache(symbol: string, exchange: string, interval: string): void {
    const cacheKey = this.getCacheKey(symbol, exchange, interval);
    this.cache.delete(cacheKey);
    logger.debug(`[IndicatorDataManager] Cleared cache for ${cacheKey}`);
  }

  /**
   * Clear all cached data
   */
  clearAllCache(): void {
    this.cache.clear();
    logger.debug('[IndicatorDataManager] Cleared all cache');
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; keys: string[]; oldestEntry: { key: string; timestamp: number } | null } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      oldestEntry: this.getOldestEntry(),
    };
  }

  /**
   * Get oldest cache entry
   */
  getOldestEntry(): { key: string; timestamp: number } | null {
    let oldest: { key: string; timestamp: number } | null = null;
    let oldestTime = Infinity;

    for (const [key, value] of this.cache.entries()) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldest = { key, timestamp: value.timestamp };
      }
    }

    return oldest;
  }

  /**
   * Clean expired cache entries
   */
  cleanExpiredCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheDuration) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`[IndicatorDataManager] Cleaned ${cleaned} expired cache entries`);
    }
  }
}

/**
 * Singleton instance for global use
 */
export const indicatorDataManager = new IndicatorDataManager();

export default IndicatorDataManager;
