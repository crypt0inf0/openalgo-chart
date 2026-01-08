import React from 'react';
import styles from './ChartGrid.module.css';
import ChartComponent from './ChartComponent';

const ChartGrid = ({
    charts,
    layout,
    activeChartId,
    onActiveChartChange,
    onMaximizeChart,
    chartRefs,
    onAlertsSync,
    onAlertTriggered,
    onReplayModeChange,
    ...chartProps
}) => {
    const getGridClass = () => {
        switch (layout) {
            case '2': return styles.grid2;
            case '3': return styles.grid3;
            case '4': return styles.grid4;
            default: return styles.grid1;
        }
    };

    const handleChartClick = (e, chartId) => {
        if (e.altKey && onMaximizeChart) {
            e.preventDefault();
            e.stopPropagation();
            onMaximizeChart(chartId);
        } else {
            onActiveChartChange(chartId);
        }
    };

    return (
        <div className={`${styles.gridContainer} ${getGridClass()}`}>
            {charts.map((chart) => (
                <div
                    key={chart.id}
                    className={`${styles.chartWrapper} ${activeChartId === chart.id && layout !== '1' ? styles.active : ''}`}
                    onClick={(e) => handleChartClick(e, chart.id)}
                >
                    <ChartComponent
                        ref={(el) => {
                            if (chartRefs.current) {
                                chartRefs.current[chart.id] = el;
                            }
                        }}
                        symbol={chart.symbol}
                        exchange={chart.exchange || 'NSE'}
                        interval={chart.interval}
                        onAlertsSync={onAlertsSync ? (alerts) => onAlertsSync(chart.id, chart.symbol, chart.exchange || 'NSE', alerts) : undefined}
                        onAlertTriggered={onAlertTriggered ? (evt) => onAlertTriggered(chart.id, chart.symbol, chart.exchange || 'NSE', evt) : undefined}
                        onReplayModeChange={onReplayModeChange ? (isActive) => onReplayModeChange(chart.id, isActive) : undefined}
                        {...chartProps}
                        indicators={chart.indicators}
                        comparisonSymbols={chart.comparisonSymbols}
                        strategyConfig={chart.strategyConfig}
                    // Override props that might be specific to the chart state if needed
                    // symbol/interval/indicators/strategyConfig are per-chart.
                    />
                </div>
            ))}
        </div>
    );
};

export default ChartGrid;
