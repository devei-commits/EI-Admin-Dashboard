/**
 * Warehouse Inventory — from backend GET /api/v1/warehouse-inventory (RM/PM/PR + item groups).
 * stock_in_hand = wh_stock + ml1_stock + ml2_stock (backend computes; frontend uses for display).
 */

import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';
import type { ItemGroupRecord } from './itemGroups.service';

export type WarehouseItemType = 'RM' | 'PM' | 'FG/PR';

function defaultWhUnitForType(type: WarehouseItemType | string): string {
  return String(type).trim().toUpperCase() === 'PM' ? 'PCS' : 'KG';
}

function resolveWhUnitFromApi(whUnit: string | undefined, type: WarehouseItemType | string): string {
  if (String(type).trim().toUpperCase() === 'PM') return 'PCS';
  const u = whUnit != null ? String(whUnit).trim() : '';
  return u || defaultWhUnitForType(type);
}

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
  /** WH + ML1 + ML2 physical total (backend computes; frontend may recompute on adjust) */
  stockInHand: number;
  /** Usable stock = stockInHand − reserved (blocks other batches/orders) */
  available?: number;
  reserved: number;
  inTransit: number;
  underGrn?: number;
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
  reorderPt: number,
  reserved = 0
): 'In Stock' | 'Low Stock' | 'Critical' | 'Out of Stock' | string {
  let status = (qcStatus || 'In Stock').trim();
  const available = Math.max(0, (Number(stockInHand) || 0) - (Number(reserved) || 0));
  if (status === 'In Stock' && reorderPt > 0) {
    if (available < reorderPt * 0.5) return 'Critical';
    if (available < reorderPt) return 'Low Stock';
  }
  return status || 'In Stock';
}

/** Usable warehouse stock after all reservations. */
export function warehouseInventoryAvailable(stockInHand: number, reserved: number): number {
  return Math.max(0, (Number(stockInHand) || 0) - (Number(reserved) || 0));
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
  available?: number;
  reserved: number;
  inTransit: number;
  underGrn?: number;
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
      whUnit: resolveWhUnitFromApi(r.whUnit, r.type),
      ml1Stock: Number(r.ml1Stock) || 0,
      ml2Stock: Number(r.ml2Stock) || 0,
      stockInHand: (() => {
        if (r.stockInHand != null && r.stockInHand !== '') {
          const n = Number(r.stockInHand);
          if (Number.isFinite(n)) return n;
        }
        return (Number(r.whStock) + Number(r.ml1Stock) + Number(r.ml2Stock)) || 0;
      })(),
      available: (() => {
        const sih =
          r.stockInHand != null && r.stockInHand !== '' && Number.isFinite(Number(r.stockInHand))
            ? Number(r.stockInHand)
            : (Number(r.whStock) + Number(r.ml1Stock) + Number(r.ml2Stock)) || 0;
        const res = Number(r.reserved) || 0;
        if (r.available != null && Number.isFinite(Number(r.available))) {
          return Math.max(0, Number(r.available));
        }
        return warehouseInventoryAvailable(sih, res);
      })(),
      reserved: Number(r.reserved) || 0,
      inTransit: Number(r.inTransit) || 0,
      underGrn: Number(r.underGrn) || 0,
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
      whUnit: resolveWhUnitFromApi(r.whUnit, r.type),
      ml1Stock: Number(r.ml1Stock) || 0,
      ml2Stock: Number(r.ml2Stock) || 0,
      stockInHand: (() => {
        if (r.stockInHand != null && r.stockInHand !== '') {
          const n = Number(r.stockInHand);
          if (Number.isFinite(n)) return n;
        }
        return (Number(r.whStock) + Number(r.ml1Stock) + Number(r.ml2Stock)) || 0;
      })(),
      available: (() => {
        const sih =
          r.stockInHand != null && r.stockInHand !== '' && Number.isFinite(Number(r.stockInHand))
            ? Number(r.stockInHand)
            : (Number(r.whStock) + Number(r.ml1Stock) + Number(r.ml2Stock)) || 0;
        const res = Number(r.reserved) || 0;
        if (r.available != null && Number.isFinite(Number(r.available))) {
          return Math.max(0, Number(r.available));
        }
        return warehouseInventoryAvailable(sih, res);
      })(),
      reserved: Number(r.reserved) || 0,
      inTransit: Number(r.inTransit) || 0,
      underGrn: Number(r.underGrn) || 0,
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

export interface RackQuantityUpdate {
  rackId: number;
  qtyWh: number;
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
  /** Absolute qty per warehouse rack; backend recalculates wh_stock from rack rows. */
  rack_quantities?: RackQuantityUpdate[];
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
  locationType?: string;
  isDefaultLocation?: boolean;
  rackId: number;
  rackCode: string;
  qtyWh?: number;
}

export interface StockByLocationRack {
  rackId: number;
  rackCode: string;
  rackName?: string;
  qtyWh: number;
}

export interface StockByLocationWarehouse {
  locationId: number;
  locationCode: string;
  locationName: string;
  locationType: string;
  isDefault: boolean;
  racks: StockByLocationRack[];
  totalQtyWh: number;
}

export interface StockByLocationManufacturing {
  bucket: string;
  label: string;
  qty: number;
  unit: string;
  locationId: number | null;
  locationCode: string | null;
  locationName: string | null;
  isDefault?: boolean;
  racks?: StockByLocationRack[];
}

export interface StockByLocationPayload {
  warehouseInventoryId: number;
  /** RM | PM | PR — used to scope warehouse zones in API response. */
  itemType?: string;
  code?: string;
  whStock: number;
  whUnit: string;
  stockInHand: number;
  warehouse: StockByLocationWarehouse[];
  manufacturing: StockByLocationManufacturing[];
  /** All manufacturing zones + racks (MTR transfer targets). */
  manufacturingZones?: StockByLocationWarehouse[];
  ml1Stock?: number;
  ml2Stock?: number;
  unallocatedWh: number;
  unallocatedMl?: number;
  defaultProduction?: { locationId: number; locationCode: string; locationName: string } | null;
}

export async function fetchStockByLocation(
  warehouseInventoryId: number
): Promise<ServiceResult<StockByLocationPayload>> {
  try {
    const res = await api.get<StockByLocationPayload>(
      `/api/v1/warehouse-inventory/${warehouseInventoryId}/stock-by-location`
    );
    const data = (res?.data ?? res) as StockByLocationPayload;
    return { data, error: null, success: true };
  } catch (e) {
    return {
      data: null as unknown as StockByLocationPayload,
      error: e instanceof Error ? e.message : 'Failed to load stock by location',
      success: false,
    };
  }
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
      whUnit: resolveWhUnitFromApi(r.whUnit, r.type),
      ml1Stock: Number(r.ml1Stock) || 0,
      ml2Stock: Number(r.ml2Stock) || 0,
      stockInHand: Number.isFinite(Number(r.stockInHand)) ? Number(r.stockInHand) : 0,
      reserved: Number(r.reserved) || 0,
      inTransit: Number(r.inTransit) || 0,
      underGrn: Number(r.underGrn) || 0,
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

export interface ConsumptionBetweenParams {
  itemType: 'RM' | 'PM' | 'PR';
  rawMaterialId?: number;
  packMaterialId?: number;
  productId?: number;
  from: string;
  to: string;
}

/** Outbound consumption for an item between two calendar dates (inclusive). */
export async function fetchConsumptionBetween(
  params: ConsumptionBetweenParams
): Promise<ServiceResult<{ consumption: number; from: string; to: string }>> {
  try {
    const qs = new URLSearchParams();
    qs.set('item_type', params.itemType);
    qs.set('from', params.from.slice(0, 10));
    qs.set('to', params.to.slice(0, 10));
    if (params.rawMaterialId != null && params.rawMaterialId > 0) {
      qs.set('raw_material_id', String(params.rawMaterialId));
    }
    if (params.packMaterialId != null && params.packMaterialId > 0) {
      qs.set('pack_material_id', String(params.packMaterialId));
    }
    if (params.productId != null && params.productId > 0) {
      qs.set('product_id', String(params.productId));
    }
    const res = await api.get<{ consumption: number; from: string; to: string }>(
      `/api/v1/warehouse-inventory/consumption-between?${qs.toString()}`
    );
    const data = res?.data ?? res;
    const consumption = Number(data?.consumption);
    return {
      data: {
        consumption: Number.isFinite(consumption) ? consumption : 0,
        from: String(data?.from ?? params.from).slice(0, 10),
        to: String(data?.to ?? params.to).slice(0, 10),
      },
      error: null,
      success: true,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch consumption';
    return { data: { consumption: 0, from: params.from, to: params.to }, error: message, success: false };
  }
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

export interface InventorySummaryExcelImportResponse {
  ok?: boolean;
  sheet_name?: string;
  rows_total?: number;
  summary?: {
    rm_updated?: number;
    pm_updated?: number;
    pr_updated?: number;
    created?: number;
    skipped?: number;
    errors?: number;
  };
  row_log?: Array<Record<string, unknown>>;
  error?: string;
}

/** Apply Zoho "Inventory Summary" quantity_available to warehouse stock (RM/PM/PR). */
export async function importInventorySummaryExcel(
  file: File,
  options?: { details?: boolean }
): Promise<InventorySummaryExcelImportResponse> {
  const fd = new FormData();
  fd.append('file', file);
  const suffix = options?.details ? '?details=1' : '';
  return api.post<InventorySummaryExcelImportResponse>(
    `/api/v1/warehouse-inventory/import-inventory-summary-excel${suffix}`,
    fd
  );
}

export type WarehouseSihBucket = 'warehouse' | 'ml1' | 'ml2';

export interface WarehouseSihExcelImportResponse extends InventorySummaryExcelImportResponse {
  bucket?: WarehouseSihBucket;
  bucket_label?: string;
}

async function importSihBucketExcel(
  bucket: WarehouseSihBucket,
  file: File,
  options?: { details?: boolean }
): Promise<WarehouseSihExcelImportResponse> {
  const fd = new FormData();
  fd.append('file', file);
  const suffix = options?.details ? '?details=1' : '';
  return api.post<WarehouseSihExcelImportResponse>(
    `/api/v1/warehouse-inventory/import-sih-excel/${bucket}${suffix}`,
    fd
  );
}

/** Main warehouse workbook (Sheet3): sku, item_name, SIH → wh_stock. */
export function importMainWarehouseSihExcel(
  file: File,
  options?: { details?: boolean }
): Promise<WarehouseSihExcelImportResponse> {
  return importSihBucketExcel('warehouse', file, options);
}

/** ML1 workbook (STOCK IN HAND sheet): sku, item_name, PHYSICAL QTY → ml1_stock. */
export function importMl1SihExcel(
  file: File,
  options?: { details?: boolean }
): Promise<WarehouseSihExcelImportResponse> {
  return importSihBucketExcel('ml1', file, options);
}

/** ML2 workbook (Sheet3): sku, item_name, SIH → ml2_stock. */
export function importMl2SihExcel(
  file: File,
  options?: { details?: boolean }
): Promise<WarehouseSihExcelImportResponse> {
  return importSihBucketExcel('ml2', file, options);
}
