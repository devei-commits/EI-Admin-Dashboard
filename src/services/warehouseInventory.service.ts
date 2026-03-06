/**
 * Warehouse Inventory — from backend GET /api/v1/warehouse-inventory (RM/PM/PR + item groups).
 * stock_in_hand = wh_stock + ml1_stock + ml2_stock (backend computes; frontend uses for display).
 */

import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';
import type { ItemGroupRecord } from './itemGroups.service';

export type WarehouseItemType = 'RM' | 'PM' | 'FG/PR';

export interface WarehouseInventoryRow {
  id: string;
  code: string;
  name: string;
  subtitle: string;
  type: WarehouseItemType;
  itemGroupNames: string[];
  itemGroupCodes: string[];
  sourceId: number;
  /** Backend warehouse_inventory.id for PATCH adjust stock */
  warehouseInventoryId?: number;
  zone: string;
  rack: string;
  whStock: number;
  whUnit: string;
  ml1Stock: number;
  ml2Stock: number;
  /** WH + ML1 + ML2 (backend computes; frontend may recompute on adjust) */
  stockInHand: number;
  reserved: number;
  inTransit: number;
  reorderPt: number;
  avgMo: number;
  status: 'In Stock' | 'Low Stock' | 'Critical' | 'Out of Stock';
}

const LOG = true;
function log(message: string, data?: unknown) {
  if (LOG && typeof console !== 'undefined' && console.log) {
    if (data !== undefined) console.log(`[warehouse-inventory] ${message}`, data);
    else console.log(`[warehouse-inventory] ${message}`);
  }
}

/** Backend API response row shape */
interface ApiWarehouseRow {
  id: string;
  warehouseInventoryId?: number;
  code: string;
  name: string;
  subtitle: string;
  type: 'RM' | 'PM' | 'FG/PR';
  sourceId: number;
  itemGroupNames: string[];
  itemGroupCodes: string[];
  zone: string;
  rack: string;
  whStock: number;
  whUnit: string;
  ml1Stock: number;
  ml2Stock: number;
  stockInHand: number;
  reserved: number;
  inTransit: number;
  reorderPt: number;
  avgMo: number;
  status: 'In Stock' | 'Low Stock' | 'Critical' | 'Out of Stock';
}

export async function fetchWarehouseInventory(): Promise<ServiceResult<{
  rows: WarehouseInventoryRow[];
  itemGroups: ItemGroupRecord[];
}>> {
  try {
    const res = await api.get<{ rows: ApiWarehouseRow[]; itemGroups: ItemGroupRecord[] }>('/api/v1/warehouse-inventory');
    const data = res?.data ?? res;
    const rawRows = (data && Array.isArray(data.rows)) ? data.rows : [];
    const rows: WarehouseInventoryRow[] = rawRows.map((r) => ({
      id: r.id,
      warehouseInventoryId: r.warehouseInventoryId,
      code: r.code,
      name: r.name,
      subtitle: r.subtitle,
      type: r.type,
      sourceId: r.sourceId,
      itemGroupNames: r.itemGroupNames ?? [],
      itemGroupCodes: r.itemGroupCodes ?? [],
      zone: r.zone ?? '—',
      rack: r.rack ?? '—',
      whStock: Number(r.whStock) || 0,
      whUnit: r.whUnit ?? 'KG',
      ml1Stock: Number(r.ml1Stock) || 0,
      ml2Stock: Number(r.ml2Stock) || 0,
      stockInHand: (Number(r.stockInHand) ?? (Number(r.whStock) + Number(r.ml1Stock) + Number(r.ml2Stock))) || 0,
      reserved: Number(r.reserved) || 0,
      inTransit: Number(r.inTransit) || 0,
      reorderPt: Number(r.reorderPt) || 0,
      avgMo: Number(r.avgMo) || 0,
      status: r.status || 'In Stock',
    }));
    const itemGroups = Array.isArray(data?.itemGroups) ? data.itemGroups : [];
    log('Loaded from backend', { rowCount: rows.length, itemGroupCount: itemGroups.length });
    return { data: { rows, itemGroups }, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load warehouse inventory';
    log('Backend warehouse-inventory API failed', message);
    return { data: { rows: [], itemGroups: [] }, error: message, success: false };
  }
}

export interface UpdateWarehouseStockPayload {
  wh_stock?: number;
  ml1_stock?: number;
  ml2_stock?: number;
  reserved?: number;
  in_transit?: number;
  zone?: string;
  rack?: string;
  qc_status?: string;
}

/** PATCH warehouse inventory row (adjust stock). Backend recomputes stock_in_hand = wh + ml1 + ml2. */
export async function updateWarehouseStock(
  warehouseInventoryId: number,
  payload: UpdateWarehouseStockPayload
): Promise<ServiceResult<{ wh_stock: number; ml1_stock: number; ml2_stock: number; stock_in_hand: number; reserved: number; in_transit: number }>> {
  try {
    const res = await api.patch<{
      wh_stock: number;
      ml1_stock: number;
      ml2_stock: number;
      stock_in_hand: number;
      reserved: number;
      in_transit: number;
    }>(`/api/v1/warehouse-inventory/${warehouseInventoryId}`, payload);
    const data = res?.data ?? res;
    log('Updated warehouse stock', { warehouseInventoryId, payload, response: data });
    return { data: data as any, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update warehouse stock';
    log('Update warehouse stock failed', { warehouseInventoryId, error: message });
    return { data: null as any, error: message, success: false };
  }
}
