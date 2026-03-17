/**
 * Raw Materials API — list and get by id with optional search.
 * Backend: GET /api/v1/raw-materials?search=... , GET /api/v1/raw-materials/:id
 */

import { api } from '../lib/apiClient';

export interface RawMaterialFromApi {
  id: string;
  code: string;
  name: string;
  inci: string;
  category: string;
  rm_type: string;
  uom: string;
  price_per_kg: number;
  gst: number;
  shelf: string;
  status: string;
  products: string[];
  group: string | null;
  /** Primary info for Zoho sync (TODO: implement Zoho integration) */
  zoho_id?: string | null;
  sku?: string | null;
  hsn_code?: string | null;
  tax_pref?: string | null;
  sales_purchase_account?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RawMaterialRecord {
  id: string;
  code: string;
  name: string;
  inci: string;
  category: string;
  rmType: string;
  uom: string;
  pricePerKg: number;
  gst: number;
  shelf: string;
  status: string;
  products: string[];
  group: string | null;
  zohoId: string | null;
  sku: string | null;
  hsnCode: string | null;
  taxPref: string | null;
  salesPurchaseAccount: string | null;
}

function mapApiToRecord(row: RawMaterialFromApi): RawMaterialRecord {
  return {
    id: row.id ?? '',
    code: row.code ?? '',
    name: row.name ?? '',
    inci: row.inci ?? '',
    category: row.category ?? '',
    rmType: row.rm_type ?? '',
    uom: row.uom ?? '',
    pricePerKg: row.price_per_kg != null ? Number(row.price_per_kg) : 0,
    gst: row.gst != null ? Number(row.gst) : 0,
    shelf: row.shelf ?? '',
    status: row.status ?? '',
    products: Array.isArray(row.products) ? row.products : [],
    group: row.group || null,
    zohoId: row.zoho_id ?? null,
    sku: row.sku ?? null,
    hsnCode: row.hsn_code ?? null,
    taxPref: row.tax_pref ?? null,
    salesPurchaseAccount: row.sales_purchase_account ?? null,
  };
}

/**
 * Fetch raw materials list; optional search for filtering.
 */
export async function fetchRawMaterialsList(search?: string): Promise<RawMaterialRecord[]> {
  const params = new URLSearchParams();
  if (search != null && search.trim()) params.set('search', search.trim());
  const path = `/api/v1/raw-materials${params.toString() ? `?${params.toString()}` : ''}`;
  const list = await api.get<RawMaterialFromApi[]>(path);
  return (list ?? []).map(mapApiToRecord);
}

/** API response for get-by-id includes form_data for edit. */
export interface RawMaterialFullFromApi extends RawMaterialFromApi {
  form_data?: Record<string, unknown> | null;
}

/**
 * Fetch a single raw material by id (includes form_data for edit).
 */
export async function fetchRawMaterialById(id: string): Promise<{ record: RawMaterialRecord; form_data: Record<string, unknown> | null } | null> {
  try {
    const row = await api.get<RawMaterialFullFromApi>(`/api/v1/raw-materials/${id}`);
    if (!row) return null;
    return { record: mapApiToRecord(row), form_data: row.form_data ?? null };
  } catch {
    return null;
  }
}

/** Full form payload for create/update (matches formData shape). */
export type RawMaterialFormPayload = Record<string, unknown>;

/**
 * Create raw material. Body: full form payload (formData).
 */
export async function createRawMaterial(payload: RawMaterialFormPayload): Promise<RawMaterialRecord> {
  const row = await api.post<RawMaterialFromApi>('/api/v1/raw-materials', payload);
  return mapApiToRecord(row);
}

/**
 * Update raw material by id.
 */
export async function updateRawMaterial(id: string, payload: RawMaterialFormPayload): Promise<RawMaterialRecord> {
  const row = await api.put<RawMaterialFromApi>(`/api/v1/raw-materials/${id}`, payload);
  return mapApiToRecord(row);
}

/**
 * Delete raw material by id.
 */
export async function deleteRawMaterial(id: string): Promise<void> {
  await api.delete(`/api/v1/raw-materials/${id}`);
}

/** Reserved stock response: actual (SIH), reserved (for SO/batches), available = actual - reserved. */
export interface ReservedStockResponse {
  actual: number;
  reserved: number;
  available: number;
  unit: string;
}

/**
 * Fetch actual | reserved | available stock for a raw material.
 */
export async function fetchReservedStock(id: string): Promise<ReservedStockResponse> {
  return api.get<ReservedStockResponse>(`/api/v1/raw-materials/${id}/reserved-stock`);
}
