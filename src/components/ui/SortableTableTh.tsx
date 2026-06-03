import React from 'react';

export type SortDirection = 'asc' | 'desc';

export type SortableTableAccent = 'cyan' | 'teal' | 'violet';

const ACCENT_ACTIVE: Record<SortableTableAccent, string> = {
  cyan: 'text-cyan-700 bg-cyan-50 hover:bg-cyan-100',
  teal: 'text-teal-700 bg-teal-50 hover:bg-teal-100',
  violet: 'text-violet-700 bg-violet-50 hover:bg-violet-100',
};

const ACCENT_ARROW: Record<SortableTableAccent, string> = {
  cyan: 'text-cyan-600',
  teal: 'text-teal-600',
  violet: 'text-violet-600',
};

interface SortableTableThProps<T extends string> {
  label: React.ReactNode;
  column: T;
  sortColumn: T | null;
  sortDirection: SortDirection;
  onSort: (col: T) => void;
  align?: 'left' | 'right';
  title?: string;
  accent?: SortableTableAccent;
  thClassName?: string;
}

export function SortableTableTh<T extends string>({
  label,
  column,
  sortColumn,
  sortDirection,
  onSort,
  align = 'left',
  title,
  accent = 'cyan',
  thClassName = '',
}: SortableTableThProps<T>): JSX.Element {
  const active = sortColumn === column;
  const alignClass = align === 'right' ? 'text-right' : 'text-left';
  const focusRing =
    accent === 'teal'
      ? 'focus-visible:ring-teal-500'
      : accent === 'violet'
        ? 'focus-visible:ring-violet-500'
        : 'focus-visible:ring-cyan-500';
  return (
    <th
      className={`px-4 py-3 ${alignClass} text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${thClassName}`}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        title={title}
        aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={`group inline-flex items-center gap-1 -mx-1.5 px-1.5 py-1 rounded-md cursor-pointer transition-colors duration-150 focus:outline-none focus-visible:ring-2 ${focusRing} ${
          align === 'right' ? 'ml-auto' : ''
        } ${
          active ? ACCENT_ACTIVE[accent] : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/70'
        }`}
      >
        {label}
        <span
          className={`text-[10px] not-italic leading-none transition-opacity duration-150 ${
            active ? `opacity-100 ${ACCENT_ARROW[accent]}` : 'opacity-0 group-hover:opacity-70 text-gray-500'
          }`}
          aria-hidden
        >
          {active ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );
}
