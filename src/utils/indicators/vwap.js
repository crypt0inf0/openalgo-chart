/**
 * Volume Weighted Average Price (VWAP) Indicator
 * Calculates the average price weighted by volume throughout the trading session
 *
 * VWAP = Cumulative(Typical Price × Volume) / Cumulative(Volume)
 * Typical Price = (High + Low + Close) / 3
 *
 * @param {Array} data - Array of OHLC data points with {time, open, high, low, close, volume}
 * @param {boolean} resetDaily - Whether to reset VWAP at start of new day (default: true)
 * @returns {Array} Array of {time, value} objects representing VWAP values
 */
export const calculateVWAP = (data, resetDaily = true) => {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  const vwapData = [];
  let cumTPV = 0; // Cumulative Typical Price × Volume
  let cumVolume = 0;
  let lastDate = null;

  for (let i = 0; i < data.length; i++) {
    const candle = data[i];
    const volume = candle.volume || 0;

    // Handle candles with no volume - use typical price as fallback
    if (volume === 0) {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      const fallbackValue = vwapData.length > 0 ? vwapData[vwapData.length - 1].value : typicalPrice;
      vwapData.push({ time: candle.time, value: fallbackValue });
      continue;
    }

    // Check if we need to reset (new trading day)
    if (resetDaily) {
      // Extract date from timestamp (assuming Unix timestamp in seconds)
      const currentDate = new Date(candle.time * 1000).toDateString();
      if (lastDate !== null && currentDate !== lastDate) {
        // Reset cumulative values for new day
        cumTPV = 0;
        cumVolume = 0;
      }
      lastDate = currentDate;
    }

    // Calculate typical price
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;

    // Update cumulative values
    cumTPV += typicalPrice * volume;
    cumVolume += volume;

    // Calculate VWAP
    const vwap = cumVolume > 0 ? cumTPV / cumVolume : typicalPrice;

    vwapData.push({ time: candle.time, value: vwap });
  }

  return vwapData;
};

/**
 * Calculate Buy VWAP (BVWAP)
 * VWAP calculated only from aggressive buy trades (buyer-initiated)
 *
 * @param {Array} data - Array of OHLC data with buy volume information
 *                       Each candle should have { buyVolume } or use tick data
 * @param {boolean} resetDaily - Whether to reset at start of new day
 * @returns {Array} Array of {time, value} objects
 */
export const calculateBuyVWAP = (data, resetDaily = true) => {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  const bvwapData = [];
  let cumTPV = 0;
  let cumVolume = 0;
  let lastDate = null;

  for (let i = 0; i < data.length; i++) {
    const candle = data[i];
    // Use buyVolume if available, otherwise estimate from candle color
    const buyVolume = candle.buyVolume !== undefined
      ? candle.buyVolume
      : (candle.close >= candle.open ? candle.volume : candle.volume * 0.4);

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
 * @param {Array} data - Array of OHLC data with sell volume information
 *                       Each candle should have { sellVolume } or use tick data
 * @param {boolean} resetDaily - Whether to reset at start of new day
 * @returns {Array} Array of {time, value} objects
 */
export const calculateSellVWAP = (data, resetDaily = true) => {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  const svwapData = [];
  let cumTPV = 0;
  let cumVolume = 0;
  let lastDate = null;

  for (let i = 0; i < data.length; i++) {
    const candle = data[i];
    // Use sellVolume if available, otherwise estimate from candle color
    const sellVolume = candle.sellVolume !== undefined
      ? candle.sellVolume
      : (candle.close < candle.open ? candle.volume : candle.volume * 0.4);

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
 * @param {Array} data - Array of OHLC data points
 * @param {number} anchorTime - Unix timestamp (in seconds) to start VWAP calculation
 * @param {string} anchorType - Type of anchor: 'time', 'high', 'low', 'session'
 * @returns {Array} Array of {time, value} objects (null values before anchor)
 */
export const calculateAnchoredVWAP = (data, anchorTime, anchorType = 'time') => {
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

  const avwapData = [];
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
 * @param {Array} data - Array of OHLC data points
 * @param {number} stdDevMultiplier - Multiplier for standard deviation bands (default: 2)
 * @param {boolean} resetDaily - Whether to reset at start of new day
 * @returns {Object} { vwap, upperBand1, lowerBand1, upperBand2, lowerBand2 }
 */
export const calculateVWAPBands = (data, stdDevMultiplier = 2, resetDaily = true) => {
  if (!Array.isArray(data) || data.length === 0) {
    return { vwap: [], upperBand1: [], lowerBand1: [], upperBand2: [], lowerBand2: [] };
  }

  const vwapData = [];
  const upperBand1 = [];
  const lowerBand1 = [];
  const upperBand2 = [];
  const lowerBand2 = [];

  let cumTPV = 0;
  let cumVolume = 0;
  let cumTPVSquared = 0;
  let lastDate = null;

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
      const lastVwap = vwapData.length > 0 ? vwapData[vwapData.length - 1].value : null;
      vwapData.push({ time: candle.time, value: lastVwap });
      upperBand1.push({ time: candle.time, value: lastVwap });
      lowerBand1.push({ time: candle.time, value: lastVwap });
      upperBand2.push({ time: candle.time, value: lastVwap });
      lowerBand2.push({ time: candle.time, value: lastVwap });
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
 * @param {Array} data - Array of OHLC data with order flow info
 * @param {Object} options - Calculation options
 * @returns {Object} { vwap, buyVwap, sellVwap }
 */
export const calculateAllVWAPs = (data, options = {}) => {
  const { resetDaily = true } = options;

  return {
    vwap: calculateVWAP(data, resetDaily),
    buyVwap: calculateBuyVWAP(data, resetDaily),
    sellVwap: calculateSellVWAP(data, resetDaily),
  };
};
