import { LineSeries, createChart } from 'lightweight-charts';
import { generateLineData } from '../../../../../sample-data';
import { HorizontalLine } from '../horizontal-line';

const chart = ((window as unknown as any).chart = createChart('chart', {
    autoSize: true,
}));

const lineSeries = chart.addSeries(LineSeries);
const data = generateLineData();
lineSeries.setData(data);

const hLine = new HorizontalLine(chart, lineSeries, data[data.length - 1].value, {
    lineColor: 'red',
    width: 2,
    lineStyle: 1, // Dotted
});
lineSeries.attachPrimitive(hLine);
