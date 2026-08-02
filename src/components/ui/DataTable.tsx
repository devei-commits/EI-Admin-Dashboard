import React, { useState, useMemo, ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { TableSkeleton } from './Skeleton';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';

export interface TableColumn<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T, index: number) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyField?: keyof T;
  emptyMessage?: string;
  /** Optional icon element for the empty state. */
  emptyIcon?: ReactNode;
  /** Show a skeleton table body while data loads. */
  loading?: boolean;
  /** Rows to render in the loading skeleton. */
  skeletonRows?: number;
  /** Render an error state (with optional Retry) instead of rows. */
  error?: ReactNode;
  onRetry?: () => void;
  className?: string;
  rowClassName?: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Card is its own vertical scroll box so the sticky header pins within it (default true). */
  stickyHeader?: boolean;
  /** Tailwind max-height class used when stickyHeader (default `max-h-[70vh]`). */
  maxHeight?: string;
}

type SortDir = 'asc' | 'desc' | null;

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  emptyMessage = 'No data found.',
  emptyIcon,
  loading = false,
  skeletonRows = 6,
  error,
  onRetry,
  className = '',
  rowClassName,
  onRowClick,
  stickyHeader = true,
  maxHeight = 'max-h-[70vh]',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const handleSort = (key: string) => {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); return; }
    if (sortDir === 'asc') { setSortDir('desc'); return; }
    setSortKey(null); setSortDir(null);
  };

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const SortIcon = ({ col }: { col: TableColumn<T> }) => {
    if (!col.sortable) return null;
    const key = String(col.key);
    if (sortKey !== key) return <ChevronsUpDown className="w-3.5 h-3.5 text-ink-4 ml-1 inline" />;
    if (sortDir === 'asc') return <ChevronUp className="w-3.5 h-3.5 text-brand ml-1 inline" />;
    return <ChevronDown className="w-3.5 h-3.5 text-brand ml-1 inline" />;
  };

  return (
    <div className={`${stickyHeader ? `overflow-auto ${maxHeight}` : 'overflow-x-auto'} ${className}`}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-20">
          <tr className="border-b border-border bg-surface-3 [&_th]:bg-surface-3">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                scope="col"
                onClick={() => col.sortable && handleSort(String(col.key))}
                className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-3 ${col.sortable ? 'cursor-pointer select-none hover:bg-surface-2' : ''} ${col.headerClassName ?? ''}`}
              >
                {col.label}
                <SortIcon col={col} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6">
                <TableSkeleton rows={skeletonRows} cols={columns.length} />
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={columns.length} className="px-4">
                <ErrorState message={typeof error === 'string' ? error : undefined} onRetry={onRetry} compact />
              </td>
            </tr>
          ) : sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4">
                <EmptyState icon={emptyIcon} title={emptyMessage} compact />
              </td>
            </tr>
          ) : (
            sorted.map((row, idx) => (
              <tr
                key={keyField ? String(row[keyField as string]) : idx}
                onClick={() => onRowClick?.(row)}
                className={`hover:bg-surface-3 transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${rowClassName?.(row) ?? ''}`}
              >
                {columns.map((col) => (
                  <td key={String(col.key)} className={`px-4 py-3 ${col.className ?? ''}`}>
                    {col.render
                      ? col.render(row[String(col.key)], row, idx)
                      : String(row[String(col.key)] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
