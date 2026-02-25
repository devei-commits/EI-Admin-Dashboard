/**
 * Performance optimization utilities
 */

// Safe window check for SSR compatibility
const isClient = typeof window !== 'undefined';
const isBrowser = isClient && typeof window.document !== 'undefined';

/**
 * Request idle callback polyfill for better performance
 */
export const scheduleIdleTask = (callback: () => void): number => {
 if (!isBrowser) return 0;
 
 if ('requestIdleCallback' in window) {
  return (window as any).requestIdleCallback(callback);
 }
 // Fallback to setTimeout with 1 second delay
 return setTimeout(callback, 1000);
};

/**
 * Cancel idle task
 */
export const cancelIdleTask = (id: number): void => {
 if (!isBrowser) return;
 
 if ('cancelIdleCallback' in window) {
  (window as any).cancelIdleCallback(id);
 } else {
  clearTimeout(id);
 }
};

/**
 * Memoize a function with custom key generator
 */
export const memoize = <T extends (...args: any[]) => any>(
 fn: T,
 keyGenerator?: (...args: Parameters<T>) => string
): T => {
 const cache = new Map<string, any>();

 return ((...args: Parameters<T>) => {
  const key = keyGenerator
   ? keyGenerator(...args)
   : JSON.stringify(args);

  if (cache.has(key)) {
   return cache.get(key);
  }

  const result = fn(...args);
  cache.set(key, result);

  // Limit cache size
  if (cache.size > 100) {
   const firstKey = cache.keys().next().value;
   cache.delete(firstKey);
  }

  return result;
 }) as T;
};

/**
 * Batch multiple state updates
 */
export const batchUpdates = async (updates: (() => void)[]) => {
 for (const update of updates) {
  await new Promise(resolve => {
   scheduleIdleTask(() => {
    update();
    resolve(null);
   });
  });
 }
};

/**
 * Infinite scroll observer helper
 */
export const createInfiniteScrollObserver = (
 callback: () => void,
 options = { threshold: 0.1, rootMargin: '100px' }
) => {
 if (!('IntersectionObserver' in window)) {
  return null;
 }

 return new IntersectionObserver(
  (entries) => {
   entries.forEach((entry) => {
    if (entry.isIntersecting) {
     callback();
    }
   });
  },
  options
 );
};

/**
 * Performance metrics tracking
 */
export const trackMetric = (label: string, _value: number) => {
 if ('PerformanceObserver' in window) {
  if (window.performance && window.performance.mark) {
   window.performance.mark(`${label}-${Date.now()}`);
  }
 }
};

/**
 * Debounce with immediate option
 */
export const debounce = <T extends (...args: any[]) => any>(
 fn: T,
 delay: number,
 immediate: boolean = false
): T => {
 let timeoutId: number | null = null;

 return ((...args: Parameters<T>) => {
  if (immediate && !timeoutId) {
   fn(...args);
  }

  if (timeoutId) {
   clearTimeout(timeoutId);
  }

  timeoutId = setTimeout(() => {
   if (!immediate) {
    fn(...args);
   }
   timeoutId = null;
  }, delay);
 }) as T;
};

/**
 * Throttle function
 */
export const throttle = <T extends (...args: any[]) => any>(
 fn: T,
 limit: number
): T => {
 let inThrottle: boolean;

 return ((...args: Parameters<T>) => {
  if (!inThrottle) {
   fn(...args);
   inThrottle = true;
   setTimeout(() => {
    inThrottle = false;
   }, limit);
  }
 }) as T;
};

/**
 * Lazy load images
 */
export const observeImages = () => {
 if (!('IntersectionObserver' in window)) {
  // Fallback: load all images immediately
  const images = document.querySelectorAll('img[data-src]');
  images.forEach((img) => {
   const src = (img as HTMLImageElement).dataset.src;
   if (src) {
    (img as HTMLImageElement).src = src;
   }
  });
  return;
 }

 const imageObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
   if (entry.isIntersecting) {
    const img = entry.target as HTMLImageElement;
    img.src = img.dataset.src || '';
    img.removeAttribute('data-src');
    imageObserver.unobserve(img);
   }
  });
 });

 const images = document.querySelectorAll('img[data-src]');
 images.forEach((img) => imageObserver.observe(img));
};

/**
 * Connection status monitoring
 */
export const monitorConnection = (
 onStatusChange: (isOnline: boolean) => void
): (() => void) => {
 const handleOnline = () => onStatusChange(true);
 const handleOffline = () => onStatusChange(false);

 window.addEventListener('online', handleOnline);
 window.addEventListener('offline', handleOffline);

 // Return cleanup function
 return () => {
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
 };
};
