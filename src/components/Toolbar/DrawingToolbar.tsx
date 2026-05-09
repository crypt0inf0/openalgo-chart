import React, { useState, useRef, useEffect } from 'react';
import type { MouseEvent, ComponentType } from 'react';
import styles from './DrawingToolbar.module.css';
import * as Icons from './ToolIcons';
import type { IconProps } from './ToolIcons';
import FloatingFavoritesToolbar from './FloatingFavoritesToolbar';

interface ToolItem {
    id: string;
    icon: ComponentType<IconProps>;
    label: string;
}

interface ToolGroup {
    id: string;
    items: ToolItem[];
    hasZoomOut?: boolean;
}

interface PopoverPosition {
    top: number;
    left: number;
}

export interface DrawingToolbarProps {
    activeTool: string | null;
    onToolChange: (toolId: string) => void;
    isDrawingsLocked?: boolean;
    isDrawingsHidden?: boolean;
    isTimerVisible?: boolean;
    isSequentialMode?: boolean;
}

const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
    activeTool,
    onToolChange,
    isDrawingsLocked = false,
    isDrawingsHidden = false,
    isTimerVisible = false,
    isSequentialMode = false
}) => {
    // Group definitions
    const toolGroups: ToolGroup[] = [
        {
            id: 'cursor_group',
            items: [
                { id: 'cursor', icon: Icons.CursorIcon, label: 'Cross' },
                { id: 'eraser', icon: Icons.EraserIcon, label: 'Eraser' }
            ]
        },
        {
            id: 'lines_group',
            items: [
                { id: 'trendline', icon: Icons.TrendLineIcon, label: 'Trend Line' },
                { id: 'ray', icon: Icons.RayIcon, label: 'Ray' },
                { id: 'horizontal', icon: Icons.HorizontalLineIcon, label: 'Horizontal Line' },
                { id: 'vertical', icon: Icons.VerticalLineIcon, label: 'Vertical Line' },
                { id: 'parallel_channel', icon: Icons.ParallelChannelIcon, label: 'Parallel Channel' }
            ]
        },
        {
            id: 'fib_group',
            items: [
                { id: 'fibonacci', icon: Icons.FibRetracementIcon, label: 'Fib Retracement' }
            ]
        },
        {
            id: 'shapes_group',
            items: [
                { id: 'brush', icon: Icons.BrushIcon, label: 'Brush' },
                { id: 'rectangle', icon: Icons.RectangleIcon, label: 'Rectangle' }
            ]
        },
        {
            id: 'text_group',
            items: [
                { id: 'text', icon: Icons.TextIcon, label: 'Text' },
                { id: 'callout', icon: Icons.CalloutIcon, label: 'Callout' }
            ]
        },
        {
            id: 'prediction_group',
            items: [
                { id: 'prediction', icon: Icons.LongPositionIcon, label: 'Long Position' },
                { id: 'prediction_short', icon: Icons.ShortPositionIcon, label: 'Short Position' },
                { id: 'price_range', icon: Icons.PriceRangeIcon, label: 'Price Range' },
                { id: 'date_price_range', icon: Icons.DatePriceRangeIcon, label: 'Date & Price Range' }
            ]
        },
        {
            id: 'measure_group',
            items: [
                { id: 'measure', icon: Icons.MeasureIcon, label: 'Measure' }
            ]
        },
        {
            id: 'zoom_group',
            items: [
                { id: 'zoom_in', icon: Icons.ZoomInIcon, label: 'Zoom In' }
            ],
            hasZoomOut: true // Special flag for conditional zoom out button
        },
        {
            id: 'timer_group',
            items: [
                { id: 'show_timer', icon: Icons.TimerIcon, label: 'Show Timer' }
            ]
        },
        {
            id: 'lock_group',
            items: [
                { id: 'lock_all', icon: Icons.LockDrawingsIcon, label: 'Lock All Drawing Tools' }
            ]
        },
        {
            id: 'sequential_group',
            items: [
                { id: 'sequential_mode', icon: Icons.SequentialDrawingIcon, label: 'Sequential Drawing Mode' }
            ]
        },
        {
            id: 'visibility_group',
            items: [
                { id: 'hide_drawings', icon: Icons.HideDrawingsIcon, label: 'Hide All Drawings' }
            ]
        },
        {
            id: 'delete_group',
            items: [
                { id: 'clear_all', icon: Icons.ClearAllIcon, label: 'Remove Objects' }
            ]
        }
    ];

    // State to track the active tool for each group (persisted selection)
    const [groupActiveTools, setGroupActiveTools] = useState<Record<string, ToolItem>>(() => {
        const initial: Record<string, ToolItem> = {};
        toolGroups.forEach(group => {
            initial[group.id] = group.items[0];
        });
        return initial;
    });

    // Track if zoom mode has been expanded (to keep zoom-out visible)
    const [isZoomExpanded, setIsZoomExpanded] = useState(false);

    // State for popover position
    const [popoverPos, setPopoverPos] = useState<PopoverPosition>({ top: 0, left: 0 });
    const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
    const toolbarRef = useRef<HTMLDivElement>(null);

    // Favorite tools state (persisted to localStorage)
    const [favoriteTools, setFavoriteTools] = useState<string[]>(() => {
        const saved = localStorage.getItem('tv_favorite_drawing_tools');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch {
                return [];
            }
        }
        return [];
    });

    // Persist favorites to localStorage
    useEffect(() => {
        localStorage.setItem('tv_favorite_drawing_tools', JSON.stringify(favoriteTools));
    }, [favoriteTools]);

    // Toggle favorite for a tool
    const handleToggleFavorite = (toolId: string, e: MouseEvent<HTMLDivElement>): void => {
        e.stopPropagation(); // Prevent selecting the tool
        setFavoriteTools(prev =>
            prev.includes(toolId)
                ? prev.filter(id => id !== toolId)
                : [...prev, toolId]
        );
    };

    // Handle clicking a tool in the main bar
    const handleGroupClick = (group: ToolGroup, e: MouseEvent<HTMLDivElement>): void => {
        // If clicking the arrow, toggle popover
        if ((e.target as HTMLElement).closest(`.${styles.arrow}`)) {
            e.stopPropagation();
            if (openPopoverId === group.id) {
                setOpenPopoverId(null);
            } else {
                // Calculate position
                const rect = e.currentTarget.getBoundingClientRect();
                setPopoverPos({
                    top: rect.top,
                    left: rect.right + 6 // 6px gap
                });
                setOpenPopoverId(group.id);
            }
            return;
        }

        // Otherwise select the current active tool for that group
        const currentTool = groupActiveTools[group.id];
        onToolChange(currentTool.id);
        setOpenPopoverId(null);
    };

    // Handle selecting a tool from the popover
    const handlePopoverSelect = (groupId: string, item: ToolItem): void => {
        setGroupActiveTools(prev => ({
            ...prev,
            [groupId]: item
        }));
        onToolChange(item.id);
        setOpenPopoverId(null);
    };

    // Close popover when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: globalThis.MouseEvent): void => {
            if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node) && !(event.target as HTMLElement).closest(`.${styles.popover}`)) {
                setOpenPopoverId(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Update popover position on scroll
    useEffect(() => {
        const handleScroll = (): void => {
            if (openPopoverId) setOpenPopoverId(null);
        };
        window.addEventListener('scroll', handleScroll, true);
        return () => window.removeEventListener('scroll', handleScroll, true);
    }, [openPopoverId]);

    // Manage zoom expanded state based on active tool
    useEffect(() => {
        if (activeTool === 'zoom_in' || activeTool === 'zoom_out') {
            // Expand when zoom tools are selected
            setIsZoomExpanded(true);
        } else if (activeTool !== null && activeTool !== 'cursor') {
            // Collapse when a different tool (not cursor/null) is selected
            setIsZoomExpanded(false);
        }
        // When activeTool is null or 'cursor' (e.g., after ESC), keep current state
    }, [activeTool]);

    return (
        <div className={styles.toolbar} ref={toolbarRef}>
            {toolGroups.map((group, index) => {
                const activeItem = groupActiveTools[group.id];
                // Check if this is a toggle tool (lock_all, hide_drawings, or show_timer) that should show active state
                const isToggleActive =
                    (activeItem.id === 'lock_all' && isDrawingsLocked) ||
                    (activeItem.id === 'hide_drawings' && isDrawingsHidden) ||
                    (activeItem.id === 'show_timer' && isTimerVisible) ||
                    (activeItem.id === 'sequential_mode' && isSequentialMode);
                const isActive = isToggleActive || activeTool === activeItem.id || group.items.some(i => i.id === activeTool);
                const showArrow = group.items.length > 1;

                return (
                    <React.Fragment key={group.id}>
                        <div className={styles.toolGroupContainer}>
                            <div className={styles.controlWrapper}>
                                <div
                                    className={`${styles.toolButton} ${isActive ? styles.active : ''} ${showArrow ? styles.hasArrow : ''}`}
                                    onClick={(e) => handleGroupClick(group, e)}
                                    title={activeItem.label}
                                >
                                    <div className={styles.toolIcon}>
                                        <activeItem.icon />
                                    </div>
                                </div>
                                {showArrow && (
                                    <div
                                        className={styles.arrowButton}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (openPopoverId === group.id) {
                                                setOpenPopoverId(null);
                                            } else {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                setPopoverPos({
                                                    top: rect.top,
                                                    left: rect.right
                                                });
                                                setOpenPopoverId(group.id);
                                            }
                                        }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 16" width="10" height="16">
                                            <path d="M.6 1.4l1.4-1.4 8 8-8 8-1.4-1.4 6.389-6.532-6.389-6.668z" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* Conditional Zoom Out button - appears below zoom when zoom is active or was recently active */}
                        {group.hasZoomOut && isZoomExpanded && (
                            <div className={styles.toolGroupContainer}>
                                <div className={styles.controlWrapper}>
                                    <div
                                        className={`${styles.toolButton} ${activeTool === 'zoom_out' ? styles.active : ''}`}
                                        onClick={() => onToolChange('zoom_out')}
                                        title="Zoom Out"
                                    >
                                        <div className={styles.toolIcon}>
                                            <Icons.ZoomOutIcon />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* Separators between specific groups */}
                        {(index === 0 || index === 1 || index === 2 || index === 3 || index === 4 || index === 5 || index === 7 || index === 10) && (
                            <div className={styles.separator} />
                        )}
                    </React.Fragment>
                );
            })}

            {/* Render Popover outside the map, using fixed position */}
            {openPopoverId && (
                <div
                    className={styles.popover}
                    style={{
                        position: 'fixed',
                        top: popoverPos.top,
                        left: popoverPos.left,
                    }}
                >
                    {toolGroups.find(g => g.id === openPopoverId)?.items.map(item => (
                        <div
                            key={item.id}
                            className={`${styles.popoverItem} ${activeTool === item.id ? styles.active : ''}`}
                            onClick={() => handlePopoverSelect(openPopoverId, item)}
                        >
                            <div className={styles.popoverIcon}>
                                <item.icon size={20} />
                            </div>
                            <span className={styles.popoverLabel}>{item.label}</span>
                            <div
                                className={styles.favoriteButton}
                                onClick={(e) => handleToggleFavorite(item.id, e)}
                                title={favoriteTools.includes(item.id) ? 'Remove from favorites' : 'Add to favorites'}
                            >
                                <Icons.StarIcon size={16} filled={favoriteTools.includes(item.id)} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Floating Favorites Toolbar */}
            <FloatingFavoritesToolbar
                favoriteTools={favoriteTools}
                activeTool={activeTool}
                onToolChange={onToolChange}
                toolGroups={toolGroups as any}
            />
        </div>
    );
};

export default DrawingToolbar;
