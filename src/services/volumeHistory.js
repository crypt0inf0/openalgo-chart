/**
 * Volume History Service
 * Fetches and caches 20-day average volume for stocks
 */

import { getHistoricalKlines } from './openalgo';
import logger from '../utils/logger';

// Cache for 20-day average volumes
const volumeCache = new Map();
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Format date to YYYY-MM-DD
 */
const formatDate = (d) => d.toISOString().split('T')[0];

/**
 * Get 20-day historical volume for a symbol
 * @param {string} symbol - Trading symbol
 * @param {string} exchange - Exchange code (default: NSE)
 * @returns {Promise<{avgVolume: number, data: Array}>}
 */
export const get20DayVolume = async (symbol, exchange = 'NSE') => {
  const cacheKey = `${symbol}-${exchange}`;
  const cached = volumeCache.get(cacheKey);

  // Return cached if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    return cached.data;
  }

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // Fetch 30 days to ensure 20 trading days

    // Use getHistoricalKlines which is already exported
    const result = await getHistoricalKlines(
      symbol,
      exchange,
      '1d',
      formatDate(startDate),
      formatDate(endDate)
    );

    if (result && Array.isArray(result) && result.length > 0) {
      // Get last 20 trading days
      const last20Days = result.slice(-20);

      // Calculate average volume
      const totalVolume = last20Days.reduce((sum, d) => sum + (d.volume || 0), 0);
      const avgVolume = last20Days.length > 0 ? totalVolume / last20Days.length : 0;

      const data = {
        avgVolume,
        days: last20Days.length,
        volumes: last20Days.map(d => d.volume || 0),
      };

      // Cache the result
      volumeCache.set(cacheKey, {
        timestamp: Date.now(),
        data,
      });

      return data;
    }

    return { avgVolume: 0, days: 0, volumes: [] };
  } catch (error) {
    logger.error(`[VolumeHistory] Error fetching ${symbol}:`, error);
    return { avgVolume: 0, days: 0, volumes: [] };
  }
};

/**
 * Batch fetch 20-day volumes for multiple symbols
 * @param {Array<{symbol: string, exchange: string}>} symbols
 * @returns {Promise<Map<string, {avgVolume: number}>>}
 */
export const batchGet20DayVolumes = async (symbols) => {
  const results = new Map();

  if (!symbols || symbols.length === 0) {
    return results;
  }

  // Filter out already cached symbols
  const uncached = symbols.filter(s => {
    const cacheKey = `${s.symbol}-${s.exchange}`;
    const cached = volumeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
      results.set(cacheKey, cached.data);
      return false;
    }
    return true;
  });

  logger.info(`[VolumeHistory] Fetching ${uncached.length} symbols (${symbols.length - uncached.length} cached)`);

  // Batch fetch with rate limiting (5 at a time to avoid 429)
  const batchSize = 5;
  for (let i = 0; i < uncached.length; i += batchSize) {
    const batch = uncached.slice(i, i + batchSize);
    const promises = batch.map(s =>
      get20DayVolume(s.symbol, s.exchange)
        .then(data => ({ key: `${s.symbol}-${s.exchange}`, data }))
    );

    const batchResults = await Promise.all(promises);
    batchResults.forEach(({ key, data }) => {
      results.set(key, data);
    });

    // Delay between batches to avoid rate limiting
    if (i + batchSize < uncached.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return results;
};

/**
 * Calculate boost ratio
 * @param {number} currentVolume - Today's volume
 * @param {number} avgVolume - 20-day average volume
 * @returns {number} - Boost ratio (e.g., 2.5 = 2.5x average)
 */
export const calculateBoostRatio = (currentVolume, avgVolume) => {
  if (!avgVolume || avgVolume <= 0) return 0;
  return currentVolume / avgVolume;
};

/**
 * Get boost level description
 * @param {number} ratio - Boost ratio
 * @returns {{ level: string, bars: number, color: string }}
 */
export const getBoostLevel = (ratio) => {
  if (ratio >= 4) {
    return { level: 'Extreme', bars: 4, color: '#00ff00' };
  } else if (ratio >= 2.5) {
    return { level: 'High', bars: 3, color: '#26a69a' };
  } else if (ratio >= 1.5) {
    return { level: 'Moderate', bars: 2, color: '#4db6ac' };
  } else if (ratio >= 1) {
    return { level: 'Normal', bars: 1, color: '#80cbc4' };
  }
  return { level: 'Low', bars: 0, color: '#787b86' };
};

/**
 * Clear the volume cache
 */
export const clearVolumeCache = () => {
  volumeCache.clear();
  logger.info('[VolumeHistory] Cache cleared');
};

/**
 * Calculate momentum signal based on OI methodology
 * Uses volume boost as a proxy for OI activity:
 * - High volume = money flowing in (like OI increase)
 * - Low volume = money flowing out (like OI decrease)
 *
 * @param {number} priceChange - Percentage price change
 * @param {number} boostRatio - Volume boost ratio (current/avg)
 * @returns {{ signal: string, strength: string, description: string, color: string }}
 */
export const getMomentumSignal = (priceChange, boostRatio) => {
  const isPriceUp = priceChange > 0.1; // Up more than 0.1%
  const isPriceDown = priceChange < -0.1; // Down more than 0.1%
  const isHighVolume = boostRatio >= 1.5; // 1.5x+ average volume = significant activity

  // Neutral case - no significant price movement
  if (!isPriceUp && !isPriceDown) {
    return {
      signal: 'neutral',
      strength: 'none',
      description: 'Consolidation',
      shortDesc: 'Range',
      color: '#787b86'
    };
  }

  // OI Methodology mapping:
  // Price + Volume = Long Buildup (Strong Bullish)
  // Price - Volume + = Short Buildup (Strong Bearish)
  // Price + Volume - = Short Covering (Weak Bullish)
  // Price - Volume - = Long Unwinding (Weak Bearish)

  if (isPriceUp && isHighVolume) {
    return {
      signal: 'long_buildup',
      strength: 'strong',
      description: 'Long Buildup',
      shortDesc: 'LB',
      color: '#00c853' // Bright green
    };
  }

  if (isPriceDown && isHighVolume) {
    return {
      signal: 'short_buildup',
      strength: 'strong',
      description: 'Short Buildup',
      shortDesc: 'SB',
      color: '#ff1744' // Bright red
    };
  }

  if (isPriceUp && !isHighVolume) {
    return {
      signal: 'short_covering',
      strength: 'weak',
      description: 'Short Covering',
      shortDesc: 'SC',
      color: '#69f0ae' // Light green
    };
  }

  if (isPriceDown && !isHighVolume) {
    return {
      signal: 'long_unwinding',
      strength: 'weak',
      description: 'Long Unwinding',
      shortDesc: 'LU',
      color: '#ff8a80' // Light red
    };
  }

  // Fallback
  return {
    signal: 'neutral',
    strength: 'none',
    description: 'Neutral',
    shortDesc: '-',
    color: '#787b86'
  };
};
