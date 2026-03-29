/**
 * Support and Resistance (High Volume Boxes) [ChartPrime]
 * Ported from Pine Script
 */

import { OHLCData } from './types';

export interface SRBox {
  type: 'support' | 'resistance';
  startIndex: number;
  endIndex: number;
  top: number;
  bottom: number;
  broken: boolean;
  holds: number[]; // Array of indices where the zone held
  breaks: number[]; // Array of indices where it was broken
}

export interface SRVolumeBoxesResult {
  supportBoxes: SRBox[];
  resistanceBoxes: SRBox[];
}

function calculateATR(data: OHLCData[], period: number): number[] {
  const result = new Array(data.length).fill(NaN);
  if (data.length === 0) return result;

  const tr = new Array(data.length).fill(NaN);
  tr[0] = data[0].high - data[0].low;

  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i - 1].close;
    tr[i] = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
  }

  // Initial SMA for first ATR
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += tr[i];
  }
  result[period - 1] = sum / period;

  // Smoothing for subsequent ATRs (RMA)
  for (let i = period; i < data.length; i++) {
    result[i] = (result[i - 1] * (period - 1) + tr[i]) / period;
  }

  return result;
}

export function calculateSRVolumeBoxes(
  data: OHLCData[],
  lookbackPeriod: number = 20,
  volLen: number = 2,
  boxWidthMult: number = 1
): SRVolumeBoxesResult {
  if (data.length < lookbackPeriod * 2) {
    return { supportBoxes: [], resistanceBoxes: [] };
  }

  const supportBoxes: SRBox[] = [];
  const resistanceBoxes: SRBox[] = [];

  const atrs = calculateATR(data, 200);

  const posVol = new Array(data.length).fill(0);
  const negVol = new Array(data.length).fill(0);
  const volDelta = new Array(data.length).fill(0);

  let isBuyVolume = true;

  for (let i = 0; i < data.length; i++) {
    const close = data[i].close;
    const open = data[i].open;
    const vol = data[i].volume || 0;

    if (close > open) isBuyVolume = true;
    else if (close < open) isBuyVolume = false;

    if (isBuyVolume) {
      posVol[i] = vol;
      negVol[i] = 0;
    } else {
      posVol[i] = 0;
      negVol[i] = -vol; // Note: original pine script says negVol -= volume, so negVol is negative
    }

    volDelta[i] = posVol[i] + negVol[i];
  }

  // Sliding window Max/Min for Volume
  const volHi = new Array(data.length).fill(NaN);
  const volLo = new Array(data.length).fill(NaN);

  for (let i = 0; i < data.length; i++) {
    if (i < volLen - 1) continue;

    let maxV = -Infinity;
    let minV = Infinity;
    for (let j = 0; j < volLen; j++) {
      const v = volDelta[i - j] / 2.5;
      if (v > maxV) maxV = v;
      if (v < minV) minV = v;
    }
    volHi[i] = maxV;
    volLo[i] = minV;
  }

  let currentSupBox: SRBox | null = null;
  let currentResBox: SRBox | null = null;

  for (let i = lookbackPeriod * 2; i < data.length; i++) {
    // Check pivot high (leftbars = lookbackPeriod, rightbars = lookbackPeriod)
    // A pivot high at index i - lookback means it is strictly the max among its neighbors
    const pivotIndex = i - lookbackPeriod;
    
    let isPivotHigh = true;
    let isPivotLow = true;

    for (let j = i - lookbackPeriod * 2; j <= i; j++) {
      if (j === pivotIndex) continue;
      
      // Pivot High
      if (data[j].high > data[pivotIndex].high) {
        isPivotHigh = false;
      } else if (data[j].high === data[pivotIndex].high && j > pivotIndex) {
        // Pine Script pivothigh ties usually break rightwards (first index wins) or return NA. We enforce strictly less for right side.
        isPivotHigh = false;
      }

      // Pivot Low
      if (data[j].low < data[pivotIndex].low) {
        isPivotLow = false;
      } else if (data[j].low === data[pivotIndex].low && j > pivotIndex) {
        isPivotLow = false;
      }

      if (!isPivotHigh && !isPivotLow) break;
    }

    const atr = isNaN(atrs[i]) ? (data[i].high - data[i].low) : atrs[i]; // fallback to candle range if ATR 200 not ready
    const width = atr * boxWidthMult;

    // Sup Box creation
    if (isPivotLow && volDelta[i] > volHi[i]) {
      const supportLevel = data[pivotIndex].low;
      const supportLevel_1 = supportLevel - width;

      currentSupBox = {
        type: 'support',
        startIndex: pivotIndex,
        endIndex: i, // starts tracking at confirmation index
        top: supportLevel,
        bottom: supportLevel_1,
        broken: false,
        holds: [],
        breaks: []
      };
      supportBoxes.push(currentSupBox);
    }

    // Res Box creation
    if (isPivotHigh && volDelta[i] < volLo[i]) {
      const resistanceLevel = data[pivotIndex].high;
      const resistanceLevel_1 = resistanceLevel + width;

      currentResBox = {
        type: 'resistance',
        startIndex: pivotIndex,
        endIndex: i,
        top: resistanceLevel_1,
        bottom: resistanceLevel,
        broken: false,
        holds: [],
        breaks: []
      };
      resistanceBoxes.push(currentResBox);
    }

    // Tracking breakouts & extending boxes
    if (currentSupBox && !currentSupBox.broken) {
      currentSupBox.endIndex = i;
      const low = data[i].low;
      const high = data[i].high;

      const sup_holds = low > currentSupBox.top; // ta.crossover(low, supportLevel) usually means low crossed over support Level, wait crossover is strictly crosses over previous bar low under support, current bar low over support. Let's simplify and just check bounding.
      // PineScript definition:
      // brekout_res := ta.crossover(low, resistanceLevel_1)
      // res_holds   := ta.crossunder(high, resistanceLevel)
      // sup_holds   := ta.crossover(low, supportLevel)
      // brekout_sup := ta.crossunder(high, supportLevel_1)

      const prevHigh = data[i - 1].high;
      const prevLow = data[i - 1].low;

      const brekout_sup = prevHigh >= currentSupBox.bottom && high < currentSupBox.bottom;
      const sup_holds_event = prevLow <= currentSupBox.top && low > currentSupBox.top;

      if (sup_holds_event) currentSupBox.holds.push(i);
      
      if (brekout_sup) {
        currentSupBox.breaks.push(i);
        currentSupBox.broken = true;
      }
    }

    if (currentResBox && !currentResBox.broken) {
      currentResBox.endIndex = i;
      const low = data[i].low;
      const high = data[i].high;
      
      const prevHigh = data[i - 1].high;
      const prevLow = data[i - 1].low;

      const brekout_res = prevLow <= currentResBox.top && low > currentResBox.top;
      const res_holds_event = prevHigh >= currentResBox.bottom && high < currentResBox.bottom;

      if (res_holds_event) currentResBox.holds.push(i);

      if (brekout_res) {
        currentResBox.breaks.push(i);
        currentResBox.broken = true;
      }
    }
    
    // Also track if old broken boxes hold as S/R flips
    // "Resistance as Support Holds"
  }

  return { supportBoxes, resistanceBoxes };
}
