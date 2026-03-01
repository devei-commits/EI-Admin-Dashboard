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
