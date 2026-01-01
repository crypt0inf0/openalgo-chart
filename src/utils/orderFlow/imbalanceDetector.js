/**
 * Imbalance Detector for Order Flow Analysis
 * Detects bid/ask imbalances and stacked imbalance zones
 */

/**
 * Detect diagonal imbalances in footprint
 * Uses the standard diagonal comparison method:
 * - Compare sell volume at price[i] with buy volume at price[i-1]
 * - Compare buy volume at price[i] with sell volume at price[i+1]
 *
 * @param {Map<number, Object>} footprint - Footprint data
 * @param {Object} options - Configuration options
 * @param {number} options.ratio - Minimum ratio for imbalance (default 3)
 * @param {number} options.minVolume - Minimum volume to consider (default 0)
 * @returns {Array<Object>} Array of imbalance objects
 */
export const detectDiagonalImbalances = (footprint, options = {}) => {
    const { ratio = 3, minVolume = 0 } = options;
    const imbalances = [];

    // Get sorted price levels (high to low)
    const levels = Array.from(footprint.keys()).sort((a, b) => b - a);

    for (let i = 0; i < levels.length - 1; i++) {
        const currentPrice = levels[i];
        const lowerPrice = levels[i + 1];

        const currentLevel = footprint.get(currentPrice);
        const lowerLevel = footprint.get(lowerPrice);

        // Sell imbalance: sell volume at current > buy volume at lower * ratio
        // This indicates aggressive selling that overwhelms buying below
        const sellVol = currentLevel.sellVolume;
        const buyVol = lowerLevel.buyVolume;

        if (sellVol >= minVolume && buyVol > 0 && sellVol >= buyVol * ratio) {
            imbalances.push({
                price: currentPrice,
                type: 'sell',
                ratio: sellVol / buyVol,
                sellVolume: sellVol,
                buyVolume: buyVol,
                strength: Math.min(sellVol / buyVol / ratio, 3), // Normalized strength 0-3
            });
        }

        // Buy imbalance: buy volume at lower > sell volume at current * ratio
        // This indicates aggressive buying that overwhelms selling above
        if (buyVol >= minVolume && sellVol > 0 && buyVol >= sellVol * ratio) {
            imbalances.push({
                price: lowerPrice,
                type: 'buy',
                ratio: buyVol / sellVol,
                sellVolume: sellVol,
                buyVolume: buyVol,
                strength: Math.min(buyVol / sellVol / ratio, 3),
            });
        }
    }

    return imbalances;
};

/**
 * Find stacked imbalances - consecutive imbalances of the same type
 * Stacked imbalances form strong support/resistance zones
 *
 * @param {Array} imbalances - Array from detectDiagonalImbalances
 * @param {Object} options - Configuration options
 * @param {number} options.minStack - Minimum consecutive imbalances (default 3)
 * @param {number} options.maxGap - Maximum price gap between imbalances (default 1 tick)
 * @returns {Array<Object>} Array of stacked imbalance zones
 */
export const findStackedImbalances = (imbalances, options = {}) => {
    const { minStack = 3 } = options;
    const stacks = [];

    if (imbalances.length < minStack) return stacks;

    // Separate buy and sell imbalances
    const buyImbalances = imbalances
        .filter(i => i.type === 'buy')
        .sort((a, b) => b.price - a.price);

    const sellImbalances = imbalances
        .filter(i => i.type === 'sell')
        .sort((a, b) => b.price - a.price);

    // Find consecutive buy imbalances
    let currentStack = null;
    buyImbalances.forEach((imbalance, idx) => {
        if (idx === 0) {
            currentStack = {
                type: 'buy',
                startPrice: imbalance.price,
                endPrice: imbalance.price,
                levels: 1,
                totalVolume: imbalance.buyVolume,
                avgStrength: imbalance.strength,
                imbalances: [imbalance],
            };
        } else {
            // Check if consecutive (within reasonable gap)
            const prevImbalance = buyImbalances[idx - 1];
            const priceGap = Math.abs(prevImbalance.price - imbalance.price);

            // If adjacent levels (considering tick size approximation)
            if (priceGap <= (prevImbalance.price * 0.01)) { // Within 1% - rough approximation
                currentStack.endPrice = imbalance.price;
                currentStack.levels++;
                currentStack.totalVolume += imbalance.buyVolume;
                currentStack.avgStrength = (currentStack.avgStrength + imbalance.strength) / 2;
                currentStack.imbalances.push(imbalance);
            } else {
                // Save current stack if valid
                if (currentStack.levels >= minStack) {
                    stacks.push({ ...currentStack });
                }
                // Start new stack
                currentStack = {
                    type: 'buy',
                    startPrice: imbalance.price,
                    endPrice: imbalance.price,
                    levels: 1,
                    totalVolume: imbalance.buyVolume,
                    avgStrength: imbalance.strength,
                    imbalances: [imbalance],
                };
            }
        }
    });
    if (currentStack && currentStack.levels >= minStack) {
        stacks.push(currentStack);
    }

    // Find consecutive sell imbalances
    currentStack = null;
    sellImbalances.forEach((imbalance, idx) => {
        if (idx === 0) {
            currentStack = {
                type: 'sell',
                startPrice: imbalance.price,
                endPrice: imbalance.price,
                levels: 1,
                totalVolume: imbalance.sellVolume,
                avgStrength: imbalance.strength,
                imbalances: [imbalance],
            };
        } else {
            const prevImbalance = sellImbalances[idx - 1];
            const priceGap = Math.abs(prevImbalance.price - imbalance.price);

            if (priceGap <= (prevImbalance.price * 0.01)) {
                currentStack.endPrice = imbalance.price;
                currentStack.levels++;
                currentStack.totalVolume += imbalance.sellVolume;
                currentStack.avgStrength = (currentStack.avgStrength + imbalance.strength) / 2;
                currentStack.imbalances.push(imbalance);
            } else {
                if (currentStack.levels >= minStack) {
                    stacks.push({ ...currentStack });
                }
                currentStack = {
                    type: 'sell',
                    startPrice: imbalance.price,
                    endPrice: imbalance.price,
                    levels: 1,
                    totalVolume: imbalance.sellVolume,
                    avgStrength: imbalance.strength,
                    imbalances: [imbalance],
                };
            }
        }
    });
    if (currentStack && currentStack.levels >= minStack) {
        stacks.push(currentStack);
    }

    return stacks;
};

/**
 * Generate support/resistance levels from stacked imbalances
 * @param {Array} stackedImbalances - From findStackedImbalances
 * @returns {Array<Object>} S/R levels with strength
 */
export const generateSRLevels = (stackedImbalances) => {
    return stackedImbalances.map(stack => {
        const midPrice = (stack.startPrice + stack.endPrice) / 2;

        return {
            type: stack.type === 'buy' ? 'support' : 'resistance',
            price: midPrice,
            startPrice: stack.startPrice,
            endPrice: stack.endPrice,
            strength: stack.avgStrength,
            levels: stack.levels,
            volume: stack.totalVolume,
        };
    });
};

/**
 * Mark imbalances on footprint data (mutates footprint)
 * @param {Map<number, Object>} footprint
 * @param {Array} imbalances
 */
export const markImbalancesOnFootprint = (footprint, imbalances) => {
    imbalances.forEach(imbalance => {
        const level = footprint.get(imbalance.price);
        if (level) {
            level.imbalance = imbalance.type;
            level.imbalanceRatio = imbalance.ratio;
            level.imbalanceStrength = imbalance.strength;
        }
    });
};

/**
 * Get imbalance summary for a footprint
 * @param {Map<number, Object>} footprint
 * @param {number} ratio
 * @returns {Object}
 */
export const getImbalanceSummary = (footprint, ratio = 3) => {
    const imbalances = detectDiagonalImbalances(footprint, { ratio });
    const stacks = findStackedImbalances(imbalances);

    const buyImbalances = imbalances.filter(i => i.type === 'buy');
    const sellImbalances = imbalances.filter(i => i.type === 'sell');

    return {
        totalImbalances: imbalances.length,
        buyImbalances: buyImbalances.length,
        sellImbalances: sellImbalances.length,
        stackedZones: stacks.length,
        supportZones: stacks.filter(s => s.type === 'buy').length,
        resistanceZones: stacks.filter(s => s.type === 'sell').length,
        imbalances,
        stacks,
        srLevels: generateSRLevels(stacks),
    };
};

export default {
    detectDiagonalImbalances,
    findStackedImbalances,
    generateSRLevels,
    markImbalancesOnFootprint,
    getImbalanceSummary,
};
