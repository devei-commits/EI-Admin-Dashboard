/**
 * TanStack Query hooks for MRN (Material Request Note) — list and update with cache invalidation.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import {
  fetchMRNList,
  updateMRN,
  type MRNRecordFromApi,
  type UpdateMRNPayload,
} from '../services/mrn.service';

export function useMRNList() {
  return useQuery({
    queryKey: queryKeys.mrnList,
    queryFn: () => fetchMRNList(),
    staleTime: 1 * 60 * 1000,
  });
}

export function useUpdateMRN() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateMRNPayload }) => updateMRN(id, payload),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mrnList });
      queryClient.invalidateQueries({ queryKey: queryKeys.mrn(id) });
    },
  });
}
