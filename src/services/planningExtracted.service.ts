/**
 * Planning Extracted (PRs / PIs Extracted) — planning team view of SO lines.
 * GET list, GET by id, PATCH for bomStatus etc.
 */

import { api } from '../lib/apiClient';

export interface PlanningExtractedRawMaterial {
  id?: string;
  raw_material_id?: number;
  name: string;
  quantity: number;
  unit: string;
  percentage?: number;
  code?: string;
}

export interface PlanningExtractedPackagingMaterial {
  id?: string;
  pack_material_id?: number;
  name: string;
  quantity: number;
  unit: string;
  value?: number;
  percentage?: number;
  code?: string;
}

export interface PlanningSlaMeta {
  elapsedHours: number;
  label: string;
  sub: string;
  tone: 'green' | 'amber' | 'red';
  startedAt?: string | null;
  stoppedAt?: string | null;
  timezone?: string;
}

export interface PlanningExtractedRow {
  id: string;
  soNumber: string;
  salesOrderId?: number;
  customerName?: string;
  expectedShipmentDate?: string;
  soStatus?: string;
  productName: string;
  productCode: string;
  orderQty: string;
  totalKg: string;
  orderDate: string;
  dueDate: string;
  daysLeft: string;
  batchSize: string;
  batchesRequired: number;
  bomStatus: string;
  approvedBy: string;
  rawMaterials: PlanningExtractedRawMaterial[];
  packagingMaterials: PlanningExtractedPackagingMaterial[];
  color?: string;
  sales_order_id?: number;
  product_id?: number;
  /** Indices of batches already sent to production */
  sentBatchIndices?: number[];
  /** Indices of buffer / over-production batches (made above the SO qty) */
  bufferBatchIndices?: number[];
  batchCount?: number | null;
  customBatches?: { sizeKg: number }[] | null;
  /** Single BOM-level Specific Gravity chosen at first-batch confirmation (null until BOM is confirmed). */
  bomSpecificGravity?: number | null;
  /** Timestamp when the planner confirmed BOM + SG; null means BOM is not yet confirmed. */
  bomConfirmedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  /** Server-computed 48h SLA (Asia/Kolkata); prefer over client-side orderDate math. */
  planningSla?: PlanningSlaMeta;
}

function normalizePlanningExtractedListResponse(payload: unknown): PlanningExtractedRow[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const o = payload as { data?: unknown; rows?: unknown };
    if (Array.isArray(o.data)) return o.data as PlanningExtractedRow[];
    if (Array.isArray(o.rows)) return o.rows as PlanningExtractedRow[];
  }
  return [];
}

export async function fetchPlanningExtractedList(): Promise<PlanningExtractedRow[]> {
  const res = await api.get<PlanningExtractedRow[] | { data?: PlanningExtractedRow[]; rows?: PlanningExtractedRow[] }>(
    '/api/v1/planning-extracted'
  );
  const data = (res as { data?: unknown })?.data ?? res;
  return normalizePlanningExtractedListResponse(data);
}

export async function fetchPlanningExtractedById(id: string): Promise<PlanningExtractedRow | null> {
  try {
    const res = await api.get<PlanningExtractedRow>(`/api/v1/planning-extracted/${id}`);
    const data = res?.data ?? res;
    return data ?? null;
  } catch {
    return null;
  }
}

export interface CustomBatch {
  sizeKg: number;
}

export interface UpdatePlanningExtractedPayload {
  bomStatus?: string;
  approvedBy?: string;
  order_qty_display?: string;
  total_kg_display?: string;
  order_date?: string;
  due_date?: string;
  batch_size_display?: string;
  batches_required?: number;
  raw_materials?: PlanningExtractedRawMaterial[];
  packaging_materials?: PlanningExtractedPackagingMaterial[];
  color?: string;
  batchCount?: number;
  batchSizeKg?: number;
  plannedStartDate?: string;
  productionLine?: string;
  bomConfirmedAt?: string | null;
  /** Single BOM-level Specific Gravity (fans out to rm_lines[].specific_gravity on the backend). */
  bomSpecificGravity?: number | null;
  customBatches?: CustomBatch[];
  sentBatchIndices?: number[];
  bufferBatchIndices?: number[];
}

export interface PlanningExtractedRowWithBatch extends PlanningExtractedRow {
  batchCount?: number | null;
  batchSizeKg?: number | null;
  plannedStartDate?: string | null;
  productionLine?: string | null;
  bomConfirmedAt?: string | null;
  bomSpecificGravity?: number | null;
  customBatches?: CustomBatch[] | null;
}

function throwIfApiErrorBody(e: unknown): void {
  const err = e as Error & { body?: unknown };
  if (err?.body && typeof err.body === 'object' && err.body !== null && 'error' in err.body) {
    const msg = (err.body as { error?: unknown }).error;
    if (typeof msg === 'string' && msg.trim()) throw new Error(msg);
  }
}

export async function updatePlanningExtracted(
  id: string,
  payload: UpdatePlanningExtractedPayload
): Promise<PlanningExtractedRow | null> {
  try {
    const res = await api.patch<PlanningExtractedRow>(`/api/v1/planning-extracted/${id}`, payload);
    const data = res?.data ?? res;
    return data ?? null;
  } catch (e) {
    throwIfApiErrorBody(e);
    return null;
  }
}

/** Custom BOM override for a planning extracted row (swapped/edited in Plan Batches). */
export interface PlanningBomOverrideRow {
  rmLines: Array<{ phase?: string; inci_name?: string; rm_code?: string; pct_w_w?: number; uom?: string; raw_material_id?: number }>;
  pmLines: Array<{ pm_code?: string; description?: string; qty_per_unit?: number; uom?: string }>;
}

export async function fetchBomOverride(planningExtractedId: string): Promise<PlanningBomOverrideRow | null> {
  try {
    const res = await api.get<PlanningBomOverrideRow>(`/api/v1/planning-extracted/${planningExtractedId}/bom-override`);
    const data = res?.data ?? res;
    return data ?? null;
  } catch {
    return null;
  }
}

export async function putBomOverride(
  planningExtractedId: string,
  payload: PlanningBomOverrideRow
): Promise<PlanningBomOverrideRow | null> {
  try {
    const res = await api.put<PlanningBomOverrideRow>(`/api/v1/planning-extracted/${planningExtractedId}/bom-override`, payload);
    const data = res?.data ?? res;
    return data ?? null;
  } catch {
    return null;
  }
}

/** Batch-specific BOM copy (saved when batch plan is saved; each batch gets id e.g. PE-5-B1 and current BOM copy). */
export interface PlanningBatchRow {
  id: number;
  planningExtractedId: number;
  sequence: number;
  batchCode: string;
  sizeKg: number | null;
  rmLines: unknown[];
  pmLines: unknown[];
  /** Linked production BMR status when batch was sent to Production. */
  productionBmrStatus?: string | null;
  /** False once Production confirms the batch (`bmr_status` past `draft`). */
  editable?: boolean;
}

export async function fetchPlanningBatches(planningExtractedId: string): Promise<PlanningBatchRow[]> {
  try {
    const res = await api.get<PlanningBatchRow[]>(`/api/v1/planning-extracted/${planningExtractedId}/batches`);
    const data = res?.data ?? res;
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function errorMessageFromApiCatch(e: unknown, fallback: string): string {
  const err = e as Error & { body?: { error?: string } };
  if (err.body && typeof err.body === 'object' && err.body !== null && 'error' in err.body) {
    const msg = (err.body as { error: unknown }).error;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return err.message && err.message !== 'Failed to fetch' ? err.message : fallback;
}

export async function createOrUpdatePlanningBatches(
  planningExtractedId: string,
  batches: { sizeKg: number }[],
  options?: { updateOnlyBatchId?: number }
): Promise<PlanningBatchRow[]> {
  try {
    const body: { batches: { sizeKg: number }[]; updateOnlyBatchId?: number } = {
      batches: batches.map((b) => ({ sizeKg: b.sizeKg })),
    };
    if (options?.updateOnlyBatchId != null) {
      body.updateOnlyBatchId = options.updateOnlyBatchId;
    }
    const data = await api.post<PlanningBatchRow[]>(`/api/v1/planning-extracted/${planningExtractedId}/batches`, body);
    return Array.isArray(data) ? data : [];
  } catch (e: unknown) {
    throw new Error(errorMessageFromApiCatch(e, 'Failed to save batches'));
  }
}

export async function fetchBatchById(planningExtractedId: string, batchId: number): Promise<PlanningBatchRow | null> {
  try {
    const res = await api.get<PlanningBatchRow>(`/api/v1/planning-extracted/${planningExtractedId}/batches/${batchId}`);
    const data = res?.data ?? res;
    return data ?? null;
  } catch {
    return null;
  }
}

/** Add one batch with BOM from product master (not override). Returns the new batch. Throws on API error body. */
export async function addOneBatchFromMaster(planningExtractedId: string): Promise<PlanningBatchRow | null> {
  try {
    const data = await api.post<PlanningBatchRow>(`/api/v1/planning-extracted/${planningExtractedId}/batches/add-one`, {});
    return data ?? null;
  } catch (e: unknown) {
    const msg = errorMessageFromApiCatch(e, '');
    if (msg) throw new Error(msg);
    return null;
  }
}

export async function updateBatch(
  planningExtractedId: string,
  batchId: number,
  payload: { rmLines?: unknown[]; pmLines?: unknown[]; sizeKg?: number | null; batchCode?: string }
): Promise<PlanningBatchRow | null> {
  try {
    const res = await api.put<PlanningBatchRow>(
      `/api/v1/planning-extracted/${planningExtractedId}/batches/${batchId}`,
      payload
    );
    const data = res?.data ?? res;
    return data ?? null;
  } catch (e: unknown) {
    const msg = errorMessageFromApiCatch(e, 'Could not save batch');
    if (msg) throw new Error(msg);
    return null;
  }
}

/** All batches across PIs (for Batches menu). */
export interface PlanningBatchAllRow extends PlanningBatchRow {
  sent?: boolean;
  sentBatchIndices?: number[];
  createdAt?: string | null;
  soNumber?: string;
  customerName?: string;
  productName?: string;
  productCode?: string;
  orderQty?: string;
  totalKg?: string;
  orderDate?: string;
  dueDate?: string;
  bomStatus?: string;
  productId?: number | null;
}

export async function fetchAllBatches(): Promise<PlanningBatchAllRow[]> {
  try {
    const res = await api.get<PlanningBatchAllRow[]>('/api/v1/planning-extracted/batches/all');
    const data = res?.data ?? res;
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Per-SO sent batch indices (0-based). Used by Production to allow scheduling only for batches sent from Planning. */
export interface SentBatchSummaryRow {
  soNumber: string;
  sentBatchIndices: number[];
}

export async function fetchSentBatchSummary(): Promise<SentBatchSummaryRow[]> {
  try {
    const res = await api.get<SentBatchSummaryRow[]>('/api/v1/planning-extracted/sent-summary');
    const data = res?.data ?? res;
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Items Involved — from batches released to production (sent); when none sent, from confirmed BOMs. */
export interface ItemsInvolvedRow {
  type: 'RM' | 'PM';
  raw_material_id: number | null;
  pack_material_id: number | null;
  code: string;
  name: string;
  category: string;
  usedInProducts: string[];
  planningExtractedIds: number[];
  /** Full BOM demand (confirmed PIs) — compare to SIH / procurement. */
  totalRequired: number;
  /** Gross minus qty already captured in **sent** planning_batches (draft next-batch rows excluded). */
  unallocatedToBatches?: number;
  unit: string;
  /** Batches sent to production that use this item (draft planning_batches excluded). */
  batchCount?: number;
  sih: number;
  surplusShortage: number;
  coverage: number;
  /** Warehouse inventory row id — use for backend updates. */
  warehouseInventoryId: number | null;
  /** Batch number e.g. WH-2026-RM-001, WH-2026-PM-001 */
  batchNumber: string | null;
  /** Expiry date (YYYY-MM-DD) from warehouse batch */
  expiryDate: string | null;
  /** From warehouse_inventory — same as Warehouse -> Inventory (GLOBAL per-item reserved). */
  reserved?: number;
  /**
   * Reserved specifically for THESE PIs' batches (reserved_batch_items scoped by
   * planning_extracted_id). Spec §6.3 "Reserved" supply term: `sih` is free stock (net of ALL
   * reservations), so scopedReserved re-credits stock earmarked for this demand. RM in primary
   * display unit (kg→primary converted), PM in PCS.
   */
  scopedReserved?: number;
  /**
   * Stage-flow planned balance: qty from Release to Planning not yet on any PO line.
   * `totalReleased` is PR + Planning PE-* draft PO (not BOM confirm / planning_batches).
   */
  plannedQty?: number;
  /** Stage-flow PO balance: totalOnPO minus what has already shipped (in-transit) or been received. */
  poQty?: number;
  /** Stage-flow in-transit balance: shipped but not yet received via GRN Complete. */
  inTransitQty?: number;
  /** Stage-flow warehouse balance: stock_in_hand after GRN Complete receipts. */
  whQty?: number;
  /** Qty from Release to Planning (max PR vs Planning-linked draft PO) for this item + PIs. */
  totalReleased?: number;
  /** Qty allocated in planning_batches (BOM/batch plan) — separate from Release to Planning; for reference only. */
  batchAllocatedQty?: number;
  totalOnPO?: number;
  totalReceived?: number;
  /** Legacy field: warehouse_inventory.in_transit (KG-normalized). Kept for back-compat. */
  inTransit?: number;
  reorderPt?: number;
  avgMo?: number;
  status?: 'In Stock' | 'Low Stock' | 'Critical' | 'Out of Stock';
}

export async function fetchItemsInvolved(opts?: { includeZeroRequired?: boolean }): Promise<ItemsInvolvedRow[]> {
  try {
    const includeZero = opts?.includeZeroRequired ? '?includeZeroRequired=1' : '';
    const res = await api.get<ItemsInvolvedRow[]>(`/api/v1/planning-extracted/items-involved${includeZero}`);
    const data = res?.data ?? res;
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Items involved for a single planning-extracted line (RM/PM + SIH, reserved, netStock). */
export interface ItemsInvolvedForPiRow extends ItemsInvolvedRow {
  id?: string;
  item?: string;
  totalRequired?: number;
  sih?: number;
  reserved?: number;
  netStock?: number;
}

function normalizeItemsInvolvedResponse(payload: unknown): ItemsInvolvedForPiRow[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const o = payload as { data?: unknown; rows?: unknown };
    if (Array.isArray(o.data)) return o.data as ItemsInvolvedForPiRow[];
    if (Array.isArray(o.rows)) return o.rows as ItemsInvolvedForPiRow[];
  }
  return [];
}

export async function fetchItemsInvolvedByPlanningId(planningExtractedId: string): Promise<ItemsInvolvedForPiRow[]> {
  try {
    const res = await api.get<ItemsInvolvedForPiRow[] | { data?: ItemsInvolvedForPiRow[]; rows?: ItemsInvolvedForPiRow[] }>(
      `/api/v1/planning-extracted/${planningExtractedId}/items-involved`
    );
    const data = (res as { data?: unknown })?.data ?? res;
    return normalizeItemsInvolvedResponse(data);
  } catch {
    return [];
  }
}
