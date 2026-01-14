/**
 * usePositionRanking Hook
 * Handles position ranking and change calculation
 */

import { useMemo, useRef, useEffect } from 'react';
import { getSector } from '../sectorMapping';

/**
 * Calculate % change from opening price (intraday)
 * @param {Object} item - Stock item
 * @returns {number} Percentage change
 */
export const calculateIntradayChange = (item) => {
    const ltp = parseFloat(item.last) || 0;
    const openPrice = parseFloat(item.open) || 0;

    if (openPrice > 0 && ltp > 0) {
        return ((ltp - openPrice) / openPrice) * 100;
    }
    return parseFloat(item.chgP) || 0;
};

/**
 * Hook for position ranking logic
 * @param {Array} watchlistData - Live watchlist data
 * @param {string} sourceMode - 'watchlist' or 'custom'
 * @param {Array} customSymbols - Custom symbol list
 * @param {boolean} isMarketOpen - Whether market is open
 * @returns {Object} { rankedData, displayData }
 */
export const usePositionRanking = (watchlistData, sourceMode, customSymbols, isMarketOpen) => {
    const previousRanksRef = useRef(new Map());
    const openingRanksRef = useRef(new Map());
    const hasSetOpeningRanks = useRef(false);

    // Process and rank the data
    const rankedData = useMemo(() => {
        let dataToRank = [];

        if (sourceMode === 'watchlist') {
            dataToRank = (watchlistData || []).map(item => ({
                symbol: item.symbol,
                exchange: item.exchange || 'NSE',
                ltp: parseFloat(item.last) || 0,
                openPrice: parseFloat(item.open) || 0,
                volume: parseFloat(item.volume) || 0,
                percentChange: calculateIntradayChange(item),
                sector: getSector(item.symbol),
            }));
        } else {
            const customSet = new Set(
                (customSymbols || []).map(s => `${s.symbol}-${s.exchange || 'NSE'}`)
            );
            dataToRank = (watchlistData || [])
                .filter(item => customSet.has(`${item.symbol}-${item.exchange || 'NSE'}`))
                .map(item => ({
                    symbol: item.symbol,
                    exchange: item.exchange || 'NSE',
                    ltp: parseFloat(item.last) || 0,
                    openPrice: parseFloat(item.open) || 0,
                    volume: parseFloat(item.volume) || 0,
                    percentChange: calculateIntradayChange(item),
                    sector: getSector(item.symbol),
                }));
        }

        // Sort by percent change (descending - highest gainers first)
        const sorted = [...dataToRank].sort((a, b) => b.percentChange - a.percentChange);

        // Calculate ranks
        return sorted.map((item, index) => {
            const key = `${item.symbol}-${item.exchange}`;
            const previousRank = previousRanksRef.current.get(key) ?? (index + 1);
            const currentRank = index + 1;
            const rankChange = previousRank - currentRank;

            previousRanksRef.current.set(key, currentRank);

            return {
                ...item,
                currentRank,
                previousRank,
                rankChange,
            };
        });
    }, [watchlistData, sourceMode, customSymbols]);

    // Capture opening ranks once when market opens
    useEffect(() => {
        if (isMarketOpen && rankedData.length > 0 && !hasSetOpeningRanks.current) {
            rankedData.forEach(item => {
                const key = `${item.symbol}-${item.exchange}`;
                openingRanksRef.current.set(key, item.currentRank);
            });
            hasSetOpeningRanks.current = true;
        }

        if (!isMarketOpen) {
            hasSetOpeningRanks.current = false;
            openingRanksRef.current.clear();
        }
    }, [isMarketOpen, rankedData]);

    // Calculate rank change from opening and volume spike detection
    const displayData = useMemo(() => {
        const totalVolume = rankedData.reduce((sum, item) => sum + (item.volume || 0), 0);
        const avgVolume = rankedData.length > 0 ? totalVolume / rankedData.length : 0;
        const spikeThreshold = avgVolume * 2;

        return rankedData.map(item => {
            const key = `${item.symbol}-${item.exchange}`;
            const openingRank = openingRanksRef.current.get(key);

            return {
                ...item,
                rankChange: openingRank !== undefined
                    ? openingRank - item.currentRank
                    : 0,
                isVolumeSpike: item.volume > spikeThreshold,
            };
        });
    }, [rankedData]);

    return { rankedData, displayData };
};

export default usePositionRanking;
