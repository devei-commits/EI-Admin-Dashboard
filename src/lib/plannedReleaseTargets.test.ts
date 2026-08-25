import { describe, expect, it } from 'vitest';
import {
  buildPlannedReleaseTargets,
  datesMatchForProcurementMerge,
  isoWeekKeyFromDate,
  mergeWeekQtyOverrides,
  summarizePlannedReleaseTargetsByWeek,
  buildReleaseTargetsForSubmit,
} from './plannedReleaseTargets';

describe('plannedReleaseTargets', () => {
  it('splits sub-MOQ batch releases across weeks (aqua-style 3 batches)', () => {
    const targets = buildPlannedReleaseTargets({
      formQty: 77.575,
      batchPickEntries: [
        { key: '1-10', batchId: 10, qty: 25.858 },
        { key: '1-11', batchId: 11, qty: 25.858 },
        { key: '1-12', batchId: 12, qty: 25.859 },
      ],
      batchExpectedDates: {
        '1-10': '2026-06-10',
        '1-11': '2026-06-18',
        '1-12': '2026-07-02',
      },
      slabMoq: 50,
      leadTimeDays: 14,
      fallbackDateFromLead: () => '2026-06-25',
    });

    expect(targets.length).toBeGreaterThanOrEqual(2);
    expect(targets.reduce((s, t) => s + t.qty, 0)).toBeCloseTo(77.575, 3);
    expect(new Set(targets.map((t) => t.expectedDate)).size).toBeGreaterThan(1);
  });

  it('splits MOQ rollup by ISO week when batch expected dates differ', () => {
    const targets = buildPlannedReleaseTargets({
      formQty: 77,
      batchPickEntries: [
        { key: '1-10', batchId: 10, qty: 25 },
        { key: '1-11', batchId: 11, qty: 26 },
        { key: '1-12', batchId: 12, qty: 26 },
      ],
      batchExpectedDates: {
        '1-10': '2026-06-10',
        '1-11': '2026-06-18',
        '1-12': '2026-07-02',
      },
      slabMoq: 100,
      leadTimeDays: 14,
      fallbackDateFromLead: () => '2026-06-25',
    });

    expect(targets).toHaveLength(3);
    expect(targets.map((t) => t.expectedDate)).toEqual([
      '2026-06-10',
      '2026-06-18',
      '2026-07-02',
    ]);
    expect(targets.reduce((s, t) => s + t.qty, 0)).toBe(77);
  });

  it('merges sub-MOQ batch picks in the same ISO week when total meets MOQ', () => {
    const targets = buildPlannedReleaseTargets({
      formQty: 110,
      batchPickEntries: [
        { key: '1-10', batchId: 10, qty: 55 },
        { key: '1-11', batchId: 11, qty: 55 },
      ],
      batchExpectedDates: {
        '1-10': '2026-06-10',
        '1-11': '2026-06-11',
      },
      slabMoq: 100,
      leadTimeDays: 14,
      fallbackDateFromLead: () => '2026-06-25',
    });

    expect(targets).toHaveLength(1);
    expect(targets[0]?.qty).toBe(110);
    expect(targets[0]?.expectedDate).toBe('2026-06-10');
    expect(targets[0]?.planningBatchId).toBeNull();
  });

  it('keeps per-batch targets when each batch meets MOQ', () => {
    const targets = buildPlannedReleaseTargets({
      formQty: 300,
      batchPickEntries: [
        { key: '1-10', batchId: 10, qty: 100 },
        { key: '1-11', batchId: 11, qty: 100 },
        { key: '1-12', batchId: 12, qty: 100 },
      ],
      batchExpectedDates: {
        '1-10': '2026-06-10',
        '1-11': '2026-06-18',
        '1-12': '2026-07-02',
      },
      slabMoq: 50,
      leadTimeDays: 14,
      fallbackDateFromLead: () => '2026-06-25',
    });

    expect(targets).toHaveLength(3);
    expect(targets.every((t) => t.planningBatchId != null)).toBe(true);
  });

  it('matches dates by ISO week for procurement merge', () => {
    expect(isoWeekKeyFromDate('2026-06-10')).toBe('2026-24');
    expect(datesMatchForProcurementMerge('2026-06-10', '2026-06-11')).toBe(true);
    expect(datesMatchForProcurementMerge('2026-06-10', '2026-06-18')).toBe(false);
  });

  it('summarizePlannedReleaseTargetsByWeek groups targets by ISO week', () => {
    const targets = buildPlannedReleaseTargets({
      formQty: 77,
      batchPickEntries: [
        { key: '1-10', batchId: 10, qty: 25 },
        { key: '1-11', batchId: 11, qty: 26 },
        { key: '1-12', batchId: 12, qty: 26 },
      ],
      batchExpectedDates: {
        '1-10': '2026-06-10',
        '1-11': '2026-06-18',
        '1-12': '2026-07-02',
      },
      slabMoq: 100,
      leadTimeDays: 14,
      fallbackDateFromLead: () => '2026-06-25',
    });

    const summary = summarizePlannedReleaseTargetsByWeek(targets);
    expect(summary).toHaveLength(3);
    expect(summary.map((row) => row.weekLabel)).toEqual(['Week 24, 2026', 'Week 25, 2026', 'Week 27, 2026']);
    expect(summary.reduce((s, row) => s + row.qty, 0)).toBe(77);
    expect(summary.every((row) => row.requestCount === 1)).toBe(true);
  });

  it('summarizePlannedReleaseTargetsByWeek merges same-week sub-MOQ rollup', () => {
    const targets = buildPlannedReleaseTargets({
      formQty: 110,
      batchPickEntries: [
        { key: '1-10', batchId: 10, qty: 55 },
        { key: '1-11', batchId: 11, qty: 55 },
      ],
      batchExpectedDates: {
        '1-10': '2026-06-10',
        '1-11': '2026-06-11',
      },
      slabMoq: 100,
      leadTimeDays: 14,
      fallbackDateFromLead: () => '2026-06-25',
    });

    const summary = summarizePlannedReleaseTargetsByWeek(targets);
    expect(summary).toHaveLength(1);
    expect(summary[0]?.qty).toBe(110);
    expect(summary[0]?.weekLabel).toBe('Week 24, 2026');
    // Required-by is the LAST day of the week (Sunday), not the earliest per-batch due date.
    expect(summary[0]?.expectedDate).toBe('2026-06-14');
  });

  it('mergeWeekQtyOverrides applies user edits per week', () => {
    const summary = summarizePlannedReleaseTargetsByWeek([
      { qty: 0.25, planningBatchId: 10, expectedDate: '2026-06-28' },
    ]);
    const merged = mergeWeekQtyOverrides(summary, { [summary[0]!.weekKey]: '0.5' });
    expect(merged[0]?.qty).toBe(0.5);
  });

  it('buildReleaseTargetsForSubmit uses edited week qty', () => {
    const base = buildPlannedReleaseTargets({
      formQty: 0.25,
      batchPickEntries: [{ key: '1-10', batchId: 10, qty: 0.25 }],
      batchExpectedDates: { '1-10': '2026-06-28' },
      slabMoq: 10,
      leadTimeDays: 7,
      fallbackDateFromLead: () => '2026-06-28',
    });
    const weekKey = summarizePlannedReleaseTargetsByWeek(base)[0]!.weekKey;
    const final = buildReleaseTargetsForSubmit(base, { [weekKey]: '0.75' });
    expect(final).toHaveLength(1);
    expect(final[0]?.qty).toBe(0.75);
    expect(final[0]?.expectedDate).toBe('2026-06-28');
  });
});
