import { describe, expect, it } from 'vitest';
import {
  buildPlannedReleaseTargets,
  datesMatchForProcurementMerge,
  isoWeekKeyFromDate,
  mergeWeekQtyOverrides,
  resolveReleaseFormQty,
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

describe('resolveReleaseFormQty', () => {
  it('lets the picks decide the total, since "+ Add" leaves Quantity behind', () => {
    // "+ Add" grows the picks without rewriting Quantity, so the field lags by design.
    expect(resolveReleaseFormQty(55680.8, [{ key: 'a', batchId: 1, qty: 183 }])).toBe(183);
  });

  it('falls back to the Quantity field when nothing was picked', () => {
    // The manual-total path: typing in Quantity clears the picks, so this is the MOQ bump.
    expect(resolveReleaseFormQty(50000, [])).toBe(50000);
  });

  it('ignores non-positive picks rather than letting them shrink the total', () => {
    expect(resolveReleaseFormQty(500, [{ key: 'a', batchId: 1, qty: 0 }])).toBe(500);
    expect(resolveReleaseFormQty(500, [{ key: 'a', batchId: 1, qty: -20 }])).toBe(500);
  });
});

describe('"+ Add" builds a week-wise plan — the 8-batch serum case', () => {
  // Reported live: eight batches added, batch Totals row reading 69,102, yet the week panel showed
  // ONE row (Week 37, 2026 · 55,680.8) because the stale Quantity field disagreed with the pick sum
  // and the old rule discarded every pick on that mismatch.
  const entries = [
    { key: 'b1', batchId: 3250, qty: 183, date: '2026-04-03' },
    { key: 'b2', batchId: 3249, qty: 6421, date: '2026-08-28' },
    { key: 'b3', batchId: 3408, qty: 14000, date: '2026-09-02' },
    { key: 'b4', batchId: 3409, qty: 14421, date: '2026-09-08' },
    { key: 'b5', batchId: 3410, qty: 18000, date: '2026-06-15' },
    { key: 'b6', batchId: 3411, qty: 16077, date: '2026-06-15' },
  ];
  const batchPickEntries = entries.map(({ key, batchId, qty }) => ({ key, batchId, qty }));
  const batchExpectedDates = Object.fromEntries(entries.map((e) => [e.key, e.date]));
  const STALE_FORM_QTY = 55680.8;

  const build = (formQty: number) =>
    buildPlannedReleaseTargets({
      formQty,
      batchPickEntries,
      batchExpectedDates,
      slabMoq: 15000,
      leadTimeDays: 14,
      // Lands in ISO week 37 — the single bucket the broken panel collapsed to.
      fallbackDateFromLead: () => '2026-09-10',
    });

  it('consolidates the added batches into one row per ISO week', () => {
    const rows = summarizePlannedReleaseTargetsByWeek(
      build(resolveReleaseFormQty(STALE_FORM_QTY, batchPickEntries))
    );

    // 15 Jun ×2 share a week and merge; the other four dates are four separate weeks.
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.qty)).toEqual([183, 34077, 6421, 14000, 14421]);
    expect(rows.reduce((s, r) => s + r.qty, 0)).toBe(69102);
  });

  it('carries the full picked qty, not the stale Quantity field', () => {
    const total = build(resolveReleaseFormQty(STALE_FORM_QTY, batchPickEntries)).reduce(
      (s, t) => s + t.qty,
      0
    );
    expect(total).toBe(69102);
    expect(total).not.toBe(STALE_FORM_QTY);
  });

  it('regression: the stale Quantity field alone produced one lead-time week', () => {
    // Pins what the bug looked like — formQty > batchSum takes the flat-total branch.
    const rows = summarizePlannedReleaseTargetsByWeek(
      buildPlannedReleaseTargets({
        formQty: 120000,
        batchPickEntries: [],
        batchExpectedDates,
        slabMoq: 15000,
        leadTimeDays: 14,
        fallbackDateFromLead: () => '2026-09-10',
      })
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.expectedDate).toBe('2026-09-13');
  });
});
