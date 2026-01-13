/**
 * Average Directional Index (ADX) Indicator
 * Measures trend strength regardless of direction
 * 
 * Components:
 * - +DI: Positive Directional Indicator (buying pressure)
 * - -DI: Negative Directional Indicator (selling pressure)
 * - ADX: Average Directional Index (trend strength, 0-100)
 * 
 * Interpretation:
 * - ADX > 25: Strong trend
 * - ADX < 20: Weak trend or ranging
 * - +DI > -DI: Bullish
 * - -DI > +DI: Bearish
 *
 * @param {Array} data - Array of OHLC data points with {time, open, high, low, close}
 * @param {number} period - Smoothing period (default: 14)
 * @returns {Object} { adx: [], plusDI: [], minusDI: [] } - Arrays of {time, value}
 */
export function calculateADX(data, period = 14) {
    if (!Array.isArray(data) || data.length < period + 1) {
        return { adx: [], plusDI: [], minusDI: [] };
    }

    const plusDI = [];
    const minusDI = [];
    const adx = [];

    // Calculate True Range, +DM, -DM for each bar
    const trueRanges = [];
    const plusDMs = [];
    const minusDMs = [];

    for (let i = 1; i < data.length; i++) {
        const high = data[i].high;
        const low = data[i].low;
        const prevHigh = data[i - 1].high;
        const prevLow = data[i - 1].low;
        const prevClose = data[i - 1].close;

        // True Range
        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );
        trueRanges.push(tr);

        // Directional Movement
        const upMove = high - prevHigh;
        const downMove = prevLow - low;

        // +DM: If upMove > downMove AND upMove > 0, then +DM = upMove, else 0
        const plusDM = (upMove > downMove && upMove > 0) ? upMove : 0;
        // -DM: If downMove > upMove AND downMove > 0, then -DM = downMove, else 0
        const minusDM = (downMove > upMove && downMove > 0) ? downMove : 0;

        plusDMs.push(plusDM);
        minusDMs.push(minusDM);
    }

    // Calculate smoothed TR, +DM, -DM using Wilder's smoothing
    let smoothedTR = 0;
    let smoothedPlusDM = 0;
    let smoothedMinusDM = 0;

    // First smoothed values are SMA of first 'period' values
    for (let i = 0; i < period; i++) {
        smoothedTR += trueRanges[i];
        smoothedPlusDM += plusDMs[i];
        smoothedMinusDM += minusDMs[i];
    }

    // Calculate first +DI and -DI
    let firstPlusDI = smoothedTR > 0 ? (smoothedPlusDM / smoothedTR) * 100 : 0;
    let firstMinusDI = smoothedTR > 0 ? (smoothedMinusDM / smoothedTR) * 100 : 0;

    plusDI.push({ time: data[period].time, value: firstPlusDI });
    minusDI.push({ time: data[period].time, value: firstMinusDI });

    // Calculate first DX
    const firstDXSum = firstPlusDI + firstMinusDI;
    const firstDX = firstDXSum > 0 ? (Math.abs(firstPlusDI - firstMinusDI) / firstDXSum) * 100 : 0;

    // Store DX values for ADX smoothing
    const dxValues = [firstDX];

    // Calculate subsequent values using Wilder's smoothing
    for (let i = period; i < trueRanges.length; i++) {
        // Wilder's smoothing: smoothed = prev_smoothed - (prev_smoothed / period) + current_value
        smoothedTR = smoothedTR - (smoothedTR / period) + trueRanges[i];
        smoothedPlusDM = smoothedPlusDM - (smoothedPlusDM / period) + plusDMs[i];
        smoothedMinusDM = smoothedMinusDM - (smoothedMinusDM / period) + minusDMs[i];

        // +DI and -DI
        const currentPlusDI = smoothedTR > 0 ? (smoothedPlusDM / smoothedTR) * 100 : 0;
        const currentMinusDI = smoothedTR > 0 ? (smoothedMinusDM / smoothedTR) * 100 : 0;

        plusDI.push({ time: data[i + 1].time, value: currentPlusDI });
        minusDI.push({ time: data[i + 1].time, value: currentMinusDI });

        // DX
        const dxSum = currentPlusDI + currentMinusDI;
        const dx = dxSum > 0 ? (Math.abs(currentPlusDI - currentMinusDI) / dxSum) * 100 : 0;
        dxValues.push(dx);
    }

    // Calculate ADX (smoothed DX) - requires 'period' DX values
    if (dxValues.length >= period) {
        // First ADX is SMA of first 'period' DX values
        let smoothedADX = 0;
        for (let i = 0; i < period; i++) {
            smoothedADX += dxValues[i];
        }
        smoothedADX /= period;

        // The first ADX corresponds to the period-th +DI value
        const adxStartIndex = period - 1;
        adx.push({ time: plusDI[adxStartIndex].time, value: smoothedADX });

        // Subsequent ADX values use Wilder's smoothing
        for (let i = period; i < dxValues.length; i++) {
            smoothedADX = ((smoothedADX * (period - 1)) + dxValues[i]) / period;
            adx.push({ time: plusDI[i].time, value: smoothedADX });
        }
    }

    return { adx, plusDI, minusDI };
}

export default calculateADX;
