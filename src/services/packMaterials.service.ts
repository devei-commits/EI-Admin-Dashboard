/**
 * Pack Materials API — list (optionally with search).
 * Backend: GET /api/v1/pack-materials?search=...
 */

import { api } from '../lib/apiClient';
import type { MasterCustomFieldDef } from '../lib/masterCustomFields';
import type { QualitySpecTableRow } from '../types/qualitySpecTable';
import {
  flattenPmQualitySpecRowsForPayload,
  flattenPmQualitySubSpecRowsByPathForPayload,
} from '../lib/pmQualitySpecVisibility';

export interface PackMaterialFromApi {
  id: string;
  code: string;
  description: string;
  level: string;
  group: string | null;
  material: string;
  size_spec: string;
  price_per_pc: number;
  moq: number;
  lead_time_days: number;
  print_status: string;
  /** Registration approval workflow status (Draft → Under Review → Under Approval → Active). */
  status?: string;
  products: string[];
  /** Primary info for Zoho sync (TODO: implement Zoho integration) */
  zoho_id?: string | null;
  /** Zoho-mirrored SKU code (RM/PM/PR all share this column name as of May 2026). */
  zoho_sku_code?: string | null;
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
  /** Merged category TECHNICAL-spec field defs live-resolved by the backend. */
  resolved_technical_specs?: MasterCustomFieldDef[];
  approval_assigned_user_id?: number | null;
  approval_assigned_display_name?: string | null;
  approval_stage_assignees?: Record<string, unknown> | null;
}

export interface PackMaterialRecord {
  id: string;
  code: string;
  description: string;
  level: string;
  group: string | null;
  material: string;
  sizeSpec: string;
  pricePerPc: number;
  moq: number;
  leadTimeDays: number;
  printStatus: string;
  status: string;
  products: string[];
  zohoId: string | null;
  zohoSkuCode: string | null;
  hsnCode: string | null;
  unit: string | null;
  taxPref: string | null;
  salesPurchaseAccount: string | null;
  pkgReturnable: boolean | null;
  pkgAssociateItems: string | null;
  form_data?: Record<string, unknown> | null;
  resolvedTechnicalSpecs: MasterCustomFieldDef[];
  approvalAssignedUserId: number | null;
  approvalAssignedDisplayName: string | null;
  approvalStageAssignees: Record<string, unknown> | null;
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
    level: row.level ?? '',
    group: row.group ?? null,
    material: row.material ?? '',
    sizeSpec: row.size_spec ?? '',
    pricePerPc: Number.isFinite(Number(row.price_per_pc)) ? Number(row.price_per_pc) : 0,
    moq: Number.isFinite(Number(row.moq)) ? Number(row.moq) : 0,
    leadTimeDays: Number.isFinite(Number(row.lead_time_days)) ? Number(row.lead_time_days) : 0,
    printStatus: row.print_status ?? '',
    status: row.status ?? 'Draft',
    products: Array.isArray(row.products) ? row.products : [],
    zohoId: row.zoho_id ?? null,
    zohoSkuCode: row.zoho_sku_code ?? null,
    hsnCode: row.hsn_code ?? null,
    unit: row.unit ?? null,
    taxPref: row.tax_pref ?? null,
    salesPurchaseAccount: row.sales_purchase_account ?? null,
    pkgReturnable: row.pkg_returnable ?? null,
    pkgAssociateItems: row.pkg_associate_items ?? null,
    form_data: row.form_data ?? null,
    resolvedTechnicalSpecs: Array.isArray(row.resolved_technical_specs) ? row.resolved_technical_specs : [],
    approvalAssignedUserId: (() => {
      const raw = row.approval_assigned_user_id;
      if (raw == null || raw === '') return null;
      const id = Number(raw);
      return Number.isFinite(id) && id > 0 ? id : null;
    })(),
    approvalAssignedDisplayName: row.approval_assigned_display_name ?? null,
    approvalStageAssignees:
      row.approval_stage_assignees != null && typeof row.approval_stage_assignees === 'object'
        ? (row.approval_stage_assignees as Record<string, unknown>)
        : null,
  };
}

/**
 * Fetch pack materials list; optional search for filtering.
 * Pass `{ forPicker: true }` for PR BOM pickers — returns every approval stage.
 */
export async function fetchPackMaterialsList(
  search?: string,
  opts?: { forPicker?: boolean }
): Promise<PackMaterialRecord[]> {
  const params = new URLSearchParams();
  if (search != null && search.trim()) params.set('search', search.trim());
  if (opts?.forPicker) params.set('for_picker', '1');
  const path = `/api/v1/pack-materials${params.toString() ? `?${params.toString()}` : ''}`;
  const list = await api.get<PackMaterialFromApi[]>(path);
  return (list ?? []).map(mapApiToRecord);
}

/** Picker alias — all approval statuses for PR BOM / planning flows. */
export async function fetchPackMaterialsForPicker(search?: string): Promise<PackMaterialRecord[]> {
  return fetchPackMaterialsList(search, { forPicker: true });
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
/** Next PM code: numeric only (e.g. 00001), global sequence for pack_materials.code. */
export async function fetchNextPackMaterialCode(): Promise<string> {
  const res = await api.get<{ nextCode: string }>('/api/v1/pack-materials/next-code');
  return res?.nextCode ?? '00001';
}

/** Payload for creating a pack material (camelCase; backend accepts snake_case too). */
export interface CreatePackMaterialPayload {
  code?: string;
  itemCode?: string;
  description?: string;
  name?: string;
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
  /** Zoho-mirrored SKU code (snake_case for API; camelCase variant `zohoSkuCode` also accepted). */
  zoho_sku_code?: string | null;
  zohoSkuCode?: string | null;
  /** @deprecated kept for backward-compat — backend now stores zoho_sku_code. */
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
  /** When completing a draft created via syncPmZoho */
  pack_material_id?: number | string | null;
  draft_pack_material_id?: number | string | null;
}

export interface PmZohoSyncResponse {
  pack_material_id: number;
  zoho_id: string | null;
  zoho_sync:
    | { synced: true }
    | { synced: false; skipped?: boolean; resolvedWithoutZoho?: boolean; reason?: string; error?: string };
}

/** Draft PM + Zoho item (wizard before full submit). POST /api/v1/pack-materials/zoho-sync */
export async function syncPmZoho(
  payload: CreatePackMaterialPayload | Record<string, unknown>
): Promise<{ data: PmZohoSyncResponse | null; error: string | null; success: boolean }> {
  try {
    const data = await api.post<PmZohoSyncResponse>('/api/v1/pack-materials/zoho-sync', payload);
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Zoho sync failed';
    return { data: null, error: message, success: false };
  }
}

export interface PmZohoSkuImportResponse {
  pack_material_id: number;
  imported: boolean;
  source: 'zoho';
  zoho_id: string | null;
}

/**
 * Import a pack material that exists in Zoho Books but is missing from our system.
 * POST /api/v1/pack-materials/zoho-import-by-sku  Body: { sku }
 */
export async function importPackMaterialFromZohoSku(
  sku: string
): Promise<{ data: PmZohoSkuImportResponse | null; error: string | null; success: boolean }> {
  try {
    const data = await api.post<PmZohoSkuImportResponse>('/api/v1/pack-materials/zoho-import-by-sku', {
      sku: String(sku || '').trim(),
    });
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to import from Zoho';
    return { data: null, error: message, success: false };
  }
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
 * Set THIS pack material's own quality specs (item-specific), one-way locking it to its own rows.
 * Merges only the quality keys into form_data server-side. PATCH /api/v1/pack-materials/:id/quality-specs
 */
export async function setPackMaterialItemQualitySpecs(
  id: string,
  rows: QualitySpecTableRow[],
  subRowsByPath?: Record<string, QualitySpecTableRow[]>
): Promise<void> {
  const body: Record<string, unknown> = {
    pmQualitySpecRows: flattenPmQualitySpecRowsForPayload(rows),
  };
  if (subRowsByPath) {
    body.pmQualitySubSpecRowsByPath = flattenPmQualitySubSpecRowsByPathForPayload(subRowsByPath);
  }
  await api.patch(`/api/v1/pack-materials/${id}/quality-specs`, body);
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

/** Delete every pack material and scrub dependent DB rows (destructive). Requires typed confirmation on the server. */
export async function resetAllPackMaterialsMaster(): Promise<{ deletedPackMaterials: number }> {
  try {
    const res = await api.post<{ ok?: boolean; deletedPackMaterials?: number; message?: string }>(
      '/api/v1/pack-materials/reset-all',
      { confirm: 'RESET_ALL_PACK_MATERIALS' }
    );
    return { deletedPackMaterials: res?.deletedPackMaterials ?? 0 };
  } catch (e) {
    const body = (e as Error & { body?: unknown }).body;
    const msg =
      body && typeof body === 'object' && 'error' in body && typeof (body as { error?: string }).error === 'string'
        ? String((body as { error: string }).error)
        : e instanceof Error
          ? e.message
          : 'Failed to reset pack materials';
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

/** Chunked upsert from workbook sheet "Item Reference" (SKU / name / type). POST /api/v1/pack-materials/item-reference-bulk-chunk */
export interface ItemReferenceBulkChunkRow {
  excel_row: number;
  line_type: 'Packaging' | 'Raw Material';
  zoho_sku_code: string;
  description: string;
  /** Multi-worksheet PM template (tabs: Primary Packaging, Labels, …). */
  import_profile?: 'pm_multi_sheet';
  sheet_name?: string;
  category?: string;
  sub_category?: string;
  uom?: string;
  hsn_code?: string;
  gst_pct?: string | number;
  purchase_rate_inr?: string | number;
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
  return api.post<ItemReferenceBulkChunkResponse>('/api/v1/pack-materials/item-reference-bulk-chunk', payload);
}

/** Server parses workbook with exceljs; multipart field must be `file`. */
export interface PmMasterExcelImportResponse {
  ok: boolean;
  format?: string;
  raw_material_rows_skipped?: number;
  rows_total?: number;
  chunk_size?: number;
  chunks_processed?: number;
  summary: {
    packaging_created: number;
    packaging_updated: number;
    skipped: number;
    errors: number;
  };
  row_log?: unknown[];
}

export async function postPackMaterialsMasterExcel(file: File): Promise<PmMasterExcelImportResponse> {
  const fd = new FormData();
  fd.append('file', file);
  return api.post<PmMasterExcelImportResponse>('/api/v1/pack-materials/import-excel', fd);
}
