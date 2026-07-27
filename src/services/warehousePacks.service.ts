import { api } from '../lib/apiClient';

/**
 * An availability row the transfer picker can act on. `kind='pack'` is a real tracked pack
 * (full PKG/batch detail); `kind='stock'` is loose rack stock for items not yet pack-tracked
 * (zone/rack/qty only — no packaging number or batch).
 */
export interface WarehousePack {
  kind: 'pack' | 'stock';
  /** Stable key across both kinds (`pack-<id>` / `stock-rack-<rackId>`). */
  key: string;
  id: number;
  packId: number | null;
  rackId: number | null;
  packagingNo: string | null;
  zone: string | null;
  rack: string | null;
  vendorBatch: string | null;
  mfgDate: string | null;
  expDate: string | null;
  qty: number;
  unit: string | null;
  status: string;
  // Present on kind='pack' only:
  grnId?: number | null;
  batchIndex?: number | null;
  itemType?: 'RM' | 'PM' | 'PR' | null;
  rawMaterialId?: number | null;
  packMaterialId?: number | null;
  productId?: number | null;
  parentPackId?: number | null;
  mrnId?: number | null;
}

export interface AvailablePacksQuery {
  rawMaterialId?: number | null;
  packMaterialId?: number | null;
  productId?: number | null;
  zone?: string | null;
}

/**
 * Available packs for an item, FEFO-sorted (earliest expiry first) — drives the transfer
 * pick/split picker. Exactly one of rawMaterialId / packMaterialId / productId is required.
 * GET /api/v1/warehouse-packs/available
 */
export async function fetchAvailablePacks(query: AvailablePacksQuery): Promise<WarehousePack[]> {
  const params = new URLSearchParams();
  if (query.rawMaterialId != null) params.set('rawMaterialId', String(query.rawMaterialId));
  if (query.packMaterialId != null) params.set('packMaterialId', String(query.packMaterialId));
  if (query.productId != null) params.set('productId', String(query.productId));
  if (query.zone) params.set('zone', query.zone);
  const list = await api.get<WarehousePack[]>(`/api/v1/warehouse-packs/available?${params.toString()}`);
  return Array.isArray(list) ? list : [];
}

export interface SplitPackResult {
  source: WarehousePack;
  children: WarehousePack[];
}

/**
 * Split an available pack into child packs (PKG-SPLIT-…). `qtys` are the child quantities;
 * their total must not exceed the pack's qty. A leftover keeps the source available.
 * POST /api/v1/warehouse-packs/:id/split
 */
export async function splitPack(id: number, qtys: number[]): Promise<SplitPackResult> {
  return api.post<SplitPackResult>(`/api/v1/warehouse-packs/${id}/split`, { qtys });
}

export interface MaterializeQuery {
  rawMaterialId?: number | null;
  packMaterialId?: number | null;
  productId?: number | null;
  rackId: number;
  qtys: number[];
}

/**
 * Split loose rack stock into labelled packs. `qtys` are the child quantities you want; any
 * unallocated remainder on the rack is materialized as its own pack too.
 * POST /api/v1/warehouse-packs/materialize
 */
export async function materializePacks(query: MaterializeQuery): Promise<{ children: WarehousePack[] }> {
  return api.post<{ children: WarehousePack[] }>('/api/v1/warehouse-packs/materialize', {
    rawMaterialId: query.rawMaterialId ?? undefined,
    packMaterialId: query.packMaterialId ?? undefined,
    productId: query.productId ?? undefined,
    rackId: query.rackId,
    qtys: query.qtys,
  });
}

