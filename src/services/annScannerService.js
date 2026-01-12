/**
 * ANN Scanner Service
 * Scans multiple stocks using ANN Strategy to detect LONG/SHORT signals
 * and calculates consecutive day streaks
 */

import { getKlines } from './openalgo';
import { calculateANNStrategy } from '../utils/indicators/annStrategy';

/**
 * Convert timestamp to date string (YYYY-MM-DD)
 */
const getDateStr = (timestamp) => {
  const date = new Date(timestamp * 1000);
  return date.toISOString().split('T')[0];
};

/**
 * Group signals by day and get end-of-day signal state
 * @param {Array} signals - Array of signal objects { time, buying, nnOutput }
 * @returns {Array} Array of daily signals sorted chronologically
 */
const groupSignalsByDay = (signals) => {
  if (!signals || signals.length === 0) return [];

  const dayMap = new Map();

  // Group signals by day, keeping the last signal of each day
  for (const signal of signals) {
    const dateStr = getDateStr(signal.time);
    // Always keep the latest signal for each day
    if (!dayMap.has(dateStr) || signal.time > dayMap.get(dateStr).time) {
      dayMap.set(dateStr, {
        date: dateStr,
        time: signal.time,
        buying: signal.buying,
        nnOutput: signal.nnOutput,
      });
    }
  }

  // Sort by date chronologically
  return Array.from(dayMap.values()).sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );
};

/**
 * Calculate streak of consecutive days with same signal direction
 * @param {Array} dailySignals - Array of daily signal objects
 * @returns {Object} { streak, direction, lastChangeDate, nnOutput }
 */
const calculateStreak = (dailySignals) => {
  if (!dailySignals || dailySignals.length === 0) {
    return { streak: 0, direction: null, lastChangeDate: null, nnOutput: null };
  }

  // Get the latest signal
  const latestSignal = dailySignals[dailySignals.length - 1];

  // If latest signal has no direction (buying is null), no streak
  if (latestSignal.buying === null) {
    return { streak: 0, direction: null, lastChangeDate: latestSignal.date, nnOutput: latestSignal.nnOutput };
  }

  let streak = 1;
  let lastChangeDate = latestSignal.date;

  // Count backwards from second-to-last day
  for (let i = dailySignals.length - 2; i >= 0; i--) {
    const currentSignal = dailySignals[i];

    // If signal direction matches, increment streak
    if (currentSignal.buying === latestSignal.buying) {
      streak++;
    } else {
      // Direction changed - record the date when current streak started
      lastChangeDate = dailySignals[i + 1].date;
      break;
    }
  }

  // If we went through all signals and they all match, streak started from first signal
  if (streak === dailySignals.length) {
    lastChangeDate = dailySignals[0].date;
  }

  return {
    streak,
    direction: latestSignal.buying ? 'LONG' : 'SHORT',
    lastChangeDate,
    nnOutput: latestSignal.nnOutput,
  };
};

/**
 * Scan a single stock for ANN signals
 * @param {Object} stock - { symbol, exchange, name }
 * @param {Object} options - { threshold, daysToFetch }
 * @param {AbortSignal} signal - Abort signal for cancellation
 * @returns {Object} Scan result
 */
export const scanStock = async (stock, options = {}, signal = null) => {
  const { threshold = 0.0014, daysToFetch = 60 } = options;

  try {
    // Fetch daily OHLC data
    const data = await getKlines(stock.symbol, stock.exchange, '1d', daysToFetch, signal);

    if (!data || data.length === 0) {
      return {
        symbol: stock.symbol,
        exchange: stock.exchange,
        name: stock.name,
        error: 'No data available',
        direction: null,
        streak: 0,
        nnOutput: null,
        lastChangeDate: null,
      };
    }

    // Run ANN Strategy
    const { signals } = calculateANNStrategy(data, { threshold, showSignals: false, showBackground: false });

    // Group by day and calculate streak
    const dailySignals = groupSignalsByDay(signals);
    const streakInfo = calculateStreak(dailySignals);

    return {
      symbol: stock.symbol,
      exchange: stock.exchange,
      name: stock.name,
      direction: streakInfo.direction,
      streak: streakInfo.streak,
      nnOutput: streakInfo.nnOutput,
      lastChangeDate: streakInfo.lastChangeDate,
      totalDays: dailySignals.length,
      error: null,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      throw err; // Re-throw abort errors
    }
    console.error(`[ANN Scanner] Error scanning ${stock.symbol}:`, err);
    return {
      symbol: stock.symbol,
      exchange: stock.exchange,
      name: stock.name,
      error: err.message || 'Scan failed',
      direction: null,
      streak: 0,
      nnOutput: null,
      lastChangeDate: null,
    };
  }
};

/**
 * Scan multiple stocks with progress callback
 * @param {Array} stocks - Array of { symbol, exchange, name }
 * @param {Object} options - { threshold, daysToFetch, delayMs }
 * @param {Function} onProgress - Callback (current, total, result)
 * @param {AbortSignal} signal - Abort signal for cancellation
 * @returns {Array} Array of scan results
 */
export const scanStocks = async (stocks, options = {}, onProgress = null, signal = null) => {
  const { delayMs = 100, ...scanOptions } = options;
  const results = [];

  for (let i = 0; i < stocks.length; i++) {
    // Check if aborted
    if (signal?.aborted) {
      throw new DOMException('Scan cancelled', 'AbortError');
    }

    const stock = stocks[i];
    const result = await scanStock(stock, scanOptions, signal);
    results.push(result);

    // Call progress callback
    if (onProgress) {
      onProgress(i + 1, stocks.length, result);
    }

    // Small delay between requests to avoid rate limiting
    if (i < stocks.length - 1 && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
};

/**
 * Sort scan results by various criteria
 * @param {Array} results - Array of scan results
 * @param {string} sortBy - 'streak' | 'symbol' | 'nnOutput' | 'direction'
 * @param {string} sortDir - 'asc' | 'desc'
 * @returns {Array} Sorted results
 */
export const sortResults = (results, sortBy = 'streak', sortDir = 'desc') => {
  const sorted = [...results];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'streak':
        comparison = (a.streak || 0) - (b.streak || 0);
        break;
      case 'symbol':
        comparison = a.symbol.localeCompare(b.symbol);
        break;
      case 'nnOutput':
        comparison = (a.nnOutput || 0) - (b.nnOutput || 0);
        break;
      case 'direction':
        // LONG first, then SHORT, then null
        const dirOrder = { 'LONG': 0, 'SHORT': 1, null: 2 };
        comparison = (dirOrder[a.direction] ?? 2) - (dirOrder[b.direction] ?? 2);
        break;
      default:
        comparison = 0;
    }

    return sortDir === 'desc' ? -comparison : comparison;
  });

  return sorted;
};

/**
 * Filter scan results by direction
 * @param {Array} results - Array of scan results
 * @param {string} filter - 'all' | 'long' | 'short'
 * @returns {Array} Filtered results
 */
export const filterResults = (results, filter = 'all') => {
  if (filter === 'all') return results;
  if (filter === 'long') return results.filter(r => r.direction === 'LONG');
  if (filter === 'short') return results.filter(r => r.direction === 'SHORT');
  return results;
};

/**
 * Calculate signal strength from NN output (0-100)
 * Based on typical nnOutput range of -0.01 to +0.01
 * @param {number} nnOutput - The neural network output value
 * @returns {number} Signal strength as percentage (0-100)
 */
export const calculateSignalStrength = (nnOutput) => {
  if (nnOutput === null || nnOutput === undefined) return 0;
  const absValue = Math.abs(nnOutput);
  // Map 0-0.01 range to 0-100 scale, capping at 0.01
  return Math.round(Math.min(100, (absValue / 0.01) * 100));
};

/**
 * Get color for signal strength
 * @param {number} strength - Signal strength (0-100)
 * @returns {string} Hex color code
 */
export const getStrengthColor = (strength) => {
  if (strength >= 70) return '#26A69A'; // Strong - green
  if (strength >= 40) return '#FFB74D'; // Medium - orange
  return '#787b86'; // Weak - gray
};

export default {
  scanStock,
  scanStocks,
  sortResults,
  filterResults,
  calculateSignalStrength,
  getStrengthColor,
};
