/**
 * Heatmap Constants
 * Mode definitions and configuration
 */
import { Grid3X3, LayoutGrid, BarChart3 } from 'lucide-react';

// Heatmap display modes
export const HEATMAP_MODES = [
    { id: 'treemap', label: 'Treemap', icon: LayoutGrid },
    { id: 'grid', label: 'Grid', icon: Grid3X3 },
    { id: 'sector', label: 'Sectors', icon: BarChart3 },
];

// Treemap layout constants
export const TREEMAP_PADDING = 2;
export const TREEMAP_HEADER_HEIGHT = 22;

// Font size limits for treemap tiles
export const MIN_FONT_SIZE = 9;
export const MAX_FONT_SIZE = 16;

export default {
    HEATMAP_MODES,
    TREEMAP_PADDING,
    TREEMAP_HEADER_HEIGHT,
    MIN_FONT_SIZE,
    MAX_FONT_SIZE,
};
