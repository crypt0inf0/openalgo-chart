/**
 * Red Candle Supply/Demand Zones Indicator
 * Ported from Pine Script: "Red Candle Zones [Continuous]"
 *
 * Tracks the intraday HIGHEST and LOWEST valid red candle per day.
 * Valid red candle = close < open AND body ≥ minBodyPct of range.
 *
 * - Highest red candle → Supply Zone (red box)
 * - Lowest red candle  → Demand Zone (green box)
 *
 * Zones draw from root candle time → extend to end of that day.
 */

export interface RedCandleZoneLevel {
  high: number;
  low: number;
  rootTime: number;  // unix seconds of the root (trigger) candle
  startTime: number; // same as rootTime for drawing
  endTime: number;   // last bar time of that day
  type: 'supply' | 'demand';
}

export interface RedCandleZonesResult {
  supplyZones: RedCandleZoneLevel[];
  demandZones: RedCandleZoneLevel[];
}

export interface RedCandleZonesOptions {
  minBodyPct?: number; // Min body size as % of candle range (default 40)
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface DayData {
  candles: Candle[];
  highestRed: Candle | null;  // candle with highest high among valid reds
  lowestRed: Candle | null;   // candle with lowest low among valid reds
}

/**
 * Calculate Red Candle Supply/Demand Zones
 */
export function calculateRedCandleZones(
  data: Candle[],
  options: RedCandleZonesOptions = {}
): RedCandleZonesResult {
  const { minBodyPct = 40 } = options;

  if (!Array.isArray(data) || data.length === 0) {
    return { supplyZones: [], demandZones: [] };
  }

  // ── Group intraday candles by date ──────────────────────────────────────────
  const dayMap = new Map<string, DayData>();

  for (const bar of data) {
    const d = new Date(bar.time * 1000);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

    if (!dayMap.has(key)) {
      dayMap.set(key, { candles: [], highestRed: null, lowestRed: null });
    }
    dayMap.get(key)!.candles.push(bar);
  }

  // ── For each day, find highest/lowest valid red candle ─────────────────────
  for (const dayData of dayMap.values()) {
    for (const bar of dayData.candles) {
      const isRed      = bar.close < bar.open;
      const bodySize   = Math.abs(bar.close - bar.open);
      const range      = bar.high - bar.low;
      const bodyPct    = range > 0 ? (bodySize / range) * 100 : 0;
      const isValid    = isRed && bodyPct >= minBodyPct;

      if (!isValid) continue;

      // Track highest high (supply zone candidate)
      if (!dayData.highestRed || bar.high > dayData.highestRed.high) {
        dayData.highestRed = bar;
      }

      // Track lowest low (demand zone candidate)
      if (!dayData.lowestRed || bar.low < dayData.lowestRed.low) {
        dayData.lowestRed = bar;
      }
    }
  }

  // ── Build zone arrays ───────────────────────────────────────────────────────
  const supplyZones: RedCandleZoneLevel[] = [];
  const demandZones: RedCandleZoneLevel[] = [];

  const sortedDays = Array.from(dayMap.entries()).sort((a, b) => a[0] < b[0] ? -1 : 1);

  for (const [, dayData] of sortedDays) {
    if (dayData.candles.length === 0) continue;

    const firstTime = dayData.candles[0].time;
    const lastTime  = dayData.candles[dayData.candles.length - 1].time;

    // Ensure a span of at least 1 second
    const endTime = lastTime > firstTime ? lastTime : firstTime + 1;

    if (dayData.highestRed) {
      supplyZones.push({
        high: dayData.highestRed.high,
        low:  dayData.highestRed.low,
        rootTime:  dayData.highestRed.time,
        startTime: dayData.highestRed.time,
        endTime,
        type: 'supply',
      });
    }

    if (dayData.lowestRed) {
      demandZones.push({
        high: dayData.lowestRed.high,
        low:  dayData.lowestRed.low,
        rootTime:  dayData.lowestRed.time,
        startTime: dayData.lowestRed.time,
        endTime,
        type: 'demand',
      });
    }
  }

  return { supplyZones, demandZones };
}

export default calculateRedCandleZones;
