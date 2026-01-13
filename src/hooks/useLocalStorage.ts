import { useState, useEffect, useRef, useCallback, Dispatch, SetStateAction } from 'react';

interface UseLocalStorageOptions {
    debounceMs?: number;
    serialize?: boolean;
}

type SetValue<T> = Dispatch<SetStateAction<T>>;

/**
 * Custom hook for syncing state with localStorage
 * Features:
 * - Try-catch for edge cases (private browsing, quota exceeded)
 * - Debounced writes to prevent rapid localStorage updates
 * - Type-safe serialization/deserialization
 */
export function useLocalStorage<T>(
    key: string,
    defaultValue: T,
    options: UseLocalStorageOptions = {}
): [T, SetValue<T>] {
    const { debounceMs = 300, serialize = typeof defaultValue === 'object' } = options;

    // Ref to track if this is the initial mount (skip first write)
    const isInitialMount = useRef(true);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Initialize state from localStorage
    const [value, setValue] = useState<T>(() => {
        try {
            const stored = localStorage.getItem(key);
            if (stored === null) {
                return defaultValue;
            }

            // Handle boolean strings specially
            if (stored === 'true') return true as T;
            if (stored === 'false') return false as T;

            // Try to parse JSON for objects/arrays
            if (serialize) {
                try {
                    return JSON.parse(stored) as T;
                } catch {
                    return stored as T;
                }
            }

            return stored as T;
        } catch (error) {
            console.warn(`[useLocalStorage] Failed to read '${key}':`, (error as Error).message);
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
                console.warn(`[useLocalStorage] Failed to write '${key}':`, (error as Error).message);
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
    const setStoredValue: SetValue<T> = useCallback((newValue) => {
        setValue((prev) => {
            // Support functional updates like useState
            const valueToStore = typeof newValue === 'function'
                ? (newValue as (prev: T) => T)(prev)
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
export function useLocalStorageBoolean(
    key: string,
    defaultValue: boolean = false
): [boolean, SetValue<boolean>] {
    return useLocalStorage<boolean>(key, defaultValue, { debounceMs: 0, serialize: false });
}

export default useLocalStorage;
