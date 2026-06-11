import { isoWeekFromDateString } from './isoWeek';

export type PlannedReleaseTarget = {
  qty: number;
  planningBatchId: number | null;
  expectedDate: string;
};

export type BatchPickEntry = {
  key: string;
  batchId: number;
  qty: number;
};

export function isoWeekKeyFromDate(dateStr: string): string | null {
  const parts = isoWeekFromDateString(String(dateStr ?? '').trim().slice(0, 10));
  if (!parts || !(parts.week > 0)) return null;
  return `${parts.year}-${String(parts.week).padStart(2, '0')}`;
}

/** PR merge / line rollup: same ISO week, or exact date when week is unknown. */
export function datesMatchForProcurementMerge(a: string, b: string): boolean {
  const aNorm = String(a ?? '').trim().slice(0, 10);
  const bNorm = String(b ?? '').trim().slice(0, 10);
  if (!aNorm || !bNorm) return aNorm === bNorm;
  const weekA = isoWeekKeyFromDate(aNorm);
  const weekB = isoWeekKeyFromDate(bNorm);
  if (weekA && weekB) return weekA === weekB;
  return aNorm === bNorm;
}

function groupBatchPicksByIsoWeek(
  entries: BatchPickEntry[],
  resolveExpectedDate: (batchKey: string) => string
): PlannedReleaseTarget[] {
  const byWeek = new Map<
    string,
    { qty: number; expectedDate: string; batchIds: number[] }
  >();

  for (const entry of entries) {
    if (!(entry.qty > 0)) continue;
    const expectedDate = resolveExpectedDate(entry.key);
    const weekKey = isoWeekKeyFromDate(expectedDate) ?? `date:${expectedDate}`;
    const bucket = byWeek.get(weekKey);
    if (!bucket) {
      byWeek.set(weekKey, {
        qty: entry.qty,
        expectedDate,
        batchIds: [entry.batchId],
      });
      continue;
    }
    bucket.qty += entry.qty;
    if (expectedDate < bucket.expectedDate) {
      bucket.expectedDate = expectedDate;
    }
    bucket.batchIds.push(entry.batchId);
  }

  return Array.from(byWeek.values()).map((group) => ({
    qty: group.qty,
    planningBatchId: group.batchIds.length === 1 ? group.batchIds[0]! : null,
    expectedDate: group.expectedDate,
  }));
}

/**
 * Build procurement release targets from form qty + per-batch picks.
 * MOQ rollup groups by ISO week (not a single PR) so Week + Vendor splits correctly.
 */
export function buildPlannedReleaseTargets(opts: {
  formQty: number;
  batchPickEntries: BatchPickEntry[];
  batchExpectedDates: Record<string, string>;
  slabMoq: number;
  leadTimeDays: number;
  fallbackDateFromLead: (leadDays: number) => string;
}): PlannedReleaseTarget[] {
  const {
    formQty,
    batchPickEntries,
    batchExpectedDates,
    slabMoq,
    leadTimeDays,
    fallbackDateFromLead,
  } = opts;
  const fallbackDate = fallbackDateFromLead(leadTimeDays);

  const resolveExpectedDate = (batchKey: string | null): string => {
    if (batchKey) {
      const fromBatch = String(batchExpectedDates[batchKey] ?? '').trim().slice(0, 10);
      if (fromBatch) return fromBatch;
    }
    return fallbackDate;
  };

  if (batchPickEntries.length === 0) {
    return formQty > 0
      ? [{ qty: formQty, planningBatchId: null, expectedDate: fallbackDate }]
      : [];
  }

  const batchSum = batchPickEntries.reduce((sum, entry) => sum + entry.qty, 0);
  const hasSubMoqBatch =
    slabMoq > 0 && batchPickEntries.some((entry) => entry.qty > 0 && entry.qty + 1e-4 < slabMoq);

  // Per-batch qty below MOQ — roll up by ISO week (keeps separate weeks as separate PRs).
  if (hasSubMoqBatch && formQty + 1e-4 >= slabMoq) {
    return groupBatchPicksByIsoWeek(batchPickEntries, (key) => resolveExpectedDate(key));
  }

  if (formQty > batchSum + 1e-4) {
    return [{ qty: formQty, planningBatchId: null, expectedDate: fallbackDate }];
  }

  return batchPickEntries.map((entry) => ({
    qty: entry.qty,
    planningBatchId: entry.batchId,
    expectedDate: resolveExpectedDate(entry.key),
  }));
}
