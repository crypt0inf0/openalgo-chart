/**
 * Option Chain Analysis Utilities
 * Calculates Max Call OI, Max Put OI, and Max Pain from option chain data
 */

/**
 * Find the strike with maximum Call Open Interest
 * @param {Array} chain - Option chain data
 * @returns {Object|null} { strike, oi } or null if no data
 */
export function findMaxCallOI(chain) {
    if (!chain || chain.length === 0) return null;

    let maxOI = 0;
    let maxStrike = null;

    for (const row of chain) {
        if (row.ce && row.ce.oi > maxOI) {
            maxOI = row.ce.oi;
            maxStrike = row.strike;
        }
    }

    return maxStrike !== null ? { strike: maxStrike, oi: maxOI } : null;
}

/**
 * Find the strike with maximum Put Open Interest
 * @param {Array} chain - Option chain data
 * @returns {Object|null} { strike, oi } or null if no data
 */
export function findMaxPutOI(chain) {
    if (!chain || chain.length === 0) return null;

    let maxOI = 0;
    let maxStrike = null;

    for (const row of chain) {
        if (row.pe && row.pe.oi > maxOI) {
            maxOI = row.pe.oi;
            maxStrike = row.strike;
        }
    }

    return maxStrike !== null ? { strike: maxStrike, oi: maxOI } : null;
}

/**
 * Calculate Max Pain - the strike price where option buyers lose the most money
 *
 * Algorithm:
 * For each strike price, calculate total loss to option buyers if price expires there:
 * - Call loss: Sum of (strike - call_strike) * call_OI for all ITM calls (call_strike < strike)
 * - Put loss: Sum of (put_strike - strike) * put_OI for all ITM puts (put_strike > strike)
 * - Total loss = Call loss + Put loss
 *
 * Max Pain = Strike with MAXIMUM total loss (minimum payout for option writers)
 *
 * @param {Array} chain - Option chain data with strike, ce.oi, pe.oi
 * @returns {Object|null} { strike, totalLoss } or null if no data
 */
export function calculateMaxPain(chain) {
    if (!chain || chain.length === 0) return null;

    // Get all unique strikes sorted
    const strikes = chain.map(row => row.strike).sort((a, b) => a - b);

    if (strikes.length === 0) return null;

    let maxPainStrike = null;
    let maxTotalLoss = -Infinity;

    // For each potential expiry price
    for (const expiryPrice of strikes) {
        let totalLoss = 0;

        // Calculate loss from all call options
        for (const row of chain) {
            if (row.ce && row.ce.oi > 0) {
                // Call is ITM if strike < expiry price
                if (row.strike < expiryPrice) {
                    // Loss = (expiry price - strike) * OI
                    totalLoss += (expiryPrice - row.strike) * row.ce.oi;
                }
                // OTM calls expire worthless - no additional loss calculation needed
            }
        }

        // Calculate loss from all put options
        for (const row of chain) {
            if (row.pe && row.pe.oi > 0) {
                // Put is ITM if strike > expiry price
                if (row.strike > expiryPrice) {
                    // Loss = (strike - expiry price) * OI
                    totalLoss += (row.strike - expiryPrice) * row.pe.oi;
                }
                // OTM puts expire worthless - no additional loss calculation needed
            }
        }

        // Track the strike with maximum total loss (max pain for buyers)
        if (totalLoss > maxTotalLoss) {
            maxTotalLoss = totalLoss;
            maxPainStrike = expiryPrice;
        }
    }

    return maxPainStrike !== null ? { strike: maxPainStrike, totalLoss: maxTotalLoss } : null;
}

/**
 * Analyze option chain and return all key levels
 * @param {Array} chain - Option chain data
 * @returns {Object} { maxCallOI, maxPutOI, maxPain }
 */
export function analyzeOptionChain(chain) {
    return {
        maxCallOI: findMaxCallOI(chain),
        maxPutOI: findMaxPutOI(chain),
        maxPain: calculateMaxPain(chain)
    };
}

/**
 * Format OI number for display (e.g., 1234567 -> "12.3L")
 * @param {number} oi - Open Interest value
 * @returns {string} Formatted string
 */
export function formatOI(oi) {
    if (oi >= 10000000) {
        return (oi / 10000000).toFixed(2) + 'Cr';
    } else if (oi >= 100000) {
        return (oi / 100000).toFixed(2) + 'L';
    } else if (oi >= 1000) {
        return (oi / 1000).toFixed(1) + 'K';
    }
    return oi.toString();
}

export default {
    findMaxCallOI,
    findMaxPutOI,
    calculateMaxPain,
    analyzeOptionChain,
    formatOI
};
