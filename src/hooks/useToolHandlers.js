/**
 * Tool Handlers Hook
 * Manages drawing tools, image capture, fullscreen, and replay operations
 */

import { useCallback } from 'react';
import html2canvas from 'html2canvas';

/**
 * Custom hook for tool operations
 * @param {Object} params - Hook parameters
 * @param {Object} params.chartRefs - Ref object containing chart references
 * @param {string|number} params.activeChartId - Currently active chart ID
 * @param {Function} params.setActiveTool - State setter for active tool
 * @param {Function} params.setIsMagnetMode - State setter for magnet mode
 * @param {Function} params.setIsDrawingsHidden - State setter for drawings hidden state
 * @param {Function} params.setIsDrawingsLocked - State setter for drawings locked state
 * @param {Function} params.setIsTimerVisible - State setter for timer visibility
 * @param {Function} params.setShowDrawingToolbar - State setter for drawing toolbar visibility
 * @param {Function} params.setIsReplayMode - State setter for replay mode
 * @param {string} params.currentSymbol - Current chart symbol
 * @param {Function} params.showToast - Toast notification function
 * @param {Function} params.showSnapshotToast - Snapshot toast function
 * @returns {Object} Tool handler functions
 */
export const useToolHandlers = ({
    chartRefs,
    activeChartId,
    setActiveTool,
    setIsMagnetMode,
    setIsDrawingsHidden,
    setIsDrawingsLocked,
    setIsTimerVisible,
    setShowDrawingToolbar,
    setIsReplayMode,
    currentSymbol,
    showToast,
    showSnapshotToast
}) => {
    // Toggle drawing toolbar visibility
    const toggleDrawingToolbar = useCallback(() => {
        setShowDrawingToolbar(prev => !prev);
    }, [setShowDrawingToolbar]);

    // Handle tool change - dispatch to appropriate handler
    const handleToolChange = useCallback((tool) => {
        if (tool === 'magnet') {
            setIsMagnetMode(prev => !prev);
        } else if (tool === 'undo') {
            const activeRef = chartRefs.current[activeChartId];
            if (activeRef) {
                activeRef.undo();
            }
            setActiveTool(null);
        } else if (tool === 'redo') {
            const activeRef = chartRefs.current[activeChartId];
            if (activeRef) {
                activeRef.redo();
            }
            setActiveTool(null);
        } else if (tool === 'clear') {
            const activeRef = chartRefs.current[activeChartId];
            if (activeRef) {
                activeRef.clearTools();
            }
            setActiveTool(null);
        } else if (tool === 'clear_all') {
            const activeRef = chartRefs.current[activeChartId];
            if (activeRef) {
                activeRef.clearTools();
            }
            setIsDrawingsHidden(false);
            setIsDrawingsLocked(false);
            setActiveTool(null);
        } else if (tool === 'lock_all') {
            setIsDrawingsLocked(prev => !prev);
            setActiveTool(tool);
        } else if (tool === 'hide_drawings') {
            setIsDrawingsHidden(prev => !prev);
            setActiveTool(tool);
        } else if (tool === 'show_timer') {
            setIsTimerVisible(prev => !prev);
            setActiveTool(tool);
        } else {
            setActiveTool(tool);
        }
    }, [chartRefs, activeChartId, setActiveTool, setIsMagnetMode, setIsDrawingsHidden, setIsDrawingsLocked, setIsTimerVisible]);

    // Reset active tool after use
    const handleToolUsed = useCallback(() => {
        setActiveTool(null);
    }, [setActiveTool]);

    // Undo wrapper
    const handleUndo = useCallback(() => {
        handleToolChange('undo');
    }, [handleToolChange]);

    // Redo wrapper
    const handleRedo = useCallback(() => {
        handleToolChange('redo');
    }, [handleToolChange]);

    // Download chart as image
    const handleDownloadImage = useCallback(async () => {
        const activeRef = chartRefs.current[activeChartId];
        if (activeRef) {
            const chartContainer = activeRef.getChartContainer();
            if (chartContainer) {
                try {
                    const canvas = await html2canvas(chartContainer, {
                        useCORS: true,
                        allowTaint: true,
                        backgroundColor: '#131722',
                    });

                    const image = canvas.toDataURL('image/png');
                    const link = document.createElement('a');

                    const now = new Date();
                    const dateStr = now.toISOString().split('T')[0];
                    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
                    const filename = `${currentSymbol}_${dateStr}_${timeStr}.png`;

                    link.href = image;
                    link.download = filename;
                    link.click();
                } catch (error) {
                    console.error('Screenshot failed:', error);
                    showToast('Failed to download image', 'error');
                }
            }
        }
    }, [chartRefs, activeChartId, currentSymbol, showToast]);

    // Copy chart image to clipboard
    const handleCopyImage = useCallback(async () => {
        const activeRef = chartRefs.current[activeChartId];
        if (activeRef) {
            const chartContainer = activeRef.getChartContainer();
            if (chartContainer) {
                try {
                    const canvas = await html2canvas(chartContainer, {
                        useCORS: true,
                        allowTaint: true,
                        backgroundColor: '#131722',
                    });

                    canvas.toBlob(async (blob) => {
                        try {
                            await navigator.clipboard.write([
                                new ClipboardItem({
                                    'image/png': blob
                                })
                            ]);
                            showSnapshotToast('Link to the chart image copied to clipboard');
                        } catch (err) {
                            console.error('Failed to copy to clipboard:', err);
                            showToast('Failed to copy to clipboard', 'error');
                        }
                    });
                } catch (error) {
                    console.error('Screenshot failed:', error);
                    showToast('Failed to capture image', 'error');
                }
            }
        }
    }, [chartRefs, activeChartId, showToast, showSnapshotToast]);

    // Toggle fullscreen mode
    const handleFullScreen = useCallback(() => {
        const activeRef = chartRefs.current[activeChartId];
        if (activeRef) {
            const chartContainer = activeRef.getChartContainer();
            if (chartContainer) {
                if (chartContainer.requestFullscreen) {
                    chartContainer.requestFullscreen();
                } else if (chartContainer.webkitRequestFullscreen) {
                    chartContainer.webkitRequestFullscreen();
                } else if (chartContainer.msRequestFullscreen) {
                    chartContainer.msRequestFullscreen();
                }
            }
        }
    }, [chartRefs, activeChartId]);

    // Toggle replay mode
    const handleReplayClick = useCallback(() => {
        const activeRef = chartRefs.current[activeChartId];
        if (activeRef) {
            activeRef.toggleReplay();
        }
    }, [chartRefs, activeChartId]);

    // Handle replay mode change from chart
    const handleReplayModeChange = useCallback((chartId, isActive) => {
        if (chartId === activeChartId) {
            setIsReplayMode(isActive);
        }
    }, [activeChartId, setIsReplayMode]);

    return {
        toggleDrawingToolbar,
        handleToolChange,
        handleToolUsed,
        handleUndo,
        handleRedo,
        handleDownloadImage,
        handleCopyImage,
        handleFullScreen,
        handleReplayClick,
        handleReplayModeChange
    };
};

export default useToolHandlers;
