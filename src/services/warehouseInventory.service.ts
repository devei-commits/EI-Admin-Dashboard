/**
 * Warehouse Inventory — from backend GET /api/v1/warehouse-inventory (RM/PM/PR + item groups).
 * stock_in_hand = wh_stock + ml1_stock + ml2_stock (backend computes; frontend uses for display).
 */

import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';
import type { ItemGroupRecord } from './itemGroups.service';

export type WarehouseItemType = 'RM' | 'PM' | 'FG/PR';

export interface InTransitBreakdownItem {
  vendor: string;
  poId: number | null;
  poNo: string;
  expectedDate: string | null;
  quantity: number;
}

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
  /** In-transit lines from pending GRNs: vendor, PO id, expected date */
  inTransitBreakdown?: InTransitBreakdownItem[];
  /** Total quantity from purchase orders (vendor) */
  poQuantity?: number;
  reorderPt: number;
  avgMo: number;
  /** Display status (may include threshold-derived values or custom qc_status) */
  status: string;
  /** Raw qc_status from warehouse_inventory (editor + history) */
  qcStatus?: string;
  batchNumber?: string | null;
  expiryDate?: string | null;
}

/** Match list PATCH display logic: threshold overrides when qc is default "In Stock". */
export function deriveWarehouseInventoryDisplayStatus(
  qcStatus: string | null | undefined,
  stockInHand: number,
  reorderPt: number
): 'In Stock' | 'Low Stock' | 'Critical' | 'Out of Stock' | string {
  let status = (qcStatus || 'In Stock').trim();
  if (status === 'In Stock' && reorderPt > 0) {
    if (stockInHand < reorderPt * 0.5) return 'Critical';
    if (stockInHand < reorderPt) return 'Low Stock';
  }
  return status || 'In Stock';
}

export const INVENTORY_AUDIT_FIELD_LABELS: Record<string, string> = {
  wh_stock: 'WH stock',
  ml1_stock: 'ML1 stock',
  ml2_stock: 'ML2 stock',
  stock_in_hand: 'Stock in hand',
  reserved: 'Reserved',
  in_transit: 'In transit',
  zone: 'Zone',
  rack: 'Rack',
  qc_status: 'QC status',
  wh_unit: 'Unit',
  reorder_pt: 'Reorder point',
  avg_mo: 'Avg monthly',
  batch_number: 'Batch / lot',
  expiry_date: 'Expiry',
};

function formatInventoryAuditValue(key: string, val: unknown): string {
  if (val == null || val === '') return '—';
  if (typeof val === 'number' && Number.isFinite(val)) return String(val);
  return String(val);
}

/** Human-readable lines from INVENTORY_ADJUST `changes_json.changed`. */
export function inventoryAdjustChangeLines(changesJson: unknown): string[] {
  if (!changesJson || typeof changesJson !== 'object') return [];
  const c = (changesJson as { changed?: Record<string, [unknown, unknown]> }).changed;
  if (!c || typeof c !== 'object') return [];
  return Object.keys(c)
    .sort()
    .map((k) => {
      const pair = c[k];
      const [a, b] = Array.isArray(pair) ? pair : [undefined, undefined];
      const label = INVENTORY_AUDIT_FIELD_LABELS[k] || k;
      return `${label}: ${formatInventoryAuditValue(k, a)} → ${formatInventoryAuditValue(k, b)}`;
    });
}

const LOG = true;
function log(message: string, data?: unknown) {
  if (LOG && typeof console !== 'undefined' && console.log) {
    if (data !== undefined) console.log(`[warehouse-inventory] ${message}`, data);
    else console.log(`[warehouse-inventory] ${message}`);
  }
}

/** Set VITE_DEBUG_WAREHOUSE_PO_QTY=1 in .env or run Vite dev — traces PO Qty column data source */
function debugPoQtyEnabled() {
  try {
    return (
      typeof import.meta !== 'undefined' &&
      import.meta.env &&
      (import.meta.env.DEV === true || import.meta.env.VITE_DEBUG_WAREHOUSE_PO_QTY === '1')
    );
  } catch {
    return false;
  }
}

function logPoQtyFromApi(rows: WarehouseInventoryRow[], label: string) {
  if (!debugPoQtyEnabled() || typeof console === 'undefined' || !console.log) return;
  const withPo = rows.filter((r) => (Number(r.poQuantity) || 0) > 0);
  console.log(`[EI po-qty debug] ${label}`, {
    totalRows: rows.length,
    rowsWithPoQuantityGt0: withPo.length,
    sampleNonZero: withPo.slice(0, 8).map((r) => ({
      id: r.id,
      code: r.code,
      poQuantity: r.poQuantity,
    })),
  });
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
  inTransitBreakdown?: InTransitBreakdownItem[];
  poQuantity?: number;
  reorderPt: number;
  avgMo: number;
  status: string;
  qcStatus?: string;
  batchNumber?: string | null;
  expiryDate?: string | null;
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
      stockInHand: (() => {
        if (r.stockInHand != null && r.stockInHand !== '') {
          const n = Number(r.stockInHand);
          if (Number.isFinite(n)) return n;
        }
        return (Number(r.whStock) + Number(r.ml1Stock) + Number(r.ml2Stock)) || 0;
      })(),
      reserved: Number(r.reserved) || 0,
      inTransit: Number(r.inTransit) || 0,
      inTransitBreakdown: Array.isArray(r.inTransitBreakdown) ? r.inTransitBreakdown : undefined,
      poQuantity: r.poQuantity != null ? Number(r.poQuantity) : undefined,
      reorderPt: Number(r.reorderPt) || 0,
      avgMo: Number(r.avgMo) || 0,
      status: r.status || 'In Stock',
      qcStatus: r.qcStatus,
      batchNumber: r.batchNumber ?? null,
      expiryDate: r.expiryDate ?? null,
    }));
    const itemGroups = Array.isArray(data?.itemGroups) ? data.itemGroups : [];
    log('Loaded from backend', { rowCount: rows.length, itemGroupCount: itemGroups.length });
    logPoQtyFromApi(rows, 'GET /warehouse-inventory (mapped rows)');
    return { data: { rows, itemGroups }, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load warehouse inventory';
    log('Backend warehouse-inventory API failed', message);
    return { data: { rows: [], itemGroups: [] }, error: message, success: false };
  }
}

export interface WarehouseInventoryPage {
  rows: WarehouseInventoryRow[];
  itemGroups: ItemGroupRecord[];
  total: number;
  limit: number;
  offset: number;
}

export async function fetchWarehouseInventoryPage(opts: {
  limit?: number;
  offset?: number;
}): Promise<ServiceResult<WarehouseInventoryPage>> {
  try {
    const limit = opts.limit ?? 20;
    const offset = opts.offset ?? 0;
    const qs = new URLSearchParams();
    qs.set('limit', String(limit));
    qs.set('offset', String(offset));

    const res = await api.get<{ rows: ApiWarehouseRow[]; itemGroups: ItemGroupRecord[]; total: number; limit: number; offset: number }>(
      `/api/v1/warehouse-inventory?${qs.toString()}`
    );
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
      stockInHand: (() => {
        if (r.stockInHand != null && r.stockInHand !== '') {
          const n = Number(r.stockInHand);
          if (Number.isFinite(n)) return n;
        }
        return (Number(r.whStock) + Number(r.ml1Stock) + Number(r.ml2Stock)) || 0;
      })(),
      reserved: Number(r.reserved) || 0,
      inTransit: Number(r.inTransit) || 0,
      inTransitBreakdown: Array.isArray(r.inTransitBreakdown) ? r.inTransitBreakdown : undefined,
      poQuantity: r.poQuantity != null ? Number(r.poQuantity) : undefined,
      reorderPt: Number(r.reorderPt) || 0,
      avgMo: Number(r.avgMo) || 0,
      status: r.status || 'In Stock',
    }));

    const itemGroups = Array.isArray(data?.itemGroups) ? data.itemGroups : [];
    const total = typeof data?.total === 'number' ? data.total : rows.length;

    return { data: { rows, itemGroups, total, limit: data?.limit ?? limit, offset: data?.offset ?? offset }, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load warehouse inventory page';
    return { data: { rows: [], itemGroups: [], total: 0, limit: opts.limit ?? 20, offset: opts.offset ?? 0 }, error: message, success: false };
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
  wh_unit?: string;
  reorder_pt?: number;
  avg_mo?: number;
  batch_number?: string | null;
  expiry_date?: string | null;
  /** Stored on INVENTORY_ADJUST history row */
  note?: string;
  reason?: string;
}

export interface UpdateWarehouseStockResponse {
  id: number;
  wh_stock: number;
  ml1_stock: number;
  ml2_stock: number;
  stock_in_hand: number;
  reserved: number;
  in_transit: number;
  zone: string;
  rack: string;
  qc_status: string;
  wh_unit: string;
  reorder_pt: number;
  avg_mo: number;
  batch_number: string | null;
  expiry_date: string | null;
}

export interface WarehouseLocationHistoryEntry {
  id: number;
  warehouseInventoryId: number;
  itemType: WarehouseItemType;
  rawMaterialId?: number | null;
  packMaterialId?: number | null;
  productId?: number | null;
  fromZone?: string | null;
  fromRack?: string | null;
  toZone?: string | null;
  toRack?: string | null;
  qtyDelta?: number | null;
  actionType?: string | null;
  sourceGrnId?: number | null;
  sourceMrnId?: number | null;
  movedAt: string;
  /** Reserved change from BMR/BPR; only set when actionType is BMR_RESERVED or BPR_RESERVED */
  reservedDelta?: number | null;
  reservedAfter?: number | null;
  productionBatchId?: number | null;
  batchNo?: string | null;
  /** Optional, populated for consolidated history list */
  code?: string;
  name?: string;
  subtitle?: string;
  /** INVENTORY_ADJUST: { before, after, changed } */
  changesJson?: unknown;
  note?: string | null;
}

/** PATCH warehouse inventory row (adjust stock). Backend recomputes stock_in_hand = wh + ml1 + ml2. */
export async function updateWarehouseStock(
  warehouseInventoryId: number,
  payload: UpdateWarehouseStockPayload
): Promise<ServiceResult<UpdateWarehouseStockResponse>> {
  try {
    const res = await api.patch<UpdateWarehouseStockResponse>(
      `/api/v1/warehouse-inventory/${warehouseInventoryId}`,
      payload
    );
    const data = res?.data ?? res;
    log('Updated warehouse stock', { warehouseInventoryId, payload, response: data });
    return { data: data as UpdateWarehouseStockResponse, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update warehouse stock';
    log('Update warehouse stock failed', { warehouseInventoryId, error: message });
    return { data: null as unknown as UpdateWarehouseStockResponse, error: message, success: false };
  }
}

/** Fetch internal movement history for a given warehouse inventory row (zone/rack changes). */
export async function fetchWarehouseLocationHistory(
  warehouseInventoryId: number
): Promise<ServiceResult<{ history: WarehouseLocationHistoryEntry[] }>> {
  try {
    const res = await api.get<{ history: WarehouseLocationHistoryEntry[] }>(
      `/api/v1/warehouse-inventory/${warehouseInventoryId}/location-history`
    );
    const data = res?.data ?? res;
    return { data, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load location history';
    log('Load location history failed', { warehouseInventoryId, error: message });
    return { data: { history: [] }, error: message, success: false };
  }
}

/** Fetch consolidated internal movement history for all items (for Inventory History tab). */
export async function fetchAllWarehouseLocationHistory(): Promise<
  ServiceResult<{ history: WarehouseLocationHistoryEntry[] }>
> {
  try {
    const res = await api.get<{ history: WarehouseLocationHistoryEntry[] }>(
      '/api/v1/warehouse-inventory/location-history'
    );
    const data = res?.data ?? res;
    return { data, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load consolidated location history';
    log('Load all location history failed', { error: message });
    return { data: { history: [] }, error: message, success: false };
  }
}

export interface RackLocationEntry {
  locationId: number;
  locationCode: string;
  locationName: string;
  rackId: number;
  rackCode: string;
}

/** Fetch where in the warehouse this inventory item is stored (location + rack list). */
export async function fetchRackLocations(
  warehouseInventoryId: number
): Promise<ServiceResult<{ locations: RackLocationEntry[] }>> {
  try {
    const res = await api.get<{ locations: RackLocationEntry[] }>(
      `/api/v1/warehouse-inventory/${warehouseInventoryId}/rack-locations`
    );
    const data = res?.data ?? res;
    return { data: data ?? { locations: [] }, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load rack locations';
    log('Load rack locations failed', { warehouseInventoryId, error: message });
    return { data: { locations: [] }, error: message, success: false };
  }
}

/** Low threshold = items where stockInHand <= reorderPt (for planning dashboard). */
export async function fetchLowThresholdAlerts(): Promise<ServiceResult<{ rows: WarehouseInventoryRow[] }>> {
  try {
    const res = await api.get<{ rows: ApiWarehouseRow[] }>('/api/v1/warehouse-inventory/low-threshold-alerts');
    const data = res?.data ?? res;
    const rawRows = Array.isArray(data?.rows) ? data.rows : [];
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
      stockInHand: Number.isFinite(Number(r.stockInHand)) ? Number(r.stockInHand) : 0,
      reserved: Number(r.reserved) || 0,
      inTransit: Number(r.inTransit) || 0,
      inTransitBreakdown: Array.isArray(r.inTransitBreakdown) ? r.inTransitBreakdown : undefined,
      poQuantity: r.poQuantity != null ? Number(r.poQuantity) : undefined,
      reorderPt: Number(r.reorderPt) || 0,
      avgMo: Number(r.avgMo) || 0,
      status: r.status || 'In Stock',
      qcStatus: r.qcStatus,
      batchNumber: r.batchNumber ?? null,
      expiryDate: r.expiryDate ?? null,
    }));
    return { data: { rows }, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load low threshold alerts';
    return { data: { rows: [] }, error: message, success: false };
  }
}

export interface UsageStatsRow {
  id: string;
  code: string;
  name: string;
  type: string;
  avgDay: number;
  avgWeek: number;
  avgMonth: number;
  avgQuarter: number;
  avgYear: number;
  totalAllTime: number;
}

/** Usage (consumption) stats: avg per day/week/month/quarter/year and all-time total. */
export async function fetchUsageStats(): Promise<ServiceResult<{ rows: UsageStatsRow[] }>> {
  try {
    const res = await api.get<{ rows: UsageStatsRow[] }>('/api/v1/warehouse-inventory/usage-stats');
    const data = res?.data ?? res;
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    return { data: { rows }, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load usage stats';
    return { data: { rows: [] }, error: message, success: false };
  }
}
