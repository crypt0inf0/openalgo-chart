/**
 * MeasureOverlay Component
 * Displays the shift+click quick measure tool overlay
 */

import React from 'react';
import styles from './ChartComponent.module.css';

/**
 * Measure overlay for displaying price/time measurements
 * @param {Object} props
 * @param {Object} props.measureData - Measurement data object
 * @param {boolean} props.measureData.isFirstPoint - Whether this is the first point
 * @param {number} props.measureData.x - X coordinate (for first point)
 * @param {number} props.measureData.y - Y coordinate (for first point)
 * @param {Object} props.measureData.position - Position for overlay (x, y)
 * @param {Object} props.measureData.line - Line coordinates (x1, y1, x2, y2)
 * @param {number} props.measureData.priceChange - Price change value
 * @param {number} props.measureData.percentChange - Percentage change value
 * @param {number} props.measureData.barCount - Number of bars
 * @param {string} props.measureData.timeElapsed - Time elapsed string
 */
const MeasureOverlay = ({ measureData }) => {
    if (!measureData) return null;

    // First point indicator (small dot)
    if (measureData.isFirstPoint) {
        return (
            <div
                className={styles.measureStartPoint}
                style={{
                    left: measureData.x - 4,
                    top: measureData.y - 4,
                }}
            />
        );
    }

    // Full measurement overlay with line and details
    return (
        <div
            className={styles.measureOverlay}
            style={{
                left: measureData.position.x,
                top: measureData.position.y,
            }}
        >
            {/* Dashed line between points */}
            <svg
                className={styles.measureLine}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 99,
                }}
            >
                <line
                    x1={measureData.line.x1}
                    y1={measureData.line.y1}
                    x2={measureData.line.x2}
                    y2={measureData.line.y2}
                    stroke={measureData.priceChange >= 0 ? '#26a69a' : '#ef5350'}
                    strokeWidth="1"
                    strokeDasharray="4,4"
                />
            </svg>
            <div className={styles.measureBox}>
                <div className={measureData.priceChange >= 0 ? styles.measureUp : styles.measureDown}>
                    {measureData.priceChange >= 0 ? '+' : ''}{measureData.priceChange.toFixed(2)}
                    {' '}({measureData.percentChange >= 0 ? '+' : ''}{measureData.percentChange.toFixed(2)}%)
                </div>
                <div className={styles.measureDetails}>
                    {measureData.barCount} bars · {measureData.timeElapsed}
                </div>
            </div>
        </div>
    );
};

export default MeasureOverlay;
