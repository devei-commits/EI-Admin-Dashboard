import React, { useMemo, useState } from 'react';
import { SearchInput } from '../../components/ui/SearchInput';
import type {
  QualityDevelopmentRow,
  QualityDevelopmentSectionConfig,
  QualityDevelopmentStatus,
} from '../../types/qualityDevelopments';

type QualityDevelopmentsSectionProps = {
  config: QualityDevelopmentSectionConfig;
};

const STATUS_STYLES: Record<QualityDevelopmentStatus, string> = {
  Draft: 'bg-surface-3 text-ink-2 ring-border',
  'In Review': 'bg-warn-soft text-warn ring-amber-200',
  Testing: 'bg-sky-50 text-sky-800 ring-sky-200',
  Approved: 'bg-ok-soft text-ok ring-emerald-200',
  'On Hold': 'bg-rose-50 text-rose-800 ring-rose-200',
};

function formatDisplayDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function matchesSearch(row: QualityDevelopmentRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    row.reference,
    row.itemCode,
    row.title,
    row.category,
    row.status,
    row.assignee,
    row.notes,
  ]
    .join(' ')
    .toLowerCase()
    .includes(q);
}

const QualityDevelopmentsSection: React.FC<QualityDevelopmentsSectionProps> = ({ config }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | QualityDevelopmentStatus>('all');

  const statusCounts = useMemo(() => {
    const counts: Record<QualityDevelopmentStatus, number> = {
      Draft: 0,
      'In Review': 0,
      Testing: 0,
      Approved: 0,
      'On Hold': 0,
    };
    config.rows.forEach((row) => {
      counts[row.status] += 1;
    });
    return counts;
  }, [config.rows]);

  const filteredRows = useMemo(
    () =>
      config.rows.filter(
        (row) =>
          matchesSearch(row, search) && (statusFilter === 'all' || row.status === statusFilter),
      ),
    [config.rows, search, statusFilter],
  );

  return (
    <div className="flex-1 overflow-y-auto bg-surface-2 p-6 sm:p-8">
      <div className="max-w-[90rem] mx-auto space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">
            Order Management / Quality / {config.scopeLabel}
          </p>
          <h1 className="text-2xl font-bold text-ink mt-1">{config.pageTitle}</h1>
          <p className="text-sm text-ink-2 mt-2">{config.pageSubtitle}</p>
          <p className="text-xs text-ink-4 mt-2">Static preview data — live workflow coming later.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(Object.keys(statusCounts) as QualityDevelopmentStatus[]).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter((prev) => (prev === status ? 'all' : status))}
              className={`rounded-xl border bg-surface p-4 text-left shadow-sm transition-colors ${
                statusFilter === status
                  ? 'border-teal-300 ring-2 ring-teal-100'
                  : 'border-border hover:border-border'
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{status}</p>
              <p className="text-2xl font-bold text-ink mt-1">{statusCounts[status]}</p>
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="w-full sm:w-72">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder={`Search ${config.scopeLabel.toLowerCase()} developments…`}
                aria-label={`Search ${config.scopeLabel} developments`}
              />
            </div>
            <p className="text-xs text-ink-3">
              Showing {filteredRows.length} of {config.rows.length} records
            </p>
          </div>

          <div className="overflow-auto max-h-[70vh]">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-20 bg-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-3">
                <tr className="[&_th]:bg-surface-2">
                  <th scope="col" className="px-4 py-3">Reference</th>
                  <th scope="col" className="px-4 py-3">Item / PIS</th>
                  <th scope="col" className="px-4 py-3">Title</th>
                  <th scope="col" className="px-4 py-3">Category</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Assignee</th>
                  <th scope="col" className="px-4 py-3">Requested</th>
                  <th scope="col" className="px-4 py-3">Target</th>
                  <th scope="col" className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-ink-3">
                      No developments match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id} className="hover:bg-surface-2/80">
                      <td className="px-4 py-3 font-mono text-xs text-ink-2 whitespace-nowrap">
                        {row.reference}
                      </td>
                      <td className="px-4 py-3 font-semibold text-ink whitespace-nowrap">
                        {row.itemCode}
                      </td>
                      <td className="px-4 py-3 text-ink min-w-[14rem]">{row.title}</td>
                      <td className="px-4 py-3 text-ink-2 whitespace-nowrap">{row.category}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${STATUS_STYLES[row.status]}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-2 whitespace-nowrap">{row.assignee}</td>
                      <td className="px-4 py-3 text-ink-2 whitespace-nowrap">
                        {formatDisplayDate(row.requestedOn)}
                      </td>
                      <td className="px-4 py-3 text-ink-2 whitespace-nowrap">
                        {formatDisplayDate(row.targetDate)}
                      </td>
                      <td className="px-4 py-3 text-ink-3 min-w-[16rem]">{row.notes}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QualityDevelopmentsSection;
