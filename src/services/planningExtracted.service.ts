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
  batchCount?: number | null;
  customBatches?: { sizeKg: number }[] | null;
  createdAt?: string;
  updatedAt?: string;
}

export async function fetchPlanningExtractedList(): Promise<PlanningExtractedRow[]> {
  const res = await api.get<PlanningExtractedRow[]>('/api/v1/planning-extracted');
  const data = res?.data ?? res;
  return Array.isArray(data) ? data : [];
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
  bomConfirmedAt?: string;
  customBatches?: CustomBatch[];
  sentBatchIndices?: number[];
}

export interface PlanningExtractedRowWithBatch extends PlanningExtractedRow {
  batchCount?: number | null;
  batchSizeKg?: number | null;
  plannedStartDate?: string | null;
  productionLine?: string | null;
  bomConfirmedAt?: string | null;
  customBatches?: CustomBatch[] | null;
}

export async function updatePlanningExtracted(
  id: string,
  payload: UpdatePlanningExtractedPayload
): Promise<PlanningExtractedRow | null> {
  try {
    const res = await api.patch<PlanningExtractedRow>(`/api/v1/planning-extracted/${id}`, payload);
    const data = res?.data ?? res;
    return data ?? null;
  } catch {
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

export async function createOrUpdatePlanningBatches(
  planningExtractedId: string,
  batches: { sizeKg: number }[]
): Promise<PlanningBatchRow[]> {
  try {
    const res = await api.post<PlanningBatchRow[]>(`/api/v1/planning-extracted/${planningExtractedId}/batches`, {
      batches: batches.map((b) => ({ sizeKg: b.sizeKg })),
    });
    const data = res?.data ?? res;
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
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

/** Add one batch with BOM from product master (not override). Returns the new batch. */
export async function addOneBatchFromMaster(planningExtractedId: string): Promise<PlanningBatchRow | null> {
  try {
    const res = await api.post<PlanningBatchRow>(`/api/v1/planning-extracted/${planningExtractedId}/batches/add-one`, {});
    const data = res?.data ?? res;
    return data ?? null;
  } catch {
    return null;
  }
}

export async function updateBatch(
  planningExtractedId: string,
  batchId: number,
  payload: { rmLines?: unknown[]; pmLines?: unknown[]; sizeKg?: number }
): Promise<PlanningBatchRow | null> {
  try {
    const res = await api.put<PlanningBatchRow>(
      `/api/v1/planning-extracted/${planningExtractedId}/batches/${batchId}`,
      payload
    );
    const data = res?.data ?? res;
    return data ?? null;
  } catch {
    return null;
  }
}

/** All batches across PIs (for Batches menu). */
export interface PlanningBatchAllRow extends PlanningBatchRow {
  sent?: boolean;
  sentBatchIndices?: number[];
  soNumber?: string;
  customerName?: string;
  productName?: string;
  productCode?: string;
  orderQty?: string;
  totalKg?: string;
  dueDate?: string;
  bomStatus?: string;
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
  totalRequired: number;
  unit: string;
  /** Number of production batches (released) that use this item — consolidated view */
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
  /** From warehouse_inventory — same as Warehouse -> Inventory */
  reserved?: number;
  inTransit?: number;
  reorderPt?: number;
  avgMo?: number;
  status?: 'In Stock' | 'Low Stock' | 'Critical' | 'Out of Stock';
}

export async function fetchItemsInvolved(): Promise<ItemsInvolvedRow[]> {
  try {
    const res = await api.get<ItemsInvolvedRow[]>('/api/v1/planning-extracted/items-involved');
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

export async function fetchItemsInvolvedByPlanningId(planningExtractedId: string): Promise<ItemsInvolvedForPiRow[]> {
  try {
    const res = await api.get<ItemsInvolvedForPiRow[]>(`/api/v1/planning-extracted/${planningExtractedId}/items-involved`);
    const data = res?.data ?? res;
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
