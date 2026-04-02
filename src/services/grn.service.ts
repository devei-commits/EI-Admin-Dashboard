/**
 * GRN (Goods Received Note) API — Inbound warehouse.
 */

import { api } from '../lib/apiClient';

export interface GRNRecordFromApi {
  id: string;
  grnNo: string;
  poNo: string;
  vendor: string;
  type: 'RM' | 'PM';
  items: number;
  poValue: number;
  expectedDate: string;
  receivedDate: string | null;
  assignedTo: string;
  qcStatus: string;
  qcBy: string;
  status: string;
  lineItems?: Array<{
    id: string;
    item: string;
    itemCode: string;
    poQty: number;
    rcvdQty: number;
    invoiceQty: number;
    unitPrice: number;
    diff: number;
    qcStatus: string;
    qcBy: string;
  }>;
  workflowSteps?: string[];
  invoiceNo?: string | null;
  invoiceAmount?: number | null;
  grnDate?: string | null;
  noOfBoxes?: number | null;
  unitsPerBox?: number | null;
  lastBoxUnits?: number | null;
  locationPrefix?: string | null;
  locationZone?: string | null;
  grnBatchMfg?: string | null;
  expiry?: string | null;
  mfgBatch?: string | null;
  generatedLabels?: GeneratedLabel[] | null;
}

export interface GeneratedLabel {
  boxIndex: number;
  qrPayload: string;
  qrImageDataUrl: string;
}

export interface GenerateLabelsPayload {
  noOfBoxes?: number;
  unitsPerBox?: number;
  /** Items in the last box when it is not a full carton (boxes 1..n-1 use unitsPerBox). */
  lastBoxUnits?: number | null;
  locationPrefix?: string;
  locationZone?: string;
  grnBatchMfg?: string;
  expiry?: string;
  mfgBatch?: string;
  productName?: string;
  itemCode?: string;
}

export async function generateGRNLabels(
  id: string,
  payload?: GenerateLabelsPayload
): Promise<{ labels: GeneratedLabel[]; workflowSteps?: string[] }> {
  const res = await api.post<{ labels: GeneratedLabel[]; workflowSteps?: string[] }>(`/api/v1/grn/${id}/generate-labels`, payload ?? {});
  return res;
}

export async function fetchGRNList(): Promise<GRNRecordFromApi[]> {
  const list = await api.get<GRNRecordFromApi[]>('/api/v1/grn');
  return Array.isArray(list) ? list : [];
}

/** Users with permission to be assigned to a GRN (for "Assigned To" dropdown). */
export interface AssignableUser {
  id: number;
  email: string;
  displayName: string;
}

export async function fetchGRNAssignableUsers(): Promise<AssignableUser[]> {
  const list = await api.get<AssignableUser[]>('/api/v1/grn/assignable-users');
  return Array.isArray(list) ? list : [];
}

export async function fetchGRNById(id: string): Promise<GRNRecordFromApi | null> {
  try {
    const row = await api.get<GRNRecordFromApi>(`/api/v1/grn/${id}`);
    return row ?? null;
  } catch {
    return null;
  }
}

export interface CreateGRNPayload {
  grnNo: string;
  poNo?: string;
  purchase_order_id?: number;
  vendor?: string;
  type?: 'RM' | 'PM';
  items?: number;
  poValue?: number;
  expectedDate?: string;
  receivedDate?: string | null;
  assignedTo?: string;
  qcStatus?: string;
  status?: string;
  lineItems?: GRNRecordFromApi['lineItems'];
  workflowSteps?: string[];
  invoiceNo?: string | null;
  invoiceAmount?: number | null;
  grnDate?: string | null;
}

export async function createGRN(payload: CreateGRNPayload): Promise<GRNRecordFromApi> {
  return api.post<GRNRecordFromApi>('/api/v1/grn', payload);
}

export interface UpdateGRNPayload {
  assignedTo?: string;
  grnDate?: string | null;
  receivedDate?: string | null;
  qcStatus?: string;
  qcBy?: string | null;
  status?: string;
  lineItems?: GRNRecordFromApi['lineItems'];
  workflowSteps?: string[];
  invoiceNo?: string | null;
  invoiceAmount?: number | null;
  noOfBoxes?: number | null;
  unitsPerBox?: number | null;
  lastBoxUnits?: number | null;
  locationPrefix?: string | null;
  locationZone?: string | null;
  grnBatchMfg?: string | null;
  expiry?: string | null;
  mfgBatch?: string | null;
}

export async function updateGRN(id: string, payload: UpdateGRNPayload): Promise<GRNRecordFromApi> {
  return api.put<GRNRecordFromApi>(`/api/v1/grn/${id}`, payload);
}

export async function deleteGRN(id: string): Promise<void> {
  await api.delete(`/api/v1/grn/${id}`);
}
