/**
 * Fuzzy search utilities for typo-tolerant symbol matching
 * No external dependencies - uses simple string algorithms
 */

/**
 * Calculate Levenshtein distance between two strings
 */
export const levenshteinDistance = (a, b) => {
    if (!a || !b) return Math.max(a?.length || 0, b?.length || 0);

    const aLen = a.length;
    const bLen = b.length;

    // Quick exits
    if (aLen === 0) return bLen;
    if (bLen === 0) return aLen;
    if (a === b) return 0;

    // Create distance matrix
    const matrix = Array(aLen + 1).fill(null).map(() => Array(bLen + 1).fill(0));

    // Initialize first column
    for (let i = 0; i <= aLen; i++) {
        matrix[i][0] = i;
    }

    // Initialize first row
    for (let j = 0; j <= bLen; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= aLen; i++) {
        for (let j = 1; j <= bLen; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // deletion
                matrix[i][j - 1] + 1,      // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }

    return matrix[aLen][bLen];
};

/**
 * Calculate similarity ratio between two strings (0-1)
 */
export const similarity = (a, b) => {
    if (!a || !b) return 0;
    if (a === b) return 1;

    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;

    const distance = levenshteinDistance(a, b);
    return 1 - (distance / maxLen);
};

/**
 * Match a query against a target string with scoring
 */
export const fuzzyMatch = (query, target) => {
    if (!query || !target) {
        return { match: false, score: 0 };
    }

    const q = query.toUpperCase().trim();
    const t = target.toUpperCase().trim();

    // Empty query matches nothing
    if (q.length === 0) {
        return { match: false, score: 0 };
    }

    // Exact match - highest score
    if (q === t) {
        return { match: true, score: 1.0 };
    }

    // Target starts with query - very high score
    if (t.startsWith(q)) {
        return { match: true, score: 0.9 };
    }

    // Query starts with target (partial input)
    if (q.startsWith(t)) {
        return { match: true, score: 0.85 };
    }

    // Target contains query as substring
    if (t.includes(q)) {
        return { match: true, score: 0.7 };
    }

    // Query contains target
    if (q.includes(t)) {
        return { match: true, score: 0.65 };
    }

    // Levenshtein distance for typo tolerance
    const distance = levenshteinDistance(q, t);
    const maxLen = Math.max(q.length, t.length);

    // Allow up to 2 character edits for short queries, 3 for longer
    const maxDistance = q.length <= 4 ? 2 : 3;

    if (distance <= maxDistance) {
        // Score based on similarity
        const similarityScore = 1 - (distance / maxLen);
        return { match: true, score: 0.3 + (similarityScore * 0.2) };
    }

    // Check if first characters match (common typo pattern)
    if (q.length >= 3 && t.length >= 3 && q.substring(0, 2) === t.substring(0, 2)) {
        const partialSimilarity = similarity(q, t);
        if (partialSimilarity > 0.6) {
            return { match: true, score: partialSimilarity * 0.5 };
        }
    }

    // No match
    return { match: false, score: 0 };
};

/**
 * Search through items with fuzzy matching
 */
export const fuzzySearch = (query, items, keys = ['symbol', 'name'], minScore = 0.2) => {
    if (!query || !items || items.length === 0) {
        return items || [];
    }

    const results = [];

    for (const item of items) {
        let bestScore = 0;
        let matchedKey = null;

        for (const key of keys) {
            const value = item[key];
            if (!value || typeof value !== 'string') continue;

            const { match, score } = fuzzyMatch(query, value);
            if (match && score > bestScore) {
                bestScore = score;
                matchedKey = key;
            }
        }

        if (bestScore >= minScore) {
            results.push({
                item,
                score: bestScore,
                matchedKey,
            });
        }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.map(r => r.item);
};

/**
 * Highlight matching portions of text
 */
export const getHighlightSegments = (text, query) => {
    if (!text || !query) {
        return [{ text: text || '', highlight: false }];
    }

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    const index = lowerText.indexOf(lowerQuery);

    if (index === -1) {
        return [{ text, highlight: false }];
    }

    const segments = [];

    if (index > 0) {
        segments.push({ text: text.substring(0, index), highlight: false });
    }

    segments.push({ text: text.substring(index, index + query.length), highlight: true });

    if (index + query.length < text.length) {
        segments.push({ text: text.substring(index + query.length), highlight: false });
    }

    return segments;
};

export default {
    levenshteinDistance,
    similarity,
    fuzzyMatch,
    fuzzySearch,
    getHighlightSegments,
};
