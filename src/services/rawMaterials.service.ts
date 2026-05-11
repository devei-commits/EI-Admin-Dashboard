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
  lead_time_days?: number | null;
  status: string;
  products: string[];
  group: string | null;
  /** Zoho Books item id after create sync (when enabled) */
  zoho_id?: string | null;
  /** Present when Zoho Books item sync ran on create */
  zoho_sync?: { synced: boolean; item_id?: string; error?: string };
  /** Zoho-mirrored SKU code (RM/PM/PR all share this column name as of May 2026). */
  zoho_sku_code?: string | null;
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
  leadTimeDays: number | null;
  status: string;
  products: string[];
  group: string | null;
  zohoId: string | null;
  zohoSkuCode: string | null;
  hsnCode: string | null;
  taxPref: string | null;
  salesPurchaseAccount: string | null;
}

export interface PaginatedRowsResponse<T> {
  rows: T[];
  total: number;
  limit: number;
  offset: number;
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
    leadTimeDays: row.lead_time_days != null ? Number(row.lead_time_days) : null,
    status: row.status ?? '',
    products: Array.isArray(row.products) ? row.products : [],
    group: row.group || null,
    zohoId: row.zoho_id ?? null,
    zohoSkuCode: row.zoho_sku_code ?? null,
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

export async function fetchRawMaterialsPage(opts: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  rows: RawMaterialRecord[];
  total: number;
  limit: number;
  offset: number;
}> {
  const params = new URLSearchParams();
  if (opts.search != null && opts.search.trim()) params.set('search', opts.search.trim());
  params.set('limit', String(opts.limit ?? 20));
  params.set('offset', String(opts.offset ?? 0));

  const path = `/api/v1/raw-materials?${params.toString()}`;
  const resp = await api.get<PaginatedRowsResponse<RawMaterialFromApi>>(path);
  const rows = (resp?.rows ?? []).map(mapApiToRecord);
  return {
    rows,
    total: resp?.total ?? 0,
    limit: resp?.limit ?? (opts.limit ?? 20),
    offset: resp?.offset ?? (opts.offset ?? 0),
  };
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

export interface RawMaterialCreateResult {
  record: RawMaterialRecord;
  /** Set when backend reports Zoho Books sync outcome on create */
  zohoSync?: RawMaterialFromApi['zoho_sync'];
}

/** Next RM code: numeric only (e.g. 00001), global sequence for raw_materials.code. */
export async function fetchNextRawMaterialCode(): Promise<string> {
  const res = await api.get<{ nextCode: string }>('/api/v1/raw-materials/next-code');
  return res?.nextCode ?? '00001';
}

export interface RmZohoSyncResponse {
  raw_material_id: number;
  zoho_id: string | null;
  zoho_sync:
    | { synced: true }
    | { synced: false; skipped?: boolean; resolvedWithoutZoho?: boolean; reason?: string; error?: string };
}

/** Draft RM + Zoho item (wizard before full submit). POST /api/v1/raw-materials/zoho-sync */
export async function syncRmZoho(payload: RawMaterialFormPayload): Promise<{ data: RmZohoSyncResponse | null; error: string | null; success: boolean }> {
  try {
    const data = await api.post<RmZohoSyncResponse>('/api/v1/raw-materials/zoho-sync', payload);
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Zoho sync failed';
    return { data: null, error: message, success: false };
  }
}

/**
 * Create raw material. Body: full form payload (formData).
 * Pass `raw_material_id` when completing a draft created via syncRmZoho.
 * When Zoho Books is enabled, the backend creates a Zoho item and sets `zoho_id` when sync succeeds.
 */
export async function createRawMaterial(payload: RawMaterialFormPayload): Promise<RawMaterialCreateResult> {
  const row = await api.post<RawMaterialFromApi>('/api/v1/raw-materials', payload);
  return { record: mapApiToRecord(row), zohoSync: row.zoho_sync };
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
  try {
    await api.delete(`/api/v1/raw-materials/${id}`);
  } catch (e) {
    const body = (e as Error & { body?: unknown }).body;
    const msg =
      body && typeof body === 'object' && 'error' in body && typeof (body as any).error === 'string'
        ? (body as any).error
        : e instanceof Error
          ? e.message
          : 'Failed to delete raw material';
    throw new Error(msg);
  }
}

/** Delete every raw material and scrub dependent DB rows (destructive). Requires typed confirmation on the server. */
export async function resetAllRawMaterialsMaster(): Promise<{ deletedRawMaterials: number }> {
  try {
    const res = await api.post<{ ok?: boolean; deletedRawMaterials?: number; message?: string }>(
      '/api/v1/raw-materials/reset-all',
      { confirm: 'RESET_ALL_RAW_MATERIALS' }
    );
    return { deletedRawMaterials: res?.deletedRawMaterials ?? 0 };
  } catch (e) {
    const body = (e as Error & { body?: unknown }).body;
    const msg =
      body && typeof body === 'object' && 'error' in body && typeof (body as { error?: string }).error === 'string'
        ? String((body as { error: string }).error)
        : e instanceof Error
          ? e.message
          : 'Failed to reset raw materials';
    throw new Error(msg);
  }
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

/** Same workbook sheet as pack materials — POST /api/v1/raw-materials/item-reference-bulk-chunk */
export interface ItemReferenceBulkChunkRow {
  excel_row: number;
  line_type: 'Packaging' | 'Raw Material';
  zoho_sku_code: string;
  description: string;
  /** Multi-worksheet RM template (tabs: Raw Materials, Fragrances, Colors & Pigments, Club Items). */
  import_profile?: 'rm_multi_sheet';
  sheet_name?: string;
  category?: string;
  sub_category?: string;
  uom?: string;
  hsn_code?: string;
  gst_pct?: string | number;
  purchase_rate_inr?: string | number;
  inci_name?: string;
}

export interface ItemReferenceBulkChunkResponse {
  chunk_index: number;
  chunk_total: number;
  percent_complete: number;
  summary: {
    packaging_created: number;
    packaging_updated: number;
    raw_material_created: number;
    raw_material_updated: number;
    skipped: number;
    errors: number;
  };
  row_log?: unknown[];
}

export async function postItemReferenceBulkChunk(payload: {
  rows: ItemReferenceBulkChunkRow[];
  chunk_index: number;
  chunk_total: number;
  details?: boolean;
}): Promise<ItemReferenceBulkChunkResponse> {
  return api.post<ItemReferenceBulkChunkResponse>('/api/v1/raw-materials/item-reference-bulk-chunk', payload);
}

/** Server parses workbook with exceljs; multipart field must be `file`. */
export interface RmMasterExcelImportResponse {
  ok: boolean;
  format?: string;
  packaging_rows_skipped?: number;
  /** Server parses full workbook then upserts in batches of chunk_size. */
  rows_total?: number;
  chunk_size?: number;
  chunks_processed?: number;
  summary: {
    raw_material_created: number;
    raw_material_updated: number;
    skipped: number;
    errors: number;
  };
  row_log?: unknown[];
}

export async function postRawMaterialsMasterExcel(file: File): Promise<RmMasterExcelImportResponse> {
  const fd = new FormData();
  fd.append('file', file);
  return api.post<RmMasterExcelImportResponse>('/api/v1/raw-materials/import-excel', fd);
}
