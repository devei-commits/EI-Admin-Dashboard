import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 2,
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
};
