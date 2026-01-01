/**
 * OI Profile Constants
 * Colors, default options, and PCR thresholds for Open Interest Profile
 */

// Color palette for OI Profile
export const OI_COLORS = {
  call: '#26a69a',           // Teal/green for calls
  put: '#ef5350',            // Red for puts
  atm: '#FFD700',            // Gold for ATM highlight
  atmBorder: '#FFA500',      // Orange for ATM border
  pcrBullish: '#26a69a',     // PCR < 0.8 (bullish)
  pcrBearish: '#ef5350',     // PCR > 1.2 (bearish)
  pcrNeutral: '#787b86',     // 0.8 <= PCR <= 1.2
  labelText: '#d1d4dc',      // Text color
  labelBg: 'rgba(30, 34, 45, 0.9)', // Label background
};

// OI Sense Colors - Used for interpreting OI changes with price
export const OI_SENSE_COLORS = {
  // Long Buildup: Price↑ + OI↑ - Fresh longs entering, bullish
  longBuildup: '#4CAF50',           // Bright Green
  longBuildupFill: 'rgba(76, 175, 80, 0.3)',
  longBuildupLabel: 'Long Buildup',

  // Short Buildup: Price↓ + OI↑ - Fresh shorts entering, bearish
  shortBuildup: '#F44336',          // Bright Red
  shortBuildupFill: 'rgba(244, 67, 54, 0.3)',
  shortBuildupLabel: 'Short Buildup',

  // Short Covering: Price↑ + OI↓ - Shorts exiting, mildly bullish
  shortCovering: '#FF9800',         // Orange
  shortCoveringFill: 'rgba(255, 152, 0, 0.3)',
  shortCoveringLabel: 'Short Covering',

  // Long Unwinding: Price↓ + OI↓ - Longs exiting, mildly bearish
  longUnwinding: '#00BCD4',         // Cyan
  longUnwindingFill: 'rgba(0, 188, 212, 0.3)',
  longUnwindingLabel: 'Long Unwinding',

  // Neutral - No significant change
  neutral: '#9E9E9E',               // Grey
  neutralFill: 'rgba(158, 158, 158, 0.2)',
  neutralLabel: 'Neutral',
};

// OI Sense signal types
export const OI_SENSE_SIGNALS = {
  LONG_BUILDUP: 'longBuildup',
  SHORT_BUILDUP: 'shortBuildup',
  SHORT_COVERING: 'shortCovering',
  LONG_UNWINDING: 'longUnwinding',
  NEUTRAL: 'neutral',
};

// PCR interpretation thresholds
export const PCR_THRESHOLDS = {
  bullish: 0.7,    // Below this = bullish (more calls than puts)
  bearish: 1.3,    // Above this = bearish (more puts than calls)
};

// Default options for OI Profile primitive
export const DEFAULT_OI_PROFILE_OPTIONS = {
  // Visibility
  visible: true,
  enabled: false,
  hidden: false,

  // Display modes
  showTop5Only: false,       // Filter to top 5 OI strikes
  compactMode: false,        // Reduce bar thickness
  position: 'right',         // 'left' or 'right' side of chart

  // Bar settings
  barHeight: 12,             // Height of each OI bar (compactMode: 8)
  barHeightCompact: 8,       // Height in compact mode
  maxBarWidth: 100,          // Maximum bar width in pixels
  barSpacing: 2,             // Space between Call and Put bars
  barOpacity: 0.85,          // Bar opacity (0-1)

  // Colors
  callColor: OI_COLORS.call,
  putColor: OI_COLORS.put,
  atmHighlightColor: OI_COLORS.atm,
  atmBorderColor: OI_COLORS.atmBorder,

  // Labels
  showOIValues: true,        // Show OI numbers on bars
  showPCR: true,             // Show PCR value at top
  showStrikeLabels: false,   // Show strike prices on each bar
  showTotalOI: true,         // Show total OI summary

  // Font
  fontSize: 10,
  fontFamily: 'Arial, sans-serif',

  // Strike filtering
  maxStrikes: 20,            // Maximum strikes to display
  strikeGap: 0,              // Minimum gap between displayed strikes (0 = show all)

  // OI Sense options
  showOISense: true,         // Enable OI Sense color bands
  oiSenseThreshold: 0.5,     // Minimum % change to trigger OI Sense signal
  showOISenseLabel: true,    // Show OI Sense signal label
};

/**
 * Get PCR color based on value
 * @param {number} pcr - Put/Call Ratio
 * @returns {string} Color hex code
 */
export const getPCRColor = (pcr) => {
  if (pcr < PCR_THRESHOLDS.bullish) return OI_COLORS.pcrBullish;
  if (pcr > PCR_THRESHOLDS.bearish) return OI_COLORS.pcrBearish;
  return OI_COLORS.pcrNeutral;
};

/**
 * Get PCR interpretation label
 * @param {number} pcr - Put/Call Ratio
 * @returns {string} Interpretation
 */
export const getPCRLabel = (pcr) => {
  if (pcr < PCR_THRESHOLDS.bullish) return 'Bullish';
  if (pcr > PCR_THRESHOLDS.bearish) return 'Bearish';
  return 'Neutral';
};

/**
 * Format OI value for display
 * Uses Indian number system (K, L, Cr)
 * @param {number} oi - Open Interest value
 * @returns {string} Formatted string
 */
export const formatOIValue = (oi) => {
  if (!oi || oi === 0) return '0';
  if (oi >= 10000000) return `${(oi / 10000000).toFixed(1)}Cr`;
  if (oi >= 100000) return `${(oi / 100000).toFixed(1)}L`;
  if (oi >= 1000) return `${(oi / 1000).toFixed(1)}K`;
  return oi.toString();
};

/**
 * Get OI Sense signal based on price and OI changes
 * @param {number} priceChange - Price change (positive = up, negative = down)
 * @param {number} oiChange - OI change (positive = increased, negative = decreased)
 * @param {number} threshold - Minimum % change to trigger (default 0)
 * @returns {Object} { signal, color, fill, label }
 */
export const getOISenseSignal = (priceChange, oiChange, threshold = 0) => {
  // Check if changes are significant enough
  const priceUp = priceChange > threshold;
  const priceDown = priceChange < -threshold;
  const oiUp = oiChange > threshold;
  const oiDown = oiChange < -threshold;

  // Long Buildup: Price up + OI up
  if (priceUp && oiUp) {
    return {
      signal: OI_SENSE_SIGNALS.LONG_BUILDUP,
      color: OI_SENSE_COLORS.longBuildup,
      fill: OI_SENSE_COLORS.longBuildupFill,
      label: OI_SENSE_COLORS.longBuildupLabel,
      sentiment: 'bullish',
      strength: 'strong',
    };
  }

  // Short Buildup: Price down + OI up
  if (priceDown && oiUp) {
    return {
      signal: OI_SENSE_SIGNALS.SHORT_BUILDUP,
      color: OI_SENSE_COLORS.shortBuildup,
      fill: OI_SENSE_COLORS.shortBuildupFill,
      label: OI_SENSE_COLORS.shortBuildupLabel,
      sentiment: 'bearish',
      strength: 'strong',
    };
  }

  // Short Covering: Price up + OI down
  if (priceUp && oiDown) {
    return {
      signal: OI_SENSE_SIGNALS.SHORT_COVERING,
      color: OI_SENSE_COLORS.shortCovering,
      fill: OI_SENSE_COLORS.shortCoveringFill,
      label: OI_SENSE_COLORS.shortCoveringLabel,
      sentiment: 'bullish',
      strength: 'weak',
    };
  }

  // Long Unwinding: Price down + OI down
  if (priceDown && oiDown) {
    return {
      signal: OI_SENSE_SIGNALS.LONG_UNWINDING,
      color: OI_SENSE_COLORS.longUnwinding,
      fill: OI_SENSE_COLORS.longUnwindingFill,
      label: OI_SENSE_COLORS.longUnwindingLabel,
      sentiment: 'bearish',
      strength: 'weak',
    };
  }

  // Neutral
  return {
    signal: OI_SENSE_SIGNALS.NEUTRAL,
    color: OI_SENSE_COLORS.neutral,
    fill: OI_SENSE_COLORS.neutralFill,
    label: OI_SENSE_COLORS.neutralLabel,
    sentiment: 'neutral',
    strength: 'none',
  };
};

/**
 * Get OI Sense color for a strike based on OI change and price context
 * @param {Object} strike - Strike data with current and previous OI
 * @param {number} priceChange - Overall price change
 * @returns {Object} Color info for the strike
 */
export const getStrikeOISenseColor = (strike, priceChange) => {
  const callOIChange = strike.ce?.oiChange || 0;
  const putOIChange = strike.pe?.oiChange || 0;

  // Calculate net OI change effect
  // For calls: OI increase is bullish, decrease is bearish
  // For puts: OI increase is bearish, decrease is bullish
  const netEffect = callOIChange - putOIChange;

  return getOISenseSignal(priceChange, netEffect);
};

export default {
  OI_COLORS,
  OI_SENSE_COLORS,
  OI_SENSE_SIGNALS,
  PCR_THRESHOLDS,
  DEFAULT_OI_PROFILE_OPTIONS,
  getPCRColor,
  getPCRLabel,
  formatOIValue,
  getOISenseSignal,
  getStrikeOISenseColor,
};
