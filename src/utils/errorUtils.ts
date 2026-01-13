/**
 * Error Handling Utilities
 * Centralized error handling, retry logic, and resilience patterns
 */

// Types
export interface RetryOptions {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: Error, attempt: number) => boolean;
    onRetry?: (error: Error, attempt: number, delay: number) => void;
}

export interface CircuitBreakerOptions {
    failureThreshold?: number;
    resetTimeout?: number;
    onStateChange?: (newState: CircuitState, oldState: CircuitState) => void;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreaker {
    readonly state: CircuitState;
    readonly failures: number;
    execute: <T>(fn: () => Promise<T>) => Promise<T>;
    reset: () => void;
}

export interface ErrorHandlerOptions {
    onError?: (error: Error) => void;
    rethrow?: boolean;
    silent?: boolean;
}

/**
 * Sleep utility for delays
 */
export const sleep = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

/**
 * Custom TimeoutError class
 */
export class TimeoutError extends Error {
    readonly timeout: number;

    constructor(message: string, timeout: number) {
        super(message);
        this.name = 'TimeoutError';
        this.timeout = timeout;
    }
}

/**
 * Custom ApiError class with status code
 */
export class ApiError extends Error {
    readonly status: number;
    readonly response: unknown;

    constructor(message: string, status: number, response: unknown = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.response = response;
    }

    get isAuthError(): boolean {
        return this.status === 401 || this.status === 403;
    }

    get isNotFound(): boolean {
        return this.status === 404;
    }

    get isRateLimit(): boolean {
        return this.status === 429;
    }

    get isServerError(): boolean {
        return this.status >= 500;
    }
}

/**
 * Circuit breaker open error
 */
export class CircuitOpenError extends Error {
    readonly retryAfter: number;

    constructor(message: string, retryAfter: number) {
        super(message);
        this.name = 'CircuitOpenError';
        this.retryAfter = retryAfter;
    }
}

/**
 * Retry an async function with exponential backoff
 */
export const retryWithBackoff = async <T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> => {
    const {
        maxRetries = 3,
        baseDelay = 1000,
        maxDelay = 30000,
        shouldRetry = () => true,
        onRetry = null,
    } = options;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;

            // Check if we should retry
            if (attempt >= maxRetries || !shouldRetry(lastError, attempt)) {
                throw error;
            }

            // Calculate delay with exponential backoff and jitter
            const exponentialDelay = baseDelay * Math.pow(2, attempt);
            const jitter = Math.random() * 0.3 * exponentialDelay;
            const delay = Math.min(exponentialDelay + jitter, maxDelay);

            // Notify before retry
            if (onRetry) {
                onRetry(lastError, attempt + 1, delay);
            }

            // Wait before retrying
            await sleep(delay);
        }
    }

    throw lastError;
};

/**
 * Wrap a promise with a timeout
 */
export const withTimeout = <T>(
    promise: Promise<T>,
    timeoutMs: number,
    message: string = 'Operation timed out'
): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new TimeoutError(message, timeoutMs));
        }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId);
    });
};

/**
 * Handle API response and throw ApiError if not ok
 */
export const handleApiResponse = async (
    response: Response,
    context: string = 'API call'
): Promise<Response> => {
    if (!response.ok) {
        let errorBody: { message?: string; error?: string } | null = null;
        try {
            errorBody = await response.json();
        } catch {
            // Response might not be JSON
        }

        const message = errorBody?.message || errorBody?.error ||
            `${context} failed: ${response.status} ${response.statusText}`;
        throw new ApiError(message, response.status, errorBody);
    }
    return response;
};

/**
 * Safe JSON parse with error context
 */
export const safeJsonParse = <T>(text: string, context: string = 'JSON parse'): T => {
    try {
        return JSON.parse(text) as T;
    } catch (error) {
        throw new Error(`${context}: Invalid JSON - ${(error as Error).message}`);
    }
};

/**
 * Create a rate limiter for function calls
 */
export const createRateLimiter = (minInterval: number) => {
    let lastCallTime = 0;
    let pendingPromise: Promise<void> | null = null;

    return async <T>(fn: () => T | Promise<T>): Promise<T> => {
        const now = Date.now();
        const elapsed = now - lastCallTime;

        if (elapsed < minInterval) {
            const waitTime = minInterval - elapsed;

            if (pendingPromise) {
                await pendingPromise;
            }

            pendingPromise = sleep(waitTime);
            await pendingPromise;
            pendingPromise = null;
        }

        lastCallTime = Date.now();
        return fn();
    };
};

/**
 * Create a circuit breaker to prevent cascading failures
 */
export const createCircuitBreaker = (options: CircuitBreakerOptions = {}): CircuitBreaker => {
    const {
        failureThreshold = 5,
        resetTimeout = 30000,
        onStateChange = null,
    } = options;

    let state: CircuitState = 'CLOSED';
    let failures = 0;
    let lastFailureTime = 0;

    const changeState = (newState: CircuitState): void => {
        if (state !== newState) {
            const oldState = state;
            state = newState;
            if (onStateChange) {
                onStateChange(newState, oldState);
            }
        }
    };

    return {
        get state(): CircuitState {
            return state;
        },

        get failures(): number {
            return failures;
        },

        async execute<T>(fn: () => Promise<T>): Promise<T> {
            // Check if circuit should transition from OPEN to HALF_OPEN
            if (state === 'OPEN') {
                if (Date.now() - lastFailureTime >= resetTimeout) {
                    changeState('HALF_OPEN');
                } else {
                    throw new CircuitOpenError(
                        'Circuit breaker is open',
                        resetTimeout - (Date.now() - lastFailureTime)
                    );
                }
            }

            try {
                const result = await fn();

                // Success - reset on HALF_OPEN or decrement failures
                if (state === 'HALF_OPEN') {
                    changeState('CLOSED');
                    failures = 0;
                } else if (failures > 0) {
                    failures--;
                }

                return result;
            } catch (error) {
                failures++;
                lastFailureTime = Date.now();

                if (failures >= failureThreshold) {
                    changeState('OPEN');
                }

                throw error;
            }
        },

        reset(): void {
            failures = 0;
            changeState('CLOSED');
        },
    };
};

/**
 * Check if an error is retryable (network errors, server errors, rate limits)
 */
export const isRetryableError = (error: Error): boolean => {
    // AbortError should not be retried
    if (error.name === 'AbortError') return false;

    // Timeout errors are retryable
    if (error instanceof TimeoutError) return true;

    // Circuit open errors should wait
    if (error instanceof CircuitOpenError) return false;

    // API errors - retry on server errors and rate limits
    if (error instanceof ApiError) {
        return error.isServerError || error.isRateLimit;
    }

    // Network errors are retryable
    if (error.name === 'TypeError' && error.message.includes('fetch')) return true;

    // Default: retry unknown errors
    return true;
};

/**
 * Create a standardized error handler for async operations
 */
export const createErrorHandler = (
    context: string,
    options: ErrorHandlerOptions = {}
) => {
    const { onError = null, rethrow = true, silent = false } = options;

    return (error: Error): void => {
        // Don't log abort errors
        if (error.name === 'AbortError') {
            if (rethrow) throw error;
            return;
        }

        // Log with context
        if (!silent) {
            if (error instanceof ApiError) {
                console.error(`[${context}] API Error (${error.status}):`, error.message);
            } else if (error instanceof TimeoutError) {
                console.error(`[${context}] Timeout after ${error.timeout}ms:`, error.message);
            } else {
                console.error(`[${context}] Error:`, error.message);
            }
        }

        // Custom callback
        if (onError) {
            onError(error);
        }

        // Rethrow if configured
        if (rethrow) {
            throw error;
        }
    };
};

/**
 * Wrap an async function with standard error handling
 */
export const withErrorHandling = <T, Args extends unknown[]>(
    fn: (...args: Args) => Promise<T>,
    context: string,
    options: ErrorHandlerOptions = {}
) => {
    const handler = createErrorHandler(context, { ...options, rethrow: false });

    return async (...args: Args): Promise<T | null> => {
        try {
            return await fn(...args);
        } catch (error) {
            handler(error as Error);
            return null;
        }
    };
};

export default {
    // Retry utilities
    retryWithBackoff,
    sleep,
    withTimeout,

    // Error classes
    TimeoutError,
    ApiError,
    CircuitOpenError,

    // API helpers
    handleApiResponse,
    safeJsonParse,

    // Resilience patterns
    createRateLimiter,
    createCircuitBreaker,

    // Error handling
    isRetryableError,
    createErrorHandler,
    withErrorHandling,
};
