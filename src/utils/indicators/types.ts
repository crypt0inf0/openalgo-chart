/**
 * Common TypeScript interfaces for technical indicators
 */

/**
 * OHLC Candle/Bar data structure
 */
export interface OHLCData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Extended OHLC data with buy/sell volume information
 */
export interface OHLCWithOrderFlow extends OHLCData {
  buyVolume?: number;
  sellVolume?: number;
  buyVwap?: number;
  sellVwap?: number;
}

/**
 * Basic time-value data point (for line indicators)
 */
export interface TimeValuePoint {
  time: number;
  value: number;
}

/**
 * Time-value point that can be null (for anchored indicators)
 */
export interface TimeValuePointNullable {
  time: number;
  value: number | null;
}

/**
 * Time-value point with color (for histogram/colored indicators)
 */
export interface TimeValueColorPoint {
  time: number;
  value: number;
  color: string;
}

/**
 * Supertrend data point with trend direction
 */
export interface SupertrendPoint {
  time: number;
  value: number;
  color: string;
  trend: 1 | -1;
}

/**
 * MACD indicator result
 */
export interface MACDResult {
  macdLine: TimeValuePoint[];
  signalLine: TimeValuePoint[];
  histogram: TimeValueColorPoint[];
}

/**
 * Bollinger Bands result
 */
export interface BollingerBandsResult {
  upper: TimeValuePoint[];
  middle: TimeValuePoint[];
  lower: TimeValuePoint[];
}

/**
 * Stochastic oscillator result
 */
export interface StochasticResult {
  kLine: TimeValuePoint[];
  dLine: TimeValuePoint[];
}

/**
 * VWAP with bands result
 */
export interface VWAPBandsResult {
  vwap: TimeValuePoint[];
  upperBand1: TimeValuePoint[];
  lowerBand1: TimeValuePoint[];
  upperBand2: TimeValuePoint[];
  lowerBand2: TimeValuePoint[];
}

/**
 * All VWAPs result
 */
export interface AllVWAPsResult {
  vwap: TimeValuePoint[];
  buyVwap: TimeValuePoint[];
  sellVwap: TimeValuePoint[];
}

/**
 * VWAP calculation options
 */
export interface VWAPOptions {
  resetDaily?: boolean;
  exchange?: string;
  resetAtMarketOpen?: boolean;
  source?: 'hlc3' | 'close' | 'open' | 'high' | 'low';
  ignoreVolume?: boolean;
}

/**
 * Enhanced volume analysis result
 */
export interface EnhancedVolumeResult {
  bars: TimeValueColorPoint[];
  ma: TimeValuePoint[];
  analysis: VolumeAnalysisPoint[];
}

/**
 * Volume analysis data point
 */
export interface VolumeAnalysisPoint {
  time: number;
  volume: number;
  avgVolume: number;
  relativeVolume: number;
  percentAboveAvg: number;
  isHighVolume: boolean;
  isUp: boolean;
}

/**
 * Enhanced volume options
 */
export interface EnhancedVolumeOptions {
  maPeriod?: number;
  upColor?: string;
  downColor?: string;
  highVolumeUpColor?: string;
  highVolumeDownColor?: string;
  highVolumeThreshold?: number;
  showMA?: boolean;
}

/**
 * Anchored VWAP anchor type
 */
export type AnchorType = 'time' | 'high' | 'low' | 'session';

/**
 * UT Bot Alerts data point
 */
export interface UTBotAlertsPoint {
  time: number;
  trailingStop: number;
  buy: boolean;
  sell: boolean;
  trend: 1 | -1;
}
