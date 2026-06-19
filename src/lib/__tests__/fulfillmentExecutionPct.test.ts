import { describe, it, expect } from 'vitest';
import {
  computeBatchSplitExecutionFraction,
  computeOrderItemExecutionPercent,
  FULFILLMENT_EXEC_PHASE_WEIGHTS,
  productionSliceProgress01,
} from '../fulfillmentExecutionPct';
import type { BatchSplit, OrderItem } from '../../types/orderFulfillment';

describe('fulfillmentExecutionPct', () => {
  it('weights sum to 1', () => {
    const s = Object.values(FULFILLMENT_EXEC_PHASE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(s).toBeCloseTo(1, 5);
  });

  it('new sale order with draft BMR/BPR and no planning shows 0% exec', () => {
    const split: BatchSplit = {
      bmrNo: 'BMR-2026-0001',
      bprNo: 'BPR-2026-0001',
      plannedQty: 500,
      fgQty: 0,
      fgLocation: null,
      ffStatus: 'fg_pending',
      bmrStatus: 'draft',
      bprStatus: 'draft',
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
    const item: OrderItem = {
      itemNo: '001',
      sku: 'SKU-1',
      productName: 'Product',
      pack: '—',
      orderedQty: 500,
      rate: 1,
      unitPrice: 1,
      batchSplits: [split],
    };
    expect(computeOrderItemExecutionPercent(item, null)).toBe(0);
    expect(computeBatchSplitExecutionFraction(split, 0, 1, null)).toBe(0);
  });

  it('new SO placeholder split (fg_pending, no work) is 0%', () => {
    const split: BatchSplit = {
      bmrNo: '',
      bprNo: '',
      plannedQty: 500,
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
    };
    expect(computeBatchSplitExecutionFraction(split, 0, 1, null)).toBe(0);
    const item: OrderItem = {
      itemNo: '001',
      sku: 'S',
      productName: 'P',
      pack: '—',
      orderedQty: 500,
      rate: 1,
      unitPrice: 1,
      batchSplits: [split],
    };
    expect(computeOrderItemExecutionPercent(item, null)).toBe(0);
  });

  it('fg_pending with BMR cleared and BPR pm_reserved uses production status not 0', () => {
    const split: BatchSplit = {
      bmrNo: 'BMR-2026-001',
      bprNo: 'BPR-2026-001',
      plannedQty: 1,
      fgQty: 0,
      fgLocation: null,
      ffStatus: 'fg_pending',
      bmrStatus: 'cleared',
      bprStatus: 'pm_reserved',
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
    expect(productionSliceProgress01('fg_pending', split)).toBe(0.55);
    const planning = {
      totalBatches: 1,
      sentCount: 1,
      rmStartedCount: 1,
      pmStartedCount: 1,
      rmLineAvailableCount: 20,
      rmLineTotalCount: 20,
      pmLineAvailableCount: 2,
      pmLineTotalCount: 2,
    };
    const f = computeBatchSplitExecutionFraction(split, 0, 1, planning);
    expect(f).toBeGreaterThan(0.35);
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

  it('line Exec% uses orderedQty as denominator when planned covers only part of the line', () => {
    const split: BatchSplit = {
      bmrNo: 'BMR-1',
      bprNo: 'BPR-1',
      plannedQty: 10,
      fgQty: 10,
      fgLocation: null,
      ffStatus: 'closed',
      pickedQty: 10,
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
    const item: OrderItem = {
      itemNo: '001',
      sku: 'S',
      productName: 'P',
      pack: '—',
      orderedQty: 100,
      rate: 1,
      unitPrice: 1,
      batchSplits: [split],
    };
    expect(computeOrderItemExecutionPercent(item, null)).toBe(10);
  });

  it('over-allocated planned qty vs ordered scales so line does not exceed 100%', () => {
    const mk = (planned: number, st: BatchSplit['ffStatus']): BatchSplit => ({
      bmrNo: 'BMR',
      bprNo: 'BPR',
      plannedQty: planned,
      fgQty: planned,
      fgLocation: null,
      ffStatus: st,
      pickedQty: planned,
      pickerName: null,
      pickDate: null,
      pickSlipNo: null,
      remarks: null,
      invoiceNo: null,
      awbNo: null,
      courier: null,
      dispatchDate: null,
      etaDate: null,
    });
    const item: OrderItem = {
      itemNo: '001',
      sku: 'S',
      productName: 'P',
      pack: '—',
      orderedQty: 100,
      rate: 1,
      unitPrice: 1,
      batchSplits: [mk(60, 'closed'), mk(60, 'closed')],
    };
    expect(computeOrderItemExecutionPercent(item, null)).toBe(100);
  });
});
