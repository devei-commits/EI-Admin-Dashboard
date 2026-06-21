/**
 * Unified linear batch lifecycle: manufacturing (BMR) then packaging (BPR).
 */

export type BmrStatus =
  | 'draft'
  | 'batch_confirmed'
  | 'rm_reserved'
  | 'scheduled'
  | 'rm_connected'
  | 'dispensing'
  | 'in_production'
  | 'bulk_qc'
  | 'qc_failed'
  | 'cleared';

export type BprStatus =
  | 'draft'
  | 'pm_reserved'
  | 'scheduled'
  | 'pm_connected'
  | 'pm_dispensing'
  | 'filling'
  | 'fill_qc'
  | 'packaging'
  | 'pack_qc'
  | 'qc_failed'
  | 'fg_ready';

/** Unified lifecycle stage keys (BPR `scheduled` → `fill_scheduled` in display). */
export type BatchLifecycleStage =
  | 'draft'
  | 'batch_confirmed'
  | 'rm_reserved'
  | 'scheduled'
  | 'rm_connected'
  | 'dispensing'
  | 'in_production'
  | 'bulk_qc'
  | 'cleared'
  | 'pm_reserved'
  | 'pm_connected'
  | 'pm_dispensing'
  | 'fill_scheduled'
  | 'filling'
  | 'fill_qc'
  | 'packaging'
  | 'pack_qc'
  | 'fg_ready';

export type BatchLifecyclePhase = 'manufacturing' | 'packaging';

export interface BatchLifecycleStep {
  key: BatchLifecycleStage;
  label: string;
  phase: BatchLifecyclePhase;
}

export interface BatchLifecycleInput {
  bmrStatus: BmrStatus;
  bprStatus: BprStatus;
  rmConnected?: boolean;
  pmConnected?: boolean;
  pmReserved?: boolean;
  bulkBatchAccepted?: boolean | null;
  fillBatchAccepted?: boolean | null;
  fgBatchAccepted?: boolean | null;
}

export interface BatchLifecycleDisplayOptions {
  effectiveRmConnected?: boolean;
  effectivePmConnected?: boolean;
}

export const BATCH_LIFECYCLE_PIPELINE: BatchLifecycleStep[] = [
  { key: 'draft', label: 'Draft', phase: 'manufacturing' },
  { key: 'batch_confirmed', label: 'Confirmed', phase: 'manufacturing' },
  { key: 'rm_reserved', label: 'RM Reserved', phase: 'manufacturing' },
  { key: 'scheduled', label: 'Scheduled', phase: 'manufacturing' },
  { key: 'rm_connected', label: 'RM Connected', phase: 'manufacturing' },
  { key: 'dispensing', label: 'Dispensing', phase: 'manufacturing' },
  { key: 'in_production', label: 'In Production', phase: 'manufacturing' },
  { key: 'bulk_qc', label: 'Bulk QC', phase: 'manufacturing' },
  { key: 'cleared', label: 'Bulk Cleared', phase: 'manufacturing' },
  { key: 'pm_reserved', label: 'PM Reserved', phase: 'packaging' },
  { key: 'pm_connected', label: 'PM Connected', phase: 'packaging' },
  { key: 'pm_dispensing', label: 'PM Dispensing', phase: 'packaging' },
  { key: 'fill_scheduled', label: 'Fill/Pack Scheduled', phase: 'packaging' },
  { key: 'filling', label: 'Filling', phase: 'packaging' },
  { key: 'fill_qc', label: 'Fill QC', phase: 'packaging' },
  { key: 'packaging', label: 'Packaging', phase: 'packaging' },
  { key: 'pack_qc', label: 'Pack QC', phase: 'packaging' },
  { key: 'fg_ready', label: 'FG Ready', phase: 'packaging' },
];

const MANUFACTURING_STAGES = new Set<BatchLifecycleStage>(
  BATCH_LIFECYCLE_PIPELINE.filter((s) => s.phase === 'manufacturing').map((s) => s.key),
);

const PACKAGING_STAGES = new Set<BatchLifecycleStage>(
  BATCH_LIFECYCLE_PIPELINE.filter((s) => s.phase === 'packaging').map((s) => s.key),
);

const BPR_TO_LIFECYCLE: Record<BprStatus, BatchLifecycleStage> = {
  draft: 'pm_reserved',
  pm_reserved: 'pm_reserved',
  pm_connected: 'pm_connected',
  pm_dispensing: 'pm_dispensing',
  scheduled: 'fill_scheduled',
  filling: 'filling',
  fill_qc: 'fill_qc',
  packaging: 'packaging',
  pack_qc: 'pack_qc',
  qc_failed: 'fill_qc',
  fg_ready: 'fg_ready',
};

export function bmrBulkQcReleased(batch: BatchLifecycleInput): boolean {
  return batch.bmrStatus === 'cleared' || batch.bulkBatchAccepted === true;
}

export function canShowPackagingActions(batch: BatchLifecycleInput): boolean {
  return bmrBulkQcReleased(batch);
}

export function canReservePmForBatchLifecycle(batch: BatchLifecycleInput): boolean {
  if (batch.pmReserved) return false;
  return bmrBulkQcReleased(batch);
}

/** Map BPR status to unified lifecycle stage (packaging phase only). */
export function bprStatusToLifecycleStage(bprStatus: BprStatus, batch: BatchLifecycleInput): BatchLifecycleStage {
  if (bprStatus === 'qc_failed') {
    if (batch.fillBatchAccepted === false) return 'fill_qc';
    if (batch.fgBatchAccepted === false) return 'pack_qc';
    return 'fill_qc';
  }
  return BPR_TO_LIFECYCLE[bprStatus] ?? 'pm_reserved';
}

/** Raw lifecycle stage from status fields (no MTR inference). */
export function getBatchLifecycleStage(batch: BatchLifecycleInput): BatchLifecycleStage {
  if (batch.bmrStatus === 'qc_failed') return 'bulk_qc';
  if (batch.bprStatus === 'qc_failed' && bmrBulkQcReleased(batch)) {
    return bprStatusToLifecycleStage('qc_failed', batch);
  }
  if (!bmrBulkQcReleased(batch) && batch.bmrStatus !== 'cleared') {
    if (batch.bmrStatus === 'cleared') return 'cleared';
    return batch.bmrStatus as BatchLifecycleStage;
  }
  if (batch.bprStatus === 'fg_ready') return 'fg_ready';
  if (batch.bmrStatus === 'cleared' && (batch.bprStatus === 'draft' || !batch.bprStatus)) {
    return 'cleared';
  }
  return bprStatusToLifecycleStage(batch.bprStatus, batch);
}

/** MTR-aware display stage (mirrors BMR/BPR pipeline strip logic). */
export function getBatchLifecycleDisplayStage(
  batch: BatchLifecycleInput,
  options: BatchLifecycleDisplayOptions = {},
): BatchLifecycleStage {
  const { effectiveRmConnected = false, effectivePmConnected = false } = options;

  if (batch.bmrStatus === 'qc_failed') return 'bulk_qc';

  if (!bmrBulkQcReleased(batch)) {
    const pastRmConnectUi: BmrStatus[] = [
      'dispensing',
      'in_production',
      'bulk_qc',
      'qc_failed',
      'cleared',
    ];
    if (pastRmConnectUi.includes(batch.bmrStatus)) return batch.bmrStatus as BatchLifecycleStage;
    if (
      effectiveRmConnected &&
      (batch.bmrStatus === 'rm_reserved' || batch.bmrStatus === 'scheduled')
    ) {
      return 'rm_connected';
    }
    return batch.bmrStatus as BatchLifecycleStage;
  }

  if (batch.bprStatus === 'qc_failed') {
    return bprStatusToLifecycleStage('qc_failed', batch);
  }

  if (batch.bprStatus === 'fg_ready') return 'fg_ready';

  if (batch.bprStatus === 'draft' || !batch.bprStatus) return 'cleared';

  if (effectivePmConnected && batch.bprStatus === 'pm_reserved') return 'pm_dispensing';

  return bprStatusToLifecycleStage(batch.bprStatus, batch);
}

export function isPackagingPhase(stage: BatchLifecycleStage): boolean {
  return PACKAGING_STAGES.has(stage);
}

export function isManufacturingPhase(stage: BatchLifecycleStage): boolean {
  return MANUFACTURING_STAGES.has(stage);
}

export function batchLifecycleLabel(stage: BatchLifecycleStage): string {
  return BATCH_LIFECYCLE_PIPELINE.find((s) => s.key === stage)?.label ?? stage;
}

export function batchLifecyclePhase(stage: BatchLifecycleStage): BatchLifecyclePhase {
  return isPackagingPhase(stage) ? 'packaging' : 'manufacturing';
}

export function pipelineLifecycleIndex(stage: BatchLifecycleStage): number {
  return BATCH_LIFECYCLE_PIPELINE.findIndex((s) => s.key === stage);
}

/** 0–1 progress through unified manufacturing + packaging lifecycle. */
export function batchLifecycleProgress01(stage: BatchLifecycleStage): number {
  const idx = pipelineLifecycleIndex(stage);
  if (idx < 0) return 0;
  const max = BATCH_LIFECYCLE_PIPELINE.length - 1;
  return max <= 0 ? 0 : idx / max;
}

export function isBatchLifecycleFailed(batch: BatchLifecycleInput): boolean {
  return batch.bmrStatus === 'qc_failed' || batch.bprStatus === 'qc_failed';
}

export function isBatchFgReady(batch: BatchLifecycleInput): boolean {
  return batch.bprStatus === 'fg_ready';
}

/** KPI / filter buckets for Batches view. */
export type BatchLifecycleFilter =
  | 'all'
  | 'pending'
  | 'in_mfg'
  | 'bulk_qc'
  | 'packaging'
  | 'fg_ready'
  | 'qc_failed';

export function batchMatchesLifecycleFilter(
  batch: BatchLifecycleInput,
  filter: BatchLifecycleFilter,
  displayOptions?: BatchLifecycleDisplayOptions,
): boolean {
  if (filter === 'all') return true;
  const stage = getBatchLifecycleDisplayStage(batch, displayOptions);
  if (filter === 'fg_ready') return batch.bprStatus === 'fg_ready';
  if (filter === 'qc_failed') {
    return batch.bmrStatus === 'qc_failed' || batch.bprStatus === 'qc_failed';
  }
  if (filter === 'pending') {
    return ['draft', 'batch_confirmed'].includes(batch.bmrStatus);
  }
  if (filter === 'in_mfg') {
    return [
      'rm_reserved',
      'scheduled',
      'rm_connected',
      'dispensing',
      'in_production',
    ].includes(batch.bmrStatus);
  }
  if (filter === 'bulk_qc') {
    return batch.bmrStatus === 'bulk_qc';
  }
  if (filter === 'packaging') {
    return bmrBulkQcReleased(batch) && batch.bprStatus !== 'fg_ready' && batch.bprStatus !== 'draft';
  }
  return true;
}

export interface UnifiedBatchLabelInput {
  batchNo?: string;
  bmrNo?: string;
  batchIndex?: number;
  totalBatches?: number;
}

/** Primary user-facing batch identifier (planning batch id), not BMR/BPR pair. */
export function formatUnifiedBatchLabel(batch: UnifiedBatchLabelInput): string {
  const id = String(batch.batchNo || '').trim();
  if (id) {
    const idx = Number(batch.batchIndex) || 0;
    const total = Number(batch.totalBatches) || 0;
    if (total > 1 && idx > 0) return `${id} (${idx}/${total})`;
    return id;
  }
  return String(batch.bmrNo || '').trim() || '—';
}

/** Batch id without sequence suffix — for compact dropdowns. */
export function formatUnifiedBatchLabelShort(batch: UnifiedBatchLabelInput): string {
  const id = String(batch.batchNo || '').trim();
  if (id) return id;
  return String(batch.bmrNo || '').trim() || '—';
}
