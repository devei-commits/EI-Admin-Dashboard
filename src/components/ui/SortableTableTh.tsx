import React from 'react';

export type SortDirection = 'asc' | 'desc';

export type SortableTableAccent = 'cyan' | 'teal' | 'violet' | 'brand';

// Design language: a single brand accent. All legacy accents collapse to brand so
// sortable headers look identical across every module.
const ACCENT_ACTIVE: Record<SortableTableAccent, string> = {
  cyan: 'text-brand bg-brand-soft hover:bg-brand-soft-2',
  teal: 'text-brand bg-brand-soft hover:bg-brand-soft-2',
  violet: 'text-brand bg-brand-soft hover:bg-brand-soft-2',
  brand: 'text-brand bg-brand-soft hover:bg-brand-soft-2',
};

const ACCENT_ARROW: Record<SortableTableAccent, string> = {
  cyan: 'text-brand',
  teal: 'text-brand',
  violet: 'text-brand',
  brand: 'text-brand',
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
  const focusRing = 'focus-visible:ring-[color:var(--ring)]';
  return (
    <th scope="col"
      scope="col"
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
          active ? ACCENT_ACTIVE[accent] : 'text-ink-3 hover:text-ink hover:bg-surface-3'
        }`}
      >
        {label}
        <span
          className={`text-[10px] not-italic leading-none transition-opacity duration-150 ${
            active ? `opacity-100 ${ACCENT_ARROW[accent]}` : 'opacity-0 group-hover:opacity-70 text-ink-4'
          }`}
          aria-hidden
        >
          {active ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );
}
