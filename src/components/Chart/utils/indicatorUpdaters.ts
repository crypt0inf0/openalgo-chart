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
import { calculateHilengaMilenga } from '../../../utils/indicators/hilengaMilenga';
import { CHART_COLORS } from '../../../utils/colorUtils';
import { IndicatorConfig } from './indicatorCreators';

export interface OHLCData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

export interface ChartMarker {
    time: number;
    position: 'aboveBar' | 'belowBar';
    color: string;
    shape: 'arrowUp' | 'arrowDown' | 'circle' | 'square';
    text?: string;
}

/**
 * Update SMA/EMA/VWAP series
 */
export const updateOverlaySeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    const { type } = ind;
    // Generate title only if showTitle is enabled
    const title = ind.showTitle ? `${type.toUpperCase()} ${ind.period || 20}` : '';

    series.applyOptions({
        visible: isVisible,
        color: ind.color || (type === 'sma' ? '#2196F3' : '#FF9800'),
        title
    });

    let val: any = null;
    if (type === 'sma') val = calculateSMA(data, ind.period || 20);
    else if (type === 'ema') val = calculateEMA(data, ind.period || 20);
    else if (type === 'vwap') val = calculateVWAP(data, ind as any);

    if (val && val.length > 0) series.setData(val);
};

/**
 * Update RSI series
 */
export const updateRSISeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    series.applyOptions({ visible: isVisible, color: ind.color || '#7B1FA2' });
    if (series._obLine) {
        series._obLine.applyOptions({ price: ind.overbought || 70, color: ind.overboughtColor || CHART_COLORS.DOWN.primary });
    }
    if (series._osLine) {
        series._osLine.applyOptions({ price: ind.oversold || 30, color: ind.oversoldColor || CHART_COLORS.UP.primary });
    }
    const val = calculateRSI(data, ind.period || 14);
    if (val) series.setData(val);
};

/**
 * Update MACD series
 */
export const updateMACDSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    if (series.macd) series.macd.applyOptions({ visible: isVisible, color: ind.macdColor || '#2962FF' });
    if (series.signal) series.signal.applyOptions({ visible: isVisible, color: ind.signalColor || '#FF6D00' });
    if (series.histogram) series.histogram.applyOptions({ visible: isVisible });

    const val = calculateMACD(data, ind.fast || 12, ind.slow || 26, ind.signal || 9) as any;
    if (val) {
        if (val.macd) series.macd.setData(val.macd);
        if (val.signal) series.signal.setData(val.signal);
        if (val.histogram) {
            const colored = val.histogram.map((d: any) => ({
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
export const updateBollingerBandsSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
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
export const updateStochasticSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
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
export const updateATRSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    if (series.applyOptions) series.applyOptions({ visible: isVisible, color: ind.color || '#FF9800' });
    const val = calculateATR(data, ind.period || 14);
    if (val) series.setData(val);
};

/**
 * Update Supertrend series
 */
export const updateSupertrendSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    series.applyOptions({ visible: isVisible });
    const val = calculateSupertrend(data, ind.period || 10, ind.multiplier || 3);
    if (val) {
        const colored = val.map((d: any) => ({
            ...d,
            color: d.trend === 1 ? (ind.upColor || CHART_COLORS.UP.primary) : (ind.downColor || CHART_COLORS.DOWN.primary)
        }));
        series.setData(colored);
    }
};

/**
 * Update Volume series - TradingView style
 */
export const updateVolumeSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
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
 * Update Hilenga-Milenga series
 */
export const updateHilengaMilengaSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    if (series.rsi) series.rsi.applyOptions({ visible: isVisible, color: ind.rsiColor || '#131722' });
    if (series.ema) series.ema.applyOptions({ visible: isVisible, color: ind.emaColor || '#26A69A' });
    if (series.wma) series.wma.applyOptions({ visible: isVisible, color: ind.wmaColor || '#EF5350' });
    if (series.baseline) series.baseline.applyOptions({ visible: isVisible });

    const result = calculateHilengaMilenga(data, {
        rsiLength: ind.rsiLength || 14,
        emaLength: ind.emaLength || 5,
        wmaLength: ind.wmaLength || 45
    } as any) as any;

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
export const updateADXSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
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
export const updateIchimokuSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
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
export const updatePivotPointsSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    const lineWidth = ind.lineWidth || 1;

    if (series.pivot) series.pivot.applyOptions({ visible: isVisible, color: ind.pivotColor || '#FF9800', lineWidth, title: ind.showTitle !== false ? 'P' : '' });
    if (series.r1) series.r1.applyOptions({ visible: isVisible, color: ind.resistanceColor || '#EF5350', lineWidth, title: ind.showTitle !== false ? 'R1' : '' });
    if (series.r2) series.r2.applyOptions({ visible: isVisible, color: ind.resistanceColor || '#EF5350', lineWidth, title: ind.showTitle !== false ? 'R2' : '' });
    if (series.r3) series.r3.applyOptions({ visible: isVisible, color: ind.resistanceColor || '#EF5350', lineWidth, title: ind.showTitle !== false ? 'R3' : '' });
    if (series.s1) series.s1.applyOptions({ visible: isVisible, color: ind.supportColor || '#26A69A', lineWidth, title: ind.showTitle !== false ? 'S1' : '' });
    if (series.s2) series.s2.applyOptions({ visible: isVisible, color: ind.supportColor || '#26A69A', lineWidth, title: ind.showTitle !== false ? 'S2' : '' });
    if (series.s3) series.s3.applyOptions({ visible: isVisible, color: ind.supportColor || '#26A69A', lineWidth, title: ind.showTitle !== false ? 'S3' : '' });

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
 * Update Pine Script indicator series
 * Attempts to calculate common indicators (EMA, SMA) directly from Pine code
 */
export const updatePineSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    series.applyOptions({
        visible: isVisible,
        color: ind.pineColor || '#2962FF',
        lineWidth: ind.pineLineWidth || 2,
        title: ind.name || 'Pine Script'
    });

    // If we have cached Pine result data, use it
    if (ind.pineResultData && Array.isArray(ind.pineResultData)) {
        const chartData = ind.pineResultData
            .map((value: number, index: number) => {
                if (index >= data.length || value === null || value === undefined || isNaN(value)) {
                    return null;
                }
                return { time: data[index].time, value: value };
            })
            .filter((d: any) => d !== null);

        if (chartData.length > 0) {
            series.setData(chartData);
            return;
        }
    }

    // Try to calculate directly from Pine code if it's a simple indicator
    const pineCode = ind.pineCode as string || '';
    const length = (ind.length as number) || 14;
    const source = (ind.source as string) || 'close';

    // Get source data based on input
    const getSourceData = (d: OHLCData): number => {
        switch (source) {
            case 'open': return d.open;
            case 'high': return d.high;
            case 'low': return d.low;
            case 'hl2': return (d.high + d.low) / 2;
            case 'hlc3': return (d.high + d.low + d.close) / 3;
            case 'ohlc4': return (d.open + d.high + d.low + d.close) / 4;
            default: return d.close;
        }
    };

    let calculatedData: { time: number; value: number }[] | null = null;

    // Detect EMA pattern: ta.ema(source, length)
    if (/ta\.ema\s*\(/.test(pineCode)) {
        const sourceData = data.map(getSourceData);
        const emaValues: number[] = [];
        const multiplier = 2 / (length + 1);
        let ema = sourceData[0];

        for (let i = 0; i < sourceData.length; i++) {
            if (i === 0) {
                ema = sourceData[i];
            } else {
                ema = (sourceData[i] - ema) * multiplier + ema;
            }
            emaValues.push(ema);
        }

        calculatedData = data.map((d, i) => ({ time: d.time, value: emaValues[i] }));
    }
    // Detect SMA pattern: ta.sma(source, length)
    else if (/ta\.sma\s*\(/.test(pineCode)) {
        const sourceData = data.map(getSourceData);
        calculatedData = data.map((d, i) => {
            if (i < length - 1) {
                return { time: d.time, value: sourceData[i] };
            }
            const sum = sourceData.slice(i - length + 1, i + 1).reduce((a, b) => a + b, 0);
            return { time: d.time, value: sum / length };
        });
    }
    // Detect RSI pattern: ta.rsi(source, length)
    else if (/ta\.rsi\s*\(/.test(pineCode)) {
        const rsiData = calculateRSI(data, length);
        if (rsiData) {
            calculatedData = rsiData;
        }
    }

    if (calculatedData && calculatedData.length > 0) {
        series.setData(calculatedData);
    } else {
        // No data available - script couldn't be executed
        // Show empty series with a title indicating the issue
        series.applyOptions({
            title: ind.name ? `${ind.name} (unsupported)` : 'Pine Script (unsupported)',
        });
        // Set empty data - don't show misleading close prices
        series.setData([]);
    }
};

/**
 * Main update function - updates series for any indicator type
 * @returns markers (for indicators that generate markers like ANN Strategy)
 */
export const updateIndicatorSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): ChartMarker[] => {
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

        case 'pine':
            updatePineSeries(series, ind, data, isVisible);
            return [];

        default:
            return [];
    }
};
