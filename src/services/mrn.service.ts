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

/** Outbound MTR: per line item id — warehouse / MU progression */
export type MtrLineTransferPhase = 'not_initiated' | 'in_transit' | 'received_at_mu' | 'completed';

export interface MRNRecordFromApi {
  id: string;
  mrnNo: string;
  requestedBy: string;
  status: string;
  assignedPicker: string;
  transferTeam: string;
  lineItems: MRNLineItemFromApi[];
  /** Outbound MTR only: map line id → phase */
  lineTransferStatus?: Record<string, MtrLineTransferPhase | string>;
  notes: string;
  bmrNo?: string;
  bprNo?: string;
  productName?: string;
  batchNo?: string;
  /** Outbound MTR: rm | pm (from line items). */
  mtrKind?: 'rm' | 'pm' | null;
  /** BMR no. for RM MTR, BPR no. for PM MTR. */
  sourceRef?: string;
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
  whDispatchZone?: string | null;
  muReceiveZone?: string | null;
  muReceiveRack?: string | null;
  logisticsTrackingNo?: string | null;
  logisticsTransporter?: string | null;
  logisticsDispatchDate?: string | null;
  logisticsEtaDate?: string | null;
  logisticsVehicleNo?: string | null;
  /** Send MTR Required By Date — shown as Expected date in transfer orders. */
  requiredByDate?: string | null;
  createdAt?: string | null;
}

export function inferMtrKindFromMrnLines(
  lineItems: Pick<MRNLineItemFromApi, 'raw_material_id' | 'pack_material_id' | 'unit'>[]
): 'rm' | 'pm' | null {
  const rm = lineItems.some(
    (l) => l.raw_material_id != null || String(l.unit || '').toUpperCase() === 'KG'
  );
  const pm = lineItems.some((l) => {
    if (l.pack_material_id != null) return true;
    const u = String(l.unit || '').toUpperCase();
    return u === 'PCS' || u === 'PC' || u === 'PIECES';
  });
  if (pm && !rm) return 'pm';
  if (rm && !pm) return 'rm';
  if (pm) return 'pm';
  if (rm) return 'rm';
  return null;
}

/** BMR id for RM MTR, BPR id for PM MTR (transfer orders source column). */
export function mrnSourceDocFromApi(
  m: Pick<MRNRecordFromApi, 'source' | 'mtrKind' | 'sourceRef' | 'bmrNo' | 'bprNo' | 'lineItems'>
): { kind: 'bmr' | 'bpr'; id: string } | null {
  if (m.source !== 'MTR') return null;
  const mtrKind = m.mtrKind ?? inferMtrKindFromMrnLines(m.lineItems || []);
  const id = String(m.sourceRef || (mtrKind === 'pm' ? m.bprNo : m.bmrNo) || '').trim();
  if (!id) return null;
  return { kind: mtrKind === 'pm' ? 'bpr' : 'bmr', id };
}

export function formatMrnDisplayDate(value: string | null | undefined): string {
  if (!value || !String(value).trim()) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function mrnLineItemNameSummary(
  lineItems: Pick<MRNLineItemFromApi, 'item' | 'itemCode' | 'notes'>[]
): string {
  if (!lineItems.length) return '—';
  const label = (li: (typeof lineItems)[number]) =>
    String(li.item || li.notes || li.itemCode || '').trim() || 'Item';
  const first = label(lineItems[0]);
  if (lineItems.length === 1) return first;
  return `${first} +${lineItems.length - 1} more`;
}

export function mrnDisplayExpectedDate(
  m: Pick<MRNRecordFromApi, 'requiredByDate'>
): string {
  return formatMrnDisplayDate(m.requiredByDate);
}

export function mrnDisplayPrName(m: Pick<MRNRecordFromApi, 'productName'>): string {
  const name = String(m.productName || '').trim();
  return name || '—';
}

/**
 * Item name for the transfer list: the linked product (BMR transfers) when present,
 * else the first line item's name/code (transfers created directly for an item).
 */
export function mrnDisplayItemName(
  m: Pick<MRNRecordFromApi, 'productName' | 'lineItems'>
): string {
  const pr = String(m.productName || '').trim();
  if (pr) return pr;
  const li = Array.isArray(m.lineItems) && m.lineItems[0] ? m.lineItems[0] : null;
  const fromLine = li ? String(li.item || li.itemCode || '').trim() : '';
  return fromLine || '—';
}

export function mrnDisplayBatchNumber(
  m: Pick<MRNRecordFromApi, 'batchNo' | 'sourceRef' | 'bmrNo' | 'bprNo' | 'mtrKind' | 'source' | 'lineItems'>
): string {
  const batchNo = String(m.batchNo || '').trim();
  if (batchNo) return batchNo;
  const src = mrnSourceDocFromApi(m);
  return src?.id || '—';
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
  /** Outbound MTR: default MU zone (production location) on the MRN */
  muReceiveZone?: string;
  muReceiveRack?: string;
  /** Outbound MTR: warehouse zone stock is issued from */
  whDispatchZone?: string;
  /** Send MTR Required By Date (Production) */
  requiredByDate?: string;
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
  /** Outbound MTR: warehouse — move only these lines from not_initiated → in_transit */
  initiateTransferLineIds?: string[];
  /** Outbound MTR: production — move only these lines from in_transit → received_at_mu */
  receiveAtMuLineIds?: string[];
  /** Outbound MTR: production — complete stock move for these received_at_mu lines */
  completeTransferLineIds?: string[];
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
  logisticsTrackingNo?: string | null;
  logisticsTransporter?: string | null;
  logisticsDispatchDate?: string | null;
  logisticsEtaDate?: string | null;
  logisticsVehicleNo?: string | null;
  requiredByDate?: string | null;
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

/** Prefer server `error` message from failed API responses (e.g. validation). */
export function getApiErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'body' in err) {
    const body = (err as { body?: unknown }).body;
    if (body && typeof body === 'object' && body !== null && 'error' in body) {
      const e = (body as { error?: unknown }).error;
      if (typeof e === 'string' && e.trim()) return e.trim();
    }
  }
  if (err instanceof Error) return err.message;
  return String(err);
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
