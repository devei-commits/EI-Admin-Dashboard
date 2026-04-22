import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';

export interface RackDTO {
  id: number;
  locationId: number;
  code: string;
  name: string | null;
  description: string | null;
  levels: number;
  slotsTotal: number;
}

export interface ZoneDTO {
  id: number;
  code: string;
  name: string;
  locationType: 'warehouse' | 'production';
  zoneLabel: string | null;
  icon: string | null;
  areaSqm: number | null;
  description: string | null;
  utilisationPct: number;
  racks?: RackDTO[];
}

export interface FacilityAreaDTO {
  id: number;
  code: string;
  name: string;
  areaType: 'warehouse' | 'production';
  icon: string | null;
  description: string | null;
  zones: ZoneDTO[];
}

export interface CreateAreaPayload {
  code: string;
  name: string;
  area_type: 'warehouse' | 'production';
  icon?: string;
  description?: string;
}

export interface UpdateAreaPayload {
  code?: string;
  name?: string;
  area_type?: 'warehouse' | 'production';
  icon?: string;
  description?: string;
}

export interface CreateZonePayload {
  code: string;
  name: string;
  area_id: number;
  location_type: 'warehouse' | 'production';
  zone_label?: string;
  icon?: string;
  area_sqm?: number;
  description?: string;
}

export interface UpdateZonePayload {
  code?: string;
  name?: string;
  area_id?: number;
  location_type?: 'warehouse' | 'production';
  zone_label?: string;
  icon?: string;
  area_sqm?: number;
  description?: string;
}

const BASE = '/api/v1/facility-areas';
const ZONES_BASE = '/api/v1/warehouse-locations';

function extractList<T>(res: unknown): T[] {
  const d = (res as { data?: T[] })?.data ?? res;
  return Array.isArray(d) ? d : [];
}

function extractOne<T>(res: unknown): T {
  return ((res as { data?: T })?.data ?? res) as T;
}

export async function fetchFacilityAreas(
  areaType?: 'warehouse' | 'production'
): Promise<ServiceResult<FacilityAreaDTO[]>> {
  try {
    const qs = areaType ? `?area_type=${areaType}` : '';
    const res = await api.get<FacilityAreaDTO[]>(`${BASE}${qs}`);
    return { data: extractList<FacilityAreaDTO>(res), error: null, success: true };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : 'Failed to load facility areas', success: false };
  }
}

export async function createFacilityArea(
  payload: CreateAreaPayload
): Promise<ServiceResult<FacilityAreaDTO>> {
  try {
    const res = await api.post<FacilityAreaDTO>(BASE, payload);
    return { data: extractOne<FacilityAreaDTO>(res), error: null, success: true };
  } catch (e) {
    return { data: null as unknown as FacilityAreaDTO, error: e instanceof Error ? e.message : 'Failed to create area', success: false };
  }
}

export async function updateFacilityArea(
  id: number,
  payload: UpdateAreaPayload
): Promise<ServiceResult<FacilityAreaDTO>> {
  try {
    const res = await api.patch<FacilityAreaDTO>(`${BASE}/${id}`, payload);
    return { data: extractOne<FacilityAreaDTO>(res), error: null, success: true };
  } catch (e) {
    return { data: null as unknown as FacilityAreaDTO, error: e instanceof Error ? e.message : 'Failed to update area', success: false };
  }
}

export async function deleteFacilityArea(id: number): Promise<ServiceResult<null>> {
  try {
    await api.delete(`${BASE}/${id}`);
    return { data: null, error: null, success: true };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to delete area', success: false };
  }
}

export async function createZone(
  payload: CreateZonePayload
): Promise<ServiceResult<ZoneDTO>> {
  try {
    const res = await api.post<ZoneDTO>(ZONES_BASE, payload);
    return { data: extractOne<ZoneDTO>(res), error: null, success: true };
  } catch (e) {
    return { data: null as unknown as ZoneDTO, error: e instanceof Error ? e.message : 'Failed to create zone', success: false };
  }
}

export async function updateZone(
  id: number,
  payload: UpdateZonePayload
): Promise<ServiceResult<ZoneDTO>> {
  try {
    const res = await api.patch<ZoneDTO>(`${ZONES_BASE}/${id}`, payload);
    return { data: extractOne<ZoneDTO>(res), error: null, success: true };
  } catch (e) {
    return { data: null as unknown as ZoneDTO, error: e instanceof Error ? e.message : 'Failed to update zone', success: false };
  }
}

export async function deleteZone(id: number): Promise<ServiceResult<null>> {
  try {
    await api.delete(`${ZONES_BASE}/${id}`);
    return { data: null, error: null, success: true };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to delete zone', success: false };
  }
}

export interface CreateRackPayload {
  location_id: number;
  code: string;
  name?: string;
  description?: string;
  levels?: number;
  slots_total?: number;
}

export async function createRack(payload: CreateRackPayload): Promise<ServiceResult<RackDTO>> {
  try {
    const res = await api.post<RackDTO>(`${ZONES_BASE}/racks`, payload);
    return { data: extractOne<RackDTO>(res), error: null, success: true };
  } catch (e) {
    return { data: null as unknown as RackDTO, error: e instanceof Error ? e.message : 'Failed to create rack', success: false };
  }
}

export interface EnsureCustomLocationPayload {
  areaType: 'warehouse' | 'production';
  zoneText: string;
  rackText: string;
}

export interface EnsureCustomLocationResult {
  areaId: number;
  zoneId: number;
  rackId: number;
  zoneCode: string;
  zoneName: string;
  rackCode: string;
  areaType: 'warehouse' | 'production';
}

/**
 * Register a custom (free-text) zone + rack into Facility Management.
 * Idempotent: reuses any existing zone (case-insensitive code/name match within the
 * same location type) and any existing rack (case-insensitive code match within the
 * zone). New entries are parented under a single auto-created "CUSTOM" area per
 * area type (WH-CUSTOM / PROD-CUSTOM). Called from GRN (warehouse) and Production
 * MU save paths when the user is in custom-location mode.
 */
export async function ensureCustomZoneAndRack(
  payload: EnsureCustomLocationPayload
): Promise<ServiceResult<EnsureCustomLocationResult>> {
  try {
    const res = await api.post<EnsureCustomLocationResult>(`${BASE}/ensure-custom`, payload);
    return { data: extractOne<EnsureCustomLocationResult>(res), error: null, success: true };
  } catch (e) {
    return {
      data: null as unknown as EnsureCustomLocationResult,
      error: e instanceof Error ? e.message : 'Failed to register custom location',
      success: false,
    };
  }
}
