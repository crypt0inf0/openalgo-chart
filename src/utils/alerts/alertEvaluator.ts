/**
 * Alert Evaluator
 * Evaluates indicator alert conditions and determines if alerts should trigger
 */

import { ALERT_CONDITION_TYPES, AlertConditionType } from './alertConditions';
import logger from '../logger';

/**
 * Indicator data for a single bar
 */
export interface IndicatorData {
    [key: string]: number | boolean | undefined;
}

/**
 * Bar data containing indicator values
 */
export interface BarData {
    [indicatorId: string]: IndicatorData;
}

/**
 * Alert condition for evaluation
 */
export interface EvaluationCondition {
    type: AlertConditionType;
    indicator: string;
    series?: string;
    value?: number | boolean;
    series1?: string;
    series2?: string;
    zone?: [number, number];
    comparison?: string;
    requiresPrice?: boolean;
}

/**
 * Zone boundary tuple type
 */
export type ZoneBoundary = [number, number];

export class AlertEvaluator {
    /**
     * Track previous values for stateful evaluation
     * Map<alertId, previousValue>
     */
    private previousValues: Map<string, number>;

    constructor() {
        this.previousValues = new Map();
    }

    /**
     * Evaluate an indicator alert condition
     * @param condition - Alert condition configuration
     * @param currentData - Current bar data with indicator values
     * @param previousData - Previous bar data (for crossing detection)
     * @param currentPrice - Current price (for price-based comparisons)
     * @param previousPrice - Previous price
     * @returns Whether alert should trigger
     */
    evaluate(
        condition: EvaluationCondition,
        currentData: BarData,
        previousData: BarData,
        currentPrice: number | null = null,
        previousPrice: number | null = null
    ): boolean {
        const { type, indicator, series, value, series1, series2, zone, comparison, requiresPrice } = condition;

        try {
            // Get current and previous indicator values
            const currentIndicator = currentData[indicator];
            const previousIndicator = previousData[indicator];

            // Validate data availability
            if (!currentIndicator) {
                logger.debug(`[AlertEvaluator] Missing current data for indicator: ${indicator}`);
                return false;
            }

            // Pre-calculate common typed values to avoid TypeScript errors with boolean values
            const curVal = series ? currentIndicator[series] as number : undefined;
            const prevVal = series && previousIndicator ? previousIndicator[series] as number : undefined;
            const curLine1 = series1 ? currentIndicator[series1] as number : undefined;
            const prevLine1 = series1 && previousIndicator ? previousIndicator[series1] as number : undefined;
            const curLine2 = series2 ? currentIndicator[series2] as number : undefined;
            const prevLine2 = series2 && previousIndicator ? previousIndicator[series2] as number : undefined;
            const numValue = value as number;
            const numThreshold = comparison ? currentIndicator[comparison] as number : undefined;

            switch (type) {
                case ALERT_CONDITION_TYPES.CROSSES_ABOVE:
                    if (requiresPrice && comparison) {
                        return this.checkCrossAbove(currentPrice, previousPrice, numThreshold);
                    } else if (comparison) {
                        return this.checkCrossAbove(curVal, prevVal, numThreshold);
                    } else {
                        return this.checkCrossAbove(curVal, prevVal, numValue);
                    }

                case ALERT_CONDITION_TYPES.CROSSES_BELOW:
                    if (requiresPrice && comparison) {
                        return this.checkCrossBelow(currentPrice, previousPrice, numThreshold);
                    } else if (comparison) {
                        return this.checkCrossBelow(curVal, prevVal, numThreshold);
                    } else {
                        return this.checkCrossBelow(curVal, prevVal, numValue);
                    }

                case ALERT_CONDITION_TYPES.GREATER_THAN:
                    return this.checkGreaterThan(curVal, numValue);

                case ALERT_CONDITION_TYPES.LESS_THAN:
                    return this.checkLessThan(curVal, numValue);

                case ALERT_CONDITION_TYPES.EQUALS:
                    return this.checkEquals(
                        series ? currentIndicator[series] : undefined,
                        series && previousIndicator ? previousIndicator[series] : undefined,
                        value
                    );

                case ALERT_CONDITION_TYPES.LINE_CROSSES_ABOVE:
                    return this.checkLineCrossAbove(curLine1, prevLine1, curLine2, prevLine2);

                case ALERT_CONDITION_TYPES.LINE_CROSSES_BELOW:
                    return this.checkLineCrossBelow(curLine1, prevLine1, curLine2, prevLine2);

                case ALERT_CONDITION_TYPES.ENTERS_ZONE:
                    return this.checkEntersZone(curVal, prevVal, zone);

                case ALERT_CONDITION_TYPES.EXITS_ZONE:
                    return this.checkExitsZone(curVal, prevVal, zone);

                case ALERT_CONDITION_TYPES.WITHIN_ZONE:
                    return this.checkWithinZone(curVal, zone);

                case ALERT_CONDITION_TYPES.OUTSIDE_ZONE:
                    return this.checkOutsideZone(curVal, zone);

                case ALERT_CONDITION_TYPES.INCREASES_BY:
                    return this.checkIncreasesBy(curVal, prevVal, numValue);

                case ALERT_CONDITION_TYPES.DECREASES_BY:
                    return this.checkDecreasesBy(curVal, prevVal, numValue);

                case ALERT_CONDITION_TYPES.CHANGES_BY:
                    return this.checkChangesBy(curVal, prevVal, numValue);

                default:
                    logger.warn(`[AlertEvaluator] Unknown condition type: ${type}`);
                    return false;
            }
        } catch (error) {
            logger.error('[AlertEvaluator] Error evaluating condition:', error);
            return false;
        }
    }

    /**
     * Check if a value crosses above a threshold
     * @param currentValue - Current value
     * @param previousValue - Previous value
     * @param threshold - Threshold to cross
     * @returns Whether the value crossed above the threshold
     */
    checkCrossAbove(
        currentValue: number | null | undefined,
        previousValue: number | null | undefined,
        threshold: number | undefined
    ): boolean {
        if (currentValue === undefined || currentValue === null ||
            previousValue === undefined || previousValue === null ||
            threshold === undefined) {
            return false;
        }
        return previousValue <= threshold && currentValue > threshold;
    }

    /**
     * Check if a value crosses below a threshold
     * @param currentValue - Current value
     * @param previousValue - Previous value
     * @param threshold - Threshold to cross
     * @returns Whether the value crossed below the threshold
     */
    checkCrossBelow(
        currentValue: number | null | undefined,
        previousValue: number | null | undefined,
        threshold: number | undefined
    ): boolean {
        if (currentValue === undefined || currentValue === null ||
            previousValue === undefined || previousValue === null ||
            threshold === undefined) {
            return false;
        }
        return previousValue >= threshold && currentValue < threshold;
    }

    /**
     * Check if one line crosses above another
     * @param currentLine1 - Current value of line 1
     * @param previousLine1 - Previous value of line 1
     * @param currentLine2 - Current value of line 2
     * @param previousLine2 - Previous value of line 2
     * @returns Whether line 1 crossed above line 2
     */
    checkLineCrossAbove(
        currentLine1: number | undefined,
        previousLine1: number | undefined,
        currentLine2: number | undefined,
        previousLine2: number | undefined
    ): boolean {
        if (
            currentLine1 === undefined || previousLine1 === undefined ||
            currentLine2 === undefined || previousLine2 === undefined
        ) {
            return false;
        }
        return previousLine1 <= previousLine2 && currentLine1 > currentLine2;
    }

    /**
     * Check if one line crosses below another
     * @param currentLine1 - Current value of line 1
     * @param previousLine1 - Previous value of line 1
     * @param currentLine2 - Current value of line 2
     * @param previousLine2 - Previous value of line 2
     * @returns Whether line 1 crossed below line 2
     */
    checkLineCrossBelow(
        currentLine1: number | undefined,
        previousLine1: number | undefined,
        currentLine2: number | undefined,
        previousLine2: number | undefined
    ): boolean {
        if (
            currentLine1 === undefined || previousLine1 === undefined ||
            currentLine2 === undefined || previousLine2 === undefined
        ) {
            return false;
        }
        return previousLine1 >= previousLine2 && currentLine1 < currentLine2;
    }

    /**
     * Check if value enters a zone
     * @param currentValue - Current value
     * @param previousValue - Previous value
     * @param zone - [min, max] zone boundaries
     * @returns Whether the value entered the zone
     */
    checkEntersZone(
        currentValue: number | undefined,
        previousValue: number | undefined,
        zone: ZoneBoundary | undefined
    ): boolean {
        if (currentValue === undefined || previousValue === undefined || !Array.isArray(zone)) {
            return false;
        }
        const [min, max] = zone;
        const wasInZone = previousValue >= min && previousValue <= max;
        const isInZone = currentValue >= min && currentValue <= max;
        return !wasInZone && isInZone;
    }

    /**
     * Check if value exits a zone
     * @param currentValue - Current value
     * @param previousValue - Previous value
     * @param zone - [min, max] zone boundaries
     * @returns Whether the value exited the zone
     */
    checkExitsZone(
        currentValue: number | undefined,
        previousValue: number | undefined,
        zone: ZoneBoundary | undefined
    ): boolean {
        if (currentValue === undefined || previousValue === undefined || !Array.isArray(zone)) {
            return false;
        }
        const [min, max] = zone;
        const wasInZone = previousValue >= min && previousValue <= max;
        const isInZone = currentValue >= min && currentValue <= max;
        return wasInZone && !isInZone;
    }

    /**
     * Check if value is within a zone
     * @param currentValue - Current value
     * @param zone - [min, max] zone boundaries
     * @returns Whether the value is within the zone
     */
    checkWithinZone(currentValue: number | undefined, zone: ZoneBoundary | undefined): boolean {
        if (currentValue === undefined || !Array.isArray(zone)) {
            return false;
        }
        const [min, max] = zone;
        return currentValue >= min && currentValue <= max;
    }

    /**
     * Check if value is outside a zone
     * @param currentValue - Current value
     * @param zone - [min, max] zone boundaries
     * @returns Whether the value is outside the zone
     */
    checkOutsideZone(currentValue: number | undefined, zone: ZoneBoundary | undefined): boolean {
        if (currentValue === undefined || !Array.isArray(zone)) {
            return false;
        }
        const [min, max] = zone;
        return currentValue < min || currentValue > max;
    }

    /**
     * Check if value is greater than threshold
     * @param currentValue - Current value
     * @param threshold - Threshold value
     * @returns Whether the value is greater than the threshold
     */
    checkGreaterThan(currentValue: number | undefined, threshold: number | undefined): boolean {
        if (currentValue === undefined || threshold === undefined) {
            return false;
        }
        return currentValue > threshold;
    }

    /**
     * Check if value is less than threshold
     * @param currentValue - Current value
     * @param threshold - Threshold value
     * @returns Whether the value is less than the threshold
     */
    checkLessThan(currentValue: number | undefined, threshold: number | undefined): boolean {
        if (currentValue === undefined || threshold === undefined) {
            return false;
        }
        return currentValue < threshold;
    }

    /**
     * Check if value equals a specific value (with state change detection)
     * @param currentValue - Current value
     * @param previousValue - Previous value
     * @param target - Target value
     * @returns Whether the value changed to the target
     */
    checkEquals(
        currentValue: number | boolean | undefined,
        previousValue: number | boolean | undefined,
        target: number | boolean | undefined
    ): boolean {
        if (currentValue === undefined || previousValue === undefined || target === undefined) {
            return false;
        }
        // Only trigger when value changes TO the target (not continuously while equal)
        return previousValue !== target && currentValue === target;
    }

    /**
     * Check if value increases by a specific amount
     * @param currentValue - Current value
     * @param previousValue - Previous value
     * @param amount - Amount of increase
     * @returns Whether the value increased by the specified amount
     */
    checkIncreasesBy(
        currentValue: number | undefined,
        previousValue: number | undefined,
        amount: number | undefined
    ): boolean {
        if (currentValue === undefined || previousValue === undefined || amount === undefined) {
            return false;
        }
        return (currentValue - previousValue) >= amount;
    }

    /**
     * Check if value decreases by a specific amount
     * @param currentValue - Current value
     * @param previousValue - Previous value
     * @param amount - Amount of decrease
     * @returns Whether the value decreased by the specified amount
     */
    checkDecreasesBy(
        currentValue: number | undefined,
        previousValue: number | undefined,
        amount: number | undefined
    ): boolean {
        if (currentValue === undefined || previousValue === undefined || amount === undefined) {
            return false;
        }
        return (previousValue - currentValue) >= amount;
    }

    /**
     * Check if value changes by a specific amount (absolute)
     * @param currentValue - Current value
     * @param previousValue - Previous value
     * @param amount - Amount of change
     * @returns Whether the value changed by the specified amount
     */
    checkChangesBy(
        currentValue: number | undefined,
        previousValue: number | undefined,
        amount: number | undefined
    ): boolean {
        if (currentValue === undefined || previousValue === undefined || amount === undefined) {
            return false;
        }
        return Math.abs(currentValue - previousValue) >= amount;
    }

    /**
     * Clear cached previous values
     */
    clear(): void {
        this.previousValues.clear();
    }

    /**
     * Remove cached value for a specific alert
     * @param alertId - Alert identifier
     */
    removeAlert(alertId: string): void {
        this.previousValues.delete(alertId);
    }
}

/**
 * Singleton instance for global use
 */
export const alertEvaluator = new AlertEvaluator();

export default AlertEvaluator;
