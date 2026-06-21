/**
 * Lifecycle-based execution % for sale orders (plan → procurement → production → pick → invoice → ship → deliver).
 * Per-batch score is weighted by plannedQty when aggregating to a line / SO.
 */

import type { BatchSplit, FFStatus, OrderItem } from '../types/orderFulfillment';
import {
  batchLifecycleProgress01,
  getBatchLifecycleStage,
  type BmrStatus,
  type BprStatus,
} from './batchLifecycle';

/** Weights sum to 1 — each phase is a slice of full fulfillment. */
export const FULFILLMENT_EXEC_PHASE_WEIGHTS = {
  planBatch: 0.08,
  procurement: 0.12,
  production: 0.35,
  picking: 0.1,
  invoiced: 0.12,
  shipped: 0.13,
  delivered: 0.1,
} as const;

export interface ExecPlanningBatchRow {
  sent: boolean;
  rmNeededTotalKg: number;
  rmRemainingTotalKg: number;
  pmNeededTotalUnits: number;
  pmRemainingTotalUnits: number;
  rmStartable: boolean;
  pmStartable: boolean;
}

export interface ExecPlanningItem {
  totalBatches: number;
  sentCount: number;
  rmStartedCount: number;
  pmStartedCount: number;
  rmLineAvailableCount?: number;
  rmLineTotalCount?: number;
  pmLineAvailableCount?: number;
  pmLineTotalCount?: number;
  batches?: ExecPlanningBatchRow[];
}

function clamp01(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function resolvePlanningBatchRow(
  planning: ExecPlanningItem | null | undefined,
  splitIndex: number,
  splitCount: number
): ExecPlanningBatchRow | undefined {
  const rows = planning?.batches;
  if (!rows?.length) return undefined;
  if (rows.length === splitCount) return rows[splitIndex];
  return undefined;
}

function normalizeProdStatus(status: string | null | undefined): string {
  return (status ?? '').trim().toLowerCase();
}

/** Draft / missing production status — BMR-BPR numbers may exist but no real work yet. */
function isProductionPlaceholderOnly(split: BatchSplit): boolean {
  const bmr = normalizeProdStatus(split.bmrStatus);
  const bpr = normalizeProdStatus(split.bprStatus);
  if (!bmr && !bpr) return true;
  const notStarted = new Set(['', 'draft']);
  return notStarted.has(bmr) && notStarted.has(bpr);
}

function hasProcurementStarted(
  planning: ExecPlanningItem | null | undefined,
  batchRow: ExecPlanningBatchRow | undefined
): boolean {
  if (batchRow) {
    if (batchRow.sent) return true;
    const rmNeed = Math.max(0, Number(batchRow.rmNeededTotalKg) || 0);
    const pmNeed = Math.max(0, Number(batchRow.pmNeededTotalUnits) || 0);
    const rmRem = Math.max(0, Number(batchRow.rmRemainingTotalKg) || 0);
    const pmRem = Math.max(0, Number(batchRow.pmRemainingTotalUnits) || 0);
    if (rmNeed > 0 && rmRem < rmNeed) return true;
    if (pmNeed > 0 && pmRem < pmNeed) return true;
    return false;
  }
  if (!planning) return false;
  if ((planning.sentCount ?? 0) > 0) return true;
  if ((planning.rmStartedCount ?? 0) > 0) return true;
  if ((planning.pmStartedCount ?? 0) > 0) return true;
  return false;
}

/** True when a split is still a placeholder — no production / fulfillment work yet. */
function isBatchSplitNotStarted(
  split: BatchSplit,
  planning: ExecPlanningItem | null | undefined,
  batchRow: ExecPlanningBatchRow | undefined
): boolean {
  const st = (split.ffStatus ?? 'fg_pending') as FFStatus;
  if (st !== 'fg_pending') return false;
  if (batchRow?.sent) return false;
  if (planning && (planning.sentCount ?? 0) > 0) return false;

  const fgQty = Math.max(0, Number(split.fgQty) || 0);
  const pickedQty = Math.max(0, Number(split.pickedQty) || 0);
  if (fgQty > 0 || pickedQty > 0) return false;
  if (!isProductionPlaceholderOnly(split)) return false;
  if (hasProcurementStarted(planning, batchRow)) return false;

  return true;
}

function planBatchProgress01(
  planning: ExecPlanningItem | null | undefined,
  batchRow: ExecPlanningBatchRow | undefined,
  split: BatchSplit
): number {
  if (batchRow) return batchRow.sent ? 1 : 0;
  if (planning && planning.totalBatches > 0) {
    return clamp01(planning.sentCount / planning.totalBatches);
  }
  if (isProductionPlaceholderOnly(split)) return 0;
  const hasBmr = Boolean(split.bmrNo?.trim());
  const hasBpr = Boolean(split.bprNo?.trim());
  if (hasBmr && hasBpr) return 0.75;
  if (hasBmr || hasBpr) return 0.4;
  return 0;
}

function procurementProgress01(
  planning: ExecPlanningItem | null | undefined,
  batchRow: ExecPlanningBatchRow | undefined,
  split: BatchSplit,
  st: FFStatus
): number {
  const postProc: FFStatus[] = ['fg_ready', 'picking', 'invoiced', 'shipped', 'delivered', 'closed'];
  if (postProc.includes(st)) return 1;

  if (batchRow) {
    const rmNeed = Math.max(0, Number(batchRow.rmNeededTotalKg) || 0);
    const pmNeed = Math.max(0, Number(batchRow.pmNeededTotalUnits) || 0);
    const rmRem = Math.max(0, Number(batchRow.rmRemainingTotalKg) || 0);
    const pmRem = Math.max(0, Number(batchRow.pmRemainingTotalUnits) || 0);
    const rm = rmNeed <= 0 ? 1 : clamp01((rmNeed - rmRem) / rmNeed);
    const pm = pmNeed <= 0 ? 1 : clamp01((pmNeed - pmRem) / pmNeed);
    return (rm + pm) / 2;
  }

  if (planning) {
    const rt = planning.rmLineTotalCount ?? 0;
    const ra = planning.rmLineAvailableCount ?? 0;
    const pt = planning.pmLineTotalCount ?? 0;
    const pa = planning.pmLineAvailableCount ?? 0;
    if (rt > 0 || pt > 0) {
      const rmPart = rt > 0 ? ra / rt : 1;
      const pmPart = pt > 0 ? pa / pt : 1;
      return clamp01((rmPart + pmPart) / 2);
    }
    const tb = Math.max(1, planning.totalBatches || 1);
    const rmS = clamp01((planning.rmStartedCount ?? 0) / tb);
    const pmS = clamp01((planning.pmStartedCount ?? 0) / tb);
    return (rmS + pmS) / 2;
  }

  if (st === 'wip' || st === 'bulk_qc') return 0.5;
  if (isProductionPlaceholderOnly(split)) return 0;
  if (split.bmrNo?.trim()) return 0.25;
  return 0;
}


function productionProgressFromBatchStatuses(split: BatchSplit | undefined): number | null {
  if (!split) return null;
  const bmr = normalizeProdStatus(split.bmrStatus) as BmrStatus | '';
  const bpr = normalizeProdStatus(split.bprStatus) as BprStatus | '';
  if (!bmr && !bpr) return null;
  const stage = getBatchLifecycleStage({
    bmrStatus: (bmr || 'draft') as BmrStatus,
    bprStatus: (bpr || 'draft') as BprStatus,
  });
  return batchLifecycleProgress01(stage);
}

/** 0–1 within the production slice (before picking). */
export function productionSliceProgress01(st: FFStatus, split?: BatchSplit): number {
  const fromBatch = productionProgressFromBatchStatuses(split);
  if (fromBatch != null) return fromBatch;

  switch (st) {
    case 'fg_pending':
      return 0;
    case 'wip':
      return 0.38;
    case 'bulk_qc':
      return 0.68;
    case 'fg_ready':
    case 'picking':
    case 'invoiced':
    case 'shipped':
    case 'delivered':
    case 'closed':
      return 1;
    default:
      return 0.08;
  }
}

/**
 * 0–1 fulfillment execution for one batch split.
 * When planning rows align 1:1 with splits, per-batch plan/proc use that row; otherwise line-level planning is used.
 */
export function computeBatchSplitExecutionFraction(
  split: BatchSplit,
  splitIndex: number,
  splitCount: number,
  planning: ExecPlanningItem | null | undefined
): number {
  const st = (split.ffStatus ?? 'fg_pending') as FFStatus;
  const batchRow = resolvePlanningBatchRow(planning, splitIndex, splitCount);

  if (isBatchSplitNotStarted(split, planning, batchRow)) return 0;

  const w = FULFILLMENT_EXEC_PHASE_WEIGHTS;

  const terminal = st === 'delivered' || st === 'closed';
  const pPlan = terminal ? 1 : planBatchProgress01(planning, batchRow, split);
  const pProc = terminal ? 1 : procurementProgress01(planning, batchRow, split, st);
  const pProd = productionSliceProgress01(st, split);

  let score = w.planBatch * pPlan + w.procurement * pProc + w.production * pProd;

  if (['picking', 'invoiced', 'shipped', 'delivered', 'closed'].includes(st)) score += w.picking;
  if (['invoiced', 'shipped', 'delivered', 'closed'].includes(st)) score += w.invoiced;
  if (['shipped', 'delivered', 'closed'].includes(st)) score += w.shipped;
  if (['delivered', 'closed'].includes(st)) score += w.delivered;

  return clamp01(score);
}

/**
 * 0–100 for one order line.
 * Weight each batch by plannedQty; divide by line orderedQty so unallocated quantity counts as 0% progress.
 * If planned totals exceed orderedQty, scale down (over-allocation) so the line cannot exceed 100%.
 */
export function computeOrderItemExecutionPercent(
  item: OrderItem,
  planning: ExecPlanningItem | null | undefined
): number {
  const splits = item.batchSplits || [];
  if (splits.length === 0) return 0;

  const ordered = Math.max(0, Number(item.orderedQty) || 0);
  const n = splits.length;
  const plannedWeights = splits.map((sp) => Math.max(0, Number(sp.plannedQty) || 0));
  const sumPlanned = plannedWeights.reduce((a, b) => a + b, 0);

  const scoreSplit = (i: number) =>
    computeBatchSplitExecutionFraction(splits[i], i, n, planning);

  if (sumPlanned <= 0) {
    if (ordered <= 0) {
      let sumF = 0;
      for (let i = 0; i < n; i++) sumF += scoreSplit(i);
      return Math.round(clamp01(sumF / n) * 100);
    }
    const wEach = ordered / n;
    let sumS = 0;
    for (let i = 0; i < n; i++) sumS += wEach * scoreSplit(i);
    return Math.round(clamp01(sumS / ordered) * 100);
  }

  let sumS = 0;
  for (let i = 0; i < n; i++) {
    sumS += plannedWeights[i] * scoreSplit(i);
  }

  if (ordered <= 0) {
    return Math.round(clamp01(sumS / sumPlanned) * 100);
  }

  if (sumPlanned > ordered) {
    sumS *= ordered / sumPlanned;
  }

  return Math.round(clamp01(sumS / ordered) * 100);
}
