/**
 * Products Master (PR) — list and detail for PR panel.
 * Backend: GET /api/v1/products (list with counts), GET /api/v1/products/:id/detail (full panel data).
 */

import type { ServiceResult } from '../types/api.types';
import type { FormulaBomParsedRow, FormulaSummaryParsedRow } from '../lib/formulaBomExcelParse';
import { api, getApiBaseUrl, getAuthToken } from '../lib/apiClient';

export type PrRecordType = 'temporary' | 'permanent';
export type PrRecordTypeForm = PrRecordType | 'legacy';

export interface PRProductListItem {
  product_id: number;
  product_code: string;
  /** Zoho-mirrored SKU code (renamed from `product_sku` May 2026 for cross-table clarity). */
  zoho_sku_code: string;
  product_name: string;
  category: string;
  /** PR sub-category from BOM notes (list API); optional. */
  pr_sub_category?: string | null;
  form?: string;
  /** @deprecated Legacy; pack size for SOs uses skuBomLimitQty/Uom. */
  fill_size?: string;
  skuBomLimitQty?: number | null;
  skuBomLimitUom?: string | null;
  batch_size_kg?: number;
  shelf_life_months?: number;
  mrp_price?: number;
  status?: string;
  /** Temporary (TPR…) vs permanent (PR…) internal-code series; null = legacy rows. */
  pr_record_type?: PrRecordType | null;
  version?: string;
  rm_ingredients_count: number;
  pack_items_count: number;
  open_sos_count: number;
}

export interface PaginatedRowsResponse<T> {
  rows: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface FormulaBomPhase {
  phase: string;
  ingredients: {
    inci_name: string;
    rm_code: string;
    pct_w_w: number;
    uom: string;
    raw_material_id?: number | null;
    /** Per-RM specific gravity (vs water) for vessel volume at Planning BOM confirmation. */
    specific_gravity?: number | null;
  }[];
}

/** Raw materials required per 1 unit of finished product (SKU), distinct from formula % w/w. */
export interface SkuBomRow {
  row_number: number;
  inci_name: string;
  rm_code: string;
  raw_material_id?: number | null;
  qty_per_unit: number;
  uom: string;
}

export interface PackBomRow {
  row_number: number;
  /** Pack Material id from PM table (for linking to Pack Materials); null if only code known */
  pm_id: number | null;
  pm_description: string;
  pm_code: string;
  pack_type: string;
  /** PM category slug (ppm, spm-labels, …). */
  pm_sku_category?: string;
  /** Finer sub-category (Tubes, Sheet form, …). */
  pm_sub_category?: string;
  /** Material / construction under sub-category (PET, Aluminium, …). */
  pm_sub_sub_category?: string;
  qty_per_unit: number;
  uom: string;
}

export interface ProcessStep {
  step_number: number;
  description: string;
  duration_minutes: number;
}

export interface OpenSalesOrder {
  order_id: string;
  customer_name: string;
  quantity: number;
  status: string;
}

export interface PRProductDetail extends PRProductListItem {
  /** Zoho Books item id when linked */
  zoho_item_id?: string | null;
  product_description?: string;
  license_cml?: string;
  theoretical_yield_pct?: number;
  pao_months?: number;
  manufacturing_location?: string;
  equipment_vessel?: string;
  storage_conditions?: string;
  approved_claims?: string;
  ph_range?: string;
  viscosity_range?: string;
  specific_gravity?: string;
  microbial_limits?: string;
  spf_pa_rating?: string;
  photostability?: string;
  freeze_thaw_cycles?: string;
  appearance?: string;
  odour?: string;
  fill_weight_spec?: string;
  stability_summary?: string;
  pr_sub_category?: string;
  pr_qc_group?: string;
  brand_client?: string;
  pack_configuration?: string;
  applicable_regulation?: string;
  claims_substantiation?: string;
  cosmos_natural_certification?: string;
  dermatologically_tested?: string;
  cruelty_free_vegan?: string;
  formulaBom: FormulaBomPhase[];
  skuBom: SkuBomRow[];
  /** Net per finished unit; when all SKU lines match the limit UOM kind (mass vs volume), their qtys must sum to this. */
  skuBomLimitQty?: number | null;
  skuBomLimitUom?: string | null;
  packBom: PackBomRow[];
  processSteps: ProcessStep[];
  openSalesOrders: OpenSalesOrder[];
}

export async function fetchPRProducts(opts?: {
  /** Masters → Clients row id; filters products whose brand or BOM client matches that client name */
  vendor_client_id?: string;
}): Promise<ServiceResult<PRProductListItem[]>> {
  try {
    const qs =
      opts?.vendor_client_id != null && String(opts.vendor_client_id).trim() !== ''
        ? `?vendor_client_id=${encodeURIComponent(String(opts.vendor_client_id).trim())}`
        : '';
    const list = await api.get<PRProductListItem[]>(`/api/v1/products${qs}`);
    return { data: list ?? [], error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load products';
    return { data: [], error: { code: 'ERROR', message, timestamp: new Date().toISOString() }, success: false };
  }
}

export async function fetchPRProductsPage(opts: {
  limit?: number;
  offset?: number;
}): Promise<{
  rows: PRProductListItem[];
  total: number;
  limit: number;
  offset: number;
}> {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));

  const path = `/api/v1/products?${params.toString()}`;
  const resp = await api.get<PaginatedRowsResponse<PRProductListItem>>(path);
  return {
    rows: resp?.rows ?? [],
    total: resp?.total ?? 0,
    limit: resp?.limit ?? limit,
    offset: resp?.offset ?? offset,
  };
}

export async function fetchPRProductDetail(productId: number | string): Promise<ServiceResult<PRProductDetail>> {
  try {
    const detail = await api.get<PRProductDetail>(`/api/v1/products/${productId}/detail`);
    return { data: detail ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load product detail';
    return { data: null, error: message, success: false };
  }
}

export interface PRRegistrationResponse {
  product: Record<string, unknown>;
  bom: { id: string; bom_code: string; product_id: number };
}

/** Create Product + linked BOM (PR Master wizard). Backend: POST /api/v1/products/pr-registration */
function messageFromApiError(e: unknown): string {
  if (e instanceof Error) {
    const body = (e as Error & { body?: unknown }).body;
    if (body && typeof body === 'object' && body !== null && 'error' in body) {
      const msg = (body as { error?: string }).error;
      if (msg && typeof msg === 'string') return msg;
    }
    return e.message;
  }
  return 'Failed to register product';
}

export async function createPRRegistration(
  payload: Record<string, unknown>
): Promise<ServiceResult<PRRegistrationResponse>> {
  try {
    const data = await api.post<PRRegistrationResponse>('/api/v1/products/pr-registration', payload);
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    return { data: null, error: messageFromApiError(e), success: false };
  }
}

export interface PrZohoSyncResponse {
  product_id: number;
  zoho_item_id: string | null;
  zoho_sync:
    | { synced: true }
    | { synced: false; skipped?: boolean; resolvedWithoutZoho?: boolean; reason?: string; error?: string };
}

/** Draft product + Zoho item create (PR wizard step 0). Backend: POST /api/v1/products/pr-zoho-sync */
export async function syncPrProductZoho(
  payload: Record<string, unknown>
): Promise<ServiceResult<PrZohoSyncResponse>> {
  try {
    const data = await api.post<PrZohoSyncResponse>('/api/v1/products/pr-zoho-sync', payload);
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    return { data: null, error: messageFromApiError(e), success: false };
  }
}

/** Payload for updating a PR product. Use snake_case for backend; optional bom for linked BOM. */
export interface UpdatePRProductPayload {
  product_name?: string;
  product_code?: string;
  /** Zoho-mirrored SKU code (renamed from `product_sku` May 2026). Backend still accepts `product_sku` for backward compat. */
  zoho_sku_code?: string;
  product_description?: string;
  category?: string;
  status?: string;
  form?: string;
  fill_size?: string;
  batch_size_kg?: number;
  shelf_life_months?: number;
  version?: string;
  license_cml?: string;
  theoretical_yield_pct?: number;
  pao_months?: number;
  mrp_price?: number;
  manufacturing_location?: string;
  equipment_vessel?: string;
  storage_conditions?: string;
  approved_claims?: string;
  ph_range?: string;
  viscosity_range?: string;
  spf_pa_rating?: string;
  appearance?: string;
  odour?: string;
  fill_weight_spec?: string;
  stability_summary?: string;
  pr_record_type?: PrRecordType | null;
  bom?: {
    rm_lines?: unknown[];
    sku_rm_lines?: unknown[];
    sku_bom_limit_qty?: number | string | null;
    sku_bom_limit_uom?: string | null;
    skuBomLimitQty?: number | string | null;
    skuBomLimitUom?: string | null;
    pm_lines?: unknown[];
    process_steps?: ProcessStep[];
    ph_range?: string;
    yield_pct?: string;
    stability_summary?: string;
  };
}

export async function updatePRProduct(
  productId: number | string,
  payload: UpdatePRProductPayload
): Promise<ServiceResult<PRProductDetail>> {
  try {
    await api.put(`/api/v1/products/${productId}`, payload);
    const res = await fetchPRProductDetail(productId);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update product';
    return { data: null, error: message, success: false };
  }
}

/**
 * Delete product by id. Backend: DELETE /api/v1/products/:id
 */
export async function deletePRProduct(productId: number | string): Promise<ServiceResult<null>> {
  try {
    await api.delete(`/api/v1/products/${productId}`);
    return { data: null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to delete product';
    return { data: null, error: message, success: false };
  }
}

/** Zoho Inventory/Books composite → SKU BOM lines (server uses OAuth; tries Inventory API then Books). */
export interface ZohoCompositeSkuBomSuggestion {
  composite_item_id: string | null;
  composite_name: string | null;
  sku_bom: Array<{
    row_number: number;
    inci_name: string;
    rm_code: string;
    raw_material_id: number | null;
    qty_per_unit: number;
    uom: string;
  }>;
  sku_bom_limit_qty: number | null;
  sku_bom_limit_uom: string | null;
  pack_hints: Array<{
    name: string;
    sku: string;
    item_id: string | null;
    quantity: number;
    unit: string;
  }>;
  unmatched_components: Array<{
    name: string;
    sku: string;
    item_id: string | null;
    quantity: number;
    unit: string;
  }>;
  warnings: string[];
}

/** Result from POST /api/v1/products/:id/sku-bom/upload-excel. */
export interface SkuBomExcelUploadResult {
  success: boolean;
  product_id: number;
  bom_id: number;
  sheet_name: string;
  summary: {
    total_rows: number;
    sku_rm_count: number;
    sku_rm_matched: number;
    sku_rm_unmatched: number;
    pm_count: number;
    pm_matched: number;
    pm_unmatched: number;
    skipped_unknown_type: number;
  };
  unmatched: Array<{
    row_number: number;
    type: 'Raw Material' | 'Packaging';
    component_name: string;
    qty: number;
    uom: string;
  }>;
  skipped_unknown_type: Array<{
    row_number: number;
    type_raw: string;
    component_name: string;
  }>;
  sku_rm_lines: Array<{
    inci_name: string;
    rm_code: string;
    raw_material_id: number | null;
    qty_per_unit: number;
    uom: string;
  }>;
  pm_lines: Array<{
    pm_code: string;
    description: string;
    pm_description: string;
    pack_material_id: number | null;
    pack_type: string;
    qty_per_unit: number;
    uom: string;
  }>;
}

/**
 * Upload an Excel workbook to populate a product's SKU BOM + Pack BOM lines in one shot.
 * Backend parses with exceljs, matches component names to raw_materials (type=Raw Material)
 * and pack_materials (type=Packaging), and persists directly to the linked BOM.
 */
export async function uploadSkuBomExcel(
  productId: number | string,
  file: File
): Promise<ServiceResult<SkuBomExcelUploadResult>> {
  try {
    const form = new FormData();
    form.append('file', file);
    const base = getApiBaseUrl();
    const token = getAuthToken();
    const url = `${base}/api/v1/products/${encodeURIComponent(String(productId))}/sku-bom/upload-excel`;
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      body: form,
      headers,
    });
    if (!response.ok) {
      let errMsg = `HTTP ${response.status}: ${response.statusText || 'Upload failed'}`;
      try {
        const body = await response.json();
        if (body && typeof body === 'object') {
          const b = body as { error?: string; message?: string };
          if (typeof b.error === 'string' && b.error.trim()) errMsg = b.error;
          else if (typeof b.message === 'string' && b.message.trim()) errMsg = b.message;
        }
      } catch {
        // leave errMsg as default
      }
      return {
        data: null,
        error: { code: 'UPLOAD_ERROR', message: errMsg, timestamp: new Date().toISOString() },
        success: false,
      };
    }
    const data = (await response.json()) as SkuBomExcelUploadResult;
    return { data, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to upload Excel';
    return {
      data: null,
      error: { code: 'UPLOAD_ERROR', message, timestamp: new Date().toISOString() },
      success: false,
    };
  }
}

/** Clear SKU BOM + Pack BOM on server for fresh Excel import. POST /api/v1/products/:id/sku-bom/clear */
export interface ClearSkuBomForReimportResult {
  success: boolean;
  product_id: number;
  bom_id: number | null;
  message?: string;
}

export async function clearSkuBomForReimport(
  productId: number | string
): Promise<ServiceResult<ClearSkuBomForReimportResult>> {
  try {
    const data = await api.post<ClearSkuBomForReimportResult>(
      `/api/v1/products/${encodeURIComponent(String(productId))}/sku-bom/clear`,
      {}
    );
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to clear SKU BOM';
    return {
      data: null,
      error: { code: 'CLEAR_ERROR', message, timestamp: new Date().toISOString() },
      success: false,
    };
  }
}

/** Full BOM wipe for one PR. POST /api/v1/products/:id/bom/full-reset — also clears fill_size and internal product_code. */
export interface ClearPrBomFullResetResult {
  success: boolean;
  product_id: number;
  bom_id: number | null;
  message?: string;
}

export async function clearPrBomFullReset(
  productId: number | string
): Promise<ServiceResult<ClearPrBomFullResetResult>> {
  try {
    const data = await api.post<ClearPrBomFullResetResult>(
      `/api/v1/products/${encodeURIComponent(String(productId))}/bom/full-reset`,
      {}
    );
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to reset PR BOM';
    return {
      data: null,
      error: { code: 'FULL_RESET_ERROR', message, timestamp: new Date().toISOString() },
      success: false,
    };
  }
}

/** Must match server — paste this in the confirmation prompt for global BOM reset. */
export const ALL_PR_BOM_RESET_CONFIRM = 'RESET_ALL_PR_BOM_DATA' as const;

/** Hard-deletes all catalogue products, all BOM rows, and related dependents (server). POST /api/v1/products/bom/full-reset-all */
export interface ClearAllPrBomFullResetResult {
  success: boolean;
  products_deleted: number;
  boms_removed: number;
  message?: string;
}

export async function clearAllPrBomFullReset(
  confirm: string
): Promise<ServiceResult<ClearAllPrBomFullResetResult>> {
  try {
    const data = await api.post<ClearAllPrBomFullResetResult>('/api/v1/products/bom/full-reset-all', {
      confirm,
    });
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to reset all PR BOM data';
    return {
      data: null,
      error: { code: 'FULL_RESET_ALL_ERROR', message, timestamp: new Date().toISOString() },
      success: false,
    };
  }
}

/** POST /api/v1/products/formula-rm-bom/upload-excel — multi-composite Formula BOM sheet. */
export interface FormulaRmBomGroupResult {
  composite_sku: string;
  success: boolean;
  error?: string;
  product_id: number | null;
  bom_id: number | null;
  /** True when the PR row was created because Composite SKU was not in the system */
  product_created?: boolean;
  lines_written?: number;
  sku_rm_matched?: number;
  sku_rm_unmatched?: number;
  sg_updates?: number;
  unmatched?: Array<{
    row_number: number;
    component_sku: string;
    component_name: string;
    qty: number;
    uom: string;
  }>;
}

export interface FormulaRmBomExcelUploadResult {
  success: boolean;
  sheet_name: string;
  groups_processed: number;
  groups_total: number;
  apply_sg: boolean;
  results: FormulaRmBomGroupResult[];
  errors: Array<{ composite_sku: string; error: string }>;
}

/** POST /api/v1/products/formula-rm-bom/chunk — JSON body with grouped rows (chunked import). */
export interface FormulaRmBomChunkResponse {
  success: boolean;
  chunk_index: number | null;
  chunk_total: number | null;
  apply_sg: boolean;
  groups_in_chunk: number;
  groups_ok: number;
  results: FormulaRmBomGroupResult[];
  errors: Array<{ composite_sku: string; error: string }>;
}

export interface FormulaPackBomGroupResult {
  composite_sku: string;
  success: boolean;
  error?: string;
  product_id: number | null;
  bom_id: number | null;
  product_created?: boolean;
  lines_written?: number;
  pm_matched?: number;
  pm_unmatched?: number;
  unmatched?: Array<{
    row_number: number;
    component_sku: string;
    component_name: string;
    qty: number;
    uom: string;
  }>;
}

export interface FormulaSummaryGroupResult {
  sku: string;
  row_number: number | null;
  success: boolean;
  error?: string;
  product_id: number | null;
  bom_id: number | null;
  product_created?: boolean;
  specific_gravity?: number | null;
  pack_size?: string | null;
  category?: string | null;
  pr_sub_category?: string | null;
}

export interface FormulaSummaryChunkResponse {
  success: boolean;
  chunk_index: number | null;
  chunk_total: number | null;
  rows_in_chunk: number;
  rows_ok: number;
  results: FormulaSummaryGroupResult[];
  errors: Array<{ sku: string; error: string; row_number?: number | null }>;
}

export type { FormulaSummaryParsedRow };

/** POST /api/v1/products/formula-pack-bom/chunk */
export interface FormulaPackBomChunkResponse {
  success: boolean;
  chunk_index: number | null;
  chunk_total: number | null;
  groups_in_chunk: number;
  groups_ok: number;
  results: FormulaPackBomGroupResult[];
  errors: Array<{ composite_sku: string; error: string }>;
}

/**
 * Upload workbook sheet "Formula BOM - RM per KG-LTR": updates SKU RM lines + net limits per Composite SKU.
 * Does not require a selected product. Pass applySg: false to skip writing RM specific_gravity from SG column.
 */
export async function uploadFormulaRmBomExcel(
  file: File,
  opts?: { applySg?: boolean }
): Promise<ServiceResult<FormulaRmBomExcelUploadResult>> {
  try {
    const form = new FormData();
    form.append('file', file);
    const base = getApiBaseUrl();
    const token = getAuthToken();
    const qs = opts?.applySg === false ? '?apply_sg=0' : '';
    const url = `${base}/api/v1/products/formula-rm-bom/upload-excel${qs}`;
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      body: form,
      headers,
    });
    if (!response.ok) {
      let errMsg = `HTTP ${response.status}: ${response.statusText || 'Upload failed'}`;
      try {
        const body = await response.json();
        if (body && typeof body === 'object') {
          const b = body as { error?: string; message?: string };
          if (typeof b.error === 'string' && b.error.trim()) errMsg = b.error;
          else if (typeof b.message === 'string' && b.message.trim()) errMsg = b.message;
        }
      } catch {
        // leave errMsg
      }
      return {
        data: null,
        error: { code: 'UPLOAD_ERROR', message: errMsg, timestamp: new Date().toISOString() },
        success: false,
      };
    }
    const data = (await response.json()) as FormulaRmBomExcelUploadResult;
    return { data, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to upload Excel';
    return {
      data: null,
      error: { code: 'UPLOAD_ERROR', message, timestamp: new Date().toISOString() },
      success: false,
    };
  }
}

export async function postFormulaRmBomChunk(body: {
  chunk_index: number;
  chunk_total: number;
  apply_sg?: boolean;
  groups: Array<{ composite_sku: string; rows: FormulaBomParsedRow[] }>;
}): Promise<ServiceResult<FormulaRmBomChunkResponse>> {
  try {
    const base = getApiBaseUrl();
    const token = getAuthToken();
    const url = `${base}/api/v1/products/formula-rm-bom/chunk`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({
        chunk_index: body.chunk_index,
        chunk_total: body.chunk_total,
        apply_sg: body.apply_sg !== false,
        groups: body.groups,
      }),
    });
    if (!response.ok) {
      let errMsg = `HTTP ${response.status}: ${response.statusText || 'Chunk failed'}`;
      try {
        const raw = await response.json();
        if (raw && typeof raw === 'object') {
          const b = raw as { error?: string; message?: string };
          if (typeof b.error === 'string' && b.error.trim()) errMsg = b.error;
          else if (typeof b.message === 'string' && b.message.trim()) errMsg = b.message;
        }
      } catch {
        // leave errMsg
      }
      return {
        data: null,
        error: { code: 'CHUNK_ERROR', message: errMsg, timestamp: new Date().toISOString() },
        success: false,
      };
    }
    const data = (await response.json()) as FormulaRmBomChunkResponse;
    return { data, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Chunk request failed';
    return {
      data: null,
      error: { code: 'CHUNK_ERROR', message, timestamp: new Date().toISOString() },
      success: false,
    };
  }
}

export async function postFormulaPackBomChunk(body: {
  chunk_index: number;
  chunk_total: number;
  groups: Array<{ composite_sku: string; rows: FormulaBomParsedRow[] }>;
}): Promise<ServiceResult<FormulaPackBomChunkResponse>> {
  try {
    const base = getApiBaseUrl();
    const token = getAuthToken();
    const url = `${base}/api/v1/products/formula-pack-bom/chunk`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({
        chunk_index: body.chunk_index,
        chunk_total: body.chunk_total,
        groups: body.groups,
      }),
    });
    if (!response.ok) {
      let errMsg = `HTTP ${response.status}: ${response.statusText || 'Chunk failed'}`;
      try {
        const raw = await response.json();
        if (raw && typeof raw === 'object') {
          const b = raw as { error?: string; message?: string };
          if (typeof b.error === 'string' && b.error.trim()) errMsg = b.error;
          else if (typeof b.message === 'string' && b.message.trim()) errMsg = b.message;
        }
      } catch {
        // leave errMsg
      }
      return {
        data: null,
        error: { code: 'CHUNK_ERROR', message: errMsg, timestamp: new Date().toISOString() },
        success: false,
      };
    }
    const data = (await response.json()) as FormulaPackBomChunkResponse;
    return { data, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Chunk request failed';
    return {
      data: null,
      error: { code: 'CHUNK_ERROR', message, timestamp: new Date().toISOString() },
      success: false,
    };
  }
}

export async function postFormulaSummaryChunk(body: {
  chunk_index: number;
  chunk_total: number;
  rows: FormulaSummaryParsedRow[];
}): Promise<ServiceResult<FormulaSummaryChunkResponse>> {
  try {
    const base = getApiBaseUrl();
    const token = getAuthToken();
    const url = `${base}/api/v1/products/formula-summary/chunk`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({
        chunk_index: body.chunk_index,
        chunk_total: body.chunk_total,
        rows: body.rows,
      }),
    });
    if (!response.ok) {
      let errMsg = `HTTP ${response.status}: ${response.statusText || 'Chunk failed'}`;
      try {
        const raw = await response.json();
        if (raw && typeof raw === 'object') {
          const b = raw as { error?: string; message?: string };
          if (typeof b.error === 'string' && b.error.trim()) errMsg = b.error;
          else if (typeof b.message === 'string' && b.message.trim()) errMsg = b.message;
        }
      } catch {
        // leave errMsg
      }
      return {
        data: null,
        error: { code: 'CHUNK_ERROR', message: errMsg, timestamp: new Date().toISOString() },
        success: false,
      };
    }
    const data = (await response.json()) as FormulaSummaryChunkResponse;
    return { data, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Chunk request failed';
    return {
      data: null,
      error: { code: 'CHUNK_ERROR', message, timestamp: new Date().toISOString() },
      success: false,
    };
  }
}

export async function fetchZohoCompositeSkuBomSuggestion(
  zohoCompositeId: string
): Promise<ServiceResult<ZohoCompositeSkuBomSuggestion>> {
  try {
    const raw = await api.get<{
      success?: boolean;
      data?: ZohoCompositeSkuBomSuggestion;
      error?: string;
    }>(`/api/v1/products/zoho-composite/${encodeURIComponent(zohoCompositeId)}/sku-bom-suggestion`);
    if (raw && typeof raw === 'object' && raw.success === true && raw.data) {
      return { data: raw.data, error: null, success: true };
    }
    const errMsg =
      raw && typeof raw === 'object' && typeof (raw as { error?: string }).error === 'string'
        ? (raw as { error: string }).error
        : 'Unexpected response from Zoho composite API';
    return { data: null, error: errMsg, success: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load Zoho composite item';
    return { data: null, error: message, success: false };
  }
}
