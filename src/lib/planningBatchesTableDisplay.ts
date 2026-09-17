import {
  BATCH_LIFECYCLE_PIPELINE,
  getBatchLifecycleDisplayStage,
  type BmrStatus,
  type BprStatus,
} from './batchLifecycle';
import { batchUnitsFromSize, formatPisTableDate } from './pisExtractedTableDisplay';
import type { PlanningBatchAllRow } from '../services/planningExtracted.service';
import type {
  SoPlanningAvailabilityResponse,
  SoPlanningAvailabilityItem,
  SoPlanningBatchAvailabilityRow,
} from '../services/fulfillment.service';
import type { BatchRow } from '../services/production.service';
import type { FFStatus } from '../types/orderFulfillment';
import { formatQtyExact } from '../utils/formatQty';

export type PlanningBatchTableSortColumn =
  | 'created'
  | 'batchNo'
  | 'soNo'
  | 'soDate'
  | 'client'
  | 'product'
  | 'plannedQty'
  | 'batchSize'
  | 'rmStatus'
  | 'pmStatus'
  | 'production'
  | 'fulfillment';

export interface PlanningBatchMaterialStatusView {
  label: string;
  sub: string | null;
  tone: 'ok' | 'warn' | 'bad' | 'neutral';
}

export interface PlanningBatchProductionView {
  label: string;
  sub: string | null;
  tone: 'ok' | 'warn' | 'bad' | 'neutral';
}

const FF_STATUS_LABELS: Record<FFStatus, string> = {
  wip: 'WIP',
  fg_pending: 'FG Pending',
  bulk_qc: 'Bulk QC',
  fg_ready: 'FG Ready',
  picking: 'Picking',
  invoiced: 'Invoiced',
  shipped: 'Shipped',
  delivered: 'Delivered',
  closed: 'Closed',
};

function toneClass(tone: PlanningBatchMaterialStatusView['tone']): string {
  switch (tone) {
    case 'ok':
      return 'text-emerald-700 font-semibold';
    case 'warn':
      return 'text-amber-700 font-semibold';
    case 'bad':
      return 'text-red-700 font-semibold';
    default:
      return 'text-gray-500';
  }
}

export function planningBatchMaterialStatusClass(tone: PlanningBatchMaterialStatusView['tone']): string {
  return toneClass(tone);
}

export function planningBatchProductionStatusClass(tone: PlanningBatchProductionView['tone']): string {
  return toneClass(tone);
}

export function formatPlanningBatchCreatedDate(raw: string | null | undefined): string {
  return formatPisTableDate(raw);
}

export function formatPlanningBatchSoDate(raw: string | null | undefined): string {
  return formatPisTableDate(raw);
}

export function computePlanningBatchPlannedQty(row: PlanningBatchAllRow): number {
  return batchUnitsFromSize(
    {
      id: String(row.planningExtractedId),
      orderQty: row.orderQty ?? '',
      totalKg: row.totalKg ?? '',
      orderDate: row.orderDate ?? '',
    },
    row.sizeKg,
  );
}

export function formatPlanningBatchPlannedQty(units: number): string {
  if (units <= 0) return '—';
  return `${units.toLocaleString()} pcs`;
}

export function formatPlanningBatchSizeKg(sizeKg: number | null | undefined): string {
  if (sizeKg == null || !Number.isFinite(Number(sizeKg))) return '—';
  return formatQtyExact(Number(sizeKg), 'kg');
}

/** Product-only match (no batch/sequence) — same rule findPlanningBatchAvailability uses per-batch. */
function matchPlanningAvailabilityItem(
  availability: SoPlanningAvailabilityResponse | undefined,
  productCode: string | undefined,
  productName: string | undefined,
): SoPlanningAvailabilityItem | null {
  if (!availability?.items?.length) return null;
  const code = String(productCode ?? '').trim().toLowerCase();
  const name = String(productName ?? '').trim().toLowerCase();
  for (const item of availability.items) {
    const sku = String(item.sku ?? '').trim().toLowerCase();
    const itemName = String(item.productName ?? '').trim().toLowerCase();
    const productMatches =
      !code && !name
        ? true
        : (code && sku === code) || (name && itemName === name) || availability.items.length === 1;
    if (productMatches) return item;
  }
  return null;
}

export function findPlanningBatchAvailability(
  availability: SoPlanningAvailabilityResponse | undefined,
  row: PlanningBatchAllRow,
): SoPlanningBatchAvailabilityRow | null {
  if (!availability?.items?.length) return null;
  const productCode = String(row.productCode ?? '').trim().toLowerCase();
  const productName = String(row.productName ?? '').trim().toLowerCase();
  for (const item of availability.items) {
    const sku = String(item.sku ?? '').trim().toLowerCase();
    const name = String(item.productName ?? '').trim().toLowerCase();
    const productMatches =
      !productCode && !productName
        ? true
        : (productCode && sku === productCode) ||
          (productName && name === productName) ||
          availability.items.length === 1;
    if (!productMatches) continue;
    const match = item.batches.find((b) => Number(b.sequence) === Number(row.sequence));
    if (match) return match;
  }
  return null;
}

/**
 * Units already fulfilled (invoiced/shipped/delivered — e.g. via Fast Forward) for a product on an
 * SO, matched the same way findPlanningBatchAvailability matches a batch — product_code/name, or the
 * sole item when an SO has just one line. Used to reduce "Pending to plan" so an already-fulfilled
 * portion doesn't keep demanding a fresh batch be planned for it.
 */
export function findFulfilledUnitsForPlanningItem(
  availability: SoPlanningAvailabilityResponse | undefined,
  productCode: string | undefined,
  productName: string | undefined,
): number {
  const item = matchPlanningAvailabilityItem(availability, productCode, productName);
  return Math.max(0, Number(item?.fulfilledUnits) || 0);
}

function buildMaterialStatusFromAvailability(
  kind: 'RM' | 'PM',
  avail: SoPlanningBatchAvailabilityRow | null | undefined,
): PlanningBatchMaterialStatusView {
  // Labels follow the spec §8.2 / §5 controlled vocabulary
  // (AVAILABLE / PLANNING PENDING / PLANNED / UNDER PROCUREMENT / SHORTAGE).
  if (!avail) return { label: '—', sub: null, tone: 'neutral' };
  if (kind === 'RM') {
    // Batch needs no RM at all (e.g. a PM-only / packaging-only batch): nothing to procure — it's ready.
    if ((Number(avail.rmNeededTotalKg) || 0) <= 0.01) return { label: 'AVAILABLE', sub: 'no RM required', tone: 'ok' };
    if (avail.rmStartable) return { label: 'AVAILABLE', sub: 'stock covers batch', tone: 'ok' };
    if (avail.rmRemainingTotalKg > 0.01) {
      return {
        label: 'SHORTAGE',
        sub: `${formatQtyExact(avail.rmRemainingTotalKg, 'kg')} short`,
        tone: 'bad',
      };
    }
    return { label: 'UNDER PROCUREMENT', sub: 'procurement in flight', tone: 'warn' };
  }
  // Batch needs no PM at all (e.g. an RM-only / bulk intermediate): nothing to procure — it's ready.
  if ((Number(avail.pmNeededTotalUnits) || 0) <= 0) return { label: 'AVAILABLE', sub: 'no PM required', tone: 'ok' };
  if (avail.pmStartable) return { label: 'AVAILABLE', sub: 'stock covers batch', tone: 'ok' };
  if (avail.pmRemainingTotalUnits > 0) {
    return {
      label: 'SHORTAGE',
      sub: `${Math.round(avail.pmRemainingTotalUnits).toLocaleString()} pcs short`,
      tone: 'bad',
    };
  }
  return { label: 'UNDER PROCUREMENT', sub: 'procurement in flight', tone: 'warn' };
}

export function buildPlanningBatchRmStatusView(
  avail: SoPlanningBatchAvailabilityRow | null | undefined,
  releaseSplit?: { released: number; total: number },
): PlanningBatchMaterialStatusView {
  if (avail) return buildMaterialStatusFromAvailability('RM', avail);
  if (!releaseSplit || releaseSplit.total <= 0) return { label: '—', sub: null, tone: 'neutral' };
  if (releaseSplit.released >= releaseSplit.total) {
    return { label: 'UNDER PROCUREMENT', sub: `${releaseSplit.released}/${releaseSplit.total} released`, tone: 'ok' };
  }
  if (releaseSplit.released > 0) {
    return {
      label: 'UNDER PROCUREMENT',
      sub: `${releaseSplit.released}/${releaseSplit.total} released`,
      tone: 'warn',
    };
  }
  return { label: 'PLANNING PENDING', sub: `${releaseSplit.total} lines`, tone: 'bad' };
}

export function buildPlanningBatchPmStatusView(
  avail: SoPlanningBatchAvailabilityRow | null | undefined,
  releaseSplit?: { released: number; total: number },
): PlanningBatchMaterialStatusView {
  if (avail) return buildMaterialStatusFromAvailability('PM', avail);
  if (!releaseSplit || releaseSplit.total <= 0) return { label: '—', sub: null, tone: 'neutral' };
  if (releaseSplit.released >= releaseSplit.total) {
    return { label: 'UNDER PROCUREMENT', sub: `${releaseSplit.released}/${releaseSplit.total} released`, tone: 'ok' };
  }
  if (releaseSplit.released > 0) {
    return {
      label: 'UNDER PROCUREMENT',
      sub: `${releaseSplit.released}/${releaseSplit.total} released`,
      tone: 'warn',
    };
  }
  return { label: 'PLANNING PENDING', sub: `${releaseSplit.total} lines`, tone: 'bad' };
}

export function buildPlanningBatchProductionView(
  row: PlanningBatchAllRow,
  prod?: BatchRow,
): PlanningBatchProductionView {
  if (!row.sent) return { label: 'Not sent', sub: null, tone: 'neutral' };
  if (!prod) return { label: 'Awaiting sync', sub: 'No production batch', tone: 'warn' };
  const stage = getBatchLifecycleDisplayStage({
    bmrStatus: (prod.bmrStatus ?? 'draft') as BmrStatus,
    bprStatus: (prod.bprStatus ?? 'draft') as BprStatus,
    rmConnected: Boolean(prod.rmConnected),
    pmConnected: Boolean(prod.pmConnected),
    pmReserved: Boolean(prod.pmReserved),
    bulkBatchAccepted: prod.bulkBatchAccepted,
    fillBatchAccepted: prod.fillBatchAccepted,
    fgBatchAccepted: prod.fgBatchAccepted,
  });
  const label =
    BATCH_LIFECYCLE_PIPELINE.find((step) => step.key === stage)?.label ??
    String(stage).replace(/_/g, ' ');
  const tone: PlanningBatchProductionView['tone'] =
    stage === 'fg_ready' || prod.bprStatus === 'fg_ready' ? 'ok' : 'warn';
  return { label, sub: prod.batchNo ? `BMR ${prod.batchNo}` : null, tone };
}

export function buildPlanningBatchFulfillmentView(
  prod: BatchRow | undefined,
  ffStatus: FFStatus | undefined,
): PlanningBatchMaterialStatusView {
  if (ffStatus) {
    const label = FF_STATUS_LABELS[ffStatus] ?? ffStatus.replace(/_/g, ' ');
    const tone: PlanningBatchMaterialStatusView['tone'] =
      ffStatus === 'shipped' || ffStatus === 'delivered' || ffStatus === 'closed'
        ? 'ok'
        : ffStatus === 'fg_ready' || ffStatus === 'picking' || ffStatus === 'invoiced'
          ? 'warn'
          : 'neutral';
    return { label, sub: null, tone };
  }
  if (!prod) return { label: '—', sub: null, tone: 'neutral' };
  if (prod.bprStatus === 'fg_ready' || prod.fgBatchAccepted === true) {
    return { label: 'FG Ready', sub: 'awaiting pick', tone: 'warn' };
  }
  return { label: '—', sub: null, tone: 'neutral' };
}

export function sortValueForPlanningBatchTableRow(
  row: PlanningBatchAllRow,
  col: PlanningBatchTableSortColumn,
  context: {
    plannedQty: number;
    rmStatus: PlanningBatchMaterialStatusView;
    pmStatus: PlanningBatchMaterialStatusView;
    production: PlanningBatchProductionView;
    fulfillment: PlanningBatchMaterialStatusView;
  },
): string | number {
  switch (col) {
    case 'created':
      return row.createdAt ? new Date(row.createdAt).getTime() : 0;
    case 'batchNo':
      return row.batchCode || '';
    case 'soNo':
      return row.soNumber || '';
    case 'soDate':
      return row.orderDate ? new Date(row.orderDate).getTime() : 0;
    case 'client':
      return row.customerName || '';
    case 'product':
      return row.productName || row.productCode || '';
    case 'plannedQty':
      return context.plannedQty;
    case 'batchSize':
      return Number(row.sizeKg) || 0;
    case 'rmStatus':
      return context.rmStatus.label;
    case 'pmStatus':
      return context.pmStatus.label;
    case 'production':
      return context.production.label;
    case 'fulfillment':
      return context.fulfillment.label;
    default:
      return '';
  }
}
