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
  /** Set when line qty is remainder after partial release; server skips strict MOQ for backlog lines. */
  partial_release_remainder?: boolean;
}

export interface ProcurementRequest {
  id: string;
  planningExtractedId: number;
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
}

export interface CreateProcurementPayload {
  planningExtractedId: number;
  planningBatchId?: number | null;
  priority: string;
  requiredByDate: string | null;
  notes: string | null;
  items: ProcurementRequestItem[];
  preferredVendor?: string | null;
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

export async function updateProcurementRequest(
  id: string,
  payload: UpdateProcurementPayload
): Promise<ServiceResult<ProcurementRequest>> {
  try {
    const data = await api.patch<ProcurementRequest>(`/api/v1/procurement/${id}`, payload);
    return { data: data ?? null, error: null, success: true };
  } catch (error) {
    const apiMsg = extractApiErrorMessage(error);
    if (apiMsg) return { data: null, error: apiMsg, success: false };
    const err = error instanceof Error ? error.message : 'Failed to update procurement request';
    return { data: null, error: err, success: false };
  }
}
