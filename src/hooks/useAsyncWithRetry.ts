import { useState, useCallback, useRef, useEffect } from 'react';
import { parseError, ApiError, retryWithBackoff } from '../lib/errorHandler';

export interface UseAsyncState<T> {
 data: T | null;
 loading: boolean;
 error: ApiError | null;
}

/**
 * Custom hook for handling async operations with loading and error states
 */
export const useAsync = <T,>(
 asyncFunction: () => Promise<T>,
 immediate: boolean = true,
 dependencies: any[] = []
) => {
 const [state, setState] = useState<UseAsyncState<T>>({
  data: null,
  loading: immediate,
  error: null,
 });

 const isMountedRef = useRef(true);

 const execute = useCallback(async () => {
  setState(prev => ({ ...prev, loading: true, error: null }));
  try {
   const response = await asyncFunction();
   if (isMountedRef.current) {
    setState({ data: response, loading: false, error: null });
   }
   return response;
  } catch (error) {
   const apiError = parseError(error);
   if (isMountedRef.current) {
    setState({ data: null, loading: false, error: apiError });
   }
   throw apiError;
  }
 }, [asyncFunction]);

 useEffect(() => {
  isMountedRef.current = true;
  if (immediate) {
   execute();
  }
  return () => {
   isMountedRef.current = false;
  };
 }, dependencies);

 return { ...state, execute };
};

/**
 * Custom hook for API calls with retry logic
 */
export const useAsyncWithRetry = <T,>(
 asyncFunction: () => Promise<T>,
 options = { immediate: true, maxRetries: 3, dependencies: [] as any[] }
) => {
 const [state, setState] = useState<UseAsyncState<T>>({
  data: null,
  loading: options.immediate,
  error: null,
 });

 const isMountedRef = useRef(true);

 const execute = useCallback(async () => {
  setState(prev => ({ ...prev, loading: true, error: null }));
  try {
   const response = await retryWithBackoff(asyncFunction, options.maxRetries);
   if (isMountedRef.current) {
    setState({ data: response, loading: false, error: null });
   }
   return response;
  } catch (error) {
   const apiError = parseError(error);
   if (isMountedRef.current) {
    setState({ data: null, loading: false, error: apiError });
   }
   throw apiError;
  }
 }, [asyncFunction, options.maxRetries]);

 useEffect(() => {
  isMountedRef.current = true;
  if (options.immediate) {
   execute();
  }
  return () => {
   isMountedRef.current = false;
  };
 }, options.dependencies);

 return { ...state, execute, retry: execute };
};

/**
 * Custom hook for mutations (POST, PUT, DELETE)
 */
export const useMutation = <T, Variables = any>(
 mutationFn: (variables: Variables) => Promise<T>
) => {
 const [state, setState] = useState<UseAsyncState<T>>({
  data: null,
  loading: false,
  error: null,
 });

 const isMountedRef = useRef(true);

 const mutate = useCallback(
  async (variables: Variables) => {
   setState(prev => ({ ...prev, loading: true, error: null }));
   try {
    const response = await mutationFn(variables);
    if (isMountedRef.current) {
     setState({ data: response, loading: false, error: null });
    }
    return response;
   } catch (error) {
    const apiError = parseError(error);
    if (isMountedRef.current) {
     setState({ data: null, loading: false, error: apiError });
    }
    throw apiError;
   }
  },
  [mutationFn]
 );

 useEffect(() => {
  isMountedRef.current = true;
  return () => {
   isMountedRef.current = false;
  };
 }, []);

 const reset = useCallback(() => {
  setState({ data: null, loading: false, error: null });
 }, []);

 return { ...state, mutate, reset };
};
