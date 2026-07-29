import type { PlanningBatchAllRow } from '../services/planningExtracted.service';
import type { WarehouseInventoryRow } from '../services/warehouseInventory.service';
import type { RawMaterialRecord } from '../services/rawMaterials.service';
import type { PackMaterialRecord } from '../services/packMaterials.service';
import { formatQtyExact } from '../utils/formatQty';
import {
  type PlanBatchMaterialStatus,
  planBatchStatusClass,
} from './planBatchMaterialLeadTime';
import { parseSpecificGravity, rmPrimaryQtyToKg, specificGravityFromBomLine } from './rmUnitConversion';

export type BatchItemsPanelMaterialFilter = 'RM' | 'PM' | 'ALL';

export interface BatchItemsPanelInvolvedRow {
  itemType: 'RM' | 'PM';
  code: string;
  raw_material_id?: number;
  pack_material_id?: number;
  totalRequired: number;
  reservedNum: number;
  sihNum: number;
  plannedQtyNum: number;
  poQtyNum: number;
  inTransitQtyNum: number;
}

export interface BatchItemsPanelRow {
  id: string;
  itemType: 'RM' | 'PM';
  itemCode: string;
  itemName: string;
  reqQty: number;
  unit: string;
  sih: number;
  totalRequired: number;
  reserved: number;
  plannedQty: number;
  poQty: number;
  inTransit: number;
  underGrn: number;
  status: PlanBatchMaterialStatus;
  shortfall: number;
  raw_material_id?: number;
  pack_material_id?: number;
}

function normalizeMaterialCode(code: string): string {
  return code.trim().toLowerCase();
}

function warehouseQtyToKg(
  qty: number,
  whRow: WarehouseInventoryRow | undefined,
  master: RawMaterialRecord | undefined,
  lineSg: number
): number {
  const uom = whRow?.whUnit ?? master?.uom ?? 'KG';
  return rmPrimaryQtyToKg(qty, uom, lineSg);
}

export function findBatchItemsPanelInvolvedRow(
  items: BatchItemsPanelInvolvedRow[],
  itemType: 'RM' | 'PM',
  sourceId?: number,
  code?: string
): BatchItemsPanelInvolvedRow | undefined {
  if (sourceId != null && Number(sourceId) > 0) {
    const byId = items.find(
      (r) =>
        r.itemType === itemType &&
        (itemType === 'RM'
          ? Number(r.raw_material_id) === Number(sourceId)
          : Number(r.pack_material_id) === Number(sourceId))
    );
    if (byId) return byId;
  }
  const codeNorm = normalizeMaterialCode(String(code ?? '').trim().toLowerCase());
  if (!codeNorm) return undefined;
  return items.find(
    (r) =>
      r.itemType === itemType &&
      normalizeMaterialCode(String(r.code ?? '').trim().toLowerCase()) === codeNorm
  );
}

export function computeBatchItemsPanelStatus(
  reqQty: number,
  free: number,
  _plannedQty: number,
  poQty: number,
  inTransit: number,
  underGrn: number,
  reserved = 0
): PlanBatchMaterialStatus {
  // IMPORTANT: `plannedQty` here is the quantity allocated to THIS batch (demand), not supply — counting
  // it made SIH-0 rows read AVAILABLE (the batch's own demand "covering" itself). It is intentionally
  // ignored. Availability is judged from real stock + real procurement only:
  //   AVAILABLE         → reserved + free stock + PO + in-transit + under-GRN ≥ requirement
  //   UNDER PROCUREMENT → not covered, but a real procurement pipeline (PO / in-transit / under-GRN) exists
  //   SHORTAGE          → not covered and nothing incoming
  const EPS = 1e-6;
  const req = Number(reqQty) || 0;
  if (req <= EPS) return 'AVAILABLE';
  const stock = Math.max(0, Number(reserved) || 0) + Math.max(0, Number(free) || 0);
  const procurement =
    Math.max(0, Number(poQty) || 0) + Math.max(0, Number(inTransit) || 0) + Math.max(0, Number(underGrn) || 0);
  if (stock + procurement >= req - EPS) return 'AVAILABLE';
  if (procurement > EPS) return 'UNDER PROCUREMENT';
  return 'SHORTAGE';
}

export function formatBatchItemsPanelQty(value: number, unit: string): string {
  const kind = unit?.toUpperCase() === 'KG' ? 'kg' : 'pcs';
  const formatted = formatQtyExact(value, kind);
  const u = unit?.toUpperCase();
  if (u === 'KG') return `${formatted} kg`;
  if (u === 'PCS') return `${formatted} pcs`;
  return unit ? `${formatted} ${unit}` : formatted;
}

export function formatBatchItemsPanelCount(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Number.isInteger(value) ? String(value) : formatQtyExact(value, 'kg');
}

export function buildBatchItemsPanelRows(input: {
  batch: PlanningBatchAllRow;
  warehouseRows: WarehouseInventoryRow[];
  rawMaterials: RawMaterialRecord[];
  packMaterials: PackMaterialRecord[];
  itemsInvolved: BatchItemsPanelInvolvedRow[];
  materialFilter: BatchItemsPanelMaterialFilter;
}): BatchItemsPanelRow[] {
  const { batch, warehouseRows, rawMaterials, packMaterials, itemsInvolved, materialFilter } = input;
  const sizeKg = Number(batch.sizeKg) || 0;
  const orderQtyNum = parseInt(String(batch.orderQty || '0').replace(/\D/g, ''), 10) || 0;
  const totalKg = parseFloat(String(batch.totalKg || '0').replace(/[^\d.]/g, '')) || 0;
  const kgPerUnit = orderQtyNum > 0 && totalKg > 0 ? totalKg / orderQtyNum : 1;
  const unitsForBatch = kgPerUnit > 0 ? sizeKg / kgPerUnit : 0;

  const rmByCode = new Map(rawMaterials.map((r) => [r.code?.toLowerCase() ?? '', r]));
  const pmByCode = new Map(packMaterials.map((p) => [p.code?.toLowerCase() ?? '', p]));
  const rows: BatchItemsPanelRow[] = [];

  (batch.rmLines || []).forEach((lineRaw, idx) => {
    const line = lineRaw as {
      rm_code?: string;
      code?: string;
      inci_name?: string;
      name?: string;
      pct_w_w?: number;
      pct?: number;
      uom?: string;
      specific_gravity?: number;
    };
    const code = line.rm_code || line.code || '';
    const rm =
      rmByCode.get(code.toLowerCase()) ??
      rawMaterials.find((r) => r.code === code || r.name === (line.inci_name ?? line.name));
    const raw_material_id = rm?.id != null ? Number(rm.id) : undefined;
    const pct = line.pct_w_w ?? line.pct ?? 0;
    const required = (sizeKg * pct) / 100;
    const lineSg = parseSpecificGravity(specificGravityFromBomLine(line));
    const wh = warehouseRows.find(
      (w) => w.type === 'RM' && (Number(w.sourceId) === Number(raw_material_id) || w.code === code)
    );
    const involved = findBatchItemsPanelInvolvedRow(itemsInvolved, 'RM', raw_material_id, code);
    const sih = involved?.sihNum ?? warehouseQtyToKg(wh?.stockInHand ?? 0, wh, rm, lineSg);
    const reserved = involved?.reservedNum ?? warehouseQtyToKg(wh?.reserved ?? 0, wh, rm, lineSg);
    const plannedQty = involved?.plannedQtyNum ?? 0;
    const poQty = involved?.poQtyNum ?? warehouseQtyToKg(wh?.poQuantity ?? 0, wh, rm, lineSg);
    const inTransit = involved?.inTransitQtyNum ?? warehouseQtyToKg(wh?.inTransit ?? 0, wh, rm, lineSg);
    const underGrn = warehouseQtyToKg(wh?.underGrn ?? 0, wh, rm, lineSg);
    const free = Math.max(0, sih - reserved);
    const totalRequired = involved?.totalRequired ?? required;
    const status = computeBatchItemsPanelStatus(required, free, plannedQty, poQty, inTransit, underGrn, reserved);
    const shortfall = Math.max(0, required - free);

    rows.push({
      id: `rm-${raw_material_id ?? code}-${idx}`,
      itemType: 'RM',
      itemCode: code || String(raw_material_id ?? ''),
      itemName: line.inci_name ?? line.name ?? rm?.name ?? code,
      reqQty: required,
      unit: line.uom ?? 'KG',
      sih,
      totalRequired,
      reserved,
      plannedQty,
      poQty,
      inTransit,
      underGrn,
      status,
      shortfall,
      raw_material_id,
    });
  });

  (batch.pmLines || []).forEach((lineRaw, idx) => {
    const line = lineRaw as {
      pm_code?: string;
      code?: string;
      description?: string;
      name?: string;
      qty_per_unit?: number;
      qty?: number;
    };
    const code = line.pm_code || line.code || '';
    const pm =
      pmByCode.get(code.toLowerCase()) ??
      packMaterials.find((p) => p.code === code || p.description === (line.description ?? line.name));
    const pack_material_id = pm?.id != null ? Number(pm.id) : undefined;
    const qtyPerUnit = line.qty_per_unit ?? line.qty ?? 1;
    const required = Math.ceil(unitsForBatch * qtyPerUnit);
    const wh = warehouseRows.find(
      (w) => w.type === 'PM' && (Number(w.sourceId) === Number(pack_material_id) || w.code === code)
    );
    const involved = findBatchItemsPanelInvolvedRow(itemsInvolved, 'PM', pack_material_id, code);
    const sih = involved?.sihNum ?? (wh?.stockInHand ?? 0);
    const reserved = involved?.reservedNum ?? (wh?.reserved ?? 0);
    const plannedQty = involved?.plannedQtyNum ?? 0;
      const poQty = involved?.poQtyNum ?? (Number(wh?.poQuantity ?? 0) || 0);
      const inTransit = involved?.inTransitQtyNum ?? (Number(wh?.inTransit ?? 0) || 0);
    const underGrn = Number(wh?.underGrn ?? 0) || 0;
    const free = Math.max(0, sih - reserved);
    const totalRequired = involved?.totalRequired ?? required;
    const status = computeBatchItemsPanelStatus(required, free, plannedQty, poQty, inTransit, underGrn, reserved);
    const shortfall = Math.max(0, required - free);

    rows.push({
      id: `pm-${pack_material_id ?? code}-${idx}`,
      itemType: 'PM',
      itemCode: code || String(pack_material_id ?? ''),
      itemName: line.description ?? line.name ?? pm?.description ?? code,
      reqQty: required,
      unit: 'PCS',
      sih,
      totalRequired,
      reserved,
      plannedQty,
      poQty,
      inTransit,
      underGrn,
      status,
      shortfall,
      pack_material_id,
    });
  });

  if (materialFilter === 'ALL') return rows;
  return rows.filter((r) => r.itemType === materialFilter);
}

export { planBatchStatusClass };
