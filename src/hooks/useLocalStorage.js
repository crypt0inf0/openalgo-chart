import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for syncing state with localStorage
 * Features:
 * - Try-catch for edge cases (private browsing, quota exceeded)
 * - Debounced writes to prevent rapid localStorage updates
 * - Type-safe serialization/deserialization
 */
export function useLocalStorage(key, defaultValue, options = {}) {
    const { debounceMs = 300, serialize = typeof defaultValue === 'object' } = options;

    // Ref to track if this is the initial mount (skip first write)
    const isInitialMount = useRef(true);
    const timeoutRef = useRef(null);

    // Initialize state from localStorage
    const [value, setValue] = useState(() => {
        try {
            const stored = localStorage.getItem(key);
            if (stored === null) {
                return defaultValue;
            }

            // Handle boolean strings specially
            if (stored === 'true') return true;
            if (stored === 'false') return false;

            // Try to parse JSON for objects/arrays
            if (serialize) {
                try {
                    return JSON.parse(stored);
                } catch {
                    return stored;
                }
            }

            return stored;
        } catch (error) {
            console.warn(`[useLocalStorage] Failed to read '${key}':`, error.message);
            return defaultValue;
        }
    });

    // Debounced write to localStorage
    useEffect(() => {
        // Skip the first write (initial mount)
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        // Clear any pending write
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Debounce the write
        timeoutRef.current = setTimeout(() => {
            try {
                if (serialize && typeof value === 'object') {
                    localStorage.setItem(key, JSON.stringify(value));
                } else {
                    localStorage.setItem(key, String(value));
                }
            } catch (error) {
                console.warn(`[useLocalStorage] Failed to write '${key}':`, error.message);
            }
        }, debounceMs);

        // Cleanup timeout on unmount or value change
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [key, value, serialize, debounceMs]);

    // Memoized setter that matches useState signature
    const setStoredValue = useCallback((newValue) => {
        setValue((prev) => {
            // Support functional updates like useState
            const valueToStore = typeof newValue === 'function'
                ? newValue(prev)
                : newValue;
            return valueToStore;
        });
    }, []);

    return [value, setStoredValue];
}

/**
 * Simplified hook for boolean localStorage values
 * Uses immediate writes (no debounce) since toggles are infrequent
 */
export function useLocalStorageBoolean(key, defaultValue = false) {
    return useLocalStorage(key, defaultValue, { debounceMs: 0, serialize: false });
}

export default useLocalStorage;
