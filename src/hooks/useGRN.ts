/**
 * TanStack Query hooks for GRN (Goods Received Note) — list, by id, and mutations with cache invalidation.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import {
  fetchGRNList,
  fetchGRNById,
  updateGRN,
  createGRN,
  deleteGRN,
  type CreateGRNPayload,
  type UpdateGRNPayload,
} from '../services/grn.service';

export function useGRNList() {
  return useQuery({
    queryKey: queryKeys.grnList,
    queryFn: () => fetchGRNList(),
    staleTime: 1 * 60 * 1000,
  });
}

export function useGRN(id: string | null) {
  return useQuery({
    queryKey: queryKeys.grn(id ?? ''),
    queryFn: () => fetchGRNById(id!),
    enabled: !!id,
    staleTime: 1 * 60 * 1000,
  });
}

export function useUpdateGRN() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateGRNPayload }) => updateGRN(id, payload),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.grnList });
      queryClient.invalidateQueries({ queryKey: queryKeys.grn(id) });
    },
  });
}

export function useCreateGRN() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateGRNPayload) => createGRN(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.grnList });
    },
  });
}

export function useDeleteGRN() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteGRN(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.grnList });
    },
  });
}
