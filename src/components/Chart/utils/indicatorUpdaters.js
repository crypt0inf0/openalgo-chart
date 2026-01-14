/**
 * Indicator Series Update Functions
 * Functions for updating indicator data and appearance
 */

import {
    calculateSMA,
    calculateEMA,
    calculateRSI,
    calculateMACD,
    calculateBollingerBands,
    calculateVolume,
    calculateATR,
    calculateStochastic,
    calculateVWAP,
    calculateSupertrend,
    calculateADX,
    calculateIchimoku,
    calculatePivotPoints
} from '../../../utils/indicators';
import { calculateANNStrategy } from '../../../utils/indicators/annStrategy';
import { calculateHilengaMilenga } from '../../../utils/indicators/hilengaMilenga';

/**
 * Update SMA/EMA/VWAP series
 */
export const updateOverlaySeries = (series, ind, data, isVisible) => {
    const { type } = ind;
    series.applyOptions({
        visible: isVisible,
        color: ind.color || (type === 'sma' ? '#2196F3' : '#FF9800'),
        title: `${type.toUpperCase()} ${ind.period || 20}`
    });

    let val = null;
    if (type === 'sma') val = calculateSMA(data, ind.period || 20);
    else if (type === 'ema') val = calculateEMA(data, ind.period || 20);
    else if (type === 'vwap') val = calculateVWAP(data, { ...ind });

    if (val && val.length > 0) series.setData(val);
};

/**
 * Update RSI series
 */
export const updateRSISeries = (series, ind, data, isVisible) => {
    series.applyOptions({ visible: isVisible, color: ind.color || '#7B1FA2' });
    if (series._obLine) {
        series._obLine.applyOptions({ price: ind.overbought || 70, color: ind.overboughtColor || '#F23645' });
    }
    if (series._osLine) {
        series._osLine.applyOptions({ price: ind.oversold || 30, color: ind.oversoldColor || '#089981' });
    }
    const val = calculateRSI(data, ind.period || 14);
    if (val) series.setData(val);
};

/**
 * Update MACD series
 */
export const updateMACDSeries = (series, ind, data, isVisible) => {
    if (series.macd) series.macd.applyOptions({ visible: isVisible, color: ind.macdColor || '#2962FF' });
    if (series.signal) series.signal.applyOptions({ visible: isVisible, color: ind.signalColor || '#FF6D00' });
    if (series.histogram) series.histogram.applyOptions({ visible: isVisible });

    const val = calculateMACD(data, ind.fast || 12, ind.slow || 26, ind.signal || 9);
    if (val) {
        if (val.macd) series.macd.setData(val.macd);
        if (val.signal) series.signal.setData(val.signal);
        if (val.histogram) {
            const colored = val.histogram.map(d => ({
                ...d,
                color: d.value >= 0 ? (ind.histUpColor || '#26A69A') : (ind.histDownColor || '#EF5350')
            }));
            series.histogram.setData(colored);
        }
    }
};

/**
 * Update Bollinger Bands series
 */
export const updateBollingerBandsSeries = (series, ind, data, isVisible) => {
    series.upper.applyOptions({ visible: isVisible, color: ind.upperColor || '#2962FF' });
    series.middle.applyOptions({ visible: isVisible, color: ind.basisColor || '#FF6D00' });
    series.lower.applyOptions({ visible: isVisible, color: ind.lowerColor || '#2962FF' });

    const val = calculateBollingerBands(data, ind.period || 20, ind.stdDev || 2);
    if (val) {
        series.upper.setData(val.upper);
        series.middle.setData(val.middle);
        series.lower.setData(val.lower);
    }
};

/**
 * Update Stochastic series
 */
export const updateStochasticSeries = (series, ind, data, isVisible) => {
    series.k.applyOptions({ visible: isVisible, color: ind.kColor || '#2962FF' });
    series.d.applyOptions({ visible: isVisible, color: ind.dColor || '#FF6D00' });

    const val = calculateStochastic(data, ind.kPeriod || 14, ind.dPeriod || 3, ind.smooth || 3);
    if (val) {
        series.k.setData(val.kLine);
        series.d.setData(val.dLine);
    }
};

/**
 * Update ATR series
 */
export const updateATRSeries = (series, ind, data, isVisible) => {
    if (series.applyOptions) series.applyOptions({ visible: isVisible, color: ind.color || '#FF9800' });
    const val = calculateATR(data, ind.period || 14);
    if (val) series.setData(val);
};

/**
 * Update Supertrend series
 */
export const updateSupertrendSeries = (series, ind, data, isVisible) => {
    series.applyOptions({ visible: isVisible });
    const val = calculateSupertrend(data, ind.period || 10, ind.multiplier || 3);
    if (val) {
        const colored = val.map(d => ({
            ...d,
            color: d.trend === 1 ? (ind.upColor || '#089981') : (ind.downColor || '#F23645')
        }));
        series.setData(colored);
    }
};

/**
 * Update Volume series - TradingView style
 */
export const updateVolumeSeries = (series, ind, data, isVisible) => {
    if (!series?.bars || !data) return;

    // Apply visibility
    series.bars.applyOptions({ visible: isVisible });

    // Use simple volume calculation (close vs previous close)
    const volumeData = calculateVolume(
        data,
        ind.colorUp || '#26A69A',
        ind.colorDown || '#EF5350'
    );

    series.bars.setData(volumeData);

    // No MA line to update
};

/**
 * Update ANN Strategy series
 * @returns {Array} markers for signals
 */
export const updateANNStrategySeries = (series, ind, data, isVisible) => {
    const markers = [];

    if (series.prediction) {
        series.prediction.applyOptions({
            visible: isVisible,
            lineColor: ind.predictionColor || '#00BCD4'
        });

        // Update threshold lines
        const thresholdValue = ind.threshold || 0.0014;
        if (series.prediction._upperThreshold) {
            series.prediction._upperThreshold.applyOptions({
                price: thresholdValue,
                color: ind.longColor || '#26A69A'
            });
        }
        if (series.prediction._lowerThreshold) {
            series.prediction._lowerThreshold.applyOptions({
                price: -thresholdValue,
                color: ind.shortColor || '#EF5350'
            });
        }

        // Calculate ANN predictions
        const result = calculateANNStrategy(data, {
            threshold: ind.threshold || 0.0014,
            longColor: ind.longColor || '#26A69A',
            shortColor: ind.shortColor || '#EF5350',
            showSignals: ind.showSignals !== false,
            showBackground: ind.showBackground !== false
        });

        // Set prediction data
        if (result.predictions && result.predictions.length > 0) {
            series.prediction.setData(result.predictions);
        }

        // Set background area data for signal coloring on main chart
        if ((series.bgLong || series.bgShort) && result.signals && result.signals.length > 0 && ind.showBackground !== false && isVisible) {
            // Calculate price range for background
            const priceMax = Math.max(...data.map(d => d.high));
            const priceMin = Math.min(...data.map(d => d.low));
            const padding = (priceMax - priceMin) * 0.1;
            const bgTop = priceMax + padding;
            const bgBottom = priceMin - padding;

            // Create data for LONG background
            const longBgData = result.signals.map(sig => ({
                time: sig.time,
                value: sig.buying === true ? bgTop : bgBottom
            }));

            // Create data for SHORT background
            const shortBgData = result.signals.map(sig => ({
                time: sig.time,
                value: sig.buying === false ? bgTop : bgBottom
            }));

            if (series.bgLong) series.bgLong.setData(longBgData);
            if (series.bgShort) series.bgShort.setData(shortBgData);
        } else {
            if (series.bgLong) series.bgLong.setData([]);
            if (series.bgShort) series.bgShort.setData([]);
        }

        // Collect markers for buy/sell signals
        if (result.markers && result.markers.length > 0 && isVisible) {
            markers.push(...result.markers);
        }
    }

    return markers;
};

/**
 * Update Hilenga-Milenga series
 */
export const updateHilengaMilengaSeries = (series, ind, data, isVisible) => {
    if (series.rsi) series.rsi.applyOptions({ visible: isVisible, color: ind.rsiColor || '#131722' });
    if (series.ema) series.ema.applyOptions({ visible: isVisible, color: ind.emaColor || '#26A69A' });
    if (series.wma) series.wma.applyOptions({ visible: isVisible, color: ind.wmaColor || '#EF5350' });
    if (series.baseline) series.baseline.applyOptions({ visible: isVisible });

    const result = calculateHilengaMilenga(data, {
        rsiLength: ind.rsiLength || 14,
        emaLength: ind.emaLength || 5,
        wmaLength: ind.wmaLength || 45
    });

    if (result) {
        if (result.rsi && series.rsi) series.rsi.setData(result.rsi);
        if (result.ema && series.ema) series.ema.setData(result.ema);
        if (result.wma && series.wma) series.wma.setData(result.wma);
        if (result.baseline && series.baseline) series.baseline.setData(result.baseline);
    }
};

/**
 * Update ADX series
 */
export const updateADXSeries = (series, ind, data, isVisible) => {
    if (series.adx) series.adx.applyOptions({ visible: isVisible, color: ind.adxColor || '#FF9800', lineWidth: ind.lineWidth || 2 });
    if (series.plusDI) series.plusDI.applyOptions({ visible: isVisible, color: ind.plusDIColor || '#26A69A' });
    if (series.minusDI) series.minusDI.applyOptions({ visible: isVisible, color: ind.minusDIColor || '#EF5350' });

    const val = calculateADX(data, ind.period || 14);
    if (val) {
        if (val.adx && series.adx) series.adx.setData(val.adx);
        if (val.plusDI && series.plusDI) series.plusDI.setData(val.plusDI);
        if (val.minusDI && series.minusDI) series.minusDI.setData(val.minusDI);
    }
};

/**
 * Update Ichimoku series
 */
export const updateIchimokuSeries = (series, ind, data, isVisible) => {
    if (series.tenkan) series.tenkan.applyOptions({ visible: isVisible, color: ind.tenkanColor || '#2962FF' });
    if (series.kijun) series.kijun.applyOptions({ visible: isVisible, color: ind.kijunColor || '#EF5350' });
    if (series.senkouA) series.senkouA.applyOptions({ visible: isVisible, color: ind.senkouAColor || '#26A69A' });
    if (series.senkouB) series.senkouB.applyOptions({ visible: isVisible, color: ind.senkouBColor || '#EF5350' });
    if (series.chikou) series.chikou.applyOptions({ visible: isVisible, color: ind.chikouColor || '#9C27B0' });

    const val = calculateIchimoku(
        data,
        ind.tenkanPeriod || 9,
        ind.kijunPeriod || 26,
        ind.senkouBPeriod || 52,
        ind.displacement || 26
    );

    if (val) {
        if (val.tenkan && series.tenkan) series.tenkan.setData(val.tenkan);
        if (val.kijun && series.kijun) series.kijun.setData(val.kijun);
        if (val.senkouA && series.senkouA) series.senkouA.setData(val.senkouA);
        if (val.senkouB && series.senkouB) series.senkouB.setData(val.senkouB);
        if (val.chikou && series.chikou) series.chikou.setData(val.chikou);
    }
};

/**
 * Update Pivot Points series
 */
export const updatePivotPointsSeries = (series, ind, data, isVisible) => {
    const lineWidth = ind.lineWidth || 1;

    if (series.pivot) series.pivot.applyOptions({ visible: isVisible, color: ind.pivotColor || '#FF9800', lineWidth });
    if (series.r1) series.r1.applyOptions({ visible: isVisible, color: ind.resistanceColor || '#EF5350', lineWidth });
    if (series.r2) series.r2.applyOptions({ visible: isVisible, color: ind.resistanceColor || '#EF5350', lineWidth });
    if (series.r3) series.r3.applyOptions({ visible: isVisible, color: ind.resistanceColor || '#EF5350', lineWidth });
    if (series.s1) series.s1.applyOptions({ visible: isVisible, color: ind.supportColor || '#26A69A', lineWidth });
    if (series.s2) series.s2.applyOptions({ visible: isVisible, color: ind.supportColor || '#26A69A', lineWidth });
    if (series.s3) series.s3.applyOptions({ visible: isVisible, color: ind.supportColor || '#26A69A', lineWidth });

    const val = calculatePivotPoints(data, ind.pivotType || 'classic', ind.timeframe || 'daily');
    if (val) {
        if (val.pivot && series.pivot) series.pivot.setData(val.pivot);
        if (val.r1 && series.r1) series.r1.setData(val.r1);
        if (val.r2 && series.r2) series.r2.setData(val.r2);
        if (val.r3 && series.r3) series.r3.setData(val.r3);
        if (val.s1 && series.s1) series.s1.setData(val.s1);
        if (val.s2 && series.s2) series.s2.setData(val.s2);
        if (val.s3 && series.s3) series.s3.setData(val.s3);
    }
};

/**
 * Main update function - updates series for any indicator type
 * @param {Object} series - The indicator series
 * @param {Object} ind - Indicator configuration
 * @param {Array} data - OHLC data
 * @param {boolean} isVisible - Whether the indicator is visible
 * @returns {Array} markers (for indicators that generate markers like ANN Strategy)
 */
export const updateIndicatorSeries = (series, ind, data, isVisible) => {
    const { type } = ind;

    switch (type) {
        case 'sma':
        case 'ema':
        case 'vwap':
            updateOverlaySeries(series, ind, data, isVisible);
            return [];

        case 'rsi':
            updateRSISeries(series, ind, data, isVisible);
            return [];

        case 'macd':
            updateMACDSeries(series, ind, data, isVisible);
            return [];

        case 'bollingerBands':
            updateBollingerBandsSeries(series, ind, data, isVisible);
            return [];

        case 'stochastic':
            updateStochasticSeries(series, ind, data, isVisible);
            return [];

        case 'atr':
            updateATRSeries(series, ind, data, isVisible);
            return [];

        case 'supertrend':
            updateSupertrendSeries(series, ind, data, isVisible);
            return [];

        case 'volume':
            updateVolumeSeries(series, ind, data, isVisible);
            return [];

        case 'annStrategy':
            return updateANNStrategySeries(series, ind, data, isVisible);

        case 'hilengaMilenga':
            updateHilengaMilengaSeries(series, ind, data, isVisible);
            return [];

        case 'adx':
            updateADXSeries(series, ind, data, isVisible);
            return [];

        case 'ichimoku':
            updateIchimokuSeries(series, ind, data, isVisible);
            return [];

        case 'pivotPoints':
            updatePivotPointsSeries(series, ind, data, isVisible);
            return [];

        default:
            return [];
    }
};
