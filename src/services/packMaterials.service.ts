/**
 * Pack Materials API — list (optionally with search).
 * Backend: GET /api/v1/pack-materials?search=...
 */

import { api } from '../lib/apiClient';

export interface PackMaterialFromApi {
  id: string;
  code: string;
  description: string;
  type: string;
  level: string;
  group: string | null;
  material: string;
  size_spec: string;
  price_per_pc: number;
  moq: number;
  lead_time_days: number;
  print_status: string;
  products: string[];
  created_at?: string;
  updated_at?: string;
}

export interface PackMaterialRecord {
  code: string;
  description: string;
  type: string;
  level: string;
  group: string | null;
  material: string;
  sizeSpec: string;
  pricePerPc: number;
  moq: number;
  leadTimeDays: number;
  printStatus: string;
  products: string[];
}

function mapApiToRecord(row: PackMaterialFromApi): PackMaterialRecord {
  return {
    code: row.code ?? '',
    description: row.description ?? '',
    type: row.type ?? '',
    level: row.level ?? '',
    group: row.group ?? null,
    material: row.material ?? '',
    sizeSpec: row.size_spec ?? '',
    pricePerPc: Number(row.price_per_pc) ?? 0,
    moq: Number(row.moq) ?? 0,
    leadTimeDays: Number(row.lead_time_days) ?? 0,
    printStatus: row.print_status ?? '',
    products: Array.isArray(row.products) ? row.products : [],
  };
}

/**
 * Fetch pack materials list; optional search for filtering.
 */
export async function fetchPackMaterialsList(search?: string): Promise<PackMaterialRecord[]> {
  const params = new URLSearchParams();
  if (search != null && search.trim()) params.set('search', search.trim());
  const path = `/api/v1/pack-materials${params.toString() ? `?${params.toString()}` : ''}`;
  const list = await api.get<PackMaterialFromApi[]>(path);
  return (list ?? []).map(mapApiToRecord);
}

/**
 * Get next code for a series prefix (e.g. EI-PM-PRI -> EI-PM-PRI-00001).
 * Backend counts existing codes with that prefix and returns next.
 */
export async function fetchNextPackMaterialCode(prefix: string): Promise<string> {
  const p = encodeURIComponent(prefix.trim());
  const res = await api.get<{ nextCode: string }>(`/api/v1/pack-materials/next-code?prefix=${p}`);
  return res?.nextCode ?? `${prefix}-00001`;
}

/** Payload for creating a pack material (camelCase; backend accepts snake_case too). */
export interface CreatePackMaterialPayload {
  code?: string;
  itemCode?: string;
  description?: string;
  name?: string;
  type?: string;
  itemCategory?: string;
  level?: string;
  group?: string;
  material?: string;
  matBody?: string;
  size_spec?: string;
  specNominal?: string;
  price_per_pc?: number;
  pricePerPc?: number;
  moq?: number;
  lead_time_days?: number;
  leadTimeDays?: number;
  print_status?: string;
  printStatus?: string;
  products?: string[];
}

/**
 * Create pack material. Returns created record.
 */
export async function createPackMaterial(payload: CreatePackMaterialPayload): Promise<PackMaterialRecord> {
  const row = await api.post<PackMaterialFromApi>('/api/v1/pack-materials', payload);
  return mapApiToRecord(row);
}
