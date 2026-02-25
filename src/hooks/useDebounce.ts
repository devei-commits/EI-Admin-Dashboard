import { useState, useEffect, useRef } from 'react';

/**
 * useDebounce Hook
 * Delays updating a value until after a specified delay period.
 * Useful for search inputs, filtering, or any value that changes frequently.
 * 
 * @template T The type of the value being debounced
 * @param value The value to debounce
 * @param delay The delay in milliseconds before the value updates
 * @returns The debounced value
 * 
 * @example
 * const [searchQuery, setSearchQuery] = useState('');
 * const debouncedQuery = useDebounce(searchQuery, 300);
 * 
 * // Use debouncedQuery for API calls or filtering
 * useEffect(() => {
 *  fetchSearchResults(debouncedQuery);
 * }, [debouncedQuery]);
 */
export function useDebounce<T>(value: T, delay: number): T {
 const [debouncedValue, setDebouncedValue] = useState<T>(value);

 useEffect(() => {
  // Set up the timeout to update the debounced value
  const handler = setTimeout(() => {
   setDebouncedValue(value);
  }, delay);

  // Clean up the timeout if value changes before delay completes
  return () => {
   clearTimeout(handler);
  };
 }, [value, delay]);

 return debouncedValue;
}

/**
 * useDebouncedCallback Hook
 * Returns a debounced version of a callback function.
 * Useful when you need to debounce a function rather than a value.
 * 
 * @template T The callback function type
 * @param callback The function to debounce
 * @param delay The delay in milliseconds
 * @returns The debounced callback function
 * 
 * @example
 * const handleSearch = useDebouncedCallback((query: string) => {
 *  fetchSearchResults(query);
 * }, 300);
 * 
 * // Call handleSearch on each keystroke - it will only execute after 300ms of no calls
 * <input onChange={(e) => handleSearch(e.target.value)} />
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
 callback: T,
 delay: number
): T {
 const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 const callbackRef = useRef(callback);

 // Update callback ref when callback changes
 useEffect(() => {
  callbackRef.current = callback;
 }, [callback]);

 // Cleanup on unmount
 useEffect(() => {
  return () => {
   if (timeoutRef.current) {
    clearTimeout(timeoutRef.current);
   }
  };
 }, []);

 const debouncedCallback = ((...args: Parameters<T>) => {
  if (timeoutRef.current) {
   clearTimeout(timeoutRef.current);
  }
  timeoutRef.current = setTimeout(() => {
   callbackRef.current(...args);
  }, delay);
 }) as T;

 return debouncedCallback;
}

export default useDebounce;
