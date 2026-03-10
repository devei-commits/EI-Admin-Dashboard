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
  bmrNo?: string;
  source?: string;
  /** true = Inbound from MU (MU→WH); false = Outbound to MU (WH→MU). */
  isInboundFromMu?: boolean;
}

export interface CreateMRNPayload {
  mrnNo?: string;
  requestedBy?: string;
  status?: string;
  assignedPicker?: string;
  transferTeam?: string;
  lineItems: Array<{ id?: string; code?: string; itemCode?: string; raw_material_id?: number; pack_material_id?: number; quantity: number; unit: string; notes?: string }>;
  notes?: string;
  bmrNo?: string;
  source?: string;
  isInboundFromMu?: boolean;
  itemType?: 'rm' | 'pm';
}

export async function fetchMRNList(): Promise<MRNRecordFromApi[]> {
  const res = await api.get<MRNRecordFromApi[]>('/api/v1/mrn');
  const list = (res as any)?.data ?? res;
  return Array.isArray(list) ? list : [];
}

export async function createMRN(payload: CreateMRNPayload): Promise<MRNRecordFromApi> {
  const res = await api.post<MRNRecordFromApi>('/api/v1/mrn', payload);
  return (res as any)?.data ?? res;
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
  isInboundFromMu?: boolean;
}

export async function updateMRN(id: string, payload: UpdateMRNPayload): Promise<MRNRecordFromApi> {
  return api.put<MRNRecordFromApi>(`/api/v1/mrn/${id}`, payload);
}
