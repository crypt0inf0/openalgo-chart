/**
 * useOrderFlow Hook
 * Manages Order Flow primitives and tick data subscription for charts
 *
 * Usage in ChartComponent:
 *   const orderFlow = useOrderFlow({
 *     symbol, exchange, mainSeries, chart, enabled: orderFlowSettings.enabled
 *   });
 *
 *   // In useEffect:
 *   orderFlow.updateData(data);
 *   orderFlow.applySettings(orderFlowSettings);
 */

import { useRef, useEffect, useCallback } from 'react';
import { subscribeToTicks, unsubscribe as unsubscribeTicks } from '../services/tickDataService';
import {
    aggregateTicksToFootprint,
    calculateDelta,
    calculateCumulativeDelta,
    calculatePOC,
    calculateValueArea,
} from '../utils/orderFlow';
import { detectPowerTrades } from '../utils/orderFlow/orderFlowEngine';

// Import primitives
import { FootprintPrimitive } from '../plugins/footprint-chart';
import { VolumeProfilePrimitive } from '../plugins/volume-profile';
import { DeltaPrimitive, CumulativeDeltaPrimitive } from '../plugins/delta-profile';
import { BarStatsPrimitive } from '../plugins/bar-stats';
import { PowerTradesPrimitive } from '../plugins/power-trades';

import { DEFAULT_ORDER_FLOW_SETTINGS } from '../components/OrderFlow/OrderFlowSettingsPanel';

/**
 * Hook for managing Order Flow analysis features
 */
export const useOrderFlow = ({
    symbol,
    exchange = 'NSE',
    chart,
    mainSeries,
    enabled = false,
    settings = DEFAULT_ORDER_FLOW_SETTINGS,
}) => {
    // Primitive refs
    const footprintRef = useRef(null);
    const volumeProfileRef = useRef(null);
    const deltaRef = useRef(null);
    const cumulativeDeltaRef = useRef(null);
    const barStatsRef = useRef(null);
    const powerTradesRef = useRef(null);

    // Data refs
    const tickBufferRef = useRef([]);
    const footprintDataRef = useRef([]);
    const candleDataRef = useRef([]);
    const unsubscribeRef = useRef(null);

    /**
     * Initialize primitives and attach to series
     */
    const initializePrimitives = useCallback(() => {
        if (!mainSeries || !chart) return;

        // Footprint primitive
        if (settings.footprint?.enabled && !footprintRef.current) {
            footprintRef.current = new FootprintPrimitive({
                ...settings.footprint,
                visible: true,
            });
            try {
                mainSeries.attachPrimitive(footprintRef.current);
            } catch (e) {
                console.warn('[useOrderFlow] Error attaching footprint:', e);
            }
        }

        // Volume Profile primitive
        if (settings.volumeProfile?.enabled && !volumeProfileRef.current) {
            volumeProfileRef.current = new VolumeProfilePrimitive({
                ...settings.volumeProfile,
            });
            try {
                mainSeries.attachPrimitive(volumeProfileRef.current);
            } catch (e) {
                console.warn('[useOrderFlow] Error attaching volume profile:', e);
            }
        }

        // Delta primitive
        if (settings.delta?.enabled && settings.delta?.showDeltaBars && !deltaRef.current) {
            deltaRef.current = new DeltaPrimitive({
                panelHeight: settings.delta.panelHeight || 80,
                buyColor: settings.delta.buyColor,
                sellColor: settings.delta.sellColor,
            });
            try {
                mainSeries.attachPrimitive(deltaRef.current);
            } catch (e) {
                console.warn('[useOrderFlow] Error attaching delta:', e);
            }
        }

        // Cumulative Delta primitive
        if (settings.delta?.enabled && settings.delta?.showCumulativeDelta && !cumulativeDeltaRef.current) {
            cumulativeDeltaRef.current = new CumulativeDeltaPrimitive({
                lineColor: settings.delta.lineColor,
                showDivergence: settings.delta.showDivergence,
            });
            try {
                mainSeries.attachPrimitive(cumulativeDeltaRef.current);
            } catch (e) {
                console.warn('[useOrderFlow] Error attaching cumulative delta:', e);
            }
        }

        // Bar Stats primitive
        if (settings.barStats?.enabled && !barStatsRef.current) {
            barStatsRef.current = new BarStatsPrimitive({
                ...settings.barStats,
            });
            try {
                mainSeries.attachPrimitive(barStatsRef.current);
            } catch (e) {
                console.warn('[useOrderFlow] Error attaching bar stats:', e);
            }
        }

        // Power Trades primitive
        if (settings.powerTrades?.enabled && !powerTradesRef.current) {
            powerTradesRef.current = new PowerTradesPrimitive({
                ...settings.powerTrades,
            });
            try {
                mainSeries.attachPrimitive(powerTradesRef.current);
            } catch (e) {
                console.warn('[useOrderFlow] Error attaching power trades:', e);
            }
        }
    }, [mainSeries, chart, settings]);

    /**
     * Cleanup primitives
     */
    const cleanupPrimitives = useCallback(() => {
        if (!mainSeries) return;

        const primitives = [
            { ref: footprintRef, name: 'footprint' },
            { ref: volumeProfileRef, name: 'volumeProfile' },
            { ref: deltaRef, name: 'delta' },
            { ref: cumulativeDeltaRef, name: 'cumulativeDelta' },
            { ref: barStatsRef, name: 'barStats' },
            { ref: powerTradesRef, name: 'powerTrades' },
        ];

        primitives.forEach(({ ref, name }) => {
            if (ref.current) {
                try {
                    mainSeries.detachPrimitive(ref.current);
                } catch (e) {
                    console.warn(`[useOrderFlow] Error detaching ${name}:`, e);
                }
                ref.current = null;
            }
        });
    }, [mainSeries]);

    /**
     * Handle incoming tick data
     */
    const handleTick = useCallback((tick) => {
        tickBufferRef.current.push(tick);

        // Limit buffer size
        if (tickBufferRef.current.length > 10000) {
            tickBufferRef.current = tickBufferRef.current.slice(-5000);
        }

        // Process power trades in real-time
        if (powerTradesRef.current && settings.powerTrades?.enabled) {
            powerTradesRef.current.processTick(tick);
        }

        // Aggregate ticks to footprint periodically (every 100 ticks)
        if (tickBufferRef.current.length % 100 === 0) {
            updateFootprints();
        }
    }, [settings]);

    /**
     * Update footprint data from tick buffer
     */
    const updateFootprints = useCallback(() => {
        if (!tickBufferRef.current.length || !candleDataRef.current.length) return;

        const priceStep = settings.footprint?.priceStep || 1;

        // Get latest candle
        const latestCandle = candleDataRef.current[candleDataRef.current.length - 1];
        if (!latestCandle) return;

        // Get ticks for latest candle
        const candleTicks = tickBufferRef.current.filter(
            t => t.time >= latestCandle.time * 1000 && t.time < (latestCandle.time + 60) * 1000
        );

        if (candleTicks.length > 0) {
            const footprint = aggregateTicksToFootprint(candleTicks, latestCandle, priceStep);

            // Update footprint primitive
            if (footprintRef.current) {
                const existingFootprints = footprintDataRef.current;
                const updatedFootprints = [...existingFootprints.filter(f => f.time !== footprint.time), footprint];
                footprintDataRef.current = updatedFootprints;
                footprintRef.current.setData(updatedFootprints);
            }
        }
    }, [settings]);

    /**
     * Update with new candle data
     */
    const updateData = useCallback((data) => {
        if (!data || !Array.isArray(data)) return;

        candleDataRef.current = data;

        // Calculate bar statistics
        if (barStatsRef.current && settings.barStats?.enabled) {
            const barStats = data.map(candle => ({
                time: candle.time,
                totalVolume: candle.volume || 0,
                delta: (candle.buyVolume || 0) - (candle.sellVolume || 0),
                deltaPercent: candle.volume > 0
                    ? (((candle.buyVolume || 0) - (candle.sellVolume || 0)) / candle.volume) * 100
                    : 0,
                poc: (candle.high + candle.low) / 2, // Simplified POC
                vwap: candle.vwap || candle.close,
                buyVwap: candle.buyVwap,
                sellVwap: candle.sellVwap,
                totalTrades: candle.trades || 0,
            }));
            barStatsRef.current.setData(barStats);
        }

        // Calculate delta bars
        if (deltaRef.current && settings.delta?.enabled) {
            const deltaData = data.map(candle => ({
                time: candle.time,
                value: (candle.buyVolume || 0) - (candle.sellVolume || 0),
            }));
            deltaRef.current.setData(deltaData);
        }

        // Calculate cumulative delta
        if (cumulativeDeltaRef.current && settings.delta?.enabled) {
            const deltas = data.map(candle => (candle.buyVolume || 0) - (candle.sellVolume || 0));
            const cumulativeDeltas = calculateCumulativeDelta(deltas);
            const cdData = data.map((candle, i) => ({
                time: candle.time,
                value: cumulativeDeltas[i],
            }));
            cumulativeDeltaRef.current.setData(cdData);
        }

        // Calculate volume profile from data
        if (volumeProfileRef.current && settings.volumeProfile?.enabled) {
            // Build profile levels from candle data
            const levels = [];
            const tickSize = 1; // Simplified

            data.forEach(candle => {
                const typicalPrice = (candle.high + candle.low + candle.close) / 3;
                const roundedPrice = Math.round(typicalPrice / tickSize) * tickSize;

                const existing = levels.find(l => l.price === roundedPrice);
                if (existing) {
                    existing.buyVolume += candle.buyVolume || candle.volume * 0.5;
                    existing.sellVolume += candle.sellVolume || candle.volume * 0.5;
                } else {
                    levels.push({
                        price: roundedPrice,
                        buyVolume: candle.buyVolume || candle.volume * 0.5,
                        sellVolume: candle.sellVolume || candle.volume * 0.5,
                    });
                }
            });

            // Calculate POC and Value Area
            const poc = calculatePOC(levels);
            const { vah, val } = calculateValueArea(levels, poc, settings.volumeProfile.valueAreaPercent || 70);

            volumeProfileRef.current.setData({
                levels,
                poc,
                vah,
                val,
                tickSize,
            });
        }
    }, [settings]);

    /**
     * Apply new settings
     */
    const applySettings = useCallback((newSettings) => {
        // Update each primitive with new options
        if (footprintRef.current && newSettings.footprint) {
            footprintRef.current.applyOptions(newSettings.footprint);
        }
        if (volumeProfileRef.current && newSettings.volumeProfile) {
            volumeProfileRef.current.applyOptions(newSettings.volumeProfile);
        }
        if (deltaRef.current && newSettings.delta) {
            deltaRef.current.applyOptions(newSettings.delta);
        }
        if (cumulativeDeltaRef.current && newSettings.delta) {
            cumulativeDeltaRef.current.applyOptions(newSettings.delta);
        }
        if (barStatsRef.current && newSettings.barStats) {
            barStatsRef.current.applyOptions(newSettings.barStats);
        }
        if (powerTradesRef.current && newSettings.powerTrades) {
            powerTradesRef.current.applyOptions(newSettings.powerTrades);
        }
    }, []);

    /**
     * Subscribe to tick data
     */
    const subscribeTicks = useCallback(() => {
        if (!symbol || !enabled) return;

        // Unsubscribe previous if any
        if (unsubscribeRef.current) {
            unsubscribeRef.current();
        }

        unsubscribeRef.current = subscribeToTicks(symbol, exchange, handleTick);
    }, [symbol, exchange, enabled, handleTick]);

    /**
     * Initialize on mount / settings change
     */
    useEffect(() => {
        if (enabled && mainSeries && chart) {
            initializePrimitives();
            subscribeTicks();
        }

        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
            cleanupPrimitives();
        };
    }, [enabled, mainSeries, chart, initializePrimitives, subscribeTicks, cleanupPrimitives]);

    /**
     * Re-initialize when symbol changes
     */
    useEffect(() => {
        if (!enabled) return;

        tickBufferRef.current = [];
        footprintDataRef.current = [];

        if (unsubscribeRef.current) {
            unsubscribeRef.current();
        }

        subscribeTicks();
    }, [symbol, exchange, enabled, subscribeTicks]);

    return {
        // Methods
        updateData,
        applySettings,
        initializePrimitives,
        cleanupPrimitives,

        // Refs for direct access if needed
        footprintRef,
        volumeProfileRef,
        deltaRef,
        cumulativeDeltaRef,
        barStatsRef,
        powerTradesRef,

        // State
        isActive: enabled && mainSeries !== null,
    };
};

export default useOrderFlow;
