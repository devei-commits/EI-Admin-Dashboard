import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';

export interface ProcurementRequestItem {
  type: 'RM' | 'PM' | 'FG';
  code: string;
  name: string;
  required: number;
  sih: number;
  shortage: number;
  quantity_requested: number;
  unit: string;
  line_notes?: string;
  raw_material_id?: number;
  pack_material_id?: number;
  product_id?: number;
  /** Vendor tier MOQ (kg or pcs) from Items List when set from Planning — server enforces MOQ. */
  moq_min?: number;
  /** Planned ₹/unit from Release to Planning (mirrors line_notes for Procurement UI). */
  planned_unit_price?: number;
  lead_time_days?: number;
  /** Required-by date from Planning release (YYYY-MM-DD); falls back to PR header when absent. */
  required_by_date?: string | null;
  /** Set when line qty is remainder after partial release; server skips strict MOQ for backlog lines. */
  partial_release_remainder?: boolean;
}

export interface ProcurementRequest {
  id: string;
  planningExtractedId: number | null;
  /** PR origin: planning | manual | blanket_calloff | consignment. */
  source?: string;
  planningBatchId: number | null;
  priority: string;
  requiredByDate: string | null;
  notes: string | null;
  items: ProcurementRequestItem[];
  status: string;
  preferredVendor?: string | null;
  requestedBy: string | null;
  stockCheckAssignedTo?: string | null;
  stockCheckStatus?: string | null;
  stockCheckDueDate?: string | null;
  stockCheckNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  /** From planning_extracted + sales_orders + products (API-enriched). */
  planningSoNumber?: string | null;
  planningCustomerName?: string | null;
  planningProductName?: string | null;
  planningProductCode?: string | null;
  /** MRP from products.mrp_price — read-only reference, not editable via PR */
  planningProductMrp?: number | null;
}

export interface CreateProcurementPayload {
  /** Omit for a manual / non-Planning PR (Direct PR · blanket call-off · consignment). */
  planningExtractedId?: number | null;
  /** PR origin when not Planning-sourced: manual | blanket_calloff | consignment. */
  source?: string;
  planningBatchId?: number | null;
  priority: string;
  requiredByDate: string | null;
  notes: string | null;
  items: ProcurementRequestItem[];
  preferredVendor?: string | null;
  /** Defaults to Pending on server (shown as New in Procurement → Requests). */
  status?: string;
}

export async function fetchProcurementRequests(planningExtractedId?: number): Promise<ServiceResult<ProcurementRequest[]>> {
  try {
    const qs = planningExtractedId != null ? `?planning_extracted_id=${planningExtractedId}` : '';
    const data = await api.get<ProcurementRequest[]>(`/api/v1/procurement${qs}`);
    return { data: data ?? [], error: null, success: true };
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Failed to fetch procurement requests';
    return { data: [], error: err, success: false };
  }
}

function extractApiErrorMessage(e: unknown): string | null {
  const err = e as Error & { body?: unknown };
  if (err?.body && typeof err.body === 'object' && err.body !== null && 'error' in err.body) {
    const msg = (err.body as { error?: unknown }).error;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return null;
}

export async function createProcurementRequest(
  payload: CreateProcurementPayload
): Promise<ServiceResult<ProcurementRequest>> {
  try {
    const data = await api.post<ProcurementRequest>('/api/v1/procurement', payload);
    return { data: data ?? null, error: null, success: true };
  } catch (error) {
    const apiMsg = extractApiErrorMessage(error);
    if (apiMsg) return { data: null, error: apiMsg, success: false };
    const err = error instanceof Error ? error.message : 'Failed to create procurement request';
    return { data: null, error: err, success: false };
  }
}

export interface UpdateProcurementPayload {
  priority?: string;
  requiredByDate?: string | null;
  notes?: string | null;
  items?: ProcurementRequestItem[];
  status?: string;
  preferredVendor?: string;
  stockCheckAssignedTo?: string | null;
  stockCheckStatus?: string | null;
  stockCheckDueDate?: string | null;
  stockCheckNotes?: string | null;
}

export interface MoqErrorBody {
  code: 'MOQ_NOT_MET';
  message: string;
  details: { index: number; message: string }[];
}

export async function updateProcurementRequest(
  id: string,
  payload: UpdateProcurementPayload
): Promise<ServiceResult<ProcurementRequest>> {
  try {
    const data = await api.patch<ProcurementRequest>(`/api/v1/procurement/${id}`, payload);
    return { data: data ?? null, error: null, success: true };
  } catch (error) {
    const err = error as Error & { body?: { code?: string; error?: string; details?: unknown[] } };
    if (err?.body?.code === 'MOQ_NOT_MET') {
      return {
        data: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        error: { code: 'MOQ_NOT_MET', message: err.body.error ?? 'MOQ validation failed', details: err.body.details ?? [] } as any,
        success: false,
      };
    }
    const apiMsg = extractApiErrorMessage(error);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (apiMsg) return { data: null, error: apiMsg as any, success: false };
    const errMsg = error instanceof Error ? error.message : 'Failed to update procurement request';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { data: null, error: errMsg as any, success: false };
  }
}

export async function deleteProcurementRequest(id: string): Promise<ServiceResult<null>> {
  try {
    await api.delete(`/api/v1/procurement/${id}`);
    return { data: null, error: null, success: true };
  } catch (error) {
    const apiMsg = extractApiErrorMessage(error);
    if (apiMsg) return { data: null, error: apiMsg, success: false };
    const err = error instanceof Error ? error.message : 'Failed to delete procurement request';
    return { data: null, error: err, success: false };
  }
}

// ─── Item price-list (PR Edit popup §3A dual-pane) ───────────────────────────
export interface ItemPriceTier {
  vendor: string;
  vendorCode: string | null;
  tier: string;
  price: number;
  lead: number;
}

export async function fetchItemPriceList(params: {
  rawMaterialId?: number | null;
  packMaterialId?: number | null;
}): Promise<ItemPriceTier[]> {
  const qs = new URLSearchParams();
  if (params.rawMaterialId != null) qs.set('rawMaterialId', String(params.rawMaterialId));
  if (params.packMaterialId != null) qs.set('packMaterialId', String(params.packMaterialId));
  if (![...qs.keys()].length) return [];
  try {
    const data = await api.get<{ tiers: ItemPriceTier[] }>(`/api/v1/procurement/item-price-list?${qs.toString()}`);
    return Array.isArray(data?.tiers) ? data.tiers : [];
  } catch {
    return [];
  }
}

// ─── Stock audit result submission (warehouse → procurement) ─────────────────
export interface StockCheckResultLine {
  itemCode: string;
  itemName?: string;
  physicalQty: number;
  location?: string;
  zone?: string;
  batchNo?: string;
  remarks?: string;
}

export async function submitStockCheckResult(
  prId: string,
  payload: { lines: StockCheckResultLine[]; completedBy: string; outcome?: 'all_ok' | 'not_ok' }
): Promise<ServiceResult<ProcurementRequest>> {
  try {
    const data = await api.post<ProcurementRequest>(
      `/api/v1/procurement/${prId}/stock-check-result`,
      payload,
    );
    return { data: data ?? null, error: null, success: true };
  } catch (error) {
    const apiMsg = extractApiErrorMessage(error);
    if (apiMsg) return { data: null, error: apiMsg, success: false };
    const err = error instanceof Error ? error.message : 'Failed to submit stock check result';
    return { data: null, error: err, success: false };
  }
}
