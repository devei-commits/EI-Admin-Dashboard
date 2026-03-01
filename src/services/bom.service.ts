import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';

export interface BOMRecord {
  id: string;
  bomCode: string;
  bomSku: string;
  name: string;
  type: string;
  status: string;
  version: string;
  client: string;
  bomCategory?: string;
  packSize?: string;
  dosage?: string;
  site?: string;
  category?: string;
  createdAt: string;
  updatedAt?: string;
}

export async function fetchBOMs(search?: string): Promise<ServiceResult<BOMRecord[]>> {
  try {
    const params = search != null && search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
    const list = await api.get<BOMRecord[]>(`/api/v1/bom${params}`);
    return { data: list ?? [], error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load BOMs';
    return { data: [], error: message, success: false };
  }
}

export async function fetchBOMById(id: string): Promise<ServiceResult<BOMRecord>> {
  try {
    const row = await api.get<BOMRecord>(`/api/v1/bom/${id}`);
    return { data: row ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load BOM';
    return { data: null, error: message, success: false };
  }
}

export interface CreateBOMPayload {
  bomCode: string;
  bomSku?: string;
  bomCategory?: string;
  bomUnit?: string;
  bomHsn?: string;
  bomTaxPreference?: string;
  bomReturnable?: boolean;
  bomAssociateItems?: string;
  type?: string;
  status?: string;
  version?: string;
  client?: string;
  name?: string;
  dosage?: string;
  packSize?: string;
  site?: string;
  category?: string;
  claims?: string;
  project?: string;
  market?: string;
  createdBy?: string;
  reviewedBy?: string;
  desc?: string;
  specBulk?: string;
  specProcess?: string;
  specFg?: string;
  specPack?: string;
  specTests?: string;
  specRelease?: string;
  batch?: string;
  yield?: string;
  overage?: string;
  line?: string;
  notes?: string;
  regulatory?: string;
  phRange?: string;
  description?: string;
  rmLines?: unknown[];
  pmLines?: unknown[];
}

export async function createBOM(payload: CreateBOMPayload): Promise<ServiceResult<BOMRecord>> {
  try {
    const row = await api.post<BOMRecord>('/api/v1/bom', payload);
    return { data: row ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create BOM';
    return { data: null, error: message, success: false };
  }
}

export async function updateBOM(_id: string, _payload: Partial<BOMRecord>): Promise<ServiceResult<BOMRecord>> {
  return { data: null, error: null, success: true };
}
