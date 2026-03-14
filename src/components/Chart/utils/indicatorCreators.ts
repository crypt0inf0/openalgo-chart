/**
 * Indicator Series Creation Factories
 * Factory functions for creating lightweight-charts series for each indicator type
 */

import {
    LineSeries,
    AreaSeries,
    BaselineSeries,
    HistogramSeries
} from 'lightweight-charts';
import { CHART_COLORS } from '../../../utils/colorUtils';

export interface IndicatorConfig {
    type: string;
    period?: number;
    color?: string;
    overbought?: number;
    overboughtColor?: string;
    oversold?: number;
    oversoldColor?: string;
    predictionColor?: string;
    threshold?: number;
    longColor?: string;
    shortColor?: string;
    rsiColor?: string;
    emaColor?: string;
    wmaColor?: string;
    bullFillColor?: string;
    bearFillColor?: string;
    midlineColor?: string;
    adxColor?: string;
    plusDIColor?: string;
    minusDIColor?: string;
    lineWidth?: number;
    tenkanColor?: string;
    kijunColor?: string;
    senkouAColor?: string;
    senkouBColor?: string;
    chikouColor?: string;
    pivotColor?: string;
    resistanceColor?: string;
    supportColor?: string;
    showTitle?: boolean;
    [key: string]: any;
}

export interface SeriesResult {
    series: any;
    pane?: any;
}

/**
 * Create SMA/EMA/VWAP series (overlay on main chart)
 */
export const createOverlaySeries = (chart: any): any => {
    return chart.addSeries(LineSeries, {
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false
    });
};

/**
 * Create ATR series in separate pane
 */
export const createATRSeries = (chart: any): { series: any; pane: any } => {
    const pane = chart.addPane({ height: 100 });
    const series = pane.addSeries(LineSeries, {
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true
    });
    return { series, pane };
};

/**
 * Create RSI series in separate pane with OB/OS lines
 */
export const createRSISeries = (chart: any, ind: IndicatorConfig): { series: any; pane: any } => {
    const pane = chart.addPane({ height: 100 });
    const series = pane.addSeries(LineSeries, {
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true
    });

    // Add OB/OS lines for RSI
    (series as any)._obLine = series.createPriceLine({
        price: ind.overbought || 70,
        color: ind.overboughtColor || CHART_COLORS.DOWN.primary,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: false,
        title: ''
    });
    (series as any)._osLine = series.createPriceLine({
        price: ind.oversold || 30,
        color: ind.oversoldColor || CHART_COLORS.UP.primary,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: false,
        title: ''
    });

    return { series, pane };
};

/**
 * Create Stochastic series in separate pane (%K and %D lines)
 */
export const createStochasticSeries = (chart: any): { series: any; pane: any } => {
    const pane = chart.addPane({ height: 100 });
    const series = {
        k: pane.addSeries(LineSeries, {
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            title: '' // Hide from price scale
        }),
        d: pane.addSeries(LineSeries, {
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            title: '' // Hide from price scale
        })
    };
    return { series, pane };
};

/**
 * Create MACD series in separate pane (histogram, MACD, signal lines)
 */
export const createMACDSeries = (chart: any): { series: any; pane: any } => {
    const pane = chart.addPane({ height: 120 });
    const series = {
        histogram: pane.addSeries(HistogramSeries, {
            priceLineVisible: false,
            lastValueVisible: false
        }),
        macd: pane.addSeries(LineSeries, {
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            title: '' // Hide from price scale
        }),
        signal: pane.addSeries(LineSeries, {
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            title: '' // Hide from price scale
        })
    };
    return { series, pane };
};

/**
 * Create Bollinger Bands series (3 overlay lines)
 */
export const createBollingerBandsSeries = (chart: any): any => {
    return {
        upper: chart.addSeries(LineSeries, {
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false
        }),
        middle: chart.addSeries(LineSeries, {
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false
        }),
        lower: chart.addSeries(LineSeries, {
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false
        })
    };
};

/**
 * Create Supertrend series (overlay)
 */
export const createSupertrendSeries = (chart: any, isVisible: boolean): any => {
    return chart.addSeries(LineSeries, {
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: isVisible,
        crosshairMarkerVisible: true
    });
};

/**
 * Create Volume series (histogram only - TradingView style)
 */
export const createVolumeSeries = (chart: any, _ind: IndicatorConfig): { bars: any } => {
    const volumeBars = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
        priceLineVisible: false,
        lastValueVisible: false
    });
    volumeBars.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

    // Return just the bars (no MA line)
    return { bars: volumeBars };
};

/**
 * Create ANN Strategy series (prediction pane + background areas)
 */
export const createANNStrategySeries = (chart: any, ind: IndicatorConfig): { series: any; pane: any } => {
    const pane = chart.addPane({ height: 100 });

    // Area series for prediction visualization
    const annArea = pane.addSeries(AreaSeries, {
        lineColor: ind.predictionColor || '#00BCD4',
        topColor: 'rgba(0, 188, 212, 0.3)',
        bottomColor: 'rgba(0, 188, 212, 0.0)',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true
    });

    // Add threshold lines
    const thresholdValue = ind.threshold || 0.0014;
    (annArea as any)._upperThreshold = annArea.createPriceLine({
        price: thresholdValue,
        color: ind.longColor || '#26A69A',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: false,
        title: ''
    });
    (annArea as any)._lowerThreshold = annArea.createPriceLine({
        price: -thresholdValue,
        color: ind.shortColor || '#EF5350',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: false,
        title: ''
    });
    (annArea as any)._zeroLine = annArea.createPriceLine({
        price: 0,
        color: '#666666',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: false,
        title: ''
    });

    // Background Area series for signal coloring
    const annBgLong = chart.addSeries(AreaSeries, {
        priceScaleId: 'right',
        lineColor: 'transparent',
        topColor: (ind.longColor || '#26A69A') + '40',
        bottomColor: (ind.longColor || '#26A69A') + '40',
        lineWidth: 0,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        autoscaleInfoProvider: () => null
    });

    const annBgShort = chart.addSeries(AreaSeries, {
        priceScaleId: 'right',
        lineColor: 'transparent',
        topColor: (ind.shortColor || '#EF5350') + '40',
        bottomColor: (ind.shortColor || '#EF5350') + '40',
        lineWidth: 0,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        autoscaleInfoProvider: () => null
    });

    return {
        series: { prediction: annArea, bgLong: annBgLong, bgShort: annBgShort },
        pane
    };
};

/**
 * Create Hilenga-Milenga series in separate pane
 */
export const createHilengaMilengaSeries = (chart: any, ind: IndicatorConfig): { series: any; pane: any } => {
    const pane = chart.addPane({ height: 120 });

    // RSI line
    const hmRsi = pane.addSeries(LineSeries, {
        color: ind.rsiColor || '#131722',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true
    });

    // EMA line
    const hmEma = pane.addSeries(LineSeries, {
        color: ind.emaColor || '#26A69A',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false
    });

    // WMA line
    const hmWma = pane.addSeries(LineSeries, {
        color: ind.wmaColor || '#EF5350',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false
    });

    // Baseline series at 50
    const hmBaseline = pane.addSeries(BaselineSeries, {
        baseValue: { type: 'price', price: 50 },
        topLineColor: 'transparent',
        topFillColor1: ind.bullFillColor || 'rgba(255, 107, 107, 0.7)',
        topFillColor2: ind.bullFillColor || 'rgba(255, 107, 107, 0.7)',
        bottomLineColor: 'transparent',
        bottomFillColor1: ind.bearFillColor || 'rgba(78, 205, 196, 0.7)',
        bottomFillColor2: ind.bearFillColor || 'rgba(78, 205, 196, 0.7)',
        lineWidth: 0,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false
    });

    // Add midline at 50
    (hmRsi as any)._midline = hmRsi.createPriceLine({
        price: 50,
        color: ind.midlineColor || '#787B86',
        lineWidth: 1,
        lineStyle: 0,
        axisLabelVisible: false,
        title: ''
    });

    return {
        series: { rsi: hmRsi, ema: hmEma, wma: hmWma, baseline: hmBaseline },
        pane
    };
};

/**
 * Create ADX series in separate pane
 */
export const createADXSeries = (chart: any, ind: IndicatorConfig): { series: any; pane: any } => {
    const pane = chart.addPane({ height: 100 });
    const series = {
        adx: pane.addSeries(LineSeries, {
            color: ind.adxColor || '#FF9800',
            lineWidth: ind.lineWidth || 2,
            priceLineVisible: false,
            lastValueVisible: true,
            title: '' // Hide from price scale
        }),
        plusDI: pane.addSeries(LineSeries, {
            color: ind.plusDIColor || '#26A69A',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            title: '' // Hide from price scale
        }),
        minusDI: pane.addSeries(LineSeries, {
            color: ind.minusDIColor || '#EF5350',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            title: '' // Hide from price scale
        })
    };

    // Add reference lines
    (series.adx as any)._line20 = series.adx.createPriceLine({
        price: 20,
        color: '#555',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: false,
        title: ''
    });
    (series.adx as any)._line25 = series.adx.createPriceLine({
        price: 25,
        color: '#777',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: false,
        title: ''
    });

    return { series, pane };
};

/**
 * Create Ichimoku Cloud series (5 overlay lines)
 */
export const createIchimokuSeries = (chart: any, ind: IndicatorConfig): any => {
    return {
        tenkan: chart.addSeries(LineSeries, {
            color: ind.tenkanColor || '#2962FF',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            title: '' // Hide from price scale
        }),
        kijun: chart.addSeries(LineSeries, {
            color: ind.kijunColor || '#EF5350',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            title: '' // Hide from price scale
        }),
        senkouA: chart.addSeries(LineSeries, {
            color: ind.senkouAColor || '#26A69A',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            title: '' // Hide from price scale
        }),
        senkouB: chart.addSeries(LineSeries, {
            color: ind.senkouBColor || '#EF5350',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            title: '' // Hide from price scale
        }),
        chikou: chart.addSeries(LineSeries, {
            color: ind.chikouColor || '#9C27B0',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            title: '' // Hide from price scale
        })
    };
};

/**
 * Create Pivot Points series (7 overlay lines)
 */
export const createPivotPointsSeries = (chart: any, ind: IndicatorConfig): any => {
    const lineWidth = ind.lineWidth || 1;
    const pivotColor = ind.pivotColor || '#FF9800';
    const resistanceColor = ind.resistanceColor || '#EF5350';
    const supportColor = ind.supportColor || '#26A69A';

    return {
        pivot: chart.addSeries(LineSeries, {
            color: pivotColor,
            lineWidth,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            title: ind.showTitle !== false ? 'P' : ''
        }),
        r1: chart.addSeries(LineSeries, {
            color: resistanceColor,
            lineWidth,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            title: ind.showTitle !== false ? 'R1' : ''
        }),
        r2: chart.addSeries(LineSeries, {
            color: resistanceColor,
            lineWidth,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            title: ind.showTitle !== false ? 'R2' : ''
        }),
        r3: chart.addSeries(LineSeries, {
            color: resistanceColor,
            lineWidth,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            title: ind.showTitle !== false ? 'R3' : ''
        }),
        s1: chart.addSeries(LineSeries, {
            color: supportColor,
            lineWidth,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            title: ind.showTitle !== false ? 'S1' : ''
        }),
        s2: chart.addSeries(LineSeries, {
            color: supportColor,
            lineWidth,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            title: ind.showTitle !== false ? 'S2' : ''
        }),
        s3: chart.addSeries(LineSeries, {
            color: supportColor,
            lineWidth,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            title: ind.showTitle !== false ? 'S3' : ''
        })
    };
};

/**
 * Create Pine Script indicator series
 * Creates a simple line series for each plot in the Pine Script
 */
export const createPineSeries = (chart: any, ind: IndicatorConfig, isVisible: boolean = true): { series: any; pane?: any } => {
    const isOverlay = ind.pane === 'main';

    if (isOverlay) {
        // Overlay indicator - draw on main chart
        const series = chart.addSeries(LineSeries, {
            color: ind.pineColor || '#2962FF',
            lineWidth: ind.pineLineWidth || 2,
            priceLineVisible: false,
            lastValueVisible: true,
            visible: isVisible,
            title: ind.name || 'Pine Script'
        });
        return { series };
    } else {
        // Separate pane indicator
        const pane = chart.addPane({ height: 100 });
        const series = pane.addSeries(LineSeries, {
            color: ind.pineColor || '#2962FF',
            lineWidth: ind.pineLineWidth || 2,
            priceLineVisible: false,
            lastValueVisible: true,
            visible: isVisible,
            title: ind.name || 'Pine Script'
        });
        return { series, pane };
    }
};

/**
 * Create UT Bot Alerts series (overlay line for trailing stop)
 */
export const createUTBotAlertsSeries = (chart: any, isVisible: boolean): any => {
    return chart.addSeries(LineSeries, {
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: isVisible,
        crosshairMarkerVisible: true,
        title: 'UT Bot'
    });
};

/**
 * Main factory function - creates series for any indicator type
 */
export const createIndicatorSeries = (chart: any, ind: IndicatorConfig, isVisible: boolean = true): SeriesResult | null => {
    const { type } = ind;

    switch (type) {
        case 'sma':
        case 'ema':
        case 'vwap':
            return { series: createOverlaySeries(chart) };

        case 'atr': {
            const result = createATRSeries(chart);
            return { series: result.series, pane: result.pane };
        }

        case 'rsi': {
            const result = createRSISeries(chart, ind);
            return { series: result.series, pane: result.pane };
        }

        case 'stochastic': {
            const result = createStochasticSeries(chart);
            return { series: result.series, pane: result.pane };
        }

        case 'macd': {
            const result = createMACDSeries(chart);
            return { series: result.series, pane: result.pane };
        }

        case 'bollingerBands':
            return { series: createBollingerBandsSeries(chart) };

        case 'supertrend':
            return { series: createSupertrendSeries(chart, isVisible) };

        case 'utBotAlerts':
            return { series: createUTBotAlertsSeries(chart, isVisible) };

        case 'volume':
            return { series: createVolumeSeries(chart, ind) };

        case 'annStrategy': {
            const result = createANNStrategySeries(chart, ind);
            return { series: result.series, pane: result.pane };
        }

        case 'hilengaMilenga': {
            const result = createHilengaMilengaSeries(chart, ind);
            return { series: result.series, pane: result.pane };
        }

        case 'adx': {
            const result = createADXSeries(chart, ind);
            return { series: result.series, pane: result.pane };
        }

        case 'ichimoku':
            return { series: createIchimokuSeries(chart, ind) };

        case 'pivotPoints':
            return { series: createPivotPointsSeries(chart, ind) };

        case 'pine': {
            const result = createPineSeries(chart, ind, isVisible);
            return { series: result.series, pane: result.pane };
        }

        default:
            return null;
    }
};
