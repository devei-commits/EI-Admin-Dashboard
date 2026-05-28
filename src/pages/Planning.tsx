import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useLocation, NavLink, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { CheckCircle2, ChevronDown, Loader2, Search, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { DateRangeFilterInputs } from '../components/DateRangeFilterInputs';
import { matchesDateRangeFilter } from '../utils/dateRangeFilter';
import { parsePlanningSlaTimestamp, planningBomConfirmedAtIso } from '../utils/planningSlaDates';
import type { SoPlanningAvailabilityItem, SoPlanningAvailabilityResponse } from '../services/fulfillment.service';
import { fetchSoPlanningAvailability } from '../services/fulfillment.service';
import {
  fetchPlanningExtractedList,
  fetchPlanningExtractedById,
  updatePlanningExtracted,
  fetchBomOverride,
  putBomOverride,
  createOrUpdatePlanningBatches,
  fetchPlanningBatches,
  fetchBatchById,
  addOneBatchFromMaster,
  updateBatch as updatePlanningBatch,
  fetchAllBatches,
  fetchItemsInvolved,
  type PlanningExtractedRow,
  type PlanningBatchRow,
  type PlanningBatchAllRow,
} from '../services/planningExtracted.service';
import {
  createProcurementRequest,
  fetchProcurementRequests,
  updateProcurementRequest,
  type ProcurementRequestItem,
  type ProcurementRequest,
} from '../services/procurement.service';
import {
  createPlanningQuotationAsk,
  fetchPlanningQuotationAsks,
} from '../services/planningQuotationAsks.service';
import {
  getPlanningQuotationAskUiStatus,
  loadSeenPlanningQuotationAskIds,
  markMatchingFulfilledAsksSeen,
} from '../lib/planningQuotationAskDisplay';
import { fetchPriceListPage, type PriceListItemPage } from '../services/itemsList.service';
import {
  fetchBOMByProductId,
  type BOMRecord,
  type BOMRmLine,
  type BOMPmLine,
} from '../services/bom.service';
import { fetchBatches, type BatchRow } from '../services/production.service';
import { fetchRawMaterialsList, type RawMaterialRecord } from '../services/rawMaterials.service';
import { fetchVendorClients, type VendorClientRecord } from '../services/vendorClient.service';
import VendorClientNameTypeahead from '../components/VendorClientNameTypeahead';
import {
  normRmPrimaryUom,
  parseSpecificGravity,
  specificGravityFromBomLine,
  procurementQtyFromKgGap,
  procurementUnitSuffix,
  rmPrimaryQtyToKg,
  inferBlendSpecificGravity,
} from '../lib/rmUnitConversion';
import { parseBulkSpecificGravity } from '../lib/skuBomMath';
import {
  badgeToneClass,
  getItemsInvolvedProcurementDisplay,
} from '../lib/itemsInvolvedPipelineDisplay';

function effectivePrSpecBulk(
  bom: BOMRecord | null | undefined,
  productDetail: { specific_gravity?: string | null } | null | undefined
): string {
  const fromBom = String(bom?.specBulk ?? '').trim();
  if (fromBom) return fromBom;
  return String(productDetail?.specific_gravity ?? '').trim();
}

function resolveBomLevelSgFromPr(
  specBulk: string | null | undefined,
  rmLines: BOMRmLine[] | null | undefined,
  confirmedBomSg: number | null | undefined,
  alreadyConfirmed: boolean
): string {
  if (alreadyConfirmed && confirmedBomSg != null && confirmedBomSg > 0) {
    return String(confirmedBomSg);
  }
  const bulkRaw = String(specBulk ?? '').trim();
  if (bulkRaw) {
    return String(parseBulkSpecificGravity(bulkRaw));
  }
  if (rmLines?.length) {
    const blend = inferBlendSpecificGravity(rmLines);
    if (Number.isFinite(blend) && blend > 0) return String(blend);
  }
  const firstSg = specificGravityFromBomLine(rmLines?.[0] as BOMRmLine);
  return firstSg != null ? String(firstSg) : '1';
}

function lineSgFromPrBom(line: BOMRmLine, specBulk?: string | null): number {
  const lineSg = specificGravityFromBomLine(line);
  if (lineSg != null) return parseSpecificGravity(lineSg);
  const bulkRaw = String(specBulk ?? '').trim();
  if (bulkRaw) return parseBulkSpecificGravity(bulkRaw);
  return 1;
}
import type { WarehouseInventoryRow } from '../services/warehouseInventory.service';
import { fetchPackMaterialsList } from '../services/packMaterials.service';
import { fetchPRProductDetail, fetchPRProducts } from '../services/productsMaster.service';
import {
  createItemGroup,
  fetchItemGroups,
  fetchNextItemGroupCode,
  updateItemGroup,
  type ItemGroupRecord,
} from '../services/itemGroups.service';
import { fetchWarehouseInventory } from '../services/warehouseInventory.service';
import { toPmDisplayUnit } from '../lib/pmDisplayUnit';
import { formatQtyExact, MATERIAL_QTY_MAX_DECIMALS, roundMaterialQty } from '../utils/formatQty';
import AdminMainMenuButton from '../components/AdminMainMenuButton';

/** Merge a newly created batch into the planning-batches list cache so selection is not reset before refetch (fixes dropdown + batch label). */
function mergePlanningBatchIntoListCache(
  queryClient: QueryClient,
  planningExtractedId: string,
  newBatch: PlanningBatchRow
): void {
  const nid = Number(newBatch.id);
  if (Number.isNaN(nid)) return;
  const normalized: PlanningBatchRow = {
    ...newBatch,
    id: nid,
    sequence: Number(newBatch.sequence) || 0,
  };
  queryClient.setQueryData<PlanningBatchRow[]>(['planning-batches', planningExtractedId], (old) => {
    const prev = Array.isArray(old) ? old : [];
    const without = prev.filter((b) => Number(b.id) !== nid);
    return [...without, normalized].sort((a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0));
  });
  queryClient.setQueryData<PlanningBatchRow>(['planning-batch', planningExtractedId, nid], normalized);
}
import { fetchPurchaseOrders } from '../services/salesPurchase.service';
import {
  PAYMENT_TERMS_TYPE_OPTIONS,
  formatPaymentTermsString,
  parsePaymentTermsString,
  paymentTermsTypeRequiresAdvancePercent,
  validateAdvancePercentForType,
  type PaymentTermsStructuredType,
} from '../lib/paymentTermsStructured';
import {
  formatStagedPaymentTermsObject,
  formatStagedPaymentTermsSummary,
  resolveStagedPaymentTermsForForm,
} from '../lib/stagedPaymentTerms';

interface RawMaterial {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  percentage: number;
  code?: string;
  phase?: string;
  raw_material_id?: number;
  /** Specific gravity (vs water) for vessel volume: volume_L = quantity_kg / specificGravity. Default 1. */
  specificGravity?: number;
}

interface PackagingMaterial {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  value: number;
  percentage: number;
  code?: string;
  pack_material_id?: number;
}

interface ItemsInvolvedDisplayRow {
  id: string;
  name: string;
  code: string;
  category: string;
  usedIn: string;
  usedInProducts?: string[];
  totalReq: string;
  totalRequired: number;
  /** Number of production batches (released) that use this item. */
  batchCount: number;
  sih: string;
  sihNum: number;
  surplusShortage: string;
  surplusShortageNum: number;
  coverage: string;
  whBatches: string;
  warehouseInventoryId: number | null;
  expiry: string;
  bomFlag: string;
  itemType: 'RM' | 'PM';
  planningExtractedIds: number[];
  planningExtractedId: number | null;
  raw_material_id?: number;
  pack_material_id?: number;
  unit: string;
  /** Warehouse-style columns (from warehouse_inventory) */
  reserved: string;
  reservedNum: number;
  plannedQty: string;
  plannedQtyNum: number;
  orderedQty: string;
  /** Legacy: warehouse_inventory.in_transit (synced total). Prefer supplyTowardGrossNum for gaps/coverage. */
  orderedQtyNum: number;
  /** Free SIH + release pipeline stages (planned + PO + shipped in-transit) — comparable to TOTAL REQ. */
  supplyTowardGrossNum: number;
  /** Formatted NET (release shortfall vs full TOTAL REQ). */
  net: string;
  /** supplyTowardGrossNum − totalRequired; Release to Planning increases supply so NET moves toward 0. */
  netNum: number;
  /** Supply − qty not yet on planning_batches (informational; NET column uses netNum = vs full TOTAL REQ). */
  netPipelineNum: number;
  /** Same formatted string as `net` (full-BOM release shortfall). */
  netPipeline: string;
  inTransit: string;
  /** Stage-flow PO balance (still on a PO, not yet shipped/received). */
  poQtyStr: string;
  poQtyNum: number;
  /** Stage-flow in-transit balance (shipped, not yet GRN Complete). */
  inTransitQtyStr: string;
  inTransitQtyNum: number;
  /** Stage-flow warehouse balance (received, physically in WH). */
  whQtyStr: string;
  whQtyNum: number;
  /** Abs(shortfall) vs TOTAL REQ when netNum &lt; 0. */
  shortStr: string;
  reorderPt: string;
  avgMo: string;
  status: string;
  /** BOM qty not yet rolled into planning_batches (split remainder). */
  unallocatedToBatches?: number;
  totalReleasedNum: number;
  totalOnPONum: number;
  totalReceivedNum: number;
  batchAllocatedQtyNum: number;
}

type PlannedLine = {
  createdAt: string;
  planningExtractedId: number | null;
  itemType: 'RM' | 'PM';
  itemId: number | null;
  itemCode: string;
  itemName: string;
  vendorId: number | null;
  vendorName: string;
  moq: number;
  qty: number;
  unitPrice: number;
  paymentTerms: string;
  leadTimeDays: number;
  unit: string;
  /** Backend purchase_orders.id (numeric string) when synced to Draft PO */
  backendPoId?: string;
};

function buildPlannedGroupKey(vendorName: string, paymentTerms: string, leadTimeDays: number) {
  return `${vendorName.trim().toLowerCase()}|||${paymentTerms.trim()}|||${Number(leadTimeDays) || 0}`;
}

/** Match stored planned line to Items Involved row — avoid empty-string / missing-id false positives. */
function plannedLineMatchesItemsInvolvedRow(line: PlannedLine, item: ItemsInvolvedDisplayRow): boolean {
  if (line.itemType !== item.itemType) return false;
  const matId = item.itemType === 'RM' ? Number(item.raw_material_id) : Number(item.pack_material_id);
  const lineMatId = line.itemId != null ? Number(line.itemId) : NaN;
  if (Number.isFinite(matId) && matId > 0) {
    return Number.isFinite(lineMatId) && lineMatId === matId;
  }
  const codeItem = normalizeMaterialCode(String(item.code ?? '').trim().toLowerCase());
  const codeLine = normalizeMaterialCode(String(line.itemCode ?? '').trim().toLowerCase());
  if (codeItem.length > 0 && codeLine.length > 0 && codeItem === codeLine) return true;
  const nameItem = String(item.name ?? '').trim().toLowerCase();
  const nameLine = String(line.itemName ?? '').trim().toLowerCase();
  return nameItem.length > 0 && nameLine.length > 0 && nameItem === nameLine;
}

/** Draft PO line counts toward released qty if it matches PE scope + material. */
function plannedLineCountsTowardItemRelease(line: PlannedLine, item: ItemsInvolvedDisplayRow): boolean {
  if (!plannedLineMatchesItemsInvolvedRow(line, item)) return false;
  const linePe = Number(line.planningExtractedId) || 0;
  const ids = item.planningExtractedIds ?? [];
  if (ids.length > 0) {
    return linePe <= 0 || ids.includes(linePe);
  }
  const itemPe = Number(item.planningExtractedId) || 0;
  if (itemPe > 0 && linePe > 0 && linePe !== itemPe) return false;
  return true;
}

function procurementRequestItemMatchesInvolvedRow(
  line: ProcurementRequestItem,
  item: ItemsInvolvedDisplayRow
): boolean {
  if (line.type !== item.itemType) return false;
  const matId = item.itemType === 'RM' ? Number(item.raw_material_id) : Number(item.pack_material_id);
  const lineRm = Number(line.raw_material_id);
  const linePm = Number(line.pack_material_id);
  const lineMatId = item.itemType === 'RM' ? lineRm : linePm;
  if (Number.isFinite(matId) && matId > 0) {
    return Number.isFinite(lineMatId) && lineMatId === matId;
  }
  const codeItem = normalizeMaterialCode(String(item.code ?? '').trim().toLowerCase());
  const codeLine = normalizeMaterialCode(String(line.code ?? '').trim().toLowerCase());
  if (codeItem.length > 0 && codeLine.length > 0 && codeItem === codeLine) return true;
  const nameItem = String(item.name ?? '').trim().toLowerCase();
  const nameLine = String(line.name ?? '').trim().toLowerCase();
  return nameItem.length > 0 && nameLine.length > 0 && nameItem === nameLine;
}

function procurementRequestIsActiveForReleaseCount(pr: ProcurementRequest): boolean {
  const st = String(pr.status ?? '').trim();
  if (!st) return true;
  if (/cancel/i.test(st)) return false;
  if (/reject/i.test(st)) return false;
  return true;
}

function sumProcurementRequestQtyForItem(item: ItemsInvolvedDisplayRow, prs: ProcurementRequest[]): number {
  const idSet = new Set<number>();
  for (const id of item.planningExtractedIds ?? []) {
    const n = Number(id);
    if (Number.isFinite(n) && n > 0) idSet.add(n);
  }
  if (idSet.size === 0) {
    const single = Number(item.planningExtractedId);
    if (Number.isFinite(single) && single > 0) idSet.add(single);
  }
  if (idSet.size === 0) return 0;
  let sum = 0;
  for (const pr of prs) {
    if (!procurementRequestIsActiveForReleaseCount(pr)) continue;
    if (isQuotationRequestProcurementRecord(pr)) continue;
    const peId = Number(pr.planningExtractedId);
    if (!idSet.has(peId)) continue;
    const items = Array.isArray(pr.items) ? pr.items : [];
    for (const line of items) {
      if (!procurementRequestItemMatchesInvolvedRow(line, item)) continue;
      sum += Number(line.quantity_requested ?? line.shortage ?? 0) || 0;
    }
  }
  return sum;
}

function sumPlanningPOLineQtyForItem(item: ItemsInvolvedDisplayRow, lines: PlannedLine[]): number {
  return lines.reduce((sum, line) => {
    return plannedLineCountsTowardItemRelease(line, item) ? sum + (Number(line.qty) || 0) : sum;
  }, 0);
}

/** Qty already committed via Procurement Requests or Planning-linked draft POs (de-duped). */
function releasedQtyTowardPlanningGap(
  item: ItemsInvolvedDisplayRow,
  prs: ProcurementRequest[],
  plannedLines: PlannedLine[]
): number {
  return Math.max(sumProcurementRequestQtyForItem(item, prs), sumPlanningPOLineQtyForItem(item, plannedLines));
}

function normalizeMaterialCode(code: string): string {
  const c = (code ?? '').toString().trim().toLowerCase();
  if (!c) return '';
  // Examples: "EI-RM-UVF-001" -> "UVF-001"
  return c
    .replace(/^ei[-_]?rm[-_]?/i, '')
    .replace(/^ei[-_]?pm[-_]?/i, '')
    .replace(/^rm[-_]?/i, '')
    .replace(/^pm[-_]?/i, '');
}

function bomLineMatchesItemGroupMember(
  line: RawMaterial,
  member: { id: string; code: string; name: string }
): boolean {
  const lineRmId =
    line.raw_material_id != null && Number.isFinite(Number(line.raw_material_id))
      ? Number(line.raw_material_id)
      : Number.isFinite(Number(line.id)) && Number(line.id) > 0
        ? Number(line.id)
        : null;
  const memberId = Number(member.id);
  if (lineRmId != null && Number.isFinite(memberId) && memberId > 0 && lineRmId === memberId) {
    return true;
  }
  const lineCode = normalizeMaterialCode(String(line.code ?? '').trim().toLowerCase());
  const memberCode = normalizeMaterialCode(String(member.code ?? '').trim().toLowerCase());
  if (lineCode && memberCode && lineCode === memberCode) return true;
  const lineName = String(line.name ?? '').trim().toLowerCase();
  const memberName = String(member.name ?? '').trim().toLowerCase();
  return lineName.length > 0 && memberName.length > 0 && lineName === memberName;
}

function parseUnitCount(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Math.max(0, Math.round(value));
  const n = parseInt(String(value ?? '').replace(/[^\d.-]/g, ''), 10);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function parseKgCount(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Math.max(0, value);
  const n = parseFloat(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/** Items Involved qty display — preserve small decimals for RM/kg (BOM % impact). */
const ITEMS_INVOLVED_QTY_MAX_DECIMALS = 4;

function itemsInvolvedUsesDecimalQty(itemType: 'RM' | 'PM', unit?: string): boolean {
  return itemType === 'RM' || String(unit ?? '').toUpperCase() === 'KG';
}

function formatItemsInvolvedQty(value: number, itemType: 'RM' | 'PM', unit?: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  if (itemsInvolvedUsesDecimalQty(itemType, unit)) {
    return n.toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: ITEMS_INVOLVED_QTY_MAX_DECIMALS,
    });
  }
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function itemsInvolvedUnitSuffix(unit?: string, itemType?: 'RM' | 'PM'): string {
  if (unit === 'KG' || itemType === 'RM') return ' kg';
  if (unit === 'PCS') return ' pcs';
  return unit ? ` ${unit}` : '';
}

function formatItemsInvolvedQtyWithUnit(
  value: number,
  itemType: 'RM' | 'PM',
  unit?: string
): string {
  return formatItemsInvolvedQty(value, itemType, unit) + itemsInvolvedUnitSuffix(unit, itemType);
}

function findRmMasterRecord(
  rawMaterialId: number | undefined,
  code: string | undefined,
  list: RawMaterialRecord[]
): RawMaterialRecord | undefined {
  if (rawMaterialId != null && Number.isFinite(Number(rawMaterialId))) {
    const byId = list.find((r) => Number(r.id) === Number(rawMaterialId));
    if (byId) return byId;
  }
  const c = String(code ?? '').trim().toLowerCase();
  if (c) return list.find((r) => String(r.code ?? '').trim().toLowerCase() === c);
  return undefined;
}

/** Warehouse qty (RM primary UoM) → kg for planning/BOM confirmation (L × SG, etc.). */
function warehouseQtyToKg(
  qty: number,
  whRow: WarehouseInventoryRow | undefined,
  master: RawMaterialRecord | undefined,
  lineSg: number
): number {
  const uom = whRow?.whUnit ?? master?.uom ?? 'KG';
  return rmPrimaryQtyToKg(qty, uom, lineSg);
}

/** Planning/SO math is kg; procurement/PO lines use RM primary UoM (L, KG, …). */
function rmProcurementFieldsFromKg(
  kgQty: number,
  master: RawMaterialRecord | undefined,
  lineSg?: number
): { quantity_requested: number; unit: string } {
  const sg = parseSpecificGravity(lineSg);
  const { qty, unit } = procurementQtyFromKgGap(kgQty, master?.uom, sg);
  return { quantity_requested: qty, unit };
}

/** For PIs Extracted table: planned units created from saved custom batch kg, else fallback from batch count × batch size. */
function getCreatedAndRemainingUnits(order: SalesOrder): { createdUnits: number; remainingUnits: number } {
  const orderUnits = parseUnitCount(order.orderQty);
  if (orderUnits <= 0) return { createdUnits: 0, remainingUnits: 0 };

  const totalKg = parseKgCount(order.totalKg);
  const kgPerUnit = totalKg > 0 ? totalKg / orderUnits : 0;

  const customBatchKg = Array.isArray(order.customBatches)
    ? order.customBatches.reduce((sum, b) => sum + (Number(b?.sizeKg) || 0), 0)
    : 0;
  const fallbackBatchKg = (Number(order.batchCount) || 0) * (parseKgCount(order.batchSize) || 0);
  const plannedKg = customBatchKg > 0 ? customBatchKg : fallbackBatchKg;

  const createdUnitsRaw = kgPerUnit > 0 ? Math.round(plannedKg / kgPerUnit) : 0;
  const createdUnits = Math.min(orderUnits, Math.max(0, createdUnitsRaw));
  const remainingUnits = Math.max(0, orderUnits - createdUnits);
  return { createdUnits, remainingUnits };
}

function formatPlanningSlaClock(elapsedHours: number): string {
  const hrs = Math.floor(elapsedHours);
  const mins = Math.floor((elapsedHours - hrs) * 60);
  if (hrs === 0 && mins === 0 && elapsedHours > 0) return '< 1m / 48h';
  return `${hrs}h ${mins}m / 48h`;
}

/** Live SLA for open rows; frozen stop time for fully planned rows (from BOM confirm or API snapshot). */
function getPlanningSlaMeta(
  order: SalesOrder,
  remainingUnits: number,
  nowMs: number = Date.now(),
): {
  elapsedHours: number;
  label: string;
  sub: string;
  tone: 'green' | 'amber' | 'red';
} {
  const start =
    parsePlanningSlaTimestamp(order.createdAt) ??
    parsePlanningSlaTimestamp(order.orderDate) ??
    new Date(nowMs);
  const now = new Date(nowMs);
  let stopAt = now;
  if (remainingUnits <= 0) {
    const confirmedAt = parsePlanningSlaTimestamp(order.bomConfirmedAt ?? null);
    const frozenFromApi = parsePlanningSlaTimestamp(order.planningSla?.stoppedAt ?? null);
    stopAt = confirmedAt ?? frozenFromApi ?? now;
    if (stopAt.getTime() > now.getTime()) stopAt = now;
  }
  const elapsedHours = Math.max(0, (stopAt.getTime() - start.getTime()) / (1000 * 60 * 60));
  const clock = formatPlanningSlaClock(elapsedHours);
  if (remainingUnits <= 0) {
    if (elapsedHours < 48) return { elapsedHours, label: `Completed ${clock}`, sub: 'Completed on time', tone: 'green' };
    return { elapsedHours, label: `Completed ${clock}`, sub: 'Completed late', tone: 'red' };
  }
  if (elapsedHours < 36) return { elapsedHours, label: clock, sub: 'Running (< 36h)', tone: 'green' };
  if (elapsedHours < 48) return { elapsedHours, label: clock, sub: 'Nearing breach (36–48h)', tone: 'amber' };
  return { elapsedHours, label: clock, sub: `Breached by ${Math.max(0, Math.floor(elapsedHours - 48))}h`, tone: 'red' };
}

function getBatchLifecycleStatus(row: PlanningBatchAllRow): 'Planned' | 'In Mfg' | 'In QC' | 'Released' | 'On Hold' {
  const raw = String(row.bomStatus ?? '').toLowerCase();
  if (raw.includes('hold') || raw.includes('block')) return 'On Hold';
  if (raw.includes('qc')) return 'In QC';
  if (raw.includes('release')) return 'Released';
  if (row.sent) return 'In Mfg';
  return 'Planned';
}

function toKg(quantity: number, unit?: string): number {
  const qty = Number(quantity) || 0;
  const normalizedUnit = String(unit ?? '').trim().toUpperCase();
  if (normalizedUnit === 'G' || normalizedUnit === 'GM' || normalizedUnit === 'GRAM' || normalizedUnit === 'GRAMS') {
    return qty / 1000;
  }
  if (normalizedUnit === 'MG') return qty / 1_000_000;
  return qty;
}

/** Planning detail popup: how much of order qty free warehouse stock can fulfill. */
type DetailPopupInventoryRow = {
  id: string;
  name: string;
  required: number;
  /** @deprecated use required — kept for PR builder */
  quantity: number;
  sih: number;
  reserved: number;
  freeStock: number;
  fulfillable: number;
  fulfillmentPct: number;
  shortfall: number;
  unit: string;
  pct: number | null;
};

function computeDetailFulfillment(required: number, stockInHand: number, reserved: number) {
  const sih = Math.max(0, Number(stockInHand) || 0);
  const res = Math.max(0, Number(reserved) || 0);
  const freeStock = Math.max(0, sih - res);
  const req = Math.max(0, Number(required) || 0);
  const fulfillable = req > 0 ? Math.min(req, freeStock) : freeStock;
  const fulfillmentPct =
    req > 0 ? Math.min(100, Math.max(0, (freeStock / req) * 100)) : freeStock > 0 ? 100 : 0;
  const shortfall = req > 0 ? Math.max(0, req - freeStock) : 0;
  return { sih, reserved: res, freeStock, fulfillable, fulfillmentPct, shortfall };
}

function DetailFulfillmentBar({
  row,
  variant,
}: {
  row: DetailPopupInventoryRow;
  variant: 'rm' | 'pm';
}) {
  const qtyKind = variant === 'rm' ? 'kg' : 'pcs';
  const unitLabel = variant === 'rm' ? 'KG' : row.unit;
  const barColor =
    row.fulfillmentPct >= 100
      ? 'bg-emerald-500'
      : row.fulfillmentPct > 0
        ? variant === 'rm'
          ? 'bg-teal-500'
          : 'bg-orange-500'
        : 'bg-red-400';

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-gray-900 truncate">{row.name}</span>
        <div className="text-right text-xs shrink-0">
          {row.pct != null && row.pct > 0 && (
            <div className="text-gray-500 font-medium mb-0.5">BOM {formatQtyExact(row.pct, 'raw')}% w/w</div>
          )}
          <div className={variant === 'rm' ? 'text-teal-800 font-semibold' : 'text-orange-800 font-semibold'}>
            {formatQtyExact(row.fulfillmentPct, 'raw')}% can fulfill
          </div>
          <div className="text-gray-600 font-medium">
            Free {formatQtyExact(row.freeStock, qtyKind)} / Req {formatQtyExact(row.required, qtyKind)} {unitLabel}
          </div>
        </div>
      </div>
      <div
        className="relative h-3 bg-gray-200 rounded-full overflow-hidden"
        title="Full width = order required · Fill = coverable from free stock"
      >
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-300`}
          style={{ width: `${row.fulfillmentPct}%` }}
        />
      </div>
      <p className="text-[10px] text-gray-500 leading-snug">
        {row.fulfillmentPct >= 100
          ? `Stock can fully fulfill this line (${formatQtyExact(row.fulfillable, qtyKind)} ${unitLabel}).`
          : row.fulfillmentPct > 0
            ? `Can fulfill ${formatQtyExact(row.fulfillable, qtyKind)} of ${formatQtyExact(row.required, qtyKind)} ${unitLabel} from warehouse.`
            : 'No free stock — cannot fulfill from warehouse.'}
        {row.shortfall > 0 && (
          <span className="text-red-600 font-semibold">
            {' '}
            Short {formatQtyExact(row.shortfall, qtyKind)} {unitLabel}.
          </span>
        )}
        {row.reserved > 0 && (
          <span className="text-gray-400">
            {' '}
            SIH {formatQtyExact(row.sih, qtyKind)}, reserved {formatQtyExact(row.reserved, qtyKind)}.
          </span>
        )}
      </p>
    </div>
  );
}

function procurementItemMergeKey(item: ProcurementRequestItem): string {
  if (item.type === 'RM' && item.raw_material_id != null && Number(item.raw_material_id) > 0) {
    return `rm:${Number(item.raw_material_id)}`;
  }
  if (item.type === 'PM' && item.pack_material_id != null && Number(item.pack_material_id) > 0) {
    return `pm:${Number(item.pack_material_id)}`;
  }
  return `${item.type}:${String(item.code || item.name || '').trim().toLowerCase()}`;
}

/** Marker in procurement_requests.notes — open quotation asks from Planning (no Items List vendor). */
const PLANNING_QUOTATION_REQUEST_NOTE_TAG = 'Quotation requested from Planning';

function buildPlanningQuotationLineNotes(opts: {
  vendorName: string;
  moq: number;
  hasExistingRates: boolean;
}): string {
  const v = opts.vendorName.trim();
  const moq = Number(opts.moq) || 0;
  const bits: string[] = ['Quotation requested from Planning'];
  if (v) bits.push(`Vendor: ${v}`);
  if (moq > 0) bits.push(`MOQ: ${moq}`);
  if (opts.hasExistingRates && !v && moq <= 0) {
    bits.push('Additional vendor or MOQ tier');
  } else if (!opts.hasExistingRates) {
    bits.push('No vendor rate on Items List');
  }
  bits.push('Procurement to add quotation');
  return bits.join(' · ');
}

function isQuotationRequestProcurementRecord(pr: ProcurementRequest): boolean {
  return String(pr.notes ?? '').includes(PLANNING_QUOTATION_REQUEST_NOTE_TAG);
}

/** Tab stats — all possible keys so we can access without `any` */
type PlanningTabStats = {
  totalSOs?: number;
  prodReleased?: number;
  shortages?: number;
  batchesRequired?: number;
  batchesConfirmed?: number;
  notPlanned?: number;
  soValue?: string;
  confirmedProducts?: { value: number; total: number };
  rmItems?: { value: number; ok: number; short: number };
  pmItems?: { value: number; ok: number; short: number };
  rmShortages?: number;
  pmShortages?: number;
  prsRaised?: number;
};

interface SalesOrder {
  id: string;
  soNumber: string;
  productName: string;
  productCode: string;
  customerName?: string;
  soStatus?: string;
  orderQty: string;
  totalKg: string;
  orderDate: string;
  /** When this row entered planning — SLA clock starts here (not SO date at midnight). */
  createdAt?: string | null;
  dueDate: string;
  daysLeft: string;
  batchSize: string;
  batchesRequired: number;
  bomStatus: 'Production Released' | 'Production Ready' | 'In Progress' | 'Planned';
  bomConfirmedAt?: string | null;
  planningSla?: {
    elapsedHours: number;
    label: string;
    sub: string;
    tone: 'green' | 'amber' | 'red';
  };
  /** Single BOM-level Specific Gravity (vs water). Null until the planner confirms BOM on the first-batch flow. */
  bomSpecificGravity?: number | null;
  approvedBy: string;
  rawMaterials: RawMaterial[];
  packagingMaterials: PackagingMaterial[];
  color?: string;
  productId?: number;
  /** Indices of batches already sent to production (history); gray out in Plan Batches */
  sentBatchIndices?: number[];
  batchCount?: number | null;
  customBatches?: { sizeKg: number }[] | null;
}

/** PIs Extracted: row background tier from RM/PM startable batch counts vs total batches. */
type PisAvailabilityTier = 'loading' | 'unknown' | 'full' | 'partial' | 'none';

function getPisAvailabilityTier(
  item: SoPlanningAvailabilityItem | null | undefined,
  loading: boolean
): PisAvailabilityTier {
  if (loading && !item) return 'loading';
  if (!item) return 'unknown';
  const tb = Number(item.totalBatches) || 0;
  if (tb <= 0) return 'unknown';
  const rm = Number(item.rmStartableCount) || 0;
  const pm = Number(item.pmStartableCount) || 0;
  if (rm >= tb && pm >= tb) return 'full';
  if (rm === 0 && pm === 0) return 'none';
  return 'partial';
}

function pisAvailabilityRowClass(tier: PisAvailabilityTier): string {
  const base =
    'border-b border-gray-100/80 cursor-pointer transition-all duration-200 ease-out';
  switch (tier) {
    case 'loading':
      return `${base} bg-slate-50/95 border-l-[3px] border-l-slate-400 hover:bg-slate-100/95 hover:shadow-md`;
    case 'unknown':
      return `${base} bg-gray-50/95 border-l-[3px] border-l-gray-400 hover:bg-gray-100/95 hover:shadow-md`;
    case 'full':
      return `${base} bg-emerald-50/95 border-l-[4px] border-l-emerald-500 hover:bg-emerald-100/90 hover:shadow-[0_2px_12px_-2px_rgba(16,185,129,0.35)]`;
    case 'partial':
      return `${base} bg-amber-50/95 border-l-[4px] border-l-amber-500 hover:bg-amber-100/90 hover:shadow-[0_2px_12px_-2px_rgba(245,158,11,0.4)]`;
    case 'none':
      return `${base} bg-rose-50/95 border-l-[4px] border-l-rose-500 hover:bg-rose-100/90 hover:shadow-[0_2px_12px_-2px_rgba(244,63,94,0.38)]`;
    default:
      return `${base} hover:bg-gray-50`;
  }
}

/** Map API row to SalesOrder shape for Plan Batches / Raise PR modals */
function apiRowToSalesOrder(row: PlanningExtractedRow): SalesOrder {
  return {
    id: row.id,
    soNumber: row.soNumber,
    productName: row.productName,
    productCode: row.productCode,
    customerName: row.customerName ?? undefined,
    soStatus: row.soStatus ?? undefined,
    orderQty: row.orderQty,
    totalKg: row.totalKg,
    orderDate: row.orderDate,
    createdAt: row.createdAt ?? null,
    dueDate: row.dueDate,
    daysLeft: row.daysLeft,
    batchSize: row.batchSize,
    batchesRequired: row.batchesRequired,
    bomStatus: (row.bomStatus as SalesOrder['bomStatus']) || 'Planned',
    bomConfirmedAt: (row as { bomConfirmedAt?: string | null }).bomConfirmedAt ?? null,
    planningSla: row.planningSla,
    bomSpecificGravity: (row as { bomSpecificGravity?: number | null }).bomSpecificGravity ?? null,
    approvedBy: row.approvedBy,
    rawMaterials: (row.rawMaterials ?? []).map((rm, i) => ({ ...rm, id: rm.id ?? String((rm as { raw_material_id?: number }).raw_material_id ?? i) } as RawMaterial)),
    packagingMaterials: (row.packagingMaterials ?? []).map((pm, i) => ({ ...pm, id: pm.id ?? String((pm as { pack_material_id?: number }).pack_material_id ?? i) } as PackagingMaterial)),
    color: row.color,
    productId: row.product_id,
    sentBatchIndices: Array.isArray(row.sentBatchIndices) ? row.sentBatchIndices : [],
    batchCount: row.batchCount ?? null,
    customBatches: Array.isArray(row.customBatches) ? row.customBatches : null,
  };
}

/** Batch BOM line shapes from API */
interface BatchRmLine { inci_name?: string; rm_code?: string; pct_w_w?: number; uom?: string; phase?: string; raw_material_id?: number }
interface BatchPmLine { description?: string; pm_code?: string; qty_per_unit?: number; uom?: string }

/** Row shape for Raise PR from batch detail (single item + shortfall). */
interface BatchDetailRowForPr {
  id: string;
  type: 'RM' | 'PM';
  name: string;
  code: string;
  required: number;
  unit: string;
  sih: number;
  shortfall: number;
  raw_material_id?: number;
  pack_material_id?: number;
}

/** One row on /planning/batches: batch code is read-only; edit size (kg); click elsewhere opens detail. */
function PlanningBatchTableRow({
  row,
  onOpenDetail,
}: {
  row: PlanningBatchAllRow;
  onOpenDetail: (row: PlanningBatchAllRow) => void;
}) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [sizeKgStr, setSizeKgStr] = useState(row.sizeKg != null ? String(row.sizeKg) : '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSizeKgStr(row.sizeKg != null ? String(row.sizeKg) : '');
  }, [row.id, row.batchCode, row.sizeKg]);

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const sizeNum = parseFloat(String(sizeKgStr).replace(/,/g, '').trim());
    if (!Number.isFinite(sizeNum) || sizeNum < 0) {
      addToast('error', 'Enter a valid size (kg)');
      return;
    }
    setSaving(true);
    try {
      const updated = await updatePlanningBatch(String(row.planningExtractedId), row.id, {
        sizeKg: sizeNum,
      });
      if (updated) {
        addToast('success', 'Batch saved');
        await queryClient.invalidateQueries({ queryKey: ['planning-batches-all'] });
      } else {
        addToast('error', 'Could not save batch');
      }
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Could not save batch');
    } finally {
      setSaving(false);
    }
  };

  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    if ((e.target as HTMLElement).closest('input,button,textarea,select')) return;
    onOpenDetail(row);
  };

  return (
    <tr
      onClick={handleRowClick}
      className="border-b border-gray-100 hover:bg-emerald-50/80 cursor-pointer transition-colors"
    >
      <td className="px-4 py-3 text-sm">
        <div className="font-mono font-semibold text-gray-900">{row.batchCode?.trim() ? row.batchCode : '—'}</div>
        <div className="text-xs text-gray-500 mt-0.5">{row.productName ?? row.productCode ?? '—'}</div>
      </td>
      <td className="px-4 py-3 text-gray-700">{row.customerName ?? '—'}</td>
      <td className="px-4 py-3 text-xs">
        <div className="flex flex-wrap gap-1.5">
          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold">
            {sizeKgStr || '0'} KG
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-50 text-slate-700 border border-slate-200">
            SO {row.soNumber ?? '—'}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-xs">
        <div className="space-y-1">
          <div className="font-medium text-slate-700">
            RM {(Array.isArray(row.rmLines) ? row.rmLines.length : 0)} · PM {(Array.isArray(row.pmLines) ? row.pmLines.length : 0)}
          </div>
          <div className="text-gray-500">BOM {row.bomStatus ?? 'Planned'}</div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(row);
            }}
            className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-800 underline"
          >
            View items →
          </button>
        </div>
      </td>
      <td className="px-4 py-3 text-xs">
        {(() => {
          const stage = getBatchLifecycleStatus(row);
          const tone =
            stage === 'Released'
              ? 'text-emerald-700'
              : stage === 'In Mfg'
                ? 'text-blue-700'
                : stage === 'In QC'
                  ? 'text-violet-700'
                  : stage === 'On Hold'
                    ? 'text-red-700'
                    : 'text-amber-700';
          const detail =
            stage === 'Released'
              ? 'FG released from production'
              : stage === 'In Mfg'
                ? row.sent
                  ? 'Sent to Production — BMR/BPR in progress'
                  : 'Marked in manufacturing'
                : stage === 'In QC'
                  ? 'Quality check in progress'
                  : stage === 'On Hold'
                    ? 'Blocked — resolve before scheduling'
                    : row.sent
                      ? 'Sent — awaiting production start'
                      : 'Draft batch — confirm BOM & send to Production';
          return (
            <>
              <div className={`font-semibold ${tone}`}>{stage}</div>
              <div className="text-gray-500 mt-0.5 leading-snug">{detail}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                Batch {row.batchCode ?? `PE-${row.planningExtractedId}-B${row.sequence}`} · seq {row.sequence ?? '—'}
              </div>
            </>
          );
        })()}
      </td>
      <td className="px-4 py-3 text-xs text-gray-600">
        <div className="font-medium text-gray-800">Due {row.dueDate ?? '—'}</div>
        <div className="text-gray-500 mt-0.5">
          {row.sent ? 'Sent to Production' : 'Not sent'} · BOM {row.bomStatus ?? 'Planned'}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-gray-600">
        <div className="font-medium text-gray-800">
          {row.customerName ?? '—'} · SO {row.soNumber ?? '—'}
        </div>
        <div className="text-gray-500 mt-0.5">
          {row.productName ?? row.productCode ?? '—'} · {row.sizeKg != null ? `${row.sizeKg} kg` : '—'}
        </div>
      </td>
      <td className="px-4 py-3 text-xs">
        <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-medium">
          {row.soNumber ?? '—'}
        </span>
      </td>
      <td className="px-4 py-2 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-2">
          {(() => {
            const st = getBatchLifecycleStatus(row);
            const cls =
              st === 'Released'
                ? 'bg-emerald-100 text-emerald-700'
                : st === 'In Mfg'
                  ? 'bg-blue-100 text-blue-700'
                  : st === 'In QC'
                    ? 'bg-violet-100 text-violet-700'
                    : st === 'On Hold'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700';
            return <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${cls}`}>{st}</span>;
          })()}
          <input
            type="number"
            min={0}
            step="0.01"
            value={sizeKgStr}
            onChange={(e) => setSizeKgStr(e.target.value)}
            className="w-20 border border-gray-300 rounded-md px-2 py-1 text-xs font-mono text-right text-gray-900"
            aria-label="Size kg"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? '…' : 'Save'}
          </button>
        </div>
      </td>
    </tr>
  );
}

/** Batches tab: list all planning batches. Row click → batch detail popup (items, stock, PR per shortfall). */
function PlanningBatchesTab({
  onBatchClick,
  dateFilter,
}: {
  onBatchClick: (row: PlanningBatchAllRow) => void;
  dateFilter: { from: string; to: string };
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [batchTypeFilter, setBatchTypeFilter] = useState<'all' | 'planned' | 'in-mfg' | 'in-qc' | 'released' | 'on-hold'>('all');
  const [sortBy, setSortBy] = useState<'dueAsc' | 'dueDesc' | 'sizeAsc' | 'sizeDesc' | 'codeAsc' | 'codeDesc'>('dueAsc');
  const { data: allBatches = [], isLoading } = useQuery({
    queryKey: ['planning-batches-all'],
    queryFn: fetchAllBatches,
    enabled: true,
  });
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  // Show all sent batches, and always include rework batches so production-raised rework
  // appears in Planning even if sent flag comes late/out-of-sync.
  const rows = (allBatches as PlanningBatchAllRow[]).filter((row) => {
    const code = String(row.batchCode ?? '').toLowerCase();
    const isRework = code.includes('-rw-');
    return row.sent === true || isRework;
  });
  const dateFilteredRows = rows.filter((row) =>
    matchesDateRangeFilter(row.dueDate, dateFilter.from, dateFilter.to)
  );
  const searchedRows = dateFilteredRows.filter((row) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    const haystack = [
      row.batchCode,
      row.soNumber,
      row.customerName,
      row.productName,
      row.dueDate,
    ]
      .map((v) => String(v ?? '').toLowerCase())
      .join(' ');
    return haystack.includes(q);
  });
  const filteredRows = searchedRows.filter((row) => {
    if (batchTypeFilter === 'all') return true;
    const st = getBatchLifecycleStatus(row);
    if (batchTypeFilter === 'planned') return st === 'Planned';
    if (batchTypeFilter === 'in-mfg') return st === 'In Mfg';
    if (batchTypeFilter === 'in-qc') return st === 'In QC';
    if (batchTypeFilter === 'released') return st === 'Released';
    if (batchTypeFilter === 'on-hold') return st === 'On Hold';
    return true;
  });
  const sortedRows = [...filteredRows].sort((a, b) => {
    const codeA = String(a.batchCode ?? '').toLowerCase();
    const codeB = String(b.batchCode ?? '').toLowerCase();
    const sizeA = Number(a.sizeKg) || 0;
    const sizeB = Number(b.sizeKg) || 0;
    const dueA = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const dueB = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
    switch (sortBy) {
      case 'dueDesc':
        return dueB - dueA;
      case 'sizeAsc':
        return sizeA - sizeB;
      case 'sizeDesc':
        return sizeB - sizeA;
      case 'codeAsc':
        return codeA.localeCompare(codeB);
      case 'codeDesc':
        return codeB.localeCompare(codeA);
      case 'dueAsc':
      default:
        return dueA - dueB;
    }
  });
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Batches sent to production. Edit batch code and size (kg), then Save. Click a row (outside fields) to view items, stock, and raise PR for shortfalls.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search batch, SO, customer, product..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <select
          value={batchTypeFilter}
          onChange={(e) => setBatchTypeFilter(e.target.value as typeof batchTypeFilter)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="all">All</option>
          <option value="planned">Planned</option>
          <option value="in-mfg">In Mfg</option>
          <option value="in-qc">In QC</option>
          <option value="released">Released</option>
          <option value="on-hold">On Hold</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'dueAsc' | 'dueDesc' | 'sizeAsc' | 'sizeDesc' | 'codeAsc' | 'codeDesc')}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="dueAsc">Sort: Due date (earliest)</option>
          <option value="dueDesc">Sort: Due date (latest)</option>
          <option value="sizeDesc">Sort: Size (high to low)</option>
          <option value="sizeAsc">Sort: Size (low to high)</option>
          <option value="codeAsc">Sort: Batch code (A-Z)</option>
          <option value="codeDesc">Sort: Batch code (Z-A)</option>
        </select>
      </div>
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1280px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Batch / Product</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Customer</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Batch Specs</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Item Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Current Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Timeline</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">SO / Product</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Related SO</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <PlanningBatchTableRow key={`${row.planningExtractedId}-${row.id}`} row={row} onOpenDetail={onBatchClick} />
              ))}
            </tbody>
          </table>
        </div>
        {sortedRows.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            {allBatches.length === 0
              ? 'No batches yet. Create batches from Plan Batches (PIs Extracted) per SO line.'
              : 'No batches matched your current filters/search.'}
          </div>
        )}
      </div>
    </div>
  );
}

const Planning = () => {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRowForDetail, setSelectedRowForDetail] = useState<SalesOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });
  const [pisPage, setPisPage] = useState(1);
  const [pisPageSize, setPisPageSize] = useState(20);
  const [prModalOpen, setPrModalOpen] = useState(false);
  const [selectedSO, setSelectedSO] = useState<SalesOrder | null>(null);
  const [prSending, setPrSending] = useState(false);
  const [prPriority, setPrPriority] = useState('High');
  const [prRequiredByDate, setPrRequiredByDate] = useState('');
  const [prNotes, setPrNotes] = useState('');
  const [prShowPMOnly, setPrShowPMOnly] = useState(false);
  const [prItems, setPrItems] = useState<ProcurementRequestItem[]>([]);
  const [prOmittedCount, setPrOmittedCount] = useState(0);
  const [planBatchesModalOpen, setPlanBatchesModalOpen] = useState(false);
  const [swapSourceIndex, setSwapSourceIndex] = useState<number | null>(null);
  const [selectedSOForBatch, setSelectedSOForBatch] = useState<SalesOrder | null>(null);
  const [activeBatchTab, setActiveBatchTab] = useState<'batch-plan' | 'bom-editor' | 'swap-add'>('bom-editor');
  const [numBatches, setNumBatches] = useState('15');
  const [batchSizeKg, setBatchSizeKg] = useState('500');
  const [plannedStartDate, setPlannedStartDate] = useState('2026-03-04');
  const [productionLine, setProductionLine] = useState('Line 1 — Primary Mixer');
  const [bomFormula, setBomFormula] = useState<RawMaterial[]>([]);
  /** Single BOM-level Specific Gravity (vs water). Picked once on first-batch BOM confirmation, then locked for subsequent batches. */
  const [bomLevelSG, setBomLevelSG] = useState<string>('1');
  const [swapRmSearch, setSwapRmSearch] = useState('');
  const [swapRmResults, setSwapRmResults] = useState<RawMaterialRecord[]>([]);
  const [swapRmSearchLoading, setSwapRmSearchLoading] = useState(false);
  const [swapRmSuggestionsOpen, setSwapRmSuggestionsOpen] = useState(false);
  const [swapAddToGroup, setSwapAddToGroup] = useState(false);
  const [swapGroupName, setSwapGroupName] = useState('');
  const [swapPendingGroupRm, setSwapPendingGroupRm] = useState<{ id: number; name: string } | null>(null);
  const [swapApplying, setSwapApplying] = useState(false);
  const [bomPackaging, setBomPackaging] = useState<PackagingMaterial[]>([]);
  const [isReadyForProduction, setIsReadyForProduction] = useState(false);
  const [productionSentOrderIds, setProductionSentOrderIds] = useState<string[]>([]);
  const [customBatches, setCustomBatches] = useState<{ sizeKg: number }[]>([]);
  const [expandedBatchIndex, setExpandedBatchIndex] = useState<number | null>(null);
  /** Selected batch id (planning_batches.id) — drives BOM editor, swap/add, batch plan for this batch only */
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  /** Preview qty (units) on Batch Plan tab — drives req/max units and summary bar */
  const [feasibilityPreviewQty, setFeasibilityPreviewQty] = useState<number>(0);
  const location = useLocation();
  const pathTab = location.pathname.split('/planning/')[1]?.split('/')[0] || '';
  const activeMainTab: 'pis-extracted' | 'items-involved' | 'batches' =
    pathTab === 'items-involved' ? 'items-involved' : pathTab === 'batches' ? 'batches' : 'pis-extracted';

  useEffect(() => {
    if (activeMainTab !== 'pis-extracted') return undefined;
    const timer = window.setInterval(() => {
      setSlaClockTick((n) => n + 1);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [activeMainTab]);
  const [itemsInvolvedCategoryFilter, setItemsInvolvedCategoryFilter] = useState<'all' | 'RM' | 'PM' | 'shortage' | 'available'>('all');
  const [itemsInvolvedProductFilter, setItemsInvolvedProductFilter] = useState<string>('all');
  const [itemsInvolvedSearchTerm, setItemsInvolvedSearchTerm] = useState('');
  /** Re-render PIs Extracted SLA column every minute while tab is open. */
  const [slaClockTick, setSlaClockTick] = useState(0);
  const [usedInModalItem, setUsedInModalItem] = useState<ItemsInvolvedDisplayRow | null>(null);
  const [releaseToPlanningItem, setReleaseToPlanningItem] = useState<ItemsInvolvedDisplayRow | null>(null);
  const [releaseToPlanningForm, setReleaseToPlanningForm] = useState<{
    vendorId: number | null;
    vendorName: string;
    moq: number;
    qty: string;
    unitPrice: string;
    paymentTermsType: PaymentTermsStructuredType;
    advancePercent: string;
    leadTimeDays: number;
    /** Items List `payment_terms` JSON string when picked from a rate; cleared when user edits type/advance manually. */
    paymentTermsRaw: string | null;
  }>({
    vendorId: null,
    vendorName: '',
    moq: 0,
    qty: '',
    unitPrice: '',
    paymentTermsType: 'as_per_contract',
    advancePercent: '50',
    leadTimeDays: 0,
    paymentTermsRaw: null,
  });
  const [releaseToPlanningSaving, setReleaseToPlanningSaving] = useState(false);
  /** `release` = Add Planned Line / vendor release (updates Items Involved). `quotation` = Procurement quote ask only. */
  const [releaseModalIntent, setReleaseModalIntent] = useState<'release' | 'quotation'>('release');
  const [batchForDetailModal, setBatchForDetailModal] = useState<PlanningBatchAllRow | null>(null);
  /** Raise PR confirmation popup from batch detail: { batch, row } so user can confirm and edit before sending. */
  const [batchPrModal, setBatchPrModal] = useState<{ batch: PlanningBatchAllRow; row: BatchDetailRowForPr } | null>(null);
  const [batchPrQty, setBatchPrQty] = useState(0);
  const [batchPrPriority, setBatchPrPriority] = useState('High');
  const [batchPrRequiredBy, setBatchPrRequiredBy] = useState('');
  const [batchPrNotes, setBatchPrNotes] = useState('');
  const [batchPrSending, setBatchPrSending] = useState(false);
  /** Confirm before sending a planned batch to Production (Plan Batches modal or Batches tab detail). */
  const [sendToProductionConfirm, setSendToProductionConfirm] = useState<
    null | { source: 'plan-modal'; batchIndex: number } | { source: 'batch-detail'; batch: PlanningBatchAllRow }
  >(null);
  const [sendToProductionSending, setSendToProductionSending] = useState(false);
  const [sendToProductionSuccess, setSendToProductionSuccess] = useState<null | { title: string; message: string }>(null);
  const canSendToProduction =
    isReadyForProduction ||
    selectedSOForBatch?.bomStatus === 'Production Ready' ||
    Boolean(selectedSOForBatch?.bomConfirmedAt);

  // Planning list: used for PIs Extracted tab and tab stats
  const { data: planningExtractedList = [], isLoading: planningLoading } = useQuery({
    queryKey: ['planning-extracted'],
    queryFn: fetchPlanningExtractedList,
    enabled: true,
  });

  // Used by Items Involved tab for "Planned line" badge + "Previous purchases" modal.
  // Intentionally backend-driven (no localStorage cache) for production reliability.
  const { data: purchaseOrders = [], isLoading: purchaseOrdersLoading } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: async () => {
      const res = await fetchPurchaseOrders();
      return res.success ? (res.data ?? []) : [];
    },
    enabled: activeMainTab === 'items-involved',
  });

  // Used for MFG Records column in "PIs Extracted" list.
  const { data: productionBatches = [] } = useQuery({
    queryKey: ['production-batches'],
    queryFn: fetchBatches,
    enabled: activeMainTab === 'pis-extracted',
  });
  const pisRows: SalesOrder[] = useMemo(
    () => planningExtractedList.map(apiRowToSalesOrder),
    [planningExtractedList]
  );

  // Fulfillment "Availability" parity: per SO, fetch planning availability (RM/PM startable batches) and show it in PIs Extracted rows.
  const normalizeSoKey = (value: string) => String(value || '').trim().toUpperCase();
  const [planningAvailabilityBySoNo, setPlanningAvailabilityBySoNo] = useState<Record<string, SoPlanningAvailabilityResponse>>({});
  const [planningAvailabilityLoading, setPlanningAvailabilityLoading] = useState(false);
  const planningAvailabilityRequestInFlight = useRef(false);

  const productIdForBom = selectedSOForBatch?.productId ?? 0;
  const { data: bomByProduct } = useQuery({
    queryKey: ['bom-by-product', productIdForBom],
    queryFn: async () => {
      const r = await fetchBOMByProductId(productIdForBom);
      return r.data ?? null;
    },
    enabled: planBatchesModalOpen && productIdForBom > 0,
  });
  const activeBom: BOMRecord | null = bomByProduct ?? null;

  const { data: prProductDetailForBom } = useQuery({
    queryKey: ['pr-product-detail-bom', productIdForBom],
    queryFn: async () => {
      const r = await fetchPRProductDetail(productIdForBom);
      return r.data ?? null;
    },
    enabled: planBatchesModalOpen && productIdForBom > 0,
  });
  const prSpecBulkForBom = effectivePrSpecBulk(activeBom, prProductDetailForBom);

  // BOM for detail popup: when FG row is clicked, load BOM to show RM/PM × order qty
  const productIdForDetail = selectedRowForDetail?.productId ?? 0;
  const { data: bomForDetail } = useQuery({
    queryKey: ['bom-by-product-detail', productIdForDetail],
    queryFn: async () => {
      const r = await fetchBOMByProductId(productIdForDetail);
      return r.data ?? null;
    },
    enabled: detailModalOpen && productIdForDetail > 0,
  });

  // Parse order qty from display string (e.g. "50,000 Units" or "50000") for total required calc
  const orderQtyNumForDetail = useMemo(() => {
    if (!selectedRowForDetail?.orderQty) return 0;
    const s = String(selectedRowForDetail.orderQty).replace(/,/g, '').trim();
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? 0 : n;
  }, [selectedRowForDetail?.orderQty]);
  const totalKgNumForDetail = useMemo(() => {
    if (!selectedRowForDetail?.totalKg) return 0;
    const n = parseFloat(String(selectedRowForDetail.totalKg).replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }, [selectedRowForDetail?.totalKg]);
  const batchSizeKgForDetail = useMemo(() => {
    if (!selectedRowForDetail?.batchSize) return 0;
    const n = parseFloat(String(selectedRowForDetail.batchSize).replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }, [selectedRowForDetail?.batchSize]);

  const { data: rawMaterialsData } = useQuery({
    queryKey: ['raw-materials-list'],
    queryFn: () => fetchRawMaterialsList(),
    enabled: planBatchesModalOpen || prModalOpen || detailModalOpen || batchForDetailModal != null,
  });
  const { data: packMaterialsData } = useQuery({
    queryKey: ['pack-materials-list'],
    queryFn: () => fetchPackMaterialsList(),
    enabled: planBatchesModalOpen || prModalOpen || detailModalOpen || batchForDetailModal != null,
  });
  const rawMaterialsList = useMemo(() => rawMaterialsData ?? [], [rawMaterialsData]);
  const packMaterialsList = useMemo(() => packMaterialsData ?? [], [packMaterialsData]);

  const { data: vendorClientsData, isLoading: vendorClientsLoading } = useQuery({
    queryKey: ['vendor-clients', 'vendor', 'planning-release'],
    queryFn: async () => {
      const res = await fetchVendorClients('vendor');
      return res.success && res.data ? res.data : [];
    },
    enabled: releaseToPlanningItem != null,
    staleTime: 5 * 60 * 1000,
  });
  const vendorClientsList = useMemo(
    () => vendorClientsData ?? [],
    [vendorClientsData],
  );

  const { data: productsList = [] } = useQuery({
    queryKey: ['products-list'],
    queryFn: async () => {
      const r = await fetchPRProducts();
      return r.success && r.data ? r.data : [];
    },
    enabled: prModalOpen,
  });

  const { data: itemGroupsRmResult } = useQuery({
    queryKey: ['item-groups-rm'],
    queryFn: () => fetchItemGroups('RM'),
    enabled: planBatchesModalOpen,
  });
  const itemGroupsRm = itemGroupsRmResult?.data ?? [];

  const { data: warehouseResult } = useQuery({
    queryKey: ['warehouse-inventory'],
    queryFn: async () => {
      const r = await fetchWarehouseInventory();
      return r.data ?? null;
    },
    enabled: planBatchesModalOpen || prModalOpen || detailModalOpen || batchForDetailModal != null,
  });
  const warehouseRows = useMemo(() => warehouseResult?.rows ?? [], [warehouseResult?.rows]);

  // RM/PM for detail popup: order required vs free warehouse stock (fulfillment bar)
  const { detailRmItems, detailPmItems } = useMemo(() => {
    const empty = { detailRmItems: [] as DetailPopupInventoryRow[], detailPmItems: [] as DetailPopupInventoryRow[] };
    if (!selectedRowForDetail) return empty;

    const orderQty = orderQtyNumForDetail || 1;
    const bom = bomForDetail ?? null;

    const findWarehouseStock = (
      type: 'RM' | 'PM',
      code: string | undefined,
      name: string,
      sourceId?: number,
      lineSg = 1
    ) => {
      const wh = warehouseRows.find(
        (r) =>
          r.type === type &&
          (Number(r.sourceId) === Number(sourceId) ||
            (code && r.code === code) ||
            r.name === name)
      );
      if (type === 'PM') {
        return { sih: wh?.stockInHand ?? 0, reserved: wh?.reserved ?? 0 };
      }
      const master = findRmMasterRecord(sourceId, code, rawMaterialsList);
      return {
        sih: warehouseQtyToKg(wh?.stockInHand ?? 0, wh, master, lineSg),
        reserved: warehouseQtyToKg(wh?.reserved ?? 0, wh, master, lineSg),
      };
    };

    const toDetailRow = (
      base: Omit<DetailPopupInventoryRow, 'sih' | 'reserved' | 'freeStock' | 'fulfillable' | 'fulfillmentPct' | 'shortfall'>,
      stock: { sih: number; reserved: number }
    ): DetailPopupInventoryRow => {
      const f = computeDetailFulfillment(base.required, stock.sih, stock.reserved);
      return { ...base, ...f };
    };

    if (bom) {
      const rmItems: DetailPopupInventoryRow[] = (bom.rmLines ?? []).map((line: BOMRmLine, i: number) => {
        const pct = Number(line.pct_w_w ?? (line as { pct?: number }).pct ?? 0) || 0;
        const code = line.rm_code;
        const name =
          (line as { inci_name?: string }).inci_name ??
          (line as { name?: string }).name ??
          String(code ?? '');
        const rawMaterialId = (line as { raw_material_id?: number }).raw_material_id;
        const lineSg = parseSpecificGravity(
          specificGravityFromBomLine(line) ?? (line as { specific_gravity?: number }).specific_gravity
        );
        const absoluteQtyRaw = Number((line as { quantity?: number }).quantity ?? 0) || 0;
        const absoluteQtyKg = toKg(absoluteQtyRaw, line.uom);
        const required =
          pct > 0 && totalKgNumForDetail > 0
            ? (pct / 100) * totalKgNumForDetail
            : absoluteQtyKg > 0 && batchSizeKgForDetail > 0 && totalKgNumForDetail > 0
              ? absoluteQtyKg * (totalKgNumForDetail / batchSizeKgForDetail)
              : absoluteQtyKg * orderQty;
        return toDetailRow(
          {
            id: String(rawMaterialId ?? code ?? i),
            name,
            required,
            quantity: required,
            unit: 'KG',
            pct,
          },
          findWarehouseStock('RM', code, name, rawMaterialId, lineSg)
        );
      });

      const pmItems: DetailPopupInventoryRow[] = (bom.pmLines ?? []).map((line: BOMPmLine, i: number) => {
        const code = line.pm_code;
        const name = line.description ?? (line as { name?: string }).name ?? String(code ?? '');
        const packMaterialId = (line as { pack_material_id?: number }).pack_material_id;
        const qtyPerUnit = (line as { qty_per_unit?: number }).qty_per_unit ?? (line as { qty?: number }).qty ?? 1;
        const required = qtyPerUnit * orderQty;
        return toDetailRow(
          {
            id: String(packMaterialId ?? code ?? i),
            name,
            required,
            quantity: required,
            unit: toPmDisplayUnit(line.uom),
            pct: null,
          },
          findWarehouseStock('PM', code, name, packMaterialId)
        );
      });

      return { detailRmItems: rmItems, detailPmItems: pmItems };
    }

    const rmItems: DetailPopupInventoryRow[] = (selectedRowForDetail.rawMaterials ?? []).map((item, i) => {
      const code = item.code ?? item.id;
      const required = Number(item.quantity) || 0;
      const pct = Number(item.percentage) || 0;
      return toDetailRow(
        {
          id: String(item.id ?? i),
          name: item.name,
          required,
          quantity: required,
          unit: item.unit || 'KG',
          pct,
        },
        findWarehouseStock('RM', code, item.name, item.raw_material_id)
      );
    });

    const pmItems: DetailPopupInventoryRow[] = (selectedRowForDetail.packagingMaterials ?? []).map((item, i) => {
      const code = item.code ?? item.id;
      const required = Number(item.quantity) || 0;
      return toDetailRow(
        {
          id: String(item.id ?? i),
          name: item.name,
          required,
          quantity: required,
          unit: toPmDisplayUnit(item.unit),
          pct: null,
        },
        findWarehouseStock('PM', code, item.name, item.pack_material_id)
      );
    });

    return { detailRmItems: rmItems, detailPmItems: pmItems };
  }, [
    bomForDetail,
    selectedRowForDetail,
    orderQtyNumForDetail,
    totalKgNumForDetail,
    batchSizeKgForDetail,
    warehouseRows,
  ]);

  // Procurement requests: for tab stats (prsRaised)
  // Must return ProcurementRequest[] — same queryKey as Procurement page (shared cache).
  const { data: procurementRequests = [] } = useQuery({
    queryKey: ['procurement-requests'],
    queryFn: async () => {
      const res = await fetchProcurementRequests();
      return res.success ? (res.data ?? []) : [];
    },
    enabled: true,
  });

  const planningIdForBatch = selectedSOForBatch?.id ?? '';
  const { data: planningRowForBatch } = useQuery({
    queryKey: ['planning-extracted', planningIdForBatch],
    queryFn: () => fetchPlanningExtractedById(planningIdForBatch),
    enabled: planBatchesModalOpen && !!planningIdForBatch,
  });

  const { data: bomOverrideForPlanning } = useQuery({
    queryKey: ['planning-bom-override', planningIdForBatch],
    queryFn: () => fetchBomOverride(planningIdForBatch),
    enabled: planBatchesModalOpen && !!planningIdForBatch,
  });

  // `isSuccess` / `isFetched` let the auto-add effect wait until the initial fetch has resolved —
  // without this, `planningBatches.length === 0` (the useQuery default) is indistinguishable from
  // "list loaded and genuinely empty", and the auto-add would fire while backend already has batches,
  // producing the 400 "LAST_BATCH_NOT_SENT".
  const {
    data: planningBatches = [],
    isSuccess: planningBatchesLoaded,
    isFetched: planningBatchesFetched,
  } = useQuery({
    queryKey: ['planning-batches', planningIdForBatch],
    queryFn: () => fetchPlanningBatches(planningIdForBatch),
    enabled: planBatchesModalOpen && !!planningIdForBatch,
  });

  /** Require the latest batch (max sequence) to be sent before adding another (matches backend). */
  const latestPlanningBatchIndex = useMemo(() => {
    if (planningBatches.length === 0) return -1;
    let bestIdx = 0;
    let bestSeq = Number((planningBatches[0] as PlanningBatchRow)?.sequence ?? 0) || 0;
    for (let i = 1; i < planningBatches.length; i += 1) {
      const seq = Number((planningBatches[i] as PlanningBatchRow)?.sequence ?? 0) || 0;
      if (seq >= bestSeq) {
        bestSeq = seq;
        bestIdx = i;
      }
    }
    return bestIdx;
  }, [planningBatches]);
  const canAddAnotherPlanningBatch =
    planningBatches.length === 0 ||
    (selectedSOForBatch?.sentBatchIndices ?? []).some((x) => Number(x) === latestPlanningBatchIndex);

  /** Selected batch detail — drives BOM (bomFormula/bomPackaging) for this batch */
  const { data: selectedBatchData } = useQuery({
    queryKey: ['planning-batch', planningIdForBatch, selectedBatchId],
    queryFn: () => fetchBatchById(planningIdForBatch, selectedBatchId!),
    enabled: planBatchesModalOpen && !!planningIdForBatch && !!selectedBatchId,
  });

  // Sync form fields (numBatches, batchSizeKg, etc.) from planning extracted row. Do NOT set customBatches
  // from batchCount here — the batch list must come from actual planning_batches (see effect below) so we
  // only show batches that exist (B1 only → B-01 only), not placeholders from "batches required".
  useEffect(() => {
    if (!planBatchesModalOpen || !selectedSOForBatch || !planningRowForBatch) return;
    const row = planningRowForBatch as { batchCount?: number; batchesRequired?: number; batchSizeKg?: number; plannedStartDate?: string; productionLine?: string; customBatches?: { sizeKg: number }[] | null };
    if (row.batchCount != null && row.batchCount > 0) setNumBatches(String(row.batchCount));
    else if (row.batchesRequired != null && row.batchesRequired > 0) setNumBatches(String(row.batchesRequired));
    if (row.batchSizeKg != null) setBatchSizeKg(String(row.batchSizeKg));
    if (row.plannedStartDate) setPlannedStartDate(row.plannedStartDate);
    if (row.productionLine) setProductionLine(row.productionLine);
    // Only restore customBatches from saved row when we have saved data; never create placeholders from batchCount.
    // Content-equal guard: avoid writing a new reference when the sizes already match what the user/backend has,
    // which was causing Plan Batches summary values (pending / preview / gaps) to flicker on every render.
    if (Array.isArray(row.customBatches) && row.customBatches.length > 0) {
      const incoming = row.customBatches;
      setCustomBatches((prev) => {
        if (prev.length === incoming.length && prev.every((b, i) => Number(b.sizeKg) === Number(incoming[i]?.sizeKg))) {
          return prev;
        }
        return incoming;
      });
    }
  }, [planBatchesModalOpen, selectedSOForBatch?.id, planningRowForBatch]);

  // Batch-first: ensure at least one batch and set selected batch; sync customBatches from planningBatches
  const addedOneBatchRef = useRef(false);
  // Auto-increment next batch when opening the modal: if every existing batch has already been sent
  // and there are still units to allot, create the next (incremented) batch so the popup shows e.g.
  // B-02 instead of staying on the last sent B-01. Gate with a ref so it runs at most once per
  // modal-open cycle (reset when the modal closes).
  const autoAddedNextBatchRef = useRef(false);
  useEffect(() => {
    if (!planBatchesModalOpen || !planningIdForBatch) return;
    if (planningBatches.length === 0 && !addedOneBatchRef.current) {
      // Guard #1: wait until the planning_batches query has actually resolved. Before it does, length===0
      // only means "default useQuery value", not "server has zero batches". Firing the auto-add here
      // against a server that already has batches causes 400 LAST_BATCH_NOT_SENT.
      if (!planningBatchesLoaded || !planningBatchesFetched) return;
      // Guard #2: if the planning_extracted row says a batch already exists (batch_count > 0), the list is
      // just stale in the client — do NOT auto-add; let the next refetch bring the existing rows instead.
      const rowBatchCount = Number((planningRowForBatch as { batchCount?: number } | undefined)?.batchCount) || 0;
      if (rowBatchCount > 0) return;
      // Guard #3: if the SO already has any sent_batch_indices recorded, batches existed at some point —
      // don't risk re-creating a phantom first batch.
      if ((selectedSOForBatch?.sentBatchIndices ?? []).length > 0) return;
      addedOneBatchRef.current = true;
      addOneBatchFromMaster(planningIdForBatch)
        .then((newBatch) => {
          if (newBatch) {
            mergePlanningBatchIntoListCache(queryClient, planningIdForBatch, newBatch);
            queryClient.invalidateQueries({ queryKey: ['planning-batches', planningIdForBatch] });
            setSelectedBatchId(Number(newBatch.id));
          } else {
            addedOneBatchRef.current = false;
          }
        })
        .catch(() => {
          // On failure (e.g. 400 LAST_BATCH_NOT_SENT from a race), clear the guard so the refetched
          // list can populate normally on the next tick, and refetch to reconcile with the server.
          addedOneBatchRef.current = false;
          queryClient.invalidateQueries({ queryKey: ['planning-batches', planningIdForBatch] });
        });
      return;
    }
    if (planningBatches.length > 0) {
      addedOneBatchRef.current = true;

      // Auto-increment: if every batch in the list has been sent AND the order still has pending
      // units, kick off an add-one so the user lands on the next (unsent) batch. Only fires if the
      // query has fully resolved, and at most once per modal session. The backend add-one endpoint
      // already validates LAST_BATCH_NOT_SENT, so this is safe.
      if (planningBatchesLoaded && planningBatchesFetched && !autoAddedNextBatchRef.current) {
        const sentIdx = selectedSOForBatch?.sentBatchIndices ?? [];
        const allSent = planningBatches.every((_, i) => sentIdx.includes(i));
        const oq = parseInt(selectedSOForBatch?.orderQty?.replace(/\D/g, '') || '0', 10) || 0;
        const tk = parseFloat(selectedSOForBatch?.totalKg?.replace(/[^\d.]/g, '') || '0') || 0;
        const kpu = oq > 0 && tk > 0 ? tk / oq : 0;
        const sentKg = (planningBatches as PlanningBatchRow[]).reduce(
          (s, b, i) => (sentIdx.includes(i) ? s + (Number(b.sizeKg) || 0) : s),
          0
        );
        const pendingUnits = kpu > 0 ? Math.max(0, (tk - sentKg) / kpu) : 0;
        if (allSent && pendingUnits > 0) {
          autoAddedNextBatchRef.current = true;
          addOneBatchFromMaster(planningIdForBatch)
            .then((newBatch) => {
              if (newBatch) {
                mergePlanningBatchIntoListCache(queryClient, planningIdForBatch, newBatch);
                queryClient.invalidateQueries({ queryKey: ['planning-batches', planningIdForBatch] });
                setSelectedBatchId(Number(newBatch.id));
              } else {
                autoAddedNextBatchRef.current = false;
              }
            })
            .catch(() => {
              autoAddedNextBatchRef.current = false;
              queryClient.invalidateQueries({ queryKey: ['planning-batches', planningIdForBatch] });
            });
          return;
        }
      }

      const first = planningBatches[0] as PlanningBatchRow;
      if (
        selectedBatchId === null ||
        !planningBatches.some((b: PlanningBatchRow) => Number(b.id) === Number(selectedBatchId))
      ) {
        setSelectedBatchId(Number(first.id));
      }
      // Content-equal guard: keep the same `customBatches` reference when sizes already match the backend.
      // Without this, every `selectedBatchId` or `planningBatches` dep tick would create a new array ref and
      // force downstream memos (pending / preview / gaps) to recompute, causing visible jitter in the modal.
      const incoming = (planningBatches as PlanningBatchRow[]).map((b) => ({ sizeKg: Number(b.sizeKg ?? 500) }));
      setCustomBatches((prev) => {
        if (prev.length === incoming.length && prev.every((b, i) => Number(b.sizeKg) === Number(incoming[i]?.sizeKg))) {
          return prev;
        }
        return incoming;
      });
    }
  }, [
    planBatchesModalOpen,
    planningIdForBatch,
    planningBatches,
    selectedBatchId,
    planningBatchesLoaded,
    planningBatchesFetched,
    planningRowForBatch,
    selectedSOForBatch?.sentBatchIndices,
    selectedSOForBatch?.orderQty,
    selectedSOForBatch?.totalKg,
    queryClient,
  ]);

  useEffect(() => {
    if (!planBatchesModalOpen) {
      addedOneBatchRef.current = false;
      autoAddedNextBatchRef.current = false;
    }
  }, [planBatchesModalOpen]);

  // Mirror `selectedBatchId` into a ref so the auto-select effect below can read the latest value
  // without depending on it (which would re-trigger the effect after its own setState).
  const selectedBatchIdRef = useRef<number | null>(null);
  useEffect(() => {
    selectedBatchIdRef.current = selectedBatchId;
  }, [selectedBatchId]);

  /**
   * When the Plan Batch tab is active, auto-select the first unsent batch so the "next working batch"
   * auto-increments across allotments. Runs ONCE per (modal open + sent-set) — the `autoSelectedForKeyRef`
   * guard prevents this effect from fighting with the user's manual batch selection or looping with other
   * effects that depend on `selectedBatchId`. Intentionally omits `selectedBatchId` from deps so the effect
   * is driven by external state changes only (modal open, tab switch, a new batch was sent), not by its own
   * setState — which was the root of the "Maximum update depth" cascade.
   */
  const autoSelectedForKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!planBatchesModalOpen) {
      autoSelectedForKeyRef.current = null;
      return;
    }
    if (activeBatchTab !== 'batch-plan') return;
    if (!planningBatches || planningBatches.length === 0) return;
    const sent = Array.isArray(selectedSOForBatch?.sentBatchIndices)
      ? (selectedSOForBatch!.sentBatchIndices as number[]).map(Number)
      : [];
    const key = `${selectedSOForBatch?.id ?? ''}|${sent.join(',')}|${planningBatches.length}`;
    if (autoSelectedForKeyRef.current === key) return;
    autoSelectedForKeyRef.current = key;
    const rows = planningBatches as PlanningBatchRow[];
    const firstUnsentIdx = rows.findIndex((_, idx) => !sent.includes(idx));
    if (firstUnsentIdx < 0) return;
    const target = rows[firstUnsentIdx];
    if (target?.id == null) return;
    // Only override selection when the current batch is already sent (or unset); never override a manual pick.
    const currentIdx = rows.findIndex((b) => Number(b.id) === Number(selectedBatchIdRef.current));
    const currentIsSent = currentIdx >= 0 && sent.includes(currentIdx);
    if (selectedBatchIdRef.current != null && !currentIsSent) return;
    if (Number(target.id) !== Number(selectedBatchIdRef.current)) {
      setSelectedBatchId(Number(target.id));
    }
  }, [planBatchesModalOpen, activeBatchTab, planningBatches, selectedSOForBatch?.id, selectedSOForBatch?.sentBatchIndices]);

  // When selected batch data loads, sync BOM from that batch (batch-specific BOM)
  useEffect(() => {
    if (!selectedBatchData || !selectedBatchId) return;
    const rmLines = (selectedBatchData.rmLines || []) as Array<{ inci_name?: string; rm_code?: string; pct_w_w?: number; uom?: string; phase?: string; raw_material_id?: number }>;
    const pmLines = (selectedBatchData.pmLines || []) as Array<{ description?: string; pm_code?: string; qty_per_unit?: number }>;
    setBomFormula(rmLines.map((line, i) => ({
      id: String(line.raw_material_id ?? line.rm_code ?? i),
      name: line.inci_name ?? '',
      quantity: 0,
      unit: 'KG',
      percentage: line.pct_w_w ?? 0,
      code: line.rm_code,
      phase: line.phase ?? 'Phase A',
      specificGravity: lineSgFromPrBom(line as BOMRmLine, prSpecBulkForBom),
    })));
    setBomPackaging(pmLines.map((line, i) => ({
      id: String(line.pm_code ?? i),
      name: line.description ?? '',
      quantity: 0,
      unit: 'PCS',
      value: line.qty_per_unit ?? 1,
      percentage: 0,
      code: line.pm_code,
    })));
  }, [selectedBatchId, selectedBatchData]);

  /**
   * Sum of kg already committed by sent batches. Memoized so that edits to UNSENT batches
   * (which don't affect "remaining after sent batches") do not cause the preview-qty sync
   * effect below to re-fire and overwrite the user's working preview quantity — that was
   * causing "Pending to plan" to flicker while typing in Preview qty (Effect A ↔ Effect B
   * feedback loop through `customBatches`).
   */
  const sentKgForPlanBatches = useMemo(() => {
    if (!selectedSOForBatch) return 0;
    const sent = selectedSOForBatch.sentBatchIndices ?? [];
    if (sent.length === 0) return 0;
    return customBatches.reduce(
      (sum, b, idx) => (sent.includes(idx) ? sum + (Number(b.sizeKg) || 0) : sum),
      0
    );
    // Depend only on the sent-index array (primitive-identity stable when unchanged) and customBatches;
    // the whole `selectedSOForBatch` object is not needed and its identity churn was causing this memo
    // to recompute more often than necessary.
  }, [customBatches, selectedSOForBatch?.sentBatchIndices]);

  // Sync preview qty to "remaining after sent batches" (falls back to order qty when nothing sent yet).
  useEffect(() => {
    if (!selectedSOForBatch) return;
    const orderQtyNum = parseInt(selectedSOForBatch.orderQty?.replace(/\D/g, '') || '0', 10) || 0;
    const totalKgNum = parseFloat(selectedSOForBatch.totalKg?.replace(/[^\d.]/g, '') || '0') || 0;
    const remainingKg = Math.max(0, totalKgNum - sentKgForPlanBatches);
    if (orderQtyNum <= 0 || totalKgNum <= 0) {
      setFeasibilityPreviewQty((prev) => (prev === orderQtyNum ? prev : orderQtyNum));
      return;
    }
    const kgPerUnit = totalKgNum / orderQtyNum;
    const remainingUnits = kgPerUnit > 0 ? Math.round(remainingKg / kgPerUnit) : orderQtyNum;
    const next = Math.max(0, remainingUnits);
    setFeasibilityPreviewQty((prev) => (prev === next ? prev : next));
  }, [
    // Depend on primitive fields only; depending on the whole `selectedSOForBatch` object caused this
    // effect to re-run whenever any unrelated field (e.g. bomStatus, bomConfirmedAt) changed and created
    // a new object reference, which in turn thrashed feasibilityPreviewQty → customBatches → summary.
    selectedSOForBatch?.id,
    selectedSOForBatch?.orderQty,
    selectedSOForBatch?.totalKg,
    sentKgForPlanBatches,
  ]);

  const kgPerUnitForPlanBatches = useMemo(() => {
    const orderQtyNum = parseInt(selectedSOForBatch?.orderQty?.replace(/\D/g, '') || '0', 10) || 0;
    const totalKgNum = parseFloat(selectedSOForBatch?.totalKg?.replace(/[^\d.]/g, '') || '0') || 0;
    return orderQtyNum > 0 && totalKgNum > 0 ? totalKgNum / orderQtyNum : 0;
  }, [selectedSOForBatch?.orderQty, selectedSOForBatch?.totalKg]);

  /**
   * Order vs planned batches: pending kg/units and unsent batch count (Plan Batches modal).
   *
   * Pending = orderTotalKg − sentKg − previewKg
   *   • sentKg   : sum of `customBatches[i].sizeKg` for i in `sentBatchIndices` (stable; only changes
   *                when a batch is actually sent)
   *   • previewKg: `feasibilityPreviewQty * kgPerUnit` (live — updates as the user types in the
   *                Preview qty input, so the user sees pending shrink while they allocate the next
   *                batch)
   *
   * Preview is read directly here instead of being folded back into `customBatches` by Effect B,
   * which decouples this memo from that sync. That's why changing the preview no longer triggers
   * a customBatches → summary → preview loop.
   */
  const planBatchesAllocationSummary = useMemo(() => {
    if (!selectedSOForBatch) return null;
    const oq = parseInt(selectedSOForBatch.orderQty?.replace(/\D/g, '') || '0', 10) || 0;
    const tk = parseFloat(selectedSOForBatch.totalKg?.replace(/[^\d.]/g, '') || '0') || 0;
    const kpu = oq > 0 && tk > 0 ? tk / oq : 0;
    const sent = selectedSOForBatch.sentBatchIndices ?? [];

    const sentKg = customBatches.reduce(
      (s, b, i) => (sent.includes(i) ? s + (Number(b.sizeKg) || 0) : s),
      0
    );
    const previewUnits = Math.max(0, Math.floor(feasibilityPreviewQty || 0));
    const previewKg = Math.max(0, previewUnits * kpu);
    // Preview cannot exceed what remains after the sent batches.
    const remainingAfterSentKg = Math.max(0, tk - sentKg);
    const effectivePreviewKg = Math.min(previewKg, remainingAfterSentKg);

    const allocKg = sentKg + effectivePreviewKg;
    const pendKg = Math.max(0, tk - allocKg);
    const pendUnits = kpu > 0 ? pendKg / kpu : 0;
    const allocUnits = kpu > 0 ? allocKg / kpu : 0;
    const unsentCount = customBatches.filter((_, i) => !sent.includes(i)).length;
    return {
      orderQty: oq,
      orderTotalKg: tk,
      kgPerUnit: kpu,
      allocKg,
      pendKg,
      pendUnits,
      allocUnits,
      unsentCount,
    };
    // Stable primitive/array-identity deps — avoids recomputing pending every time
    // `selectedSOForBatch` gets a new reference from an unrelated field update.
  }, [
    selectedSOForBatch?.id,
    selectedSOForBatch?.orderQty,
    selectedSOForBatch?.totalKg,
    selectedSOForBatch?.sentBatchIndices,
    customBatches,
    feasibilityPreviewQty,
  ]);

  // When preview qty changes, reflect it once into the next active batch-units input in Batch Plan.
  // "Next active" = expanded batch if any; otherwise first unsent batch.
  const lastAppliedPreviewQtyRef = useRef<number | null>(null);
  useEffect(() => {
    if (!planBatchesModalOpen || !selectedSOForBatch) return;
    if (activeBatchTab !== 'batch-plan') return;
    if (!Number.isFinite(kgPerUnitForPlanBatches) || kgPerUnitForPlanBatches <= 0) return;
    if (customBatches.length === 0) return;

    const sent = selectedSOForBatch.sentBatchIndices ?? [];
    const selIdx =
      selectedBatchId != null && planningBatches.length > 0
        ? (planningBatches as PlanningBatchRow[]).findIndex((b) => Number(b.id) === Number(selectedBatchId))
        : -1;
    // Target the selected batch only if it exists AND is unsent; otherwise the first unsent batch.
    // CRITICAL: do NOT fall back to index 0 when there is no unsent batch. The old fallback wrote the
    // preview qty into an already-SENT batch's sizeKg, which corrupted `sentKgForPlanBatches` and
    // triggered a feedback loop with Effect A (preview ↔ sent-kg ping-pong = "Maximum update depth").
    let targetIdx = -1;
    if (selIdx >= 0 && selIdx < customBatches.length && !sent.includes(selIdx)) {
      targetIdx = selIdx;
    } else {
      const firstUnsent = customBatches.findIndex((_, i) => !sent.includes(i));
      if (firstUnsent >= 0) targetIdx = firstUnsent;
    }
    if (targetIdx < 0 || targetIdx >= customBatches.length) return;
    // Safety net — never overwrite a sent batch, even if the logic above missed a case.
    if (sent.includes(targetIdx)) return;

    const nextUnits = Math.max(0, Math.floor(feasibilityPreviewQty || 0));
    if (lastAppliedPreviewQtyRef.current === nextUnits) return;
    lastAppliedPreviewQtyRef.current = nextUnits;
    const currentUnits = Math.round((customBatches[targetIdx]?.sizeKg || 0) / kgPerUnitForPlanBatches);
    if (nextUnits === currentUnits) return;

    try {
      const orderTk = parseFloat(selectedSOForBatch?.totalKg?.replace(/[^\d.]/g, '') || '0') || 0;
      setCustomBatches((prev) => {
        const otherKg = prev.reduce((s, b, i) => (i === targetIdx ? s : s + (Number(b.sizeKg) || 0)), 0);
        const maxKg = Math.max(0, orderTk - otherKg);
        let newKg = nextUnits * kgPerUnitForPlanBatches;
        if (newKg > maxKg) newKg = maxKg;
        // Content-equal guard: if the target batch already has the computed sizeKg (within float tolerance),
        // keep the same array reference so pending / preview / gaps memos don't recompute needlessly.
        const currentKg = Number(prev[targetIdx]?.sizeKg) || 0;
        if (Math.abs(currentKg - newKg) < 1e-6) return prev;
        return prev.map((b, i) => (i === targetIdx ? { ...b, sizeKg: newKg } : b));
      });
      setExpandedBatchIndex(targetIdx);
    } catch (e) {
      console.error('[Planning] preview qty → batch units sync failed', e);
    }
    // Primitive/array-identity deps only. Dropping the whole `selectedSOForBatch` object prevents this
    // effect from re-running when unrelated fields change identity (bomStatus, bomConfirmedAt, etc.).
  }, [
    feasibilityPreviewQty,
    activeBatchTab,
    planBatchesModalOpen,
    selectedSOForBatch?.id,
    selectedSOForBatch?.totalKg,
    selectedSOForBatch?.sentBatchIndices,
    selectedBatchId,
    planningBatches,
    kgPerUnitForPlanBatches,
    customBatches,
  ]);

  useEffect(() => {
    if (!planBatchesModalOpen) {
      lastAppliedPreviewQtyRef.current = null;
    }
  }, [planBatchesModalOpen, selectedSOForBatch?.id]);

  const lastSyncedBomIdRef = useRef<string | null>(null);
  const syncedFallbackOrderIdRef = useRef<string | null>(null);
  const prFromBatchShortagesRef = useRef(false);
  const prFromDetailShortagesRef = useRef(false);
  /** When set, PR is being raised for a specific batch (from "Raise PR for this batch"); used to send planningBatchId. */
  const prForBatchIndexRef = useRef<number | null>(null);
  /** Dedupe Warehouse → Items Involved "Release to Planning" navigation (location.state). */
  const warehouseReleaseHandledNonceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!planBatchesModalOpen || !selectedSOForBatch) return;
    if (selectedBatchId != null) return; // batch-first: BOM comes from selected batch (selectedBatchData effect)
    if (bomOverrideForPlanning === undefined) return;
    if (bomOverrideForPlanning === null) lastSyncedBomIdRef.current = null;
    if (bomOverrideForPlanning && (bomOverrideForPlanning.rmLines?.length > 0 || bomOverrideForPlanning.pmLines?.length > 0)) {
      lastSyncedBomIdRef.current = 'override';
      syncedFallbackOrderIdRef.current = null;
      const rmLines = bomOverrideForPlanning.rmLines ?? [];
      const pmLines = bomOverrideForPlanning.pmLines ?? [];
      setBomFormula(rmLines.map((line: BOMRmLine, i: number) => ({
        id: String((line as { raw_material_id?: number }).raw_material_id ?? line.rm_code ?? i),
        name: line.inci_name ?? (line as { name?: string }).name ?? '',
        quantity: 0,
        unit: line.uom ?? 'KG',
        percentage: line.pct_w_w ?? line.pct ?? 0,
        code: line.rm_code,
        phase: line.phase,
        specificGravity: lineSgFromPrBom(line as BOMRmLine, prSpecBulkForBom),
      })));
      setBomPackaging(pmLines.map((line: BOMPmLine, i: number) => ({
        id: String((line as { pm_code?: string }).pm_code ?? i),
        name: line.description ?? (line as { name?: string }).name ?? '',
        quantity: 0,
        unit: 'PCS',
        value: (line as { qty_per_unit?: number }).qty_per_unit ?? (line as { qty?: number }).qty ?? 1,
        percentage: 0,
        code: (line as { pm_code?: string }).pm_code,
      })));
      setBomLevelSG(
        resolveBomLevelSgFromPr(
          prSpecBulkForBom,
          rmLines,
          selectedSOForBatch.bomSpecificGravity ?? null,
          Boolean(selectedSOForBatch.bomConfirmedAt)
        )
      );
      return;
    }
    if (activeBom && activeBom.productId === selectedSOForBatch.productId) {
      if (lastSyncedBomIdRef.current === 'override' || lastSyncedBomIdRef.current === activeBom.id) return;
      lastSyncedBomIdRef.current = activeBom.id;
      syncedFallbackOrderIdRef.current = null;
      const rmLines = activeBom.rmLines ?? [];
      const pmLines = activeBom.pmLines ?? [];
      setBomFormula(rmLines.map((line: BOMRmLine, i: number) => ({
        id: String((line as { raw_material_id?: number }).raw_material_id ?? line.rm_code ?? i),
        name: line.inci_name ?? (line as { name?: string }).name ?? '',
        quantity: 0,
        unit: line.uom ?? 'KG',
        percentage: line.pct_w_w ?? line.pct ?? 0,
        code: line.rm_code,
        phase: line.phase,
        specificGravity: lineSgFromPrBom(line as BOMRmLine, prSpecBulkForBom),
      })));
      setBomPackaging(pmLines.map((line: BOMPmLine, i: number) => ({
        id: String((line as { pm_code?: string }).pm_code ?? i),
        name: line.description ?? (line as { name?: string }).name ?? '',
        quantity: 0,
        unit: 'PCS',
        value: (line as { qty_per_unit?: number }).qty_per_unit ?? (line as { qty?: number }).qty ?? 1,
        percentage: 0,
        code: (line as { pm_code?: string }).pm_code,
      })));
      setBomLevelSG(
        resolveBomLevelSgFromPr(
          prSpecBulkForBom,
          rmLines,
          selectedSOForBatch.bomSpecificGravity ?? null,
          Boolean(selectedSOForBatch.bomConfirmedAt)
        )
      );
      return;
    }
    if (!activeBom && selectedSOForBatch.rawMaterials?.length >= 0 && syncedFallbackOrderIdRef.current !== selectedSOForBatch.id) {
      syncedFallbackOrderIdRef.current = selectedSOForBatch.id;
      lastSyncedBomIdRef.current = null;
      setBomFormula((selectedSOForBatch.rawMaterials ?? []).map((item, i) => ({
        id: (item as RawMaterial).code ?? item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        percentage: item.percentage,
        code: (item as RawMaterial).code,
        phase: 'Phase A',
        specificGravity: 1,
      })));
      setBomPackaging((selectedSOForBatch.packagingMaterials ?? []).map((item, i) => ({
        id: (item as PackagingMaterial).code ?? item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        value: (item as PackagingMaterial).value ?? 1,
        percentage: (item as PackagingMaterial).percentage ?? 0,
        code: (item as PackagingMaterial).code,
      })));
    }
  }, [planBatchesModalOpen, selectedSOForBatch?.id, selectedSOForBatch?.productId, selectedSOForBatch?.rawMaterials, selectedSOForBatch?.packagingMaterials, selectedSOForBatch?.bomConfirmedAt, selectedSOForBatch?.bomSpecificGravity, activeBom?.id, activeBom?.productId, activeBom?.rmLines, activeBom?.pmLines, activeBom?.specBulk, prSpecBulkForBom, prProductDetailForBom?.specific_gravity, bomOverrideForPlanning, selectedBatchId]);

  useEffect(() => {
    if (!planBatchesModalOpen) {
      lastSyncedBomIdRef.current = null;
      syncedFallbackOrderIdRef.current = null;
    }
  }, [planBatchesModalOpen]);

  // When PR modal opens, build prItems only from items that exist in RM/PM master tables (raw_materials, pack_materials)
  // When opening from Plan Batches "Raise PR for Shortages", prFromBatchShortagesRef is set and we build from feasibility short rows instead
  useEffect(() => {
    if (!prModalOpen || !selectedSO) {
      setPrItems([]);
      setPrOmittedCount(0);
      return;
    }
    if (prFromDetailShortagesRef.current) {
      prFromDetailShortagesRef.current = false;
      return;
    }
    if (prFromBatchShortagesRef.current) {
      prFromBatchShortagesRef.current = false;
      const rmByCode = new Map(rawMaterialsList.map((r) => [r.code?.toLowerCase() ?? '', r]));
      const pmByCode = new Map(packMaterialsList.map((p) => [p.code?.toLowerCase() ?? '', p]));
      const items: ProcurementRequestItem[] = [];
      let omitted = 0;
      for (const row of feasibilityRmRows) {
        if (row.ok) continue;
        const master = rmByCode.get(row.code?.toLowerCase() ?? '') ?? rawMaterialsList.find((r) => r.code === row.code || r.name === row.name);
        if (!master) {
          omitted += 1;
          continue;
        }
        const raw_material_id = master.id != null ? parseInt(String(master.id), 10) : undefined;
        if (raw_material_id == null || Number.isNaN(raw_material_id)) {
          omitted += 1;
          continue;
        }
        const shortage = Math.max(0, row.totalReq - row.sih);
        const proc = rmProcurementFieldsFromKg(shortage, master, row.specificGravity);
        items.push({
          type: 'RM',
          code: master.code ?? row.code,
          name: master.name ?? row.name,
          required: row.totalReq,
          sih: row.sih,
          shortage: proc.quantity_requested,
          quantity_requested: proc.quantity_requested,
          unit: proc.unit,
          line_notes: '',
          raw_material_id,
        });
      }
      for (const row of feasibilityPmRows) {
        if (row.ok) continue;
        const master = pmByCode.get(row.code?.toLowerCase() ?? '') ?? packMaterialsList.find((p) => p.code === row.code || p.description === row.name);
        if (!master) {
          omitted += 1;
          continue;
        }
        const pack_material_id = master.id != null ? parseInt(String(master.id), 10) : undefined;
        if (pack_material_id == null || Number.isNaN(pack_material_id)) {
          omitted += 1;
          continue;
        }
        const shortage = Math.max(0, row.totalReq - row.sih);
        items.push({
          type: 'PM',
          code: master.code ?? row.code,
          name: master.description ?? row.name,
          required: row.totalReq,
          sih: row.sih,
          shortage,
          quantity_requested: shortage,
          unit: 'PCS',
          line_notes: '',
          pack_material_id,
        });
      }
      setPrItems(items);
      setPrOmittedCount(omitted);
      return;
    }
    const validRmIds = new Set(rawMaterialsList.map((r) => String(r.id)));
    const validPmIds = new Set(packMaterialsList.map((p) => String(p.id)));
    const rmByCode = new Map(rawMaterialsList.map((r) => [r.code?.toLowerCase() ?? '', r]));
    const pmByCode = new Map(packMaterialsList.map((p) => [p.code?.toLowerCase() ?? '', p]));
    let omitted = 0;
    const items: ProcurementRequestItem[] = [];

    if (!prShowPMOnly) {
      for (const rm of selectedSO.rawMaterials) {
        const rid = (rm as RawMaterial).raw_material_id;
        const code = (rm as RawMaterial).code ?? rm.id ?? '';
        const master = rid != null && validRmIds.has(String(rid))
          ? rawMaterialsList.find((r) => String(r.id) === String(rid))
          : rmByCode.get(code?.toLowerCase()) ?? rawMaterialsList.find((r) => r.code === code || r.name === rm.name);
        if (!master) {
          omitted += 1;
          continue;
        }
        const raw_material_id = master.id != null ? parseInt(String(master.id), 10) : undefined;
        if (raw_material_id == null || Number.isNaN(raw_material_id)) {
          omitted += 1;
          continue;
        }
        const requiredKg = typeof rm.quantity === 'number' ? rm.quantity : 0;
        const wh = warehouseRows.find((r) => r.type === 'RM' && (r.code === master.code || r.name === master.name || r.sourceId === raw_material_id));
        const lineSg = parseSpecificGravity(
          (rm as { specific_gravity?: number }).specific_gravity ?? (rm as { specificGravity?: number }).specificGravity
        );
        const sihKg = warehouseQtyToKg(wh?.stockInHand ?? 0, wh, master, lineSg);
        const shortageKg = Math.max(0, requiredKg - sihKg);
        const proc = rmProcurementFieldsFromKg(shortageKg, master);
        items.push({
          type: 'RM',
          code: master.code ?? code,
          name: master.name ?? rm.name,
          required: requiredKg,
          sih: sihKg,
          shortage: proc.quantity_requested,
          quantity_requested: proc.quantity_requested,
          unit: proc.unit,
          line_notes: '',
          raw_material_id,
        });
      }
    }
    for (const pm of selectedSO.packagingMaterials) {
      const pid = (pm as PackagingMaterial).pack_material_id;
      const code = (pm as PackagingMaterial).code ?? pm.id ?? '';
      const master = pid != null && validPmIds.has(String(pid))
        ? packMaterialsList.find((p) => String(p.id) === String(pid))
        : pmByCode.get(code?.toLowerCase()) ?? packMaterialsList.find((p) => p.code === code || p.description === pm.name);
      if (!master) {
        omitted += 1;
        continue;
      }
      const pack_material_id = master.id != null ? parseInt(String(master.id), 10) : undefined;
      if (pack_material_id == null || Number.isNaN(pack_material_id)) {
        omitted += 1;
        continue;
      }
      const required = typeof pm.quantity === 'number' ? pm.quantity : 0;
      const wh = warehouseRows.find((r) => r.type === 'PM' && (r.code === master.code || r.name === master.description || r.sourceId === pack_material_id));
      const sih = wh?.stockInHand ?? 0;
      const shortage = Math.max(0, required - sih);
      items.push({
        type: 'PM',
        code: master.code ?? code,
        name: master.description ?? pm.name,
        required,
        sih,
        shortage,
        quantity_requested: shortage,
        unit: pm.unit || 'PCS',
        line_notes: '',
        pack_material_id,
      });
    }
    const shortageItems = items.filter((i) => i.shortage > 0);
    setPrItems(shortageItems);
    setPrOmittedCount(omitted);
  }, [prModalOpen, selectedSO?.id, prShowPMOnly, warehouseRows, rawMaterialsList, packMaterialsList]);

  const batchSizeNum = parseInt(selectedSOForBatch?.batchSize?.replace(/\D/g, '') || '500', 10) || 500;
  const batchesReq = selectedSOForBatch?.batchesRequired ?? 15;
  const orderQtyNum = parseInt(selectedSOForBatch?.orderQty?.replace(/\D/g, '') || '0', 10) || 0;
  const totalKgNum = parseFloat(selectedSOForBatch?.totalKg?.replace(/[^\d.]/g, '') || '0') || 0;
  const unitsPerBatch = batchesReq > 0 ? orderQtyNum / batchesReq : 0;

  /** Units for BOM / Material Status: preview qty, else working batch allocation, else full order. */
  const materialReqUnits = useMemo(() => {
    if (feasibilityPreviewQty > 0) return feasibilityPreviewQty;
    const kpu = kgPerUnitForPlanBatches;
    if (selectedBatchId != null && planningBatches?.length && kpu > 0 && customBatches.length > 0) {
      const idx = (planningBatches as PlanningBatchRow[]).findIndex(
        (b) => Number(b.id) === Number(selectedBatchId)
      );
      if (idx >= 0 && customBatches[idx]) {
        const units = Math.max(0, Math.round((Number(customBatches[idx].sizeKg) || 0) / kpu));
        if (units > 0) return units;
      }
    }
    return orderQtyNum;
  }, [
    feasibilityPreviewQty,
    selectedSOForBatch?.orderQty,
    kgPerUnitForPlanBatches,
    selectedBatchId,
    planningBatches,
    customBatches,
    orderQtyNum,
  ]);

  const effectiveBatchSizeKg = useMemo(() => {
    if (selectedBatchId != null && planningBatches?.length) {
      const row = (planningBatches as PlanningBatchRow[]).find(
        (b) => Number(b.id) === Number(selectedBatchId)
      );
      const sk = row?.sizeKg;
      if (sk != null && Number(sk) > 0) return Number(sk);
    }
    return batchSizeNum;
  }, [selectedBatchId, planningBatches, batchSizeNum]);

  const effectiveKgPerUnit = useMemo(() => {
    if (orderQtyNum > 0 && totalKgNum > 0) return totalKgNum / orderQtyNum;
    if (materialReqUnits > 0 && effectiveBatchSizeKg > 0) {
      return effectiveBatchSizeKg / materialReqUnits;
    }
    if (kgPerUnitForPlanBatches > 0) return kgPerUnitForPlanBatches;
    return 0;
  }, [orderQtyNum, totalKgNum, materialReqUnits, effectiveBatchSizeKg, kgPerUnitForPlanBatches]);

  const feasibilityRmRows = useMemo(() => {
    const rmStockKg = (
      whRow: WarehouseInventoryRow | undefined,
      code: string,
      rawMaterialId: number | string | undefined,
      lineSg: number
    ) => {
      const master = findRmMasterRecord(
        rawMaterialId != null ? Number(rawMaterialId) : undefined,
        code,
        rawMaterialsList
      );
      const sihKg = warehouseQtyToKg(whRow?.stockInHand ?? 0, whRow, master, lineSg);
      const reservedKg = warehouseQtyToKg(whRow?.reserved ?? 0, whRow, master, lineSg);
      const inTransitKg = warehouseQtyToKg(whRow?.inTransit ?? 0, whRow, master, lineSg);
      return { sih: sihKg, reserved: reservedKg, free: Math.max(0, sihKg - reservedKg), inTransit: inTransitKg };
    };

    if (bomFormula.length > 0) {
      return bomFormula.map((item) => {
        const code = item.code ?? item.id;
        const pct = item.percentage ?? 0;
        const specificGravity = parseSpecificGravity(item.specificGravity);
        const perBatch = (effectiveBatchSizeKg * pct) / 100;
        const kgPerUnitRm =
          effectiveKgPerUnit > 0
            ? (pct / 100) * effectiveKgPerUnit
            : perBatch / (unitsPerBatch || materialReqUnits || 1);
        const whRow = warehouseRows.find((r) => r.type === 'RM' && (r.code === code || r.name === item.name || String(r.sourceId) === String(item.id)));
        const stock = rmStockKg(whRow, String(code), item.id, specificGravity);
        const reqThisOrder = kgPerUnitRm * materialReqUnits;
        const maxUnits = kgPerUnitRm > 0 ? Math.floor(stock.free / kgPerUnitRm) : 999;
        const maxBatches = perBatch > 0 ? Math.floor(stock.free / perBatch) : 999;
        const totalReq = effectiveKgPerUnit > 0 ? (pct / 100) * totalKgNum : perBatch * batchesReq;
        const gap = Math.max(0, reqThisOrder - stock.free);
        return { name: item.name, code: String(code), pct, specificGravity, perBatch, ...stock, gap, maxBatches, totalReq, reqThisOrder, maxUnits, ok: maxUnits >= materialReqUnits };
      });
    }
    if (activeBom?.rmLines?.length) {
      return activeBom.rmLines.map((line, i) => {
        const code = line.rm_code ?? String(line.raw_material_id ?? i);
        const pct = line.pct_w_w ?? line.pct ?? 0;
        const specificGravity = parseSpecificGravity(specificGravityFromBomLine(line as BOMRmLine));
        const perBatch = (effectiveBatchSizeKg * pct) / 100;
        const kgPerUnitRm =
          effectiveKgPerUnit > 0
            ? (pct / 100) * effectiveKgPerUnit
            : perBatch / (unitsPerBatch || materialReqUnits || 1);
        const whRow = warehouseRows.find((r) => r.type === 'RM' && (r.code === code || String(r.sourceId) === String(line.raw_material_id)));
        const stock = rmStockKg(whRow, code, line.raw_material_id, specificGravity);
        const reqThisOrder = kgPerUnitRm * materialReqUnits;
        const maxUnits = kgPerUnitRm > 0 ? Math.floor(stock.free / kgPerUnitRm) : 999;
        const maxBatches = perBatch > 0 ? Math.floor(stock.free / perBatch) : 999;
        const totalReq = effectiveKgPerUnit > 0 ? (pct / 100) * totalKgNum : perBatch * batchesReq;
        const gap = Math.max(0, reqThisOrder - stock.free);
        return { name: line.inci_name ?? code, code, pct, specificGravity, perBatch, ...stock, gap, maxBatches, totalReq, reqThisOrder, maxUnits, ok: maxUnits >= materialReqUnits };
      });
    }
    return (selectedSOForBatch?.rawMaterials ?? []).map((item) => {
      const pct = item.percentage || 0;
      const specificGravity = parseSpecificGravity(
        (item as { specific_gravity?: number }).specific_gravity ?? item.specificGravity
      );
      const perBatch = (effectiveBatchSizeKg * pct) / 100;
      const kgPerUnitRm =
        effectiveKgPerUnit > 0
          ? (pct / 100) * effectiveKgPerUnit
          : perBatch / (unitsPerBatch || materialReqUnits || 1);
      const itemCode = (item as RawMaterial).code ?? item.id;
      const whRow = warehouseRows.find((r) => r.type === 'RM' && (r.name === item.name || r.code === itemCode));
      const stock = rmStockKg(whRow, String(itemCode), (item as RawMaterial).raw_material_id ?? item.id, specificGravity);
      const reqThisOrder = kgPerUnitRm * materialReqUnits;
      const maxUnits = kgPerUnitRm > 0 ? Math.floor(stock.free / kgPerUnitRm) : 999;
      const maxBatches = perBatch > 0 ? Math.floor(stock.free / perBatch) : 999;
      const totalReq = effectiveKgPerUnit > 0 ? (pct / 100) * totalKgNum : perBatch * batchesReq;
      const gap = Math.max(0, reqThisOrder - stock.free);
      return { name: item.name, code: itemCode, pct, specificGravity, perBatch, ...stock, gap, maxBatches, totalReq, reqThisOrder, maxUnits, ok: maxUnits >= materialReqUnits };
    });
  }, [bomFormula, activeBom?.rmLines, selectedSOForBatch?.rawMaterials, selectedSOForBatch?.batchSize, selectedSOForBatch?.batchesRequired, selectedSOForBatch?.totalKg, warehouseRows, rawMaterialsList, effectiveBatchSizeKg, batchesReq, orderQtyNum, totalKgNum, effectiveKgPerUnit, unitsPerBatch, materialReqUnits]);

  const feasibilityPmRows = useMemo(() => {
    const upb = batchesReq > 0 ? Math.ceil(orderQtyNum / batchesReq) || 3333 : 3333;
    if (bomPackaging.length > 0) {
      return bomPackaging.map((item) => {
        const code = item.code ?? item.id;
        const qtyPerUnit = item.value ?? 1;
        const perBatchPcs = upb * qtyPerUnit;
        const whRow = warehouseRows.find((r) => r.type === 'PM' && (r.code === code || r.name === item.name || String(r.sourceId) === String(item.id)));
        const sih = whRow?.stockInHand ?? 0;
        const reserved = whRow?.reserved ?? 0;
        const free = Math.max(0, sih - reserved);
        const inTransit = whRow?.inTransit ?? 0;
        const reqThisOrder = qtyPerUnit * materialReqUnits;
        const maxUnits = qtyPerUnit > 0 ? Math.floor(free / qtyPerUnit) : 999;
        const maxBatches = perBatchPcs > 0 ? Math.floor(free / perBatchPcs) : 999;
        const totalReq = qtyPerUnit * orderQtyNum;
        const gap = Math.max(0, reqThisOrder - free);
        return { name: item.name, code: String(code), qtyPerUnit, perBatchPcs, sih, reserved, free, inTransit, gap, maxBatches, totalReq, reqThisOrder, maxUnits, ok: maxUnits >= materialReqUnits };
      });
    }
    if (activeBom?.pmLines?.length) {
      return activeBom.pmLines.map((line, i) => {
        const code = (line as { pm_code?: string }).pm_code ?? String(i);
        const qtyPerUnit = (line as { qty_per_unit?: number }).qty_per_unit ?? (line as { qty?: number }).qty ?? 1;
        const perBatchPcs = upb * qtyPerUnit;
        const whRow = warehouseRows.find((r) => r.type === 'PM' && (r.code === code || String(r.sourceId) === code));
        const sih = whRow?.stockInHand ?? 0;
        const reserved = whRow?.reserved ?? 0;
        const free = Math.max(0, sih - reserved);
        const inTransit = whRow?.inTransit ?? 0;
        const reqThisOrder = qtyPerUnit * materialReqUnits;
        const maxUnits = qtyPerUnit > 0 ? Math.floor(free / qtyPerUnit) : 999;
        const maxBatches = perBatchPcs > 0 ? Math.floor(free / perBatchPcs) : 999;
        const totalReq = qtyPerUnit * orderQtyNum;
        const gap = Math.max(0, reqThisOrder - free);
        return { name: line.description ?? code, code, qtyPerUnit, perBatchPcs, sih, reserved, free, inTransit, gap, maxBatches, totalReq, reqThisOrder, maxUnits, ok: maxUnits >= materialReqUnits };
      });
    }
    return (selectedSOForBatch?.packagingMaterials ?? []).map((item) => {
      const qtyPerUnit = (item as PackagingMaterial).value ?? 1;
      const perBatchPcs = upb * qtyPerUnit;
      const whRow = warehouseRows.find((r) => r.type === 'PM' && (r.name === item.name || r.code === (item as PackagingMaterial).code));
      const sih = whRow?.stockInHand ?? item.quantity ?? 0;
      const reserved = whRow?.reserved ?? 0;
      const free = Math.max(0, sih - reserved);
      const inTransit = whRow?.inTransit ?? 0;
      const reqThisOrder = qtyPerUnit * materialReqUnits;
      const maxUnits = qtyPerUnit > 0 ? Math.floor(free / qtyPerUnit) : 999;
      const maxBatches = perBatchPcs > 0 ? Math.floor(free / perBatchPcs) : 999;
      const totalReq = qtyPerUnit * orderQtyNum;
      const gap = Math.max(0, reqThisOrder - free);
      return { name: item.name, code: (item as PackagingMaterial).code ?? item.id, qtyPerUnit, perBatchPcs, sih, reserved, free, inTransit, gap, maxBatches, totalReq, reqThisOrder, maxUnits, ok: maxUnits >= materialReqUnits };
    });
  }, [bomPackaging, activeBom?.pmLines, selectedSOForBatch?.packagingMaterials, selectedSOForBatch?.orderQty, selectedSOForBatch?.batchesRequired, warehouseRows, batchesReq, orderQtyNum, materialReqUnits]);

  /** BOM can be confirmed whenever the editor has RM/PM lines; backend reserves up to free stock (shortages stay for POs). */
  const canConfirmBomPerBatch = useMemo(() => {
    return feasibilityRmRows.length > 0 || feasibilityPmRows.length > 0;
  }, [feasibilityRmRows, feasibilityPmRows]);

  // Feasibility summary: max units we can make (bottleneck by RM and PM)
  const feasibilityRmCoversUnits = feasibilityRmRows.length > 0 ? Math.min(...feasibilityRmRows.map((r) => r.maxUnits)) : 0;
  const feasibilityPmCoversUnits = feasibilityPmRows.length > 0 ? Math.min(...feasibilityPmRows.map((r) => r.maxUnits)) : 0;
  const feasibilityExecutableUnits = Math.min(feasibilityRmCoversUnits, feasibilityPmCoversUnits);

  const selectedBatchPlanIndex = useMemo(() => {
    if (selectedBatchId == null || !planningBatches?.length) return -1;
    return (planningBatches as PlanningBatchRow[]).findIndex((b) => Number(b.id) === Number(selectedBatchId));
  }, [planningBatches, selectedBatchId]);

  const selectedBatchPlanSequence = useMemo(() => {
    if (selectedBatchPlanIndex < 0) return 1;
    const row = (planningBatches as PlanningBatchRow[])[selectedBatchPlanIndex];
    return Number(row?.sequence ?? selectedBatchPlanIndex + 1) || selectedBatchPlanIndex + 1;
  }, [planningBatches, selectedBatchPlanIndex]);

  // Items Involved — from confirmed BOMs only (API); also used for tab stats
  const { data: itemsInvolvedRows = [], isLoading: itemsInvolvedLoading } = useQuery({
    queryKey: ['planning', 'items-involved'],
    queryFn: () => fetchItemsInvolved({ includeZeroRequired: true }),
    enabled: activeMainTab === 'items-involved',
  });
  const { data: allPlanningBatches = [] } = useQuery({
    queryKey: ['planning', 'batches', 'all', 'items-involved'],
    queryFn: fetchAllBatches,
    enabled: activeMainTab === 'items-involved',
  });
  // Items List (vendor rates) is the single source of truth for quotations and PO planned stage.
  const { data: itemsListRmPage = [] } = useQuery({
    queryKey: ['items-list-page', 'RM', 'planning-items-involved'],
    queryFn: async () => {
      const res = await fetchPriceListPage('RM');
      return res.success ? (res.data ?? []) : [];
    },
    enabled: activeMainTab === 'items-involved',
  });
  const { data: itemsListPmPage = [] } = useQuery({
    queryKey: ['items-list-page', 'PM', 'planning-items-involved'],
    queryFn: async () => {
      const res = await fetchPriceListPage('PM');
      return res.success ? (res.data ?? []) : [];
    },
    enabled: activeMainTab === 'items-involved',
  });

  const { data: planningQuotationAsks = [] } = useQuery({
    queryKey: ['planning-quotation-asks', 'all', 'items-involved'],
    queryFn: async () => {
      const res = await fetchPlanningQuotationAsks({ status: 'all' });
      return res.success ? (res.data ?? []) : [];
    },
    enabled: activeMainTab === 'items-involved',
    refetchInterval: activeMainTab === 'items-involved' ? 60_000 : false,
  });

  const [seenPlanningQuotationAskIds, setSeenPlanningQuotationAskIds] = useState<Set<number>>(() =>
    loadSeenPlanningQuotationAskIds()
  );

  // Tab-specific stats — derived from API data (planning-extracted, items-involved, procurement)
  const tabStats = useMemo(() => {
    const totalSOs = planningExtractedList.length;
    const prodReleased = planningExtractedList.filter((r) => (r as { bomStatus?: string }).bomStatus === 'Production Released').length;
    const batchesRequired = planningExtractedList.reduce((s, r) => s + (r.batchesRequired ?? 0), 0);
    const batchesConfirmed = planningExtractedList.filter((r) => (r as { bomConfirmedAt?: string }).bomConfirmedAt != null).length;
    const notPlanned = Math.max(0, totalSOs - batchesConfirmed);
    const itemShortages = itemsInvolvedRows.filter((r) => r.surplusShortage < 0).length;
    const confirmedCount = planningExtractedList.filter((r) => (r as { bomConfirmedAt?: string }).bomConfirmedAt != null).length;
    const rmItems = itemsInvolvedRows.filter((r) => r.type === 'RM');
    const pmItems = itemsInvolvedRows.filter((r) => r.type === 'PM');
    const rmOk = rmItems.filter((r) => r.coverage >= 100).length;
    const rmShort = rmItems.filter((r) => r.coverage < 100).length;
    const pmOk = pmItems.filter((r) => r.coverage >= 100).length;
    const pmShort = pmItems.filter((r) => r.coverage < 100).length;
    const prCount = procurementRequests.length;

    return {
      'pis-extracted': {
        totalSOs,
        prodReleased,
        shortages: itemShortages,
        batchesRequired,
        batchesConfirmed,
        notPlanned,
        soValue: '—',
      },
      'items-involved': {
        confirmedProducts: { value: confirmedCount, total: totalSOs },
        rmItems: { value: rmItems.length, ok: rmOk, short: rmShort },
        pmItems: { value: pmItems.length, ok: pmOk, short: pmShort },
        rmShortages: rmShort,
        pmShortages: pmShort,
        prsRaised: prCount,
      },
      'batches': {},
    };
  }, [planningExtractedList, itemsInvolvedRows, procurementRequests]);

  const currentStats = tabStats[activeMainTab];

  // Fallback when API returns no rows (empty state); all list data comes from planning-extracted API
  const initialSalesOrders: SalesOrder[] = [];

  const [salesOrders] = useState<SalesOrder[]>(initialSalesOrders);

  const planningExtractedIdsInDateRange = useMemo(() => {
    const ids = new Set<string>();
    for (const order of pisRows) {
      if (!matchesDateRangeFilter(order.orderDate, dateFilter.from, dateFilter.to)) continue;
      if (order.id) ids.add(String(order.id));
    }
    return ids;
  }, [pisRows, dateFilter]);

  const filteredPisOrders = useMemo(() => {
    const normalizeForSearch = (value: unknown): string =>
      String(value || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

    return pisRows.filter((order) => {
      if (!matchesDateRangeFilter(order.orderDate, dateFilter.from, dateFilter.to)) return false;
      const { remainingUnits } = getCreatedAndRemainingUnits(order);
      const matchesStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Prod Released' && order.bomStatus === 'Production Released') ||
        (statusFilter === 'In Progress' && order.bomStatus === 'In Progress') ||
        (statusFilter === 'Planned' && order.bomStatus === 'Planned') ||
        (statusFilter === 'Not Planned' && remainingUnits > 0 && (Number(order.batchCount) || 0) === 0);

      const q = normalizeForSearch(searchTerm);
      if (!q) return matchesStatus;

      const clientSearchText = [
        order.customerName,
        (order as SalesOrder & { clientName?: string; customer_name?: string; client_name?: string }).clientName,
        (order as SalesOrder & { clientName?: string; customer_name?: string; client_name?: string }).customer_name,
        (order as SalesOrder & { clientName?: string; customer_name?: string; client_name?: string }).client_name,
      ]
        .map((v) => normalizeForSearch(v))
        .join(' ');

      const matchesSearch =
        normalizeForSearch(order.productName).includes(q) ||
        normalizeForSearch(order.productCode).includes(q) ||
        normalizeForSearch(order.soNumber).includes(q) ||
        clientSearchText.includes(q);

      return matchesStatus && matchesSearch;
    });
  }, [pisRows, statusFilter, searchTerm, dateFilter]);

  useEffect(() => {
    setPisPage(1);
  }, [statusFilter, searchTerm, dateFilter.from, dateFilter.to, pisPageSize]);

  const pisTotalPages = Math.max(1, Math.ceil(filteredPisOrders.length / pisPageSize));
  const safePisPage = Math.min(pisPage, pisTotalPages);
  const pagedPisOrders = useMemo(() => {
    const start = (safePisPage - 1) * pisPageSize;
    return filteredPisOrders.slice(start, start + pisPageSize);
  }, [filteredPisOrders, safePisPage, pisPageSize]);

  const handleExportPisCsv = useCallback(() => {
    const header = ['SO Date', 'SO No', 'Client', 'Product', 'Units Ordered', 'Planned', 'Pending', 'Batch Status', 'SLA'];
    const rows = filteredPisOrders.map((order) => {
      const { createdUnits, remainingUnits } = getCreatedAndRemainingUnits(order);
      const sla = getPlanningSlaMeta(order, remainingUnits);
      return [
        order.orderDate || '',
        order.soNumber || '',
        order.customerName || '',
        `${order.productName || ''} (${order.productCode || ''})`,
        String(Number(order.orderQty) || 0),
        String(createdUnits),
        String(remainingUnits),
        order.bomStatus || '',
        `${sla.label} - ${sla.sub}`,
      ];
    });
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planning-pis-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredPisOrders]);

  const visiblePisSoNos = useMemo(
    () => Array.from(new Set(pagedPisOrders.map((o) => String(o.soNumber || '').trim()).filter(Boolean))),
    [pagedPisOrders]
  );

  useEffect(() => {
    let cancelled = false;
    const key = visiblePisSoNos.join('|');
    if (activeMainTab !== 'pis-extracted') return;
    if (!key) return;
    if (planningAvailabilityRequestInFlight.current) return;

    planningAvailabilityRequestInFlight.current = true;
    setPlanningAvailabilityLoading(true);
    Promise.all(
      visiblePisSoNos.map((soNo) =>
        fetchSoPlanningAvailability(soNo)
          .then((res) => ({ soNo, res }))
          .catch((e) => {
            console.error('fetchSoPlanningAvailability error', { soNo, e });
            return { soNo, res: null as any };
          })
      )
    )
      .then((results) => {
        if (cancelled) return;
        setPlanningAvailabilityBySoNo((prev) => {
          const next = { ...prev };
          for (const r of results) {
            if (r.res) {
              next[r.soNo] = r.res;
              next[normalizeSoKey(r.soNo)] = r.res;
            }
          }
          return next;
        });
      })
      .finally(() => {
        planningAvailabilityRequestInFlight.current = false;
        if (!cancelled) setPlanningAvailabilityLoading(false);
      });

    return () => {
      cancelled = true;
      planningAvailabilityRequestInFlight.current = false;
    };
  }, [activeMainTab, visiblePisSoNos.join('|')]);


  const openDetailModal = (order: SalesOrder) => {
    setSelectedRowForDetail(order);
    setDetailModalOpen(true);
  };
  const closeDetailModal = () => {
    setDetailModalOpen(false);
    setSelectedRowForDetail(null);
  };

  const getUsedInBatchesForItem = (item: ItemsInvolvedDisplayRow) => {
    const itemCode = String(item.code ?? '').trim().toLowerCase();
    const itemName = String(item.name ?? '').trim().toLowerCase();
    const itemId = item.itemType === 'RM' ? Number(item.raw_material_id) : Number(item.pack_material_id);
    return (allPlanningBatches as PlanningBatchAllRow[])
      // Only batches sent to production — draft rows (e.g. auto-added next batch) stay out until sent.
      .filter((b) => b.sent === true)
      .filter((b) => {
        const allowedProductNames = (item.usedInProducts ?? [])
          .map((p) => String(p ?? '').trim().toLowerCase())
          .filter(Boolean);
        if (allowedProductNames.length === 0) return true;
        return allowedProductNames.includes(String(b.productName ?? '').trim().toLowerCase());
      })
      .filter((b) => {
        const lines = item.itemType === 'RM' ? (b.rmLines ?? []) : (b.pmLines ?? []);
        return lines.some((line: { raw_material_id?: number; pack_material_id?: number; rm_code?: string; pm_code?: string; code?: string; inci_name?: string; name?: string; description?: string }) => {
          const lineId = item.itemType === 'RM' ? Number(line.raw_material_id) : Number(line.pack_material_id);
          const lineCode = String(line.rm_code ?? line.pm_code ?? line.code ?? '').trim().toLowerCase();
          const lineLabel = String(line.inci_name ?? line.name ?? line.description ?? '')
            .trim()
            .toLowerCase();

          const matchesById = Number.isFinite(itemId) && itemId > 0 && Number.isFinite(lineId) && lineId === itemId;
          const matchesByCode = itemCode.length > 0 && lineCode === itemCode;
          const matchesByName = itemName.length > 0 && lineLabel === itemName;

          return matchesById || matchesByCode || matchesByName;
        });
      });
  };

  const getItemRequiredInBatch = (item: ItemsInvolvedDisplayRow, batch: PlanningBatchAllRow) => {
    const sizeKg = Number(batch.sizeKg) || 0;
    const lines = item.itemType === 'RM' ? (batch.rmLines ?? []) : (batch.pmLines ?? []);
    const itemCode = String(item.code ?? '').trim().toLowerCase();
    const itemId = item.itemType === 'RM' ? Number(item.raw_material_id) : Number(item.pack_material_id);
    if (item.itemType === 'RM') {
      return lines.reduce<number>((sum, line: { raw_material_id?: number; rm_code?: string; code?: string; pct_w_w?: number; pct?: number; quantity?: number }) => {
        const lineId = Number(line.raw_material_id);
        const lineCode = String(line.rm_code ?? line.code ?? '').trim().toLowerCase();
        const matches = (Number.isFinite(itemId) && itemId > 0 && Number.isFinite(lineId) && lineId === itemId) || (itemCode.length > 0 && lineCode === itemCode);
        if (!matches) return sum;
        const pct = Number(line.pct_w_w ?? line.pct ?? 0);
        const qty = Number.isFinite(pct) && pct > 0 ? (sizeKg * pct) / 100 : (Number(line.quantity) || 0);
        return sum + qty;
      }, 0);
    }
    return lines.reduce<number>((sum, line: { pack_material_id?: number; pm_code?: string; code?: string; qty_per_unit?: number; quantity?: number; value?: number }) => {
      const lineId = Number(line.pack_material_id);
      const lineCode = String(line.pm_code ?? line.code ?? '').trim().toLowerCase();
      const matches = (Number.isFinite(itemId) && itemId > 0 && Number.isFinite(lineId) && lineId === itemId) || (itemCode.length > 0 && lineCode === itemCode);
      if (!matches) return sum;
      const qty = Number(line.quantity ?? line.qty_per_unit ?? line.value ?? 0) || 0;
      return sum + qty;
    }, 0);
  };

  const plannedLinesFromBackend: PlannedLine[] = useMemo(() => {
    const parseTs = (dateStr: unknown): number | null => {
      if (dateStr == null) return null;
      const s = String(dateStr).trim();
      if (!s) return null;
      const ts = Date.parse(`${s}T00:00:00Z`);
      return Number.isFinite(ts) ? ts : null;
    };

    const leadTimeDaysFromDates = (orderDate: unknown, expected: unknown): number => {
      const t1 = parseTs(orderDate);
      const t2 = parseTs(expected);
      if (t1 == null || t2 == null) return 0;
      return Math.max(0, Math.round((t2 - t1) / 86400000));
    };

    const out: PlannedLine[] = [];
    for (const po of purchaseOrders as any[]) {
      // Planning-created draft PO reference is like: "Planning PE-<planningExtractedId>"
      const ref = String(po.reference ?? '');
      const m = ref.match(/^Planning\\s+PE-(\\d+)/i);
      if (!m) continue;
      const planningExtractedId = Number(m[1]);
      if (!Number.isFinite(planningExtractedId) || planningExtractedId <= 0) continue;

      const createdAt = String(po.orderDate ?? '');
      const paymentTerms = String(po.paymentTerms ?? '');
      const vendorName = String(po.vendorName ?? '');
      const expectedShipmentDate = po.expectedShipmentDate ?? '';

      const items = Array.isArray(po.items) ? po.items : [];
      for (const itemLine of items as any[]) {
        const rawId = itemLine?.raw_material_id ?? itemLine?.rawMaterialId;
        const packId = itemLine?.pack_material_id ?? itemLine?.packMaterialId;

        const rawIdNum = rawId != null ? Number(rawId) : NaN;
        const packIdNum = packId != null ? Number(packId) : NaN;

        // Only include lines we can match to RM/PM rows from Items Involved.
        if (Number.isFinite(rawIdNum) && rawIdNum > 0) {
          const qtyNum = Number(itemLine?.quantity ?? itemLine?.qty ?? 0) || 0;
          const unitPriceNum = Number(itemLine?.rate ?? itemLine?.price ?? 0) || 0;
          out.push({
            createdAt,
            planningExtractedId,
            itemType: 'RM',
            itemId: rawIdNum,
            itemCode: '',
            itemName: '',
            vendorId: null,
            vendorName,
            moq: 0,
            qty: qtyNum,
            unitPrice: unitPriceNum,
            paymentTerms,
            leadTimeDays: leadTimeDaysFromDates(po.orderDate, expectedShipmentDate),
            unit: String(itemLine?.unit ?? itemLine?.uom ?? 'KG').trim() || 'KG',
          });
        } else if (Number.isFinite(packIdNum) && packIdNum > 0) {
          const qtyNum = Number(itemLine?.quantity ?? itemLine?.qty ?? 0) || 0;
          const unitPriceNum = Number(itemLine?.rate ?? itemLine?.price ?? 0) || 0;
          out.push({
            createdAt,
            planningExtractedId,
            itemType: 'PM',
            itemId: packIdNum,
            itemCode: '',
            itemName: '',
            vendorId: null,
            vendorName,
            moq: 0,
            qty: qtyNum,
            unitPrice: unitPriceNum,
            paymentTerms,
            leadTimeDays: leadTimeDaysFromDates(po.orderDate, expectedShipmentDate),
            unit: 'PCS',
          });
        } else {
          // Fallback for partial payloads / legacy rows:
          // Accept multiple shapes: explicit code fields, or "<name> (<code>)".
          const rawName = String(itemLine?.itemName ?? itemLine?.name ?? '').trim();
          const explicitCode = String(itemLine?.itemCode ?? itemLine?.itemId ?? itemLine?.code ?? '').trim();
          const parsedCodeFromName = rawName.match(/\(([^)]+)\)\s*$/)?.[1]?.trim() ?? '';
          const parsedCode = explicitCode || parsedCodeFromName;
          const parsedName = explicitCode
            ? rawName
            : rawName.replace(/\s*\([^)]*\)\s*$/, '').trim();
          if (!parsedCode && !parsedName) continue;

          const codeLower = parsedCode.toLowerCase();
          const itemTypeGuess: 'RM' | 'PM' =
            codeLower.includes('pm-') || codeLower.includes('ei-pm') || codeLower.includes('-pm-')
              ? 'PM'
              : (String(itemLine?.unit ?? itemLine?.uom ?? '').toUpperCase().includes('PCS') ? 'PM' : 'RM');

          const qtyNum = Number(itemLine?.quantity ?? itemLine?.qty ?? 0) || 0;
          const unitPriceNum = Number(itemLine?.rate ?? itemLine?.price ?? 0) || 0;

          out.push({
            createdAt,
            planningExtractedId,
            itemType: itemTypeGuess,
            itemId: null,
            itemCode: parsedCode,
            itemName: parsedName,
            vendorId: null,
            vendorName,
            moq: 0,
            qty: qtyNum,
            unitPrice: unitPriceNum,
            paymentTerms,
            leadTimeDays: leadTimeDaysFromDates(po.orderDate, expectedShipmentDate),
            unit: itemTypeGuess === 'RM' ? 'KG' : 'PCS',
          });
        }
      }
    }

    // Newest first (matches the old localStorage "preprend" behavior).
    out.sort((a, b) => (parseTs(b.createdAt) ?? 0) - (parseTs(a.createdAt) ?? 0));
    return out;
  }, [purchaseOrders]);

  const itemsInvolved = useMemo(() => itemsInvolvedRows.map((row): ItemsInvolvedDisplayRow => {
    const itemType = row.type;
    const unit = row.unit;
    const fmt = (n: number) => formatItemsInvolvedQty(n, itemType, unit);
    const fmtU = (n: number) => formatItemsInvolvedQtyWithUnit(n, itemType, unit);
    const shortage = row.surplusShortage < 0 ? Math.abs(row.surplusShortage) : 0;
    const surplusShortageStr =
      row.surplusShortage >= 0
        ? `+${fmt(row.surplusShortage)}`
        : `-${fmt(shortage)}`;
    const sihStr = fmtU(row.sih);
    const orderedQtyNum = Number(row.inTransit ?? 0) || 0;
    const plannedQtyNum = Number(row.plannedQty ?? 0) || 0;
    const poQtyStage = Number(row.poQty ?? 0) || 0;
    const inTransitStage = Number(row.inTransitQty ?? 0) || 0;
    /** Cover vs full BOM: all stage columns + free stock (not warehouse in_transit alone — avoids ignoring PO QTY). */
    const supplyTowardGrossNum =
      Number(row.sih ?? 0) + plannedQtyNum + poQtyStage + inTransitStage;
    // Gross BOM demand (confirmed PIs) vs warehouse; unallocated = gross − qty already in planning_batches.
    const grossDemand = Number(row.totalRequired ?? 0) || 0;
    const batchUnallocatedNum =
      row.unallocatedToBatches != null && !Number.isNaN(Number(row.unallocatedToBatches))
        ? Number(row.unallocatedToBatches) || 0
        : Math.max(0, grossDemand - (Number(row.batchAllocatedQty ?? 0) || 0));
    const totalReqStr = fmtU(grossDemand);
    // NET vs full TOTAL REQ (production need): supply − gross. With no stock/pipeline = full shortfall (−TOTAL REQ).
    // Release to Planning increases supply (planned → PO → in-transit) so NET moves toward 0 without double-counting batches.
    const netNum = supplyTowardGrossNum - grossDemand;
    const shortQty = netNum < -1e-9 ? Math.abs(netNum) : 0;
    // Batch-only remainder (for tooltips): supply vs what is still unallocated to planning_batches — not the main NET column.
    const netPipelineNum = supplyTowardGrossNum - batchUnallocatedNum;
    const coveragePct =
      grossDemand > 0
        ? Math.max(0, Math.min(100, Math.round((supplyTowardGrossNum / grossDemand) * 100)))
        : 100;
    const netDisplay =
      netNum >= 0 ? `+${fmtU(netNum)}` : `-${fmtU(Math.abs(netNum))}`;
    return {
      id: `${row.type}-${row.raw_material_id ?? row.pack_material_id}`,
      name: row.name,
      code: row.code,
      category: row.type === 'PM' ? 'PM - Primary' : 'RM',
      usedIn: String(row.batchCount ?? 0),
      usedInProducts: row.usedInProducts ?? [],
      totalReq: totalReqStr,
      totalRequired: grossDemand,
      unallocatedToBatches: batchUnallocatedNum,
      batchCount: row.batchCount ?? 0,
      sih: sihStr,
      sihNum: row.sih,
      surplusShortage: surplusShortageStr,
      surplusShortageNum: row.surplusShortage,
      coverage: `${coveragePct}%`,
      whBatches: row.batchNumber ?? '—',
      warehouseInventoryId: row.warehouseInventoryId ?? null,
      expiry: row.expiryDate ?? '—',
      bomFlag: 'Original',
      itemType: row.type,
      planningExtractedIds: row.planningExtractedIds ?? [],
      planningExtractedId: row.planningExtractedIds?.[0] ?? null,
      raw_material_id: row.raw_material_id ?? undefined,
      pack_material_id: row.pack_material_id ?? undefined,
      unit: row.unit,
      reserved: fmtU(Number(row.reserved ?? 0) || 0),
      reservedNum: Number(row.reserved ?? 0) || 0,
      plannedQty: fmtU(plannedQtyNum),
      plannedQtyNum,
      orderedQty: fmtU(orderedQtyNum),
      orderedQtyNum,
      supplyTowardGrossNum,
      net: netDisplay,
      netNum,
      netPipelineNum,
      netPipeline: netDisplay,
      inTransit: fmtU(Number(row.inTransit ?? 0) || 0),
      poQtyStr: fmtU(poQtyStage),
      poQtyNum: poQtyStage,
      inTransitQtyStr: fmtU(inTransitStage),
      inTransitQtyNum: inTransitStage,
      whQtyStr: fmtU(Number(row.whQty ?? 0) || 0),
      whQtyNum: Number(row.whQty ?? 0) || 0,
      shortStr: fmtU(shortQty),
      reorderPt: fmtU(Number(row.reorderPt ?? 0) || 0),
      avgMo: fmtU(Number(row.avgMo ?? 0) || 0),
      status: row.status ?? 'In Stock',
      totalReleasedNum: Number(row.totalReleased ?? 0) || 0,
      totalOnPONum: Number(row.totalOnPO ?? 0) || 0,
      totalReceivedNum: Number(row.totalReceived ?? 0) || 0,
      batchAllocatedQtyNum: Number(row.batchAllocatedQty ?? 0) || 0,
    };
  }), [itemsInvolvedRows]);

  const itemsInvolvedProductOptions = useMemo(() => {
    const set = new Set<string>();
    itemsInvolved.forEach((row) => (row.usedInProducts ?? []).forEach((p) => set.add(p)));
    return ['all', ...Array.from(set).sort()];
  }, [itemsInvolved]);

  const filteredItemsInvolved = useMemo(() => {
    return itemsInvolved.filter((row) => {
      if (dateFilter.from || dateFilter.to) {
        const peIds = row.planningExtractedIds ?? (row.planningExtractedId ? [row.planningExtractedId] : []);
        const linked = peIds.some((id) => planningExtractedIdsInDateRange.has(String(id)));
        if (!linked) return false;
      }
      if (itemsInvolvedCategoryFilter === 'RM' && row.itemType !== 'RM') return false;
      if (itemsInvolvedCategoryFilter === 'PM' && row.itemType !== 'PM') return false;
      if (itemsInvolvedCategoryFilter === 'shortage' && row.netNum >= 0) return false;
      if (itemsInvolvedCategoryFilter === 'available' && row.netNum < 0) return false;
      if (itemsInvolvedProductFilter !== 'all') {
        const usedIn = row.usedInProducts ?? [];
        if (!usedIn.includes(itemsInvolvedProductFilter)) return false;
      }
      const search = itemsInvolvedSearchTerm.trim().toLowerCase();
      if (search) {
        const matchName = row.name?.toLowerCase().includes(search);
        const matchCode = row.code?.toLowerCase().includes(search);
        const matchUsedIn = (row.usedInProducts ?? []).some((p) => p.toLowerCase().includes(search));
        if (!matchName && !matchCode && !matchUsedIn) return false;
      }
      return true;
    });
  }, [
    itemsInvolved,
    itemsInvolvedCategoryFilter,
    itemsInvolvedProductFilter,
    itemsInvolvedSearchTerm,
    dateFilter,
    planningExtractedIdsInDateRange,
  ]);

  const hasPlannedLineForItem = (item: ItemsInvolvedDisplayRow) =>
    plannedLinesFromBackend.some((line) => plannedLineCountsTowardItemRelease(line, item));

  const getQuotationSlabsForItem = (item: ItemsInvolvedDisplayRow) => {
    const rid = Number(item.raw_material_id);
    const pid = Number(item.pack_material_id);
    const page: PriceListItemPage[] = item.itemType === 'PM' ? (itemsListPmPage as PriceListItemPage[]) : (itemsListRmPage as PriceListItemPage[]);
    const codeNorm = normalizeMaterialCode(String(item.code ?? '').trim().toLowerCase());

    const row =
      (item.itemType === 'RM' && Number.isFinite(rid) && rid > 0 ? page.find((p) => Number(p.raw_material_id) === rid) : null) ??
      (item.itemType === 'PM' && Number.isFinite(pid) && pid > 0 ? page.find((p) => Number(p.pack_material_id) === pid) : null) ??
      page.find((p) => normalizeMaterialCode(String(p.code ?? '').trim().toLowerCase()) === codeNorm) ??
      null;

    const vendorRates = row?.vendorRates ?? [];
    const slabs = vendorRates.flatMap((vr) => {
      const vendorName = String(vr.vendor_name ?? vr.vendor_code ?? `Vendor ${vr.vendor_id}`);
      const paymentTerms = String((vr as any).payment_terms ?? 'As per contract');
      return (vr.tiers ?? []).map((t) => ({
        vendorId: Number(vr.vendor_id) || null,
        vendorName,
        moq: Number(t.moq_min ?? 0) || 0,
        unitPrice: Number((t as any).price_per_unit ?? 0) || 0,
        leadTimeDays: Number((vr as any).lead_time_days ?? 0) || 0,
        paymentTerms,
        __source: 'items_list',
      }));
    });

    return slabs.sort((a, b) => a.vendorName.localeCompare(b.vendorName) || a.moq - b.moq || a.unitPrice - b.unitPrice);
  };

  const openReleaseToPlanningModal = (
    item: ItemsInvolvedDisplayRow,
    opts?: { preferSurplusQty?: number; intent?: 'release' | 'quotation' },
  ) => {
    setReleaseModalIntent(opts?.intent ?? 'release');
    const slabs = getQuotationSlabsForItem(item);
    const first = slabs[0];
    const debugRelease =
      (typeof window !== 'undefined' && window.localStorage.getItem('eiadmin.debug.releaseToPlanning') === '1') || import.meta.env.DEV;
    if (debugRelease) {
      // eslint-disable-next-line no-console
      console.groupCollapsed('[ReleaseToPlanning] matched quote lines for item');
      // eslint-disable-next-line no-console
      console.log('item', {
        itemType: item.itemType,
        code: item.code,
        name: item.name,
        raw_material_id: item.raw_material_id ?? null,
        pack_material_id: item.pack_material_id ?? null,
      });
      // eslint-disable-next-line no-console
      const debugSlabs = slabs.map((s: any) => ({
        vendorName: s.vendorName,
        moq: s.moq,
        unitPrice: s.unitPrice,
        matchReason: s.__debugMatchReason,
        matchedQuoteLine: {
          item: s.__debugLine?.item,
          itemId: s.__debugLine?.itemId,
          raw_material_id: s.__debugLine?.raw_material_id,
          pack_material_id: s.__debugLine?.pack_material_id,
          orderQty: s.__debugLine?.orderQty,
        },
        debugQuoteSource: s.__debugQuoteSource,
      }));
      // eslint-disable-next-line no-console
      console.log('slabs-json', JSON.stringify(debugSlabs, null, 2));
      // eslint-disable-next-line no-console
      console.groupEnd();
    }
    const availForGap = Number(item.supplyTowardGrossNum ?? 0);
    const gapNeed = Math.max(0, Number(item.totalRequired || 0) - availForGap);
    const remainingGap = gapNeed;
    const surplus = opts?.preferSurplusQty != null && opts.preferSurplusQty > 0 ? opts.preferSurplusQty : 0;
    const kgGap = surplus > 0 ? surplus : remainingGap;
    let qtyStr = '';
    if (kgGap > 0) {
      if (item.itemType === 'RM') {
        const master = findRmMasterRecord(item.raw_material_id, item.code, rawMaterialsList);
        const proc = rmProcurementFieldsFromKg(kgGap, master);
        qtyStr = formatItemsInvolvedQty(proc.quantity_requested, 'RM', proc.unit);
      } else {
        qtyStr = formatItemsInvolvedQty(kgGap, item.itemType, item.unit);
      }
    }
    const parsedTerms = parsePaymentTermsString(first?.paymentTerms ?? 'As per contract');
    const isQuotationOpen = opts?.intent === 'quotation';
    setReleaseToPlanningItem(item);
    setReleaseToPlanningForm({
      vendorId: isQuotationOpen ? null : (first?.vendorId ?? null),
      vendorName: isQuotationOpen ? '' : (first?.vendorName ?? ''),
      moq: isQuotationOpen ? 0 : (first?.moq ?? 0),
      qty: qtyStr,
      unitPrice: isQuotationOpen ? '' : first ? String(first.unitPrice) : '',
      paymentTermsType: parsedTerms.type,
      advancePercent: String(
        parsedTerms.advancePercent ||
        (paymentTermsTypeRequiresAdvancePercent(parsedTerms.type) ? 50 : 0)
      ),
      leadTimeDays: first?.leadTimeDays ?? 0,
      paymentTermsRaw: first ? String(first.paymentTerms ?? '').trim() || null : null,
    });
  };

  const openRequestQuotationModalForItem = (item: ItemsInvolvedDisplayRow): void => {
    setSeenPlanningQuotationAskIds((prev) =>
      markMatchingFulfilledAsksSeen(planningQuotationAsks, item, prev)
    );
    openReleaseToPlanningModal(item, { intent: 'quotation' });
  };

  const addPlannedLine = async (): Promise<boolean> => {
    if (!releaseToPlanningItem) return false;
    const planningRow = releaseToPlanningItem;
    const qty = Number(releaseToPlanningForm.qty || 0);
    const unitPrice = Number(releaseToPlanningForm.unitPrice || 0);
    if (!releaseToPlanningForm.vendorName || qty <= 0 || unitPrice <= 0) {
      addToast('warning', 'Pick vendor and enter valid qty and unit price.');
      return false;
    }

    const availForGap = Number(planningRow.supplyTowardGrossNum ?? 0);
    const gapNeed = Math.max(0, Number(planningRow.totalRequired || 0) - availForGap);
    if (gapNeed <= 1e-6) {
      addToast(
        'warning',
        'No open shortage vs TOTAL REQ — supply (SIH + planned + PO + in-transit) already covers demand.'
      );
      return false;
    }

    const advErr = validateAdvancePercentForType(
      releaseToPlanningForm.paymentTermsType,
      Number(releaseToPlanningForm.advancePercent)
    );
    if (advErr) {
      addToast('warning', advErr);
      return false;
    }

    const slabMoq = Number(releaseToPlanningForm.moq) || 0;
    if (slabMoq > 0 && qty + 1e-4 < slabMoq) {
      const masterRm =
        planningRow.itemType === 'RM'
          ? findRmMasterRecord(planningRow.raw_material_id, planningRow.code, rawMaterialsList)
          : undefined;
      const u =
        planningRow.itemType === 'RM'
          ? procurementUnitSuffix(masterRm?.uom).trim() || 'kg'
          : 'pcs';
      addToast(
        'error',
        `Order quantity must be at least the selected vendor MOQ (${slabMoq} ${u}). Increase qty or pick another vendor tier.`
      );
      return false;
    }

    const vendorName = releaseToPlanningForm.vendorName.trim();
    const paymentTerms = formatPaymentTermsString(
      releaseToPlanningForm.paymentTermsType,
      Number(releaseToPlanningForm.advancePercent)
    ).trim();
    const leadTimeDays = Number(releaseToPlanningForm.leadTimeDays || 0) || 0;
    const groupKey = buildPlannedGroupKey(vendorName, paymentTerms, leadTimeDays);

    const rmId =
      planningRow.itemType === 'RM' && Number.isFinite(Number(planningRow.raw_material_id)) && Number(planningRow.raw_material_id) > 0
        ? Number(planningRow.raw_material_id)
        : undefined;
    const pmId =
      planningRow.itemType === 'PM' && Number.isFinite(Number(planningRow.pack_material_id)) && Number(planningRow.pack_material_id) > 0
        ? Number(planningRow.pack_material_id)
        : undefined;

    const masterRm =
      planningRow.itemType === 'RM'
        ? findRmMasterRecord(planningRow.raw_material_id, planningRow.code, rawMaterialsList)
        : undefined;
    const procUnit =
      planningRow.itemType === 'RM'
        ? normRmPrimaryUom(masterRm?.uom)
        : planningRow.unit || 'PCS';

    const newRequestItem: ProcurementRequestItem = {
      type: planningRow.itemType,
      code: planningRow.code || planningRow.name,
      name: planningRow.name,
      required: qty,
      sih: Number(planningRow.sihNum ?? 0) || 0,
      shortage: qty,
      quantity_requested: qty,
      unit: procUnit,
      line_notes: `Planned rate ₹${unitPrice.toFixed(2)} | Terms: ${paymentTerms} | Lead: ${leadTimeDays}d`,
      planned_unit_price: unitPrice,
      ...(leadTimeDays > 0 ? { lead_time_days: leadTimeDays } : {}),
      ...(rmId != null ? { raw_material_id: rmId } : {}),
      ...(pmId != null ? { pack_material_id: pmId } : {}),
      ...(slabMoq > 0 ? { moq_min: slabMoq } : {}),
    };

    const peId = Number(planningRow.planningExtractedId);
    if (!Number.isFinite(peId) || peId <= 0) {
      addToast('error', 'Missing planning line context; cannot create procurement request.');
      return false;
    }

    const leadDaysForDue = Math.max(Number(releaseToPlanningForm.leadTimeDays || 0) || 0, 14);
    const requiredByDate = new Date(Date.now() + leadDaysForDue * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const reqRes = await fetchProcurementRequests(peId);
    if (!reqRes.success || !reqRes.data) {
      addToast('error', typeof reqRes.error === 'string' ? reqRes.error : 'Failed to load procurement requests');
      return false;
    }

    const existing = reqRes.data.find((r) => {
      const sameVendor = String(r.preferredVendor ?? '').trim().toLowerCase() === vendorName.toLowerCase();
      // Consolidate vendor lines until PO is actually issued/released.
      // PO Draft is still a pre-issue planning stage and should stay mergeable.
      const openStatus = !['PO Released', 'Delivery Pending', 'Under GRN'].includes(String(r.status || ''));
      return sameVendor && openStatus;
    });

    if (existing) {
      const existingItems = Array.isArray(existing.items) ? [...existing.items] : [];
      const mergeKey = procurementItemMergeKey(newRequestItem);
      const idx = existingItems.findIndex((i) => procurementItemMergeKey(i) === mergeKey);
      let merged: ProcurementRequestItem[];
      if (idx >= 0) {
        const old = existingItems[idx];
        const qOld = Number(old.quantity_requested ?? 0) || 0;
        const qNew = qOld + qty;
        merged = [...existingItems];
        merged[idx] = {
          ...old,
          required: (Number(old.required ?? 0) || 0) + qty,
          shortage: (Number(old.shortage ?? 0) || 0) + qty,
          quantity_requested: qNew,
          line_notes: `Planned rate ₹${unitPrice.toFixed(2)} | Terms: ${paymentTerms} | Lead: ${leadTimeDays}d`,
          planned_unit_price: unitPrice,
          lead_time_days: leadTimeDays > 0 ? leadTimeDays : old.lead_time_days,
          moq_min: slabMoq > 0 ? slabMoq : old.moq_min,
        };
      } else {
        merged = [...existingItems, newRequestItem];
      }

      const upd = await updateProcurementRequest(existing.id, {
        items: merged,
        preferredVendor: vendorName,
        ...(!existing.requiredByDate ? { requiredByDate } : {}),
      });
      if (!upd.success) {
        addToast('error', typeof upd.error === 'string' ? upd.error : 'Failed to update procurement request');
        return false;
      }
    } else {
      const createRes = await createProcurementRequest({
        planningExtractedId: peId,
        planningBatchId: null,
        priority: 'High',
        requiredByDate,
        notes: `Planned group: ${groupKey}`,
        items: [newRequestItem],
      });
      if (!createRes.success || !createRes.data) {
        addToast('error', typeof createRes.error === 'string' ? createRes.error : 'Failed to create procurement request');
        return false;
      }
      await updateProcurementRequest(createRes.data.id, { preferredVendor: vendorName });
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['procurement-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }),
      // Items involved NET / PLANNED QTY / stages come from this API — must refetch after release.
      queryClient.invalidateQueries({ queryKey: ['planning', 'items-involved'] }),
      queryClient.invalidateQueries({ queryKey: ['planning', 'batches', 'all', 'items-involved'] }),
    ]);

    setReleaseToPlanningItem(null);
    setReleaseModalIntent('release');
    addToast('success', 'Added to Procurement → Requests (vendor consolidated).');
    return true;
  };

  const requestQuotationForPlanningItem = async (): Promise<boolean> => {
    if (!releaseToPlanningItem) return false;
    const planningRow = releaseToPlanningItem;
    const qty = Number(releaseToPlanningForm.qty || 0);
    if (!(qty > 0)) {
      addToast('warning', 'Enter quantity to request a quotation.');
      return false;
    }

    const rmId =
      planningRow.itemType === 'RM' && Number.isFinite(Number(planningRow.raw_material_id)) && Number(planningRow.raw_material_id) > 0
        ? Number(planningRow.raw_material_id)
        : undefined;
    const pmId =
      planningRow.itemType === 'PM' && Number.isFinite(Number(planningRow.pack_material_id)) && Number(planningRow.pack_material_id) > 0
        ? Number(planningRow.pack_material_id)
        : undefined;

    const masterRmQ =
      planningRow.itemType === 'RM'
        ? findRmMasterRecord(planningRow.raw_material_id, planningRow.code, rawMaterialsList)
        : undefined;
    const procUnitQ =
      planningRow.itemType === 'RM'
        ? normRmPrimaryUom(masterRmQ?.uom)
        : planningRow.unit || 'PCS';

    const vendorHint = String(releaseToPlanningForm.vendorName ?? '').trim();
    const moqHint = Number(releaseToPlanningForm.moq) || 0;
    const slabsForItem = getQuotationSlabsForItem(planningRow);
    const notes = buildPlanningQuotationLineNotes({
      vendorName: vendorHint,
      moq: moqHint,
      hasExistingRates: slabsForItem.length > 0,
    });

    const peId = Number(planningRow.planningExtractedId);
    if (!Number.isFinite(peId) || peId <= 0) {
      addToast('error', 'Missing planning line context; cannot request quotation.');
      return false;
    }

    const createRes = await createPlanningQuotationAsk({
      planningExtractedId: peId,
      itemType: planningRow.itemType,
      itemCode: planningRow.code || planningRow.name,
      itemName: planningRow.name,
      quantityRequested: qty,
      unit: procUnitQ,
      vendorHint: vendorHint || null,
      moqHint: moqHint > 0 ? moqHint : null,
      notes,
      ...(rmId != null ? { rawMaterialId: rmId } : {}),
      ...(pmId != null ? { packMaterialId: pmId } : {}),
    });

    if (!createRes.success || !createRes.data) {
      addToast('error', typeof createRes.error === 'string' ? createRes.error : 'Failed to send quotation ask');
      return false;
    }

    await queryClient.invalidateQueries({ queryKey: ['planning-quotation-asks'] });

    setReleaseToPlanningItem(null);
    setReleaseModalIntent('release');
    addToast(
      'success',
      'Quotation ask sent to Procurement → Quotations (no procurement request). After rates are on Items List, use Release to Planning → Add Planned Line to create a PR manually.'
    );
    return true;
  };

  // Warehouse inventory → Items Involved: open Release to Planning with optional surplus qty prefilled.
  useEffect(() => {
    if (activeMainTab !== 'items-involved') return;
    const st = (location.state ?? null) as {
      openReleasePlanning?: { itemType: 'RM' | 'PM'; sourceId: number; nonce: number; surplusQty?: number };
    } | null;
    const payload = st?.openReleasePlanning;
    if (!payload?.nonce) return;
    if (warehouseReleaseHandledNonceRef.current === payload.nonce) return;
    if (itemsInvolvedLoading) return;

    warehouseReleaseHandledNonceRef.current = payload.nonce;

    const { itemType, sourceId, surplusQty } = payload;
    const match = itemsInvolved.find(
      (r) =>
        r.itemType === itemType &&
        (itemType === 'RM' ? Number(r.raw_material_id) === Number(sourceId) : Number(r.pack_material_id) === Number(sourceId))
    );
    navigate(location.pathname, { replace: true, state: {} });
    if (match) {
      openReleaseToPlanningModal(match, surplusQty != null && surplusQty > 0 ? { preferSurplusQty: surplusQty } : undefined);
    } else {
      addToast('warning', 'This item is not in Items Involved yet. Confirm BOM in Plan Batches first.');
    }
    // openReleaseToPlanningModal is stable enough for this one-shot navigation; omit from deps to avoid extra runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run when items-involved data or nav state changes
  }, [activeMainTab, itemsInvolvedLoading, itemsInvolved, location.pathname, location.state, navigate]);

  const handlePlanBatches = (order: SalesOrder) => {
    setSelectedSOForBatch(order);
    lastSyncedBomIdRef.current = null;
    syncedFallbackOrderIdRef.current = null;
    const prBom =
      activeBom &&
      activeBom.productId === order.productId &&
      ((activeBom.rmLines?.length ?? 0) > 0 || (activeBom.pmLines?.length ?? 0) > 0)
        ? activeBom
        : null;
    if (prBom?.rmLines?.length) {
      setBomFormula(
        prBom.rmLines.map((line: BOMRmLine, i: number) => ({
          id: String(line.raw_material_id ?? line.rm_code ?? i),
          name: line.inci_name ?? '',
          quantity: 0,
          unit: line.uom ?? 'KG',
          percentage: line.pct_w_w ?? line.pct ?? 0,
          code: line.rm_code,
          phase: line.phase ?? 'Phase A',
          specificGravity: lineSgFromPrBom(
            line,
            effectivePrSpecBulk(prBom, prProductDetailForBom ?? null)
          ),
        }))
      );
      setBomPackaging(
        (prBom.pmLines ?? []).map((line: BOMPmLine, i: number) => ({
          id: String(line.pm_code ?? i),
          name: line.description ?? '',
          quantity: 0,
          unit: 'PCS',
          value: line.qty_per_unit ?? 1,
          percentage: 0,
          code: line.pm_code,
        }))
      );
      setBomLevelSG(
        resolveBomLevelSgFromPr(
          effectivePrSpecBulk(prBom, prProductDetailForBom ?? null),
          prBom.rmLines ?? [],
          order.bomSpecificGravity ?? null,
          Boolean(order.bomConfirmedAt)
        )
      );
    } else {
      setBomFormula([]);
      setBomPackaging(order.packagingMaterials ?? []);
      setBomLevelSG(
        resolveBomLevelSgFromPr(
          prSpecBulkForBom,
          null,
          order.bomSpecificGravity ?? null,
          Boolean(order.bomConfirmedAt)
        )
      );
    }
    const alreadyConfirmed = Boolean(order.bomConfirmedAt);
    setIsReadyForProduction(alreadyConfirmed);
    setActiveBatchTab(alreadyConfirmed ? 'batch-plan' : 'bom-editor');
    setSwapSourceIndex(null);
    setSwapRmSearch('');
    setSwapRmResults([]);
    setSwapRmSuggestionsOpen(false);
    setSwapAddToGroup(false);
    setSwapGroupName('');
    setSwapPendingGroupRm(null);
    setNumBatches(String(order.batchesRequired || 1));
    setBatchSizeKg(order.batchSize?.replace(/\D/g, '') || '500');
    setPlannedStartDate(new Date().toISOString().split('T')[0]);
    setProductionLine('Line 1 — Primary Mixer');
    setCustomBatches([]);
    setExpandedBatchIndex(null);
    setPlanBatchesModalOpen(true);
  };

  const handleRaisePR = (order: SalesOrder, pmOnly: boolean = false) => {
    prForBatchIndexRef.current = null;
    setSelectedSO(order);
    setPrModalOpen(true);
    setPrShowPMOnly(pmOnly);
    setPrPriority('High');
    setPrRequiredByDate(order.dueDate || '');
    setPrNotes('');
  };

  /** Build PR items for a single batch and open PR modal (PR is per batch, not bulk). */
  const handleRaisePRForBatch = (order: SalesOrder, batchIndex: number) => {
    const batchSizeKg = parseFloat(order.batchSize?.replace(/\D/g, '') || '') || 500;
    const batchLen =
      order.customBatches?.length
        ? order.customBatches.length
        : order.batchCount != null && order.batchCount > 0
          ? order.batchCount
          : order.batchesRequired || 1;
    const batches = order.customBatches?.length
      ? order.customBatches
      : Array.from({ length: batchLen }, () => ({ sizeKg: batchSizeKg }));
    const sizeKgForBatch = batches[batchIndex]?.sizeKg ?? batchSizeKg;
    const scale = sizeKgForBatch / batchSizeKg;

    const rmByCode = new Map(rawMaterialsList.map((r) => [r.code?.toLowerCase() ?? '', r]));
    const pmByCode = new Map(packMaterialsList.map((p) => [p.code?.toLowerCase() ?? '', p]));
    const items: ProcurementRequestItem[] = [];
    let omitted = 0;

    for (const item of order.rawMaterials ?? []) {
      const qty = (typeof item.quantity === 'number' ? item.quantity : 0) * scale;
      const idStr = String((item as RawMaterial).code ?? item.id ?? '');
      const master = rawMaterialsList.find((r) => String(r.id) === idStr) ?? rmByCode.get(idStr.toLowerCase()) ?? rawMaterialsList.find((r) => r.code === idStr || r.name === item.name);
      if (!master) { omitted += 1; continue; }
      const raw_material_id = master.id != null ? parseInt(String(master.id), 10) : undefined;
      if (raw_material_id == null || Number.isNaN(raw_material_id)) { omitted += 1; continue; }
      const wh = warehouseRows.find((r) => r.type === 'RM' && (Number(r.sourceId) === Number(raw_material_id) || r.code === master.code || r.name === master.name));
      const lineSg = parseSpecificGravity(
        (item as { specific_gravity?: number }).specific_gravity ?? (item as { specificGravity?: number }).specificGravity
      );
      const sih = warehouseQtyToKg(wh?.stockInHand ?? 0, wh, master, lineSg);
      const shortageKg = Math.max(0, qty - sih);
      if (shortageKg <= 0) continue;
      const proc = rmProcurementFieldsFromKg(shortageKg, master);
      items.push({
        type: 'RM',
        code: master.code ?? idStr,
        name: master.name ?? item.name,
        required: qty,
        sih,
        shortage: proc.quantity_requested,
        quantity_requested: proc.quantity_requested,
        unit: proc.unit,
        line_notes: '',
        raw_material_id,
      });
    }

    for (const item of order.packagingMaterials ?? []) {
      const qty = Math.ceil((typeof item.quantity === 'number' ? item.quantity : 0) * scale);
      const idStr = String((item as PackagingMaterial).code ?? item.id ?? '');
      const master = packMaterialsList.find((p) => String(p.id) === idStr) ?? pmByCode.get(idStr.toLowerCase()) ?? packMaterialsList.find((p) => p.code === idStr || p.description === item.name);
      if (!master) { omitted += 1; continue; }
      const pack_material_id = master.id != null ? parseInt(String(master.id), 10) : undefined;
      if (pack_material_id == null || Number.isNaN(pack_material_id)) { omitted += 1; continue; }
      const wh = warehouseRows.find((r) => r.type === 'PM' && (Number(r.sourceId) === Number(pack_material_id) || r.code === master.code || r.name === master.description));
      const sih = wh?.stockInHand ?? 0;
      const shortage = Math.max(0, qty - sih);
      if (shortage <= 0) continue;
      items.push({
        type: 'PM',
        code: master.code ?? idStr,
        name: master.description ?? item.name,
        required: qty,
        sih,
        shortage,
        quantity_requested: shortage,
        unit: (item as PackagingMaterial).unit || 'PCS',
        line_notes: '',
        pack_material_id,
      });
    }

    const orderTotalKg = parseFloat(order.totalKg?.replace(/[^\d.]/g, '') || '0') || 0;
    const orderQtyNum = parseInt(order.orderQty?.replace(/\D/g, '') || '0', 10) || 0;
    const kgPerUnit = orderQtyNum > 0 ? orderTotalKg / orderQtyNum : 0;
    const unitsForBatch = kgPerUnit > 0 ? Math.round(sizeKgForBatch / kgPerUnit) : sizeKgForBatch;

    setPrItems(items);
    setPrOmittedCount(omitted);
    prFromDetailShortagesRef.current = true;
    setSelectedSO(order);
    setPrPriority('High');
    setPrRequiredByDate(order.dueDate || '');
    setPrNotes(`Batch B-${String(batchIndex + 1).padStart(2, '0')} — ${unitsForBatch} units`);
    prForBatchIndexRef.current = batchIndex;
    setDetailModalOpen(false);
    setSelectedRowForDetail(null);
    setPrModalOpen(true);
  };

  /** Build PR items from PIS detail popup: only items that are short (BOM×orderQty - SIH > 0), pre-fill quantities. */
  const handleRaisePRFromDetailPopup = () => {
    if (!selectedRowForDetail) return;
    prForBatchIndexRef.current = null;
    if (detailRmItems.length === 0 && detailPmItems.length === 0) {
      setDetailModalOpen(false);
      setSelectedRowForDetail(null);
      handleRaisePR(selectedRowForDetail);
      return;
    }
    const rmByCode = new Map(rawMaterialsList.map((r) => [r.code?.toLowerCase() ?? '', r]));
    const pmByCode = new Map(packMaterialsList.map((p) => [p.code?.toLowerCase() ?? '', p]));
    const items: ProcurementRequestItem[] = [];
    let omitted = 0;

    for (const item of detailRmItems) {
      const idStr = String(item.id ?? '');
      const master =
        rawMaterialsList.find((r) => String(r.id) === idStr) ??
        rmByCode.get(idStr.toLowerCase()) ??
        rawMaterialsList.find((r) => r.code === idStr || r.name === item.name);
      if (!master) {
        omitted += 1;
        continue;
      }
      const raw_material_id = master.id != null ? parseInt(String(master.id), 10) : undefined;
      if (raw_material_id == null || Number.isNaN(raw_material_id)) {
        omitted += 1;
        continue;
      }
      const wh = warehouseRows.find(
        (r) =>
          r.type === 'RM' &&
          (Number(r.sourceId) === Number(raw_material_id) || r.code === master.code || r.name === master.name)
      );
      const sih = wh?.stockInHand ?? item.sih;
      const required = item.required;
      const shortageKg = item.shortfall;
      if (shortageKg <= 0) continue;
      const proc = rmProcurementFieldsFromKg(shortageKg, master);
      items.push({
        type: 'RM',
        code: master.code ?? idStr,
        name: master.name ?? item.name,
        required,
        sih,
        shortage: proc.quantity_requested,
        quantity_requested: proc.quantity_requested,
        unit: proc.unit,
        line_notes: '',
        raw_material_id,
      });
    }

    for (const item of detailPmItems) {
      const idStr = String(item.id ?? '');
      const master =
        packMaterialsList.find((p) => String(p.id) === idStr) ??
        pmByCode.get(idStr.toLowerCase()) ??
        packMaterialsList.find((p) => p.code === idStr || p.description === item.name);
      if (!master) {
        omitted += 1;
        continue;
      }
      const pack_material_id = master.id != null ? parseInt(String(master.id), 10) : undefined;
      if (pack_material_id == null || Number.isNaN(pack_material_id)) {
        omitted += 1;
        continue;
      }
      const wh = warehouseRows.find(
        (r) =>
          r.type === 'PM' &&
          (Number(r.sourceId) === Number(pack_material_id) ||
            r.code === master.code ||
            r.name === master.description)
      );
      const sih = wh?.stockInHand ?? item.sih;
      const required = item.required;
      const shortage = item.shortfall;
      if (shortage <= 0) continue;
      items.push({
        type: 'PM',
        code: master.code ?? idStr,
        name: master.description ?? item.name,
        required,
        sih,
        shortage,
        quantity_requested: shortage,
        unit: item.unit || 'PCS',
        line_notes: '',
        pack_material_id,
      });
    }

    setPrItems(items);
    setPrOmittedCount(omitted);
    prFromDetailShortagesRef.current = true;
    setSelectedSO(selectedRowForDetail);
    setPrModalOpen(true);
    setPrShowPMOnly(false);
    setPrPriority('High');
    setPrRequiredByDate(selectedRowForDetail.dueDate || '');
    setPrNotes('');
    setDetailModalOpen(false);
    setSelectedRowForDetail(null);
  };

  const handleSendToProcurement = async () => {
    if (!selectedSO) return;
    const validItems = prItems.filter((i) => i.raw_material_id != null || i.pack_material_id != null || i.product_id != null);
    if (validItems.length === 0) {
      addToast('error', 'Select at least one item (RM/PM/FG) per line. Use the item dropdown to link to master data.');
      return;
    }
    const batchIndex = prForBatchIndexRef.current;
    prForBatchIndexRef.current = null;
    let planningBatchId: number | undefined;
    if (batchIndex !== null) {
      const batches = await fetchPlanningBatches(selectedSO.id);
      const batch = batches[batchIndex];
      planningBatchId = batch?.id;
    }
    setPrSending(true);
    try {
      const res = await createProcurementRequest({
        planningExtractedId: parseInt(selectedSO.id, 10),
        planningBatchId: planningBatchId ?? null,
        priority: prPriority,
        requiredByDate: prRequiredByDate || selectedSO.dueDate || new Date().toISOString().slice(0, 10),
        notes: prNotes,
        items: validItems,
      });
      if (res.success && res.data) {
        addToast('success', `PR for SO #${selectedSO.soNumber} saved. Reflected in Planning tab stats and in Procurement - Requests.`);
        queryClient.invalidateQueries({ queryKey: ['planning-extracted'] });
        queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
        setPrModalOpen(false);
        setSelectedSO(null);
        setPrItems([]);
        setPrPriority('High');
        setPrRequiredByDate('');
        setPrNotes('');
        setPrShowPMOnly(false);
      } else {
        addToast('error', typeof res.error === 'string' ? res.error : 'Failed to create procurement request');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send PR to Procurement';
      addToast('error', errorMessage);
      console.error('Error sending to procurement:', error);
    } finally {
      setPrSending(false);
    }
  };

  const updatePrItem = (index: number, updates: Partial<ProcurementRequestItem>) => {
    setPrItems((prev) => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const addPrLine = () => {
    setPrItems((prev) => [
      ...prev,
      {
        type: 'RM',
        code: '',
        name: '',
        required: 0,
        sih: 0,
        shortage: 0,
        quantity_requested: 0,
        unit: 'KG',
        raw_material_id: undefined,
        pack_material_id: undefined,
        product_id: undefined,
      },
    ]);
  };

  const removePrLine = (index: number) => {
    setPrItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveBatchPlan = async () => {
    if (!selectedSOForBatch) return;
    try {
      await updatePlanningExtracted(selectedSOForBatch.id, {
        batchCount: customBatches.length || parseInt(numBatches, 10) || 0,
        batchSizeKg: customBatches.length > 0 ? customBatches[0].sizeKg : (parseFloat(batchSizeKg) || 500),
        plannedStartDate: plannedStartDate || undefined,
        productionLine: productionLine || undefined,
        customBatches: customBatches.length > 0 ? customBatches : undefined,
      });
      if (customBatches.length > 0) {
        await createOrUpdatePlanningBatches(selectedSOForBatch.id, customBatches);
      }
      queryClient.invalidateQueries({ queryKey: ['planning-extracted'] });
      queryClient.invalidateQueries({ queryKey: ['planning-batches', selectedSOForBatch.id] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'items-involved'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-inventory'] });
      addToast('success', 'Batch plan saved. Each batch has its own BOM copy for reuse.');
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Failed to save batch plan');
    }
  };

  const handleConfirmBOM = async () => {
    if (!selectedSOForBatch) return;
    if (!canConfirmBomPerBatch) {
      addToast('error', 'Add at least one raw material or packaging line to the BOM before confirming.');
      return;
    }
    const bomSgValue = Number(bomLevelSG);
    const alreadyConfirmed = Boolean(selectedSOForBatch.bomConfirmedAt);
    const allLinesHaveSg = bomFormula.every((item) => {
      const sg = Number(item.specificGravity);
      return Number.isFinite(sg) && sg > 0;
    });
    if (!alreadyConfirmed && !allLinesHaveSg && (!Number.isFinite(bomSgValue) || bomSgValue <= 0)) {
      addToast(
        'error',
        'Enter Specific Gravity on each RM line, or set a BOM default SG (greater than 0) before confirming.'
      );
      return;
    }
    const blendSg =
      Number.isFinite(bomSgValue) && bomSgValue > 0
        ? bomSgValue
        : bomFormula.length > 0
          ? resolveBomLineSgForSave(bomFormula[0])
          : 1;
    const rmLines: BOMRmLine[] = bomFormula.map((item) => ({
      phase: item.phase ?? 'Phase A',
      inci_name: item.name,
      rm_code: item.code ?? item.id,
      pct_w_w: item.percentage,
      uom: 'KG',
      specific_gravity: resolveBomLineSgForSave(item),
      ...(typeof item.id === 'string' && /^\d+$/.test(item.id) ? { raw_material_id: parseInt(item.id, 10) } : {}),
    }));
    const pmLines: BOMPmLine[] = bomPackaging.map((item) => ({
      pm_code: item.code ?? item.id,
      description: item.name,
      pack_type: 'Primary',
      qty_per_unit: item.value,
      uom: 'pc/unit',
    }));

    try {
      if (selectedBatchId != null) {
        const saved = await updatePlanningBatch(selectedSOForBatch.id, selectedBatchId, { rmLines, pmLines });
        if (!saved) {
          addToast('error', 'Failed to save BOM for this batch');
          return;
        }
        queryClient.invalidateQueries({ queryKey: ['planning-batch', selectedSOForBatch.id, selectedBatchId] });
        queryClient.invalidateQueries({ queryKey: ['planning-batches', selectedSOForBatch.id] });
      } else {
        const saved = await putBomOverride(selectedSOForBatch.id, { rmLines, pmLines });
        if (!saved) {
          addToast('error', 'Failed to save custom BOM for this SO');
          return;
        }
        queryClient.invalidateQueries({ queryKey: ['planning-bom-override', selectedSOForBatch.id] });
      }
      const confirmed = await updatePlanningExtracted(selectedSOForBatch.id, {
        bomConfirmedAt: planningBomConfirmedAtIso(),
        bomSpecificGravity: blendSg,
      });
      if (!confirmed) {
        addToast('error', 'Failed to confirm BOM. Check stock and try again.');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['planning-extracted'] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'items-involved'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-inventory'] });
      addToast(
        'success',
        `BOM confirmed for B-${String(selectedBatchPlanSequence).padStart(2, '0')} — ${selectedSOForBatch.productName}. Open Batch Plan to allocate units and send this batch.`
      );
      setSelectedSOForBatch((prev) =>
        prev
          ? {
              ...prev,
              bomConfirmedAt: confirmed?.bomConfirmedAt ?? planningBomConfirmedAtIso(),
              bomSpecificGravity: blendSg,
            }
          : prev
      );
      setBomFormula((prev) =>
        prev.map((it) => ({ ...it, specificGravity: resolveBomLineSgForSave(it) }))
      );
      setBomLevelSG(String(blendSg));
      setIsReadyForProduction(true);
      setActiveBatchTab('batch-plan');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to confirm BOM';
      addToast('error', errorMessage);
      console.error('Error confirming BOM:', error);
    }
  };

  const handleSendToProduction = async () => {
    if (!selectedSOForBatch || !canSendToProduction) return;
    // Send only the batch currently selected in the top dropdown (the one the user is viewing), not all checked boxes
    const selectedIndex = selectedBatchId != null && planningBatches.length > 0
      ? (planningBatches as PlanningBatchRow[]).findIndex((b) => Number(b.id) === Number(selectedBatchId))
      : -1;
    const toSend = selectedIndex >= 0 && selectedIndex < customBatches.length ? [selectedIndex] : [];
    if (toSend.length === 0) {
      addToast('info', 'Choose a working batch in the bar at the top of the modal, then send from Batch Plan.');
      return;
    }
    const alreadySent = (selectedSOForBatch.sentBatchIndices ?? []).includes(toSend[0]);
    if (alreadySent) {
      addToast('info', `B-${String(toSend[0] + 1).padStart(2, '0')} is already sent to Production.`);
      return;
    }
    const mergedSent = [...new Set([...(selectedSOForBatch.sentBatchIndices ?? []), ...toSend])].sort((a, b) => a - b);
    try {
      await updatePlanningExtracted(selectedSOForBatch.id, {
        batchCount: customBatches.length || parseInt(numBatches, 10) || 0,
        batchSizeKg: customBatches.length > 0 ? customBatches[0].sizeKg : (parseFloat(batchSizeKg) || 500),
        plannedStartDate: plannedStartDate || undefined,
        productionLine: productionLine || undefined,
        bomStatus: 'Production Released',
        customBatches: customBatches.length > 0 ? customBatches : undefined,
        sentBatchIndices: mergedSent,
      });
      if (customBatches.length > 0) {
        await createOrUpdatePlanningBatches(selectedSOForBatch.id, customBatches);
      }
      queryClient.invalidateQueries({ queryKey: ['planning-extracted'] });
      queryClient.invalidateQueries({ queryKey: ['planning-batches', selectedSOForBatch.id] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'items-involved'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['planning-batches-all'] });
      addToast('success', `${toSend.length} batch${toSend.length !== 1 ? 'es' : ''} sent to Production`);
    } catch (e) {
      console.error('[Planning] send to production (bulk)', e);
      addToast('error', e instanceof Error ? e.message : 'Failed to save');
    }
    setPlanBatchesModalOpen(false);
    setSelectedSOForBatch(null);
    setBomFormula([]);
    setBomPackaging([]);
    setActiveBatchTab('bom-editor');
    setNumBatches('1');
    setBatchSizeKg('500');
    setPlannedStartDate(new Date().toISOString().split('T')[0]);
    setProductionLine('Line 1 — Primary Mixer');
    setIsReadyForProduction(false);
    setCustomBatches([]);
    setExpandedBatchIndex(null);
    setSelectedBatchId(null);
  };

  /** Persist send for the Plan Batches modal path (full extract + planning_batches sync). */
  const performSendBatchFromPlanModal = async (batchIndex: number): Promise<{ batchLabel: string; nextBatchIndex: number; remainingUnits: number }> => {
    if (!selectedSOForBatch) {
      throw new Error('No sales order selected');
    }
    if (!canSendToProduction) {
      throw new Error('Confirm BOM in BOM Editor before sending to Production');
    }
    if (!Number.isFinite(batchIndex) || batchIndex < 0) {
      throw new Error('Invalid batch');
    }
    if (!customBatches?.length || batchIndex >= customBatches.length) {
      throw new Error('Batch plan is not ready. Save or refresh batches and try again.');
    }
    const alreadySent = (selectedSOForBatch.sentBatchIndices ?? []).includes(batchIndex);
    if (alreadySent) {
      throw new Error(`B-${String(batchIndex + 1).padStart(2, '0')} is already sent to Production.`);
    }

    const mergedSent = [...new Set([...(selectedSOForBatch.sentBatchIndices ?? []), batchIndex])].sort((a, b) => a - b);
    await updatePlanningExtracted(selectedSOForBatch.id, {
      batchCount: customBatches.length || parseInt(numBatches, 10) || 0,
      batchSizeKg: customBatches.length > 0 ? customBatches[0].sizeKg : (parseFloat(batchSizeKg) || 500),
      plannedStartDate: plannedStartDate || undefined,
      productionLine: productionLine || undefined,
      bomStatus: 'Production Released',
      customBatches: customBatches.length > 0 ? customBatches : undefined,
      sentBatchIndices: mergedSent,
    });

    if (customBatches.length > 0) {
      await createOrUpdatePlanningBatches(selectedSOForBatch.id, customBatches);
    }

    queryClient.invalidateQueries({ queryKey: ['planning-extracted'] });
    queryClient.invalidateQueries({ queryKey: ['planning-batches', selectedSOForBatch.id] });
    queryClient.invalidateQueries({ queryKey: ['planning', 'items-involved'] });
    queryClient.invalidateQueries({ queryKey: ['warehouse-inventory'] });
    queryClient.invalidateQueries({ queryKey: ['planning-batches-all'] });

    setSelectedSOForBatch((prev) => (prev ? { ...prev, sentBatchIndices: mergedSent, bomStatus: 'Production Released' } : prev));
    const batchLabel = `B-${String(batchIndex + 1).padStart(2, '0')}`;
    const nextBatchIndex = customBatches.findIndex((_, idx) => !mergedSent.includes(idx));
    const orderQtyNum = parseInt(selectedSOForBatch.orderQty?.replace(/\D/g, '') || '0', 10) || 0;
    const orderTotalKg = parseFloat(selectedSOForBatch.totalKg?.replace(/[^\d.]/g, '') || '0') || 0;
    const sentKg = customBatches.reduce(
      (sum, b, idx) => (mergedSent.includes(idx) ? sum + (Number(b.sizeKg) || 0) : sum),
      0
    );
    const remainingKg = Math.max(0, orderTotalKg - sentKg);
    const kgPerUnit = orderQtyNum > 0 && orderTotalKg > 0 ? orderTotalKg / orderQtyNum : 0;
    const remainingUnits = kgPerUnit > 0 ? Math.round(remainingKg / kgPerUnit) : 0;
    return { batchLabel, nextBatchIndex, remainingUnits };
  };

  const runConfirmedSendToProduction = async () => {
    if (!sendToProductionConfirm) return;
    setSendToProductionSending(true);
    try {
      if (sendToProductionConfirm.source === 'plan-modal') {
        const batchIndex = sendToProductionConfirm.batchIndex;
        const { batchLabel, nextBatchIndex, remainingUnits } = await performSendBatchFromPlanModal(batchIndex);
        // Keep Plan Batches popup open and move focus to next pending batch.
        if (nextBatchIndex >= 0) {
          const nextRow = (planningBatches as PlanningBatchRow[])[nextBatchIndex];
          if (nextRow?.id != null) setSelectedBatchId(Number(nextRow.id));
          setFeasibilityPreviewQty(Math.max(0, remainingUnits));
        }
        setActiveBatchTab('batch-plan');
        setSendToProductionConfirm(null);
        setSendToProductionSuccess({
          title: 'Batch created & confirmed',
          message:
            nextBatchIndex >= 0
              ? `${batchLabel} sent to Production. Moved to the next pending batch in Plan Batches.`
              : `${batchLabel} sent to Production. All planned batches are now sent.`,
        });
      } else {
        const { batch } = sendToProductionConfirm;
        const current = (batch as PlanningBatchAllRow).sentBatchIndices ?? [];
        const idx = Number(batch.sequence) - 1;
        if (current.includes(idx)) {
          addToast('info', 'This batch is already sent to Production.');
          setSendToProductionConfirm(null);
          return;
        }
        const merged = [...current, idx].sort((a, b) => a - b);
        await updatePlanningExtracted(String(batch.planningExtractedId), { sentBatchIndices: merged });
        queryClient.invalidateQueries({ queryKey: ['planning-batches-all'] });
        queryClient.invalidateQueries({ queryKey: ['planning-extracted'] });
        const code = batch.batchCode ?? `PE-${batch.planningExtractedId}-B${batch.sequence}`;
        setBatchForDetailModal(null);
        setSendToProductionConfirm(null);
        setSendToProductionSuccess({
          title: 'Batch confirmed',
          message: `${code} was sent to Production. You can schedule it in Production → Calendar.`,
        });
      }
    } catch (e) {
      console.error('[Planning] send batch to production', e);
      const msg = e instanceof Error ? e.message : 'Failed to send to Production';
      setSendToProductionConfirm(null);
      if (msg.includes('already sent')) {
        addToast('info', msg);
      } else {
        addToast('error', msg);
      }
    } finally {
      setSendToProductionSending(false);
    }
  };

  // const handleRaisePRFromBatch = () => {
  //   if (selectedSOForBatch) {
  //     prForBatchIndexRef.current = null;
  //     prFromBatchShortagesRef.current = true;
  //     setPlanBatchesModalOpen(false);
  //     setSelectedSO(selectedSOForBatch);
  //     setPrModalOpen(true);
  //     setPrShowPMOnly(false);
  //     setPrPriority('High');
  //     setPrRequiredByDate(selectedSOForBatch.dueDate || '');
  //     setPrNotes('');
  //   }
  // };

  const swapSourceLine =
    swapSourceIndex != null && swapSourceIndex >= 0 ? bomFormula[swapSourceIndex] ?? null : null;

  const swapSelectedQtyKg = useMemo(() => {
    if (swapSourceIndex == null) return 0;
    const pct = bomFormula[swapSourceIndex]?.percentage ?? 0;
    return roundMaterialQty((effectiveBatchSizeKg * pct) / 100);
  }, [swapSourceIndex, bomFormula, effectiveBatchSizeKg]);

  const updateSwapLinePct = useCallback(
    (lineIndex: number, rawPct: string) => {
      const pct = rawPct === '' ? 0 : parseFloat(rawPct);
      const safePct = Number.isFinite(pct) ? Math.max(0, pct) : 0;
      const qtyKg = roundMaterialQty((effectiveBatchSizeKg * safePct) / 100);
      setBomFormula((prev) => {
        const next = [...prev];
        const line = next[lineIndex];
        if (!line) return prev;
        next[lineIndex] = { ...line, percentage: safePct, quantity: qtyKg };
        return next;
      });
    },
    [effectiveBatchSizeKg]
  );

  const updateBomLineSg = useCallback((lineIndex: number, rawSg: string) => {
    const n = rawSg === '' ? NaN : parseFloat(rawSg);
    const safeSg = Number.isFinite(n) && n > 0 ? n : 1;
    setBomFormula((prev) => {
      const next = [...prev];
      const line = next[lineIndex];
      if (!line) return prev;
      next[lineIndex] = { ...line, specificGravity: safeSg };
      return next;
    });
  }, []);

  const resolveBomLineSgForSave = useCallback(
    (item: RawMaterial): number => {
      const lineSg = Number(item.specificGravity);
      if (Number.isFinite(lineSg) && lineSg > 0) return lineSg;
      const bomSg = Number(bomLevelSG);
      return Number.isFinite(bomSg) && bomSg > 0 ? bomSg : 1;
    },
    [bomLevelSG]
  );

  const swapTargetItemGroups = useMemo(() => {
    if (!swapSourceLine || itemGroupsRm.length === 0) return [];
    return itemGroupsRm.filter((grp) =>
      (grp.approvedMembers ?? []).some((m) => bomLineMatchesItemGroupMember(swapSourceLine, m))
    );
  }, [swapSourceLine, itemGroupsRm]);

  const swapCategories = useMemo(() => {
    if (!swapSourceLine || itemGroupsRm.length === 0 || swapTargetItemGroups.length === 0) {
      return [];
    }

    const toSwapItem = (
      m: { id: string; code: string; name: string },
      grp: ItemGroupRecord
    ) => {
      if (bomLineMatchesItemGroupMember(swapSourceLine, m)) return null;
      const inBom = bomFormula.some((f) => f.code === m.code || f.name === m.name);
      return {
        id: m.id,
        name: m.name,
        code: m.code,
        description: grp.description || '',
        status: inBom ? 'IN BOM' : 'AVAILABLE',
        inBom,
      };
    };

    return swapTargetItemGroups.map((grp) => ({
      name: grp.name,
      code: grp.code,
      items: (grp.approvedMembers ?? [])
        .map((m) => toSwapItem(m, grp))
        .filter((x): x is NonNullable<typeof x> => x != null),
    }));
  }, [itemGroupsRm, bomFormula, swapSourceLine, swapTargetItemGroups]);

  useEffect(() => {
    if (activeBatchTab !== 'swap-add') return;
    const q = swapRmSearch.trim();
    if (q.length < 2) {
      setSwapRmResults([]);
      setSwapRmSearchLoading(false);
      return;
    }
    let cancelled = false;
    setSwapRmSearchLoading(true);
    const timer = window.setTimeout(() => {
      fetchRawMaterialsList(q)
        .then((rows) => {
          if (!cancelled) setSwapRmResults(rows.slice(0, 25));
        })
        .catch(() => {
          if (!cancelled) setSwapRmResults([]);
        })
        .finally(() => {
          if (!cancelled) setSwapRmSearchLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [swapRmSearch, activeBatchTab]);

  const applyBomLineSwap = useCallback(
    (rm: { id: string; code: string; name: string; inci?: string; specificGravity?: number | null }) => {
      if (swapSourceIndex === null) return false;
      const rmIdNum = parseInt(String(rm.id), 10);
      setBomFormula((prev) => {
        const next = [...prev];
        const src = next[swapSourceIndex];
        const pct = src?.percentage ?? 0;
        const qtyKg = roundMaterialQty((effectiveBatchSizeKg * pct) / 100);
        const defaultSg = parseSpecificGravity(bomLevelSG);
        next[swapSourceIndex] = {
          id: String(rm.id),
          raw_material_id: Number.isFinite(rmIdNum) ? rmIdNum : undefined,
          name: (rm.name || rm.inci || rm.code).trim(),
          quantity: qtyKg,
          unit: 'KG',
          percentage: pct,
          code: rm.code,
          phase: src?.phase ?? 'Phase A',
          specificGravity: src?.specificGravity ?? defaultSg,
        };
        return next;
      });
      setSwapSourceIndex(null);
      return true;
    },
    [swapSourceIndex, effectiveBatchSizeKg, bomLevelSG]
  );

  const upsertRmInItemGroup = async (rmId: number, groupName: string) => {
    const nameTrim = groupName.trim();
    if (!nameTrim) throw new Error('Group name is required');
    const existing = itemGroupsRm.find((g) => g.name.trim().toLowerCase() === nameTrim.toLowerCase());
    if (existing) {
      const prevIds = (existing.member_ids ?? []).map((id) => Number(id)).filter((n) => Number.isFinite(n));
      const member_ids = [...new Set([...prevIds, rmId])];
      const res = await updateItemGroup(existing.id, { member_ids });
      if (!res.success) throw new Error(res.error?.message || 'Failed to update item group');
      return existing.name;
    }
    const codeRes = await fetchNextItemGroupCode('RM');
    const code = codeRes.data?.nextCode ?? `IG-RM-${Date.now()}`;
    const res = await createItemGroup({
      code,
      type: 'RM',
      name: nameTrim,
      member_ids: [rmId],
      status: 'Active',
    });
    if (!res.success) throw new Error(res.error?.message || 'Failed to create item group');
    return nameTrim;
  };

  const closeSwapRmSuggestions = useCallback(() => {
    setSwapRmSuggestionsOpen(false);
    setSwapRmSearch('');
    setSwapRmResults([]);
  }, []);

  const handleSwapWithRm = async (rm: RawMaterialRecord) => {
    if (swapSourceIndex === null) {
      addToast('error', 'Select a BOM line on the right, then choose a replacement.');
      return;
    }
    const rmIdNum = parseInt(String(rm.id), 10);
    setSwapApplying(true);
    try {
      const label = rm.name || rm.inci || rm.code;
      if (
        applyBomLineSwap({
          id: rm.id,
          code: rm.code,
          name: label,
          inci: rm.inci,
        })
      ) {
        closeSwapRmSuggestions();
        if (swapAddToGroup && Number.isFinite(rmIdNum)) {
          setSwapPendingGroupRm({ id: rmIdNum, name: label });
          addToast('success', `Swapped to ${label}. Confirm item group add below.`);
        } else {
          setSwapPendingGroupRm(null);
          addToast('success', `Swapped to ${label}. Confirm BOM to save.`);
        }
      }
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Swap failed');
    } finally {
      setSwapApplying(false);
    }
  };

  const handleConfirmSwapItemGroup = async () => {
    if (!swapPendingGroupRm) {
      addToast('error', 'Swap a replacement RM first.');
      return;
    }
    if (!swapGroupName.trim()) {
      addToast('error', 'Enter an item group name.');
      return;
    }
    const pending = swapPendingGroupRm;
    setSwapApplying(true);
    try {
      const groupLabel = await upsertRmInItemGroup(pending.id, swapGroupName.trim());
      await queryClient.invalidateQueries({ queryKey: ['item-groups-rm'] });
      setSwapPendingGroupRm(null);
      addToast('success', `Added ${pending.name} to item group "${groupLabel}".`);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to update item group');
    } finally {
      setSwapApplying(false);
    }
  };

  const handleSwapFromGroupMember = async (item: {
    id: string;
    code: string;
    name: string;
  }) => {
    if (swapSourceIndex === null) return;
    const rmIdNum = parseInt(String(item.id), 10);
    setSwapApplying(true);
    try {
      if (applyBomLineSwap(item)) {
        if (swapAddToGroup && Number.isFinite(rmIdNum)) {
          setSwapPendingGroupRm({ id: rmIdNum, name: item.name });
          addToast('success', `Swapped to ${item.name}. Confirm item group add below.`);
        } else {
          setSwapPendingGroupRm(null);
          addToast('success', `Swapped to ${item.name}. Confirm BOM to save.`);
        }
      }
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Swap failed');
    } finally {
      setSwapApplying(false);
    }
  };

  const _handleSendToProductionFromCard = async (order: SalesOrder) => {
    if (order.bomStatus !== 'Production Ready' || productionSentOrderIds.includes(order.id)) return;

    try {
      await updatePlanningExtracted(order.id, { bomStatus: 'Production Released' });
      queryClient.invalidateQueries({ queryKey: ['planning-extracted'] });
      if (selectedSOForBatch?.id === order.id) {
        setSelectedSOForBatch({ ...selectedSOForBatch, bomStatus: 'Production Released' });
      }
      setProductionSentOrderIds((prev) => [...prev, order.id]);
      addToast('success', `${order.productName} sent to Production`);
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Failed to send to Production');
    }
  };

  const _getStatusColor = (status: string) => {
    switch (status) {
      case 'Production Released':
        return 'bg-teal-100 text-teal-700';
      case 'In Progress':
        return 'bg-blue-100 text-blue-700';
      case 'Planned':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Production Released':
        return 'bg-emerald-100 text-emerald-700';
      case 'Production Ready':
        return 'bg-green-100 text-green-700';
      case 'In Progress':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F9]">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-6 pt-3">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <AdminMainMenuButton />
              <div className="w-7 h-7 rounded-md bg-indigo-600 text-white flex items-center justify-center text-xs font-extrabold">EI</div>
              <div className="text-sm font-semibold text-gray-900">Planning Dashboard</div>
            </div>
            <div className="text-xs text-gray-500">Production Planning Hub</div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-5">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">Order Management / Planning</div>
            <h1 className="text-[22px] font-bold tracking-tight text-gray-900">Planning</h1>
            <p className="text-sm text-gray-500">Production Planning Hub</p>
          </div>
          {/* <button
            onClick={() => {
              try {
                const list = pisRows.length > 0 ? pisRows : salesOrders;
                if (list.length > 0) {
                  handleRaisePR(list[0], false);
                } else {
                  addToast('warning', 'No sales orders available to raise PR');
                }
              } catch (_error) {
                addToast('error', 'Error opening PR modal');
              }
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-full font-medium transition-colors"
          >
            Raise PR
          </button> */}
        </div>

        {/* Status Badges */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold">
            {pisRows.length} Active SOs
          </div>
          <div className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1 rounded-full text-xs font-semibold">
            {tabStats['pis-extracted'].shortages} Shortages
          </div>
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-1 rounded-full text-xs font-semibold">
            {tabStats['items-involved'].prsRaised} PRs Raised
          </div>
          <div className="text-gray-500 text-xs ml-auto">Planning: Feb 2026</div>
        </div>

        {/* Summary Cards */}
        <div className={`grid gap-3 mb-5 ${activeMainTab === 'items-involved' ? 'grid-cols-6' : 'grid-cols-7'}`}>
          {activeMainTab === 'items-involved' ? (
            <>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-gray-500 text-[11px] font-semibold mb-1 tracking-wide">CONFIRMED PRODUCTS</p>
                <p className="text-2xl font-bold text-emerald-600">{(currentStats as PlanningTabStats).confirmedProducts.value}</p>
                <p className="text-xs text-gray-500 mt-1">of {(currentStats as PlanningTabStats).confirmedProducts.total} total</p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-gray-500 text-[11px] font-semibold mb-1 tracking-wide">RM ITEMS</p>
                <p className="text-2xl font-bold text-cyan-600">{(currentStats as PlanningTabStats).rmItems.value}</p>
                <p className="text-xs text-gray-500 mt-1">{(currentStats as PlanningTabStats).rmItems.ok} OK, {(currentStats as PlanningTabStats).rmItems.short} short</p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-gray-500 text-[11px] font-semibold mb-1 tracking-wide">PM ITEMS</p>
                <p className="text-2xl font-bold text-purple-600">{(currentStats as PlanningTabStats).pmItems.value}</p>
                <p className="text-xs text-gray-500 mt-1">{(currentStats as PlanningTabStats).pmItems.ok} OK, {(currentStats as PlanningTabStats).pmItems.short} short</p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-gray-500 text-[11px] font-semibold mb-1 tracking-wide">RM SHORTAGES</p>
                <p className="text-2xl font-bold text-gray-900">{(currentStats as PlanningTabStats).rmShortages}</p>
                <p className="text-xs text-gray-500 mt-1">Items below order req</p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-gray-500 text-[11px] font-semibold mb-1 tracking-wide">PM SHORTAGES</p>
                <p className="text-2xl font-bold text-red-600">{(currentStats as PlanningTabStats).pmShortages}</p>
                <p className="text-xs text-gray-500 mt-1">Items below order req</p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-gray-500 text-[11px] font-semibold mb-1 tracking-wide">PRS RAISED</p>
                <p className="text-2xl font-bold text-orange-600">{(currentStats as PlanningTabStats).prsRaised}</p>
                <p className="text-xs text-gray-500 mt-1">Pending procurement</p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-gray-500 text-[11px] font-semibold mb-1 tracking-wide">TOTAL SOS</p>
                <p className="text-2xl font-bold text-gray-900">{(currentStats as PlanningTabStats).totalSOs}</p>
                <p className="text-xs text-gray-500 mt-1">Approved orders</p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-gray-500 text-[11px] font-semibold mb-1 tracking-wide">PROD. RELEASED</p>
                <p className="text-2xl font-bold text-gray-900">{(currentStats as PlanningTabStats).prodReleased}</p>
                <p className="text-xs text-gray-500 mt-1">Ready to plan</p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-gray-500 text-[11px] font-semibold mb-1 tracking-wide">RM/PM SHORTAGES</p>
                <p className="text-2xl font-bold text-orange-600">{(currentStats as PlanningTabStats).shortages}</p>
                <p className="text-xs text-gray-500 mt-1">needs below order req</p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-gray-500 text-[11px] font-semibold mb-1 tracking-wide">BATCHES REQUIRED</p>
                <p className="text-2xl font-bold text-gray-900">{(currentStats as PlanningTabStats).batchesRequired}</p>
                <p className="text-xs text-gray-500 mt-1">Across all products</p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-gray-500 text-[11px] font-semibold mb-1 tracking-wide">BATCHES CONFIRMED</p>
                <p className="text-2xl font-bold text-gray-900">{(currentStats as PlanningTabStats).batchesConfirmed}</p>
                <p className="text-xs text-gray-500 mt-1">BOM confirmed & planned</p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-gray-500 text-[11px] font-semibold mb-1 tracking-wide">NOT PLANNED</p>
                <p className="text-2xl font-bold text-red-600">{(currentStats as PlanningTabStats).notPlanned ?? 0}</p>
                <p className="text-xs text-gray-500 mt-1">SOs pending planning confirmation</p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-gray-500 text-[11px] font-semibold mb-1 tracking-wide">SO VALUE</p>
                <p className="text-2xl font-bold text-orange-600">{(currentStats as PlanningTabStats).soValue}</p>
              </div>
            </>
          )}
        </div>

        {/* Main Tabs Navigation — each tab is a sub-route */}
        <div className="flex gap-1 mb-5 border-b border-gray-200 bg-white px-2 pt-1 rounded-t-lg">
          <NavLink
            to="/planning/pis-extracted"
            className={({ isActive }) =>
              `px-4 py-2.5 font-semibold text-sm border-b-2 transition-colors ${isActive ? 'text-indigo-700 border-indigo-600' : 'text-gray-600 border-transparent hover:text-gray-900'
              }`
            }
          >
            PIs Extracted
          </NavLink>
          <NavLink
            to="/planning/batches"
            className={({ isActive }) =>
              `px-4 py-2.5 font-semibold text-sm border-b-2 transition-colors ${isActive ? 'text-indigo-700 border-indigo-600' : 'text-gray-600 border-transparent hover:text-gray-900'
              }`
            }
          >
            Batches
          </NavLink>
          <NavLink
            to="/planning/items-involved"
            className={({ isActive }) =>
              `px-4 py-2.5 font-semibold text-sm border-b-2 transition-colors ${isActive ? 'text-indigo-700 border-indigo-600' : 'text-gray-600 border-transparent hover:text-gray-900'
              }`
            }
          >
            Items Involved
          </NavLink>
        </div>

        <div className="mb-4">
          <DateRangeFilterInputs
            value={dateFilter}
            onChange={setDateFilter}
            dateFieldLabel={
              activeMainTab === 'batches'
                ? 'Due date (batches)'
                : 'SO order date (PIs / items)'
            }
          />
        </div>

        {/* PIs Extracted Tab Content */}
        {activeMainTab === 'pis-extracted' && (
          <>
            {/* Order Management Header */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">Order Management</h2>
                <div className="text-xs text-gray-500 mt-0.5">Client PO → Internal SO → Ordered Products → Items involved (syncs to procurement)</div>
              </div>
            </div>
            {/* Tabs and Filter */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-600 font-medium">STATUS:</span>
                {['All', 'Prod Released', 'In Progress', 'Planned', 'Not Planned'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${statusFilter === status
                      ? 'bg-white text-gray-800 border border-gray-300 shadow-xs'
                      : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200'
                      }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="flex items-center gap-2 mt-4">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search product, SO, client"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 outline-none text-sm"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')}>
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleExportPisCsv}
                  className="ml-auto px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                >
                  Export CSV
                </button>
              </div>
            </div>

            {/* PIs Extracted: list from API; row click opens detail popup */}
            {planningLoading && (
              <div className="py-8 text-center text-gray-500">Loading…</div>
            )}
            {!planningLoading && filteredPisOrders.length === 0 && (
              <div className="py-8 text-center text-gray-500 border border-gray-200 rounded-lg bg-white">No PRs extracted. Create SOs and they will appear here.</div>
            )}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1180px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">SO Date</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">SO No</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Client</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Product</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Units Ordered</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Plan Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Batch Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Planning SLA (48h)</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedPisOrders.map((order) => {
                      const orderDateDisplay = (() => {
                        const d = order.orderDate ? new Date(order.orderDate) : null;
                        if (!d || Number.isNaN(d.getTime())) return '—';
                        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                      })();
                      const dueDateDisplay = (() => {
                        const d = order.dueDate ? new Date(order.dueDate) : null;
                        if (!d || Number.isNaN(d.getTime())) return order.dueDate ?? '—';
                        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                      })();

                      const customerTag = order.bomStatus === 'Planned'
                        ? { text: 'Planned', dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-700 border-gray-200' }
                        : order.bomStatus === 'In Progress'
                          ? { text: 'In Production', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-800 border-amber-200' }
                          : { text: 'Confirmed', dot: 'bg-green-500', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' };

                      // MFG records from production batches for this SO number.
                      const prodForSo = (productionBatches as BatchRow[])
                        .filter((b) => String(b.soNo ?? '').trim() === String(order.soNumber ?? '').trim());
                      const bmrCount = prodForSo.filter((b) => (b.bmrNo ?? '').toString().trim() !== '').length;
                      const bprCount = prodForSo.filter((b) => (b.bprNo ?? '').toString().trim() !== '').length;

                      const res =
                        planningAvailabilityBySoNo[order.soNumber] ??
                        planningAvailabilityBySoNo[normalizeSoKey(order.soNumber)];
                      const availItems = res?.items ?? [];
                      const availabilityItem: SoPlanningAvailabilityItem | null =
                        availItems.find((it) => String(it.sku || '').trim() === String(order.productCode || '').trim()) ??
                        availItems.find((it) => String(it.productName || '').trim() === String(order.productName || '').trim()) ??
                        (availItems.length === 1 ? availItems[0] : null);
                      const availabilityTier = getPisAvailabilityTier(availabilityItem, planningAvailabilityLoading);
                      const { createdUnits, remainingUnits } = getCreatedAndRemainingUnits(order);

                      return (
                        <tr
                          key={order.id}
                          onClick={() => openDetailModal(order)}
                          className={pisAvailabilityRowClass(availabilityTier)}
                        >
                          <td className="px-4 py-3 text-gray-700 text-xs">
                            {orderDateDisplay}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-mono font-semibold text-gray-900">{order.soNumber}</div>
                            <div className="text-xs text-gray-500">Due {dueDateDisplay}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-900">{order.customerName ?? '—'}</div>
                            <div className="text-xs text-gray-500">{order.soStatus ?? '—'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-900">{order.productName ?? order.productCode ?? '—'}</div>
                            <div className="text-xs text-gray-500">{order.productCode ?? '—'}</div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="font-medium text-gray-900">{order.orderQty}</div>
                            <div className="text-xs text-gray-500">{order.totalKg} total</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="w-44">
                              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-1.5">
                                <div
                                  className={`h-full ${remainingUnits <= 0 ? 'bg-emerald-500' : createdUnits > 0 ? 'bg-indigo-500' : 'bg-gray-400'}`}
                                  style={{ width: `${Math.min(100, Math.max(0, (createdUnits / Math.max(1, createdUnits + remainingUnits)) * 100))}%` }}
                                />
                              </div>
                              <div className="text-xs text-gray-700">
                                Planned <span className="font-semibold">{createdUnits.toLocaleString()}</span> · Pending{' '}
                                <span className="font-semibold">{remainingUnits.toLocaleString()}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            <div className="flex flex-wrap gap-1.5">
                              <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-medium">
                                BMR {bmrCount}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-medium">
                                BPR {bprCount}
                              </span>
                            </div>
                            <div className="mt-1">
                              <span className={`inline-flex items-center gap-2 px-2 py-0.5 rounded text-[11px] font-semibold border ${customerTag.badge}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${customerTag.dot}`} />
                                {customerTag.text}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {(() => {
                              void slaClockTick;
                              const sla = getPlanningSlaMeta(order, remainingUnits);
                              const toneCls =
                                sla.tone === 'green'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : sla.tone === 'amber'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-red-50 text-red-700 border-red-200';
                              const dotCls = sla.tone === 'green' ? 'bg-emerald-500' : sla.tone === 'amber' ? 'bg-amber-500' : 'bg-red-500';
                              return (
                                <>
                                  <span className={`inline-flex items-center gap-2 px-2 py-0.5 rounded text-[11px] font-semibold border ${toneCls}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
                                    {sla.label}
                                  </span>
                                  <div className="text-xs text-gray-500 mt-1">{sla.sub}</div>
                                </>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetailModal(order);
                              }}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold"
                            >
                              Open →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!planningLoading && filteredPisOrders.length > 0 && (
                <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-gray-200 bg-gray-50">
                  <div className="text-xs text-gray-600">
                    Page {safePisPage} of {pisTotalPages} · Showing {pagedPisOrders.length} of {filteredPisOrders.length} rows
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={pisPageSize}
                      onChange={(e) => setPisPageSize(Number(e.target.value) || 20)}
                      className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                    >
                      <option value={20}>20 / page</option>
                      <option value={50}>50 / page</option>
                      <option value={100}>100 / page</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setPisPage((p) => Math.max(1, p - 1))}
                      disabled={safePisPage <= 1}
                      className="px-2 py-1 text-xs rounded border border-gray-300 disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => setPisPage((p) => Math.min(pisTotalPages, p + 1))}
                      disabled={safePisPage >= pisTotalPages}
                      className="px-2 py-1 text-xs rounded border border-gray-300 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Detail popup: full order details, RM/PM, Plan Batches & Raise PR */}
            {detailModalOpen && selectedRowForDetail && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeDetailModal}>
                <div
                  className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-900">{selectedRowForDetail.productName}</h2>
                    <button type="button" onClick={closeDetailModal} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6 pb-4 border-b border-gray-200 text-center">
                      {[
                        ['SO Number', selectedRowForDetail.soNumber],
                        ['Order Qty', selectedRowForDetail.orderQty],
                        ['Total KG', selectedRowForDetail.totalKg],
                        ['Order Date', selectedRowForDetail.orderDate],
                        ['Due Date', selectedRowForDetail.dueDate],
                        ['Days Left', selectedRowForDetail.daysLeft],
                        // ['Batch Size', selectedRowForDetail.batchSize],
                        // ['Batches Required', `${selectedRowForDetail.batchesRequired} batches`],
                        ['BOM Status', selectedRowForDetail.bomStatus],
                        ['Approved By', selectedRowForDetail.approvedBy],
                      ].map(([label, value]) => (
                        <div key={String(label)}>
                          <p className="text-xs text-gray-500 font-medium uppercase mb-1">{label}</p>
                          <p className="text-sm font-semibold text-gray-900">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mb-6 flex items-center justify-between flex-wrap gap-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase">
                        {selectedRowForDetail.batchesRequired} batches required
                      </p>
                      <button
                        type="button"
                        onClick={() => { handlePlanBatches(selectedRowForDetail); closeDetailModal(); }}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700"
                      >
                        Plan Batches & Confirm BOM
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div>
                        <h4 className="font-bold text-gray-900 mb-3 flex items-center text-sm">
                          <span className="w-2.5 h-2.5 bg-teal-500 rounded-full mr-2" />
                          RM — {detailRmItems.length} items
                          <span className="ml-2 text-xs font-normal text-gray-500">(bar = order fulfillment from stock)</span>
                        </h4>
                        <p className="text-[11px] text-gray-500 mb-2">
                          Gray track = qty required for this SO · Fill = how much free stock (SIH − reserved) can cover.
                        </p>
                        <div className="space-y-4">
                          {detailRmItems.map((item) => (
                            <DetailFulfillmentBar key={item.id} row={item} variant="rm" />
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 mb-3 flex items-center text-sm">
                          <span className="w-2.5 h-2.5 bg-orange-500 rounded-full mr-2" />
                          PM — {detailPmItems.length} items
                          <span className="ml-2 text-xs font-normal text-gray-500">(bar = order fulfillment from stock)</span>
                        </h4>
                        <p className="text-[11px] text-gray-500 mb-2">
                          Gray track = pcs required for this SO · Fill = coverable from free stock (SIH − reserved).
                        </p>
                        <div className="space-y-4">
                          {detailPmItems.map((item) => (
                            <DetailFulfillmentBar key={item.id} row={item} variant="pm" />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-gray-500">
                        Approved by <span className="font-semibold text-gray-700">{selectedRowForDetail.approvedBy}</span>
                      </p>
                      {/* <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleRaisePRFromDetailPopup()}
                          className="px-4 py-2 rounded-lg text-sm font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200"
                        >
                          Raise PR
                        </button>
                        <button
                          type="button"
                          onClick={() => { handlePlanBatches(selectedRowForDetail); closeDetailModal(); }}
                          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700"
                        >
                          Plan Batches
                        </button>
                      </div> */}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </>
        )}

        {activeMainTab === 'items-involved' && (
          <div className="space-y-4">
            {/* Filters Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className="font-medium text-sm text-gray-600">CATEGORY:</span>
                {(['all', 'RM', 'PM', 'shortage', 'available'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setItemsInvolvedCategoryFilter(key)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${itemsInvolvedCategoryFilter === key
                      ? key === 'shortage'
                        ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
                        : key === 'available'
                          ? 'bg-green-100 text-green-700 ring-1 ring-green-300'
                          : 'bg-slate-200 text-slate-800 ring-1 ring-slate-400'
                      : key === 'shortage'
                        ? 'bg-gray-100 text-gray-600 hover:bg-red-50'
                        : key === 'available'
                          ? 'bg-gray-100 text-gray-600 hover:bg-green-50'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    {key === 'all' ? 'All' : key === 'shortage' ? 'Shortage' : key === 'available' ? 'Available' : key}
                  </button>
                ))}
                <select
                  value={itemsInvolvedProductFilter}
                  onChange={(e) => setItemsInvolvedProductFilter(e.target.value)}
                  className="px-3 py-1 rounded text-sm border border-gray-300 text-gray-700 bg-white"
                >
                  <option value="all">All Products</option>
                  {itemsInvolvedProductOptions.filter((p) => p !== 'all').map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search item, code, INCI..."
                  value={itemsInvolvedSearchTerm}
                  onChange={(e) => setItemsInvolvedSearchTerm(e.target.value)}
                  className="flex-1 outline-none text-sm border border-gray-200 rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                />
              </div>
            </div>

            {/* Items Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto w-full">
              {itemsInvolvedLoading && (
                <div className="p-8 text-center text-gray-500 text-sm">Loading items from confirmed BOMs…</div>
              )}
              {!itemsInvolvedLoading && itemsInvolved.length === 0 && (
                <div className="p-12 text-center border border-dashed border-gray-200 rounded-lg">
                  <div className="text-4xl mb-2">⧖</div>
                  <div className="font-semibold text-gray-700 mb-1">No confirmed batches</div>
                  <div className="text-sm text-gray-500">Confirm BOM in Plan Batches (PRs Extracted) to see RM/PM items here.</div>
                </div>
              )}
              {!itemsInvolvedLoading && itemsInvolved.length > 0 && filteredItemsInvolved.length === 0 && (
                <div className="p-8 text-center text-gray-500 text-sm border border-dashed border-gray-200 rounded-lg">
                  No items match the current filters or search. Try changing category, product, or search term.
                </div>
              )}
              {!itemsInvolvedLoading && itemsInvolved.length > 0 && filteredItemsInvolved.length > 0 && (
                <table className="w-full text-xs border-collapse min-w-[1120px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Item</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Category</th>
                      <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">Linked Batches</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">Qty Balance</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Pipeline stage</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Procurement &amp; PO</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Last update</th>
                      <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItemsInvolved.map((item, idx) => (
                      (() => {
                        // Release when still short vs full TOTAL REQ (netNum) or vs batch-unallocated supply (planned shortfall).
                        const hasShortfall = item.netNum < 0;
                        const supplyTowardGross = Number(item.supplyTowardGrossNum ?? 0);
                        const grossReq = Number(item.totalRequired || 0);
                        const hasPlannedShortfall = grossReq > 0 && supplyTowardGross < grossReq;
                        const hasExistingPlannedLine = hasPlannedLineForItem(item);
                        const gapNeed = Math.max(0, grossReq - supplyTowardGross);
                        const releasedTowardGap = releasedQtyTowardPlanningGap(
                          item,
                          procurementRequests,
                          plannedLinesFromBackend
                        );
                        // gapNeed already uses supply (incl. planned from prior releases). Do not subtract releasedTowardGap again — that double-counted and hid further release until refresh.
                        const releasedAgainstNeed =
                          gapNeed > 0 ? Math.min(releasedTowardGap, grossReq) : releasedTowardGap;
                        const overReleasedQty = Math.max(0, releasedTowardGap - grossReq);
                        const shortageForRelease = hasShortfall || hasPlannedShortfall;
                        const canReleaseToPlanning = shortageForRelease && gapNeed > 1e-6;
                        const procurementDisp = getItemsInvolvedProcurementDisplay(
                          item,
                          procurementRequests,
                          plannedLinesFromBackend
                        );
                        const cs = procurementDisp.currentStatus;
                        const lc = procurementDisp.latestComment;
                        const quotationAskUi = getPlanningQuotationAskUiStatus(
                          planningQuotationAsks,
                          {
                            itemType: item.itemType,
                            code: item.code,
                            name: item.name,
                            raw_material_id: item.raw_material_id,
                            pack_material_id: item.pack_material_id,
                            planningExtractedIds: item.planningExtractedIds,
                            planningExtractedId: item.planningExtractedId,
                          },
                          seenPlanningQuotationAskIds
                        );
                        const quotationBtnClass =
                          quotationAskUi.status === 'fulfilled_unread'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                            : quotationAskUi.status === 'fulfilled_read'
                              ? 'border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50'
                              : quotationAskUi.status === 'pending'
                                ? 'border-amber-500 bg-amber-50 text-amber-900 hover:bg-amber-100'
                                : 'border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100';
                        const quotationBtnLabel =
                          quotationAskUi.status === 'fulfilled_unread'
                            ? 'Quotation ready'
                            : quotationAskUi.status === 'pending'
                              ? 'Quotation pending'
                              : 'Request quotation';
                        const quotationBtnTitle =
                          quotationAskUi.status === 'fulfilled_unread'
                            ? 'Procurement recorded vendor rates on Items List — open to release procurement or request another quote.'
                            : quotationAskUi.status === 'pending'
                              ? 'Quotation requested — awaiting Procurement → Quotations.'
                              : quotationAskUi.status === 'fulfilled_read'
                                ? 'Quotation was recorded earlier — open to release procurement or request another quote.'
                                : 'Ask Procurement to quote this material — optional new vendor or MOQ even when rates already exist on Items List.';
                        return (
                          <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-2 py-2 min-w-[220px]">
                              <div className="flex items-start gap-1.5">
                                {quotationAskUi.status === 'fulfilled_unread' ? (
                                  <span
                                    className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500"
                                    title="Quotation recorded on Items List"
                                    aria-hidden
                                  />
                                ) : null}
                                <div>
                                  <div className="text-gray-900 font-medium text-xs">{item.name}</div>
                                  <div className="text-xs text-gray-500">{item.code}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-2">
                              <span className={`text-xs font-semibold px-1 py-0.5 rounded ${item.itemType === 'PM'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-cyan-100 text-cyan-700'
                                }`}>
                                {item.itemType}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-center min-w-[110px]">
                              <button
                                type="button"
                                onClick={() => setUsedInModalItem(item)}
                                className="w-5 h-5 bg-pink-100 hover:bg-pink-200 rounded-full flex items-center justify-center mx-auto transition-colors"
                                title="Click to view batches using this item"
                              >
                                <span className="text-xs font-bold text-pink-700">{item.usedIn}</span>
                              </button>
                            </td>
                            <td className="px-2 py-2 text-right min-w-[220px] tabular-nums">
                              <div className="text-gray-900 text-xs font-semibold">Required {item.totalReq}</div>
                              <div className="text-[11px] text-gray-600 mt-0.5">SIH {item.sih} · Reserved {item.reserved}</div>
                              <div className="text-[11px] text-blue-700 mt-0.5">
                                Planned {item.plannedQty} · PO {item.poQtyStr} · In transit {item.inTransitQtyStr}
                              </div>
                              <div
                                className={`text-[11px] font-semibold mt-0.5 ${
                                  item.netNum < -1e-9 ? 'text-red-600' : 'text-emerald-700'
                                }`}
                              >
                                Short {item.shortStr}
                              </div>
                            </td>
                            <td className="px-2 py-2 min-w-[200px]">
                              <div className="text-[11px] font-semibold text-gray-900">{cs.title}</div>
                              <div className="text-[10px] text-gray-600 mt-0.5 leading-snug">{cs.detail}</div>
                              <span
                                className={`inline-flex mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${badgeToneClass(cs.badgeTone)}`}
                              >
                                {cs.badge}
                              </span>
                              <div className="flex flex-wrap gap-0.5 mt-1.5">
                                {cs.steps.map((s) => (
                                  <span
                                    key={s.label}
                                    className={`px-1 py-0.5 rounded text-[9px] font-medium border ${
                                      s.active
                                        ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                                        : s.done
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                          : 'bg-gray-50 text-gray-400 border-gray-100'
                                    }`}
                                    title={s.label}
                                  >
                                    {s.label}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-2 py-2 min-w-[220px]">
                              <div className="space-y-1">
                                {procurementDisp.poInfo.lines.map((line, li) => (
                                  <div key={li} className="text-[10px] text-gray-700 leading-snug">
                                    {line}
                                  </div>
                                ))}
                                <div className="text-[10px] text-gray-500 pt-0.5 border-t border-gray-100">
                                  Pipeline: PR {item.plannedQty} · PO bal {item.poQtyStr} · Transit{' '}
                                  {item.inTransitQtyStr} · WH {item.whQtyStr}
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-2 min-w-[220px]">
                              {lc ? (
                                <>
                                  <div className="text-[10px] text-gray-500">
                                    {lc.whenLabel} · {lc.source}
                                  </div>
                                  <div className="text-[11px] text-gray-800 mt-0.5 leading-snug line-clamp-3">
                                    {lc.text}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="text-[11px] text-gray-600">No PR/PO notes yet</div>
                                  <div className="text-[10px] text-gray-500 mt-0.5">
                                    WH lot {item.whBatches} · QC {item.status} · Exp {item.expiry}
                                  </div>
                                </>
                              )}
                            </td>
                            <td className="px-2 py-2 text-center min-w-[170px]">
                              <div className="flex flex-col items-center gap-1 min-w-[7rem]">
                                {shortageForRelease && releasedTowardGap > 1e-6 && (
                                  <span
                                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-200"
                                    title="Quantity already on Procurement / draft PO from Release to Planning."
                                  >
                                    Released {item.itemType === 'RM' || String(item.unit ?? '').toUpperCase() === 'KG'
                                      ? releasedAgainstNeed.toLocaleString(undefined, { maximumFractionDigits: 3 })
                                      : Math.round(releasedAgainstNeed).toLocaleString()}
                                    {gapNeed > 1e-6
                                      ? ` / need ${item.itemType === 'RM' || String(item.unit ?? '').toUpperCase() === 'KG'
                                        ? gapNeed.toLocaleString(undefined, { maximumFractionDigits: 3 })
                                        : Math.round(gapNeed).toLocaleString()}`
                                      : ''}
                                    {overReleasedQty > 1e-6
                                      ? ` (over +${item.itemType === 'RM' || String(item.unit ?? '').toUpperCase() === 'KG'
                                        ? overReleasedQty.toLocaleString(undefined, { maximumFractionDigits: 3 })
                                        : Math.round(overReleasedQty).toLocaleString()})`
                                      : ''}
                                  </span>
                                )}
                                {hasShortfall && hasExistingPlannedLine && gapNeed > 1e-6 && (
                                  <span
                                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200"
                                    title="Open procurement / draft PO lines exist; you can release more until the gap is covered."
                                  >
                                    Partial release
                                  </span>
                                )}
                                {canReleaseToPlanning ? (
                                  <>
                                    <span
                                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-800 border border-red-200"
                                      title="Open gap vs TOTAL REQ after SIH + planned + PO + in-transit."
                                    >
                                      Shortage{' '}
                                      {item.itemType === 'RM' || String(item.unit ?? '').toUpperCase() === 'KG'
                                        ? gapNeed.toLocaleString(undefined, { maximumFractionDigits: 3 })
                                        : Math.round(gapNeed).toLocaleString()}
                                    </span>
                                    <button
                                      type="button"
                                      className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold w-full"
                                      onClick={() => openReleaseToPlanningModal(item)}
                                    >
                                      Release to Planning
                                    </button>
                                  </>
                                ) : shortageForRelease ? (
                                  <span
                                    className="inline-flex items-center px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200 w-full justify-center"
                                    title={`Supply (incl. planned + PO + in-transit) meets TOTAL REQ — no open gap (${gapNeed.toLocaleString()} remaining).`}
                                  >
                                    Covered
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-600 text-[11px] font-semibold border border-slate-200 w-full justify-center"
                                    title="Planning fulfilled — no open shortage vs TOTAL REQ."
                                  >
                                    No shortage
                                  </span>
                                )}
                                <button
                                  type="button"
                                  className={`relative px-2 py-1 rounded border text-[11px] font-semibold w-full ${quotationBtnClass}`}
                                  title={quotationBtnTitle}
                                  onClick={() => openRequestQuotationModalForItem(item)}
                                >
                                  {quotationAskUi.status === 'fulfilled_unread' ? (
                                    <span
                                      className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"
                                      title="New quotation on Items List"
                                      aria-hidden
                                    />
                                  ) : null}
                                  {quotationAskUi.status === 'pending' ? (
                                    <span
                                      className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white"
                                      title="Quotation requested"
                                      aria-hidden
                                    />
                                  ) : null}
                                  {quotationBtnLabel}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })()
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Batches Tab — list all batches we've sent out (batch code, SO, product, sent status, BOM summary) */}
        {activeMainTab === 'batches' && (
          <PlanningBatchesTab onBatchClick={setBatchForDetailModal} dateFilter={dateFilter} />
        )}

      </div>

      {/* Used In popup: list all batches (sent + draft) that consume selected RM/PM */}
      {usedInModalItem && (() => {
        const rows = getUsedInBatchesForItem(usedInModalItem);
        return (
          <div className="fixed inset-0 z-95 bg-black/35 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-xl shadow-xl border border-gray-200 max-h-[85vh] overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Batches using {usedInModalItem.code}</h3>
                  <p className="text-xs text-gray-500 mt-1">{usedInModalItem.name} ({usedInModalItem.itemType})</p>
                </div>
                <button
                  type="button"
                  onClick={() => setUsedInModalItem(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 overflow-auto max-h-[70vh]">
                {rows.length === 0 ? (
                  <div className="text-sm text-gray-500 p-6 text-center">No batches found for this item.</div>
                ) : (
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Batch Code</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">SO</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Product</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700">Batch Size</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700">Required ({usedInModalItem.unit})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => (
                        <tr key={`${row.id}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2 text-gray-900">{row.batchCode ?? `B-${idx + 1}`}</td>
                          <td className="px-3 py-2 text-gray-700">{row.soNumber ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-700">{row.productName ?? row.productCode ?? '—'}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{(Number(row.sizeKg) || 0).toLocaleString()} KG</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-900">
                            {Math.round(getItemRequiredInBatch(usedInModalItem, row)).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Release to Planned modal */}
      {releaseToPlanningItem && (() => {
        const item = releaseToPlanningItem;
        const isQuotationOnlyModal = releaseModalIntent === 'quotation';
        const slabs = getQuotationSlabsForItem(item);
        const previous = plannedLinesFromBackend
          .filter((l) => plannedLineCountsTowardItemRelease(l, item))
          .slice(0, 10);
        const availModal = Number(item.supplyTowardGrossNum ?? 0);
        const grossReqModal = Number(item.totalRequired || 0);
        const gapNeedModal = Math.max(0, grossReqModal - availModal);
        const hasShortfallModal = item.netNum < 0;
        const hasPlannedShortfallModal = grossReqModal > 0 && availModal < grossReqModal;
        const shortageForReleaseModal = hasShortfallModal || hasPlannedShortfallModal;
        const canAddPlannedLineRelease = gapNeedModal > 1e-6;
        const releasedModal = releasedQtyTowardPlanningGap(item, procurementRequests, plannedLinesFromBackend);
        const qtyFmt = (n: number) => formatItemsInvolvedQty(n, item.itemType, item.unit);
        const prefillReleaseQtyFromGap = () => {
          if (gapNeedModal <= 1e-6) return;
          let qtyStr = '';
          if (item.itemType === 'RM') {
            const master = findRmMasterRecord(item.raw_material_id, item.code, rawMaterialsList);
            const proc = rmProcurementFieldsFromKg(gapNeedModal, master);
            qtyStr = formatItemsInvolvedQty(proc.quantity_requested, 'RM', proc.unit);
          } else {
            qtyStr = formatItemsInvolvedQty(gapNeedModal, item.itemType, item.unit);
          }
          setReleaseToPlanningForm((f) => ({ ...f, qty: qtyStr }));
        };
        const releasePtStages = resolveStagedPaymentTermsForForm(
          releaseToPlanningForm.paymentTermsRaw,
          releaseToPlanningForm.paymentTermsType,
          Number(releaseToPlanningForm.advancePercent)
        );
        const hasVendorSlabs = slabs.length > 0;
        const canRequestQuotation = Number(releaseToPlanningForm.qty || 0) > 0;
        const vendorNameKey = releaseToPlanningForm.vendorName.trim().toLowerCase();
        const selectedVendorPartyId = vendorNameKey
          ? vendorClientsList.find((v) => (v.name || '').trim().toLowerCase() === vendorNameKey)?.id ?? ''
          : '';
        const applyReleaseVendorInput = (name: string) => {
          const trimmed = name.trim();
          if (!trimmed) {
            setReleaseToPlanningForm((f) => ({ ...f, vendorName: '', vendorId: null, paymentTermsRaw: null }));
            return;
          }
          const slabMatch = slabs.find((s) => s.vendorName.trim().toLowerCase() === trimmed.toLowerCase());
          if (slabMatch) {
            const p = parsePaymentTermsString(slabMatch.paymentTerms || '');
            setReleaseToPlanningForm((f) => ({
              ...f,
              vendorName: trimmed,
              vendorId: slabMatch.vendorId,
              moq: slabMatch.moq,
              unitPrice: isQuotationOnlyModal ? '' : String(slabMatch.unitPrice),
              paymentTermsType: p.type,
              advancePercent: String(
                p.advancePercent ||
                (paymentTermsTypeRequiresAdvancePercent(p.type) ? 50 : 0)
              ),
              leadTimeDays: slabMatch.leadTimeDays,
              paymentTermsRaw: String(slabMatch.paymentTerms || '').trim() || null,
            }));
            return;
          }
          const masterMatch = vendorClientsList.find(
            (v) => (v.name || '').trim().toLowerCase() === trimmed.toLowerCase(),
          );
          if (masterMatch) {
            const masterTerms = parsePaymentTermsString(masterMatch.paymentTerms || '');
            const masterLead = parseInt(String(masterMatch.leadTime || ''), 10);
            const masterId = parseInt(String(masterMatch.id), 10);
            setReleaseToPlanningForm((f) => ({
              ...f,
              vendorName: trimmed,
              vendorId: Number.isFinite(masterId) ? masterId : null,
              paymentTermsType: masterTerms.type,
              advancePercent: String(
                masterTerms.advancePercent ||
                (paymentTermsTypeRequiresAdvancePercent(masterTerms.type) ? 50 : 0)
              ),
              leadTimeDays: Number.isFinite(masterLead) ? masterLead : f.leadTimeDays,
              paymentTermsRaw: String(masterMatch.paymentTerms || '').trim() || null,
              ...(isQuotationOnlyModal ? { unitPrice: '' } : {}),
            }));
            return;
          }
          setReleaseToPlanningForm((f) => ({
            ...f,
            vendorName: trimmed,
            vendorId: null,
            paymentTermsRaw: null,
            ...(isQuotationOnlyModal ? { unitPrice: '' } : {}),
          }));
        };
        const closeReleaseModal = () => {
          setReleaseToPlanningItem(null);
          setReleaseModalIntent('release');
        };
        const applyVendorSlabPick = (s: (typeof slabs)[number]) => {
          const p = parsePaymentTermsString(s.paymentTerms || '');
          setReleaseToPlanningForm((f) => ({
            ...f,
            vendorId: s.vendorId,
            vendorName: s.vendorName,
            moq: s.moq,
            unitPrice: String(s.unitPrice),
            paymentTermsType: p.type,
            advancePercent: String(
              p.advancePercent ||
              (paymentTermsTypeRequiresAdvancePercent(p.type) ? 50 : 0)
            ),
            leadTimeDays: s.leadTimeDays,
            paymentTermsRaw: String(s.paymentTerms || '').trim() || null,
          }));
        };

        return (
          <div className="fixed inset-0 z-95 bg-black/35 flex items-end sm:items-center justify-center p-2 sm:p-4">
            <div className="bg-white w-full max-w-6xl rounded-xl shadow-xl border border-gray-200 max-h-[min(92vh,100dvh)] overflow-hidden flex flex-col">
              <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-gray-200 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 pr-2">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                    {isQuotationOnlyModal ? 'Request vendor quotation' : 'Release to PO Planned Stage'}
                  </h2>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {isQuotationOnlyModal
                      ? 'Sends a quote request to Procurement → Quotations only. Does not change Items Involved planned qty, NET, or shortages.'
                      : 'Pick vendor & MOQ price, choose qty, set payment terms. Add Planned Line updates procurement release; Request quotation does not.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeReleaseModal}
                  className="shrink-0 self-end sm:self-start px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
              <div className="p-3 sm:p-5 overflow-auto min-h-0">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 xl:gap-5">
                  <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm min-w-0">
                    <h3 className="font-bold text-slate-900 text-sm leading-snug break-words" title={item.name}>
                      {item.name}
                    </h3>
                    <p className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 inline-block mt-1.5 break-all">
                      {item.code}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2.5 mb-3">
                      <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                        {item.itemType} · {item.unit}
                      </span>
                      {isQuotationOnlyModal ? (
                        <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-900">
                          Qty for Procurement reference only
                        </span>
                      ) : (
                        <>
                          <span className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-900">
                            Gap {qtyFmt(gapNeedModal)}
                          </span>
                          <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700">
                            On PR / draft {qtyFmt(releasedModal)}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="border-t border-slate-200 my-3" />
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                      Items List rates
                    </p>
                    <ul className="space-y-2 2xl:hidden">
                      {slabs.map((s, i) => (
                        <li
                          key={`card-${s.vendorName}-${s.moq}-${s.unitPrice}-${i}`}
                          className="rounded-lg border border-slate-200 bg-slate-50/80 p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900 leading-snug break-words min-w-0">
                              {s.vendorName}
                            </p>
                            <button
                              type="button"
                              onClick={() => applyVendorSlabPick(s)}
                              className="shrink-0 px-2.5 py-1 rounded border border-cyan-400 text-cyan-700 text-[11px] font-semibold hover:bg-cyan-50"
                            >
                              Pick
                            </button>
                          </div>
                          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                            <div>
                              <dt className="text-slate-500">MOQ</dt>
                              <dd className="font-medium text-slate-800">{s.moq || '—'}</dd>
                            </div>
                            <div>
                              <dt className="text-slate-500">Unit price</dt>
                              <dd className="font-medium text-slate-800">₹{s.unitPrice.toLocaleString('en-IN')}</dd>
                            </div>
                            <div>
                              <dt className="text-slate-500">Lead time</dt>
                              <dd className="text-slate-800">{s.leadTimeDays}d</dd>
                            </div>
                            <div className="col-span-2">
                              <dt className="text-slate-500">Payment terms</dt>
                              <dd className="text-slate-700 leading-snug mt-0.5">
                                {formatStagedPaymentTermsSummary(s.paymentTerms)}
                              </dd>
                            </div>
                          </dl>
                        </li>
                      ))}
                      {slabs.length === 0 && (
                        <li className="rounded-lg border border-dashed border-slate-200 py-6 px-3 text-center">
                          <p className="text-slate-600 text-sm font-medium">No vendor rates on Items List</p>
                          <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                            Add vendor tiers under Procurement → Quotations (Items List), or request a quotation below
                            so Procurement can quote this material.
                          </p>
                        </li>
                      )}
                    </ul>
                    <div className="hidden 2xl:block overflow-x-auto -mx-1 px-1">
                      <table className="w-full min-w-[36rem] text-xs">
                        <thead>
                          <tr className="text-slate-500 border-b border-slate-200">
                            <th className="text-left py-2 pr-2 font-medium">Vendor</th>
                            <th className="text-left py-2 pr-2 font-medium whitespace-nowrap">MOQ</th>
                            <th className="text-right py-2 pr-2 font-medium whitespace-nowrap">Unit ₹</th>
                            <th className="text-right py-2 pr-2 font-medium whitespace-nowrap">Lead</th>
                            <th className="text-left py-2 pr-2 font-medium min-w-[9rem]">Terms</th>
                            <th className="w-14 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {slabs.map((s, i) => (
                            <tr key={`${s.vendorName}-${s.moq}-${s.unitPrice}-${i}`} className="border-b border-slate-100">
                              <td className="py-2 pr-2 font-medium text-slate-900 align-top break-words max-w-[10rem]">
                                {s.vendorName}
                              </td>
                              <td className="py-2 pr-2 text-slate-700 whitespace-nowrap align-top">{s.moq || '—'}</td>
                              <td className="py-2 pr-2 text-right font-medium whitespace-nowrap align-top">
                                ₹{s.unitPrice.toLocaleString('en-IN')}
                              </td>
                              <td className="py-2 pr-2 text-right text-slate-700 whitespace-nowrap align-top">
                                {s.leadTimeDays}d
                              </td>
                              <td className="py-2 pr-2 text-slate-600 text-[11px] leading-snug align-top">
                                {formatStagedPaymentTermsSummary(s.paymentTerms)}
                              </td>
                              <td className="py-2 align-top">
                                <button
                                  type="button"
                                  onClick={() => applyVendorSlabPick(s)}
                                  className="px-2 py-1 rounded border border-cyan-400 text-cyan-700 text-[10px] font-semibold hover:bg-cyan-50 whitespace-nowrap"
                                >
                                  Pick
                                </button>
                              </td>
                            </tr>
                          ))}
                          {slabs.length === 0 && (
                            <tr>
                              <td colSpan={6} className="py-4 text-center">
                                <p className="text-slate-600 text-sm font-medium">No vendor rates on Items List</p>
                                <p className="text-slate-500 text-xs mt-1 max-w-md mx-auto leading-relaxed">
                                  Add vendor tiers under Procurement → Quotations (Items List), or request a quotation below
                                  so Procurement can quote this material.
                                </p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {hasVendorSlabs ? (
                      <p className="text-xs text-slate-500 mt-2">Pick a slab or select manually.</p>
                    ) : (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                        <p className="text-xs font-semibold text-amber-900">No vendor on Items List</p>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          <span className="font-semibold">Request quotation</span> sends a quote ask to Procurement → Quotations
                          only. It does not add planned qty or change Items Involved NET until Procurement records a vendor rate.
                          {gapNeedModal > 1e-6
                            ? ` Open gap vs demand: ${qtyFmt(gapNeedModal)} — after quotes exist, use Add Planned Line or Release to Planning from the table.`
                            : ' Stock/pipeline may already cover BOM demand; you can still request a quote for future POs.'}
                        </p>
                      </div>
                    )}
                    {hasVendorSlabs && (
                      <p className="text-[11px] text-slate-500 mt-2">
                        No suitable vendor? Enter qty and use <span className="font-medium">Request quotation</span> (Procurement
                        only — does not change planned qty). Use <span className="font-medium">Add Planned Line</span> after rates exist.
                      </p>
                    )}
                  </div>
                  <div className={`rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm min-w-0 ${isQuotationOnlyModal ? 'xl:col-span-2' : ''}`}>
                    <h3 className="font-bold text-slate-900 text-sm mb-3">
                      {isQuotationOnlyModal ? 'Quotation request' : 'Planned line details'}
                    </h3>
                    {!isQuotationOnlyModal && (
                      <div
                        className={`mb-3 rounded-lg border px-3 py-2.5 ${
                          canAddPlannedLineRelease
                            ? 'border-red-200 bg-red-50'
                            : shortageForReleaseModal
                              ? 'border-emerald-200 bg-emerald-50'
                              : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        {canAddPlannedLineRelease ? (
                          <>
                            <p className="text-xs font-semibold text-red-900">Open shortage for release</p>
                            <p className="text-[11px] text-red-800 mt-0.5">
                              Gap vs TOTAL REQ (after SIH + planned + PO + in-transit):{' '}
                              <span className="font-bold">{qtyFmt(gapNeedModal)}</span>
                              {releasedModal > 1e-6 ? (
                                <>
                                  {' '}
                                  · Already on PR / draft PO: <span className="font-semibold">{qtyFmt(releasedModal)}</span>
                                </>
                              ) : null}
                            </p>
                          </>
                        ) : shortageForReleaseModal ? (
                          <p className="text-xs font-semibold text-emerald-800">
                            Supply covers TOTAL REQ — no open release gap. Use Request quotation if you only need vendor
                            rates.
                          </p>
                        ) : (
                          <p className="text-xs font-semibold text-slate-700">No BOM shortage for this item.</p>
                        )}
                      </div>
                    )}
                    <div
                      className={`grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 ${isQuotationOnlyModal ? 'xl:max-w-2xl' : ''}`}
                    >
                      <div className="min-w-0">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                          {isQuotationOnlyModal ? 'Vendor to quote (optional)' : 'Vendor'}
                        </label>
                        <VendorClientNameTypeahead
                          parties={vendorClientsList}
                          selectedId={selectedVendorPartyId}
                          loading={vendorClientsLoading}
                          allowFreeText
                          freeTextValue={releaseToPlanningForm.vendorName}
                          onFreeTextChange={applyReleaseVendorInput}
                          onSelect={(party) => {
                            if (party) applyReleaseVendorInput(party.name ?? '');
                            else applyReleaseVendorInput('');
                          }}
                          partyKind="vendor"
                          placeholder={
                            isQuotationOnlyModal
                              ? 'Search vendor name or type new…'
                              : 'Search vendor from master…'
                          }
                          className="[&_input]:rounded-lg [&_input]:border-slate-300 [&_input]:px-2 [&_input]:py-1.5 [&_input]:text-sm"
                        />
                        {isQuotationOnlyModal ? (
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Search all vendors from Vendor Master, or type a new name for Procurement to quote.
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Search vendors from Vendor Master. Items List rates still auto-fill MOQ and price when available.
                          </p>
                        )}
                      </div>
                      <div className="min-w-0">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                          {isQuotationOnlyModal ? 'Target MOQ (optional)' : 'MOQ'}
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={releaseToPlanningForm.moq || ''}
                          onChange={(e) => setReleaseToPlanningForm((f) => ({ ...f, moq: Number(e.target.value || 0) }))}
                          placeholder={isQuotationOnlyModal ? 'e.g. new tier' : undefined}
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                    <div
                      className={`grid gap-3 mb-3 ${
                        isQuotationOnlyModal ? 'grid-cols-1 sm:max-w-sm' : 'grid-cols-1 sm:grid-cols-2'
                      }`}
                    >
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                          {isQuotationOnlyModal ? 'Quantity to quote' : 'Quantity'}
                          {releaseToPlanningItem?.itemType === 'RM'
                            ? procurementUnitSuffix(
                                findRmMasterRecord(
                                  releaseToPlanningItem.raw_material_id,
                                  releaseToPlanningItem.code,
                                  rawMaterialsList
                                )?.uom
                              )
                            : releaseToPlanningItem?.itemType === 'PM'
                              ? ' (pcs)'
                              : ''}
                        </label>
                        <input type="number" min={0} value={releaseToPlanningForm.qty} onChange={(e) => setReleaseToPlanningForm((f) => ({ ...f, qty: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                        {isQuotationOnlyModal ? (
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Qty for Procurement reference — NET, planned qty, and shortages stay unchanged. Add vendor / MOQ
                            above when quoting a new tier.
                          </p>
                        ) : releaseToPlanningItem?.itemType === 'RM' ? (
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Items Involved totals stay in kg; PO/procurement uses this RM&apos;s primary unit.
                          </p>
                        ) : null}
                      </div>
                      {!isQuotationOnlyModal && (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Unit price (₹)</label>
                        <input type="number" min={0} value={releaseToPlanningForm.unitPrice} onChange={(e) => setReleaseToPlanningForm((f) => ({ ...f, unitPrice: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                      </div>
                      )}
                    </div>
                    {!isQuotationOnlyModal && (
                    <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div className="min-w-0">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Payment terms (type)</label>
                        <select
                          value={releaseToPlanningForm.paymentTermsType}
                          onChange={(e) =>
                            setReleaseToPlanningForm((f) => ({
                              ...f,
                              paymentTermsType: e.target.value as PaymentTermsStructuredType,
                              paymentTermsRaw: null,
                            }))
                          }
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        >
                          {PAYMENT_TERMS_TYPE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Lead time</label>
                        <div className="py-1.5 text-sm font-medium text-slate-800">{releaseToPlanningForm.leadTimeDays} days</div>
                      </div>
                    </div>
                    {paymentTermsTypeRequiresAdvancePercent(releaseToPlanningForm.paymentTermsType) && (
                      <div className="mb-3">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Advance %</label>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={releaseToPlanningForm.advancePercent}
                          onChange={(e) =>
                            setReleaseToPlanningForm((f) => ({
                              ...f,
                              advancePercent: e.target.value,
                              paymentTermsRaw: null,
                            }))
                          }
                          className="w-full max-w-xs rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                    )}
                    <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                        Payment split (advance · pre-shipment · post-shipment)
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        <div>
                          <div className="text-[10px] text-slate-500">Advance</div>
                          <div className="text-sm font-semibold text-slate-900">{releasePtStages.advance_pct}%</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500">Pre-shipment</div>
                          <div className="text-sm font-semibold text-slate-900">{releasePtStages.pre_shipment_pct}%</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500">Post-shipment</div>
                          <div className="text-sm font-semibold text-slate-900">{releasePtStages.post_shipment_pct}%</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500">Credit</div>
                          <div className="text-sm font-semibold text-slate-900">
                            {releasePtStages.credit_days > 0 ? `Net ${releasePtStages.credit_days}d` : '—'}
                          </div>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-2">{formatStagedPaymentTermsObject(releasePtStages)}</p>
                    </div>
                    </>
                    )}
                    {!isQuotationOnlyModal && canAddPlannedLineRelease && (
                      <div className="flex gap-2 mb-3">
                        <button
                          type="button"
                          onClick={prefillReleaseQtyFromGap}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                        >
                          Prefill qty = Gap ({qtyFmt(gapNeedModal)})
                        </button>
                      </div>
                    )}
                    {!isQuotationOnlyModal && (
                    <>
                    <div className="border-t border-slate-200 my-3" />
                    <h3 className="font-bold text-slate-900 text-sm mb-2">Previous purchases</h3>
                    <div className="overflow-x-auto -mx-1 px-1">
                    <table className="w-full min-w-[20rem] text-xs">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-200">
                          <th className="text-left py-1 pr-2 font-medium whitespace-nowrap">Date</th>
                          <th className="text-left py-1 pr-2 font-medium">Vendor</th>
                          <th className="text-right py-1 pr-2 font-medium whitespace-nowrap">Qty</th>
                          <th className="text-right py-1 pr-2 font-medium whitespace-nowrap">Unit ₹</th>
                          <th className="text-right py-1 font-medium w-14">Pick</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previous.map((r, i) => (
                          <tr key={`${r.createdAt}-${i}`} className="border-b border-slate-100">
                            <td className="py-1.5 pr-2 text-slate-700 whitespace-nowrap align-top">{new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                            <td className="py-1.5 pr-2 text-slate-700 align-top break-words max-w-[8rem] sm:max-w-none">{r.vendorName}</td>
                            <td className="py-1.5 pr-2 text-right text-slate-700 whitespace-nowrap align-top">{r.qty} <span className="text-slate-500">{r.unit}</span></td>
                            <td className="py-1.5 pr-2 text-right font-medium whitespace-nowrap align-top">₹{r.unitPrice.toLocaleString('en-IN')}</td>
                            <td className="py-1.5 text-right align-top">
                              <button
                                type="button"
                                onClick={() => {
                                  const p = parsePaymentTermsString(r.paymentTerms || '');
                                  setReleaseToPlanningForm((f) => ({
                                    ...f,
                                    vendorId: r.vendorId,
                                    vendorName: r.vendorName,
                                    moq: r.moq,
                                    qty: String(r.qty),
                                    unitPrice: String(r.unitPrice),
                                    paymentTermsType: p.type,
                                    advancePercent: String(
                                      p.advancePercent ||
                                      (paymentTermsTypeRequiresAdvancePercent(p.type) ? 50 : 0)
                                    ),
                                    leadTimeDays: r.leadTimeDays,
                                    paymentTermsRaw: String(r.paymentTerms || '').trim() || null,
                                  }));
                                }}
                                className="px-2 py-1 rounded border border-cyan-400 text-cyan-700 text-[10px] font-semibold hover:bg-cyan-50"
                              >
                                Pick
                              </button>
                            </td>
                          </tr>
                        ))}
                        {purchaseOrdersLoading && (
                          <tr>
                            <td colSpan={5} className="py-3 text-center text-slate-500">
                              Loading previous picks...
                            </td>
                          </tr>
                        )}
                        {!purchaseOrdersLoading && previous.length === 0 && (
                          <tr><td colSpan={5} className="py-3 text-center text-slate-500">No previous picks for this item.</td></tr>
                        )}
                      </tbody>
                    </table>
                    </div>
                    </>
                    )}
                  </div>
                </div>
              </div>
              <div className="px-3 sm:px-5 py-3 border-t border-slate-200 bg-slate-50 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500 leading-relaxed min-w-0">
                  {isQuotationOnlyModal
                    ? 'Sends a reminder to Procurement → Quotations only (no procurement request). After rates are recorded, use Release to Planning → Add Planned Line.'
                    : hasVendorSlabs
                      ? 'Add Planned Line updates planned release. Request quotation reminds Procurement to add vendor/MOQ on Items List (no PR).'
                      : 'Request quotation reminds Procurement → Quotations (no procurement request or planning qty change).'}
                </p>
                <div className="flex flex-wrap gap-2 justify-stretch sm:justify-end shrink-0">
                  <button
                    type="button"
                    onClick={closeReleaseModal}
                    className="flex-1 sm:flex-none px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={releaseToPlanningSaving || !canRequestQuotation}
                    title={!canRequestQuotation ? 'Enter quantity first' : undefined}
                    onClick={async () => {
                      setReleaseToPlanningSaving(true);
                      try {
                        const ok = await requestQuotationForPlanningItem();
                        if (ok) closeReleaseModal();
                      } finally {
                        setReleaseToPlanningSaving(false);
                      }
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 ${
                      isQuotationOnlyModal || !hasVendorSlabs
                        ? 'bg-amber-600 text-white hover:bg-amber-700'
                        : 'border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                    }`}
                  >
                    {releaseToPlanningSaving ? 'Sending…' : 'Request quotation'}
                  </button>
                  {!isQuotationOnlyModal && hasVendorSlabs && (
                    <button
                      type="button"
                      disabled={
                        releaseToPlanningSaving ||
                        !canAddPlannedLineRelease ||
                        !releaseToPlanningForm.vendorName ||
                        !canRequestQuotation ||
                        !(Number(releaseToPlanningForm.unitPrice || 0) > 0)
                      }
                      title={
                        !canAddPlannedLineRelease
                          ? 'No open shortage vs TOTAL REQ — nothing to release to Planning'
                          : undefined
                      }
                      onClick={async () => {
                        setReleaseToPlanningSaving(true);
                        try {
                          const ok = await addPlannedLine();
                          if (ok) closeReleaseModal();
                        } finally {
                          setReleaseToPlanningSaving(false);
                        }
                      }}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Add Planned Line
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Batch detail modal: items with SIH, Reserved, Available, Shortfall, PR per row (PR raised against batch id) */}
      {batchForDetailModal && (() => {
        const batch = batchForDetailModal;
        const sizeKg = Number(batch.sizeKg) || 0;
        const orderQtyNum = parseInt(String(batch.orderQty || '0').replace(/\D/g, ''), 10) || 0;
        const totalKg = parseFloat(String(batch.totalKg || '0').replace(/[^\d.]/g, '')) || 0;
        const kgPerUnit = orderQtyNum > 0 && totalKg > 0 ? totalKg / orderQtyNum : 1;
        const unitsForBatch = kgPerUnit > 0 ? sizeKg / kgPerUnit : 0;
        const rmByCode = new Map(rawMaterialsList.map((r) => [r.code?.toLowerCase() ?? '', r]));
        const pmByCode = new Map(packMaterialsList.map((p) => [p.code?.toLowerCase() ?? '', p]));
        type BatchDetailRow = { id: string; type: 'RM' | 'PM'; name: string; code: string; required: number; unit: string; sih: number; reserved: number; available: number; shortfall: number; raw_material_id?: number; pack_material_id?: number };
        const rows: BatchDetailRow[] = [];
        (batch.rmLines || []).forEach((line: BatchRmLine, idx: number) => {
          const code = line.rm_code || (line as { code?: string }).code || '';
          const rm = rmByCode.get(code.toLowerCase()) ?? rawMaterialsList.find((r) => r.code === code || r.name === (line.inci_name ?? (line as { name?: string }).name));
          const raw_material_id = rm?.id != null ? Number(rm.id) : undefined;
          const pct = line.pct_w_w ?? (line as { pct?: number }).pct ?? 0;
          const required = (sizeKg * pct) / 100;
          const lineSg = parseSpecificGravity(specificGravityFromBomLine(line as BOMRmLine));
          const wh = warehouseRows.find((w) => w.type === 'RM' && (Number(w.sourceId) === Number(raw_material_id) || w.code === code));
          const sih = warehouseQtyToKg(wh?.stockInHand ?? 0, wh, rm, lineSg);
          const reserved = warehouseQtyToKg(wh?.reserved ?? 0, wh, rm, lineSg);
          const available = Math.max(0, sih - reserved);
          const shortfall = Math.max(0, required - available);
          rows.push({
            id: `rm-${raw_material_id ?? code}-${idx}`,
            type: 'RM',
            name: line.inci_name ?? (line as { name?: string }).name ?? rm?.name ?? code,
            code: code || String(raw_material_id ?? ''),
            required,
            unit: line.uom ?? 'KG',
            sih,
            reserved,
            available,
            shortfall,
            raw_material_id: raw_material_id ?? undefined,
          });
        });
        (batch.pmLines || []).forEach((line: BatchPmLine, idx: number) => {
          const code = line.pm_code || (line as { code?: string }).code || '';
          const pm = pmByCode.get(code.toLowerCase()) ?? packMaterialsList.find((p) => p.code === code || p.description === (line.description ?? (line as { name?: string }).name));
          const pack_material_id = pm?.id != null ? Number(pm.id) : undefined;
          const qtyPerUnit = line.qty_per_unit ?? (line as { qty?: number }).qty ?? 1;
          const required = Math.ceil(unitsForBatch * qtyPerUnit);
          const wh = warehouseRows.find((w) => w.type === 'PM' && (Number(w.sourceId) === Number(pack_material_id) || w.code === code));
          const sih = wh?.stockInHand ?? 0;
          const reserved = wh?.reserved ?? 0;
          const available = Math.max(0, sih - reserved);
          const shortfall = Math.max(0, required - available);
          rows.push({
            id: `pm-${pack_material_id ?? code}-${idx}`,
            type: 'PM',
            name: line.description ?? (line as { name?: string }).name ?? pm?.description ?? code,
            code: code || String(pack_material_id ?? ''),
            required,
            unit: 'PCS',
            sih,
            reserved,
            available,
            shortfall,
            pack_material_id: pack_material_id ?? undefined,
          });
        });
        return (
          <div className="fixed inset-0 backdrop-blur-md bg-black/30 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl my-8">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">
                  Batch — {batch.batchCode ?? `PE-${batch.planningExtractedId}-B${batch.sequence}`}
                </h3>
                <button type="button" onClick={() => setBatchForDetailModal(null)} className="text-gray-500 hover:text-gray-700">
                  <X size={20} />
                </button>
              </div>
              <p className="px-4 pt-2 text-xs text-gray-600">
                {batch.productName ?? batch.productCode ?? '—'} · SO {batch.soNumber ?? '—'} · Size {sizeKg} kg.
              </p>
              <div className="p-4 overflow-x-auto max-h-[70vh]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Item / Code</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-700">Type</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Required</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Stock in hand</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Reserved</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Available</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Shortfall</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-b border-gray-100">
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-900">{row.name}</div>
                          <div className="text-xs text-gray-500">{row.code}</div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${row.type === 'RM' ? 'bg-cyan-100 text-cyan-700' : 'bg-orange-100 text-orange-700'}`}>{row.type}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-gray-900">{row.required.toLocaleString(undefined, { maximumFractionDigits: 2 })} {row.unit}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-700">{row.sih.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-600">{row.reserved.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-700">{row.available.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold">{row.shortfall > 0 ? <span className="text-red-600">{row.shortfall.toLocaleString()}</span> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length === 0 && (
                  <div className="py-8 text-center text-gray-500 text-sm">No RM/PM lines in this batch.</div>
                )}
              </div>
              {(() => {
                const allShortfallResolved = rows.length > 0 && rows.every((r) => r.shortfall <= 0);
                // const alreadySent = Boolean(batch.sent);
                // if (alreadySent) {
                //   return (
                //     <div className="px-4 py-3 border-t border-gray-200 bg-emerald-50 flex items-center justify-between">
                //       <span className="text-sm font-medium text-emerald-800">Sent to production — can be scheduled in Production → Calendar.</span>
                //       <button type="button" onClick={() => setBatchForDetailModal(null)} className="px-3 py-1.5 text-sm font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
                //     </div>
                //   );
                // }
                if (allShortfallResolved) {
                  return (
                    <div className="px-4 py-3 border-t border-gray-200 bg-amber-50 flex items-center justify-between gap-3">
                      <span className="text-sm text-amber-800">All materials available. Send this batch to production to allow scheduling in Production → Calendar.</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSendToProductionConfirm({ source: 'batch-detail', batch });
                          }}
                          className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 shadow-sm"
                        >
                          Send To Production
                        </button>
                        <button type="button" onClick={() => setBatchForDetailModal(null)} className="px-3 py-1.5 text-sm font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
                    <button type="button" onClick={() => setBatchForDetailModal(null)} className="px-3 py-1.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Close</button>
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })()}

      {/* Send planned batch → confirm, then success */}
      {sendToProductionConfirm && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/40 flex items-center justify-center z-[62] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-gray-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Send batch to Production?</h3>
              <button
                type="button"
                disabled={sendToProductionSending}
                onClick={() => setSendToProductionConfirm(null)}
                className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-3 text-sm text-gray-700">
              {sendToProductionConfirm.source === 'plan-modal' ? (
                <>
                  <p>
                    This will mark{' '}
                    <strong className="text-gray-900">
                      B-{String(sendToProductionConfirm.batchIndex + 1).padStart(2, '0')}
                    </strong>{' '}
                    as sent, update planning, and sync batches so Production can schedule it.
                  </p>
                  {selectedSOForBatch && (
                    <p className="text-xs text-gray-500">
                      SO {selectedSOForBatch.soNumber}
                      {selectedSOForBatch.productName ? ` · ${selectedSOForBatch.productName}` : ''}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p>
                    Send{' '}
                    <strong className="text-gray-900">
                      {sendToProductionConfirm.batch.batchCode ??
                        `PE-${sendToProductionConfirm.batch.planningExtractedId}-B${sendToProductionConfirm.batch.sequence}`}
                    </strong>{' '}
                    to Production?
                  </p>
                  <p className="text-xs text-gray-500">After this, open Production → Calendar to schedule the batch.</p>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200 bg-gray-50/80 rounded-b-xl">
              <button
                type="button"
                disabled={sendToProductionSending}
                onClick={() => setSendToProductionConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sendToProductionSending}
                onClick={() => void runConfirmedSendToProduction()}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
              >
                {sendToProductionSending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                    Sending…
                  </>
                ) : (
                  'Confirm & send'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {sendToProductionSuccess && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/40 flex items-center justify-center z-[63] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-gray-200 p-6 text-center">
            <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-3" strokeWidth={1.75} aria-hidden />
            <h3 className="text-lg font-bold text-gray-900">{sendToProductionSuccess.title}</h3>
            <p className="text-sm text-gray-600 mt-3 leading-relaxed">{sendToProductionSuccess.message}</p>
            <button
              type="button"
              onClick={() => setSendToProductionSuccess(null)}
              className="mt-6 w-full sm:w-auto px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Raise Procurement Request popup — confirm and send PR linked to batch id */}
      {batchPrModal && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/30 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Raise Procurement Request</h3>
              <button type="button" onClick={() => setBatchPrModal(null)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Batch</p>
                <p className="text-sm font-bold text-slate-900">{batchPrModal.batch.batchCode ?? `PE-${batchPrModal.batch.planningExtractedId}-B${batchPrModal.batch.sequence}`} <span className="text-slate-500 font-normal">(ID: {batchPrModal.batch.id})</span></p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Item</label>
                  <p className="text-sm text-gray-900">{batchPrModal.row.name}</p>
                  <p className="text-xs text-gray-500">{batchPrModal.row.code}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Shortfall</label>
                  <p className="text-sm font-mono text-gray-900">{batchPrModal.row.shortfall.toLocaleString(undefined, { maximumFractionDigits: 2 })} {batchPrModal.row.unit}</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Quantity to request</label>
                <input
                  type="number"
                  min={1}
                  step={batchPrModal.row.unit === 'KG' ? 0.01 : 1}
                  value={batchPrQty}
                  onChange={(e) => setBatchPrQty(batchPrModal.row.unit === 'KG' ? Math.max(0, parseFloat(e.target.value) || 0) : Math.max(1, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Priority</label>
                  <select value={batchPrPriority} onChange={(e) => setBatchPrPriority(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Required by</label>
                  <input type="date" value={batchPrRequiredBy} onChange={(e) => setBatchPrRequiredBy(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
                <textarea value={batchPrNotes} onChange={(e) => setBatchPrNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
              <button type="button" onClick={() => setBatchPrModal(null)} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200">
                Cancel
              </button>
              <button
                type="button"
                disabled={batchPrSending}
                onClick={async () => {
                  const { batch, row } = batchPrModal;
                  setBatchPrSending(true);
                  try {
                    const itemPayload: ProcurementRequestItem = {
                      type: row.type,
                      code: row.code,
                      name: row.name,
                      required: row.required,
                      sih: row.sih,
                      shortage: row.shortfall,
                      quantity_requested: batchPrQty,
                      unit: row.unit,
                      raw_material_id: row.raw_material_id,
                      pack_material_id: row.pack_material_id,
                    };
                    const result = await createProcurementRequest({
                      planningExtractedId: batch.planningExtractedId,
                      planningBatchId: batch.id,
                      priority: batchPrPriority,
                      requiredByDate: batchPrRequiredBy || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                      notes: batchPrNotes,
                      items: [itemPayload],
                    });
                    if (result.success) {
                      queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
                      queryClient.invalidateQueries({ queryKey: ['planning', 'items-involved'] });
                      queryClient.invalidateQueries({ queryKey: ['planning-extracted'] });
                      addToast('success', `PR raised for ${row.name} (batch ${batch.batchCode ?? batch.id})`);
                      setBatchPrModal(null);
                    } else {
                      addToast('error', typeof result.error === 'string' ? result.error : 'Failed to raise PR');
                    }
                  } catch (e) {
                    addToast('error', e instanceof Error ? e.message : 'Failed to raise PR');
                  } finally {
                    setBatchPrSending(false);
                  }
                }}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50"
              >
                {batchPrSending ? 'Sending...' : 'Send to Procurement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Batches & Confirm BOM Modal — global: opens from PIs Extracted (Plan Batches & Confirm BOM) or Availability Summary (Plan Batches) */}
      {planBatchesModalOpen && selectedSOForBatch && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/30 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Plan Batches — {selectedSOForBatch.productName}</h2>
                <p className="text-xs text-gray-500 mt-1">{selectedSOForBatch.soNumber} · {selectedSOForBatch.orderQty} · Total KG: {selectedSOForBatch.totalKg}</p>
                {planBatchesAllocationSummary && planBatchesAllocationSummary.orderTotalKg > 0 && (
                  <p className="text-xs text-slate-600 mt-1.5">
                    <span className="font-semibold text-slate-800">Pending to plan:</span>{' '}
                    {Number.isInteger(planBatchesAllocationSummary.pendUnits)
                      ? Math.round(planBatchesAllocationSummary.pendUnits).toLocaleString()
                      : planBatchesAllocationSummary.pendUnits.toFixed(1)}{' '}
                    units ({formatQtyExact(planBatchesAllocationSummary.pendKg, 'kg')} kg)
                    {' · '}
                    <span className="font-semibold">{planBatchesAllocationSummary.unsentCount}</span> batch
                    {planBatchesAllocationSummary.unsentCount !== 1 ? 'es' : ''} not sent
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setPlanBatchesModalOpen(false);
                  setSelectedSOForBatch(null);
                  setSelectedBatchId(null);
                  setIsReadyForProduction(false);
                  setSwapSourceIndex(null);
                  setCustomBatches([]);
                  setExpandedBatchIndex(null);
                  setActiveBatchTab('bom-editor');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Tabs */}
              <div className="flex gap-4 border-b border-gray-200">
                <button
                  type="button"
                  onClick={() => setActiveBatchTab('bom-editor')}
                  className={`px-4 py-2 text-sm font-semibold transition-colors ${activeBatchTab === 'bom-editor'
                    ? 'text-emerald-700 border-b-2 border-emerald-700'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  BOM Editor
                </button>

                <button
                  type="button"
                  onClick={() => setActiveBatchTab('batch-plan')}
                  className={`px-4 py-2 text-sm font-semibold transition-colors ${activeBatchTab === 'batch-plan'
                    ? 'text-emerald-700 border-b-2 border-emerald-700'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Batch Plan
                </button>
                <button
                  type="button"
                  onClick={() => setActiveBatchTab('swap-add')}
                  className={`px-4 py-2 text-sm font-semibold transition-colors ${activeBatchTab === 'swap-add'
                    ? 'text-emerald-700 border-b-2 border-emerald-700'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Swap
                </button>
              </div>

              {/* Working batch — single context for BOM Editor, Batch Plan, and Swap / Add */}
              <div className="flex items-center gap-2 flex-wrap py-3 -mx-6 px-6 border-b border-gray-100 bg-gray-50/50">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Working batch</span>
                <div className="flex items-center gap-1 border border-gray-300 rounded-lg bg-white overflow-hidden">
                  <select
                    value={selectedBatchId != null ? String(selectedBatchId) : ''}
                    onChange={(e) => {
                      const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                      setSelectedBatchId(Number.isNaN(v) ? null : v);
                    }}
                    className="min-w-[140px] px-3 py-2 text-sm font-medium text-gray-900 bg-transparent focus:outline-none focus:ring-0"
                  >
                    {planningBatches.length === 0 && (
                      <option value="">{selectedBatchId ? 'Loading...' : 'batch-01'}</option>
                    )}
                    {(planningBatches as PlanningBatchRow[]).map((b, idx) => (
                      <option key={b.id} value={String(b.id)}>
                        {b.batchCode ?? `batch-${String(idx + 1).padStart(2, '0')}`}
                      </option>
                    ))}
                    {selectedBatchId != null &&
                      !(planningBatches as PlanningBatchRow[]).some(
                        (b) => Number(b.id) === Number(selectedBatchId)
                      ) && (
                        <option value={String(selectedBatchId)}>Loading...</option>
                      )}
                  </select>
                  <button
                    type="button"
                    disabled={planningBatches.length > 0 && !canAddAnotherPlanningBatch}
                    onClick={async () => {
                      if (planningBatches.length > 0 && !canAddAnotherPlanningBatch) {
                        addToast('error', 'Send the latest batch to production before adding another.');
                        return;
                      }
                      try {
                        const newBatch = await addOneBatchFromMaster(planningIdForBatch);
                        if (newBatch) {
                          mergePlanningBatchIntoListCache(queryClient, planningIdForBatch, newBatch);
                          queryClient.invalidateQueries({ queryKey: ['planning-batches', planningIdForBatch] });
                          setSelectedBatchId(Number(newBatch.id));
                          addToast('success', `Added ${newBatch.batchCode ?? 'new batch'} (BOM from product master).`);
                        } else {
                          addToast('error', 'Failed to add batch');
                        }
                      } catch (e) {
                        console.error('[Planning] add planning batch', e);
                        addToast('error', e instanceof Error ? e.message : 'Failed to add batch');
                      }
                    }}
                    className="px-2 py-2 text-emerald-600 hover:bg-emerald-50 border-l border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    title={
                      planningBatches.length > 0 && !canAddAnotherPlanningBatch
                        ? 'Send the latest batch to production before adding another'
                        : 'Add new batch (BOM from product master)'
                    }
                  >
                    + Add
                  </button>
                </div>
                {selectedBatchId != null && (
                  <span className="text-xs text-gray-600">
                    <span className="font-mono font-semibold text-emerald-700">
                      B-{String(selectedBatchPlanSequence).padStart(2, '0')}
                    </span>
                    {' '}— Confirm BOM and Batch Plan apply to this batch only. Switch batch here to work on another.
                  </span>
                )}
              </div>

              {/* Tab Content */}
              {activeBatchTab === 'batch-plan' && (
                <div className="space-y-0">
                  {/* Availability bar — ORDER QTY, RM/PM COVERS, EXECUTABLE, STATUS */}
                  <div className="flex flex-wrap gap-5 items-center p-4 border-b border-gray-200 bg-gray-50/80">
                    <div className="flex-1 min-w-[140px]">
                      <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">ORDER QTY</div>
                      <div className="text-xl font-bold text-gray-900">
                        {orderQtyNum.toLocaleString()} <span className="text-gray-500 text-sm font-normal">units</span>
                      </div>
                    </div>
                    {planBatchesAllocationSummary && planBatchesAllocationSummary.orderTotalKg > 0 && (
                      <div className="flex-1 min-w-[130px]">
                        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">PENDING PLAN</div>
                        <div className={`text-lg font-bold ${planBatchesAllocationSummary.pendKg > 0.01 ? 'text-amber-700' : 'text-emerald-600'}`}>
                          {Number.isInteger(planBatchesAllocationSummary.pendUnits)
                            ? Math.round(planBatchesAllocationSummary.pendUnits).toLocaleString()
                            : planBatchesAllocationSummary.pendUnits.toFixed(1)}{' '}
                          <span className="text-gray-500 text-xs font-normal">units</span>
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {planBatchesAllocationSummary.pendKg.toFixed(1)} kg left
                          {planBatchesAllocationSummary.unsentCount > 0
                            ? ` · ${planBatchesAllocationSummary.unsentCount} unsent`
                            : ''}
                        </div>
                      </div>
                    )}
                    <div className="flex-1 min-w-[120px]">
                      <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">RM COVERS</div>
                      <div className={`text-lg font-bold ${feasibilityRmCoversUnits >= orderQtyNum ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {Math.round(feasibilityRmCoversUnits).toLocaleString()} <span className="text-gray-500 text-xs font-normal">units</span>
                      </div>
                      <div className="text-[10px] text-gray-500">{feasibilityRmRows.length} RM item{feasibilityRmRows.length !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">PM COVERS</div>
                      <div className={`text-lg font-bold ${feasibilityPmCoversUnits >= orderQtyNum ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {Math.round(feasibilityPmCoversUnits).toLocaleString()} <span className="text-gray-500 text-xs font-normal">units</span>
                      </div>
                      <div className="text-[10px] text-gray-500">{feasibilityPmRows.length} PM item{feasibilityPmRows.length !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">EXECUTABLE</div>
                      <div className={`text-lg font-bold ${feasibilityExecutableUnits >= orderQtyNum ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {Math.round(feasibilityExecutableUnits).toLocaleString()} <span className="text-gray-500 text-xs font-normal">units</span>
                      </div>
                      <div className="mt-1 h-1.5 w-24 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${feasibilityExecutableUnits >= orderQtyNum ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${orderQtyNum > 0 ? Math.min(100, (feasibilityExecutableUnits / orderQtyNum) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex-[2] min-w-[180px]">
                      <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">STATUS</div>
                      <div className="text-xs leading-relaxed text-gray-700">
                        {feasibilityRmCoversUnits < orderQtyNum && (
                          <>RM: <b className="text-amber-600">Only {Math.round(feasibilityRmCoversUnits).toLocaleString()} units</b><br /></>
                        )}
                        {feasibilityPmCoversUnits < orderQtyNum && (
                          <>PM: <b className="text-amber-600">Only {Math.round(feasibilityPmCoversUnits).toLocaleString()} units</b><br /></>
                        )}
                        {feasibilityExecutableUnits < orderQtyNum && (
                          <span className="text-amber-600 font-medium">Raise POs for shortages</span>
                        )}
                        {feasibilityExecutableUnits >= orderQtyNum && (
                          <span className="text-emerald-600 font-medium">Materials cover full order</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Preview qty + send — working batch is chosen in the bar above */}
                  <div className="p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-gray-500">Preview qty:</span>
                        <input
                          type="number"
                          min={1}
                          value={feasibilityPreviewQty || ''}
                          onChange={(e) => {
                            const v = e.target.value === '' ? 0 : parseInt(e.target.value.replace(/\D/g, ''), 10);
                            setFeasibilityPreviewQty(Number.isNaN(v) ? 0 : Math.max(0, v));
                          }}
                          className="w-24 border border-gray-300 bg-white text-gray-900 px-2 py-1.5 rounded-lg text-sm font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <span className="text-[11px] font-semibold text-gray-500">units</span>
                      </div>
                      <button
                        type="button"
                        disabled={
                          !canSendToProduction ||
                          selectedBatchPlanIndex < 0 ||
                          selectedBatchPlanIndex >= customBatches.length ||
                          (selectedSOForBatch?.sentBatchIndices ?? []).includes(selectedBatchPlanIndex)
                        }
                        onClick={() => {
                          if (selectedBatchPlanIndex >= 0) {
                            setSendToProductionConfirm({ source: 'plan-modal', batchIndex: selectedBatchPlanIndex });
                          }
                        }}
                        className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={
                          !canSendToProduction
                            ? 'Confirm BOM in BOM Editor first'
                            : selectedBatchPlanIndex < 0
                              ? 'Choose a working batch in the bar above'
                              : (selectedSOForBatch?.sentBatchIndices ?? []).includes(selectedBatchPlanIndex)
                                ? 'This batch was already sent'
                                : 'Send this working batch to Production'
                        }
                      >
                        Send batch
                      </button>
                    </div>
                    {selectedBatchId != null && (
                      <span className="text-[11px] text-gray-500">
                        Applies to working batch{' '}
                        <span className="font-mono font-semibold text-emerald-700">
                          B-{String(selectedBatchPlanSequence).padStart(2, '0')}
                        </span>
                        ; preview qty updates that row in BATCH BREAKDOWN.
                      </span>
                    )}
                  </div>

                  {/* BOM / Material Status — RM & PM tables driven by preview qty */}
                  <div className="p-4 overflow-auto max-h-[58vh] space-y-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-gray-900">BOM / Material Status</h3>
                    </div>
                    {(() => {
                      const orderQtyNum = parseInt(
                        String(selectedSOForBatch?.orderQty ?? '').replace(/\D/g, ''),
                        10
                      ) || 0;
                      return (
                        <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-900">
                          Calculation basis:{' '}
                          <span className="font-semibold">
                            Req this order = Formula % (or PM qty/unit) × units for this view
                          </span>
                          {materialReqUnits > 0 && (
                            <span>
                              {' '}
                              | Units used:{' '}
                              <span className="font-mono font-semibold">{materialReqUnits.toLocaleString()}</span>
                              {feasibilityPreviewQty > 0
                                ? ' (preview qty)'
                                : selectedBatchId != null
                                  ? ' (working batch)'
                                  : ' (order qty)'}
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {/* RM Feasibility Table */}
                    <div>
                      <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Raw materials ({feasibilityRmRows.length})</h4>
                      <div className="border border-gray-200 rounded-lg overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[120px]">Item</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700">SG</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700 text-[10px]">Req this order</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700">Stock</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700">Reserved</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700">Available</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700 text-[10px]">PO / Transit</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700">Gap</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700 text-[10px]">Max units</th>
                            </tr>
                          </thead>
                          <tbody>
                            {feasibilityRmRows.map((row, idx) => (
                              <tr key={`rm-${row.code}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                <td className="px-3 py-2 text-gray-900">
                                  <span className="font-medium text-xs">{row.name}</span>
                                  <div className="text-[10px] text-gray-500">{row.code} · kg</div>
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-gray-700">{Number(row.specificGravity ?? 1).toFixed(2)}</td>
                                <td className="px-3 py-2 text-right font-mono font-semibold text-gray-900">
                                  {formatQtyExact(row.reqThisOrder, 'kg')}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-gray-700">{formatQtyExact(row.sih, 'kg')}</td>
                                <td className="px-3 py-2 text-right font-mono text-gray-600">{formatQtyExact(row.reserved, 'kg')}</td>
                                <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-700">{formatQtyExact(row.free, 'kg')}</td>
                                <td className="px-3 py-2 text-right font-mono text-gray-600">{formatQtyExact(row.inTransit, 'kg')}</td>
                                <td className="px-3 py-2 text-right font-mono font-semibold">{row.gap > 0 ? <span className="text-red-600">{formatQtyExact(row.gap, 'kg')}</span> : <span className="text-emerald-600">—</span>}</td>
                                <td className="px-3 py-2 text-right font-mono font-bold text-amber-700">{Math.round(row.maxUnits).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* PM Feasibility Table */}
                    <div>
                      <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Packing materials ({feasibilityPmRows.length})</h4>
                      <div className="border border-gray-200 rounded-lg overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[120px]">Item</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700 text-[10px]">Req this order</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700">Stock</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700">Reserved</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700">Free</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700 text-[10px]">PO / Transit</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700">Gap</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700 text-[10px]">Max units</th>
                            </tr>
                          </thead>
                          <tbody>
                            {feasibilityPmRows.map((row, idx) => (
                              <tr key={`pm-${row.code}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                <td className="px-3 py-2 text-gray-900">
                                  <span className="font-medium text-xs">{row.name}</span>
                                  <div className="text-[10px] text-gray-500">{row.code} · pcs</div>
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-semibold text-gray-900">{row.reqThisOrder.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right font-mono text-gray-700">{row.sih.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right font-mono text-gray-600">{row.reserved.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-700">{row.free.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right font-mono text-gray-600">{row.inTransit.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right font-mono font-semibold">{row.gap > 0 ? <span className="text-red-600">{row.gap.toLocaleString()}</span> : <span className="text-emerald-600">—</span>}</td>
                                <td className="px-3 py-2 text-right font-mono font-bold text-amber-700">{Math.round(row.maxUnits).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const orderTotalKg = parseFloat(selectedSOForBatch.totalKg?.replace(/[^\d.]/g, '') || '0') || 0;
                    const orderQtyNum = parseInt(selectedSOForBatch.orderQty?.replace(/\D/g, '') || '0', 10) || 0;
                    const kgPerUnit = orderQtyNum > 0 && orderTotalKg > 0 ? orderTotalKg / orderQtyNum : (orderTotalKg || 1);
                    const batchTotal = customBatches.reduce((sum, b) => sum + (b.sizeKg || 0), 0);
                    const batchTotalUnits = kgPerUnit > 0 ? batchTotal / kgPerUnit : 0;
                    const remaining = orderTotalKg - batchTotal;
                    const remainingUnits = kgPerUnit > 0 ? remaining / kgPerUnit : 0;
                    const addBatch = async () => {
                      if (planningBatches.length > 0 && !canAddAnotherPlanningBatch) {
                        addToast('error', 'Send the latest batch to production before adding another.');
                        return;
                      }
                      try {
                        const newBatch = await addOneBatchFromMaster(planningIdForBatch);
                        if (newBatch) {
                          mergePlanningBatchIntoListCache(queryClient, planningIdForBatch, newBatch);
                          queryClient.invalidateQueries({ queryKey: ['planning-batches', planningIdForBatch] });
                          setSelectedBatchId(Number(newBatch.id));
                          addToast('success', `Added ${newBatch.batchCode ?? 'batch'} (BOM from master).`);
                        } else {
                          addToast('error', 'Failed to add batch');
                        }
                      } catch (e) {
                        console.error('[Planning] add batch from breakdown', e);
                        addToast('error', e instanceof Error ? e.message : 'Failed to add batch');
                      }
                    };
                    const removeBatch = (idx: number) => {
                      setCustomBatches(customBatches.filter((_, i) => i !== idx));
                      if (expandedBatchIndex === idx) setExpandedBatchIndex(null);
                      else if (expandedBatchIndex !== null && expandedBatchIndex > idx) setExpandedBatchIndex(expandedBatchIndex - 1);
                    };
                    /** Update batch units locally; cap at remaining order kg so totals do not exceed the SO. */
                    const updateBatchUnits = (idx: number, units: number) => {
                      const otherKg = customBatches.reduce((sum, b, i) => (i === idx ? sum : sum + (Number(b.sizeKg) || 0)), 0);
                      const maxKg = Math.max(0, orderTotalKg - otherKg);
                      let sizeKg = units * kgPerUnit;
                      if (sizeKg > maxKg) sizeKg = maxKg;
                      setCustomBatches(customBatches.map((b, i) => (i === idx ? { ...b, sizeKg } : b)));
                    };

                    /** Per-batch requirements in BATCH BREAKDOWN: use that batch row's own BOM copy. */
                    const getBatchRmRequirementsForBatch = (batchSizeForCalc: number, batchRow?: PlanningBatchRow) => {
                      const rmLines = Array.isArray(batchRow?.rmLines) ? batchRow.rmLines : [];
                      if (rmLines.length === 0) return [];
                      return rmLines.map((line: { inci_name?: string; rm_code?: string; pct_w_w?: number; pct?: number; uom?: string }) => {
                        const pct = line.pct_w_w ?? (line as { pct?: number }).pct ?? 0;
                        const requiredKg = (batchSizeForCalc * pct) / 100;
                        return { name: line.inci_name ?? line.rm_code ?? '—', code: line.rm_code ?? '', pct, required: requiredKg, requiredKg, uom: 'KG' as const };
                      });
                    };
                    const getBatchPmRequirementsForBatch = (batchSizeForCalc: number, batchRow?: PlanningBatchRow) => {
                      const pmLines = Array.isArray(batchRow?.pmLines) ? batchRow.pmLines : [];
                      if (pmLines.length === 0) return [];
                      const orderQtyNum = parseInt(selectedSOForBatch.orderQty?.replace(/\D/g, '') || '0', 10) || 0;
                      const unitsFraction = orderTotalKg > 0 ? batchSizeForCalc / orderTotalKg : 0;
                      const unitsForBatch = Math.ceil(orderQtyNum * unitsFraction);
                      return pmLines.map((line: { description?: string; pm_code?: string; qty_per_unit?: number }) => {
                        const qtyPerUnit = line.qty_per_unit ?? 1;
                        const required = unitsForBatch * qtyPerUnit;
                        return { name: line.description ?? line.pm_code ?? '—', code: line.pm_code ?? '', qtyPerUnit, required, uom: 'PCS' };
                      });
                    };
                    const batchPlanRows = customBatches
                      .map((batch, originalIndex) => {
                        const row = (planningBatches as PlanningBatchRow[])[originalIndex];
                        const sequence = Number(row?.sequence ?? (originalIndex + 1)) || (originalIndex + 1);
                        return { batch, originalIndex, row, sequence };
                      })
                      .sort((a, b) => b.sequence - a.sequence || b.originalIndex - a.originalIndex);

                    return (
                      <div className="space-y-6">
                        {canSendToProduction && (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-800">
                            <span className="font-semibold">BOM confirmed.</span> Use <strong>Send batch</strong> next to Preview qty for the current working batch. Allocate units in the rows below; expand a row to see required materials. Batches already sent are marked Sent.
                          </div>
                        )}

                        {/* Schedule & production line */}
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2">PLANNED START DATE</label>
                            <input type="date" value={plannedStartDate} onChange={(e) => setPlannedStartDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2">PRODUCTION LINE</label>
                            <select value={productionLine} onChange={(e) => setProductionLine(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                              <option>Line 1 — Primary Mixer</option>
                              <option>Line 2 — Secondary Mixer</option>
                              <option>Multi-line split</option>
                            </select>
                          </div>
                        </div>

                        {/* Summary banner — quantity (units) to be made */}
                        <div className={`border rounded-lg p-4 ${Math.abs(remaining) < 0.01 ? 'bg-emerald-50 border-emerald-200' : remaining > 0 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                          <p className="text-sm font-semibold flex items-center gap-2">
                            <span className={Math.abs(remaining) < 0.01 ? 'text-emerald-900' : remaining > 0 ? 'text-amber-900' : 'text-red-900'}>
                              {customBatches.length} batch{customBatches.length !== 1 ? 'es' : ''} — {Math.round(batchTotalUnits).toLocaleString()} units to be made
                              {orderQtyNum > 0 && <> of {orderQtyNum.toLocaleString()} units total</>}
                            </span>
                          </p>
                          {Math.abs(remaining) >= 0.01 && (
                            <p className={`text-xs mt-1 ${remaining > 0 ? 'text-amber-700' : 'text-red-700'}`}>
                              {remaining > 0 ? `${Math.round(remainingUnits).toLocaleString()} units remaining to allocate` : `${Math.round(-remainingUnits).toLocaleString()} units over-allocated`}
                            </p>
                          )}
                          {Math.abs(remaining) < 0.01 && <p className="text-xs text-emerald-700 mt-1">Fully allocated.</p>}
                          <p className="text-xs mt-1.5 text-slate-700">
                            {(() => {
                              const sentBatchIndices = selectedSOForBatch?.sentBatchIndices ?? [];
                              const unsent = customBatches.filter((_, i) => !sentBatchIndices.includes(i)).length;
                              const pendKgLine = remaining > 0.01 ? `${remaining.toFixed(1)} kg still to allocate` : remaining < -0.01 ? 'Over-allocated vs order total' : 'No kg left to allocate';
                              return (
                                <>
                                  <span className="font-semibold">{unsent}</span> batch{unsent !== 1 ? 'es' : ''} not sent
                                  {' · '}
                                  {pendKgLine}
                                </>
                              );
                            })()}
                          </p>
                        </div>

                        {/* Custom batch list — add batches from Working batch bar; preview qty updates the selected working batch row */}
                        <div>
                          <div className="mb-4">
                            <h3 className="text-sm font-bold text-gray-900">BATCH BREAKDOWN</h3>
                            <p className="text-[11px] text-gray-500 mt-1">
                              Use <strong>+ Add</strong> next to <strong>Working batch</strong> to create planning batches. Set units per row; changing <strong>Preview qty</strong> updates the row that matches the working batch.
                            </p>
                          </div>

                          {customBatches.length === 0 && (
                            <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                              <p className="text-sm text-gray-600">No unit split yet. Use <strong>+ Add</strong> next to Working batch, then allocate units per row below.</p>
                              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                                {orderQtyNum > 0 && (
                                  <button
                                    type="button"
                                    disabled={planningBatches.length > 0 && !canAddAnotherPlanningBatch}
                                    onClick={() => addBatch()}
                                    className="px-4 py-2 border border-emerald-300 text-emerald-800 text-xs font-semibold rounded-lg hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                    title={
                                      planningBatches.length > 0 && !canAddAnotherPlanningBatch
                                        ? 'Send the latest batch to production first'
                                        : undefined
                                    }
                                  >
                                    Create single batch ({orderQtyNum.toLocaleString()} units)
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="space-y-3">
                            {batchPlanRows.map(({ batch, originalIndex, row, sequence }) => {
                              const isExpanded = expandedBatchIndex === originalIndex;
                              const sentBatchIndices = selectedSOForBatch?.sentBatchIndices ?? [];
                              const isSent = sentBatchIndices.includes(originalIndex);
                              const batchUnits = kgPerUnit > 0 ? batch.sizeKg / kgPerUnit : 0;
                              const rmReqs = isExpanded ? getBatchRmRequirementsForBatch(batch.sizeKg, row) : [];
                              const pmReqs = isExpanded ? getBatchPmRequirementsForBatch(batch.sizeKg, row) : [];
                              return (
                                <div key={row?.id ?? `batch-${originalIndex}`} className={`border-2 rounded-lg overflow-hidden transition-colors ${isSent ? 'border-gray-200 bg-gray-100 opacity-90' : isExpanded ? 'border-emerald-400 bg-emerald-50/30' : 'border-gray-200 bg-white'}`}>
                                  <div className="flex items-center gap-3 p-4">
                                    {isSent && (
                                      <span className="shrink-0 text-xs font-semibold text-gray-500 bg-gray-200 px-2 py-1 rounded">Sent</span>
                                    )}
                                    <div
                                      className="flex-1 flex items-center gap-4 cursor-pointer"
                                      onClick={() => setExpandedBatchIndex(isExpanded ? null : originalIndex)}
                                    >
                                      <span className={`text-sm font-bold px-3 py-1 rounded-md ${isSent ? 'text-gray-500 bg-gray-200' : 'text-emerald-700 bg-emerald-100'}`}>
                                        B-{String(sequence).padStart(2, '0')}
                                      </span>
                                      {row?.batchCode && (
                                        <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded" title="Batch ID (BOM copy saved for this batch)">
                                          {row.batchCode}
                                        </span>
                                      )}
                                      <span className="text-xs text-gray-500">
                                        {isExpanded ? '▼' : '▶'} {isExpanded ? 'Hide materials' : 'View required materials'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="number"
                                        value={kgPerUnit > 0 ? Math.round(batch.sizeKg / kgPerUnit) : batch.sizeKg}
                                        onChange={(e) => {
                                          const units = parseFloat(e.target.value) || 0;
                                          updateBatchUnits(originalIndex, units);
                                        }}
                                        disabled={isSent}
                                        className="w-28 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-right font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100 disabled:text-gray-500"
                                        min={0}

                                      />
                                      <span className="text-xs font-semibold text-gray-600">units</span>
                                      {!isSent && (
                                        <button
                                          type="button"
                                          onClick={() => removeBatch(originalIndex)}
                                          className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                                        >
                                          <X size={14} />
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Per-batch material requirements */}
                                  {isExpanded && (
                                    <div className="border-t border-gray-200 p-4 bg-white space-y-4">
                                      {rmReqs.length > 0 && (
                                        <div>
                                          <h4 className="text-xs font-bold text-teal-700 mb-2">RM REQUIRED FOR B-{String(sequence).padStart(2, '0')} ({Math.round(batchUnits).toLocaleString()} units)</h4>
                                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                                            <table className="w-full text-xs">
                                              <thead><tr className="bg-gray-50 border-b border-gray-200">
                                                <th className="px-3 py-1.5 text-left font-semibold text-gray-600">RM ITEM</th>
                                                <th className="px-3 py-1.5 text-right font-semibold text-gray-600">% W/W</th>
                                                <th className="px-3 py-1.5 text-right font-semibold text-gray-600">REQUIRED</th>
                                              </tr></thead>
                                              <tbody>
                                                {rmReqs.map((r, ri) => (
                                                  <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                    <td className="px-3 py-1.5 text-gray-900 font-medium">{r.name} <span className="text-gray-400 text-xs">({r.code})</span></td>
                                                    <td className="px-3 py-1.5 text-right text-gray-600">{r.pct.toFixed(2)}%</td>
                                                    <td className="px-3 py-1.5 text-right text-teal-700 font-bold">{formatQtyExact(r.requiredKg ?? r.required, 'kg')} kg</td>
                                                  </tr>
                                                ))}
                                                <tr className="bg-teal-50 border-t border-teal-200">
                                                  <td colSpan={2} className="px-3 py-1.5 text-right font-bold text-teal-800">Total RM</td>
                                                  <td className="px-3 py-1.5 text-right font-bold text-teal-800">
                                                    {formatQtyExact(rmReqs.reduce((s, r) => s + (r.requiredKg ?? 0), 0), 'kg')} kg
                                                  </td>
                                                </tr>
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      )}
                                      {pmReqs.length > 0 && (
                                        <div>
                                          <h4 className="text-xs font-bold text-orange-700 mb-2">PM REQUIRED FOR B-{String(sequence).padStart(2, '0')} ({Math.round(batchUnits).toLocaleString()} units)</h4>
                                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                                            <table className="w-full text-xs">
                                              <thead><tr className="bg-gray-50 border-b border-gray-200">
                                                <th className="px-3 py-1.5 text-left font-semibold text-gray-600">PM ITEM</th>
                                                <th className="px-3 py-1.5 text-right font-semibold text-gray-600">QTY/UNIT</th>
                                                <th className="px-3 py-1.5 text-right font-semibold text-gray-600">REQUIRED</th>
                                              </tr></thead>
                                              <tbody>
                                                {pmReqs.map((p, pi) => (
                                                  <tr key={pi} className={pi % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                    <td className="px-3 py-1.5 text-gray-900 font-medium">{p.name} <span className="text-gray-400 text-xs">({p.code})</span></td>
                                                    <td className="px-3 py-1.5 text-right text-gray-600">{p.qtyPerUnit}</td>
                                                    <td className="px-3 py-1.5 text-right text-orange-700 font-bold">{p.required.toLocaleString()} {p.uom}</td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      )}
                                      {rmReqs.length === 0 && pmReqs.length === 0 && (
                                        <p className="text-xs text-gray-500 text-center py-2">No BOM data available to calculate materials.</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* BOM Editor Tab */}
              {activeBatchTab === 'bom-editor' && (
                <div className="space-y-6">
                  {(planningBatches as PlanningBatchRow[]).length > 0 && (
                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                      <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide px-4 py-2 bg-slate-50 border-b border-slate-200">
                        Planned batches (quantity history)
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200">
                              <th className="text-left px-3 py-2 font-semibold text-slate-700">B</th>
                              <th className="text-left px-3 py-2 font-semibold text-slate-700">Code</th>
                              <th className="text-right px-3 py-2 font-semibold text-slate-700">Size (kg)</th>
                              <th className="text-right px-3 py-2 font-semibold text-slate-700">Units (est.)</th>
                              <th className="text-left px-3 py-2 font-semibold text-slate-700">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...(planningBatches as PlanningBatchRow[])]
                              .map((row, originalIndex) => ({ row, originalIndex }))
                              .sort((a, b) => (Number(a.row.sequence) || 0) - (Number(b.row.sequence) || 0))
                              .map(({ row, originalIndex }, displayIdx) => {
                                const seq = Number(row.sequence) || displayIdx + 1;
                                const sent = selectedSOForBatch?.sentBatchIndices ?? [];
                                const isSent = sent.includes(originalIndex);
                                const sk = Number(row.sizeKg) || 0;
                                const u =
                                  kgPerUnitForPlanBatches > 0 ? sk / kgPerUnitForPlanBatches : sk;
                                return (
                                  <tr
                                    key={row.id ?? `pb-${originalIndex}`}
                                    className={displayIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}
                                  >
                                    <td className="px-3 py-2 font-mono font-semibold text-emerald-800">
                                      B-{String(seq).padStart(2, '0')}
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs text-slate-600">
                                      {row.batchCode ?? '—'}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono tabular-nums">{formatQtyExact(sk, 'kg')}</td>
                                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                                      {u % 1 === 0 ? Math.round(u).toLocaleString() : u.toFixed(1)}
                                    </td>
                                    <td className="px-3 py-2">
                                      {isSent ? (
                                        <span className="text-xs font-semibold text-slate-600 bg-slate-200 px-2 py-0.5 rounded">
                                          Sent
                                        </span>
                                      ) : (
                                        <span className="text-xs font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                                          Pending
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                      {(() => {
                        const maxSeq = Math.max(
                          0,
                          ...(planningBatches as PlanningBatchRow[]).map((b) => Number(b.sequence) || 0)
                        );
                        const nextSeq = maxSeq + 1;
                        return (
                          <p className="text-[11px] text-slate-500 px-4 py-2 bg-slate-50/50 border-t border-slate-100">
                            Next new batch from <strong className="text-slate-700">+ Add</strong> uses sequence{' '}
                            <span className="font-mono font-semibold text-emerald-800">
                              B-{String(nextSeq).padStart(2, '0')}
                            </span>{' '}
                            (after the highest existing batch number).
                          </p>
                        );
                      })()}
                    </div>
                  )}
                  <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 flex items-start gap-3">
                    <span className="text-yellow-600 text-lg mt-0.5">!</span>
                    <div>
                      <p className="text-sm font-semibold text-yellow-900">Editing BOM for {selectedSOForBatch.productName}. Make all BOM updates here (add/swap materials). When done, click <strong>Confirm BOM</strong> below — then use the <strong>Batch Plan</strong> tab to set how many batches and schedule. Each batch gets its own saved BOM copy (e.g. PE-5-B1) when you save the batch plan, so this BOM is reused per batch.</p>
                    </div>
                  </div>
                  {/* BOM-level Specific Gravity: one value for the whole blend, required on first-batch confirmation.
                      Hidden once locked — the saved value still drives every RM line via the backend fan-out. */}
                  {!canSendToProduction && (
                    <div className="rounded-lg border p-4 bg-indigo-50 border-indigo-200">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-gray-900">BOM default Specific Gravity</h3>
                          <p className="text-xs text-gray-600 mt-1">
                            Default SG (vs water) for new or swapped RM lines — pre-filled from the PR master Specs field when set. Each RM line has its own SG — used to convert litre warehouse stock to kg (mass = volume × SG). All BOM confirmation quantities are shown in kg.
                          </p>
                          {prSpecBulkForBom ? (
                            <p className="text-xs text-indigo-900 mt-2">
                              PR product SG (master):{' '}
                              <span className="font-mono font-semibold">{prSpecBulkForBom}</span>
                              <span className="text-indigo-700">
                                {' '}
                                → {parseBulkSpecificGravity(prSpecBulkForBom).toFixed(3)} vs water
                              </span>
                            </p>
                          ) : null}
                          {bomFormula.length > 0 ? (
                            <p className="text-xs text-slate-600 mt-1">
                              Formula blend SG (% w/w weighted):{' '}
                              <span className="font-mono font-semibold">
                                {inferBlendSpecificGravity(
                                  bomFormula.map((it) => ({
                                    pct: it.percentage,
                                    specificGravity: it.specificGravity,
                                  }))
                                ).toFixed(3)}
                              </span>{' '}
                              vs water
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <label htmlFor="bom-level-sg" className="sr-only">BOM Specific Gravity</label>
                          <input
                            id="bom-level-sg"
                            type="number"
                            value={bomLevelSG}
                            onChange={(e) => setBomLevelSG(e.target.value)}
                            step="0.01"
                            min="0.1"
                            max="3"
                            placeholder="1.00"
                            className="w-28 px-3 py-2 border border-indigo-300 rounded-lg text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            title="Default specific gravity for new RM lines (vs water)"
                          />
                          <span className="text-xs text-gray-500">vs water</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                      FORMULA BOM ({bomFormula.length} RM ITEMS)
                    </h3>
                    <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                      {bomFormula.map((item, idx) => {
                        const lineQtyKg = roundMaterialQty(
                          (effectiveBatchSizeKg * (item.percentage ?? 0)) / 100
                        );
                        return (
                        <div key={`${item.id}-${idx}`} className="bg-white rounded-lg p-4 flex items-center gap-4 border border-gray-200 flex-wrap">
                          <div className="flex-1 min-w-[160px]">
                            <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                            <p className="text-xs text-blue-600 font-medium">
                              {item.code ?? item.id} · {item.percentage}% w/w · {formatQtyExact(lineQtyKg, 'kg')} kg · {item.phase ?? 'Phase A'}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">SG</label>
                              <input
                                type="number"
                                value={item.specificGravity ?? 1}
                                onChange={(e) => updateBomLineSg(idx, e.target.value)}
                                step="0.01"
                                min="0.1"
                                max="3"
                                readOnly={canSendToProduction}
                                disabled={canSendToProduction}
                                title="Specific gravity vs water (for L volume)"
                                className={`w-16 px-2 py-1 border rounded text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 ${canSendToProduction ? 'bg-gray-100 border-gray-200 text-gray-600 cursor-not-allowed' : 'border-gray-300'}`}
                              />
                            </div>
                            <input
                              type="number"
                              value={item.percentage}
                              onChange={(e) => { const updated = [...bomFormula]; updated[idx] = { ...item, percentage: parseFloat(e.target.value) }; setBomFormula(updated); }}
                              step="0.1"
                              readOnly={canSendToProduction}
                              disabled={canSendToProduction}
                              className={`w-20 px-2 py-1 border rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 ${canSendToProduction ? 'bg-gray-100 border-gray-200 text-gray-600 cursor-not-allowed' : 'border-gray-300'}`}
                            />
                            <span className="text-sm font-semibold text-gray-600">%</span>
                            {!canSendToProduction && (
                              <button onClick={() => setBomFormula(bomFormula.filter((_, i) => i !== idx))} className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors"><X size={16} /></button>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                    {!canSendToProduction && (
                      <button className="mt-4 text-sm font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-2" onClick={() => setActiveBatchTab('swap-add')}>
                        <span>↔</span>Swap RM in Swap panel
                      </button>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                      PACK BOM ({bomPackaging.length} PM ITEMS)
                    </h3>
                    <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                      {bomPackaging.map((item, idx) => (
                        <div key={`${item.id}-${idx}`} className="bg-white rounded-lg p-4 flex items-center gap-4 border border-gray-200">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                            <p className="text-xs text-blue-600 font-medium">{item.code ?? item.id} · {idx === 0 ? 'Primary' : 'Secondary'}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              value={item.value}
                              onChange={(e) => { const updated = [...bomPackaging]; updated[idx] = { ...item, value: parseFloat(e.target.value) }; setBomPackaging(updated); }}
                              step="0.1"
                              readOnly={canSendToProduction}
                              disabled={canSendToProduction}
                              className={`w-20 px-2 py-1 border rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 ${canSendToProduction ? 'bg-gray-100 border-gray-200 text-gray-600 cursor-not-allowed' : 'border-gray-300'}`}
                            />
                            <span className="text-sm font-semibold text-gray-600">Qty/unit</span>
                            {!canSendToProduction && (
                              <button onClick={() => setBomPackaging(bomPackaging.filter((_, i) => i !== idx))} className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors"><X size={16} /></button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-200">
                    {!canSendToProduction ? (
                      (() => {
                        const allLinesSgOk = bomFormula.every((item) => {
                          const sg = Number(item.specificGravity);
                          return Number.isFinite(sg) && sg > 0;
                        });
                        const bomDefaultSgOk = Number.isFinite(Number(bomLevelSG)) && Number(bomLevelSG) > 0;
                        const sgValid = allLinesSgOk || bomDefaultSgOk;
                        const canConfirm = canConfirmBomPerBatch && sgValid;
                        const disabledReason = !canConfirmBomPerBatch
                          ? 'Add RM/PM lines in the BOM editor first'
                          : !sgValid
                            ? 'Enter SG on each RM line or a BOM default SG greater than 0'
                            : 'Confirm BOM: available stock is reserved; raise POs for any gaps';
                        return (
                          <button
                            type="button"
                            onClick={() => handleConfirmBOM()}
                            disabled={!canConfirm}
                            title={disabledReason}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${canConfirm ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-400 cursor-not-allowed'}`}
                          >
                            Confirm BOM
                          </button>
                        );
                      })()
                    ) : (
                      <span className="px-4 py-2 rounded-lg text-sm font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200">
                        BOM Confirmed
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Swap Tab */}
              {activeBatchTab === 'swap-add' && (
                <div className="bg-white">
                  <div className="bg-cyan-50 border-y border-cyan-200 px-6 py-3">
                    <p className="text-xs text-cyan-800 font-semibold">
                      {swapSourceLine
                        ? swapTargetItemGroups.length > 0
                          ? `Swap options — item group${swapTargetItemGroups.length > 1 ? 's' : ''} for ${swapSourceLine.name}: ${swapTargetItemGroups.map((g) => g.name).join(', ')}`
                          : `${swapSourceLine.name} is not in any item group. Search by name or SKU below, or assign groups under Masters → Item Groups.`
                        : 'Edit % w/w on each BOM line below, click Swap on a line, then search for a replacement RM.'}
                    </p>
                  </div>
                  <div className="px-6 py-4 border-b border-gray-200 bg-slate-50/90">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div>
                        <h4 className="text-sm font-bold text-gray-900">BOM formula — % w/w &amp; batch qty</h4>
                        <p className="text-xs text-gray-600 mt-0.5">
                          Batch size: <span className="font-semibold">{formatQtyExact(effectiveBatchSizeKg, 'kg')} kg</span>
                          {' · '}Qty per line = (batch kg × % w/w) ÷ 100
                        </p>
                      </div>
                      {swapSourceIndex !== null && (
                        <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2.5 py-1 rounded-full">
                          Swapping: {bomFormula[swapSourceIndex]?.name}
                        </span>
                      )}
                    </div>
                    <div className="space-y-2 max-h-[min(320px,40vh)] overflow-y-auto pr-1 border border-dashed border-slate-200 rounded-lg p-2 bg-white/60">
                      {bomFormula.length === 0 ? (
                        <p className="text-sm text-slate-500">No RM lines in this batch BOM.</p>
                      ) : (
                        bomFormula.map((item, idx) => {
                          const lineQtyKg = roundMaterialQty(
                            (effectiveBatchSizeKg * (item.percentage ?? 0)) / 100
                          );
                          const isActive = swapSourceIndex === idx;
                          return (
                            <div
                              key={`swap-pct-${item.id}-${idx}`}
                              className={`flex flex-wrap items-center gap-3 bg-white border rounded-lg px-3 py-2.5 shadow-sm ${isActive ? 'border-purple-500 ring-2 ring-purple-200' : 'border-gray-200'}`}
                            >
                              <div className="flex-1 min-w-[140px]">
                                <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                                <p className="text-xs text-gray-500 truncate">
                                  {item.code ?? item.id} · {item.phase ?? 'Phase A'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <label className="text-xs font-semibold text-gray-700 whitespace-nowrap">SG</label>
                                <input
                                  type="number"
                                  min={0.1}
                                  max={3}
                                  step="0.01"
                                  value={item.specificGravity ?? 1}
                                  onChange={(e) => updateBomLineSg(idx, e.target.value)}
                                  className="w-[56px] px-2 py-1.5 text-sm border border-gray-300 rounded-md text-right font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                  title="Specific gravity vs water"
                                />
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <label className="text-xs font-semibold text-gray-700 whitespace-nowrap">% w/w</label>
                                <input
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={item.percentage ?? 0}
                                  onChange={(e) => updateSwapLinePct(idx, e.target.value)}
                                  className="w-[72px] px-2 py-1.5 text-sm border border-gray-300 rounded-md text-right focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                />
                              </div>
                              <div className="text-xs text-gray-600 shrink-0 min-w-[100px]">
                                <span className="text-gray-500">Qty:</span>{' '}
                                <span className="font-semibold text-gray-900">{formatQtyExact(lineQtyKg, 'kg')} KG</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (swapSourceIndex === idx) {
                                    setSwapSourceIndex(null);
                                  } else {
                                    setSwapSourceIndex(idx);
                                    updateSwapLinePct(idx, String(item.percentage ?? 0));
                                  }
                                }}
                                className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors shrink-0 ${isActive ? 'bg-purple-600 text-white hover:bg-purple-700' : 'text-purple-700 bg-purple-100 hover:bg-purple-200'}`}
                              >
                                {isActive ? 'Selected' : 'Swap'}
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <div className="flex max-h-[50vh]">
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-gray-700">Search replacement RM</h4>
                        <p className="text-[11px] text-slate-500">
                          Type at least 2 characters (name, INCI, or SKU). Suggestions appear below — no full RM list.
                        </p>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                          <input
                            type="text"
                            placeholder="Search by RM name, INCI, or SKU code…"
                            value={swapRmSearch}
                            onChange={(e) => {
                              const v = e.target.value;
                              setSwapRmSearch(v);
                              setSwapRmSuggestionsOpen(v.trim().length >= 2);
                            }}
                            onFocus={() => {
                              if (swapRmSearch.trim().length >= 2) setSwapRmSuggestionsOpen(true);
                            }}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            autoComplete="off"
                          />
                          {swapRmSuggestionsOpen && (swapRmSearchLoading || swapRmSearch.trim().length >= 2) && (
                            <div className="absolute z-10 left-0 right-0 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg max-h-56 overflow-y-auto">
                              {swapRmSearchLoading ? (
                                <p className="px-3 py-2.5 text-xs text-slate-500 flex items-center gap-1.5">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /> Searching…
                                </p>
                              ) : swapRmResults.length === 0 ? (
                                <p className="px-3 py-2.5 text-xs text-slate-500">No raw materials match this search.</p>
                              ) : (
                                swapRmResults.map((rm) => {
                                  const whRow = warehouseRows.find((r) => r.code === rm.code);
                                  const lineSg = parseSpecificGravity(
                                    bomFormula[swapSourceIndex ?? 0]?.specificGravity ?? bomLevelSG
                                  );
                                  const sih = warehouseQtyToKg(whRow?.stockInHand ?? 0, whRow, rm, lineSg);
                                  return (
                                    <button
                                      key={rm.id}
                                      type="button"
                                      disabled={swapSourceIndex === null || swapApplying}
                                      onClick={() => void handleSwapWithRm(rm)}
                                      className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left text-sm hover:bg-purple-50 disabled:opacity-40 disabled:cursor-not-allowed border-b border-gray-100 last:border-b-0"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <p className="font-medium text-gray-800 truncate">{rm.name || rm.inci}</p>
                                        <p className="text-xs text-gray-500 truncate">
                                          {rm.code}
                                          {rm.zohoSkuCode ? ` · SKU ${rm.zohoSkuCode}` : ''}
                                        </p>
                                      </div>
                                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                                        <span className="text-[10px] font-semibold text-gray-600">{sih.toLocaleString()} KG</span>
                                        <span className="text-[10px] font-semibold text-purple-600">
                                          {swapSourceIndex === null ? 'Select BOM line' : 'Swap in'}
                                        </span>
                                      </div>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                        <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={swapAddToGroup}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setSwapAddToGroup(checked);
                              if (!checked) setSwapPendingGroupRm(null);
                            }}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          Add replacement RM to item group
                        </label>
                        {swapAddToGroup && (
                          <div className="space-y-2">
                            <input
                              type="text"
                              placeholder="Item group name (new or existing)"
                              value={swapGroupName}
                              onChange={(e) => setSwapGroupName(e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            />
                            {swapPendingGroupRm ? (
                              <p className="text-[11px] text-slate-600">
                                Pending: <span className="font-medium">{swapPendingGroupRm.name}</span>
                              </p>
                            ) : (
                              <p className="text-[11px] text-slate-500">Swap an RM first, then confirm the group add.</p>
                            )}
                            <button
                              type="button"
                              disabled={!swapPendingGroupRm || !swapGroupName.trim() || swapApplying}
                              onClick={() => void handleConfirmSwapItemGroup()}
                              className="w-full px-3 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              {swapApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                              Confirm add to item group
                            </button>
                          </div>
                        )}
                      </div>

                      {swapSourceLine && swapTargetItemGroups.length === 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                          <p className="font-semibold">No item group for this ingredient</p>
                          <p className="text-xs mt-1 text-amber-800">
                            Add <span className="font-mono">{swapSourceLine.code || swapSourceLine.name}</span> to an
                            item group in Masters → Item Groups so swap alternatives appear here.
                          </p>
                        </div>
                      )}
                      {swapSourceLine && swapCategories.every((c) => c.items.length === 0) && swapTargetItemGroups.length > 0 && (
                        <p className="text-sm text-slate-500">No other members in this item group.</p>
                      )}
                      {swapSourceLine && swapCategories.length > 0 && (
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider pt-2 border-t border-gray-200">
                          Item group alternatives
                        </p>
                      )}
                      {swapCategories.map((category) => (
                        <div key={`${category.code || category.name}`}>
                          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                            {category.name}
                            {category.code ? (
                              <span className="ml-1 font-mono font-normal normal-case text-slate-400">
                                ({category.code})
                              </span>
                            ) : null}
                          </h3>
                          {category.items.length === 0 ? (
                            <p className="text-xs text-slate-400 mb-3">No swap alternatives in this group.</p>
                          ) : null}
                          <div className="space-y-2">
                            {category.items.map((item) => {
                              const whRow = warehouseRows.find((r) => r.code === item.code);
                              const rmMaster = rawMaterialsList.find((r) => r.code === item.code);
                              const lineSg = parseSpecificGravity(
                                bomFormula[swapSourceIndex ?? 0]?.specificGravity ?? bomLevelSG
                              );
                              const sih = warehouseQtyToKg(whRow?.stockInHand ?? 0, whRow, rmMaster, lineSg);
                              return (
                                <div key={`${category.name}-${item.id}`} className="px-3 py-2 rounded-lg flex items-center justify-between gap-3 text-sm bg-white border border-gray-200">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-800 truncate">{item.name}</p>
                                    <p className="text-xs text-gray-500 truncate">{item.code} · {item.description}</p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${item.status === 'IN BOM' ? 'bg-green-100 text-green-800' : item.status === 'AVAILABLE' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>{item.status}</span>
                                    <span className="text-sm font-bold text-gray-700">{sih.toLocaleString()} KG</span>
                                    {swapSourceIndex !== null ? (
                                      <button
                                        type="button"
                                        disabled={swapApplying}
                                        onClick={() => void handleSwapFromGroupMember(item)}
                                        className="text-xs font-semibold text-purple-600 hover:text-purple-700 disabled:opacity-50"
                                      >
                                        Use as replacement
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="hidden" aria-hidden>
                      <h3 className="text-sm font-bold text-gray-800 mb-4">CURRENT BOM — {selectedSOForBatch.productName}</h3>
                      {swapSourceIndex !== null && (
                        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900 space-y-1">
                          <p className="mb-2">
                            Replace <strong>{bomFormula[swapSourceIndex]?.name}</strong> via search or item group (left).
                            Edit <strong>% w/w</strong> so batch qty recalculates for the swapped RM.
                          </p>
                          <div className="flex flex-wrap items-end gap-3 mb-2">
                            <div>
                              <label className="block text-[10px] font-semibold uppercase tracking-wide text-amber-800 mb-1">
                                SG
                              </label>
                              <input
                                type="number"
                                min={0.1}
                                max={3}
                                step="0.01"
                                value={bomFormula[swapSourceIndex]?.specificGravity ?? 1}
                                onChange={(e) => updateBomLineSg(swapSourceIndex, e.target.value)}
                                className="w-20 px-2 py-1.5 text-sm border border-amber-300 rounded-md bg-white font-mono text-right focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold uppercase tracking-wide text-amber-800 mb-1">
                                % w/w
                              </label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={bomFormula[swapSourceIndex]?.percentage ?? 0}
                                  onChange={(e) => updateSwapLinePct(swapSourceIndex, e.target.value)}
                                  className="w-24 px-2 py-1.5 text-sm border border-amber-300 rounded-md bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                />
                                <span className="text-sm font-semibold">%</span>
                              </div>
                            </div>
                            <div className="text-xs text-amber-900">
                              <span className="font-semibold">Batch qty ({formatQtyExact(effectiveBatchSizeKg, 'kg')} kg batch):</span>
                              <br />
                              <span className="text-base font-bold text-amber-950">
                                {formatQtyExact(swapSelectedQtyKg, 'kg')} KG
                              </span>
                            </div>
                          </div>
                          <button type="button" onClick={() => setSwapSourceIndex(null)} className="text-amber-700 underline text-xs">
                            Cancel swap
                          </button>
                        </div>
                      )}
                      <div className="space-y-3">
                        {bomFormula.map((item, idx) => {
                          const lineQtyKg =
                            item.quantity != null && item.quantity > 0
                              ? item.quantity
                              : roundMaterialQty((effectiveBatchSizeKg * (item.percentage ?? 0)) / 100);
                          return (
                          <div key={`swap-${item.id}-${idx}`} className={`bg-white rounded-lg p-3 border shadow-sm ${swapSourceIndex === idx ? 'border-purple-500 ring-2 ring-purple-200' : 'border-gray-200'}`}>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                                <p className="text-xs text-gray-500">
                                  {item.code ?? item.id} · {item.phase ?? 'Phase A'}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (swapSourceIndex === idx) {
                                    setSwapSourceIndex(null);
                                  } else {
                                    setSwapSourceIndex(idx);
                                    updateSwapLinePct(idx, String(bomFormula[idx]?.percentage ?? 0));
                                  }
                                }}
                                className="text-xs font-semibold text-purple-700 bg-purple-100 hover:bg-purple-200 px-3 py-1.5 rounded-md transition-colors shrink-0"
                              >
                                {swapSourceIndex === idx ? 'Cancel' : 'Swap'}
                              </button>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-600">
                              <span>
                                SG: <span className="font-mono font-semibold text-gray-800">{Number(item.specificGravity ?? 1).toFixed(2)}</span>
                              </span>
                              {swapSourceIndex === idx ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-gray-700">% w/w</span>
                                  <input
                                    type="number"
                                    min={0}
                                    step="any"
                                    value={item.percentage}
                                    onChange={(e) => updateSwapLinePct(idx, e.target.value)}
                                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-2 focus:ring-purple-500"
                                  />
                                </div>
                              ) : (
                                <span>{item.percentage}% w/w</span>
                              )}
                              <span>
                                Qty: <span className="font-semibold text-gray-800">{formatQtyExact(lineQtyKg, 'kg')} KG</span>
                              </span>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PR Modal Popup - Global: renders across all tabs */}
      {prModalOpen && selectedSO && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/30 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl my-8">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Raise Procurement Request</h2>
              <button onClick={() => { setPrModalOpen(false); setSelectedSO(null); setPrShowPMOnly(false); setPrOmittedCount(0); }} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm flex items-start gap-3">
                <span className="text-yellow-500 mt-0.5">i</span>
                <span>
                  Items are linked to Raw Materials, Pack Materials, or Products (FG). You can change type, pick another item from the dropdowns, edit unit and quantity, add lines, or remove lines. Only lines with an item selected are sent.
                  {prOmittedCount > 0 && (
                    <span className="block mt-2 text-amber-700 font-medium">
                      {prOmittedCount} BOM item{prOmittedCount !== 1 ? 's' : ''} were omitted (not in RM/PM masters). You can add them manually via “Add line” and select from masters.
                    </span>
                  )}
                  <span className="block mt-2 text-gray-600 text-xs">On submit, the request is saved to the backend (procurement_requests). You’ll see it in Planning tab stats and in Procurement - Requests.</span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">PRIORITY</label>
                  <select value={prPriority} onChange={(e) => setPrPriority(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">REQUIRED BY DATE</label>
                  <input type="date" value={prRequiredByDate} onChange={(e) => setPrRequiredByDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">NOTES TO PROCUREMENT</label>
                <textarea value={prNotes} onChange={(e) => setPrNotes(e.target.value)} placeholder="Any special instructions..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={3} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
                  Items — linked to RM/PM/FG masters (editable)
                </h3>
                {prItems.length === 0 && (
                  <p className="text-sm text-gray-500 mb-2">No lines. Add a line and select an item from Raw Materials, Pack Materials, or Products.</p>
                )}
                {prItems.length > 0 && (
                  <div className="border border-gray-200 rounded-lg overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">TYPE</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">ITEM (RM/PM/FG)</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">UNIT</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-700">REQ</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-700">SIH</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-700">SHORT</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-700">QTY REQUEST</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">NOTES</th>
                          <th className="px-2 py-2 w-16"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {prItems.map((item, idx) => (
                          <tr key={`${item.type}-${item.code}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-3 py-2">
                              <select
                                value={item.type}
                                onChange={(e) => {
                                  const t = e.target.value as 'RM' | 'PM' | 'FG';
                                  updatePrItem(idx, {
                                    type: t,
                                    raw_material_id: undefined,
                                    pack_material_id: undefined,
                                    product_id: undefined,
                                    code: '',
                                    name: '',
                                    unit: t === 'PM' || t === 'FG' ? 'PCS' : 'KG',
                                  });
                                }}
                                className="w-full min-w-[4rem] px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="RM">RM</option>
                                <option value="PM">PM</option>
                                <option value="FG">FG</option>
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              {item.type === 'RM' && (
                                <select
                                  value={item.raw_material_id ?? ''}
                                  onChange={(e) => {
                                    const id = e.target.value;
                                    const master = rawMaterialsList.find((r) => String(r.id) === id);
                                    if (master) updatePrItem(idx, { raw_material_id: parseInt(String(master.id), 10), pack_material_id: undefined, product_id: undefined, code: master.code, name: master.name, unit: normRmPrimaryUom(master.uom) });
                                  }}
                                  className="w-full min-w-[12rem] px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Select RM…</option>
                                  {rawMaterialsList.map((r) => (
                                    <option key={r.id} value={r.id}>{r.code} — {r.name}</option>
                                  ))}
                                </select>
                              )}
                              {item.type === 'PM' && (
                                <select
                                  value={item.pack_material_id ?? ''}
                                  onChange={(e) => {
                                    const id = e.target.value;
                                    const master = packMaterialsList.find((p) => String(p.id) === id);
                                    if (master) updatePrItem(idx, { pack_material_id: parseInt(String(master.id), 10), raw_material_id: undefined, product_id: undefined, code: master.code, name: master.description, unit: 'PCS' });
                                  }}
                                  className="w-full min-w-[12rem] px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Select PM…</option>
                                  {packMaterialsList.map((p) => (
                                    <option key={p.id} value={p.id}>{p.code} — {p.description}</option>
                                  ))}
                                </select>
                              )}
                              {item.type === 'FG' && (
                                <select
                                  value={item.product_id ?? ''}
                                  onChange={(e) => {
                                    const id = e.target.value;
                                    const master = productsList.find((p) => p.product_id === parseInt(id, 10));
                                    if (master) updatePrItem(idx, { product_id: master.product_id, raw_material_id: undefined, pack_material_id: undefined, code: master.product_code, name: master.product_name, unit: 'PCS' });
                                  }}
                                  className="w-full min-w-[12rem] px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Select product…</option>
                                  {productsList.map((p) => (
                                    <option key={p.product_id} value={p.product_id}>{p.product_code} — {p.product_name}</option>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={item.unit}
                                onChange={(e) => updatePrItem(idx, { unit: e.target.value })}
                                className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                              >
                                {['KG', 'PCS', 'L', 'ML', 'G', 'BOX', 'CTN'].map((u) => (
                                  <option key={u} value={u}>{u}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">{item.required.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-orange-600">{item.sih.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-red-600 font-medium">{item.shortage > 0 ? `+${item.shortage.toLocaleString()}` : '0'}</td>
                            <td className="px-3 py-2 text-right">
                              <input type="number" min={0} value={item.quantity_requested} onChange={(e) => updatePrItem(idx, { quantity_requested: parseFloat(e.target.value) || 0 })} className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-2 focus:ring-blue-500" />
                            </td>
                            <td className="px-3 py-2">
                              <input type="text" value={item.line_notes ?? ''} onChange={(e) => updatePrItem(idx, { line_notes: e.target.value })} placeholder="Line notes" className="w-full min-w-[6rem] px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500" />
                            </td>
                            <td className="px-2 py-2">
                              <button type="button" onClick={() => removePrLine(idx)} className="text-red-600 hover:text-red-800 text-xs font-medium" title="Remove line">X</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <button type="button" onClick={addPrLine} className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 border border-gray-300 bg-white hover:bg-gray-50">
                  + Add line (RM/PM/FG)
                </button>
              </div>
            </div>
            <div className="border-t border-gray-200 p-6 flex gap-3 justify-end">
              <button onClick={() => { setPrModalOpen(false); setSelectedSO(null); setPrShowPMOnly(false); setPrOmittedCount(0); }} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-transparent hover:bg-gray-100 transition-colors disabled:opacity-50" disabled={prSending}>Cancel</button>
              <button onClick={handleSendToProcurement} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2" disabled={prSending}>
                {prSending ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Sending...</>) : 'Send to Procurement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Planning;
