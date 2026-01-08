/**
 * TPO Profile Constants
 * Color palettes, block sizes, and configuration constants
 * Based on TradingView TPO chart specifications
 */

// Block size options (TPO period duration)
export const BLOCK_SIZE_MAP = {
    '5m': 5,
    '10m': 10,
    '15m': 15,
    '30m': 30,   // Default
    '1h': 60,
    '2h': 120,
    '4h': 240,
};

export const BLOCK_SIZE_OPTIONS = Object.keys(BLOCK_SIZE_MAP);
export const DEFAULT_BLOCK_SIZE = '30m';

// Color gradients for TPO letters
// A-Z (uppercase) uses cyan gradient - early session
// a-z (lowercase) uses pink/red gradient - late session
export const TPO_GRADIENTS = {
    upper: {
        start: '#00ACC1',  // Cyan 600 (Darker)
        end: '#006064',    // Cyan 900
    },
    lower: {
        start: '#D81B60',  // Pink 600 (Darker)
        end: '#880E4F',    // Pink 900
    },
};

// Pre-calculated letter colors for performance
// Interpolates between gradient start/end for each letter position
const interpolateColor = (color1, color2, t) => {
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);

    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

// Generate color lookup table for all letters
const generateLetterColors = () => {
    const colors = {};

    // A-Z (uppercase): periods 0-25
    for (let i = 0; i < 26; i++) {
        const letter = String.fromCharCode(65 + i); // A-Z
        const t = i / 25; // 0 to 1
        colors[letter] = interpolateColor(TPO_GRADIENTS.upper.start, TPO_GRADIENTS.upper.end, t);
    }

    // a-z (lowercase): periods 26-51
    for (let i = 0; i < 26; i++) {
        const letter = String.fromCharCode(97 + i); // a-z
        const t = i / 25; // 0 to 1
        colors[letter] = interpolateColor(TPO_GRADIENTS.lower.start, TPO_GRADIENTS.lower.end, t);
    }

    // Fallback for extended sessions
    colors['*'] = '#9E9E9E'; // Gray

    return colors;
};

export const LETTER_COLORS = generateLetterColors();

/**
 * Get color for a specific TPO letter
 * @param {string} letter - The TPO letter (A-Z, a-z, or *)
 * @returns {string} Hex color code
 */
export const getLetterColor = (letter) => {
    return LETTER_COLORS[letter] || LETTER_COLORS['*'];
};

// Line colors for TPO elements
export const TPO_LINE_COLORS = {
    poc: '#FF9800',        // Orange - Point of Control
    vah: '#26a69a',        // Teal - Value Area High
    val: '#ef5350',        // Red - Value Area Low
    poorHigh: '#ef5350',   // Red - Weak high
    poorLow: '#26a69a',    // Teal - Weak low
    singlePrint: '#FFEB3B', // Yellow - Single print zones
    midpoint: '#9C27B0',   // Purple - TPO midpoint
    ibBorder: 'rgba(33, 150, 243, 0.5)', // Blue - Initial Balance border
    ibFill: 'rgba(33, 150, 243, 0.1)',   // Blue - Initial Balance fill
    valueArea: 'rgba(33, 150, 243, 0.08)', // Blue - Value area fill
};

// Summary stats that can be displayed
export const AVAILABLE_STATS = [
    'VAH',
    'VAL',
    'POC',
    'Rotation factor',
    'IB high',
    'IB low',
    'IB range',
    'HL range',
    'VA range',
    'Total volume',
    'Total TPO',
    'TPO above POC',
    'TPO below POC',
];

export const DEFAULT_VISIBLE_STATS = [
    'VAH',
    'VAL',
    'POC',
    'Rotation factor',
    'IB high',
    'IB low',
    'IB range',
];

// Default TPO options
export const DEFAULT_TPO_OPTIONS = {
    enabled: false,
    blockSize: '30m',
    rowSize: 'auto',

    // Summary info
    showSummaryInfo: true,
    summaryStats: DEFAULT_VISIBLE_STATS,

    // Lines & Labels
    showPOC: true,
    showPoorHigh: false,
    showPoorLow: false,
    showSinglePrints: false,
    showVAH: true,
    showVAL: true,
    showMidpoint: false,
    showOpen: false,
    showClose: false,
    showInitialBalance: true,
    showValueArea: true,
    showLetters: true,

    // Display
    position: 'right',
    letterWidth: 12,
    letterHeight: 14,
    letterSpacing: 2,
    maxLettersVisible: 26,
    fontSize: 11,
    fontFamily: 'Arial, sans-serif',

    // Colors (can override defaults)
    colors: {
        ...TPO_LINE_COLORS,
        upperGradient: TPO_GRADIENTS.upper,
        lowerGradient: TPO_GRADIENTS.lower,
    },
};

export default {
    BLOCK_SIZE_MAP,
    BLOCK_SIZE_OPTIONS,
    DEFAULT_BLOCK_SIZE,
    TPO_GRADIENTS,
    LETTER_COLORS,
    getLetterColor,
    TPO_LINE_COLORS,
    AVAILABLE_STATS,
    DEFAULT_VISIBLE_STATS,
    DEFAULT_TPO_OPTIONS,
};
