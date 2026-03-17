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

export interface GeneratedMRNLabel {
  boxIndex: number;
  qrPayload: string;
  qrImageDataUrl: string;
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
  receivedAtMu?: string | null;
  generatedLabels?: GeneratedMRNLabel[] | null;
  noOfBoxes?: number | null;
  unitsPerBox?: number | null;
  locationPrefix?: string | null;
  grnBatchMfg?: string | null;
  expiry?: string | null;
  mfgBatch?: string | null;
  muReceiveZone?: string | null;
  muReceiveRack?: string | null;
  createdAt?: string | null;
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

/** Fetch all MRNs, optionally filtered by transferType: 'outbound' (WH→MU) or 'inbound_from_mu' (MU→WH). */
export async function fetchMRNList(params?: { transferType?: 'outbound' | 'inbound_from_mu' }): Promise<MRNRecordFromApi[]> {
  const query = params?.transferType ? `?transferType=${params.transferType}` : '';
  const res = await api.get<MRNRecordFromApi[]>(`/api/v1/mrn${query}`);
  const list = (res as any)?.data ?? res;
  return Array.isArray(list) ? list : [];
}

export async function fetchMRNById(id: string): Promise<MRNRecordFromApi> {
  const res = await api.get<MRNRecordFromApi>(`/api/v1/mrn/${id}`);
  return (res as any)?.data ?? res;
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
  receivedAtMu?: string | null;
  generatedLabels?: GeneratedMRNLabel[] | null;
  noOfBoxes?: number | null;
  unitsPerBox?: number | null;
  locationPrefix?: string | null;
  grnBatchMfg?: string | null;
  expiry?: string | null;
  mfgBatch?: string | null;
  muReceiveZone?: string | null;
  muReceiveRack?: string | null;
}

export interface GenerateMRNLabelsPayload {
  noOfBoxes?: number;
  unitsPerBox?: number;
  locationPrefix?: string;
  grnBatchMfg?: string;
  expiry?: string;
  mfgBatch?: string;
  productName?: string;
  itemCode?: string;
}

export async function updateMRN(id: string, payload: UpdateMRNPayload): Promise<MRNRecordFromApi> {
  return api.put<MRNRecordFromApi>(`/api/v1/mrn/${id}`, payload);
}

export async function generateMRNLabels(
  id: string,
  payload?: GenerateMRNLabelsPayload
): Promise<{ labels: GeneratedMRNLabel[] }> {
  const res = await api.post<{ labels: GeneratedMRNLabel[] }>(`/api/v1/mrn/${id}/generate-labels`, payload ?? {});
  return (res as any)?.data ?? res;
}

export interface MRNLocationHistoryEntry {
  id: number;
  warehouseInventoryId: number;
  itemType: string;
  rawMaterialId?: number | null;
  packMaterialId?: number | null;
  productId?: number | null;
  fromZone?: string | null;
  fromRack?: string | null;
  toZone?: string | null;
  toRack?: string | null;
  qtyDelta?: number | null;
  actionType?: string | null;
  movedAt: string;
}

export async function fetchMRNLocationHistory(id: string): Promise<MRNLocationHistoryEntry[]> {
  const res = await api.get<{ history: MRNLocationHistoryEntry[] }>(`/api/v1/mrn/${id}/location-history`);
  const data = (res as any)?.data ?? res;
  return Array.isArray(data?.history) ? data.history : [];
}
