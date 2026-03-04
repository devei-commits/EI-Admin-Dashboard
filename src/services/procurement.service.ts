import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';

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

// Fetch all procurement requests
export async function fetchProcurementRequests(): Promise<ServiceResult<ProcurementRequest[]>> {
  try {
    const data = await api.get<ProcurementRequest[]>('/api/v1/procurement');
    return { data, error: null, success: true };
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Failed to fetch procurement requests';
    return { data: null, error: err, success: false };
  }
}

// Create a new procurement request
export async function createProcurementRequest(
  payload: Record<string, unknown>
): Promise<ServiceResult<ProcurementRequest>> {
  try {
    const data = await api.post<ProcurementRequest>('/api/v1/procurement', payload);
    return { data, error: null, success: true };
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Failed to create procurement request';
    return { data: null, error: err, success: false };
  }
