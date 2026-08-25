import { formatIsoWeekLabel, isoWeekFromDateString, lastDateOfIsoWeek } from './isoWeek';

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

export type PlannedReleaseWeekSummary = {
  weekKey: string;
  weekLabel: string;
  expectedDate: string;
  qty: number;
  /** Number of procurement requests (targets) scheduled for this ISO week. */
  requestCount: number;
};

/**
 * Roll up release targets by ISO week for UI preview (qty summed per week). The bucket's
 * required-by date is always the LAST day (Sunday) of that ISO week — not the earliest
 * per-batch due date — since a week-level PR/PO ships by week end regardless of which day
 * within the week an individual batch was originally due.
 */
export function summarizePlannedReleaseTargetsByWeek(
  targets: PlannedReleaseTarget[]
): PlannedReleaseWeekSummary[] {
  const byWeek = new Map<
    string,
    { qty: number; expectedDate: string; requestCount: number; weekLabel: string }
  >();

  for (const target of targets) {
    if (!(target.qty > 0)) continue;
    const rawDate = String(target.expectedDate ?? '').trim().slice(0, 10);
    if (!rawDate) continue;
    const parts = isoWeekFromDateString(rawDate);
    const weekKey = parts ? `${parts.year}-${String(parts.week).padStart(2, '0')}` : `date:${rawDate}`;
    const weekLabel = formatIsoWeekLabel(parts);
    const bucketExpectedDate = parts ? lastDateOfIsoWeek(parts.year, parts.week) : rawDate;
    const bucket = byWeek.get(weekKey);
    if (!bucket) {
      byWeek.set(weekKey, {
        qty: target.qty,
        expectedDate: bucketExpectedDate,
        requestCount: 1,
        weekLabel,
      });
      continue;
    }
    bucket.qty += target.qty;
    bucket.requestCount += 1;
  }

  return Array.from(byWeek.entries())
    .map(([weekKey, bucket]) => ({
      weekKey,
      weekLabel: bucket.weekLabel,
      expectedDate: bucket.expectedDate,
      qty: bucket.qty,
      requestCount: bucket.requestCount,
    }))
    .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
}

function parseWeekQtyOverride(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const parsed = parseFloat(trimmed.replace(/,/g, ''));
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

/** Apply user-edited qty per ISO week (empty override keeps computed qty). */
export function mergeWeekQtyOverrides(
  rows: PlannedReleaseWeekSummary[],
  overrides: Record<string, string>
): PlannedReleaseWeekSummary[] {
  return rows.map((row) => {
    const parsed = parseWeekQtyOverride(overrides[row.weekKey]);
    if (parsed == null) return row;
    return { ...row, qty: parsed };
  });
}

/** Convert week summary rows to procurement release targets (one PR per week row). */
export function weekSummaryToReleaseTargets(rows: PlannedReleaseWeekSummary[]): PlannedReleaseTarget[] {
  return rows
    .filter((row) => row.qty > 0)
    .map((row) => ({
      qty: row.qty,
      planningBatchId: null,
      expectedDate: row.expectedDate,
    }));
}

/**
 * Final targets for Add Planned Line — week panel is source of truth when rows exist.
 * User-edited week qty overrides batch pick rollup.
 */
export function buildReleaseTargetsForSubmit(
  baseTargets: PlannedReleaseTarget[],
  weekQtyOverrides: Record<string, string>
): PlannedReleaseTarget[] {
  const weekRows = mergeWeekQtyOverrides(
    summarizePlannedReleaseTargetsByWeek(baseTargets),
    weekQtyOverrides
  );
  const fromWeeks = weekSummaryToReleaseTargets(weekRows);
  if (fromWeeks.length > 0) return fromWeeks;
  return baseTargets.filter((target) => target.qty > 0);
}
