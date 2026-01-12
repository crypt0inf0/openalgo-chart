/**
 * Range Breakout Indicator
 * Identifies the opening range (9:30-10:00 AM IST) high/low and marks
 * breakout (above high) or breakdown (below low) signals.
 *
 * Strategy for Nifty/Sensex Weekly Options:
 * - Breakout (above range high) → Sell Put
 * - Breakdown (below range low) → Sell Call
 */

/**
 * Convert timestamp to IST date components
 * Note: The candle data already has IST offset applied from the API
 * @param {number} timestamp - Unix timestamp in seconds (already in IST)
 * @returns {Object} - { hours, minutes, dateStr }
 */
const getISTComponents = (timestamp) => {
  const date = new Date(timestamp * 1000);
  return {
    hours: date.getUTCHours(),
    minutes: date.getUTCMinutes(),
    dateStr: date.toISOString().split('T')[0] // YYYY-MM-DD
  };
};

/**
 * Check if a candle is within the range window
 * @param {number} timestamp - Unix timestamp in seconds
 * @param {number} startHour - Range start hour (default: 9)
 * @param {number} startMinute - Range start minute (default: 30)
 * @param {number} endHour - Range end hour (default: 10)
 * @param {number} endMinute - Range end minute (default: 0)
 * @returns {boolean}
 */
const isInRangeWindow = (timestamp, startHour, startMinute, endHour, endMinute) => {
  const { hours, minutes } = getISTComponents(timestamp);
  const timeInMinutes = hours * 60 + minutes;
  const rangeStart = startHour * 60 + startMinute;
  const rangeEnd = endHour * 60 + endMinute;
  return timeInMinutes >= rangeStart && timeInMinutes < rangeEnd;
};

/**
 * Check if a candle is after the range window
 * @param {number} timestamp - Unix timestamp in seconds
 * @param {number} endHour - Range end hour
 * @param {number} endMinute - Range end minute
 * @returns {boolean}
 */
const isAfterRange = (timestamp, endHour, endMinute) => {
  const { hours, minutes } = getISTComponents(timestamp);
  const timeInMinutes = hours * 60 + minutes;
  const rangeEnd = endHour * 60 + endMinute;
  return timeInMinutes >= rangeEnd;
};

/**
 * Check if candle is within market hours (9:15 AM - 3:30 PM IST)
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {boolean}
 */
const isMarketHours = (timestamp) => {
  const { hours, minutes } = getISTComponents(timestamp);
  const timeInMinutes = hours * 60 + minutes;
  const marketOpen = 9 * 60 + 15;  // 9:15 AM
  const marketClose = 15 * 60 + 30; // 3:30 PM
  return timeInMinutes >= marketOpen && timeInMinutes <= marketClose;
};

/**
 * Calculate Range Breakout indicator data
 * @param {Array} data - Array of OHLC candles
 * @param {Object} options - Configuration options
 * @returns {Object} - { highLines, lowLines, markers, allLevels }
 */
export const calculateRangeBreakout = (data, options = {}) => {
  const {
    rangeStartHour = 9,
    rangeStartMinute = 30,
    rangeEndHour = 10,
    rangeEndMinute = 0,
    highColor = '#089981',      // Green for range high
    lowColor = '#F23645',       // Red for range low
    showSignals = true
  } = options;

  if (!Array.isArray(data) || data.length === 0) {
    return { highLines: [], lowLines: [], markers: [], allLevels: [] };
  }

  // Group candles by trading day
  const dayMap = new Map();

  for (const candle of data) {
    const { dateStr } = getISTComponents(candle.time);
    if (!dayMap.has(dateStr)) {
      dayMap.set(dateStr, []);
    }
    dayMap.get(dateStr).push(candle);
  }

  const highLines = [];
  const lowLines = [];
  const markers = [];
  const allLevels = [];

  // Process each trading day
  for (const [dateStr, dayCandles] of dayMap) {
    // Sort by time to ensure order
    dayCandles.sort((a, b) => a.time - b.time);

    // Filter candles to market hours only
    const marketCandles = dayCandles.filter(c => isMarketHours(c.time));

    if (marketCandles.length === 0) continue;

    // Find candles within the range window (9:30-10:00)
    const rangeCandles = marketCandles.filter(c =>
      isInRangeWindow(c.time, rangeStartHour, rangeStartMinute, rangeEndHour, rangeEndMinute)
    );

    if (rangeCandles.length === 0) continue;

    // Calculate range high and low
    const rangeHigh = Math.max(...rangeCandles.map(c => c.high));
    const rangeLow = Math.min(...rangeCandles.map(c => c.low));

    // Find candles after the range window
    const postRangeCandles = marketCandles.filter(c =>
      isAfterRange(c.time, rangeEndHour, rangeEndMinute)
    );

    if (postRangeCandles.length === 0) continue;

    // Get the first candle after range and last candle of the day
    const rangeEndCandle = postRangeCandles[0];
    const lastCandle = marketCandles[marketCandles.length - 1];

    // Skip if start and end times are the same (only one candle after range)
    // This prevents duplicate timestamp errors in lightweight-charts
    if (rangeEndCandle.time === lastCandle.time) continue;

    // Store level info
    const levels = {
      high: rangeHigh,
      low: rangeLow,
      date: dateStr,
      startTime: rangeEndCandle.time,
      endTime: lastCandle.time
    };
    allLevels.push(levels);

    // Create line data points for high line (green)
    highLines.push({ time: rangeEndCandle.time, value: rangeHigh });
    highLines.push({ time: lastCandle.time, value: rangeHigh });
    // Add a null point to break the line between days
    if (dayMap.size > 1) {
      highLines.push({ time: lastCandle.time + 1, value: null });
    }

    // Create line data points for low line (red)
    lowLines.push({ time: rangeEndCandle.time, value: rangeLow });
    lowLines.push({ time: lastCandle.time, value: rangeLow });
    // Add a null point to break the line between days
    if (dayMap.size > 1) {
      lowLines.push({ time: lastCandle.time + 1, value: null });
    }

    // Detect breakout and breakdown signals
    if (showSignals) {
      let breakoutDetected = false;
      let breakdownDetected = false;

      for (const candle of postRangeCandles) {
        // Breakout: Close above range high
        if (!breakoutDetected && candle.close > rangeHigh) {
          markers.push({
            time: candle.time,
            position: 'aboveBar',
            color: highColor,
            shape: 'arrowUp',
            text: 'BREAKOUT'
          });
          breakoutDetected = true;
        }

        // Breakdown: Close below range low
        if (!breakdownDetected && candle.close < rangeLow) {
          markers.push({
            time: candle.time,
            position: 'belowBar',
            color: lowColor,
            shape: 'arrowDown',
            text: 'BREAKDOWN'
          });
          breakdownDetected = true;
        }

        // If both detected, no need to continue
        if (breakoutDetected && breakdownDetected) break;
      }
    }
  }

  // Filter out null values for proper line rendering
  const filteredHighLines = highLines.filter(p => p.value !== null);
  const filteredLowLines = lowLines.filter(p => p.value !== null);

  return {
    highLines: filteredHighLines,
    lowLines: filteredLowLines,
    markers,
    allLevels
  };
};

/**
 * Get only the latest trading day's range breakout data
 * @param {Array} data - Array of OHLC candles
 * @param {Object} options - Configuration options
 * @returns {Object|null} - Latest day's range info or null
 */
export const getLatestRangeBreakout = (data, options = {}) => {
  const result = calculateRangeBreakout(data, options);

  if (result.allLevels.length === 0) {
    return null;
  }

  return result.allLevels[result.allLevels.length - 1];
};

export default calculateRangeBreakout;
