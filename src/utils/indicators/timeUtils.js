/**
 * Time Utilities for Indian Stock Market Indicators
 * Shared utilities for IST time conversions and market hours checks.
 */

/**
 * Convert timestamp to IST date components
 * Note: The candle data already has IST offset applied from the API
 * @param {number} timestamp - Unix timestamp in seconds (already in IST)
 * @returns {Object} - { hours, minutes, dateStr }
 */
export const getISTComponents = (timestamp) => {
  const date = new Date(timestamp * 1000);
  return {
    hours: date.getUTCHours(),
    minutes: date.getUTCMinutes(),
    dateStr: date.toISOString().split('T')[0] // YYYY-MM-DD
  };
};

/**
 * Check if a candle is within market hours (9:15 AM - 3:30 PM IST)
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {boolean}
 */
export const isMarketHours = (timestamp) => {
  const { hours, minutes } = getISTComponents(timestamp);
  const timeInMinutes = hours * 60 + minutes;
  const marketOpen = 9 * 60 + 15;  // 9:15 AM
  const marketClose = 15 * 60 + 30; // 3:30 PM
  return timeInMinutes >= marketOpen && timeInMinutes <= marketClose;
};

/**
 * Check if a candle is within a specific time window
 * @param {number} timestamp - Unix timestamp in seconds
 * @param {number} startHour - Window start hour
 * @param {number} startMinute - Window start minute
 * @param {number} endHour - Window end hour
 * @param {number} endMinute - Window end minute
 * @returns {boolean}
 */
export const isInTimeWindow = (timestamp, startHour, startMinute, endHour, endMinute) => {
  const { hours, minutes } = getISTComponents(timestamp);
  const timeInMinutes = hours * 60 + minutes;
  const windowStart = startHour * 60 + startMinute;
  const windowEnd = endHour * 60 + endMinute;
  return timeInMinutes >= windowStart && timeInMinutes < windowEnd;
};

/**
 * Check if a candle is after a specific time
 * @param {number} timestamp - Unix timestamp in seconds
 * @param {number} hour - Hour to check against
 * @param {number} minute - Minute to check against
 * @returns {boolean}
 */
export const isAfterTime = (timestamp, hour, minute) => {
  const { hours, minutes } = getISTComponents(timestamp);
  const timeInMinutes = hours * 60 + minutes;
  const targetTime = hour * 60 + minute;
  return timeInMinutes >= targetTime;
};

/**
 * Get market open time for IST (9:15 AM)
 * @returns {Object} - { hours: 9, minutes: 15 }
 */
export const getMarketOpenTime = () => ({
  hours: 9,
  minutes: 15
});

/**
 * Get market close time for IST (3:30 PM)
 * @returns {Object} - { hours: 15, minutes: 30 }
 */
export const getMarketCloseTime = () => ({
  hours: 15,
  minutes: 30
});

/**
 * Convert hours and minutes to total minutes since midnight
 * @param {number} hours
 * @param {number} minutes
 * @returns {number}
 */
export const toMinutesSinceMidnight = (hours, minutes) => {
  return hours * 60 + minutes;
};

/**
 * Group candles by trading day
 * @param {Array} data - Array of candles with time property
 * @returns {Map} - Map of dateStr -> candles array
 */
export const groupCandlesByDay = (data) => {
  const dayMap = new Map();

  for (const candle of data) {
    const { dateStr } = getISTComponents(candle.time);
    if (!dayMap.has(dateStr)) {
      dayMap.set(dateStr, []);
    }
    dayMap.get(dateStr).push(candle);
  }

  return dayMap;
};
