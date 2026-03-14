/**
 * UT Bot Alerts Indicator
 * 
 * Ported from Pine Script v4
 */

import { OHLCData, UTBotAlertsPoint } from './types';

/**
 * Calculate UT Bot Alerts indicator
 * @param data - OHLC data
 * @param keyValues - Sensitivity (default: 1)
 * @param atrPeriod - ATR period (default: 10)
 * @returns Array of UTBotAlertsPoint
 */
export function calculateUTBotAlerts(
  data: OHLCData[],
  keyValues: number = 1,
  atrPeriod: number = 10
): UTBotAlertsPoint[] {
  if (!data || data.length < atrPeriod + 1) {
    return [];
  }

  const result: UTBotAlertsPoint[] = [];

  // 1. Calculate ATR
  const trueRanges: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      trueRanges.push(data[i].high - data[i].low);
    } else {
      const high = data[i].high;
      const low = data[i].low;
      const prevClose = data[i - 1].close;
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }
  }

  // Calculate ATR (RMA of True Range as per version 4 atr(c))
  const atrValues: (number | null)[] = [];
  let prevAtr = 0;
  for (let i = 0; i < data.length; i++) {
    if (i < atrPeriod - 1) {
      atrValues.push(null);
    } else if (i === atrPeriod - 1) {
      let sum = 0;
      for (let j = 0; j < atrPeriod; j++) {
        sum += trueRanges[j];
      }
      prevAtr = sum / atrPeriod;
      atrValues.push(prevAtr);
    } else {
      prevAtr = (trueRanges[i] + (atrPeriod - 1) * prevAtr) / atrPeriod;
      atrValues.push(prevAtr);
    }
  }

  // 2. Main Logic
  let xATRTrailingStop = 0;
  let pos = 0;
  let prevEma = 0;

  for (let i = 0; i < data.length; i++) {
    if (atrValues[i] === null) continue;

    const src = data[i].close;
    const prevSrc = i > 0 ? data[i - 1].close : src;
    const nLoss = keyValues * (atrValues[i] as number);

    // xATRTrailingStop calculation
    const prevTrailingStop = xATRTrailingStop;
    
    if (src > prevTrailingStop && prevSrc > prevTrailingStop) {
      xATRTrailingStop = Math.max(prevTrailingStop, src - nLoss);
    } else if (src < prevTrailingStop && prevSrc < prevTrailingStop) {
      xATRTrailingStop = Math.min(prevTrailingStop, src + nLoss);
    } else if (src > prevTrailingStop) {
      xATRTrailingStop = src - nLoss;
    } else {
      xATRTrailingStop = src + nLoss;
    }

    // Position calculation
    const prevPos = pos;
    if (prevSrc < prevTrailingStop && src > prevTrailingStop) {
      pos = 1;
    } else if (prevSrc > prevTrailingStop && src < prevTrailingStop) {
      pos = -1;
    } else {
      pos = prevPos;
    }

    // EMA(1) of src is basically just src
    const ema = src; 
    
    // Crossovers
    // crossover(ema, xATRTrailingStop) -> prevEma <= prevTrailingStop && ema > xATRTrailingStop
    // crossover(xATRTrailingStop, ema) -> prevTrailingStop <= prevEma && xATRTrailingStop > ema
    
    const above = prevEma <= prevTrailingStop && ema > xATRTrailingStop;
    const below = prevTrailingStop <= prevEma && xATRTrailingStop > ema;

    const buy = src > xATRTrailingStop && above;
    const sell = src < xATRTrailingStop && below;

    result.push({
      time: data[i].time,
      trailingStop: xATRTrailingStop,
      buy,
      sell,
      trend: pos === 1 ? 1 : -1
    });

    prevEma = ema;
  }

  return result;
}

export default calculateUTBotAlerts;
