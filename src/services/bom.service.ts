import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';

/** Single RM line from API (phase, inci_name, rm_code, pct_w_w, uom; optional raw_material_id, specific_gravity for volume calc). */
export interface BOMRmLine {
  phase?: string;
  inci_name?: string;
  rm_code?: string;
  raw_material_id?: number;
  pct_w_w?: number;
  pct?: number;
  uom?: string;
  /** Specific gravity (relative to water) for volume: volume_L = quantity_kg / specific_gravity. Default 1 if omitted. */
  specific_gravity?: number;
  [key: string]: unknown;
}

/** Single PM line from API (pm_code, description, pack_type, qty_per_unit, etc.). */
export interface BOMPmLine {
  pm_code?: string;
  description?: string;
  pack_type?: string;
  qty_per_unit?: number;
  qty?: number;
  uom?: string;
  [key: string]: unknown;
}

export interface BOMRecord {
  id: string;
  bomCode: string;
  bomSku: string;
  zohoId?: string | null;
  name: string;
  type: string;
  status: string;
  version: string;
  client: string;
  bomCategory?: string;
  bomTaxPreference?: string | null;
  bomReturnable?: boolean | null;
  bomAssociateItems?: string | null;
  packSize?: string;
  dosage?: string;
  site?: string;
  category?: string;
  createdAt: string;
  updatedAt?: string;
  productId?: number | null;
  rmLines?: BOMRmLine[] | null;
  pmLines?: BOMPmLine[] | null;
}

export async function fetchBOMs(search?: string): Promise<ServiceResult<BOMRecord[]>> {
  try {
    const params = new URLSearchParams();
    if (search != null && search.trim()) params.set('search', search.trim());
    const q = params.toString() ? `?${params.toString()}` : '';
    const list = await api.get<BOMRecord[]>(`/api/v1/bom${q}`);
    return { data: list ?? [], error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load BOMs';
    return { data: [], error: message, success: false };
  }
}

/** Fetch first BOM linked to product_id (for Plan Batches modal). */
export async function fetchBOMByProductId(productId: number): Promise<ServiceResult<BOMRecord | null>> {
  try {
    const list = await api.get<BOMRecord[]>(`/api/v1/bom?product_id=${productId}`);
    const first = Array.isArray(list) && list.length > 0 ? list[0] : null;
    return { data: first ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load BOM';
    return { data: null, error: message, success: false };
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

export async function fetchNextBomCode(prefix: string): Promise<string> {
  const p = encodeURIComponent(prefix.trim());
  const res = await api.get<{ nextCode: string }>(`/api/v1/bom/next-code?prefix=${p}`);
  return res?.nextCode ?? `${prefix}-00001`;
}

export interface CreateBOMPayload {
  bomCode: string;
  bomSku?: string;
  zohoId?: string | null;
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

export interface UpdateBOMPayload {
  rmLines?: BOMRmLine[] | null;
  pmLines?: BOMPmLine[] | null;
}

export async function updateBOM(id: string, payload: UpdateBOMPayload): Promise<ServiceResult<BOMRecord>> {
  try {
    const body: { rmLines?: BOMRmLine[] | null; pmLines?: BOMPmLine[] | null } = {};
    if (payload.rmLines !== undefined) body.rmLines = payload.rmLines;
    if (payload.pmLines !== undefined) body.pmLines = payload.pmLines;
    const row = await api.patch<BOMRecord>(`/api/v1/bom/${id}`, body);
    return { data: row ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update BOM';
    return { data: null, error: message, success: false };
  }
}
