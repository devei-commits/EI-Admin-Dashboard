/**
 * Items Master API — products with multiple linked BOMs, Raw Materials, Pack Materials.
 * Backend: GET/POST /api/v1/items-master, GET/PUT/DELETE /api/v1/items-master/:id
 */

import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';

export interface ItemMasterLinkedItem {
  id: number;
  code: string;
  name?: string;
  description?: string;
}

export interface ItemMasterLinked {
  boms: ItemMasterLinkedItem[];
  packMaterials: ItemMasterLinkedItem[];
  rawMaterials: ItemMasterLinkedItem[];
}

export interface ItemMasterRecord {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
  bomIds: number[];
  rawMaterialIds: number[];
  packMaterialIds: number[];
  createdAt: string;
  updatedAt: string;
  linked?: ItemMasterLinked;
}

export interface CreateItemMasterPayload {
  code: string;
  name?: string;
  type?: string;
  status?: string;
  bomIds?: number[];
  packMaterialIds?: number[];
  rawMaterialIds?: number[];
}

export async function fetchItemsMaster(search?: string, type?: string, rawMaterialId?: string | number): Promise<ServiceResult<ItemMasterRecord[]>> {
  try {
    const params = new URLSearchParams();
    if (search != null && search.trim()) params.set('search', search.trim());
    if (type != null && type.trim()) params.set('type', type.trim());
    if (rawMaterialId != null && String(rawMaterialId).trim()) params.set('rawMaterialId', String(rawMaterialId).trim());
    const qs = params.toString();
    const list = await api.get<ItemMasterRecord[]>(`/api/v1/items-master${qs ? `?${qs}` : ''}`);
    return { data: list ?? [], error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load items master';
    return { data: [], error: message, success: false };
  }
}

export async function fetchItemMasterById(id: string): Promise<ServiceResult<ItemMasterRecord>> {
  try {
    const row = await api.get<ItemMasterRecord>(`/api/v1/items-master/${id}`);
    return { data: row ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load item';
    return { data: null, error: message, success: false };
  }
}

export async function createItemMaster(payload: CreateItemMasterPayload): Promise<ServiceResult<ItemMasterRecord>> {
  try {
    const body = {
      code: payload.code,
      name: payload.name,
      type: payload.type ?? 'product',
      status: payload.status ?? 'Active',
      bomIds: payload.bomIds ?? [],
      packMaterialIds: payload.packMaterialIds ?? [],
      rawMaterialIds: payload.rawMaterialIds ?? [],
    };
    const row = await api.post<ItemMasterRecord>('/api/v1/items-master', body);
    return { data: row ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create item';
    return { data: null, error: message, success: false };
  }
}

export async function updateItemMaster(id: string, payload: Partial<CreateItemMasterPayload>): Promise<ServiceResult<ItemMasterRecord>> {
  try {
    const row = await api.put<ItemMasterRecord>(`/api/v1/items-master/${id}`, payload);
    return { data: row ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update item';
    return { data: null, error: message, success: false };
  }
}

export async function deleteItemMaster(id: string): Promise<ServiceResult<null>> {
  try {
    await api.delete(`/api/v1/items-master/${id}`);
    return { data: null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to delete item';
    return { data: null, error: message, success: false };
  }
}
