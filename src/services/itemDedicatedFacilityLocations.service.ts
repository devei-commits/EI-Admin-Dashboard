import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';
import type { MRNLineItemFromApi } from './mrn.service';

const BASE = '/api/v1/item-dedicated-facility-locations';

export interface ItemDedicatedRowDTO {
  id: number;
  itemKey: string;
  rawMaterialId: number | null;
  packMaterialId: number | null;
  productId: number | null;
  whLocationId: number | null;
  whRackId: number | null;
  prodLocationId: number | null;
  prodRackId: number | null;
  whZoneCode: string | null;
  whRackCode: string | null;
  prodZoneCode: string | null;
  prodRackCode: string | null;
}

export interface UpsertItemDedicatedPayload {
  itemType: 'rm' | 'pm' | 'product';
  itemId: number;
  whLocationId?: number | null;
  whRackId?: number | null;
  prodLocationId?: number | null;
  prodRackId?: number | null;
}

export interface ResolveDedicatedMrnResult {
  prodZoneCode: string | null;
  prodRackCode: string | null;
  prodOk: boolean;
  whZoneCode: string | null;
  whRackCode: string | null;
  whOk: boolean;
}

function extractList<T>(res: unknown): T[] {
  const d = (res as { data?: T[] })?.data ?? res;
  return Array.isArray(d) ? d : [];
}

function extractOne<T>(res: unknown): T {
  return ((res as { data?: T })?.data ?? res) as T;
}

export async function fetchItemDedicatedList(): Promise<ServiceResult<ItemDedicatedRowDTO[]>> {
  try {
    const res = await api.get<ItemDedicatedRowDTO[]>(BASE);
    return { data: extractList<ItemDedicatedRowDTO>(res), error: null, success: true };
  } catch (e) {
    return {
      data: [],
      error: e instanceof Error ? e.message : 'Failed to load item locations',
      success: false,
    };
  }
}

export async function upsertItemDedicated(
  payload: UpsertItemDedicatedPayload
): Promise<ServiceResult<ItemDedicatedRowDTO>> {
  try {
    const res = await api.post<ItemDedicatedRowDTO>(`${BASE}/upsert`, payload);
    return { data: extractOne<ItemDedicatedRowDTO>(res), error: null, success: true };
  } catch (e) {
    return {
      data: null as unknown as ItemDedicatedRowDTO,
      error: e instanceof Error ? e.message : 'Failed to save',
      success: false,
    };
  }
}

export async function deleteItemDedicated(id: number): Promise<ServiceResult<null>> {
  try {
    await api.delete(`${BASE}/${id}`);
    return { data: null, error: null, success: true };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to delete', success: false };
  }
}

export async function resolveItemDedicatedForMrn(
  lineItems: MRNLineItemFromApi[]
): Promise<ServiceResult<ResolveDedicatedMrnResult>> {
  try {
    const res = await api.post<ResolveDedicatedMrnResult>(`${BASE}/resolve`, { lineItems });
    return { data: extractOne<ResolveDedicatedMrnResult>(res), error: null, success: true };
  } catch (e) {
    return {
      data: null as unknown as ResolveDedicatedMrnResult,
      error: e instanceof Error ? e.message : 'Failed to resolve',
      success: false,
    };
  }
}
