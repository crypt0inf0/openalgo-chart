/**
 * OI Data Service
 * Fetches and caches Open Interest data from Option Chain API
 * Stores historical OI for day-over-day comparison
 */

import { getOptionChain } from './optionChain';
import logger from '../utils/logger';

// Cache for current session OI data
const oiCache = new Map();
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// localStorage keys
const OI_HISTORY_KEY = 'oi_history';
const OI_CURRENT_KEY = 'oi_current';

/**
 * Format OI for display (Indian notation: K, L, Cr)
 */
export const formatOI = (oi) => {
  if (!oi || oi === 0) return '-';
  if (oi >= 10000000) return `${(oi / 10000000).toFixed(1)}Cr`;
  if (oi >= 100000) return `${(oi / 100000).toFixed(1)}L`;
  if (oi >= 1000) return `${(oi / 1000).toFixed(1)}K`;
  return oi.toLocaleString('en-IN');
};

/**
 * Get today's date string (YYYY-MM-DD)
 */
const getTodayKey = () => new Date().toISOString().split('T')[0];

/**
 * Get previous trading day key
 * Simple approach: yesterday (doesn't handle weekends/holidays)
 */
const getPreviousDayKey = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
};

/**
 * Fetch OI data for a single stock from Option Chain API
 * @param {string} symbol - Stock symbol (e.g., 'RELIANCE')
 * @returns {Promise<Object|null>} OI data or null
 */
export const fetchStockOI = async (symbol) => {
  try {
    // Check cache first
    const cacheKey = symbol;
    const cached = oiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
      return cached.data;
    }

    // Fetch from Option Chain API
    const chain = await getOptionChain(symbol, 'NFO', null, 10);

    if (!chain?.chain || chain.chain.length === 0) {
      logger.debug(`[OI] No option chain data for ${symbol}`);
      return null;
    }

    // Calculate totals
    let totalCallOI = 0;
    let totalPutOI = 0;
    let totalCallVolume = 0;
    let totalPutVolume = 0;

    chain.chain.forEach(row => {
      if (row.ce) {
        totalCallOI += row.ce.oi || 0;
        totalCallVolume += row.ce.volume || 0;
      }
      if (row.pe) {
        totalPutOI += row.pe.oi || 0;
        totalPutVolume += row.pe.volume || 0;
      }
    });

    // Calculate PCR (Put/Call Ratio)
    const pcr = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;

    const oiData = {
      symbol,
      totalCallOI,
      totalPutOI,
      totalOI: totalCallOI + totalPutOI,
      pcr,
      totalCallVolume,
      totalPutVolume,
      atmStrike: chain.atmStrike,
      underlyingLTP: chain.underlyingLTP,
      timestamp: Date.now(),
    };

    // Store in cache
    oiCache.set(cacheKey, { data: oiData, timestamp: Date.now() });

    return oiData;
  } catch (error) {
    logger.error(`[OI] Error fetching OI for ${symbol}:`, error);
    return null;
  }
};

/**
 * Batch fetch OI for multiple symbols with rate limiting
 * @param {Array<{symbol: string}>} symbols - Array of symbol objects
 * @param {Function} onProgress - Progress callback (current, total)
 * @returns {Promise<Map<string, Object>>} Map of symbol -> OI data
 */
export const batchFetchOI = async (symbols, onProgress = null) => {
  const results = new Map();

  if (!symbols || symbols.length === 0) {
    return results;
  }

  const batchSize = 5; // Fetch 5 at a time
  const delayMs = 2000; // 2 second delay between batches (to stay under 30/min)

  logger.info(`[OI] Starting batch fetch for ${symbols.length} symbols`);

  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);

    // Fetch batch in parallel
    const promises = batch.map(s =>
      fetchStockOI(s.symbol)
        .then(data => ({ symbol: s.symbol, data }))
        .catch(() => ({ symbol: s.symbol, data: null }))
    );

    const batchResults = await Promise.all(promises);

    batchResults.forEach(({ symbol, data }) => {
      if (data) {
        results.set(symbol, data);
      }
    });

    // Progress callback
    if (onProgress) {
      onProgress(Math.min(i + batchSize, symbols.length), symbols.length);
    }

    // Delay before next batch (except for last batch)
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  logger.info(`[OI] Batch fetch complete: ${results.size}/${symbols.length} successful`);

  // Store current OI snapshot
  storeCurrentOI(results);

  return results;
};

/**
 * Store current OI data to localStorage
 * @param {Map<string, Object>} oiData - Map of symbol -> OI data
 */
export const storeCurrentOI = (oiData) => {
  try {
    const today = getTodayKey();

    // Convert Map to plain object
    const dataObj = {};
    oiData.forEach((value, key) => {
      dataObj[key] = {
        totalCallOI: value.totalCallOI,
        totalPutOI: value.totalPutOI,
        pcr: value.pcr,
        timestamp: value.timestamp,
      };
    });

    // Store current day's data
    localStorage.setItem(OI_CURRENT_KEY, JSON.stringify({
      date: today,
      data: dataObj,
    }));

    // Also update history (keep last 5 days)
    const historyRaw = localStorage.getItem(OI_HISTORY_KEY);
    const history = historyRaw ? JSON.parse(historyRaw) : {};
    history[today] = dataObj;

    // Keep only last 5 days
    const dates = Object.keys(history).sort();
    if (dates.length > 5) {
      dates.slice(0, dates.length - 5).forEach(d => delete history[d]);
    }

    localStorage.setItem(OI_HISTORY_KEY, JSON.stringify(history));
    logger.debug(`[OI] Stored OI snapshot for ${today}: ${oiData.size} symbols`);
  } catch (error) {
    logger.error('[OI] Error storing OI:', error);
  }
};

/**
 * Get previous day's OI data for a symbol
 * @param {string} symbol - Stock symbol
 * @returns {Object|null} Previous OI data or null
 */
export const getPreviousOI = (symbol) => {
  try {
    const historyRaw = localStorage.getItem(OI_HISTORY_KEY);
    if (!historyRaw) return null;

    const history = JSON.parse(historyRaw);
    const previousDay = getPreviousDayKey();

    // Try previous day first, then any earlier date
    const dates = Object.keys(history).sort().reverse();
    const today = getTodayKey();

    for (const date of dates) {
      if (date < today && history[date][symbol]) {
        return history[date][symbol];
      }
    }

    return null;
  } catch (error) {
    logger.error('[OI] Error getting previous OI:', error);
    return null;
  }
};

/**
 * Calculate PCR change percentage
 * @param {number} currentPcr - Current PCR
 * @param {number} previousPcr - Previous day's PCR
 * @returns {number} PCR change percentage
 */
export const calculatePcrChange = (currentPcr, previousPcr) => {
  if (!previousPcr || previousPcr === 0) return 0;
  return ((currentPcr - previousPcr) / previousPcr) * 100;
};

/**
 * Get OI momentum signal based on price change and PCR
 * @param {number} priceChange - Price change percentage
 * @param {number} pcr - Current Put/Call Ratio
 * @param {number} previousPcr - Previous day's PCR (optional)
 * @returns {Object} Momentum signal
 */
export const getOIMomentumSignal = (priceChange, pcr, previousPcr = null) => {
  const isPriceUp = priceChange > 0.1;
  const isPriceDown = priceChange < -0.1;

  // If we have previous PCR, use PCR change for signal
  // If not, use absolute PCR level (>1 = bearish, <1 = bullish)
  let isBullishOI, isBearishOI;

  if (previousPcr !== null && previousPcr > 0) {
    const pcrChange = calculatePcrChange(pcr, previousPcr);
    // PCR decreasing = more calls = bullish sentiment
    // PCR increasing = more puts = bearish sentiment
    isBullishOI = pcrChange < -5; // PCR dropped by 5%+
    isBearishOI = pcrChange > 5;  // PCR increased by 5%+
  } else {
    // Use absolute PCR level
    isBullishOI = pcr < 0.8;  // More calls than puts
    isBearishOI = pcr > 1.2;  // More puts than calls
  }

  // Neutral case
  if (!isPriceUp && !isPriceDown) {
    return {
      signal: 'neutral',
      strength: 'none',
      description: 'Consolidation',
      shortDesc: 'Range',
      color: '#787b86',
    };
  }

  // OI Methodology:
  // Price up + Bullish OI (calls increasing) = Long Buildup
  // Price down + Bearish OI (puts increasing) = Short Buildup
  // Price up + Bearish OI = Short Covering
  // Price down + Bullish OI = Long Unwinding

  if (isPriceUp && isBullishOI) {
    return {
      signal: 'long_buildup',
      strength: 'strong',
      description: 'Long Buildup',
      shortDesc: 'LB',
      color: '#00c853',
    };
  }

  if (isPriceDown && isBearishOI) {
    return {
      signal: 'short_buildup',
      strength: 'strong',
      description: 'Short Buildup',
      shortDesc: 'SB',
      color: '#ff1744',
    };
  }

  if (isPriceUp && !isBullishOI) {
    return {
      signal: 'short_covering',
      strength: 'weak',
      description: 'Short Covering',
      shortDesc: 'SC',
      color: '#69f0ae',
    };
  }

  if (isPriceDown && !isBearishOI) {
    return {
      signal: 'long_unwinding',
      strength: 'weak',
      description: 'Long Unwinding',
      shortDesc: 'LU',
      color: '#ff8a80',
    };
  }

  // Fallback
  return {
    signal: 'neutral',
    strength: 'none',
    description: 'Neutral',
    shortDesc: '-',
    color: '#787b86',
  };
};

/**
 * Clear OI cache
 */
export const clearOICache = () => {
  oiCache.clear();
  logger.info('[OI] Cache cleared');
};

/**
 * Get all cached OI data
 * @returns {Map<string, Object>}
 */
export const getCachedOI = () => {
  const validCache = new Map();
  const now = Date.now();

  oiCache.forEach((entry, key) => {
    if (now - entry.timestamp < CACHE_DURATION_MS) {
      validCache.set(key, entry.data);
    }
  });

  return validCache;
};

export default {
  fetchStockOI,
  batchFetchOI,
  storeCurrentOI,
  getPreviousOI,
  calculatePcrChange,
  getOIMomentumSignal,
  formatOI,
  clearOICache,
  getCachedOI,
};
