import type { ServiceResult } from '../types/api.types';
import type { ProducingBatch, WarehouseMaterialRequest } from '../types/bmr.types';

// MOCK — replace with: return api.get<ProducingBatch[]>('/api/v1/bmr')
export async function fetchBMRBatches(): Promise<ServiceResult<ProducingBatch[]>> {
  return { data: [], error: null, success: true };
}

// MOCK — replace with: return api.get<WarehouseMaterialRequest[]>('/api/v1/bmr/material-requests')
export async function fetchMaterialRequests(): Promise<ServiceResult<WarehouseMaterialRequest[]>> {
  return { data: [], error: null, success: true };
}
