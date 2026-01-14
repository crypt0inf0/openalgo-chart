/**
 * TPO Renderer Utilities
 * Functions for converting TPO profiles to renderable formats
 */

/**
 * Convert TPO profile to renderable format for lightweight-charts
 * Returns array of price levels with their TPO data
 * @param {Object} profile - TPO profile object
 * @param {Object} options - Render options
 * @returns {Array}
 */
export const tpoToRenderData = (profile, options = {}) => {
    const {
        showLetters = true,
        maxLettersPerRow = 20,
    } = options;

    if (!profile || !profile.priceLevels) {
        return [];
    }

    const renderData = [];

    for (const [price, levelData] of profile.priceLevels) {
        const letters = [...levelData.letters];

        renderData.push({
            price,
            tpoCount: levelData.tpoCount,
            letters: showLetters ? letters.slice(0, maxLettersPerRow) : [],
            isInitialBalance: levelData.isInitialBalance,
            isPOC: price === profile.poc,
            isValueArea: price >= profile.val && price <= profile.vah,
            isVAH: price === profile.vah,
            isVAL: price === profile.val,
        });
    }

    // Sort by price (high to low for display)
    renderData.sort((a, b) => b.price - a.price);

    return renderData;
};

/**
 * Count TPOs above or below POC
 * @param {Map} priceLevels
 * @param {number} poc
 * @returns {Object} { above, below }
 */
export const countTPOsRelativeToPOC = (priceLevels, poc) => {
    let above = 0;
    let below = 0;

    for (const [price, data] of priceLevels) {
        if (price > poc) {
            above += data.tpoCount;
        } else if (price < poc) {
            below += data.tpoCount;
        }
    }

    return { above, below };
};

/**
 * Get summary statistics for a TPO profile
 * Extended with all TradingView-compatible stats
 * @param {Object} profile
 * @returns {Object|null}
 */
export const getTPOStats = (profile) => {
    if (!profile) return null;

    const { above: tpoAbovePOC, below: tpoBelowPOC } = countTPOsRelativeToPOC(
        profile.priceLevels,
        profile.poc
    );

    return {
        // Core stats
        poc: profile.poc,
        vah: profile.vah,
        val: profile.val,
        ibHigh: profile.ibHigh,
        ibLow: profile.ibLow,
        rangeHigh: profile.rangeHigh,
        rangeLow: profile.rangeLow,

        // Calculated ranges
        hlRange: profile.rangeHigh - profile.rangeLow,
        vaRange: profile.vah - profile.val,
        ibRange: profile.ibHigh - profile.ibLow,

        // TPO counts
        totalTPOs: profile.totalTPOs,
        tpoAbovePOC,
        tpoBelowPOC,
        periodCount: profile.periods.length,

        // New stats
        rotationFactor: profile.rotationFactor,
        midpoint: profile.midpoint,
        openPrice: profile.openPrice,
        closePrice: profile.closePrice,
        poorHigh: profile.poorHigh,
        poorLow: profile.poorLow,
        singlePrintCount: profile.singlePrints?.length || 0,

        // Session info
        sessionKey: profile.sessionKey,
        blockSize: profile.blockSize,
        tickSize: profile.tickSize,
    };
};

export default {
    tpoToRenderData,
    countTPOsRelativeToPOC,
    getTPOStats,
};
