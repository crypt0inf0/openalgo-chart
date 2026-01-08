import { LineToolManager } from './line-tool-manager';
import { TemplateManager } from './template-manager';
import './floating-toolbar.css';

export class FloatingToolbar {
    private _container: HTMLElement | null;
    private _manager: LineToolManager | null;
    private _activeTool: any | null = null;
    private _savedPosition: { x: number, y: number } | null = null;
    private _positionPending: boolean = false; // RC-3
    private _activeDropdownHandlers: Set<() => void> = new Set(); // ML-6
    private _activeDragHandlers: { move: (e: MouseEvent) => void; up: () => void } | null = null; // ML-7
    private _currentToolType: string | null = null; // B-7

    // Icons matching the "thin stroke" style of the provided images
    private static readonly ICONS = {
        // 6-dot grid handle (Standard TV style)
        drag: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 12" width="8" height="12" fill="currentColor"><rect width="2" height="2" rx="1"></rect><rect width="2" height="2" rx="1" y="5"></rect><rect width="2" height="2" rx="1" y="10"></rect><rect width="2" height="2" rx="1" x="6"></rect><rect width="2" height="2" rx="1" x="6" y="5"></rect><rect width="2" height="2" rx="1" x="6" y="10"></rect></svg>',
        // Templates (Grid Layout)
        template: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="currentColor"><path stroke-linecap="round" d="M15.5 18.5h6m-3 3v-6"></path><rect width="6" height="6" rx="1.5" x="6.5" y="6.5"></rect><rect width="6" height="6" rx="1.5" x="15.5" y="6.5"></rect><rect width="6" height="6" rx="1.5" x="6.5" y="15.5"></rect></svg>',
        // Pencil (Line Color)
        brush: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M10.62.72a2.47 2.47 0 0 1 3.5 0l1.16 1.16c.96.97.96 2.54 0 3.5l-.58.58-8.9 8.9-1 1-.14.14H0v-4.65l.14-.15 1-1 8.9-8.9.58-.58Zm2.8.7a1.48 1.48 0 0 0-2.1 0l-.23.23 3.26 3.26.23-.23c.58-.58.58-1.52 0-2.1l-1.16-1.16Zm.23 4.2-3.26-3.27-8.2 8.2 3.25 3.27 8.2-8.2Zm-8.9 8.9-3.27-3.26-.5.5V15h3.27l.5-.5Z"></path></svg>',
        // Text 'T'
        text: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 13 15" width="13" height="15" fill="none"><path stroke="currentColor" d="M4 14.5h2.5m2.5 0H6.5m0 0V.5m0 0h-5a1 1 0 0 0-1 1V4m6-3.5h5a1 1 0 0 1 1 1V4"></path></svg>',
        // Paint Bucket (Fill)
        fill: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" fill="none"><path stroke="currentColor" d="M13.5 6.5l-3-3-7 7 7.59 7.59a2 2 0 0 0 2.82 0l4.18-4.18a2 2 0 0 0 0-2.82L13.5 6.5zm0 0v-4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6"></path><path fill="currentColor" d="M0 16.5C0 15 2.5 12 2.5 12S5 15 5 16.5 4 19 2.5 19 0 18 0 16.5z"></path><circle fill="currentColor" cx="9.5" cy="9.5" r="1.5"></circle></svg>',


        // Alert (Stopwatch +)
        alert: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="currentColor" d="m19.54 4.5 3.96 4.32-.74.68-3.96-4.32.74-.68ZM7.46 4.5 3.5 8.82l.74.68L8.2 5.18l-.74-.68ZM19.74 10.33A7.5 7.5 0 0 1 21 14.5v.5h1v-.5a8.5 8.5 0 1 0-8.5 8.5h.5v-1h-.5a7.5 7.5 0 1 1 6.24-11.67Z"></path><path fill="currentColor" d="M13 9v5h-3v1h4V9h-1ZM19 20v-4h1v4h4v1h-4v4h-1v-4h-4v-1h4Z"></path></svg>',
        // Lock
        lock: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="currentColor" fill-rule="evenodd" d="M14 6a3 3 0 0 0-3 3v3h8.5a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 6 21.5v-7A2.5 2.5 0 0 1 8.5 12H10V9a4 4 0 0 1 8 0h-1a3 3 0 0 0-3-3zm-1 11a1 1 0 1 1 2 0v2a1 1 0 1 1-2 0v-2zm-6-2.5c0-.83.67-1.5 1.5-1.5h11c.83 0 1.5.67 1.5 1.5v7c0 .83-.67 1.5-1.5 1.5h-11A1.5 1.5 0 0 1 7 21.5v-7z"></path></svg>',
        // Trash
        delete: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="currentColor" d="M18 7h5v1h-2.01l-1.33 14.64a1.5 1.5 0 0 1-1.5 1.36H9.84a1.5 1.5 0 0 1-1.49-1.36L7.01 8H5V7h5V6c0-1.1.9-2 2-2h4a2 2 0 0 1 2 2v1Zm-6-2a1 1 0 0 0-1 1v1h6V6a1 1 0 0 0-1-1h-4ZM8.02 8l1.32 14.54a.5.5 0 0 0 .5.46h8.33a.5.5 0 0 0 .5-.46L19.99 8H8.02Z"></path></svg>',
        // More
        more: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none"><path fill="currentColor" fillrule="evenodd" cliprule="evenodd" d="M7.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM5 14.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0zm9.5-1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM12 14.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0zm9.5-1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM19 14.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0z"></path></svg>',
        // Style (Line Style)
        style: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><path stroke="currentColor" d="M4 13.5h20"></path></svg>',
        // Eraser
        eraser: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="currentColor" d="M21.5 13.5L14 6l-8.5 8.5 2.5 2.5H6v1h7v-1h-2.5l-1.5-1.5 8.5-8.5 2.5 2.5 1.5-1.5zM14 7.41l6.09 6.09-1.09 1.09L12.91 8.5 14 7.41z"></path></svg>',
        // Price Label
        priceLabel: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><g fill="currentColor" fill-rule="nonzero"><path d="M6.995 5c.008 0 .005 15.5.005 15.5h-1v-15.493c0-.556.451-1.007.995-1.007h17.01c.549 0 .995.45.995 1.007v11.986c0 .556-.45 1.007-1.007 1.007h-12.993l-3.104 3.104-.707-.707 3.397-3.397h13.407c.004 0 .007-11.993.007-11.993 0-.007-17.005-.007-17.005-.007z"></path><path d="M6.5 24c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5zm0 1c-1.381 0-2.5-1.119-2.5-2.5s1.119-2.5 2.5-2.5 2.5 1.119 2.5 2.5-1.119 2.5-2.5 2.5z"></path></g></svg>',
        datePriceRange: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><g fill="currentColor"><path fill-rule="nonzero" d="M6.5 23v1h17.5v-17.5h-1v16.5z"></path><path fill-rule="nonzero" d="M21.5 5v-1h-17.5v17.5h1v-16.5z"></path><path fill-rule="nonzero" d="M4.5 25c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5zm0 1c-1.381 0-2.5-1.119-2.5-2.5s1.119-2.5 2.5-2.5 2.5 1.119 2.5 2.5-1.119 2.5-2.5 2.5zM23.5 6c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5zm0 1c-1.381 0-2.5-1.119-2.5-2.5s1.119-2.5 2.5-2.5 2.5 1.119 2.5 2.5-1.119 2.5-2.5 2.5z"></path><path fill-rule="nonzero" d="M13 9v13h1v-13z" id="Line"></path><path d="M13.5 6l2.5 3h-5z"></path><path fill-rule="nonzero" d="M19 14h-13v1h13z"></path><path d="M19 17v-5l3 2.5z"></path></g></svg>',
        headAndShoulders: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><g fill="currentColor" fill-rule="nonzero"><path d="M4.436 21.667l2.083-9.027-.974-.225-2.083 9.027zM10.046 16.474l-2.231-4.463-.894.447 2.231 4.463zM13.461 6.318l-2.88 10.079.962.275 2.88-10.079zM18.434 16.451l-2.921-10.224-.962.275 2.921 10.224zM21.147 12.089l-2.203 4.405.894.447 2.203-4.405zM25.524 21.383l-2.09-9.055-.974.225 2.09 9.055z"></path><path d="M1 19h7.5v-1h-7.5z"></path><path d="M12.5 19h4v-1h-4z"></path><path d="M20.5 19h6.5v-1h-6.5z"></path><path d="M6.5 12c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5zm0 1c-1.381 0-2.5-1.119-2.5-2.5s1.119-2.5 2.5-2.5 2.5 1.119 2.5 2.5-1.119 2.5-2.5 2.5zM3.5 25c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5zm0 1c-1.381 0-2.5-1.119-2.5-2.5s1.119-2.5 2.5-2.5 2.5 1.119 2.5 2.5-1.119 2.5-2.5 2.5zM10.5 20c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5zm0 1c-1.381 0-2.5-1.119-2.5-2.5s1.119-2.5 2.5-2.5 2.5 1.119 2.5 2.5-1.119 2.5-2.5 2.5zM18.5 20c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5zm0 1c-1.381 0-2.5-1.119-2.5-2.5s1.119-2.5 2.5-2.5 2.5 1.119 2.5 2.5-1.119 2.5-2.5 2.5zM22.5 12c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5zm0 1c-1.381 0-2.5-1.119-2.5-2.5s1.119-2.5 2.5-2.5 2.5 1.119 2.5 2.5-1.119 2.5-2.5 2.5zM25.5 25c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5zm0 1c-1.381 0-2.5-1.119-2.5-2.5s1.119-2.5 2.5-2.5 2.5 1.119 2.5 2.5-1.119 2.5-2.5 2.5zM14.5 6c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5zm0 1c-1.381 0-2.5-1.119-2.5-2.5s1.119-2.5 2.5-2.5 2.5 1.119 2.5 2.5-1.119 2.5-2.5 2.5z"></path></g></svg>',
        // More menu icons
        visibility: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="currentColor" d="M14 7c5.2 0 9.87 3.13 11.8 7.93a.5.5 0 1 1-.93.36A11.48 11.48 0 0 0 14 8a11.48 11.48 0 0 0-10.87 7.29.5.5 0 1 1-.93-.36A12.48 12.48 0 0 1 14 7zm0 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 1a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"></path></svg>',
        clone: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="currentColor" fill-rule="evenodd" d="M7 7h11v3h1V6.5a.5.5 0 0 0-.5-.5H6.5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5H10v-1H7V7zm3 4.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11zm1 .5v10h10V12H11z"></path></svg>',
        copy: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="currentColor" d="M8 5h11a1 1 0 0 1 1 1v2h1V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h2v-1H8a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm4 6a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V12a1 1 0 0 0-1-1H12zm0-1h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2z"></path></svg>',
        hide: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="currentColor" d="M5.15 4.44a.5.5 0 0 0-.7.7l3.4 3.42a12.48 12.48 0 0 0-5.67 6.3.5.5 0 1 0 .93.36 11.48 11.48 0 0 1 5.2-5.75l1.88 1.87A3.99 3.99 0 0 0 14 18a4 4 0 0 0 2.66-1.02l6.2 6.18a.5.5 0 0 0 .7-.7l-18.4-18.02zM16 16.27A3 3 0 0 1 11.73 12l4.27 4.27zm-2-5.3l3.03 3.02c.12-.3.21-.63.24-.99H16.2a.5.5 0 0 1 0-1h1.08a3.99 3.99 0 0 0-1.3-2.29l-.7.71a.5.5 0 0 1-.71-.71l.72-.72A4 4 0 0 0 14 9.5a.5.5 0 0 1 0-1c.7 0 1.37.14 1.98.4l.72-.71A5 5 0 0 1 14 7c-.82 0-1.6.14-2.33.4l.81.81A4 4 0 0 1 14 8a.5.5 0 0 1 0 1 3 3 0 0 0-2.11.86l.79.79c.4-.26.85-.43 1.32-.51v1.07a.5.5 0 0 1-1 0v-.54zm3.07-2.68l.71-.71a12.48 12.48 0 0 1 7.04 7.28.5.5 0 0 1-.93.36 11.48 11.48 0 0 0-6.82-6.93z"></path></svg>',
        chevronRight: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="currentColor" d="M11.646 7.354L18.293 14l-6.647 6.646.708.708 7-7a.5.5 0 0 0 0-.708l-7-7-.708.708z"></path></svg>'
    };

    constructor(manager: LineToolManager) {
        this._manager = manager;
        this._container = document.createElement('div');
        this._container.className = 'tv-floating-toolbar hidden';
        document.body.appendChild(this._container);
    }

    public showCollapsed(toolType: string) {
        this._renderCollapsed(toolType);
        this._positionToolbar();
    }

    public showExpanded(tool: any) {
        this._activeTool = tool;
        this._renderExpanded(tool);
        this._positionToolbar();
    }

    public hide() {
        if (this._container) {
            this._container.classList.add('hidden');
        }
        this._closeAllDropdowns();
    }

    public destroy(): void {
        this.hide();
        this._closeAllDropdowns();

        // Clean up all active dropdown handlers (ML-6)
        this._activeDropdownHandlers.forEach(handler => {
            document.removeEventListener('click', handler);
        });
        this._activeDropdownHandlers.clear();

        // Clean up any active drag handlers (ML-7)
        if (this._activeDragHandlers) {
            document.removeEventListener('mousemove', this._activeDragHandlers.move);
            document.removeEventListener('mouseup', this._activeDragHandlers.up);
            this._activeDragHandlers = null;
        }

        if (this._container && this._container.parentNode) {
            this._container.parentNode.removeChild(this._container);
        }
        this._container = null;
        this._manager = null;
    }

    private _positionToolbar() {
        // Prevent race conditions (RC-3)
        if (this._positionPending) return;
        this._positionPending = true;

        requestAnimationFrame(() => {
            if (!this._container) {
                this._positionPending = false;
                return;
            }

            if (this._savedPosition) {
                this._show(this._savedPosition.x, this._savedPosition.y);
            } else if (this._container && this._manager) {
                const chartRect = this._manager.getChartRect();
                const toolbarRect = this._container.getBoundingClientRect();

                if (chartRect) {
                    // Default: 15px from top, 30px from right inside the chart
                    // Note: We need to use client coordinates (relative to viewport) because position is fixed/absolute
                    const initialX = chartRect.right - toolbarRect.width - 100;
                    const initialY = chartRect.top + 15;
                    this._show(initialX, initialY);
                } else {
                    // Fallback if chart rect is not available
                    const initialX = window.innerWidth - toolbarRect.width - 100;
                    const initialY = 100;
                    this._show(initialX, initialY);
                }
            } else {
                // If container or manager is null, just set pending to false
                this._positionPending = false;
            }

            this._positionPending = false;
        });
    }

    public updatePosition(x: number, y: number) {
        if (!this._container || !this._manager) return;
        if (this._container.classList.contains('hidden')) return;

        const rect = this._container.getBoundingClientRect();
        const chartRect = this._manager.getChartRect();

        let minX = 10;
        let minY = 10;
        let maxX = window.innerWidth - rect.width - 10;
        let maxY = window.innerHeight - rect.height - 10;

        if (chartRect) {
            minX = chartRect.left;
            minY = chartRect.top;
            maxX = chartRect.right - rect.width;
            maxY = chartRect.bottom - rect.height;
        }

        const finalX = Math.min(Math.max(minX, x), maxX);
        const finalY = Math.min(Math.max(minY, y), maxY);

        this._container.style.left = `${finalX}px`;
        this._container.style.top = `${finalY}px`;
    }

    private _show(x: number, y: number) {
        if (!this._container) return;
        this._container.classList.remove('hidden');
        this.updatePosition(x, y);
    }

    private _renderCollapsed(toolType: string) {
        if (!this._container) return;

        // Only recreate if tool type changed (B-7)
        if (this._currentToolType === toolType && this._container.children.length > 0) {
            return;
        }

        this._currentToolType = toolType;
        this._container.innerHTML = '';
        this._container.dataset.tool = toolType;
        this._container.appendChild(this._createDragHandle());

        // Use pencil icon as default for all tools, with special icons for Text, Alert, and Eraser
        let icon = FloatingToolbar.ICONS.brush;
        if (toolType === 'Text') icon = FloatingToolbar.ICONS.text;
        if (toolType === 'UserPriceAlerts') icon = FloatingToolbar.ICONS.alert;
        if (toolType === 'Eraser') icon = FloatingToolbar.ICONS.eraser;

        const toolBtn = this._createButton(icon, toolType);
        toolBtn.classList.add('active');
        this._container.appendChild(toolBtn);
    }

    private _renderExpanded(tool: any) {
        if (!this._container || !this._manager) return;

        this._container.innerHTML = '';

        // 1. Drag Handle
        this._container.appendChild(this._createDragHandle());

        // 2. Templates (Template Icon)
        const templateWrapper = this._createToolWrapper();
        const templateBtn = this._createButton(FloatingToolbar.ICONS.template, 'Templates');
        templateBtn.addEventListener('click', (e) => this._toggleDropdown(e, templateWrapper, (container) => this._createTemplateList(container, tool)));
        templateWrapper.appendChild(templateBtn);
        this._container.appendChild(templateWrapper);

        const options = tool._options || {};
        // Use toolType property instead of constructor.name to avoid minification issues
        const toolType = (tool as any).toolType || tool.constructor.name;
        const isTextTool = toolType === 'Text' || toolType === 'Callout';

        // 3. Line Color (Pencil) - Skip for Text/Callout tools
        if (!isTextTool) {
            const lineColorWrapper = this._createToolWrapper();
            const activeLineColor = options.lineColor || options.borderColor || options.color || '#2962ff';
            const lineColorBtn = this._createFillButton(FloatingToolbar.ICONS.brush, 'Line Color', activeLineColor);

            lineColorBtn.addEventListener('click', (e) => this._toggleDropdown(e, lineColorWrapper, (container) => this._createColorGrid(container, tool, 'line', lineColorBtn)));
            lineColorWrapper.appendChild(lineColorBtn);
            this._container.appendChild(lineColorWrapper);
        }

        // 4. Fill Color (Bucket) - Only if tool supports background
        if (options.backgroundColor !== undefined) {
            const fillColorWrapper = this._createToolWrapper();
            const fillColorBtn = this._createFillButton(FloatingToolbar.ICONS.fill, 'Fill Color', options.backgroundColor);

            fillColorBtn.addEventListener('click', (e) => this._toggleDropdown(e, fillColorWrapper, (container) => this._createColorGrid(container, tool, 'fill', fillColorBtn)));
            fillColorWrapper.appendChild(fillColorBtn);
            this._container.appendChild(fillColorWrapper);
        }

        // 5. Text Color (if applicable)
        // Text tool uses 'color', Callout uses 'textColor'
        if (options.textColor !== undefined || (isTextTool && options.color !== undefined)) {
            const textColorWrapper = this._createToolWrapper();
            const activeTextColor = options.textColor || options.color || '#131722';
            const textColorBtn = this._createFillButton(FloatingToolbar.ICONS.text, 'Text Color', activeTextColor);

            textColorBtn.addEventListener('click', (e) => this._toggleDropdown(e, textColorWrapper, (container) => this._createColorGrid(container, tool, 'text', textColorBtn)));
            textColorWrapper.appendChild(textColorBtn);
            this._container.appendChild(textColorWrapper);
        }

        this._addSeparator();

        // 6. Font Size (for Text/Callout) OR Stroke Width (for other tools)
        if (isTextTool && options.fontSize !== undefined) {
            const fontSizeWrapper = this._createToolWrapper();

            // Custom Trigger: Font Size Display
            const fontSizeTrigger = document.createElement('div');
            fontSizeTrigger.className = 'font-size-trigger';
            fontSizeTrigger.title = 'Font Size';

            const currentFontSize = options.fontSize || 14;

            const label = document.createElement('span');
            label.textContent = `${currentFontSize}`;

            fontSizeTrigger.appendChild(label);

            fontSizeTrigger.addEventListener('click', (e) => this._toggleDropdown(e, fontSizeWrapper, (container) => this._createFontSizeList(container, tool, label)));

            fontSizeWrapper.appendChild(fontSizeTrigger);
            this._container.appendChild(fontSizeWrapper);
        } else if (!isTextTool && (options.lineWidth !== undefined || options.width !== undefined)) {
            const widthWrapper = this._createToolWrapper();

            // Custom Trigger: Line Preview + Text
            const widthTrigger = document.createElement('div');
            widthTrigger.className = 'stroke-width-trigger';
            widthTrigger.title = 'Line Width';

            const currentWidth = options.lineWidth || options.width || 1;

            const linePreview = document.createElement('div');
            linePreview.className = 'stroke-width-preview';
            linePreview.style.height = `${Math.max(1, currentWidth)}px`;

            const label = document.createElement('span');
            label.textContent = `${currentWidth}px`;

            widthTrigger.appendChild(linePreview);
            widthTrigger.appendChild(label);

            widthTrigger.addEventListener('click', (e) => this._toggleDropdown(e, widthWrapper, (container) => this._createWidthList(container, tool, linePreview, label)));

            widthWrapper.appendChild(widthTrigger);
            this._container.appendChild(widthWrapper);
        }

        this._addSeparator();



        // 8. Alert
        if (this._manager && this._manager.toolSupportsAlerts(tool)) {
            const alertBtn = this._createButton(FloatingToolbar.ICONS.alert, 'Add Alert');
            alertBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (this._activeTool && this._manager) {
                    this._manager.createAlertForTool(this._activeTool);
                }
            });
            this._container.appendChild(alertBtn);
        }

        // 9. Lock
        const lockBtn = this._createButton(FloatingToolbar.ICONS.lock, 'Lock');
        const isLocked = tool._locked || false;
        if (isLocked) {
            lockBtn.classList.add('active');
        }
        lockBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (this._activeTool && this._manager) {
                this._manager.toggleToolLock(this._activeTool);
                // Update button visual state
                if (this._activeTool._locked) {
                    lockBtn.classList.add('active');
                } else {
                    lockBtn.classList.remove('active');
                }
            }
        });
        this._container.appendChild(lockBtn);

        // 10. Delete
        const deleteBtn = this._createButton(FloatingToolbar.ICONS.delete, 'Remove');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (this._activeTool && this._manager) {
                this._manager.deleteTool(this._activeTool);
            }
        });
        this._container.appendChild(deleteBtn);

        // 11. More (dropdown)
        const moreWrapper = this._createToolWrapper();
        const moreBtn = this._createButton(FloatingToolbar.ICONS.more, 'More');
        moreBtn.addEventListener('click', (e) => this._toggleDropdown(e, moreWrapper, (container) => this._createMoreMenu(container, tool)));
        moreWrapper.appendChild(moreBtn);
        this._container.appendChild(moreWrapper);
    }

    private _createDragHandle(): HTMLElement {
        const dragHandle = document.createElement('div');
        dragHandle.className = 'drag-handle';
        dragHandle.innerHTML = FloatingToolbar.ICONS.drag;
        dragHandle.addEventListener('mousedown', (e) => this._startDrag(e as any));
        return dragHandle;
    }

    private _createToolWrapper(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.className = 'tool-wrapper';
        return wrapper;
    }

    private _createButton(iconHtml: string, title: string): HTMLElement {
        const btn = document.createElement('button');
        btn.className = 'tool-btn';
        btn.innerHTML = iconHtml;
        btn.title = title;
        return btn;
    }

    private _createFillButton(iconHtml: string, title: string, backgroundColor: string): HTMLElement {
        const btn = document.createElement('button');
        btn.className = 'tool-btn fill-btn';
        btn.title = title;

        // Create wrapper div
        const wrapper = document.createElement('div');
        wrapper.className = 'fill-btn-wrap';

        // Create icon span
        const iconSpan = document.createElement('span');
        iconSpan.className = 'fill-btn-icon';
        iconSpan.innerHTML = iconHtml;

        // Create color indicator wrapper
        const colorBg = document.createElement('div');
        colorBg.className = 'fill-btn-color-bg';

        // Create color indicator
        const colorDiv = document.createElement('div');
        colorDiv.className = 'fill-btn-color';
        colorDiv.style.backgroundColor = backgroundColor;

        colorBg.appendChild(colorDiv);
        wrapper.appendChild(iconSpan);
        wrapper.appendChild(colorBg);
        btn.appendChild(wrapper);

        return btn;
    }

    private _addSeparator() {
        if (!this._container) return;
        const sep = document.createElement('div');
        sep.className = 'divider';
        this._container.appendChild(sep);
    }

    private _toggleDropdown(e: Event, wrapper: HTMLElement, renderContent: (container: HTMLElement) => void) {
        e.stopPropagation();

        const existingDropdown = wrapper.querySelector('.tv-floating-toolbar__dropdown');
        if (existingDropdown && existingDropdown.classList.contains('visible')) {
            existingDropdown.classList.remove('visible');
            return;
        }

        this._closeAllDropdowns();

        let dropdown = wrapper.querySelector('.tv-floating-toolbar__dropdown') as HTMLElement;
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.className = 'tv-floating-toolbar__dropdown';
            wrapper.appendChild(dropdown);
        }

        dropdown.innerHTML = '';
        renderContent(dropdown);

        const closeHandler = () => {
            dropdown.classList.remove('visible');
            document.removeEventListener('click', closeHandler);
            this._activeDropdownHandlers.delete(closeHandler);
        };

        this._activeDropdownHandlers.add(closeHandler);
        requestAnimationFrame(() => {
            if (!this._activeDropdownHandlers.has(closeHandler)) return; // Component destroyed
            dropdown.classList.add('visible');
            setTimeout(() => {
                if (this._activeDropdownHandlers.has(closeHandler)) {
                    document.addEventListener('click', closeHandler);
                }
            }, 0);
        });
        dropdown.addEventListener('click', (e) => e.stopPropagation());
    }

    private _closeAllDropdowns() {
        if (!this._container) return;
        const open = this._container.querySelectorAll('.tv-floating-toolbar__dropdown.visible');
        open.forEach(el => el.classList.remove('visible'));
    }

    // --- Content Generators ---

    private _createWidthList(container: HTMLElement, tool: any, previewLine: HTMLElement, previewLabel: HTMLElement) {
        const widths = [1, 2, 3, 4];
        const currentWidth = (tool._options?.lineWidth || tool._options?.width || 1);

        widths.forEach(width => {
            const item = document.createElement('div');
            item.className = 'tv-width-picker__item';
            if (width === currentWidth) item.classList.add('active');

            item.innerHTML = `
                <div class="tv-width-picker__line" style="height: ${width}px"></div>
                <div class="tv-width-picker__text">${width}px</div>
            `;

            item.addEventListener('click', () => {
                this._applyWidth(tool, width);
                previewLine.style.height = `${width}px`;
                previewLabel.textContent = `${width}px`;
                container.classList.remove('visible');
            });
            container.appendChild(item);
        });
    }

    private _createFontSizeList(container: HTMLElement, tool: any, previewLabel: HTMLElement) {
        const fontSizes = [8, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 40];
        const currentFontSize = (tool._options?.fontSize || 14);

        fontSizes.forEach(size => {
            const item = document.createElement('div');
            item.className = 'tv-font-size-picker__item';
            if (size === currentFontSize) item.classList.add('active');

            item.innerHTML = `<div class="tv-font-size-picker__text">${size}</div>`;

            item.addEventListener('click', () => {
                this._applyFontSize(tool, size);
                previewLabel.textContent = `${size}`;
                container.classList.remove('visible');
            });
            container.appendChild(item);
        });
    }

    private _createTemplateList(container: HTMLElement, tool: any) {
        const saveItem = document.createElement('div');
        saveItem.className = 'tv-template-item';
        saveItem.innerHTML = `<span>Save Drawing Template As...</span>`;
        saveItem.addEventListener('click', () => {
            this._saveTemplate(tool);
            container.classList.remove('visible');
        });
        container.appendChild(saveItem);

        const defaultItem = document.createElement('div');
        defaultItem.className = 'tv-template-item';
        defaultItem.innerHTML = `<span>Apply Default Drawing Template</span>`;
        container.appendChild(defaultItem);

        const templates = TemplateManager.loadTemplates();
        if (templates.length > 0) {
            const sep = document.createElement('div');
            sep.className = 'tv-dropdown-separator';
            container.appendChild(sep);

            templates.forEach(template => {
                const item = document.createElement('div');
                item.className = 'tv-template-item';
                item.innerHTML = `
                    <span class="tv-template-item__name">${this._escapeHtml(template.name)}</span>
                    <button class="tv-template-item__delete" title="Delete template">×</button>
                `;

                item.querySelector('.tv-template-item__name')?.addEventListener('click', () => {
                    if (TemplateManager.applyTemplate(template.id, tool)) {
                        this._renderExpanded(tool);
                    }
                });

                item.querySelector('.tv-template-item__delete')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (TemplateManager.deleteTemplate(template.id)) {
                        container.innerHTML = '';
                        this._createTemplateList(container, tool);
                    }
                });

                container.appendChild(item);
            });
        }
    }

    private _createColorGrid(container: HTMLElement, tool: any, context: 'line' | 'fill' | 'text', triggerBtn: HTMLElement) {
        const colors = [
            '#ffffff', '#e1e1e1', '#b2b5be', '#787b86', '#5d606b', '#434651', '#2a2e39', '#131722',
            '#f23645', '#ff9800', '#ffe600', '#4caf50', '#00bcd4', '#2962ff', '#673ab7', '#9c27b0',
            '#ef9a9a', '#ffe0b2', '#fff9c4', '#c8e6c9', '#b2ebf2', '#bbdefb', '#d1c4e9', '#e1bee7',
            '#e57373', '#ffcc80', '#fff59d', '#a5d6a7', '#80deea', '#90caf9', '#b39ddb', '#ce93d8',
            '#ef5350', '#ffb74d', '#fff176', '#81c784', '#4dd0e1', '#64b5f6', '#9575cd', '#ba68c8',
            '#e53935', '#ffa726', '#ffee58', '#66bb6a', '#26c6da', '#42a5f5', '#7e57c2', '#ab47bc',
            '#d32f2f', '#fb8c00', '#fdd835', '#43a047', '#00acc1', '#1e88e5', '#5e35b1', '#8e24aa',
            '#c62828', '#f57c00', '#fbc02d', '#388e3c', '#0097a7', '#1976d2', '#512da8', '#7b1fa2'
        ];

        const grid = document.createElement('div');
        grid.className = 'tv-color-picker__grid';

        const currentOptions = tool._options || {};
        let currentColor = context === 'line'
            ? (currentOptions.lineColor || currentOptions.borderColor || currentOptions.color || '#2962ff')
            : context === 'text'
                ? (currentOptions.textColor || '#131722')
                : (currentOptions.backgroundColor || '#2962ff');

        colors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'tv-color-picker__swatch';
            swatch.style.backgroundColor = color;
            if (currentColor.toLowerCase().startsWith(color.toLowerCase())) {
                swatch.classList.add('active');
            }

            swatch.addEventListener('click', () => {
                this._applyColor(tool, color, context);
                // Update color indicator for both line and fill buttons (both use fill-btn-color class)
                const colorIndicator = triggerBtn.querySelector('.fill-btn-color') as HTMLElement;
                if (colorIndicator) colorIndicator.style.backgroundColor = color;
                this._updateOpacitySlider(container, color);
            });
            grid.appendChild(swatch);
        });

        container.appendChild(grid);

        const sep = document.createElement('div');
        sep.className = 'tv-dropdown-separator';
        container.appendChild(sep);

        const customBtn = document.createElement('div');
        customBtn.className = 'tv-color-picker__custom-btn';
        customBtn.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z"/></svg>`;

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.className = 'tv-color-picker__input';
        colorInput.addEventListener('input', (e: any) => {
            this._applyColor(tool, e.target.value, context);
            // Update color indicator for both line and fill buttons (both use fill-btn-color class)
            const colorIndicator = triggerBtn.querySelector('.fill-btn-color') as HTMLElement;
            if (colorIndicator) colorIndicator.style.backgroundColor = e.target.value;
            this._updateOpacitySlider(container, e.target.value);
        });

        customBtn.appendChild(colorInput);
        container.appendChild(customBtn);

        this._renderOpacitySlider(container, tool, context);
    }

    private _renderOpacitySlider(container: HTMLElement, tool: any, context: 'line' | 'fill' | 'text') {
        const sliderContainer = document.createElement('div');
        sliderContainer.className = 'tv-opacity-slider';

        const label = document.createElement('div');
        label.className = 'tv-opacity-slider__label';
        label.textContent = 'Opacity';
        sliderContainer.appendChild(label);

        const controls = document.createElement('div');
        controls.className = 'tv-opacity-slider__controls';

        const track = document.createElement('div');
        track.className = 'tv-opacity-slider__track';

        const thumb = document.createElement('div');
        thumb.className = 'tv-opacity-slider__thumb';

        track.appendChild(thumb);
        controls.appendChild(track);

        const valueDisplay = document.createElement('div');
        valueDisplay.className = 'tv-opacity-slider__value';
        controls.appendChild(valueDisplay);

        sliderContainer.appendChild(controls);
        container.appendChild(sliderContainer);

        const options = tool._options || {};
        let currentColor = context === 'line'
            ? (options.lineColor || options.borderColor || options.color || '#2962ff')
            : (options.backgroundColor || '#2962ff');

        let currentOpacity = 1.0;
        if (currentColor.startsWith('rgba')) {
            const match = currentColor.match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
            if (match) currentOpacity = parseFloat(match[1]);
        }

        const initialPercent = Math.round(currentOpacity * 100);
        thumb.style.left = `${initialPercent}%`;
        valueDisplay.innerText = `${initialPercent}%`;

        // Updated logic removing the unused 'isDragging' variable
        const updateOpacity = (clientX: number) => {
            const rect = track.getBoundingClientRect();
            let x = clientX - rect.left;
            x = Math.max(0, Math.min(x, rect.width));
            const percent = Math.round((x / rect.width) * 100);

            thumb.style.left = `${percent}%`;
            valueDisplay.innerText = `${percent}%`;

            this._applyOpacity(tool, percent / 100, context);
        };

        track.addEventListener('mousedown', (e) => {
            // Clean up any existing handlers (ML-7)
            if (this._activeDragHandlers) {
                document.removeEventListener('mousemove', this._activeDragHandlers.move);
                document.removeEventListener('mouseup', this._activeDragHandlers.up);
            }

            updateOpacity(e.clientX);
            const move = (e: MouseEvent) => updateOpacity(e.clientX);
            const up = () => {
                document.removeEventListener('mousemove', move);
                document.removeEventListener('mouseup', up);
                this._activeDragHandlers = null;
            };

            this._activeDragHandlers = { move, up };
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
            e.preventDefault();
        });
    }

    private _updateOpacitySlider(container: HTMLElement, color: string) {
        const track = container.querySelector('.tv-opacity-slider__track') as HTMLElement;
        if (track) track.style.background = `linear-gradient(to right, #E0E3EB 0%, ${color} 100%)`;
    }

    private _applyOpacity(tool: any, alpha: number, context: 'line' | 'fill' | 'text') {
        const options = tool._options || {};
        let color = context === 'line'
            ? (options.lineColor || options.borderColor || options.color || '#2962ff')
            : context === 'text'
                ? (options.textColor || '#131722')
                : (options.backgroundColor || '#2962ff');

        if (color.startsWith('#')) {
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            color = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        } else if (color.startsWith('rgb')) {
            color = color.replace(/[\d\.]+\)$/g, `${alpha})`);
        }

        this._applyColor(tool, color, context);
    }

    private _applyColor(tool: any, color: string, context: 'line' | 'fill' | 'text') {
        const options = tool._options || {};
        let currentColor = context === 'line'
            ? (options.lineColor || options.borderColor || options.color || '#2962ff')
            : context === 'text'
                ? (options.textColor || options.color || '#131722')
                : (options.backgroundColor || '#2962ff');

        if (!color.startsWith('rgba')) {
            let currentOpacity = 1.0;
            if (currentColor.startsWith('rgba')) {
                const match = currentColor.match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
                if (match) currentOpacity = parseFloat(match[1]);
            }
            if (currentOpacity < 1.0 && color.startsWith('#')) {
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                color = `rgba(${r}, ${g}, ${b}, ${currentOpacity})`;
            }
        }

        const updates: any = {};
        if (context === 'line') {
            if (options.lineColor !== undefined) updates.lineColor = color;
            if (options.borderColor !== undefined) updates.borderColor = color;
            if (options.color !== undefined && options.textColor === undefined) updates.color = color;
            if (options.textColor !== undefined && options.backgroundColor === undefined) updates.textColor = color;
        } else if (context === 'text') {
            // Text tool uses 'color', Callout uses 'textColor'
            if (options.textColor !== undefined) updates.textColor = color;
            if (options.color !== undefined && options.textColor === undefined) updates.color = color;
        } else {
            if (options.backgroundColor !== undefined) updates.backgroundColor = color;
        }

        tool.applyOptions(updates);
        if (this._manager) {
            const type = (tool as any).toolType || tool.constructor.name;
            this._manager.updateToolOptions(type as any, updates);
        }
    }

    private _applyWidth(tool: any, width: number) {
        if (!this._manager) return;
        const updates: any = {};
        if (tool._options?.lineWidth !== undefined) updates.lineWidth = width;
        if (tool._options?.width !== undefined) updates.width = width;
        tool.applyOptions(updates);
        const type = (tool as any).toolType || tool.constructor.name;
        this._manager.updateToolOptions(type as any, updates);
    }

    private _applyFontSize(tool: any, fontSize: number) {
        if (!this._manager) return;
        const updates: any = { fontSize };
        tool.applyOptions(updates);
        const type = (tool as any).toolType || tool.constructor.name;
        this._manager.updateToolOptions(type as any, updates);
    }

    private _saveTemplate(tool: any) {
        const name = prompt('Enter template name:');
        if (!name) return;
        const styles = TemplateManager.extractStyles(tool);
        TemplateManager.saveTemplate(name, styles);
    }

    private _escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    private _startDrag(e: MouseEvent) {
        if (!this._container || !this._manager) return;

        // Clean up any existing drag handlers first (ML-9)
        if (this._activeDragHandlers) {
            document.removeEventListener('mousemove', this._activeDragHandlers.move);
            document.removeEventListener('mouseup', this._activeDragHandlers.up);
        }

        e.preventDefault();
        const startX = e.clientX;
        const startY = e.clientY;
        const rect = this._container.getBoundingClientRect();
        const startLeft = rect.left;
        const startTop = rect.top;

        const onMouseMove = (e: MouseEvent) => {
            if (!this._container || !this._manager) {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                this._activeDragHandlers = null;
                return;
            }

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            let newLeft = startLeft + deltaX;
            let newTop = startTop + deltaY;

            const chartRect = this._manager.getChartRect();
            const currentRect = this._container.getBoundingClientRect();
            let minLeft = 0;
            let minTop = 0;
            let maxLeft = window.innerWidth - currentRect.width;
            let maxTop = window.innerHeight - currentRect.height;

            if (chartRect) {
                minLeft = chartRect.left;
                minTop = chartRect.top;
                maxLeft = chartRect.right - currentRect.width;
                maxTop = chartRect.bottom - currentRect.height;
            }

            newLeft = Math.max(minLeft, Math.min(newLeft, maxLeft));
            newTop = Math.max(minTop, Math.min(newTop, maxTop));

            this._container.style.left = `${newLeft}px`;
            this._container.style.top = `${newTop}px`;
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            this._activeDragHandlers = null;
            if (this._container) {
                const rect = this._container.getBoundingClientRect();
                this._savedPosition = { x: rect.left, y: rect.top };
            }
        };

        // Track handlers for cleanup (ML-9)
        this._activeDragHandlers = { move: onMouseMove, up: onMouseUp };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    private _createMoreMenu(container: HTMLElement, tool: any) {
        // Visibility on intervals (with submenu)
        const visibilityItem = document.createElement('div');
        visibilityItem.className = 'tv-more-menu__item tv-more-menu__item--has-submenu';
        visibilityItem.innerHTML = `
            <span class="tv-more-menu__icon">${FloatingToolbar.ICONS.visibility}</span>
            <span class="tv-more-menu__label">Visibility on intervals</span>
            <span class="tv-more-menu__chevron">${FloatingToolbar.ICONS.chevronRight}</span>
        `;

        // Create submenu
        const submenu = document.createElement('div');
        submenu.className = 'tv-more-menu__submenu';

        const visibilityOptions = [
            { label: 'Current interval and above', value: 'above' },
            { label: 'Current interval and below', value: 'below' },
            { label: 'Current interval only', value: 'current' },
            { label: 'All intervals', value: 'all' }
        ];

        const currentVisibility = tool._visibilityMode || 'all';

        visibilityOptions.forEach(opt => {
            const subItem = document.createElement('div');
            subItem.className = 'tv-more-menu__submenu-item';
            if (currentVisibility === opt.value) {
                subItem.classList.add('active');
            }
            subItem.textContent = opt.label;
            subItem.addEventListener('click', (e) => {
                e.stopPropagation();
                // Use the new setToolVisibility method
                if (this._manager) {
                    this._manager.setToolVisibility(tool, opt.value as 'all' | 'above' | 'below' | 'current');
                }
                container.classList.remove('visible');
            });
            submenu.appendChild(subItem);
        });

        visibilityItem.appendChild(submenu);
        container.appendChild(visibilityItem);

        // Separator
        const sep = document.createElement('div');
        sep.className = 'tv-dropdown-separator';
        container.appendChild(sep);

        // Clone
        const cloneItem = document.createElement('div');
        cloneItem.className = 'tv-more-menu__item';
        cloneItem.innerHTML = `
            <span class="tv-more-menu__icon">${FloatingToolbar.ICONS.clone}</span>
            <span class="tv-more-menu__label">Clone</span>
            <span class="tv-more-menu__shortcut">Ctrl + Drag</span>
        `;
        cloneItem.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this._manager && this._activeTool) {
                this._manager.cloneTool?.(this._activeTool);
            }
            container.classList.remove('visible');
        });
        container.appendChild(cloneItem);

        // Copy
        const copyItem = document.createElement('div');
        copyItem.className = 'tv-more-menu__item';
        copyItem.innerHTML = `
            <span class="tv-more-menu__icon">${FloatingToolbar.ICONS.copy}</span>
            <span class="tv-more-menu__label">Copy</span>
            <span class="tv-more-menu__shortcut">Ctrl + C</span>
        `;
        copyItem.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this._manager && this._activeTool) {
                this._manager.copyTool?.(this._activeTool);
            }
            container.classList.remove('visible');
        });
        container.appendChild(copyItem);

        // Hide
        const hideItem = document.createElement('div');
        hideItem.className = 'tv-more-menu__item';
        hideItem.innerHTML = `
            <span class="tv-more-menu__icon">${FloatingToolbar.ICONS.hide}</span>
            <span class="tv-more-menu__label">Hide</span>
        `;
        hideItem.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this._manager && this._activeTool) {
                this._manager.hideTool?.(this._activeTool);
            }
            container.classList.remove('visible');
        });
        container.appendChild(hideItem);
    }
}
