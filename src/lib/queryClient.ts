import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
 defaultOptions: {
  queries: {
   // Keep data fresh across different local dev machines/sessions.
   staleTime: 30 * 1000, // 30 seconds
   gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
   retry: (failureCount, error) => {
    // Don't retry on 404s or client errors
    if (error instanceof Error && error.message.includes('404')) {
     return false;
    }
    return failureCount < 3;
   },
   retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
   // Disable focus/reconnect refetches (they previously caused repeated GETs of
   // `/api/v1/warehouse-inventory` during dev). Keep refetchOnMount = 'always' so
   // that whenever a screen remounts (e.g. switching to Warehouse → Inventory or
   // Planning → Items Involved after a GRN Complete), the cached row is replaced
   // with fresh data. The backend's cacheInvalidationMiddleware already drops the
   // Redis namespace; this just makes the SPA pick that up.
   refetchOnWindowFocus: false,
   refetchOnReconnect: false,
   refetchOnMount: 'always',
   throwOnError: false, // Prevent queries from throwing errors up to React
  },
  mutations: {
   retry: 2,
   throwOnError: false, // Prevent mutations from throwing errors up to React
  },
 },
});

// Query keys for consistent caching
export const queryKeys = {
 orders: ['orders'] as const,
 order: (id: string) => ['orders', id] as const,
 reviewOrders: ['reviewOrders'] as const,
 users: ['users'] as const,
 roles: ['roles'] as const,
 products: ['products'] as const,
 enquiries: ['enquiries'] as const,
 dashboard: ['dashboard'] as const,
 analytics: ['analytics'] as const,
 warehouseLocations: ['warehouse-locations'] as const,
 warehouseInventory: ['warehouse-inventory'] as const,
};
