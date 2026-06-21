import { describe, expect, it } from 'vitest';
import {
  BATCH_LIFECYCLE_PIPELINE,
  batchLifecycleProgress01,
  batchMatchesLifecycleFilter,
  bmrBulkQcReleased,
  canReservePmForBatchLifecycle,
  canShowPackagingActions,
  formatUnifiedBatchLabel,
  formatUnifiedBatchLabelShort,
  getBatchLifecycleDisplayStage,
  getBatchLifecycleStage,
  isPackagingPhase,
  pipelineLifecycleIndex,
} from '../batchLifecycle';

const baseBatch = {
  bmrStatus: 'draft' as const,
  bprStatus: 'draft' as const,
  rmConnected: false,
  pmConnected: false,
  pmReserved: false,
  bulkBatchAccepted: null,
  fillBatchAccepted: null,
  fgBatchAccepted: null,
};

describe('batchLifecycle', () => {
  it('defines 18 unified pipeline steps ending at fg_ready', () => {
    expect(BATCH_LIFECYCLE_PIPELINE).toHaveLength(18);
    expect(BATCH_LIFECYCLE_PIPELINE[0]?.key).toBe('draft');
    expect(BATCH_LIFECYCLE_PIPELINE[8]?.key).toBe('cleared');
    expect(BATCH_LIFECYCLE_PIPELINE[9]?.key).toBe('pm_reserved');
    expect(BATCH_LIFECYCLE_PIPELINE[BATCH_LIFECYCLE_PIPELINE.length - 1]?.key).toBe('fg_ready');
  });

  it('resolves manufacturing stage before BMR cleared', () => {
    expect(getBatchLifecycleStage({ ...baseBatch, bmrStatus: 'in_production' })).toBe('in_production');
    expect(getBatchLifecycleDisplayStage({ ...baseBatch, bmrStatus: 'rm_reserved' }, { effectiveRmConnected: true })).toBe(
      'rm_connected',
    );
  });

  it('maps BPR scheduled to fill_scheduled after cleared', () => {
    const cleared = {
      ...baseBatch,
      bmrStatus: 'cleared' as const,
      bprStatus: 'scheduled' as const,
      bulkBatchAccepted: true,
    };
    expect(getBatchLifecycleStage(cleared)).toBe('fill_scheduled');
    expect(isPackagingPhase(getBatchLifecycleStage(cleared))).toBe(true);
  });

  it('stays at cleared when BMR cleared but BPR still draft', () => {
    expect(
      getBatchLifecycleStage({ ...baseBatch, bmrStatus: 'cleared', bulkBatchAccepted: true }),
    ).toBe('cleared');
  });

  it('gates packaging actions on BMR bulk QC release', () => {
    expect(canShowPackagingActions({ ...baseBatch, bmrStatus: 'in_production' })).toBe(false);
    expect(canShowPackagingActions({ ...baseBatch, bmrStatus: 'cleared' })).toBe(true);
    expect(canShowPackagingActions({ ...baseBatch, bmrStatus: 'bulk_qc', bulkBatchAccepted: true })).toBe(true);
  });

  it('blocks PM reserve until BMR cleared', () => {
    expect(canReservePmForBatchLifecycle({ ...baseBatch, bmrStatus: 'batch_confirmed' })).toBe(false);
    expect(canReservePmForBatchLifecycle({ ...baseBatch, bmrStatus: 'cleared' })).toBe(true);
    expect(
      canReservePmForBatchLifecycle({ ...baseBatch, bmrStatus: 'cleared', pmReserved: true }),
    ).toBe(false);
  });

  it('computes linear progress monotonically', () => {
    expect(pipelineLifecycleIndex('draft')).toBe(0);
    expect(pipelineLifecycleIndex('cleared')).toBe(8);
    expect(pipelineLifecycleIndex('fg_ready')).toBe(17);
    expect(batchLifecycleProgress01('cleared')).toBeLessThan(batchLifecycleProgress01('fg_ready'));
  });

  it('filters batches by lifecycle bucket', () => {
    expect(batchMatchesLifecycleFilter({ ...baseBatch, bmrStatus: 'draft' }, 'pending')).toBe(true);
    expect(batchMatchesLifecycleFilter({ ...baseBatch, bmrStatus: 'in_production' }, 'in_mfg')).toBe(true);
    expect(
      batchMatchesLifecycleFilter(
        { ...baseBatch, bmrStatus: 'cleared', bprStatus: 'filling', bulkBatchAccepted: true },
        'packaging',
      ),
    ).toBe(true);
    expect(batchMatchesLifecycleFilter({ ...baseBatch, bprStatus: 'fg_ready' }, 'fg_ready')).toBe(true);
  });

  it('treats bulkBatchAccepted as released for bmrBulkQcReleased', () => {
    expect(bmrBulkQcReleased({ ...baseBatch, bmrStatus: 'bulk_qc', bulkBatchAccepted: true })).toBe(true);
  });

  it('formatUnifiedBatchLabel uses planning batchNo with optional sequence', () => {
    expect(formatUnifiedBatchLabel({ batchNo: 'B-2026-007', batchIndex: 1, totalBatches: 3, bmrNo: 'BMR-2026-001' })).toBe(
      'B-2026-007 (1/3)',
    );
    expect(formatUnifiedBatchLabel({ batchNo: 'B-2026-007', batchIndex: 1, totalBatches: 1, bmrNo: 'BMR-2026-001' })).toBe(
      'B-2026-007',
    );
    expect(formatUnifiedBatchLabel({ batchNo: '', bmrNo: 'BMR-2026-001' })).toBe('BMR-2026-001');
  });

  it('formatUnifiedBatchLabelShort returns batchNo without sequence', () => {
    expect(formatUnifiedBatchLabelShort({ batchNo: 'B-2026-007', batchIndex: 2, totalBatches: 3, bmrNo: 'BMR-2026-001' })).toBe(
      'B-2026-007',
    );
  });
});
