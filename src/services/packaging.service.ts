/**
 * Packaging (Masters) API — list and get by id with real-time search.
 * Backend: GET /api/v1/packaging?search=... , GET /api/v1/packaging/:id
 */

import { api } from '../lib/apiClient';

export interface PackagingItemFromApi {
  id: string;
  package_code: string;
  package_name: string;
  package_sku: string;
  bottom: string;
  cap_type: string;
  bottom_name: string;
  bottom_material: string;
  cap_name: string;
  cap_material: string;
  bottom_color: string;
  cap_color: string;
  bottom_weight: string;
  cap_weight: string;
  dispenser_volume: string;
  minimum_order_quantity: string;
  budget: string;
  comments: string;
  status: string;
  created_at: string;
  updated_at?: string;
}

export interface PackagingItem {
  id: string;
  packageCode: string;
  packageName: string;
  packageSKU: string;
  bottom: string;
  capType: string;
  bottomName: string;
  bottomMaterial: string;
  capName: string;
  capMaterial: string;
  bottomColor: string;
  capColor: string;
  bottomWeight: string;
  capWeight: string;
  dispenserVolume: string;
  minimumOrderQuantity: string;
  budget: string;
  comments: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

function mapApiToPackagingItem(row: PackagingItemFromApi): PackagingItem {
  return {
    id: row.id,
    packageCode: row.package_code ?? '',
    packageName: row.package_name ?? '',
    packageSKU: row.package_sku ?? '',
    bottom: row.bottom ?? '',
    capType: row.cap_type ?? '',
    bottomName: row.bottom_name ?? '',
    bottomMaterial: row.bottom_material ?? '',
    capName: row.cap_name ?? '',
    capMaterial: row.cap_material ?? '',
    bottomColor: row.bottom_color ?? '',
    capColor: row.cap_color ?? '',
    bottomWeight: row.bottom_weight ?? '',
    capWeight: row.cap_weight ?? '',
    dispenserVolume: row.dispenser_volume ?? '',
    minimumOrderQuantity: row.minimum_order_quantity ?? '',
    budget: row.budget ?? '',
    comments: row.comments ?? '',
    status: (row.status === 'active' ? 'active' : 'inactive') as PackagingItem['status'],
    createdAt: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : '',
  };
}

/**
 * Fetch packaging list with optional search (dynamic filter). Call with debounced search for real-time UX.
 */
export async function fetchPackagingList(search?: string): Promise<PackagingItem[]> {
  const params = new URLSearchParams();
  if (search != null && search.trim()) params.set('search', search.trim());
  const path = `/api/v1/packaging${params.toString() ? `?${params.toString()}` : ''}`;
  const list = await api.get<PackagingItemFromApi[]>(path);
  return (list ?? []).map(mapApiToPackagingItem);
}

/**
 * Fetch a single packaging entry by id.
 */
export async function fetchPackagingById(id: string): Promise<PackagingItem | null> {
  try {
    const row = await api.get<PackagingItemFromApi>(`/api/v1/packaging/${id}`);
    return row ? mapApiToPackagingItem(row) : null;
  } catch {
    return null;
  }
}

/** Payload for create (camelCase). */
export interface PackagingCreatePayload {
  packageCode?: string;
  packageName?: string;
  packageSKU?: string;
  bottom?: string;
  capType?: string;
  bottomName?: string;
  bottomMaterial?: string;
  capName?: string;
  capMaterial?: string;
  bottomColor?: string;
  capColor?: string;
  bottomWeight?: string;
  capWeight?: string;
  dispenserVolume?: string;
  minimumOrderQuantity?: string;
  budget?: string;
  comments?: string;
  status?: 'active' | 'inactive';
}

/**
 * Create packaging. Returns created item.
 */
export async function createPackaging(payload: PackagingCreatePayload): Promise<PackagingItem> {
  const row = await api.post<PackagingItemFromApi>('/api/v1/packaging', payload);
  return mapApiToPackagingItem(row);
}

/**
 * Update packaging by id.
 */
export async function updatePackaging(id: string, payload: Partial<PackagingCreatePayload>): Promise<PackagingItem> {
  const row = await api.put<PackagingItemFromApi>(`/api/v1/packaging/${id}`, payload);
  return mapApiToPackagingItem(row);
}

/**
 * Delete packaging by id.
 */
export async function deletePackaging(id: string): Promise<void> {
  await api.delete(`/api/v1/packaging/${id}`);
}
