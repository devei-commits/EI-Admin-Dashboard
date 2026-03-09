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

/** Items Involved — from confirmed BOMs only (backend aggregates RM/PM + warehouse SIH). */
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
  sih: number;
  surplusShortage: number;
  coverage: number;
  /** Warehouse inventory row id — use for backend updates. */
  warehouseInventoryId: number | null;
  /** Batch number e.g. WH-2026-RM-001, WH-2026-PM-001 */
  batchNumber: string | null;
  /** Expiry date (YYYY-MM-DD) from warehouse batch */
  expiryDate: string | null;
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
