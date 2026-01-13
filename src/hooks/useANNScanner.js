/**
 * useANNScanner Hook
 * Manages ANN Scanner background scanning functionality
 */

import { useCallback, useRef } from 'react';
import { scanStocks } from '../services/annScannerService';

/**
 * Hook to manage ANN Scanner state and operations
 * @param {Object} annScannerState - Current scanner state
 * @param {Function} setAnnScannerState - State setter function
 * @returns {Object} Scanner handlers: startAnnScan, cancelAnnScan
 */
export const useANNScanner = (annScannerState, setAnnScannerState) => {
    // AbortController ref for background ANN scan
    const annScanAbortRef = useRef(null);

    // Background scan function - runs even when ANNScanner tab is not visible
    const startAnnScan = useCallback(async (stocksToScan, alertsEnabled = true, showToastFn = null) => {
        if (annScannerState.isScanning) return;

        // Cancel any existing scan
        if (annScanAbortRef.current) {
            annScanAbortRef.current.abort();
        }
        annScanAbortRef.current = new AbortController();

        // Save previous results, start scanning
        setAnnScannerState(prev => ({
            ...prev,
            isScanning: true,
            scanError: null,
            progress: { current: 0, total: stocksToScan.length },
            previousResults: prev.results,
            results: [],
        }));

        try {
            const scanResults = await scanStocks(
                stocksToScan,
                { threshold: 0.0014, daysToFetch: 60, delayMs: 100 },
                (current, total, result) => {
                    // Update progress and results incrementally
                    setAnnScannerState(prev => ({
                        ...prev,
                        progress: { current, total },
                        results: [...prev.results, result],
                    }));
                },
                annScanAbortRef.current.signal
            );

            // Scan completed - update state
            setAnnScannerState(prev => {
                // Detect signal changes for alerts
                const oldMap = new Map(prev.previousResults.map(r => [r.symbol, r]));
                const changes = [];
                scanResults.forEach(newItem => {
                    const oldItem = oldMap.get(newItem.symbol);
                    if (oldItem && oldItem.direction !== newItem.direction) {
                        if (oldItem.direction && newItem.direction) {
                            changes.push({
                                symbol: newItem.symbol,
                                from: oldItem.direction,
                                to: newItem.direction,
                            });
                        }
                    }
                });

                // Handle alerts if enabled
                if (changes.length > 0 && alertsEnabled) {
                    // Play alert sound
                    try {
                        const audio = new Audio('/sounds/alert.mp3');
                        audio.volume = 0.5;
                        audio.play().catch(() => {});
                    } catch (e) {
                        // Ignore audio errors
                    }

                    // Browser notification
                    if ('Notification' in window && Notification.permission === 'granted') {
                        changes.forEach(change => {
                            new Notification('ANN Signal Change', {
                                body: `${change.symbol}: ${change.from} → ${change.to}`,
                                icon: '/favicon.ico',
                            });
                        });
                    }

                    // Toast notification
                    if (showToastFn) {
                        const msg = changes.length === 1
                            ? `${changes[0].symbol} flipped to ${changes[0].to}`
                            : `${changes.length} stocks changed signals`;
                        showToastFn(msg, 'warning');
                    }
                }

                return {
                    ...prev,
                    isScanning: false,
                    lastScanTime: new Date(),
                };
            });

        } catch (err) {
            if (err.name !== 'AbortError') {
                setAnnScannerState(prev => ({
                    ...prev,
                    isScanning: false,
                    scanError: err.message || 'Scan failed',
                }));
            } else {
                // Scan was cancelled - just mark as not scanning
                setAnnScannerState(prev => ({
                    ...prev,
                    isScanning: false,
                }));
            }
        }
    }, [annScannerState.isScanning, setAnnScannerState]);

    // Cancel scan function
    const cancelAnnScan = useCallback(() => {
        if (annScanAbortRef.current) {
            annScanAbortRef.current.abort();
        }
        setAnnScannerState(prev => ({
            ...prev,
            isScanning: false,
        }));
    }, [setAnnScannerState]);

    return {
        startAnnScan,
        cancelAnnScan
    };
};

export default useANNScanner;
