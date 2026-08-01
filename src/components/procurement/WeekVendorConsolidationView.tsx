import React, { useMemo, useState } from 'react';
import {
  buildWeekVendorConsolidationLines,
  buildWeekVendorItemBuckets,
  groupWeekVendorConsolidationLines,
  type WeekVendorItemBucket,
} from '../../lib/weekVendorConsolidation';
import { formatIsoWeekLabel } from '../../lib/isoWeek';
import { isProcurementRequestPreDraftPipelineStatus } from '../../lib/procurementRequestMerge';
import type { ProcurementRequest, RequestType } from '../../types/procurement.types';
import { formatDateWithIsoWeek } from '../../pages/procurement/procurementDataMappers';
import { ProcSectionHeader, ProcFilterBar, ProcSearch, procChipClass } from './ProcSection';

export type WeekVendorConsolidationViewProps = {
  requests: ProcurementRequest[];
  statusBg: Record<string, string>;
  requestTypeClass: Record<string, string>;
  onOpenRequest?: (requestId: string) => void;
  onReleaseConsolidated?: (bucket: WeekVendorItemBucket) => void | Promise<void>;
  releasingBucketKey?: string | null;
  /** When true, hides title and filter controls (parent Requests tab supplies those). */
  embedded?: boolean;
  categoryFilter?: 'All' | RequestType;
  searchQuery?: string;
};

export function WeekVendorConsolidationView({
  requests,
  statusBg,
  requestTypeClass,
  onOpenRequest,
  onReleaseConsolidated,
  releasingBucketKey = null,
  embedded = false,
  categoryFilter: categoryFilterProp,
  searchQuery: searchQueryProp,
}: WeekVendorConsolidationViewProps): React.ReactElement {
  const [localCategoryFilter, setLocalCategoryFilter] = useState<'All' | RequestType>('All');
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const categoryFilter = embedded ? (categoryFilterProp ?? 'All') : localCategoryFilter;
  const searchQuery = embedded ? (searchQueryProp ?? '') : localSearchQuery;

  const requestById = useMemo(
    () => new Map(requests.map((r) => [r.id, r])),
    [requests]
  );

  const groups = useMemo(() => {
    const lines = buildWeekVendorConsolidationLines(requests);
    const q = searchQuery.trim().toLowerCase();
    const filtered = lines.filter((line) => {
      if (categoryFilter !== 'All' && line.type !== categoryFilter) return false;
      if (!q) return true;
      return (
        line.vendor.toLowerCase().includes(q) ||
        line.itemName.toLowerCase().includes(q) ||
        line.itemCode.toLowerCase().includes(q) ||
        line.requestCode.toLowerCase().includes(q) ||
        formatIsoWeekLabel(
          line.hasWeek ? { week: line.isoWeek, year: line.isoWeekYear } : null
        )
          .toLowerCase()
          .includes(q)
      );
    });
    return groupWeekVendorConsolidationLines(filtered);
  }, [requests, categoryFilter, searchQuery]);

  const totalLines = useMemo(() => groups.reduce((sum, g) => sum + g.lineCount, 0), [groups]);

  const bucketCanRelease = (bucket: WeekVendorItemBucket): boolean => {
    for (const line of bucket.sourceLines) {
      const req = requestById.get(line.requestId);
      if (!req) return false;
      if (!isProcurementRequestPreDraftPipelineStatus(req.status)) return false;
    }
    return bucket.sourceLines.length > 0;
  };

  if (requests.length === 0) {
    return (
      <div className={`${embedded ? '' : 'rounded-xl border border-border bg-surface shadow-[var(--e1)] '}p-8 text-center`}>
        <p className="text-ink-2 font-semibold">No procurement requests loaded</p>
        <p className="text-sm text-ink-3 mt-1">
          Lines with a chosen preferred vendor, grouped by vendor and ISO week (expected date).
        </p>
      </div>
    );
  }

  const shellClass = embedded ? 'overflow-hidden' : 'space-y-3';

  return (
    <div className={shellClass}>
      {embedded ? (
        <p className="px-1 pb-3 text-[11px] text-ink-3 tabular-nums">
          {totalLines} line{totalLines === 1 ? '' : 's'} with vendor assigned · {groups.length} vendor-week
          group{groups.length === 1 ? '' : 's'} — same item in a week consolidates to one PO qty.
        </p>
      ) : (
        <>
          <ProcSectionHeader
            title="Week + vendor consolidation"
            subtitle="Only lines with preferred vendor set — grouped by vendor, then ISO week. Release one PO per material with combined qty (e.g. 5 kg + 6 kg → 11 kg)."
            stats={[
              { value: totalLines, label: `line${totalLines === 1 ? '' : 's'}` },
              { value: groups.length, label: `vendor-week group${groups.length === 1 ? '' : 's'}` },
            ]}
          />
          <ProcFilterBar>
            {(['All', 'RM', 'PM'] as const).map((category) => (
              <button key={category} type="button" onClick={() => setLocalCategoryFilter(category)} className={procChipClass(categoryFilter === category)}>
                {category}
              </button>
            ))}
            <ProcSearch value={localSearchQuery} onChange={setLocalSearchQuery} placeholder="Search vendor, item, request, week…" className="ml-auto w-64 min-w-[12rem]" />
          </ProcFilterBar>
        </>
      )}

      {groups.length === 0 ? (
        <div className={`p-8 text-center ${embedded ? '' : 'rounded-xl border border-border bg-surface'}`}>
          <p className="text-ink-2 font-medium">No vendor-week groups to show</p>
          <p className="text-sm text-ink-3 mt-1">
            Assign a preferred vendor on each request in the item-by-item view, then lines appear here grouped
            by vendor and ISO week.
          </p>
        </div>
      ) : (
        <div className={`divide-y divide-hairline ${embedded ? '' : 'rounded-xl border border-border bg-surface overflow-hidden'}`}>
          {groups.map((group) => {
            const weekTitle = group.hasWeek
              ? formatIsoWeekLabel({ week: group.isoWeek, year: group.isoWeekYear })
              : 'No expected week';
            const itemBuckets = buildWeekVendorItemBuckets(group);
            return (
              <section key={group.key} className="bg-surface">
                <div className="px-5 py-3 bg-brand-soft border-b border-brand-soft flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-ink">{group.vendor}</h3>
                    <p className="text-xs text-brand font-semibold mt-0.5">{weekTitle}</p>
                  </div>
                  <div className="text-right text-xs text-ink-3 tabular-nums">
                    <p>
                      {group.lineCount} PR line{group.lineCount === 1 ? '' : 's'} · {itemBuckets.length} item
                      {itemBuckets.length === 1 ? '' : 's'}
                    </p>
                    <p className="font-semibold text-warn">
                      ₹{group.totalEstValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-hairline">
                  {itemBuckets.map((bucket) => {
                    const isMulti = bucket.sourceLines.length > 1;
                    const canRelease = bucketCanRelease(bucket) && onReleaseConsolidated != null;
                    return (
                      <div key={bucket.key} className="px-5 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                                  requestTypeClass[bucket.type] ??
                                  'bg-surface-3 text-ink-2 border-border'
                                }`}
                              >
                                {bucket.type}
                              </span>
                              <span className="text-sm font-bold text-ink">{bucket.itemName}</span>
                              {isMulti ? (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-soft text-brand border border-brand-soft">
                                  {bucket.sourceLines.length} requests consolidated
                                </span>
                              ) : null}
                            </div>
                            {bucket.itemCode ? (
                              <p className="text-[10px] text-ink-3 font-mono mt-0.5">{bucket.itemCode}</p>
                            ) : null}
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-wide text-ink-3">Consolidated qty</p>
                            <p className="text-lg font-bold text-brand tabular-nums">
                              {bucket.totalReqQty.toLocaleString('en-IN')} {bucket.unit}
                            </p>
                            <p className="text-[11px] text-warn font-medium tabular-nums">
                              ₹{bucket.totalEstValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </p>
                          </div>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-border">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-[10px] tracking-wide text-ink-3 border-b border-hairline bg-surface-2">
                                <th scope="col" className="px-3 py-2 font-semibold">Request</th>
                                <th scope="col" className="px-3 py-2 font-semibold text-right">Qty</th>
                                <th scope="col" className="px-3 py-2 font-semibold text-right">Planned ₹</th>
                                <th scope="col" className="px-3 py-2 font-semibold">Expected</th>
                                <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bucket.sourceLines.map((line, idx) => (
                                <tr
                                  key={`${line.requestId}-${line.itemCode}-${idx}`}
                                  className="border-b border-hairline"
                                >
                                  <td className="px-3 py-2 align-top">
                                    {onOpenRequest ? (
                                      <button
                                        type="button"
                                        onClick={() => onOpenRequest(line.requestId)}
                                        className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-surface-3 text-brand hover:bg-brand-soft"
                                      >
                                        {line.requestCode}
                                      </button>
                                    ) : (
                                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-surface-3 text-ink-2">
                                        {line.requestCode}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right font-medium tabular-nums whitespace-nowrap">
                                    {line.reqQty.toLocaleString('en-IN')} {line.unit}
                                  </td>
                                  <td className="px-3 py-2 text-right text-ok tabular-nums whitespace-nowrap">
                                    ₹{line.plannedPrice.toLocaleString('en-IN')}
                                  </td>
                                  <td className="px-3 py-2 text-ink-2 whitespace-nowrap">
                                    {formatDateWithIsoWeek(line.expectedDate)}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span
                                      className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                                        statusBg[line.status] ?? 'bg-surface-3 text-ink-3'
                                      }`}
                                    >
                                      {line.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {onReleaseConsolidated ? (
                          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                            {!canRelease ? (
                              <p className="text-[11px] text-ink-3 mr-auto">
                                Release available when all linked requests are New or Quoted (not already on a
                                draft PO).
                              </p>
                            ) : null}
                            <button
                              type="button"
                              disabled={!canRelease || releasingBucketKey === bucket.key}
                              onClick={() => void onReleaseConsolidated(bucket)}
                              className="px-4 py-2 rounded-lg bg-warn text-white text-xs font-bold shadow-[var(--e1)] hover:bg-warn focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {releasingBucketKey === bucket.key
                                ? 'Creating draft PO…'
                                : isMulti
                                  ? `Release consolidated PO (${bucket.totalReqQty.toLocaleString('en-IN')} ${bucket.unit})`
                                  : `Release draft PO (${bucket.totalReqQty.toLocaleString('en-IN')} ${bucket.unit})`}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
