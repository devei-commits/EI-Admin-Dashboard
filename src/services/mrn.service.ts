/**
 * MRN (Material / Stock Request Note) API — Outbound warehouse.
 */

import { api } from '../lib/apiClient';

export interface MRNLineItemFromApi {
  id: string;
  item?: string;
  itemCode?: string;
  quantity: number;
  unit: string;
  notes?: string;
  raw_material_id?: number;
  pack_material_id?: number;
  product_id?: number;
}

export interface MRNRecordFromApi {
  id: string;
  mrnNo: string;
  requestedBy: string;
  status: string;
  assignedPicker: string;
  transferTeam: string;
  lineItems: MRNLineItemFromApi[];
  notes: string;
}

export async function fetchMRNList(): Promise<MRNRecordFromApi[]> {
  const list = await api.get<MRNRecordFromApi[]>('/api/v1/mrn');
  return Array.isArray(list) ? list : [];
}

export interface AssignablePicker {
  id: number;
  email: string;
  displayName: string;
}

export async function fetchMRNAssignablePickers(): Promise<AssignablePicker[]> {
  const list = await api.get<AssignablePicker[]>('/api/v1/mrn/assignable-pickers');
  return Array.isArray(list) ? list : [];
}

export interface UpdateMRNPayload {
  requestedBy?: string;
  status?: string;
  assignedPicker?: string;
  transferTeam?: string;
  lineItems?: MRNLineItemFromApi[];
  notes?: string;
}

export async function updateMRN(id: string, payload: UpdateMRNPayload): Promise<MRNRecordFromApi> {
  return api.put<MRNRecordFromApi>(`/api/v1/mrn/${id}`, payload);
}
