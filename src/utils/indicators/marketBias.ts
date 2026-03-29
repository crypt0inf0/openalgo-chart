/**
 * Market Bias (CEREBR) Indicator
 * Ported from Pine Script by Professeur_X
 *
 * Applies dual EMA smoothing mixed with Heikin Ashi calculations to establish market bias.
 */

import { OHLCData } from './types';

export interface MarketBiasResult {
  // Smoothed HA Candles
  o2: { time: number; value: number }[];
  c2: { time: number; value: number }[];
  h2: { time: number; value: number }[];
  l2: { time: number; value: number }[];
  
  // Oscillator Values (plotted as the band fill color)
  oscBias: { time: number; value: number }[];
  oscSmooth: { time: number; value: number }[];
  
  // Computed Signal Colors for each bar
  // "strongBull", "weakBull", "strongBear", "weakBear"
  sigColors: string[];
  candleColors: string[];
}

// Generic EMA calculator for number arrays
function calculateArrayEMA(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  const result: number[] = new Array(data.length).fill(NaN);
  
  const k = 2 / (period + 1);
  let ema: number | null = null;
  
  // Find first non-NaN value to start SMA
  let startIndex = 0;
  while (startIndex < data.length && isNaN(data[startIndex])) {
    startIndex++;
  }
  
  if (startIndex + period > data.length) return result; // Not enough data
  
  // Start with SMA
  let sum = 0;
  for (let i = startIndex; i < startIndex + period; i++) {
    sum += data[i];
  }
  ema = sum / period;
  result[startIndex + period - 1] = ema;
  
  for (let i = startIndex + period; i < data.length; i++) {
    ema = (data[i] - ema) * k + ema;
    result[i] = ema;
  }
  
  return result;
}

export function calculateMarketBias(
  data: OHLCData[],
  haLen: number = 100,
  haLen2: number = 100,
  oscLen: number = 7
): MarketBiasResult {
  if (!data || data.length === 0) {
    return {
      o2: [], c2: [], h2: [], l2: [],
      oscBias: [], oscSmooth: [],
      sigColors: [], candleColors: []
    };
  }

  const times = data.map(d => d.time);
  const rawO = data.map(d => d.open);
  const rawC = data.map(d => d.close);
  const rawH = data.map(d => d.high);
  const rawL = data.map(d => d.low);

  // 1. Smoothen the OHLC values
  const emaO = calculateArrayEMA(rawO, haLen);
  const emaC = calculateArrayEMA(rawC, haLen);
  const emaH = calculateArrayEMA(rawH, haLen);
  const emaL = calculateArrayEMA(rawL, haLen);

  // 2. Calculate the Heikin Ashi OHLC values from EMAs
  const haclose = new Array(data.length).fill(NaN);
  const xhaopen = new Array(data.length).fill(NaN);
  const haopen = new Array(data.length).fill(NaN);
  const hahigh = new Array(data.length).fill(NaN);
  const halow = new Array(data.length).fill(NaN);

  for (let i = 0; i < data.length; i++) {
    if (isNaN(emaO[i]) || isNaN(emaC[i]) || isNaN(emaH[i]) || isNaN(emaL[i])) {
      continue;
    }

    haclose[i] = (emaO[i] + emaH[i] + emaL[i] + emaC[i]) / 4;
    xhaopen[i] = (emaO[i] + emaC[i]) / 2;

    if (i === 0 || isNaN(xhaopen[i - 1])) {
      haopen[i] = (emaO[i] + emaC[i]) / 2;
    } else {
      haopen[i] = (xhaopen[i - 1] + haclose[i - 1]) / 2;
    }

    hahigh[i] = Math.max(emaH[i], Math.max(haopen[i], haclose[i]));
    halow[i] = Math.min(emaL[i], Math.min(haopen[i], haclose[i]));
  }

  // 3. Smoothen the Heiken Ashi Candles
  const emaO2 = calculateArrayEMA(haopen, haLen2);
  const emaC2 = calculateArrayEMA(haclose, haLen2);
  const emaH2 = calculateArrayEMA(hahigh, haLen2);
  const emaL2 = calculateArrayEMA(halow, haLen2);

  const o2Series: { time: number; value: number }[] = [];
  const c2Series: { time: number; value: number }[] = [];
  const h2Series: { time: number; value: number }[] = [];
  const l2Series: { time: number; value: number }[] = [];

  // 4. Oscillator
  const oscBiasRaw = new Array(data.length).fill(NaN);
  for (let i = 0; i < data.length; i++) {
    if (!isNaN(emaC2[i]) && !isNaN(emaO2[i])) {
      oscBiasRaw[i] = 100 * (emaC2[i] - emaO2[i]);
    }
  }

  const oscSmoothRaw = calculateArrayEMA(oscBiasRaw, oscLen);
  
  const oscBiasSeries: { time: number; value: number }[] = [];
  const oscSmoothSeries: { time: number; value: number }[] = [];
  const sigColors: string[] = [];
  const candleColors: string[] = [];

  for (let i = 0; i < data.length; i++) {
    if (!isNaN(emaO2[i]) && !isNaN(emaC2[i]) && !isNaN(emaH2[i]) && !isNaN(emaL2[i])) {
      o2Series.push({ time: times[i], value: emaO2[i] });
      c2Series.push({ time: times[i], value: emaC2[i] });
      h2Series.push({ time: times[i], value: emaH2[i] });
      l2Series.push({ time: times[i], value: emaL2[i] });

      const ob = oscBiasRaw[i];
      const os = oscSmoothRaw[i];
      
      oscBiasSeries.push({ time: times[i], value: ob });
      oscSmoothSeries.push({ time: times[i], value: os });

      // Calculate Colors
      let sig = 'none';
      if (ob > 0 && ob >= os) sig = 'strongBull';
      else if (ob > 0 && ob < os) sig = 'weakBull';
      else if (ob < 0 && ob <= os) sig = 'strongBear';
      else if (ob < 0 && ob > os) sig = 'weakBear';
      sigColors.push(sig);

      candleColors.push(emaO2[i] > emaC2[i] ? 'bear' : 'bull');
    }
  }

  return {
    o2: o2Series,
    c2: c2Series,
    h2: h2Series,
    l2: l2Series,
    oscBias: oscBiasSeries,
    oscSmooth: oscSmoothSeries,
    sigColors,
    candleColors
  };
}
