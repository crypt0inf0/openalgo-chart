/**
 * useCPRScanner Hook
 * Manages CPR Scanner background scanning state and operations
 */

import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { scanCPRStocks, type CPRScanResult, type StockInput, type CPRScanOptions } from '../services/cprScannerService';
import logger from '../utils/logger';

export interface CPRScanProgress {
  current: number;
  total: number;
}

export interface CPRScannerState {
  results: CPRScanResult[];
  isScanning: boolean;
  progress: CPRScanProgress;
  lastScanTime: Date | null;
  scanError: string | null;
  narrowThreshold: number;
  source: string;
}

export interface UseCPRScannerReturn {
  startCPRScan: (
    stocks: StockInput[],
    options?: CPRScanOptions,
    showToast?: (message: string, type: string) => void
  ) => void;
  cancelCPRScan: () => void;
}

// Module-level abort controller for cancellation
let abortController: AbortController | null = null;

export const useCPRScanner = (
  cprScannerState: CPRScannerState,
  setCPRScannerState: Dispatch<SetStateAction<CPRScannerState>>
): UseCPRScannerReturn => {

  const startCPRScan = useCallback(async (
    stocks: StockInput[],
    options: CPRScanOptions = {},
    showToast?: (message: string, type: string) => void
  ): Promise<void> => {
    if (cprScannerState.isScanning) return;
    if (stocks.length === 0) return;

    // Cancel any previous scan
    if (abortController) {
      abortController.abort();
    }
    abortController = new AbortController();
    const signal = abortController.signal;

    const narrowThreshold = options.narrowThreshold ?? cprScannerState.narrowThreshold ?? 0.5;

    setCPRScannerState(prev => ({
      ...prev,
      isScanning: true,
      progress: { current: 0, total: stocks.length },
      scanError: null,
      results: [],
    }));

    try {
      const results = await scanCPRStocks(
        stocks,
        { delayMs: 80, daysToFetch: 5, narrowThreshold, ...options },
        (current, total, result) => {
          setCPRScannerState(prev => ({
            ...prev,
            progress: { current, total },
            results: [...prev.results, result],
          }));
        },
        signal
      );

      if (!signal.aborted) {
        const narrowCount = results.filter(r => r.isNarrow).length;
        setCPRScannerState(prev => ({
          ...prev,
          isScanning: false,
          results,
          lastScanTime: new Date(),
          progress: { current: results.length, total: stocks.length },
        }));

        if (showToast) {
          showToast(`CPR scan complete: ${narrowCount} narrow CPR found out of ${results.length} stocks`, 'success');
        }

        logger.debug(`[CPR Scanner] Scan complete: ${narrowCount} narrow out of ${results.length}`);
      }
    } catch (err) {
      const error = err as Error & { name?: string };
      if (error.name === 'AbortError') {
        setCPRScannerState(prev => ({
          ...prev,
          isScanning: false,
          progress: { current: 0, total: 0 },
        }));
      } else {
        logger.error('[CPR Scanner] Scan error:', err);
        setCPRScannerState(prev => ({
          ...prev,
          isScanning: false,
          scanError: error.message || 'Scan failed',
        }));
        if (showToast) {
          showToast('CPR scan failed. Check API connection.', 'error');
        }
      }
    }
  }, [cprScannerState.isScanning, cprScannerState.narrowThreshold, setCPRScannerState]);

  const cancelCPRScan = useCallback((): void => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    setCPRScannerState(prev => ({
      ...prev,
      isScanning: false,
      progress: { current: 0, total: 0 },
    }));
  }, [setCPRScannerState]);

  return { startCPRScan, cancelCPRScan };
};
