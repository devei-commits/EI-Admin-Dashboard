/**
 * TanStack Query hook for warehouse locations (list with racks and stored items).
 */
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { fetchWarehouseLocations, type WarehouseLocationDTO } from '../services/warehouseLocations.service';

async function queryFn(): Promise<WarehouseLocationDTO[]> {
  const result = await fetchWarehouseLocations();
  if (!result.success || result.data == null) {
    throw new Error(result.error as string || 'Failed to load warehouse locations');
  }
  return result.data;
}

export function useWarehouseLocations() {
  return useQuery({
    queryKey: queryKeys.warehouseLocations,
    queryFn,
    staleTime: 30 * 1000, // 30s so rack/slot data feels up to date
    refetchOnWindowFocus: false, // prevent repeated refresh/polling
  });
}
