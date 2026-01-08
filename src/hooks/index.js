// Responsive design hooks
export {
  useMediaQuery,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  useIsTouchDevice,
  usePrefersReducedMotion,
  usePrefersHighContrast,
  BREAKPOINTS,
} from './useMediaQuery';

// Accessibility hooks
export { useFocusTrap } from './useFocusTrap';
export { useKeyboardNav, useListNavigation } from './useKeyboardNav';

// Drawing tool hooks
export {
    useDrawingProperties,
    DEFAULT_DRAWING_OPTIONS,
    LINE_STYLES,
    PRESET_COLORS,
} from './useDrawingProperties';

// Symbol history hooks
export { useSymbolHistory } from './useSymbolHistory';

// Command palette hooks
export {
    useCommandPalette,
    COMMAND_CATEGORIES,
    CATEGORY_CONFIG,
} from './useCommandPalette';

// Global keyboard shortcuts
export { useGlobalShortcuts } from './useGlobalShortcuts';
