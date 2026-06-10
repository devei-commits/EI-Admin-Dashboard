import React, { useMemo, useState } from 'react';
import {
  buildWeekVendorConsolidationLines,
  groupWeekVendorConsolidationLines,
} from '../../lib/weekVendorConsolidation';
import { formatIsoWeekLabel } from '../../lib/isoWeek';
import type { ProcurementRequest, RequestType } from '../../types/procurement.types';
import { formatDateWithIsoWeek } from '../../pages/procurement/procurementDataMappers';

export type WeekVendorConsolidationViewProps = {
  requests: ProcurementRequest[];
  statusBg: Record<string, string>;
  requestTypeClass: Record<string, string>;
  onOpenRequest?: (requestId: string) => void;
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
  embedded = false,
  categoryFilter: categoryFilterProp,
  searchQuery: searchQueryProp,
}: WeekVendorConsolidationViewProps): React.ReactElement {
  const [localCategoryFilter, setLocalCategoryFilter] = useState<'All' | RequestType>('All');
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const categoryFilter = embedded ? (categoryFilterProp ?? 'All') : localCategoryFilter;
  const searchQuery = embedded ? (searchQueryProp ?? '') : localSearchQuery;

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

  if (requests.length === 0) {
    return (
      <div className={`${embedded ? '' : 'rounded-xl border border-slate-200 bg-white shadow-sm '}p-8 text-center`}>
        <p className="text-slate-700 font-semibold">No procurement requests loaded</p>
        <p className="text-sm text-slate-500 mt-1">Requests with expected dates appear here grouped by vendor and ISO week.</p>
      </div>
    );
  }

  const shellClass = embedded
    ? 'overflow-hidden'
    : 'rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden';

  return (
    <div className={shellClass}>
      {embedded ? (
        <p className="px-1 pb-3 text-[11px] text-slate-500 tabular-nums">
          {totalLines} line{totalLines === 1 ? '' : 's'} · {groups.length} vendor-week group
          {groups.length === 1 ? '' : 's'} — grouped by preferred vendor, then ISO week by expected date.
        </p>
      ) : (
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Week + vendor consolidation</h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Lines grouped by preferred vendor, then ISO week (Week 35, Week 40, …) by expected date.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(['All', 'RM', 'PM'] as const).map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setLocalCategoryFilter(category)}
                  className={`px-2 py-1 rounded border text-xs ${
                    categoryFilter === category
                      ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  {category}
                </button>
              ))}
              <input
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
                placeholder="Search vendor, item, request, week…"
                className="w-64 min-w-[12rem] px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 tabular-nums">
            {totalLines} line{totalLines === 1 ? '' : 's'} · {groups.length} vendor-week group
            {groups.length === 1 ? '' : 's'}
          </p>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-slate-700 font-medium">No lines match your filters</p>
          <p className="text-sm text-slate-500 mt-1">Try clearing search or changing category.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {groups.map((group) => {
            const weekTitle = group.hasWeek
              ? formatIsoWeekLabel({ week: group.isoWeek, year: group.isoWeekYear })
              : 'No expected week';
            return (
              <section key={group.key} className="bg-white">
                <div className="px-5 py-3 bg-indigo-50/70 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{group.vendor}</h3>
                    <p className="text-xs text-indigo-800 font-semibold mt-0.5">{weekTitle}</p>
                  </div>
                  <div className="text-right text-xs text-slate-600 tabular-nums">
                    <p>
                      {group.lineCount} item{group.lineCount === 1 ? '' : 's'}
                    </p>
                    <p className="font-semibold text-amber-700">
                      ₹{group.totalEstValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50">
                        <th className="px-4 py-2 font-semibold">Request</th>
                        <th className="px-4 py-2 font-semibold">Item</th>
                        <th className="px-4 py-2 font-semibold text-right">Qty</th>
                        <th className="px-4 py-2 font-semibold text-right">Planned ₹</th>
                        <th className="px-4 py-2 font-semibold text-right">Est. value</th>
                        <th className="px-4 py-2 font-semibold">Expected</th>
                        <th className="px-4 py-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.lines.map((line, idx) => (
                        <tr
                          key={`${line.requestId}-${line.itemCode}-${idx}`}
                          className="border-b border-slate-50 hover:bg-slate-50/80"
                        >
                          <td className="px-4 py-2 align-top">
                            {onOpenRequest ? (
                              <button
                                type="button"
                                onClick={() => onOpenRequest(line.requestId)}
                                className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-indigo-800 hover:bg-indigo-50"
                              >
                                {line.requestCode}
                              </button>
                            ) : (
                              <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                {line.requestCode}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 align-top min-w-[10rem]">
                            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                                  requestTypeClass[line.type] ?? 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {line.type}
                              </span>
                              <span className="font-semibold text-slate-900">{line.itemName}</span>
                            </div>
                            {line.itemCode ? (
                              <p className="text-[10px] text-slate-500 font-mono">{line.itemCode}</p>
                            ) : null}
                          </td>
                          <td className="px-4 py-2 text-right font-medium text-slate-900 tabular-nums align-top whitespace-nowrap">
                            {line.reqQty.toLocaleString('en-IN')} {line.unit}
                          </td>
                          <td className="px-4 py-2 text-right text-emerald-700 tabular-nums align-top whitespace-nowrap">
                            ₹{line.plannedPrice.toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-2 text-right text-amber-700 font-medium tabular-nums align-top whitespace-nowrap">
                            ₹{line.estValue.toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-2 text-slate-700 align-top whitespace-nowrap">
                            {formatDateWithIsoWeek(line.expectedDate)}
                          </td>
                          <td className="px-4 py-2 align-top">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                                statusBg[line.status] ?? 'bg-slate-100 text-slate-600'
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
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
