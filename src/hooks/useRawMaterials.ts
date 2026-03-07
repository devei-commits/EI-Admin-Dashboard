/**
 * TanStack Query hooks for raw materials — list (with optional search) and by id.
 */
import { queryKeys } from '../lib/queryClient';
import { createListQueryWithParams, createDetailQuery, createMutation } from '../lib/queryHooksFactory';
import * as rawMaterialsService from '../services/rawMaterials.service';

export const useRawMaterialsList = createListQueryWithParams<
  rawMaterialsService.RawMaterialRecord[],
  { search?: string }
>(
  (params) => [...queryKeys.rawMaterials, params.search ?? 'all'],
  (params) => rawMaterialsService.fetchRawMaterialsList(params.search),
  { staleTime: 2 * 60 * 1000 },
);

export function useRawMaterial(id: string | null) {
  return createDetailQuery(
    (rid) => queryKeys.rawMaterial(rid),
    id,
    () => (id ? rawMaterialsService.fetchRawMaterialById(id) : Promise.resolve(null)),
    { enabled: !!id },
  );
}

export const useCreateRawMaterial = createMutation(rawMaterialsService.createRawMaterial, [
  queryKeys.rawMaterials,
]);
export const useUpdateRawMaterial = createMutation(
  ({ id, payload }: { id: string; payload: rawMaterialsService.RawMaterialFormPayload }) =>
    rawMaterialsService.updateRawMaterial(id, payload),
  (_, { id }) => [queryKeys.rawMaterials, queryKeys.rawMaterial(id)],
);
export const useDeleteRawMaterial = createMutation(rawMaterialsService.deleteRawMaterial, [
  queryKeys.rawMaterials,
]);
