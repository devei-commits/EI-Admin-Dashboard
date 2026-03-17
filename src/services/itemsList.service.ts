/**
 * Items List API — vendor-specific pricing tiers, rates, MOQ breakpoints.
 * Backend: /api/v1/items-list (CRUD) + /:id/rates, /:id/rates/:rateId/tiers
 */

import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';

export interface ItemListRecord {
  id: string;
  code: string;
  name: string;
  type: 'RM' | 'PM';
  category: string;
  pricePerUnit: number;
  uom: string;
  gst: number;
  status: string;
  vendors: number;
  tiers: number;
  lastUpdated: string;
  raw_material_id?: number | null;
  pack_material_id?: number | null;
}

export interface ItemListTierRow {
  id: number;
  moq_min: number;
  moq_max: number | null;
  price_per_unit: number;
  valid_till?: string | null;
  note?: string | null;
}

export interface ItemListVendorRateRow {
  id: number;
  vendor_id: number;
  vendor_name: string | null;
  vendor_code: string | null;
  default_rate: number | null;
  default_moq: number | null;
  currency: string;
  status: string;
  tiers: ItemListTierRow[];
}

export interface ItemListDetailRecord extends ItemListRecord {
  vendorRates: ItemListVendorRateRow[];
}

export interface CreateItemListPayload {
  type: 'RM' | 'PM' | 'PR';
  raw_material_id?: number | null;
  pack_material_id?: number | null;
  product_id?: number | null;
  status?: string;
}

export interface CreateRatePayload {
  vendor_id: number;
  default_rate?: number | null;
  default_moq?: number | null;
  currency?: string;
  payment_terms?: string | null;
}

export interface CreateTierPayload {
  moq_min: number;
  moq_max?: number | null;
  price_per_unit: number;
  valid_till?: string | null;
  note?: string | null;
}

/** Page item: RM/PM/PR from masters with optional vendorRates (for Price Lists view). */
export interface PriceListItemPage {
  code: string;
  name: string;
  type: 'RM' | 'PM' | 'PR';
  uom?: string;
  gst?: number;
  pricePerUnit: number;
  pack_type?: string;
  level?: string;
  moq?: number;
  raw_material_id?: number | null;
  pack_material_id?: number | null;
  product_id?: number | null;
  itemsListId: number | null;
  vendorRates: Array<{
    id: number;
    vendor_id: number;
    vendor_name: string | null;
    vendor_code: string | null;
    currency: string;
    payment_terms?: string | null;
    tiers: ItemListTierRow[];
  }>;
}

export async function fetchItemsList(type?: 'RM' | 'PM'): Promise<ServiceResult<ItemListRecord[]>> {
  try {
    const qs = type ? `?type=${encodeURIComponent(type)}` : '';
    const list = await api.get<ItemListRecord[]>(`/api/v1/items-list${qs}`);
    return { data: list ?? [], error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load items list';
    return { data: [], error: { code: 'ERROR', message, timestamp: new Date().toISOString() }, success: false };
  }
}

export async function fetchPriceListPage(type: 'RM' | 'PM' | 'PR'): Promise<ServiceResult<PriceListItemPage[]>> {
  try {
    const list = await api.get<PriceListItemPage[]>(`/api/v1/items-list/page?type=${encodeURIComponent(type)}`);
    return { data: list ?? [], error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load price list page';
    return { data: [], error: { code: 'ERROR', message, timestamp: new Date().toISOString() }, success: false };
  }
}

export async function fetchItemListById(id: string): Promise<ServiceResult<ItemListDetailRecord>> {
  try {
    const row = await api.get<ItemListDetailRecord>(`/api/v1/items-list/${id}`);
    return { data: row ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load item';
    return { data: null, error: { code: 'ERROR', message, timestamp: new Date().toISOString() }, success: false };
  }
}

export async function createItemList(payload: CreateItemListPayload): Promise<ServiceResult<ItemListRecord>> {
  try {
    const body = {
      type: payload.type,
      raw_material_id: payload.raw_material_id ?? null,
      pack_material_id: payload.pack_material_id ?? null,
      product_id: payload.product_id ?? null,
      status: payload.status ?? 'Active',
    };
    const row = await api.post<ItemListRecord>('/api/v1/items-list', body);
    return { data: row ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create item';
    return { data: null, error: { code: 'ERROR', message, timestamp: new Date().toISOString() }, success: false };
  }
}

export async function updateItemList(id: string, payload: { status?: string }): Promise<ServiceResult<ItemListRecord>> {
  try {
    const row = await api.put<ItemListRecord>(`/api/v1/items-list/${id}`, payload);
    return { data: row ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update item';
    return { data: null, error: { code: 'ERROR', message, timestamp: new Date().toISOString() }, success: false };
  }
}

export async function deleteItemList(id: string): Promise<ServiceResult<null>> {
  try {
    await api.delete(`/api/v1/items-list/${id}`);
    return { data: null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to delete item';
    return { data: null, error: { code: 'ERROR', message, timestamp: new Date().toISOString() }, success: false };
  }
}

export async function fetchItemListRates(id: string): Promise<ServiceResult<ItemListVendorRateRow[]>> {
  try {
    const list = await api.get<ItemListVendorRateRow[]>(`/api/v1/items-list/${id}/rates`);
    return { data: list ?? [], error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load rates';
    return { data: [], error: { code: 'ERROR', message, timestamp: new Date().toISOString() }, success: false };
  }
}

export async function createItemListRate(
  itemId: string,
  payload: CreateRatePayload
): Promise<ServiceResult<ItemListVendorRateRow>> {
  try {
    const row = await api.post<ItemListVendorRateRow>(`/api/v1/items-list/${itemId}/rates`, payload);
    return { data: row ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create rate';
    return { data: null, error: { code: 'ERROR', message, timestamp: new Date().toISOString() }, success: false };
  }
}

export async function updateItemListRate(
  itemId: string,
  rateId: number,
  payload: Partial<CreateRatePayload> & { status?: string }
): Promise<ServiceResult<ItemListVendorRateRow>> {
  try {
    const row = await api.put<ItemListVendorRateRow>(`/api/v1/items-list/${itemId}/rates/${rateId}`, payload);
    return { data: row ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update rate';
    return { data: null, error: { code: 'ERROR', message, timestamp: new Date().toISOString() }, success: false };
  }
}

export async function deleteItemListRate(itemId: string, rateId: number): Promise<ServiceResult<null>> {
  try {
    await api.delete(`/api/v1/items-list/${itemId}/rates/${rateId}`);
    return { data: null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to delete rate';
    return { data: null, error: { code: 'ERROR', message, timestamp: new Date().toISOString() }, success: false };
  }
}

export async function createItemListTier(
  itemId: string,
  rateId: number,
  payload: CreateTierPayload
): Promise<ServiceResult<ItemListTierRow>> {
  try {
    const row = await api.post<ItemListTierRow>(
      `/api/v1/items-list/${itemId}/rates/${rateId}/tiers`,
      payload
    );
    return { data: row ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create tier';
    return { data: null, error: { code: 'ERROR', message, timestamp: new Date().toISOString() }, success: false };
  }
}

export async function updateItemListTier(
  itemId: string,
  rateId: number,
  tierId: number,
  payload: Partial<CreateTierPayload>
): Promise<ServiceResult<ItemListTierRow>> {
  try {
    const row = await api.put<ItemListTierRow>(
      `/api/v1/items-list/${itemId}/rates/${rateId}/tiers/${tierId}`,
      payload
    );
    return { data: row ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update tier';
    return { data: null, error: { code: 'ERROR', message, timestamp: new Date().toISOString() }, success: false };
  }
}

export async function deleteItemListTier(
  itemId: string,
  rateId: number,
  tierId: number
): Promise<ServiceResult<null>> {
  try {
    await api.delete(`/api/v1/items-list/${itemId}/rates/${rateId}/tiers/${tierId}`);
    return { data: null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to delete tier';
    return { data: null, error: { code: 'ERROR', message, timestamp: new Date().toISOString() }, success: false };
  }
}
