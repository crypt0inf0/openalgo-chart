/**
 * Advanced Theme Definitions
 * Defines metadata and colors for the application themes.
 */

export const THEMES = {
    dark: {
        id: 'dark',
        name: 'Dark (Default)',
        type: 'dark',
        colors: {
            background: '#131722',
            text: '#D1D4DC',
            grid: '#2A2E39',
            crosshair: '#758696',
            textColor: '#D1D4DC',
            borderColor: '#2A2E39',
        }
    },
    light: {
        id: 'light',
        name: 'Light',
        type: 'light',
        colors: {
            background: '#ffffff',
            text: '#131722',
            grid: '#e0e3eb',
            crosshair: '#9598a1',
            textColor: '#131722',
            borderColor: '#e0e3eb',
        }
    },
    midnight: {
        id: 'midnight',
        name: 'Midnight',
        type: 'dark',
        colors: {
            background: '#0B0E11',
            text: '#E0E0E0',
            grid: '#1F2428',
            crosshair: '#4A5568',
            textColor: '#E0E0E0',
            borderColor: '#1F2428',
        }
    },
    ocean: {
        id: 'ocean',
        name: 'Ocean',
        type: 'dark',
        colors: {
            background: '#0F172A',
            text: '#E2E8F0',
            grid: '#1E293B',
            crosshair: '#64748B',
            textColor: '#E2E8F0',
            borderColor: '#1E293B',
        }
    }
};

export const DEFAULT_THEME = 'dark';
