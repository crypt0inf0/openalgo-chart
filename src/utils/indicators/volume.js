/**
 * Volume Indicator with Color Coding and Moving Average
 * Shows trading volume with color based on price direction and relative volume analysis
 *
 * @param {Array} data - Array of OHLC data points with {time, open, high, low, close, volume}
 * @param {string} upColor - Color for up candles (default: '#089981')
 * @param {string} downColor - Color for down candles (default: '#F23645')
 * @returns {Array} Array of {time, value, color} objects
 */
export const calculateVolume = (data, upColor = '#089981', downColor = '#F23645') => {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  return data.map(candle => ({
    time: candle.time,
    value: candle.volume || 0,
    color: candle.close >= candle.open ? upColor : downColor
  }));
};

/**
 * Calculate Volume Moving Average
 * @param {Array} data - Array of OHLC data points with volume
 * @param {number} period - MA period (default: 20)
 * @returns {Array} Array of {time, value} objects for the MA line
 */
export const calculateVolumeMA = (data, period = 20) => {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  const result = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      // Not enough data for MA yet
      continue;
    }

    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += (data[i - j].volume || 0);
    }

    result.push({
      time: data[i].time,
      value: sum / period
    });
  }

  return result;
};

/**
 * Enhanced Volume with Relative Volume Analysis
 * Returns volume bars with color-coding based on:
 * - Price direction (up/down candle)
 * - Relative volume (highlight when above average)
 *
 * @param {Array} data - Array of OHLC data points with volume
 * @param {Object} options - Configuration options
 * @returns {Object} { bars: [], ma: [], analysis: [] }
 */
export const calculateEnhancedVolume = (data, options = {}) => {
  const {
    maPeriod = 20,
    upColor = '#26A69A',           // Teal for up candles
    downColor = '#EF5350',         // Red for down candles
    highVolumeUpColor = '#00E676', // Bright green for high volume up
    highVolumeDownColor = '#FF1744', // Bright red for high volume down
    highVolumeThreshold = 1.5,     // 1.5x average = high volume
    showMA = true
  } = options;

  if (!Array.isArray(data) || data.length === 0) {
    return { bars: [], ma: [], analysis: [] };
  }

  // Calculate running MA for relative volume comparison
  const bars = [];
  const ma = [];
  const analysis = [];

  for (let i = 0; i < data.length; i++) {
    const candle = data[i];
    const volume = candle.volume || 0;
    const isUp = candle.close >= candle.open;

    // Calculate MA up to this point
    let avgVolume = 0;
    if (i >= maPeriod - 1) {
      let sum = 0;
      for (let j = 0; j < maPeriod; j++) {
        sum += (data[i - j].volume || 0);
      }
      avgVolume = sum / maPeriod;

      if (showMA) {
        ma.push({
          time: candle.time,
          value: avgVolume
        });
      }
    }

    // Calculate relative volume (percentage of average)
    const relativeVolume = avgVolume > 0 ? volume / avgVolume : 1;
    const isHighVolume = relativeVolume >= highVolumeThreshold;
    const percentAboveAvg = avgVolume > 0 ? ((volume - avgVolume) / avgVolume) * 100 : 0;

    // Determine bar color based on direction and relative volume
    let color;
    if (isHighVolume) {
      color = isUp ? highVolumeUpColor : highVolumeDownColor;
    } else {
      color = isUp ? upColor : downColor;
    }

    bars.push({
      time: candle.time,
      value: volume,
      color
    });

    // Analysis data for tooltips/labels
    analysis.push({
      time: candle.time,
      volume,
      avgVolume,
      relativeVolume,
      percentAboveAvg: Math.round(percentAboveAvg),
      isHighVolume,
      isUp
    });
  }

  return { bars, ma, analysis };
};

export default calculateVolume;
