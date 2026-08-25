import { parsePlanningSlaTimestamp } from '../utils/planningSlaDates';
import type { PlanningBatchAllRow } from '../services/planningExtracted.service';
import type { BatchRow } from '../services/production.service';
import type { VendorClientRecord } from '../services/vendorClient.service';

export type PisBatchPipelineStage = 'PLANNING PENDING' | 'PROCUREMENT' | 'PRODUCTION' | 'COMPLETED';

export interface PisPlanBatchLine {
  key: string;
  batchLabel: string;
  units: number;
  coveragePct: number;
  stage: PisBatchPipelineStage;
}

export interface PisPlanStatusView {
  kind: 'pending' | 'batches';
  batchLines: PisPlanBatchLine[];
  summary: string | null;
  underCoveredUnits: number;
}

export interface PisSlaView {
  icon: '🚩' | '✓' | '⚠' | '';
  text: string;
  sub: string | null;
  tone: 'neutral' | 'ok' | 'warn' | 'breach';
}

export interface PisOrderDisplayInput {
  id: string;
  orderQty: string;
  totalKg: string;
  orderDate: string;
  createdAt?: string | null;
  bomConfirmedAt?: string | null;
  customerName?: string;
  sentBatchIndices?: number[];
  customBatches?: { sizeKg: number }[] | null;
}

const SLA_DAYS = 2;
const PRODUCTION_BMR_STAGES = new Set([
  'rm_connected',
  'dispensing',
  'in_production',
  'bulk_qc',
  'cleared',
]);
const PRODUCTION_BPR_STAGES = new Set([
  'pm_connected',
  'pm_dispensing',
  'filling',
  'fill_qc',
  'packaging',
  'pack_qc',
]);

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

function daysBetweenFloor(start: Date, end: Date): number {
  const ms = Math.max(0, end.getTime() - start.getTime());
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function formatPisTableDate(raw: string | null | undefined): string {
  const d = raw ? new Date(raw) : null;
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/ /g, '-');
}

export function formatPisOrdQty(orderQty: string): string {
  const n = parseUnitCount(orderQty);
  if (n <= 0) return orderQty?.trim() || '—';
  const suffix = /pcs/i.test(orderQty) ? ' pcs' : String(orderQty).replace(/[\d,.\s]/g, '').trim()
    ? ` ${String(orderQty).replace(/[\d,.\s]/g, '').trim()}`
    : ' pcs';
  return `${n.toLocaleString('en-IN')}${suffix}`;
}

export function lookupPisClientCode(
  customerName: string | undefined,
  clients: VendorClientRecord[],
): string {
  const key = String(customerName ?? '').trim().toLowerCase();
  if (!key) return '';
  const match = clients.find((c) => String(c.name ?? '').trim().toLowerCase() === key);
  if (!match) return '';
  const fromData = match.data?.entity_code ?? match.data?.entityCode;
  return String(match.entityCode ?? fromData ?? '').trim();
}

export function getBatchesForPisOrder(
  order: PisOrderDisplayInput,
  allBatches: PlanningBatchAllRow[],
): PlanningBatchAllRow[] {
  const fromApi = allBatches
    .filter((b) => String(b.planningExtractedId) === String(order.id))
    .sort((a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0));
  if (fromApi.length > 0) return fromApi;

  if (!Array.isArray(order.customBatches) || order.customBatches.length === 0) return [];

  const sent = new Set((order.sentBatchIndices ?? []).map(Number));
  return order.customBatches.map((cb, idx) => ({
    id: -(idx + 1),
    planningExtractedId: Number(order.id),
    sequence: idx + 1,
    batchCode: `PE-${order.id}-B${idx + 1}`,
    sizeKg: Number(cb.sizeKg) || 0,
    rmLines: [],
    pmLines: [],
    sent: sent.has(idx),
  }));
}

function resolveBatchDisplayLabel(batch: PlanningBatchAllRow, prod?: BatchRow): string {
  const prodNo = prod?.batchNo?.trim();
  if (prodNo) return prodNo;
  const code = batch.batchCode?.trim();
  if (code) return code;
  return `B-${String(batch.sequence ?? 1).padStart(2, '0')}`;
}

export function batchUnitsFromSize(order: PisOrderDisplayInput, sizeKg: number | null | undefined): number {
  const orderUnits = parseUnitCount(order.orderQty);
  const totalKg = parseKgCount(order.totalKg);
  if (orderUnits <= 0 || totalKg <= 0) return 0;
  const kgPerUnit = totalKg / orderUnits;
  const kg = Number(sizeKg) || 0;
  if (kg <= 0 || kgPerUnit <= 0) return 0;
  return Math.max(0, Math.round(kg / kgPerUnit));
}

export function getPisBatchPipelineStage(
  batch: PlanningBatchAllRow,
  prod?: BatchRow,
): PisBatchPipelineStage {
  if (prod) {
    const bmr = String(prod.bmrStatus ?? '').trim().toLowerCase();
    const bpr = String(prod.bprStatus ?? '').trim().toLowerCase();
    if (bpr === 'fg_ready' || prod.fgBatchAccepted === true) return 'COMPLETED';
    if (PRODUCTION_BMR_STAGES.has(bmr) || PRODUCTION_BPR_STAGES.has(bpr)) return 'PRODUCTION';
    if (batch.sent || bmr !== 'draft' || bpr !== 'draft') return 'PROCUREMENT';
  }
  if (batch.sent) return 'PROCUREMENT';
  return 'PROCUREMENT';
}

export function buildPisPlanStatusView(
  order: PisOrderDisplayInput,
  batches: PlanningBatchAllRow[],
  prodByPlanningBatchId: Map<number, BatchRow>,
): PisPlanStatusView {
  const orderUnits = parseUnitCount(order.orderQty);
  // Only batches actually sent to production are "created" batches. Opening the planning modal
  // auto-seeds the next batch's row (sized to whatever units are still unplanned) so the user has
  // something to work on — that row is a draft placeholder, not a commitment, and must not be shown
  // as an equal, separately-created batch or counted toward coverage. Its units belong in
  // underCoveredUnits (still pending) instead.
  const sentBatches = batches.filter((b) => b.sent);
  if (sentBatches.length === 0) {
    return { kind: 'pending', batchLines: [], summary: null, underCoveredUnits: orderUnits };
  }

  const batchLines: PisPlanBatchLine[] = sentBatches.map((batch) => {
    const prod = batch.id > 0 ? prodByPlanningBatchId.get(batch.id) : undefined;
    const units = batchUnitsFromSize(order, batch.sizeKg);
    const coveragePct =
      orderUnits > 0 ? Math.min(100, Math.round((units / orderUnits) * 100)) : 0;
    return {
      key: `${batch.planningExtractedId}-${batch.id}-${batch.sequence}`,
      batchLabel: resolveBatchDisplayLabel(batch, prod),
      units,
      coveragePct,
      stage: getPisBatchPipelineStage(batch, prod),
    };
  });

  const plannedUnits = batchLines.reduce((sum, line) => sum + line.units, 0);
  const totalCoveragePct =
    orderUnits > 0 ? Math.min(100, Math.round((plannedUnits / orderUnits) * 100)) : 0;
  const underCoveredUnits = Math.max(0, orderUnits - plannedUnits);
  const summary =
    batchLines.length > 1
      ? `Total cov: ${totalCoveragePct}% · ${batchLines.length} batches`
      : null;

  return {
    kind: 'batches',
    batchLines,
    summary,
    underCoveredUnits,
  };
}

export function buildPisSlaView(
  order: PisOrderDisplayInput,
  hasBatches: boolean,
  remainingUnits: number,
  nowMs: number = Date.now(),
): PisSlaView {
  const now = new Date(nowMs);
  const start =
    parsePlanningSlaTimestamp(order.createdAt) ??
    parsePlanningSlaTimestamp(order.orderDate) ??
    now;
  const openDays = daysBetweenFloor(start, now);

  if (!hasBatches && remainingUnits > 0) {
    // §9: breach when days_open > committed_plan_sla; amber "approaching" when within 1 day of it
    // and not yet planned. "committed Yd" is the FIXED commitment (SLA_DAYS), not elapsed days.
    const breached = openDays > SLA_DAYS;
    const approaching = !breached && SLA_DAYS - openDays <= 1;
    return {
      icon: breached ? '🚩' : approaching ? '⏱' : '',
      text: `${openDays}d open · committed ${SLA_DAYS}d`,
      sub: null,
      tone: breached ? 'breach' : approaching ? 'warn' : 'neutral',
    };
  }

  const confirmedAt = parsePlanningSlaTimestamp(order.bomConfirmedAt ?? null);
  const stopAt =
    remainingUnits <= 0 && confirmedAt
      ? confirmedAt.getTime() > now.getTime()
        ? now
        : confirmedAt
      : now;
  const plannedDays = Math.max(0, daysBetweenFloor(start, stopAt));
  const onTime = plannedDays <= SLA_DAYS;

  if (remainingUnits <= 0) {
    return {
      icon: onTime ? '✓' : '⚠',
      text: `planned in ${plannedDays}d`,
      sub: onTime ? null : `${SLA_DAYS}d SLA`,
      tone: onTime ? 'ok' : 'warn',
    };
  }

  if (openDays > SLA_DAYS) {
    return {
      icon: '⚠',
      text: `planned in ${plannedDays}d · ${SLA_DAYS}d SLA`,
      sub: null,
      tone: 'warn',
    };
  }

  return {
    icon: '',
    text: `${openDays}d open`,
    sub: null,
    tone: 'neutral',
  };
}

export function pisPlanStatusSortValue(view: PisPlanStatusView): number {
  if (view.kind === 'pending') return -1;
  if (view.underCoveredUnits > 0) {
    const covered = view.batchLines.reduce((sum, line) => sum + line.coveragePct, 0);
    return Math.min(99, covered);
  }
  return view.batchLines.reduce((sum, line) => sum + line.coveragePct, 0);
}

export function buildProdByPlanningBatchId(productionBatches: BatchRow[]): Map<number, BatchRow> {
  const map = new Map<number, BatchRow>();
  for (const row of productionBatches) {
    const id = row.planningBatchId != null ? Number(row.planningBatchId) : NaN;
    if (Number.isFinite(id) && id > 0) map.set(id, row);
  }
  return map;
}
