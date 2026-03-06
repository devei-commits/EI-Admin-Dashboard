/**
 * Warehouse Locations & Rack Management — list locations with nested racks and stored items.
 */

import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';

export interface StoredItemSummary {
  warehouseInventoryId: number;
  code: string;
  name: string;
  type: 'RM' | 'PM' | 'FG/PR';
}

export interface WarehouseRackDTO {
  id: number;
  locationId: number;
  code: string;
  name: string;
  description: string | null;
  levels: number;
  slotsTotal: number;
  utilisationPct: number;
  storedItems: StoredItemSummary[];
  itemsStoredCount: number;
}

export interface WarehouseLocationDTO {
  id: number;
  code: string;
  name: string;
  zoneLabel: string | null;
  icon: string | null;
  areaSqm: number | null;
  description: string | null;
  utilisationPct: number;
  racks: WarehouseRackDTO[];
}

export async function fetchWarehouseLocations(): Promise<
  ServiceResult<WarehouseLocationDTO[]>
> {
  try {
    const res = await api.get<WarehouseLocationDTO[]>('/api/v1/warehouse-locations');
    const data = res?.data ?? res;
    const list = Array.isArray(data) ? data : [];
    return { data: list, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load warehouse locations';
    return { data: [], error: message, success: false };
  }
}
