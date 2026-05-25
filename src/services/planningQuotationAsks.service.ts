import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';

export interface PlanningQuotationAsk {
  id: number;
  planningExtractedId: number;
  itemType: 'RM' | 'PM';
  rawMaterialId: number | null;
  packMaterialId: number | null;
  itemCode: string | null;
  itemName: string | null;
  quantityRequested: number;
  unit: string | null;
  vendorHint: string | null;
  moqHint: number | null;
  status: 'pending' | 'fulfilled' | 'cancelled';
  notes: string | null;
  requestedBy: string | null;
  fulfilledAt: string | null;
  createdAt: string;
  updatedAt: string;
  planningSoNumber?: string | null;
  planningCustomerName?: string | null;
  planningProductName?: string | null;
  planningProductCode?: string | null;
}

export interface CreatePlanningQuotationAskPayload {
  planningExtractedId: number;
  itemType: 'RM' | 'PM';
  rawMaterialId?: number;
  packMaterialId?: number;
  itemCode?: string;
  itemName?: string;
  quantityRequested: number;
  unit?: string;
  vendorHint?: string | null;
  moqHint?: number | null;
  notes?: string;
}

function extractApiErrorMessage(e: unknown): string | null {
  const err = e as Error & { body?: unknown };
  if (err?.body && typeof err.body === 'object' && err.body !== null && 'error' in err.body) {
    const msg = (err.body as { error?: unknown }).error;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return null;
}

export async function fetchPlanningQuotationAsks(opts?: {
  status?: string;
  planningExtractedId?: number;
}): Promise<ServiceResult<PlanningQuotationAsk[]>> {
  try {
    const params = new URLSearchParams();
    if (opts?.status) params.set('status', opts.status);
    if (opts?.planningExtractedId != null) {
      params.set('planning_extracted_id', String(opts.planningExtractedId));
    }
    const qs = params.toString() ? `?${params.toString()}` : '';
    const data = await api.get<PlanningQuotationAsk[]>(`/api/v1/planning-quotation-asks${qs}`);
    return { data: data ?? [], error: null, success: true };
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Failed to fetch planning quotation asks';
    return { data: [], error: err, success: false };
  }
}

export async function createPlanningQuotationAsk(
  payload: CreatePlanningQuotationAskPayload
): Promise<ServiceResult<PlanningQuotationAsk>> {
  try {
    const data = await api.post<PlanningQuotationAsk>('/api/v1/planning-quotation-asks', payload);
    return { data: data ?? null, error: null, success: true };
  } catch (error) {
    const apiMsg = extractApiErrorMessage(error);
    if (apiMsg) return { data: null, error: apiMsg, success: false };
    const err = error instanceof Error ? error.message : 'Failed to send quotation ask';
    return { data: null, error: err, success: false };
  }
}

export async function updatePlanningQuotationAsk(
  id: number,
  payload: { status?: 'pending' | 'fulfilled' | 'cancelled'; notes?: string }
): Promise<ServiceResult<PlanningQuotationAsk>> {
  try {
    const data = await api.patch<PlanningQuotationAsk>(`/api/v1/planning-quotation-asks/${id}`, payload);
    return { data: data ?? null, error: null, success: true };
  } catch (error) {
    const apiMsg = extractApiErrorMessage(error);
    if (apiMsg) return { data: null, error: apiMsg, success: false };
    const err = error instanceof Error ? error.message : 'Failed to update quotation ask';
    return { data: null, error: err, success: false };
  }
}
