/**
 * Centralized error handling utility
 * Provides consistent error handling across the application
 */

export interface ApiError {
 message: string;
 code?: string;
 status?: number;
 details?: any;
}

export interface AsyncState<T> {
 data: T | null;
 loading: boolean;
 error: ApiError | null;
}

/**
 * Parse error from various sources into standardized ApiError
 */
export const parseError = (error: any): ApiError => {
 if (error instanceof Error) {
  return {
   message: error.message,
   code: 'ERROR',
  };
 }

 if (typeof error === 'string') {
  return {
   message: error,
   code: 'ERROR',
  };
 }

 if (error?.response?.data) {
  return {
   message: error.response.data.message || 'An error occurred',
   code: error.response.data.code || 'SERVER_ERROR',
   status: error.response.status,
   details: error.response.data,
  };
 }

 if (error?.message) {
  return {
   message: error.message,
   code: error.code || 'ERROR',
   status: error.status,
  };
 }

 return {
  message: 'An unexpected error occurred',
  code: 'UNKNOWN_ERROR',
 };
};

/**
 * Retry logic with exponential backoff
 */
export const retryWithBackoff = async <T>(
 fn: () => Promise<T>,
 maxRetries: number = 3,
 baseDelay: number = 1000
): Promise<T> => {
 let lastError: Error | null = null;

 for (let i = 0; i < maxRetries; i++) {
  try {
   return await fn();
  } catch (error) {
   lastError = error as Error;
   if (i < maxRetries - 1) {
    const delay = baseDelay * Math.pow(2, i);
    await new Promise(resolve => setTimeout(resolve, delay));
   }
  }
 }

 throw lastError;
};

/**
 * Safe async handler wrapper
 */
export const safeAsync = async <T>(
 fn: () => Promise<T>,
 errorHandler?: (error: ApiError) => void
): Promise<{ success: boolean; data?: T; error?: ApiError }> => {
 try {
  const data = await fn();
  return { success: true, data };
 } catch (error) {
  const apiError = parseError(error);
  if (errorHandler) {
   errorHandler(apiError);
  }
  return { success: false, error: apiError };
 }
};

/**
 * Timeout wrapper for promises
 */
export const withTimeout = <T>(
 promise: Promise<T>,
 timeoutMs: number
): Promise<T> => {
 return Promise.race([
  promise,
  new Promise<T>((_, reject) =>
   setTimeout(
    () => reject(new Error('Operation timed out')),
    timeoutMs
   )
  ),
 ]);
};

/**
 * Create initial async state
 */
export const createAsyncState = <T>(): AsyncState<T> => ({
 data: null,
 loading: false,
 error: null,
});

/**
 * Debounce function with cancellation
 */
export const createDebounce = <T extends any[]>(
 fn: (...args: T) => void,
 delay: number
) => {
 let timeoutId: number | null = null;

 return {
  call: (...args: T) => {
   if (timeoutId) clearTimeout(timeoutId);
   timeoutId = setTimeout(() => {
    fn(...args);
   }, delay);
  },
  cancel: () => {
   if (timeoutId) clearTimeout(timeoutId);
  },
 };
};
