/**
 * TanStack Query hooks for BOM — list (with optional search) and by id.
 */
import { queryKeys } from '../lib/queryClient';
import { createListQueryWithParams, createDetailQuery, createMutation } from '../lib/queryHooksFactory';
import * as bomService from '../services/bom.service';

export const useBOMList = createListQueryWithParams<bomService.BOMRecord[], { search?: string }>(
  (params) => [...queryKeys.bom, params.search ?? 'all'],
  (params) => bomService.fetchBOMs(params.search),
  { staleTime: 2 * 60 * 1000 },
);

export function useBOM(id: string | null) {
  return createDetailQuery(
    (bid) => queryKeys.bomDetail(bid),
    id,
    () => (id ? bomService.fetchBOMById(id) : Promise.resolve(null)),
    { enabled: !!id },
  );
}

export const useCreateBOM = createMutation(bomService.createBOM, [queryKeys.bom]);
