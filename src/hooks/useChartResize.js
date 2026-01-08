import { useEffect } from 'react';

/**
 * Hook to handle chart resizing based on container dimensions.
 * @param {Object} chartContainerRef - Ref to the chart container element
 * @param {Object} chartInstance - Lightweight Charts instance
 */
export const useChartResize = (chartContainerRef, chartInstance) => {
    useEffect(() => {
        if (!chartContainerRef.current || !chartInstance) return;

        const resizeObserver = new ResizeObserver(entries => {
            if (!entries || entries.length === 0) return;
            const entry = entries[0];
            const { width, height } = entry.contentRect;

            if (width > 0 && height > 0) {
                chartInstance.applyOptions({ width, height });
            }
        });

        resizeObserver.observe(chartContainerRef.current);

        // Force initial sizing
        const { clientWidth, clientHeight } = chartContainerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
            chartInstance.applyOptions({ width: clientWidth, height: clientHeight });
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, [chartContainerRef, chartInstance]);
};
