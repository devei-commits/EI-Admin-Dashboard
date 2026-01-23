/**
 * API utilities with error handling and retry logic
 */

interface ApiError extends Error {
  status?: number;
  code?: string;
}

interface RetryConfig {
  maxRetries?: number;
  retryDelay?: number;
  retryOn?: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  retryOn: [408, 429, 500, 502, 503, 504],
};

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch with retry logic
 */
export const fetchWithRetry = async <T>(
  url: string,
  options?: RequestInit,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> => {
  const { maxRetries = 3, retryDelay = 1000, retryOn = [500, 502, 503, 504] } = retryConfig;
  
  let lastError: ApiError | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const error: ApiError = new Error(`HTTP error! status: ${response.status}`);
        error.status = response.status;
        
        if (retryOn.includes(response.status) && attempt < maxRetries) {
          lastError = error;
          await sleep(retryDelay * Math.pow(2, attempt));
          continue;
        }
        
        throw error;
      }

      return response.json();
    } catch (error) {
      lastError = error as ApiError;
      
      if (attempt < maxRetries) {
        await sleep(retryDelay * Math.pow(2, attempt));
        continue;
      }
    }
  }

  throw lastError || new Error('Request failed after retries');
};

/**
 * API client with built-in error handling
 */
export const apiClient = {
  get: <T>(url: string, options?: RequestInit) => 
    fetchWithRetry<T>(url, { ...options, method: 'GET' }),
  
  post: <T>(url: string, data: unknown, options?: RequestInit) => 
    fetchWithRetry<T>(url, { 
      ...options, 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
  
  put: <T>(url: string, data: unknown, options?: RequestInit) => 
    fetchWithRetry<T>(url, { 
      ...options, 
      method: 'PUT', 
      body: JSON.stringify(data) 
    }),
  
  patch: <T>(url: string, data: unknown, options?: RequestInit) => 
    fetchWithRetry<T>(url, { 
      ...options, 
      method: 'PATCH', 
      body: JSON.stringify(data) 
    }),
  
  delete: <T>(url: string, options?: RequestInit) => 
    fetchWithRetry<T>(url, { ...options, method: 'DELETE' }),
};

/**
 * Format API error for display
 */
export const formatApiError = (error: unknown): string => {
  if (error instanceof Error) {
    const apiError = error as ApiError;
    
    switch (apiError.status) {
      case 400:
        return 'Invalid request. Please check your input.';
      case 401:
        return 'You are not authorized. Please log in again.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 429:
        return 'Too many requests. Please try again later.';
      case 500:
        return 'Server error. Please try again later.';
      default:
        return apiError.message || 'An unexpected error occurred.';
    }
  }
  
  return 'An unexpected error occurred.';
};

export default apiClient;
