import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageCheck } from 'lucide-react';
import RecordDetailModal from '../../components/ui/RecordDetailModal';
import { SearchInput } from '../../components/ui/SearchInput';
import { SortableTableTh, type SortDirection } from '../../components/ui/SortableTableTh';
import {
  buildQualityGrnQueueRow,
  searchQualityGrnQueueRows,
  sortQualityGrnQueueRows,
  type QualityGrnQueueInput,
  type QualityGrnQueueRow,
  type QualityGrnQueueSortKey,
} from '../../lib/qualityGrnQueueDisplay';

const FILTER_SELECT_CLASS =
  'rounded-lg border border-border bg-surface px-2.5 py-2 text-xs font-medium text-ink-2 focus:outline-none focus:ring-2 focus:ring-teal-500';

type QualityGrnQueueTableProps = {
  grns: QualityGrnQueueInput[];
  emptyMessage: string;
  actionLabel?: string;
  /**
   * Where the row action goes. Defaults to the warehouse list, which is right for read-only views
   * (QC history) but wrong for a queue of GRNs waiting on QC — those need the screen that can
   * actually record the inspection.
   */
  actionTo?: string;
  /**
   * Handle the row action in place instead of navigating. A queue of GRNs waiting on QC should
   * open the inspection form on the row, not send the user to another page to find it again.
   */
  onAction?: (grn: QualityGrnQueueInput) => void;
  /**
   * Per-row override of actionLabel — a decided row (QC already passed/rejected) still opens the
   * form via onAction, but read-only, so its button should say "View" rather than the editable
   * action's label. Falls back to actionLabel when omitted or it returns nothing.
   */
  actionLabelFor?: (row: QualityGrnQueueRow) => string | undefined;
};

const QualityGrnQueueTable: React.FC<QualityGrnQueueTableProps> = ({
  grns,
  emptyMessage,
  actionLabel = 'Open in Warehouse',
  actionTo = '/warehouse/inbound',
  onAction,
  actionLabelFor,
}) => {
  const [detail, setDetail] = useState<QualityGrnQueueRow | null>(null);
  const [search, setSearch] = useState('');
  const [qcStatusFilter, setQcStatusFilter] = useState('all');
  const [sortColumn, setSortColumn] = useState<QualityGrnQueueSortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const entries = useMemo(
    () => grns.map((grn) => ({ grn, row: buildQualityGrnQueueRow(grn) })),
    [grns],
  );

  const qcStatusOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.row.qcStatus))).sort((a, b) => a.localeCompare(b)),
    [entries],
  );

  const visibleEntries = useMemo(() => {
    let rows = entries;
    if (qcStatusFilter !== 'all') {
      rows = rows.filter((e) => e.row.qcStatus === qcStatusFilter);
    }
    if (search.trim()) {
      const matched = new Set(searchQualityGrnQueueRows(rows.map((e) => e.row), search).map((r) => r.id));
      rows = rows.filter((e) => matched.has(e.row.id));
    }
    if (sortColumn) {
      const byId = new Map(rows.map((e) => [e.row.id, e]));
      rows = sortQualityGrnQueueRows(rows.map((e) => e.row), sortColumn, sortDirection).map(
        (r) => byId.get(r.id)!,
      );
    }
    return rows;
  }, [entries, qcStatusFilter, search, sortColumn, sortDirection]);

  const toggleSort = (column: QualityGrnQueueSortKey): void => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortColumn(column);
    setSortDirection('asc');
  };

  const filtersActive = search.trim() !== '' || qcStatusFilter !== 'all';
  const clearFilters = (): void => {
    setSearch('');
    setQcStatusFilter('all');
  };

  if (grns.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-10 text-center text-sm text-ink-3">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search GRN, item, PO, vendor…"
            widthClass="w-full sm:w-64"
            aria-label="Search GRN queue"
          />
          <label className="inline-flex items-center gap-1.5 text-xs text-ink-2">
            <span className="sr-only">Filter by QC status</span>
            <select
              value={qcStatusFilter}
              onChange={(e) => setQcStatusFilter(e.target.value)}
              className={FILTER_SELECT_CLASS}
            >
              <option value="all">All QC statuses</option>
              {qcStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          {filtersActive ? (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-semibold text-ink-2 hover:text-ink underline-offset-2 hover:underline"
            >
              Clear filters
            </button>
          ) : null}
          <p className="text-[11px] text-ink-3 ml-auto">
            {visibleEntries.length === entries.length
              ? `${entries.length} GRN${entries.length === 1 ? '' : 's'}`
              : `${visibleEntries.length} of ${entries.length} GRNs`}
          </p>
        </div>

        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-20 bg-surface-2 text-xs uppercase tracking-wide text-ink-2">
              <tr className="[&_th]:bg-surface-2">
                <SortableTableTh
                  label="GRN #"
                  column="grnNo"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                />
                <SortableTableTh
                  label="Item"
                  column="itemLabel"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                />
                <SortableTableTh
                  label="PO"
                  column="poNo"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                />
                <SortableTableTh
                  label="Vendor"
                  column="vendor"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                />
                <SortableTableTh
                  label="Status"
                  column="statusLabel"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                />
                <SortableTableTh
                  label="QC"
                  column="qcStatus"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                />
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {visibleEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-ink-3">
                    No GRNs match your search or filters.
                  </td>
                </tr>
              ) : (
                visibleEntries.map(({ grn, row }) => (
                  <tr
                    key={row.id}
                    onClick={() => setDetail(row)}
                    className="hover:bg-surface-2 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-teal-700">{row.grnNo}</td>
                    <td className="px-4 py-3 text-ink">{row.itemLabel}</td>
                    <td className="px-4 py-3 text-ink-2">{row.poNo}</td>
                    <td className="px-4 py-3 text-ink-2">{row.vendor}</td>
                    <td className="px-4 py-3 font-medium text-ink">{row.statusLabel}</td>
                    <td className="px-4 py-3 text-ink-2">{row.qcStatus}</td>
                    <td className="px-4 py-3 text-right">
                      {onAction ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onAction(grn); }}
                          className="rounded-md border border-teal-700 px-2 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50"
                        >
                          {actionLabelFor?.(row) ?? actionLabel}
                        </button>
                      ) : (
                        <Link
                          to={actionTo}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs font-semibold text-teal-700 hover:text-teal-900 hover:underline"
                        >
                          {actionLabelFor?.(row) ?? actionLabel}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RecordDetailModal
        open={detail !== null}
        onClose={() => setDetail(null)}
        eyebrow="GRN"
        icon={<PackageCheck className="w-5 h-5" />}
        title={detail?.grnNo ?? ''}
        subtitle={detail?.itemLabel}
        sections={
          detail
            ? [
                {
                  title: 'GRN',
                  fields: [
                    { label: 'GRN #', value: detail.grnNo, mono: true },
                    { label: 'PO #', value: detail.poNo, mono: true },
                    { label: 'Vendor', value: detail.vendor },
                    { label: 'Status', value: detail.statusLabel },
                    { label: 'QC Status', value: detail.qcStatus },
                  ],
                },
                {
                  title: 'Item',
                  fields: [{ label: 'Item', value: detail.itemLabel, span: 'full' }],
                },
              ]
            : []
        }
      />
    </>
  );
};

export default QualityGrnQueueTable;
