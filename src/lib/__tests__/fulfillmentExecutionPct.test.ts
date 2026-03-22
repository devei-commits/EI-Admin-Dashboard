import { describe, it, expect } from 'vitest';
import {
  computeBatchSplitExecutionFraction,
  computeOrderItemExecutionPercent,
  FULFILLMENT_EXEC_PHASE_WEIGHTS,
} from '../fulfillmentExecutionPct';
import type { BatchSplit, OrderItem } from '../../types/orderFulfillment';

describe('fulfillmentExecutionPct', () => {
  it('weights sum to 1', () => {
    const s = Object.values(FULFILLMENT_EXEC_PHASE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(s).toBeCloseTo(1, 5);
  });

  it('fg_ready alone is not 100%', () => {
    const split: BatchSplit = {
      bmrNo: 'BMR-1',
      bprNo: 'BPR-1',
      plannedQty: 1000,
      fgQty: 1000,
      fgLocation: null,
      ffStatus: 'fg_ready',
      pickedQty: 0,
      pickerName: null,
      pickDate: null,
      pickSlipNo: null,
      remarks: null,
      invoiceNo: null,
      awbNo: null,
      courier: null,
      dispatchDate: null,
      etaDate: null,
    };
    const f = computeBatchSplitExecutionFraction(split, 0, 1, null);
    expect(f).toBeLessThan(0.95);
    expect(f).toBeGreaterThan(0.35);
  });

  it('closed split reaches 100%', () => {
    const split: BatchSplit = {
      bmrNo: 'BMR-1',
      bprNo: 'BPR-1',
      plannedQty: 100,
      fgQty: 100,
      fgLocation: null,
      ffStatus: 'closed',
      pickedQty: 100,
      pickerName: null,
      pickDate: null,
      pickSlipNo: null,
      remarks: null,
      invoiceNo: 'INV-1',
      awbNo: 'AWB',
      courier: 'X',
      dispatchDate: '2026-01-01',
      etaDate: null,
    };
    expect(computeBatchSplitExecutionFraction(split, 0, 1, null)).toBe(1);
  });

  it('multi-batch line averages by plannedQty', () => {
    const item: OrderItem = {
      itemNo: '001',
      sku: 'S',
      productName: 'P',
      pack: '—',
      orderedQty: 300,
      rate: 1,
      unitPrice: 1,
      batchSplits: [
        {
          bmrNo: 'A',
          bprNo: 'B',
          plannedQty: 100,
          fgQty: 100,
          fgLocation: null,
          ffStatus: 'closed',
          pickedQty: 100,
          pickerName: null,
          pickDate: null,
          pickSlipNo: null,
          remarks: null,
          invoiceNo: null,
          awbNo: null,
          courier: null,
          dispatchDate: null,
          etaDate: null,
        },
        {
          bmrNo: 'A2',
          bprNo: 'B2',
          plannedQty: 200,
          fgQty: 0,
          fgLocation: null,
          ffStatus: 'fg_pending',
          pickedQty: 0,
          pickerName: null,
          pickDate: null,
          pickSlipNo: null,
          remarks: null,
          invoiceNo: null,
          awbNo: null,
          courier: null,
          dispatchDate: null,
          etaDate: null,
        },
      ],
    };
    const pct = computeOrderItemExecutionPercent(item, null);
    expect(pct).toBeGreaterThan(30);
    expect(pct).toBeLessThan(100);
  });
});
