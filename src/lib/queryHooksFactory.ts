/**
 * Reusable factories for TanStack Query hooks. Add to any module with minimal code.
 *
 * Usage:
 *   // List query (cached list)
 *   export const useRolesList = createListQuery(queryKeys.roles, roleService.listRoles, { staleTime: 2 * 60 * 1000 });
 *
 *   // Detail query (by id)
 *   export const useRole = (id: string | null) =>
 *     createDetailQuery(queryKeys.role, id, () => roleService.getRoleById(id!), { enabled: !!id });
 *
 *   // Mutation with cache invalidation
 *   export const useCreateRole = () =>
 *     createMutation(roleService.createRole, [queryKeys.roles]);
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';

type ServiceResult<T> = { data: T; error: null; success: true } | { data: null; error: unknown; success: false };

function unwrap<T>(r: T | ServiceResult<T>): T {
  if (r != null && typeof r === 'object' && 'success' in r) {
    const sr = r as ServiceResult<T>;
    if (!sr.success) throw new Error(String(sr.error ?? 'Request failed'));
    return sr.data as T;
  }
  return r as T;
}

/**
 * Create a useQuery hook for a list endpoint. Handles ServiceResult<T> or raw T.
 */
export function createListQuery<T>(
  queryKey: readonly string[],
  fetchFn: () => Promise<T | ServiceResult<T>>,
  options: { staleTime?: number; gcTime?: number; enabled?: boolean } = {},
) {
  const staleTime = options.staleTime ?? 2 * 60 * 1000;
  return function useListQuery() {
    return useQuery({
      queryKey: [...queryKey],
      queryFn: async () => unwrap(await fetchFn()),
      staleTime,
      gcTime: options.gcTime,
      enabled: options.enabled ?? true,
    });
  };
}

/**
 * Create a useQuery hook for a list endpoint that depends on params (e.g. search, type).
 * Returns a hook that takes those params; query key includes them for separate cache entries.
 */
export function createListQueryWithParams<T, P>(
  getQueryKey: (params: P) => QueryKey,
  fetchFn: (params: P) => Promise<T | ServiceResult<T>>,
  options: { staleTime?: number } = {},
) {
  const staleTime = options.staleTime ?? 2 * 60 * 1000;
  return function useListQueryWithParams(params: P) {
    return useQuery({
      queryKey: getQueryKey(params),
      queryFn: async () => unwrap(await fetchFn(params)),
      staleTime,
    });
  };
}

/**
 * Create a useQuery hook for a detail-by-id endpoint.
 */
export function createDetailQuery<T>(
  getQueryKey: (id: string) => readonly string[],
  id: string | null,
  fetchFn: () => Promise<T | ServiceResult<T> | null>,
  options: { staleTime?: number; enabled?: boolean } = {},
) {
  const staleTime = options.staleTime ?? 2 * 60 * 1000;
  return useQuery({
    queryKey: getQueryKey(id ?? ''),
    queryFn: async () => {
      const r = await fetchFn();
      if (r == null) return null;
      return unwrap(r);
    },
    enabled: (options.enabled !== false) && !!id,
    staleTime,
  });
}

/**
 * Create a useMutation hook that invalidates given query keys on success.
 * invalidateKeys: static array of query keys, or function (data, variables) => QueryKey[].
 */
export function createMutation<TData = unknown, TVariables = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  invalidateKeys: QueryKey[] | ((data: TData, variables: TVariables) => QueryKey[]),
  options: Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn'> = {},
) {
  return function useMutationHook() {
    const queryClient = useQueryClient();
    return useMutation({
      ...options,
      mutationFn,
      onSuccess: (data, variables, context) => {
        const keys = typeof invalidateKeys === 'function' ? invalidateKeys(data, variables) : invalidateKeys;
        keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
        options.onSuccess?.(data, variables, context);
      },
    });
  };
}
