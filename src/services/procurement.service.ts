import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';

export interface ProcurementRequestItem {
  type: 'RM' | 'PM';
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
}

export interface ProcurementRequest {
  id: string;
  planningExtractedId: number;
  priority: string;
  requiredByDate: string | null;
  notes: string | null;
  items: ProcurementRequestItem[];
  status: string;
  requestedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProcurementPayload {
  planningExtractedId: number;
  priority: string;
  requiredByDate: string;
  notes: string;
  items: ProcurementRequestItem[];
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

export async function createProcurementRequest(
  payload: CreateProcurementPayload
): Promise<ServiceResult<ProcurementRequest>> {
  try {
    const data = await api.post<ProcurementRequest>('/api/v1/procurement', payload);
    return { data: data ?? null, error: null, success: true };
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Failed to create procurement request';
    return { data: null, error: err, success: false };
  }
}
