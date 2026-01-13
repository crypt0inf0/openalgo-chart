/**
 * Error Handling Utilities
 * Centralized error handling, retry logic, and resilience patterns
 */

/**
 * Sleep utility for delays
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Custom TimeoutError class
 */
export class TimeoutError extends Error {
    constructor(message, timeout) {
        super(message);
        this.name = 'TimeoutError';
        this.timeout = timeout;
    }
}

/**
 * Custom ApiError class with status code
 */
export class ApiError extends Error {
    constructor(message, status, response = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.response = response;
    }

    get isAuthError() {
        return this.status === 401 || this.status === 403;
    }

    get isNotFound() {
        return this.status === 404;
    }

    get isRateLimit() {
        return this.status === 429;
    }

    get isServerError() {
        return this.status >= 500;
    }
}

/**
 * Circuit breaker open error
 */
export class CircuitOpenError extends Error {
    constructor(message, retryAfter) {
        super(message);
        this.name = 'CircuitOpenError';
        this.retryAfter = retryAfter;
    }
}

/**
 * Retry an async function with exponential backoff
 */
export const retryWithBackoff = async (fn, options = {}) => {
    const {
        maxRetries = 3,
        baseDelay = 1000,
        maxDelay = 30000,
        shouldRetry = () => true,
        onRetry = null,
    } = options;

    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

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
export const withTimeout = (promise, timeoutMs, message = 'Operation timed out') => {
    let timeoutId;

    const timeoutPromise = new Promise((_, reject) => {
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
export const handleApiResponse = async (response, context = 'API call') => {
    if (!response.ok) {
        let errorBody = null;
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
export const safeJsonParse = (text, context = 'JSON parse') => {
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`${context}: Invalid JSON - ${error.message}`);
    }
};

/**
 * Create a rate limiter for function calls
 */
export const createRateLimiter = (minInterval) => {
    let lastCallTime = 0;
    let pendingPromise = null;

    return async (fn) => {
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
export const createCircuitBreaker = (options = {}) => {
    const {
        failureThreshold = 5,
        resetTimeout = 30000,
        onStateChange = null,
    } = options;

    let state = 'CLOSED';
    let failures = 0;
    let lastFailureTime = 0;

    const changeState = (newState) => {
        if (state !== newState) {
            const oldState = state;
            state = newState;
            if (onStateChange) {
                onStateChange(newState, oldState);
            }
        }
    };

    return {
        get state() {
            return state;
        },

        get failures() {
            return failures;
        },

        async execute(fn) {
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

        reset() {
            failures = 0;
            changeState('CLOSED');
        },
    };
};

/**
 * Check if an error is retryable (network errors, server errors, rate limits)
 */
export const isRetryableError = (error) => {
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
export const createErrorHandler = (context, options = {}) => {
    const { onError = null, rethrow = true, silent = false } = options;

    return (error) => {
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
export const withErrorHandling = (fn, context, options = {}) => {
    const handler = createErrorHandler(context, { ...options, rethrow: false });

    return async (...args) => {
        try {
            return await fn(...args);
        } catch (error) {
            handler(error);
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
