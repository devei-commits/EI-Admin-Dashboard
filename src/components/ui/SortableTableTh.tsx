import React from 'react';

export type SortDirection = 'asc' | 'desc';

interface SortableTableThProps<T extends string> {
  label: React.ReactNode;
  column: T;
  sortColumn: T | null;
  sortDirection: SortDirection;
  onSort: (col: T) => void;
  align?: 'left' | 'right';
  title?: string;
}

export function SortableTableTh<T extends string>({
  label,
  column,
  sortColumn,
  sortDirection,
  onSort,
  align = 'left',
  title,
}: SortableTableThProps<T>): JSX.Element {
  const active = sortColumn === column;
  const alignClass = align === 'right' ? 'text-right' : 'text-left';
  return (
    <th className={`px-4 py-3 ${alignClass} text-xs font-semibold uppercase tracking-wider`}>
      <button
        type="button"
        onClick={() => onSort(column)}
        title={title}
        aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={`group inline-flex items-center gap-1 -mx-1.5 px-1.5 py-1 rounded-md cursor-pointer transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
          align === 'right' ? 'ml-auto' : ''
        } ${
          active ? 'text-cyan-700 bg-cyan-50 hover:bg-cyan-100' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/70'
        }`}
      >
        {label}
        <span
          className={`text-[10px] not-italic leading-none transition-opacity duration-150 ${
            active ? 'opacity-100 text-cyan-600' : 'opacity-0 group-hover:opacity-70 text-gray-500'
          }`}
          aria-hidden
        >
          {active ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );
}
