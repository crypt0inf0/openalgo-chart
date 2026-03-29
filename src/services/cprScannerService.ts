/**
 * CPR Scanner Service
 * Scans multiple stocks for Narrow CPR (Central Pivot Range)
 * Narrow CPR = (TC - BC) / Pivot * 100 < threshold → potential trend day
 */

import { getKlines } from './openalgo';
import logger from '../utils/logger';

// ==================== TYPES ====================

export type CPRSortField = 'cprWidthPct' | 'symbol' | 'pivot' | 'ltp' | 'changePct' | 'volume';
export type SortDirection = 'asc' | 'desc';
export type CPRFilterType = 'all' | 'narrow' | 'wide';

export interface StockInput {
  symbol: string;
  exchange: string;
  name?: string;
}

export interface CPRScanOptions {
  narrowThreshold?: number;   // CPR width % below which it's "narrow" (default 0.5)
  daysToFetch?: number;       // number of daily candles to fetch (default 5 to get prev day)
  delayMs?: number;           // delay between stock requests
}

export interface CPRScanResult {
  symbol: string;
  exchange: string;
  name?: string;
  pivot: number | null;
  bc: number | null;
  tc: number | null;
  cprWidth: number | null;      // TC - BC absolute
  cprWidthPct: number | null;   // (TC - BC) / Pivot * 100
  prevClose: number | null;
  prevHigh: number | null;
  prevLow: number | null;
  ltp: number | null;
  changePct: number | null;
  volume: number | null;
  isNarrow: boolean;
  error: string | null;
}

type ProgressCallback = (current: number, total: number, result: CPRScanResult) => void;

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// ==================== CORE CALCULATION ====================

/**
 * Calculate CPR from a single day's OHLC data
 */
const calcCPR = (high: number, low: number, close: number) => {
  const P  = (high + low + close) / 3;
  const BC = (high + low) / 2;
  const TC = 2 * P - BC;
  return { pivot: P, bc: BC, tc: TC };
};

// ==================== SCAN FUNCTIONS ====================

/**
 * Scan a single stock for Narrow CPR
 */
export const scanCPRStock = async (
  stock: StockInput,
  options: CPRScanOptions = {},
  signal?: AbortSignal
): Promise<CPRScanResult> => {
  const { narrowThreshold = 0.1, daysToFetch = 10 } = options;

  try {
    // Fetch daily OHLC (need at least 2 days: prev day + current day)
    const data = (await getKlines(
      stock.symbol,
      stock.exchange,
      '1d',
      daysToFetch,
      signal
    )) as Candle[] | null;

    if (!data || data.length < 2) {
      return {
        symbol: stock.symbol,
        exchange: stock.exchange,
        name: stock.name,
        pivot: null, bc: null, tc: null,
        cprWidth: null, cprWidthPct: null,
        prevClose: null, prevHigh: null, prevLow: null,
        ltp: null, changePct: null, volume: null,
        isNarrow: false,
        error: data && data.length < 2 ? 'Not enough data (need 2+ days)' : 'No data available',
      };
    }

    // Use the PREVIOUS completed day (second-to-last) to calculate today's CPR
    // data is sorted ascending by time
    const prevDay = data[data.length - 2]!;
    const currentDay = data[data.length - 1]!;

    const { pivot, bc, tc } = calcCPR(prevDay.high, prevDay.low, prevDay.close);
    const cprWidth    = Math.abs(tc - bc);
    const cprWidthPct = (cprWidth / pivot) * 100;
    const isNarrow    = cprWidthPct < narrowThreshold;
    
    const ltp = currentDay.close;
    const changePct = prevDay.close > 0 ? ((ltp - prevDay.close) / prevDay.close) * 100 : 0;
    const volume = currentDay.volume || 0;

    return {
      symbol: stock.symbol,
      exchange: stock.exchange,
      name: stock.name,
      pivot: parseFloat(pivot.toFixed(2)),
      bc:    parseFloat(bc.toFixed(2)),
      tc:    parseFloat(tc.toFixed(2)),
      cprWidth:    parseFloat(cprWidth.toFixed(2)),
      cprWidthPct: parseFloat(cprWidthPct.toFixed(4)),
      prevClose: prevDay.close,
      prevHigh:  prevDay.high,
      prevLow:   prevDay.low,
      ltp: parseFloat(ltp.toFixed(2)),
      changePct: parseFloat(changePct.toFixed(2)),
      volume,
      isNarrow,
      error: null,
    };
  } catch (err) {
    const error = err as Error & { name?: string };
    if (error.name === 'AbortError') throw err;
    logger.error(`[CPR Scanner] Error scanning ${stock.symbol}:`, err);
    return {
      symbol: stock.symbol,
      exchange: stock.exchange,
      name: stock.name,
      pivot: null, bc: null, tc: null,
      cprWidth: null, cprWidthPct: null,
      prevClose: null, prevHigh: null, prevLow: null,
      ltp: null, changePct: null, volume: null,
      isNarrow: false,
      error: error.message || 'Scan failed',
    };
  }
};

/**
 * Scan multiple stocks with progress callback
 */
export const scanCPRStocks = async (
  stocks: StockInput[],
  options: CPRScanOptions = {},
  onProgress?: ProgressCallback | null,
  signal?: AbortSignal
): Promise<CPRScanResult[]> => {
  const { delayMs = 100, ...scanOptions } = options;
  const results: CPRScanResult[] = [];

  for (let i = 0; i < stocks.length; i++) {
    if (signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError');

    const stock = stocks[i];
    if (!stock) continue;

    const result = await scanCPRStock(stock, scanOptions, signal);
    results.push(result);

    if (onProgress) onProgress(i + 1, stocks.length, result);

    if (i < stocks.length - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
};

// ==================== SORT / FILTER ====================

export const sortCPRResults = (
  results: CPRScanResult[],
  sortBy: CPRSortField = 'cprWidthPct',
  sortDir: SortDirection = 'asc'
): CPRScanResult[] => {
  const sorted = [...results];

  sorted.sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'cprWidthPct':
        // nulls go to end
        if (a.cprWidthPct === null && b.cprWidthPct === null) cmp = 0;
        else if (a.cprWidthPct === null) cmp = 1;
        else if (b.cprWidthPct === null) cmp = -1;
        else cmp = a.cprWidthPct - b.cprWidthPct;
        break;
      case 'symbol':
        cmp = a.symbol.localeCompare(b.symbol);
        break;
      case 'pivot':
        cmp = (a.pivot ?? 0) - (b.pivot ?? 0);
        break;
      case 'ltp':
        cmp = (a.ltp ?? 0) - (b.ltp ?? 0);
        break;
      case 'changePct':
        cmp = (a.changePct ?? 0) - (b.changePct ?? 0);
        break;
      case 'volume':
        cmp = (a.volume ?? 0) - (b.volume ?? 0);
        break;
    }
    return sortDir === 'desc' ? -cmp : cmp;
  });

  return sorted;
};

export const filterCPRResults = (
  results: CPRScanResult[],
  filter: CPRFilterType = 'all'
): CPRScanResult[] => {
  if (filter === 'narrow') return results.filter(r => r.isNarrow && !r.error);
  if (filter === 'wide')   return results.filter(r => !r.isNarrow && !r.error);
  return results;
};

/**
 * Get a color for CPR width % (narrower = more vivid green)
 */
export const getCPRWidthColor = (pct: number | null): string => {
  if (pct === null) return '#787b86';
  if (pct < 0.25) return '#26A69A'; // very narrow - strong teal
  if (pct < 0.5)  return '#66BB6A'; // narrow - green
  if (pct < 1.0)  return '#FFB74D'; // moderate - orange
  return '#787b86';                  // wide - gray
};

export default { scanCPRStock, scanCPRStocks, sortCPRResults, filterCPRResults, getCPRWidthColor };
