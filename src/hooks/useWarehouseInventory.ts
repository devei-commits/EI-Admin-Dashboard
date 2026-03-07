/**
 * TanStack Query hooks for warehouse inventory — list (cached) and update stock (mutation + invalidation).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import {
  fetchWarehouseInventory,
  updateWarehouseStock,
  type UpdateWarehouseStockPayload,
  type WarehouseInventoryRow,
} from '../services/warehouseInventory.service';
import type { ItemGroupRecord } from '../services/itemGroups.service';

export interface WarehouseInventoryData {
  rows: WarehouseInventoryRow[];
  itemGroups: ItemGroupRecord[];
}

async function queryFn(): Promise<WarehouseInventoryData> {
  const result = await fetchWarehouseInventory();
  if (!result.success || !result.data) {
    throw new Error(result.error as string || 'Failed to load warehouse inventory');
  }
  return result.data;
}

export function useWarehouseInventory() {
  return useQuery({
    queryKey: queryKeys.warehouseInventory,
    queryFn,
    staleTime: 2 * 60 * 1000,
  });
}

export function useUpdateWarehouseStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateWarehouseStockPayload }) =>
      updateWarehouseStock(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouseInventory });
    },
  });
}
