import type { ServiceResult } from '../types/api.types';

export interface ProcurementRequest {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
  status: string;
  requestedBy: string;
  requestDate: string;
  vendor?: string;
  estimatedCost?: number;
}

// MOCK — replace with: return api.get<ProcurementRequest[]>('/api/v1/procurement')
export async function fetchProcurementRequests(): Promise<ServiceResult<ProcurementRequest[]>> {
  return { data: [], error: null, success: true };
}

// MOCK — replace with: return api.post<ProcurementRequest>('/api/v1/procurement', payload)
export async function createProcurementRequest(
  _payload: Partial<ProcurementRequest>
): Promise<ServiceResult<ProcurementRequest>> {
  return { data: null, error: null, success: true };
}
