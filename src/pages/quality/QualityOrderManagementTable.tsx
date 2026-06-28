import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SearchInput } from '../../components/ui/SearchInput';
import { SortableTableTh, type SortDirection } from '../../components/ui/SortableTableTh';
import {
  applyQualityOrderManagementFilters,
  buildQualityOrderManagementRows,
  formatQualityAssigneeShortName,
  hasActiveQualityOrderManagementFilters,
  qualityOrderManagementSlaClass,
  sortQualityOrderManagementRows,
  type QualityOrderManagementFilters,
  type QualityOrderManagementInput,
  type QualityOrderManagementRow,
  type QualityOrderManagementSortKey,
  type QualityMaterialSection,
  type QualityPriority,
} from '../../lib/qualityOrderManagementTableDisplay';

type QualityOrderManagementTableProps = {
  grns: QualityOrderManagementInput[];
  assigneeOptions: string[];
  assignSavingId: string | null;
  onAssign: (row: QualityOrderManagementRow, assignee: string) => void;
  onOpenQc: (row: QualityOrderManagementRow) => void;
  loading?: boolean;
};

const DEFAULT_FILTERS: QualityOrderManagementFilters = {
  search: '',
  section: 'all',
  priority: 'all',
  sourceKind: 'all',
  assignStatus: 'all',
};

const FILTER_SELECT_CLASS =
  'rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500';

const QualityOrderManagementTable: React.FC<QualityOrderManagementTableProps> = ({
  grns,
  assigneeOptions,
  assignSavingId,
  onAssign,
  onOpenQc,
  loading = false,
}) => {
  const [filters, setFilters] = useState<QualityOrderManagementFilters>(DEFAULT_FILTERS);
  const [sortColumn, setSortColumn] = useState<QualityOrderManagementSortKey | null>('quarantineDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const allRows = useMemo(() => buildQualityOrderManagementRows(grns), [grns]);

  const tableRows = useMemo(() => {
    let rows = applyQualityOrderManagementFilters(allRows, filters);
    if (sortColumn) {
      rows = sortQualityOrderManagementRows(rows, sortColumn, sortDirection);
    }
    return rows;
  }, [allRows, filters, sortColumn, sortDirection]);

  const toggleSort = (column: QualityOrderManagementSortKey): void => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortColumn(column);
    setSortDirection('asc');
  };

  const updateFilter = <K extends keyof QualityOrderManagementFilters>(
    key: K,
    value: QualityOrderManagementFilters[K],
  ): void => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = (): void => {
    setFilters(DEFAULT_FILTERS);
  };

  const filtersActive = hasActiveQualityOrderManagementFilters(filters);

  if (loading) {
    return <p className="text-sm text-slate-500 px-1">Loading order management queue…</p>;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900">Order Management</h2>
        <p className="text-[11px] text-slate-500">
          {tableRows.length === allRows.length
            ? `${tableRows.length} quarantine / QC line${tableRows.length === 1 ? '' : 's'}`
            : `${tableRows.length} of ${allRows.length} lines`}
        </p>
      </div>

      <div className="px-4 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center gap-2">
        <SearchInput
          value={filters.search}
          onChange={(value) => updateFilter('search', value)}
          placeholder="Search GRN, item, assignee…"
          widthClass="w-full sm:w-64"
          aria-label="Search order management queue"
        />
        <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
          <span className="sr-only">Filter by section</span>
          <select
            value={filters.section}
            onChange={(e) => updateFilter('section', e.target.value as QualityMaterialSection | 'all')}
            className={FILTER_SELECT_CLASS}
          >
            <option value="all">All sections</option>
            <option value="RM">RM</option>
            <option value="PM">PM</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
          <span className="sr-only">Filter by priority</span>
          <select
            value={filters.priority}
            onChange={(e) => updateFilter('priority', e.target.value as QualityPriority | 'all')}
            className={FILTER_SELECT_CLASS}
          >
            <option value="all">All priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
          <span className="sr-only">Filter by source type</span>
          <select
            value={filters.sourceKind}
            onChange={(e) =>
              updateFilter('sourceKind', e.target.value as QualityOrderManagementFilters['sourceKind'])
            }
            className={FILTER_SELECT_CLASS}
          >
            <option value="all">All sources</option>
            <option value="mismatch">Mismatch</option>
            <option value="routine">Routine</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
          <span className="sr-only">Filter by assign status</span>
          <select
            value={filters.assignStatus}
            onChange={(e) =>
              updateFilter('assignStatus', e.target.value as QualityOrderManagementFilters['assignStatus'])
            }
            className={FILTER_SELECT_CLASS}
          >
            <option value="all">All assignees</option>
            <option value="open">Open</option>
            <option value="assigned">Assigned</option>
          </select>
        </label>
        {filtersActive ? (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline-offset-2 hover:underline"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {allRows.length === 0 ? (
        <div className="px-6 py-10 text-sm text-slate-500 text-center">
          No quarantined or pending-QC GRNs in the order management queue.
        </div>
      ) : tableRows.length === 0 ? (
        <div className="px-6 py-10 text-sm text-slate-500 text-center">
          No lines match your search or filters.{' '}
          <button
            type="button"
            onClick={clearFilters}
            className="font-semibold text-teal-800 hover:text-teal-950 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[1100px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <SortableTableTh
                  label="Section"
                  column="section"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                  accent="teal"
                  thClassName="px-4 py-2.5 text-[10px] tracking-wide normal-case"
                />
                <SortableTableTh
                  label="Quarantine Date"
                  column="quarantineDate"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                  accent="teal"
                  thClassName="px-4 py-2.5 text-[10px] tracking-wide normal-case"
                />
                <SortableTableTh
                  label="GRN / Source #"
                  column="grnSourceNo"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                  accent="teal"
                  thClassName="px-4 py-2.5 text-[10px] tracking-wide normal-case"
                />
                <SortableTableTh
                  label="Item"
                  column="item"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                  accent="teal"
                  thClassName="px-4 py-2.5 text-[10px] tracking-wide normal-case min-w-[9rem]"
                />
                <SortableTableTh
                  label="Qty in Q"
                  column="qtyInQ"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                  accent="teal"
                  thClassName="px-4 py-2.5 text-[10px] tracking-wide normal-case"
                />
                <SortableTableTh
                  label="Source"
                  column="source"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                  accent="teal"
                  thClassName="px-4 py-2.5 text-[10px] tracking-wide normal-case"
                />
                <SortableTableTh
                  label="Assign"
                  column="assign"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                  accent="teal"
                  thClassName="px-4 py-2.5 text-[10px] tracking-wide normal-case"
                />
                <SortableTableTh
                  label="Approver"
                  column="approver"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                  accent="teal"
                  thClassName="px-4 py-2.5 text-[10px] tracking-wide normal-case"
                />
                <SortableTableTh
                  label="Priority"
                  column="priority"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                  accent="teal"
                  thClassName="px-4 py-2.5 text-[10px] tracking-wide normal-case"
                />
                <SortableTableTh
                  label="SLA"
                  column="sla"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                  accent="teal"
                  thClassName="px-4 py-2.5 text-[10px] tracking-wide normal-case"
                />
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold tracking-wide text-slate-500 whitespace-nowrap">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                  <td className="px-4 py-3 align-top whitespace-nowrap text-slate-800 font-medium">
                    {row.section}
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap text-slate-800 tabular-nums">
                    {row.quarantineDateDisplay}
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap">
                    <Link
                      to={row.sourceDetailHref}
                      className="font-mono text-[11px] font-semibold text-teal-800 hover:text-teal-950 hover:underline"
                    >
                      {row.grnSourceNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 align-top min-w-[9rem]">
                    <Link to={row.itemMasterHref} className="group block hover:underline">
                      <p className="font-semibold text-slate-900 leading-snug group-hover:text-teal-900">
                        {row.itemName}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5 group-hover:text-teal-800">
                        {row.itemCode}
                      </p>
                    </Link>
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap text-slate-800 tabular-nums">
                    {row.qtyInQ}
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap text-slate-700">{row.source}</td>
                  <td className="px-4 py-3 align-top whitespace-nowrap">
                    <label className="inline-flex items-center gap-0.5 text-slate-800">
                      <span className="sr-only">Assign reviewer for {row.itemName}</span>
                      <select
                        value={row.assignedTo}
                        disabled={assignSavingId === row.id}
                        onChange={(e) => onAssign(row, e.target.value)}
                        className="appearance-none bg-transparent border-0 p-0 text-xs font-medium text-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400 rounded disabled:opacity-60 max-w-[6.5rem] truncate"
                      >
                        <option value="">Open</option>
                        {assigneeOptions.map((name) => (
                          <option key={name} value={name}>
                            {formatQualityAssigneeShortName(name)}
                          </option>
                        ))}
                        {row.assignedTo &&
                        !assigneeOptions.some((n) => n.toLowerCase() === row.assignedTo.toLowerCase()) ? (
                          <option value={row.assignedTo}>{row.assignDisplay}</option>
                        ) : null}
                      </select>
                      <span className="text-slate-500 text-[10px] leading-none" aria-hidden="true">
                        ▾
                      </span>
                    </label>
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap text-slate-700">
                    {row.approverDisplay}
                  </td>
                  <td className={`px-4 py-3 align-top whitespace-nowrap text-[11px] tracking-wide ${row.priorityClass}`}>
                    {row.priorityDisplay}
                  </td>
                  <td
                    className={`px-4 py-3 align-top whitespace-nowrap text-[11px] ${qualityOrderManagementSlaClass(row.slaTone)}`}
                  >
                    <span className="mr-1" aria-hidden="true">
                      {row.slaIcon}
                    </span>
                    {row.slaLabel}
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onOpenQc(row)}
                      className="text-[11px] font-semibold text-slate-800 hover:text-slate-950 hover:underline"
                    >
                      {row.actionPrefix ? `${row.actionPrefix} ` : ''}
                      {row.actionLabel}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default QualityOrderManagementTable;
