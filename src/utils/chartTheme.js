import { THEMES, DEFAULT_THEME } from '../styles/themes';

/**
 * Get chart colors based on the current theme ID.
 * @param {string} themeId - The ID of the theme (e.g., 'dark', 'light', 'midnight').
 * @returns {Object} The color configuration for the chart.
 */
export const getChartTheme = (themeId) => {
    const theme = THEMES[themeId] || THEMES[DEFAULT_THEME];
    return theme.colors;
};

/**
 * Get the generic theme type ('dark' or 'light')
 * @param {string} themeId
 * @returns {string} 'dark' or 'light'
 */
export const getThemeType = (themeId) => {
    const theme = THEMES[themeId] || THEMES[DEFAULT_THEME];
    return theme.type;
};
