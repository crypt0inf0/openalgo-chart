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

/**
 * Create SMA/EMA/VWAP series (overlay on main chart)
 */
export const createOverlaySeries = (chart) => {
    return chart.addSeries(LineSeries, {
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false
    });
};

/**
 * Create ATR series in separate pane
 */
export const createATRSeries = (chart) => {
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
export const createRSISeries = (chart, ind) => {
    const pane = chart.addPane({ height: 100 });
    const series = pane.addSeries(LineSeries, {
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true
    });

    // Add OB/OS lines for RSI
    series._obLine = series.createPriceLine({
        price: ind.overbought || 70,
        color: ind.overboughtColor || '#F23645',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: false,
        title: ''
    });
    series._osLine = series.createPriceLine({
        price: ind.oversold || 30,
        color: ind.oversoldColor || '#089981',
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
export const createStochasticSeries = (chart) => {
    const pane = chart.addPane({ height: 100 });
    const series = {
        k: pane.addSeries(LineSeries, {
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            title: '%K'
        }),
        d: pane.addSeries(LineSeries, {
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            title: '%D'
        })
    };
    return { series, pane };
};

/**
 * Create MACD series in separate pane (histogram, MACD, signal lines)
 */
export const createMACDSeries = (chart) => {
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
            title: 'MACD'
        }),
        signal: pane.addSeries(LineSeries, {
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            title: 'Signal'
        })
    };
    return { series, pane };
};

/**
 * Create Bollinger Bands series (3 overlay lines)
 */
export const createBollingerBandsSeries = (chart) => {
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
export const createSupertrendSeries = (chart, isVisible) => {
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
export const createVolumeSeries = (chart, ind) => {
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
export const createANNStrategySeries = (chart, ind) => {
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
    annArea._upperThreshold = annArea.createPriceLine({
        price: thresholdValue,
        color: ind.longColor || '#26A69A',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: false,
        title: ''
    });
    annArea._lowerThreshold = annArea.createPriceLine({
        price: -thresholdValue,
        color: ind.shortColor || '#EF5350',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: false,
        title: ''
    });
    annArea._zeroLine = annArea.createPriceLine({
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
export const createHilengaMilengaSeries = (chart, ind) => {
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
    hmRsi._midline = hmRsi.createPriceLine({
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
export const createADXSeries = (chart, ind) => {
    const pane = chart.addPane({ height: 100 });
    const series = {
        adx: pane.addSeries(LineSeries, {
            color: ind.adxColor || '#FF9800',
            lineWidth: ind.lineWidth || 2,
            priceLineVisible: false,
            lastValueVisible: true,
            title: 'ADX'
        }),
        plusDI: pane.addSeries(LineSeries, {
            color: ind.plusDIColor || '#26A69A',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            title: '+DI'
        }),
        minusDI: pane.addSeries(LineSeries, {
            color: ind.minusDIColor || '#EF5350',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            title: '-DI'
        })
    };

    // Add reference lines
    series.adx._line20 = series.adx.createPriceLine({
        price: 20,
        color: '#555',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: false,
        title: ''
    });
    series.adx._line25 = series.adx.createPriceLine({
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
export const createIchimokuSeries = (chart, ind) => {
    return {
        tenkan: chart.addSeries(LineSeries, {
            color: ind.tenkanColor || '#2962FF',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            title: 'Tenkan'
        }),
        kijun: chart.addSeries(LineSeries, {
            color: ind.kijunColor || '#EF5350',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            title: 'Kijun'
        }),
        senkouA: chart.addSeries(LineSeries, {
            color: ind.senkouAColor || '#26A69A',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            title: 'Senkou A'
        }),
        senkouB: chart.addSeries(LineSeries, {
            color: ind.senkouBColor || '#EF5350',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            title: 'Senkou B'
        }),
        chikou: chart.addSeries(LineSeries, {
            color: ind.chikouColor || '#9C27B0',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            title: 'Chikou'
        })
    };
};

/**
 * Create Pivot Points series (7 overlay lines)
 */
export const createPivotPointsSeries = (chart, ind) => {
    const lineWidth = ind.lineWidth || 1;

    return {
        pivot: chart.addSeries(LineSeries, {
            color: ind.pivotColor || '#FF9800',
            lineWidth,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            title: 'PP'
        }),
        r1: chart.addSeries(LineSeries, {
            color: ind.resistanceColor || '#EF5350',
            lineWidth,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            title: 'R1'
        }),
        r2: chart.addSeries(LineSeries, {
            color: ind.resistanceColor || '#EF5350',
            lineWidth,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            title: 'R2'
        }),
        r3: chart.addSeries(LineSeries, {
            color: ind.resistanceColor || '#EF5350',
            lineWidth,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            title: 'R3'
        }),
        s1: chart.addSeries(LineSeries, {
            color: ind.supportColor || '#26A69A',
            lineWidth,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            title: 'S1'
        }),
        s2: chart.addSeries(LineSeries, {
            color: ind.supportColor || '#26A69A',
            lineWidth,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            title: 'S2'
        }),
        s3: chart.addSeries(LineSeries, {
            color: ind.supportColor || '#26A69A',
            lineWidth,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            title: 'S3'
        })
    };
};

/**
 * Main factory function - creates series for any indicator type
 * @param {Object} chart - The chart instance
 * @param {Object} ind - Indicator configuration
 * @param {boolean} isVisible - Whether the indicator is visible
 * @returns {Object} { series, pane } - Created series and optional pane
 */
export const createIndicatorSeries = (chart, ind, isVisible = true) => {
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

        default:
            return null;
    }
};
