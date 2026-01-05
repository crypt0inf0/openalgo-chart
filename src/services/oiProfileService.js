/**
 * OI Profile Service
 * Fetches and processes option chain data for OI Profile visualization
 */

import { getOptionChain } from './optionChain';
import logger from '../utils/logger';

/**
 * Fetch and process OI data for chart display
 * @param {string} symbol - Underlying symbol (NIFTY, BANKNIFTY, RELIANCE, etc.)
 * @param {string} exchange - Exchange (NFO for F&O, default)
 * @param {string} expiry - Optional expiry date in DDMMMYY format
 * @param {number} strikeCount - Number of strikes above/below ATM (default 20)
 * @returns {Promise<Object|null>} Processed OI profile data or null on error
 */
export const fetchOIProfile = async (symbol, exchange = 'NFO', expiry = null, strikeCount = 20) => {
  try {
    logger.debug('[OIProfileService] Fetching OI profile for:', { symbol, exchange, expiry, strikeCount });

    // Use the existing option chain service (with caching)
    const chain = await getOptionChain(symbol, exchange, expiry, strikeCount);

    if (!chain?.chain?.length) {
      logger.warn('[OIProfileService] No chain data for:', symbol);
      return null;
    }

    // Calculate totals and PCR
    let totalCallOI = 0;
    let totalPutOI = 0;
    let totalCallVolume = 0;
    let totalPutVolume = 0;

    chain.chain.forEach(row => {
      totalCallOI += row.ce?.oi || 0;
      totalPutOI += row.pe?.oi || 0;
      totalCallVolume += row.ce?.volume || 0;
      totalPutVolume += row.pe?.volume || 0;
    });

    const pcr = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;
    const pcrVolume = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 0;

    const result = {
      underlying: chain.underlying,
      atmStrike: chain.atmStrike,
      underlyingLTP: chain.underlyingLTP,
      underlyingPrevClose: chain.underlyingPrevClose,
      expiryDate: chain.expiryDate,
      chain: chain.chain,
      totalCallOI,
      totalPutOI,
      totalOI: totalCallOI + totalPutOI,
      pcr,
      totalCallVolume,
      totalPutVolume,
      pcrVolume,
      timestamp: Date.now(),
    };

    logger.debug('[OIProfileService] OI Profile data:', {
      symbol,
      strikes: result.chain.length,
      totalCallOI,
      totalPutOI,
      pcr: pcr.toFixed(2),
    });

    return result;
  } catch (error) {
    logger.error('[OIProfileService] Error fetching OI profile:', error);
    return null;
  }
};

/**
 * Get top N strikes by total OI (Call + Put)
 * @param {Array} chain - Option chain data
 * @param {number} n - Number of top strikes (default 5)
 * @returns {Array} Top N strikes sorted by total OI
 */
export const getTopNStrikes = (chain, n = 5) => {
  if (!chain?.length) return [];

  return [...chain]
    .map(row => ({
      ...row,
      totalOI: (row.ce?.oi || 0) + (row.pe?.oi || 0),
    }))
    .sort((a, b) => b.totalOI - a.totalOI)
    .slice(0, n);
};

/**
 * Get strikes with highest Call OI
 * @param {Array} chain - Option chain data
 * @param {number} n - Number of top strikes
 * @returns {Array} Top N strikes by Call OI
 */
export const getTopCallOIStrikes = (chain, n = 5) => {
  if (!chain?.length) return [];

  return [...chain]
    .sort((a, b) => (b.ce?.oi || 0) - (a.ce?.oi || 0))
    .slice(0, n);
};

/**
 * Get strikes with highest Put OI
 * @param {Array} chain - Option chain data
 * @param {number} n - Number of top strikes
 * @returns {Array} Top N strikes by Put OI
 */
export const getTopPutOIStrikes = (chain, n = 5) => {
  if (!chain?.length) return [];

  return [...chain]
    .sort((a, b) => (b.pe?.oi || 0) - (a.pe?.oi || 0))
    .slice(0, n);
};

/**
 * Calculate Max Pain strike (strike with minimum net seller liability)
 * @param {Array} chain - Option chain data
 * @param {number} lotSize - Lot size for the underlying
 * @returns {Object|null} Max pain strike info
 */
export const calculateMaxPain = (chain, lotSize = 1) => {
  if (!chain?.length) return null;

  let minPain = Infinity;
  let maxPainStrike = null;

  chain.forEach(row => {
    const strike = row.strike;
    let pain = 0;

    // For each strike, calculate total loss to option sellers
    chain.forEach(r => {
      // Call sellers' loss: sum of all calls with strike < current price
      if (r.ce && r.strike < strike) {
        pain += (strike - r.strike) * (r.ce.oi || 0) * lotSize;
      }
      // Put sellers' loss: sum of all puts with strike > current price
      if (r.pe && r.strike > strike) {
        pain += (r.strike - strike) * (r.pe.oi || 0) * lotSize;
      }
    });

    if (pain < minPain) {
      minPain = pain;
      maxPainStrike = strike;
    }
  });

  return {
    strike: maxPainStrike,
    totalPain: minPain,
  };
};

/**
 * Get support and resistance levels based on OI
 * @param {Array} chain - Option chain data
 * @param {number} atmStrike - ATM strike price
 * @returns {Object} Support and resistance levels
 */
export const getOILevels = (chain, atmStrike) => {
  if (!chain?.length || !atmStrike) return { support: [], resistance: [] };

  // Resistance: High Call OI above ATM
  const resistance = chain
    .filter(r => r.strike > atmStrike && r.ce?.oi > 0)
    .sort((a, b) => (b.ce?.oi || 0) - (a.ce?.oi || 0))
    .slice(0, 3)
    .map(r => ({
      strike: r.strike,
      oi: r.ce.oi,
      type: 'resistance',
    }));

  // Support: High Put OI below ATM
  const support = chain
    .filter(r => r.strike < atmStrike && r.pe?.oi > 0)
    .sort((a, b) => (b.pe?.oi || 0) - (a.pe?.oi || 0))
    .slice(0, 3)
    .map(r => ({
      strike: r.strike,
      oi: r.pe.oi,
      type: 'support',
    }));

  return { support, resistance };
};

export default {
  fetchOIProfile,
  getTopNStrikes,
  getTopCallOIStrikes,
  getTopPutOIStrikes,
  calculateMaxPain,
  getOILevels,
};
