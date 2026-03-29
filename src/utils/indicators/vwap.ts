/**
 * Volume Weighted Average Price (VWAP) Indicator
 * Calculates the average price weighted by volume throughout the trading session
 *
 * VWAP = Cumulative(Typical Price x Volume) / Cumulative(Volume)
 * Typical Price = (High + Low + Close) / 3
 */

import {
  OHLCData,
  OHLCWithOrderFlow,
  TimeValuePoint,
  TimeValuePointNullable,
  VWAPOptions,
  VWAPBandsResult,
  AllVWAPsResult,
  AnchorType
} from './types';

/**
 * Default market open times per exchange (IST) in minutes from midnight
 */
const EXCHANGE_OPEN_MINUTES: Record<string, number> = {
  'NSE': 9 * 60 + 15,   // 09:15
  'BSE': 9 * 60 + 15,   // 09:15
  'NFO': 9 * 60 + 15,   // 09:15
  'BFO': 9 * 60 + 15,   // 09:15
  'MCX': 9 * 60,        // 09:00
  'CDS': 9 * 60,        // 09:00
  'BCD': 9 * 60,        // 09:00
  'NSE_INDEX': 9 * 60 + 15,
  'BSE_INDEX': 9 * 60 + 15,
};

/**
 * Get market open time in minutes from midnight for an exchange
 */
const getMarketOpenMinutes = (exchange: string = 'NSE'): number => {
  return EXCHANGE_OPEN_MINUTES[exchange] || EXCHANGE_OPEN_MINUTES['NSE'];
};

/**
 * Calculate Volume Weighted Average Price
 * @param data - Array of OHLC data points with {time, open, high, low, close, volume}
 * @param options - Options object or legacy resetDaily boolean
 * @returns Array of {time, value} objects representing VWAP values
 */
export const calculateVWAP = (
  data: OHLCData[],
  options: VWAPOptions | boolean = {}
): TimeValuePoint[] => {
  // Support legacy boolean parameter
  const opts: VWAPOptions = typeof options === 'boolean'
    ? { resetDaily: options }
    : options;

  const {
    resetDaily = true,
    exchange = 'NSE',
    resetAtMarketOpen = false,
    source = 'hlc3',
    ignoreVolume = false,
  } = opts;

  // Normalize source to lowercase to handle potential UI capitalization
  const sourceKey = String(source).toLowerCase();

  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  const vwapData: TimeValuePoint[] = [];
  let cumTPV = 0; // Cumulative Typical Price x Volume
  let cumVolume = 0;
  let lastSessionKey: string | null = null;

  // Get market open time for this exchange
  const marketOpenMinutes = getMarketOpenMinutes(exchange);

  for (let i = 0; i < data.length; i++) {
    const candle = data[i];
    // If ignoreVolume is true, treat volume as 1 for all candles (Equal Weight)
    // For instruments with 0 volume (like indices), default to 1 for TWAP calculation
    const volume = ignoreVolume || !candle.volume ? 1 : candle.volume;

    // Check if we need to reset (new trading session)
    if (resetDaily) {
      const candleDate = new Date(candle.time * 1000);
      let sessionKey: string;

      if (resetAtMarketOpen) {
        // Reset at market open time instead of midnight
        // For MCX evening sessions, this treats 09:00-23:55 as one session
        const minutesFromMidnight = candleDate.getHours() * 60 + candleDate.getMinutes();

        // If before market open, this candle belongs to previous day's session
        if (minutesFromMidnight < marketOpenMinutes) {
          const prevDate = new Date(candleDate);
          prevDate.setDate(prevDate.getDate() - 1);
          sessionKey = prevDate.toDateString();
        } else {
          sessionKey = candleDate.toDateString();
        }
      } else {
        // Simple date-based reset (midnight)
        sessionKey = candleDate.toDateString();
      }

      if (lastSessionKey !== null && sessionKey !== lastSessionKey) {
        // Reset cumulative values for new session
        cumTPV = 0;
        cumVolume = 0;
      }
      lastSessionKey = sessionKey;
    }

    // Calculate price based on source
    let price: number;
    switch (sourceKey) {
      case 'close': price = candle.close; break;
      case 'open': price = candle.open; break;
      case 'high': price = candle.high; break;
      case 'low': price = candle.low; break;
      case 'hlc3': default: price = (candle.high + candle.low + candle.close) / 3; break;
    }

    // Update cumulative values
    cumTPV += price * volume;
    cumVolume += volume;

    // Calculate VWAP
    const vwap = cumVolume > 0 ? cumTPV / cumVolume : price;

    vwapData.push({ time: candle.time, value: vwap });
  }

  return vwapData;
};

/**
 * Calculate Buy VWAP (BVWAP)
 * VWAP calculated only from aggressive buy trades (buyer-initiated)
 *
 * @param data - Array of OHLC data with buy volume information
 *               Each candle should have { buyVolume } or use tick data
 * @param resetDaily - Whether to reset at start of new day
 * @returns Array of {time, value} objects
 */
export const calculateBuyVWAP = (
  data: OHLCWithOrderFlow[],
  resetDaily: boolean = true
): TimeValuePoint[] => {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  const bvwapData: TimeValuePoint[] = [];
  let cumTPV = 0;
  let cumVolume = 0;
  let lastDate: string | null = null;

  for (let i = 0; i < data.length; i++) {
    const candle = data[i];
    // Use buyVolume if available, otherwise estimate from candle color
    const buyVolume = candle.buyVolume !== undefined
      ? candle.buyVolume
      : (candle.close >= candle.open ? (candle.volume || 0) : (candle.volume || 0) * 0.4);

    if (!buyVolume || buyVolume === 0) {
      const lastValue = bvwapData.length > 0 ? bvwapData[bvwapData.length - 1].value : null;
      if (lastValue !== null) {
        bvwapData.push({ time: candle.time, value: lastValue });
      }
      continue;
    }

    // Reset for new day
    if (resetDaily) {
      const currentDate = new Date(candle.time * 1000).toDateString();
      if (lastDate !== null && currentDate !== lastDate) {
        cumTPV = 0;
        cumVolume = 0;
      }
      lastDate = currentDate;
    }

    // Use high price for aggressive buys (they hit the ask)
    const buyPrice = candle.buyVwap || candle.high;

    cumTPV += buyPrice * buyVolume;
    cumVolume += buyVolume;

    const bvwap = cumVolume > 0 ? cumTPV / cumVolume : buyPrice;
    bvwapData.push({ time: candle.time, value: bvwap });
  }

  return bvwapData;
};

/**
 * Calculate Sell VWAP (SVWAP)
 * VWAP calculated only from aggressive sell trades (seller-initiated)
 *
 * @param data - Array of OHLC data with sell volume information
 *               Each candle should have { sellVolume } or use tick data
 * @param resetDaily - Whether to reset at start of new day
 * @returns Array of {time, value} objects
 */
export const calculateSellVWAP = (
  data: OHLCWithOrderFlow[],
  resetDaily: boolean = true
): TimeValuePoint[] => {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  const svwapData: TimeValuePoint[] = [];
  let cumTPV = 0;
  let cumVolume = 0;
  let lastDate: string | null = null;

  for (let i = 0; i < data.length; i++) {
    const candle = data[i];
    // Use sellVolume if available, otherwise estimate from candle color
    const sellVolume = candle.sellVolume !== undefined
      ? candle.sellVolume
      : (candle.close < candle.open ? (candle.volume || 0) : (candle.volume || 0) * 0.4);

    if (!sellVolume || sellVolume === 0) {
      const lastValue = svwapData.length > 0 ? svwapData[svwapData.length - 1].value : null;
      if (lastValue !== null) {
        svwapData.push({ time: candle.time, value: lastValue });
      }
      continue;
    }

    // Reset for new day
    if (resetDaily) {
      const currentDate = new Date(candle.time * 1000).toDateString();
      if (lastDate !== null && currentDate !== lastDate) {
        cumTPV = 0;
        cumVolume = 0;
      }
      lastDate = currentDate;
    }

    // Use low price for aggressive sells (they hit the bid)
    const sellPrice = candle.sellVwap || candle.low;

    cumTPV += sellPrice * sellVolume;
    cumVolume += sellVolume;

    const svwap = cumVolume > 0 ? cumTPV / cumVolume : sellPrice;
    svwapData.push({ time: candle.time, value: svwap });
  }

  return svwapData;
};

/**
 * Calculate Anchored VWAP
 * VWAP calculated from a user-specified anchor point (time)
 *
 * @param data - Array of OHLC data points
 * @param anchorTime - Unix timestamp (in seconds) to start VWAP calculation
 * @param anchorType - Type of anchor: 'time', 'high', 'low', 'session'
 * @returns Array of {time, value} objects (null values before anchor)
 */
export const calculateAnchoredVWAP = (
  data: OHLCData[],
  anchorTime: number,
  anchorType: AnchorType = 'time'
): TimeValuePointNullable[] => {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  // Find anchor index based on type
  let anchorIndex = -1;

  switch (anchorType) {
    case 'time':
      // Find the candle at or after the anchor time
      anchorIndex = data.findIndex(candle => candle.time >= anchorTime);
      break;

    case 'high':
      // Find the highest high in the dataset
      let maxHigh = -Infinity;
      data.forEach((candle, index) => {
        if (candle.high > maxHigh) {
          maxHigh = candle.high;
          anchorIndex = index;
        }
      });
      break;

    case 'low':
      // Find the lowest low in the dataset
      let minLow = Infinity;
      data.forEach((candle, index) => {
        if (candle.low < minLow) {
          minLow = candle.low;
          anchorIndex = index;
        }
      });
      break;

    case 'session':
      // Find start of today's session
      const today = new Date().toDateString();
      anchorIndex = data.findIndex(candle => {
        const candleDate = new Date(candle.time * 1000).toDateString();
        return candleDate === today;
      });
      break;

    default:
      anchorIndex = data.findIndex(candle => candle.time >= anchorTime);
  }

  if (anchorIndex === -1) {
    anchorIndex = 0;
  }

  const avwapData: TimeValuePointNullable[] = [];
  let cumTPV = 0;
  let cumVolume = 0;

  for (let i = 0; i < data.length; i++) {
    const candle = data[i];

    // Before anchor point, return null
    if (i < anchorIndex) {
      avwapData.push({ time: candle.time, value: null });
      continue;
    }

    const volume = candle.volume || 0;

    if (volume === 0) {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      const fallbackValue = cumVolume > 0 ? cumTPV / cumVolume : typicalPrice;
      avwapData.push({ time: candle.time, value: fallbackValue });
      continue;
    }

    const typicalPrice = (candle.high + candle.low + candle.close) / 3;

    cumTPV += typicalPrice * volume;
    cumVolume += volume;

    const avwap = cumVolume > 0 ? cumTPV / cumVolume : typicalPrice;
    avwapData.push({ time: candle.time, value: avwap });
  }

  return avwapData;
};

/**
 * Calculate VWAP with Standard Deviation Bands
 * Similar to Bollinger Bands but based on VWAP
 *
 * @param data - Array of OHLC data points
 * @param stdDevMultiplier - Multiplier for standard deviation bands (default: 2)
 * @param resetDaily - Whether to reset at start of new day
 * @returns Object containing vwap and band arrays
 */
export const calculateVWAPBands = (
  data: OHLCData[],
  stdDevMultiplier: number = 2,
  resetDaily: boolean = true
): VWAPBandsResult => {
  if (!Array.isArray(data) || data.length === 0) {
    return { vwap: [], upperBand1: [], lowerBand1: [], upperBand2: [], lowerBand2: [] };
  }

  const vwapData: TimeValuePoint[] = [];
  const upperBand1: TimeValuePoint[] = [];
  const lowerBand1: TimeValuePoint[] = [];
  const upperBand2: TimeValuePoint[] = [];
  const lowerBand2: TimeValuePoint[] = [];

  let cumTPV = 0;
  let cumVolume = 0;
  let cumTPVSquared = 0;
  let lastDate: string | null = null;

  for (let i = 0; i < data.length; i++) {
    const candle = data[i];
    const volume = candle.volume || 0;

    // Reset for new day
    if (resetDaily) {
      const currentDate = new Date(candle.time * 1000).toDateString();
      if (lastDate !== null && currentDate !== lastDate) {
        cumTPV = 0;
        cumVolume = 0;
        cumTPVSquared = 0;
      }
      lastDate = currentDate;
    }

    if (volume === 0) {
      // Fallback: If volume is 0 (common for indices like NIFTY 50), use an effective volume of 1.
      // This effectively calculates a Time-Weighted Average Price (TWAP) for instruments without volume.
      const effectiveVolume = 1;
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;

      cumTPV += typicalPrice * effectiveVolume;
      cumVolume += effectiveVolume;
      cumTPVSquared += typicalPrice * typicalPrice * effectiveVolume;

      const vwap = cumTPV / cumVolume;
      const variance = (cumTPVSquared / cumVolume) - (vwap * vwap);
      const stdDev = Math.sqrt(Math.max(0, variance));

      vwapData.push({ time: candle.time, value: vwap });
      upperBand1.push({ time: candle.time, value: vwap + stdDev });
      lowerBand1.push({ time: candle.time, value: vwap - stdDev });
      upperBand2.push({ time: candle.time, value: vwap + (stdDev * stdDevMultiplier) });
      lowerBand2.push({ time: candle.time, value: vwap - (stdDev * stdDevMultiplier) });
      continue;
    }

    const typicalPrice = (candle.high + candle.low + candle.close) / 3;

    cumTPV += typicalPrice * volume;
    cumVolume += volume;
    cumTPVSquared += typicalPrice * typicalPrice * volume;

    const vwap = cumTPV / cumVolume;

    // Calculate variance and standard deviation
    const variance = (cumTPVSquared / cumVolume) - (vwap * vwap);
    const stdDev = Math.sqrt(Math.max(0, variance));

    vwapData.push({ time: candle.time, value: vwap });
    upperBand1.push({ time: candle.time, value: vwap + stdDev });
    lowerBand1.push({ time: candle.time, value: vwap - stdDev });
    upperBand2.push({ time: candle.time, value: vwap + (stdDev * stdDevMultiplier) });
    lowerBand2.push({ time: candle.time, value: vwap - (stdDev * stdDevMultiplier) });
  }

  return {
    vwap: vwapData,
    upperBand1,
    lowerBand1,
    upperBand2,
    lowerBand2,
  };
};

/**
 * Calculate all VWAP variants at once for efficiency
 *
 * @param data - Array of OHLC data with order flow info
 * @param options - Calculation options
 * @returns Object containing vwap, buyVwap, and sellVwap arrays
 */
export const calculateAllVWAPs = (
  data: OHLCWithOrderFlow[],
  options: { resetDaily?: boolean } = {}
): AllVWAPsResult => {
  const { resetDaily = true } = options;

  return {
    vwap: calculateVWAP(data, { resetDaily }),
    buyVwap: calculateBuyVWAP(data, resetDaily),
    sellVwap: calculateSellVWAP(data, resetDaily),
  };
};
