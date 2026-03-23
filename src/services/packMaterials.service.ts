/**
 * Pack Materials API — list (optionally with search).
 * Backend: GET /api/v1/pack-materials?search=...
 */

import { api } from '../lib/apiClient';

export interface PackMaterialFromApi {
  id: string;
  code: string;
  description: string;
  type: string;
  level: string;
  group: string | null;
  material: string;
  size_spec: string;
  price_per_pc: number;
  moq: number;
  lead_time_days: number;
  print_status: string;
  products: string[];
  /** Primary info for Zoho sync (TODO: implement Zoho integration) */
  zoho_id?: string | null;
  sku?: string | null;
  hsn_code?: string | null;
  unit?: string | null;
  tax_pref?: string | null;
  sales_purchase_account?: string | null;
  pkg_returnable?: boolean | null;
  pkg_associate_items?: string | null;
  created_at?: string;
  updated_at?: string;
  /** Full form snapshot (create/update) — includes bulk quality specs for PM. */
  form_data?: Record<string, unknown> | null;
}

export interface PackMaterialRecord {
  id: string;
  code: string;
  description: string;
  type: string;
  level: string;
  group: string | null;
  material: string;
  sizeSpec: string;
  pricePerPc: number;
  moq: number;
  leadTimeDays: number;
  printStatus: string;
  products: string[];
  zohoId: string | null;
  sku: string | null;
  hsnCode: string | null;
  unit: string | null;
  taxPref: string | null;
  salesPurchaseAccount: string | null;
  pkgReturnable: boolean | null;
  pkgAssociateItems: string | null;
  form_data?: Record<string, unknown> | null;
}

export interface PaginatedRowsResponse<T> {
  rows: T[];
  total: number;
  limit: number;
  offset: number;
}

function mapApiToRecord(row: PackMaterialFromApi): PackMaterialRecord {
  return {
    id: row.id ?? '',
    code: row.code ?? '',
    description: row.description ?? '',
    type: row.type ?? '',
    level: row.level ?? '',
    group: row.group ?? null,
    material: row.material ?? '',
    sizeSpec: row.size_spec ?? '',
    pricePerPc: Number(row.price_per_pc) ?? 0,
    moq: Number(row.moq) ?? 0,
    leadTimeDays: Number(row.lead_time_days) ?? 0,
    printStatus: row.print_status ?? '',
    products: Array.isArray(row.products) ? row.products : [],
    zohoId: row.zoho_id ?? null,
    sku: row.sku ?? null,
    hsnCode: row.hsn_code ?? null,
    unit: row.unit ?? null,
    taxPref: row.tax_pref ?? null,
    salesPurchaseAccount: row.sales_purchase_account ?? null,
    pkgReturnable: row.pkg_returnable ?? null,
    pkgAssociateItems: row.pkg_associate_items ?? null,
    form_data: row.form_data ?? null,
  };
}

/**
 * Fetch pack materials list; optional search for filtering.
 */
export async function fetchPackMaterialsList(search?: string): Promise<PackMaterialRecord[]> {
  const params = new URLSearchParams();
  if (search != null && search.trim()) params.set('search', search.trim());
  const path = `/api/v1/pack-materials${params.toString() ? `?${params.toString()}` : ''}`;
  const list = await api.get<PackMaterialFromApi[]>(path);
  return (list ?? []).map(mapApiToRecord);
}

export async function fetchPackMaterialsPage(opts: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  rows: PackMaterialRecord[];
  total: number;
  limit: number;
  offset: number;
}> {
  const params = new URLSearchParams();
  if (opts.search != null && opts.search.trim()) params.set('search', opts.search.trim());
  params.set('limit', String(opts.limit ?? 20));
  params.set('offset', String(opts.offset ?? 0));

  const path = `/api/v1/pack-materials?${params.toString()}`;
  const resp = await api.get<PaginatedRowsResponse<PackMaterialFromApi>>(path);
  const rows = (resp?.rows ?? []).map(mapApiToRecord);
  return {
    rows,
    total: resp?.total ?? 0,
    limit: resp?.limit ?? (opts.limit ?? 20),
    offset: resp?.offset ?? (opts.offset ?? 0),
  };
}

/**
 * Get next code for a series prefix (e.g. EI-PM-PRI -> EI-PM-PRI-00001).
 * Backend counts existing codes with that prefix and returns next.
 */
export async function fetchNextPackMaterialCode(prefix: string): Promise<string> {
  const p = encodeURIComponent(prefix.trim());
  const res = await api.get<{ nextCode: string }>(`/api/v1/pack-materials/next-code?prefix=${p}`);
  return res?.nextCode ?? `${prefix}-00001`;
}

/** Payload for creating a pack material (camelCase; backend accepts snake_case too). */
export interface CreatePackMaterialPayload {
  code?: string;
  itemCode?: string;
  description?: string;
  name?: string;
  type?: string;
  itemCategory?: string;
  level?: string;
  group?: string;
  material?: string;
  matBody?: string;
  size_spec?: string;
  specNominal?: string;
  price_per_pc?: number;
  pricePerPc?: number;
  moq?: number;
  lead_time_days?: number;
  leadTimeDays?: number;
  print_status?: string;
  printStatus?: string;
  products?: string[];
  /** Primary info for Zoho sync (TODO: implement Zoho integration) */
  zohoId?: string | null;
  zoho_id?: string | null;
  sku?: string | null;
  hsnCode?: string | null;
  hsn_code?: string | null;
  pkgHsn?: string | null;
  unit?: string | null;
  pkgUnit?: string | null;
  taxPref?: string | null;
  tax_pref?: string | null;
  pkgTaxPreference?: string | null;
  salesPurchaseAccount?: string | null;
  sales_purchase_account?: string | null;
  pkgReturnable?: boolean | null;
  pkg_returnable?: boolean | null;
  pkgAssociateItems?: string | null;
  pkg_associate_items?: string | null;
  form_data?: Record<string, unknown> | null;
}

/**
 * Get pack material by id for edit.
 */
export async function fetchPackMaterialById(id: string): Promise<PackMaterialRecord | null> {
  try {
    const row = await api.get<PackMaterialFromApi>(`/api/v1/pack-materials/${id}`);
    return row ? mapApiToRecord(row) : null;
  } catch {
    return null;
  }
}

/**
 * Create pack material. Returns created record.
 */
export async function createPackMaterial(payload: CreatePackMaterialPayload): Promise<PackMaterialRecord> {
  const row = await api.post<PackMaterialFromApi>('/api/v1/pack-materials', payload);
  return mapApiToRecord(row);
}

/**
 * Update pack material by id.
 */
export async function updatePackMaterial(id: string, payload: CreatePackMaterialPayload): Promise<PackMaterialRecord> {
  const row = await api.put<PackMaterialFromApi>(`/api/v1/pack-materials/${id}`, payload);
  return mapApiToRecord(row);
}

/**
 * Delete pack material by id.
 */
export async function deletePackMaterial(id: string): Promise<void> {
  try {
    await api.delete(`/api/v1/pack-materials/${id}`);
  } catch (e) {
    const body = (e as Error & { body?: unknown }).body;
    const msg =
      body && typeof body === 'object' && 'error' in body && typeof (body as any).error === 'string'
        ? (body as any).error
        : e instanceof Error
          ? e.message
          : 'Failed to delete pack material';
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
 * Fetch actual | reserved | available stock for a pack material.
 */
export async function fetchReservedStock(id: string): Promise<ReservedStockResponse> {
  return api.get<ReservedStockResponse>(`/api/v1/pack-materials/${id}/reserved-stock`);
}
