import { IChartApi } from 'lightweight-charts';

export class ChartControls {
    private _chart: IChartApi;
    private _toolbar: HTMLElement | null = null;
    private _isDestroyed: boolean = false;
    private _scrollInterval: number | null = null;
    private _handleMouseMove: ((e: MouseEvent) => void) | null = null;
    private _handleMouseLeave: (() => void) | null = null;
    private _handleToolbarEnter: (() => void) | null = null;
    private _handleToolbarLeave: (() => void) | null = null;
    private _hideTimeout: number | null = null;

    constructor(chart: IChartApi) {
        this._chart = chart;
    }

    public createControls(): void {
        const chartElement = (this._chart as any).chartElement?.();
        if (!chartElement) return;

        // Ensure the chart element has relative positioning for absolute children
        if (getComputedStyle(chartElement).position === 'static') {
            chartElement.style.position = 'relative';
        }

        this._toolbar = document.createElement('div');
        this._toolbar.id = 'chart-navigation-plugin';
        this._applyStyles(this._toolbar);

        this._toolbar.innerHTML = `
            <button id="nav-zoom-out-plugin" title="Zoom Out">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 12H18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <button id="nav-zoom-in-plugin" title="Zoom In">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 6V18M6 12H18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <button id="nav-scroll-left-plugin" title="Scroll Left">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 16L10 12L14 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <button id="nav-scroll-right-plugin" title="Scroll Right">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 16L14 12L10 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <button id="nav-reset-plugin" title="Reset View">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C9.53616 4 7.33235 5.11333 5.86533 6.86533M5.86533 6.86533V4M5.86533 6.86533H8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        `;

        chartElement.appendChild(this._toolbar);

        // Track hover state
        let isHovering = false;

        const showToolbar = () => {
            if (this._isDestroyed) return;
            isHovering = true;
            if (this._hideTimeout !== null) {
                window.clearTimeout(this._hideTimeout);
                this._hideTimeout = null;
            }
            if (this._toolbar) {
                this._toolbar.style.opacity = '1';
            }
        };

        const hideToolbar = () => {
            if (this._isDestroyed) return;
            isHovering = false;
            // Delay hiding to prevent flickering
            this._hideTimeout = window.setTimeout(() => {
                if (!isHovering && this._toolbar && !this._isDestroyed) {
                    this._toolbar.style.opacity = '0';
                }
            }, 100) as unknown as number;
        };

        // Detect mouse position on chart to show/hide toolbar
        this._handleMouseMove = (e: MouseEvent) => {
            if (this._isDestroyed) return;
            const rect = chartElement.getBoundingClientRect();
            const mouseY = e.clientY - rect.top;
            const chartHeight = rect.height;

            // Show toolbar if mouse is in bottom 150px (excluding ~70px price scale area on right)
            const mouseX = e.clientX - rect.left;
            const chartWidth = rect.width;
            const isInBottomArea = mouseY > (chartHeight - 150);
            const isNotInPriceScale = mouseX < (chartWidth - 70);

            if (isInBottomArea && isNotInPriceScale) {
                showToolbar();
            } else {
                hideToolbar();
            }
        };

        this._handleMouseLeave = hideToolbar;
        this._handleToolbarEnter = showToolbar;
        this._handleToolbarLeave = hideToolbar;

        chartElement.addEventListener('mousemove', this._handleMouseMove);
        chartElement.addEventListener('mouseleave', this._handleMouseLeave);

        // Keep toolbar visible when hovering over it directly
        if (this._toolbar) {
            this._toolbar.addEventListener('mouseenter', this._handleToolbarEnter);
            this._toolbar.addEventListener('mouseleave', this._handleToolbarLeave);
        }

        this._attachListeners();
    }

    public removeControls(): void {
        this._isDestroyed = true;
        
        // Stop any active scrolling (ML-3)
        if (this._scrollInterval !== null) {
            if (this._scrollInterval > 1000) {
                window.clearInterval(this._scrollInterval);
            } else {
                window.clearTimeout(this._scrollInterval);
            }
            this._scrollInterval = null;
        }
        
        // Clear hide timeout
        if (this._hideTimeout !== null) {
            window.clearTimeout(this._hideTimeout);
            this._hideTimeout = null;
        }
        
        // Remove event listeners (ML-2)
        const chartElement = (this._chart as any).chartElement?.();
        if (chartElement && this._handleMouseMove) {
            chartElement.removeEventListener('mousemove', this._handleMouseMove);
            chartElement.removeEventListener('mouseleave', this._handleMouseLeave);
            this._handleMouseMove = null;
            this._handleMouseLeave = null;
        }
        
        if (this._toolbar) {
            if (this._handleToolbarEnter) {
                this._toolbar.removeEventListener('mouseenter', this._handleToolbarEnter);
                this._handleToolbarEnter = null;
            }
            if (this._handleToolbarLeave) {
                this._toolbar.removeEventListener('mouseleave', this._handleToolbarLeave);
                this._handleToolbarLeave = null;
            }
            if (this._toolbar.parentNode) {
                this._toolbar.parentNode.removeChild(this._toolbar);
            }
        }
        this._toolbar = null;
    }

    private _applyStyles(element: HTMLElement): void {
        Object.assign(element.style, {
            position: 'absolute',
            bottom: '50px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '8px',
            zIndex: '10',
            opacity: '0',
            transition: 'opacity 0.3s ease',
        });

        // Add styles for buttons dynamically
        const styleId = 'chart-navigation-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                #chart-navigation-plugin {
                    pointer-events: none;
                }
                #chart-navigation-plugin button {
                    background: #ffffff;
                    border: none;
                    color: #131722;
                    padding: 0;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    width: 30px;
                    height: 30px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    transition: all 0.2s;
                    position: relative;
                    z-index: 1;
                    pointer-events: auto;
                }
                #chart-navigation-plugin button:hover {
                    background: #f0f3fa;
                    color: #131722;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
                }
                #chart-navigation-plugin button svg {
                    width: 18px;
                    height: 18px;
                }
            `;
            document.head.appendChild(style);
        }
    }

    private _attachListeners(): void {
        if (!this._toolbar) return;

        const timeScale = this._chart.timeScale();

        this._toolbar.querySelector('#nav-zoom-in-plugin')?.addEventListener('click', () => {
            const currentRange = timeScale.getVisibleLogicalRange();
            if (currentRange) {
                const range = currentRange.to - currentRange.from;
                const center = (currentRange.from + currentRange.to) / 2;
                const newRange = range * 0.8;
                timeScale.setVisibleLogicalRange({
                    from: center - newRange / 2,
                    to: center + newRange / 2,
                });
            }
        });

        this._toolbar.querySelector('#nav-zoom-out-plugin')?.addEventListener('click', () => {
            const currentRange = timeScale.getVisibleLogicalRange();
            if (currentRange) {
                const range = currentRange.to - currentRange.from;
                const center = (currentRange.from + currentRange.to) / 2;
                const newRange = range * 1.25;
                timeScale.setVisibleLogicalRange({
                    from: center - newRange / 2,
                    to: center + newRange / 2,
                });
            }
        });

        const leftBtn = this._toolbar.querySelector('#nav-scroll-left-plugin');
        const rightBtn = this._toolbar.querySelector('#nav-scroll-right-plugin');

        const stopScrolling = () => {
            if (this._scrollInterval !== null) {
                if (this._scrollInterval > 1000) {
                    // It's a setInterval
                    window.clearInterval(this._scrollInterval);
                } else {
                    // It's a setTimeout
                    window.clearTimeout(this._scrollInterval);
                }
                this._scrollInterval = null;
            }
        };

        const startScrolling = (direction: number) => {
            stopScrolling();

            if (this._isDestroyed || !this._chart) return;

            const scroll = () => {
                // Check if component is still valid (ML-3)
                if (this._isDestroyed || !this._chart) {
                    stopScrolling();
                    return;
                }
                
                try {
                    const timeScale = this._chart.timeScale();
                    const currentPos = timeScale.scrollPosition();
                    timeScale.scrollToPosition(currentPos + direction, false);
                } catch (error) {
                    console.error('Error scrolling chart:', error);
                    stopScrolling();
                }
            };

            // Immediate scroll on click
            scroll();

            // Wait before starting continuous scroll
            this._scrollInterval = window.setTimeout(() => {
                if (!this._isDestroyed && this._chart) {
                    this._scrollInterval = window.setInterval(scroll, 100) as unknown as number;
                }
            }, 400) as unknown as number;
        };

        if (leftBtn) {
            leftBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                startScrolling(1);
            });
            leftBtn.addEventListener('mouseup', stopScrolling);
            leftBtn.addEventListener('mouseleave', stopScrolling);
        }

        if (rightBtn) {
            rightBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                startScrolling(-1);
            });
            rightBtn.addEventListener('mouseup', stopScrolling);
            rightBtn.addEventListener('mouseleave', stopScrolling);
        }

        this._toolbar.querySelector('#nav-reset-plugin')?.addEventListener('click', () => {
            if (this._defaultRange) {
                timeScale.setVisibleLogicalRange(this._defaultRange);
                timeScale.applyOptions({ rightOffset: 10 });
                // Reset price scale
                this._chart.priceScale('right').applyOptions({
                    autoScale: true,
                });
            } else {
                timeScale.fitContent();
                timeScale.applyOptions({ rightOffset: 10 });
            }
        });
    }

    private _defaultRange: { from: number, to: number } | null = null;

    public setDefaultRange(range: { from: number, to: number }): void {
        this._defaultRange = range;
    }
}
