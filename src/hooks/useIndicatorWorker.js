/**
 * useIndicatorWorker Hook
 * Provides interface to offload heavy indicator calculations to a Web Worker
 *
 * Usage:
 *   const { calculateTPO, calculateVolumeProfile, isReady } = useIndicatorWorker();
 *   const result = await calculateTPO(data, options);
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import logger from '../utils/logger';

/**
 * Create a unique ID for each calculation request
 */
const createRequestId = () => `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

/**
 * Hook for using the indicator worker
 */
export const useIndicatorWorker = () => {
    const workerRef = useRef(null);
    const pendingRequests = useRef(new Map());
    const [isReady, setIsReady] = useState(false);

    // Initialize worker
    useEffect(() => {
        try {
            // Create worker using Vite's module worker syntax
            workerRef.current = new Worker(
                new URL('../workers/indicatorWorker.js', import.meta.url),
                { type: 'module' }
            );

            // Handle messages from worker
            workerRef.current.onmessage = (event) => {
                const { type, id, success, result, error } = event.data;

                // Worker ready signal
                if (type === 'ready') {
                    setIsReady(true);
                    logger.debug('[IndicatorWorker] Worker ready');
                    return;
                }

                // Handle calculation response
                const pending = pendingRequests.current.get(id);
                if (pending) {
                    pendingRequests.current.delete(id);

                    if (success) {
                        pending.resolve(result);
                    } else {
                        pending.reject(new Error(error));
                    }
                }
            };

            // Handle worker errors
            workerRef.current.onerror = (error) => {
                logger.error('[IndicatorWorker] Worker error:', error);
                // Reject all pending requests
                for (const [id, pending] of pendingRequests.current) {
                    pending.reject(new Error('Worker error'));
                }
                pendingRequests.current.clear();
            };

            logger.debug('[IndicatorWorker] Worker initialized');

        } catch (error) {
            logger.error('[IndicatorWorker] Failed to create worker:', error);
        }

        // Cleanup
        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
            pendingRequests.current.clear();
        };
    }, []);

    /**
     * Send calculation request to worker
     */
    const sendRequest = useCallback((type, data, options = {}) => {
        return new Promise((resolve, reject) => {
            if (!workerRef.current) {
                // Fallback: resolve with empty result if worker not available
                logger.warn('[IndicatorWorker] Worker not available, skipping calculation');
                resolve(null);
                return;
            }

            const id = createRequestId();

            // Store pending request
            pendingRequests.current.set(id, { resolve, reject });

            // Set timeout for request
            const timeout = options.timeout || 30000;
            const timeoutId = setTimeout(() => {
                if (pendingRequests.current.has(id)) {
                    pendingRequests.current.delete(id);
                    reject(new Error(`Calculation timeout after ${timeout}ms`));
                }
            }, timeout);

            // Update pending to include timeout cleanup
            const pending = pendingRequests.current.get(id);
            pendingRequests.current.set(id, {
                resolve: (result) => {
                    clearTimeout(timeoutId);
                    pending.resolve(result);
                },
                reject: (error) => {
                    clearTimeout(timeoutId);
                    pending.reject(error);
                }
            });

            // Send to worker
            workerRef.current.postMessage({ type, id, data, options });
        });
    }, []);

    /**
     * Calculate TPO Profile
     */
    const calculateTPO = useCallback(async (data, options = {}) => {
        try {
            const result = await sendRequest('tpo', data, options);
            return result;
        } catch (error) {
            logger.error('[IndicatorWorker] TPO calculation failed:', error);
            return { sessions: [], error: error.message };
        }
    }, [sendRequest]);

    /**
     * Calculate Volume Profile
     */
    const calculateVolumeProfile = useCallback(async (data, options = {}) => {
        try {
            const result = await sendRequest('volumeProfile', data, options);
            return result;
        } catch (error) {
            logger.error('[IndicatorWorker] Volume Profile calculation failed:', error);
            return { profile: [], poc: 0, vah: 0, val: 0, error: error.message };
        }
    }, [sendRequest]);

    /**
     * Terminate worker manually (for cleanup)
     */
    const terminate = useCallback(() => {
        if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = null;
            setIsReady(false);
        }
    }, []);

    return {
        isReady,
        calculateTPO,
        calculateVolumeProfile,
        terminate
    };
};

export default useIndicatorWorker;
