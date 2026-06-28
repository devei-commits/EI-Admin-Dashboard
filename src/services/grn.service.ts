/**
 * GRN (Goods Received Note) API — Inbound warehouse.
 */

import { api } from '../lib/apiClient';
import type { GrnQcSpecsStored } from '../lib/grnQcSpecs';

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
  qcSpecs?: GrnQcSpecsStored | null;
  status: string;
  lineItems?: Array<{
    id: string;
    /** Display name (from RM/PM master when enriched). */
    item: string;
    itemName?: string;
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
  /** Per-box units list (length must equal noOfBoxes). */
  unitsPerBoxList?: number[];
  locationPrefix?: string;
  locationZone?: string;
  locationSource?: 'facility' | 'custom';
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

/** Resolved line display name (master name preferred over code). */
export function grnLineItemDisplayName(
  li: { item?: string; itemName?: string; itemCode?: string } | null | undefined
): string {
  if (!li) return '—';
  const name = String(li.item ?? li.itemName ?? '').trim();
  if (name) return name;
  const code = String(li.itemCode ?? '').trim();
  return code || '—';
}

/** Comma-separated item names for GRN Monitor tables (truncates long lists). */
export function grnLineItemsNameSummary(
  lineItems: GRNRecordFromApi['lineItems'] | undefined,
  maxNames = 2
): string {
  const lines = lineItems ?? [];
  if (lines.length === 0) return '—';
  const names = lines.map((li) => grnLineItemDisplayName(li)).filter((n) => n !== '—');
  if (names.length === 0) return '—';
  const head = names.slice(0, maxNames);
  const extra = names.length - head.length;
  const text = head.join(', ');
  return extra > 0 ? `${text} +${extra} more` : text;
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

export interface GrnQcReferenceResponse {
  qcSpecs: GrnQcSpecsStored;
  derivedQcStatus: string;
}

/** Master quality specs merged with saved GRN QC results. */
export async function fetchGRNQcReference(id: string): Promise<GrnQcReferenceResponse> {
  return api.get<GrnQcReferenceResponse>(`/api/v1/grn/${id}/qc-reference`);
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
  qcSpecs?: GrnQcSpecsStored | null;
  status?: string;
  lineItems?: GRNRecordFromApi['lineItems'];
  workflowSteps?: string[];
  invoiceNo?: string | null;
  invoiceAmount?: number | null;
  noOfBoxes?: number | null;
  unitsPerBox?: number | null;
  locationPrefix?: string | null;
  locationZone?: string | null;
  /** When "custom", backend routes put-away to the facility default warehouse zone/rack. */
  locationSource?: 'facility' | 'custom';
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

// ─── Shipment Batch + Initiate Transit (Procurement spec §4A / §4B) ──────────
export interface TransitVehicle {
  vehicleNo?: string;
  driverName?: string;
  driverPhone?: string;
  transporter?: string;
  shippedDate?: string;
  vendorInvoiceNo?: string;
  expectedArrival?: string;
}
export interface InitiateTransitPayload {
  poId?: number | string | null;
  poNo: string;
  vendor?: string;
  item: { code: string; name: string; type?: string };
  shippedQty: number;
  vehicle: TransitVehicle;
}
export interface ConsolidatedShipmentPayload {
  poId?: number | string | null;
  poNo: string;
  vendor?: string;
  lines: { code: string; name: string; type?: string; shippedQty: number }[];
  vehicle: TransitVehicle;
}
export interface ShipmentBatchResult {
  shipmentBatch: { id: number; code: string; vehicleNo?: string | null };
  grns: { id: number; grnNo: string; stage: string }[];
}
export async function initiateTransit(payload: InitiateTransitPayload): Promise<ShipmentBatchResult> {
  return api.post<ShipmentBatchResult>('/api/v1/grn/initiate-transit', payload);
}
export async function createConsolidatedShipment(payload: ConsolidatedShipmentPayload): Promise<ShipmentBatchResult> {
  return api.post<ShipmentBatchResult>('/api/v1/grn/consolidated-shipment', payload);
}

// ─── GRN Tracker (Procurement spec View 5, §7) ───────────────────────────────
export interface GrnTrackerRow {
  id: number;
  grnNo: string;
  sbId: number | null;
  sbCode: string | null;
  poNo: string | null;
  vendor: string | null;
  type: string | null;
  item: { code: string; name: string };
  poQty: number;
  shippedQty: number;
  shippedDate: string | null;
  expectedDate: string | null;
  stage: string;
  status: string | null;
  vehicleNo: string | null;
}
export async function fetchGrnTracker(filters?: { stage?: string; vendor?: string; sb?: string }): Promise<GrnTrackerRow[]> {
  const qs = new URLSearchParams();
  if (filters?.stage) qs.set('stage', filters.stage);
  if (filters?.vendor) qs.set('vendor', filters.vendor);
  if (filters?.sb) qs.set('sb', filters.sb);
  const q = qs.toString();
  return api.get<GrnTrackerRow[]>(`/api/v1/grn/tracker${q ? `?${q}` : ''}`);
}
export async function advanceGrnStage(id: number | string, stage: string): Promise<{ id: number; grnNo: string; stage: string; status: string }> {
  return api.put<{ id: number; grnNo: string; stage: string; status: string }>(`/api/v1/grn/${id}/stage`, { stage });
}
