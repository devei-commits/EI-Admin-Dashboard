import type { ServiceResult } from '../types/api.types';

export interface BOMRecord {
  id: string;
  bomCode: string;
  bomSku: string;
  name: string;
  type: string;
  status: string;
  version: string;
  client: string;
  createdAt: string;
}

// MOCK — when backend ready, replace body with: return api.get<BOMRecord[]>('/api/v1/bom')
export async function fetchBOMs(): Promise<ServiceResult<BOMRecord[]>> {
  return { data: [], error: null, success: true };
}

// MOCK — replace with: return api.get<BOMRecord>(`/api/v1/bom/${id}`)
export async function fetchBOMById(_id: string): Promise<ServiceResult<BOMRecord>> {
  return { data: null, error: null, success: true };
}

// MOCK — replace with: return api.post<BOMRecord>('/api/v1/bom', payload)
export async function createBOM(_payload: Partial<BOMRecord>): Promise<ServiceResult<BOMRecord>> {
  return { data: null, error: null, success: true };
}

// MOCK — replace with: return api.put<BOMRecord>(`/api/v1/bom/${id}`, payload)
export async function updateBOM(_id: string, _payload: Partial<BOMRecord>): Promise<ServiceResult<BOMRecord>> {
  return { data: null, error: null, success: true };
}
