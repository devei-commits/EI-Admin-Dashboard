/**
 * ProcSection — the ONE canonical layout kit for every Procurement side-section
 * (PR Inbox, Purchase Orders, Quote Requests, GRN Tracker, Stock Audit).
 *
 * Every section is: <ProcSection> = header (title + stat chips + actions) →
 * optional <ProcTabs> → <ProcFilterBar> (search + filters) → states/table.
 * Using these guarantees the sections read as one consistent product.
 */
import React, { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';

export type ProcTone = 'default' | 'brand' | 'ok' | 'warn' | 'err';

const TONE_CHIP: Record<ProcTone, string> = {
  default: 'bg-surface-3 text-ink-2',
  brand: 'bg-brand-soft text-brand',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  err: 'bg-err-soft text-err',
};

export interface ProcStat {
  value: ReactNode;
  label: ReactNode;
  tone?: ProcTone;
  /** Hide the chip when falsy (e.g. only show "SLA-breached" when > 0). */
  hidden?: boolean;
}

/** Outer wrapper — consistent vertical rhythm for every section. */
export const ProcSection: React.FC<{ children: ReactNode }> = ({ children }) => (
  <div className="space-y-3">{children}</div>
);

const TONE_TEXT: Record<ProcTone, string> = {
  default: 'text-ink',
  brand: 'text-brand',
  ok: 'text-ok',
  warn: 'text-warn',
  err: 'text-err',
};

/** Section header: icon + title (+ optional subtitle), a row of stat chips, and right-aligned actions. */
export const ProcSectionHeader: React.FC<{
  icon?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  stats?: ProcStat[];
  actions?: ReactNode;
}> = ({ icon, title, subtitle, stats, actions }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-[var(--e1)]">
    <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap min-w-0">
      <div className="min-w-0 shrink-0">
        <h2 className="text-sm font-semibold text-ink inline-flex items-center gap-1.5">
          {icon}
          {title}
        </h2>
        {subtitle && <p className="text-xs text-ink-3 mt-0.5">{subtitle}</p>}
      </div>
      {stats && stats.some((s) => !s.hidden) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {stats.filter((s) => !s.hidden).map((s, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] ${TONE_CHIP[s.tone ?? 'default']}`}
            >
              <b className="font-semibold tabular-nums">{s.value}</b>
              <span className="font-medium opacity-80">{s.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

/** One tab style for the whole module (underline). Optional count per tab. */
export function ProcTabs<T extends string>({
  tabs,
  value,
  onChange,
  trailing,
}: {
  tabs: { key: T; label: string; count?: number }[];
  value: T;
  onChange: (t: T) => void;
  trailing?: ReactNode;
}): JSX.Element {
  return (
    <div className="flex items-center gap-1 border-b border-border">
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors ${
              active ? 'text-brand border-brand' : 'text-ink-4 border-transparent hover:text-ink-2'
            }`}
          >
            {t.label}
            {t.count != null && <span className="ml-1.5 tabular-nums opacity-70">({t.count})</span>}
          </button>
        );
      })}
      {trailing && <div className="ml-2 flex items-center">{trailing}</div>}
    </div>
  );
}

/** Filter/toolbar container. `stack` for multi-row filter blocks. */
export const ProcFilterBar: React.FC<{ children: ReactNode; stack?: boolean; className?: string }> = ({
  children,
  stack = false,
  className = '',
}) => (
  <div
    className={`rounded-xl border border-border bg-surface-2 p-3 ${
      stack ? 'space-y-2' : 'flex flex-wrap items-center gap-2'
    } ${className}`}
  >
    {children}
  </div>
);

/** Standard filter chip (facet toggle). */
export function procChipClass(active: boolean): string {
  return `px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors inline-flex items-center gap-1 ${
    active ? 'bg-brand text-white border-brand' : 'bg-surface text-ink-3 border-border hover:bg-surface-2'
  }`;
}

/** Standard select className. */
export const procSelectClass =
  'px-3 py-2 border border-border rounded-lg text-sm bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] focus:border-[color:var(--accent)]';

/** Standard input className — matches selects, includes focus ring + tokens (use in modal forms). */
export const procInputClass =
  'w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface text-ink placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] focus:border-[color:var(--accent)]';

/** Canonical button classes — one look per role across the module. */
export const procBtnPrimary =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-brand text-white hover:bg-brand-press disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]';
export const procBtnSecondary =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-border bg-surface text-ink-2 hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]';
export const procBtnDanger =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-[color:var(--st-red-fg)]/40 text-err bg-surface hover:bg-err-soft disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]';

/** Standard table-row className — one hover treatment for every table. */
export const procRowClass = 'hover:bg-brand-soft transition-colors';

/** Search input with icon — one look for every section. */
export const ProcSearch: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}> = ({ value, onChange, placeholder = 'Search…', className = 'flex-1 min-w-[200px]', ...rest }) => (
  <div className={`relative ${className}`}>
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" size={15} />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={rest['aria-label'] ?? placeholder}
      className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-surface text-ink placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] focus:border-[color:var(--accent)]"
    />
  </div>
);

/** Table card — bordered, scrollable, consistent chrome. */
export const ProcTableCard: React.FC<{ children: ReactNode }> = ({ children }) => (
  <div className="overflow-x-auto rounded-xl border border-border">
    <table className="w-full text-sm text-left">{children}</table>
  </div>
);

/** Standard <thead>. Pass strings, or {label, align} for right/center columns. */
export const ProcThead: React.FC<{ cols: (string | { label: string; align?: 'left' | 'center' | 'right' })[] }> = ({
  cols,
}) => (
  <thead>
    <tr className="bg-surface-2 border-b border-border">
      {cols.map((c, i) => {
        const label = typeof c === 'string' ? c : c.label;
        const align = typeof c === 'string' ? 'left' : c.align ?? 'left';
        return (
          <th
            key={`${label}-${i}`}
            scope="col"
            className={`px-3 py-2 text-[10px] font-bold text-ink-3 uppercase tracking-wide whitespace-nowrap ${
              align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : ''
            }`}
          >
            {label}
          </th>
        );
      })}
    </tr>
  </thead>
);

/** Unified loading / error / empty state cards. */
export const ProcLoading: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="flex items-center justify-center py-16 gap-2 rounded-xl border border-border bg-surface">
    <span className="inline-block w-5 h-5 rounded-full border-2 border-current/30 border-t-current animate-spin text-brand" aria-hidden />
    <span className="text-sm text-ink-3">{label}</span>
  </div>
);

export const ProcError: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="rounded-xl border border-border bg-surface">
    <ErrorState message={message} onRetry={onRetry} />
  </div>
);

export const ProcEmpty: React.FC<{ icon?: ReactNode; children: ReactNode }> = ({ icon, children }) => (
  <div className="rounded-xl border border-border bg-surface">
    <EmptyState icon={icon} title={children} />
  </div>
);

/** KPI card grid — the standard "stat cards" row for analytics dashboards. */
export interface ProcStatCard {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: ProcTone;
}
export const ProcStatCards: React.FC<{ cards: ProcStatCard[]; cols?: 2 | 3 | 4 | 5 }> = ({ cards, cols = 4 }) => {
  const gridCols =
    cols === 2 ? 'sm:grid-cols-2'
    : cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3'
    : cols === 5 ? 'sm:grid-cols-3 lg:grid-cols-5'
    : 'sm:grid-cols-2 lg:grid-cols-4';
  return (
    <div className={`grid grid-cols-1 ${gridCols} gap-3`}>
      {cards.map((c, i) => (
        <div key={i} className="rounded-xl border border-border bg-surface p-4 shadow-[var(--e1)]">
          <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest">{c.label}</p>
          <p className={`text-2xl md:text-3xl font-bold tabular-nums mt-2 ${TONE_TEXT[c.tone ?? 'default']}`}>{c.value}</p>
          {c.sub != null && <p className="text-xs text-ink-3 mt-1">{c.sub}</p>}
        </div>
      ))}
    </div>
  );
};

/** Titled panel card — for breakdowns, detail sections, or a titled table (use `bodyClassName="p-0"`). */
export const ProcPanel: React.FC<{
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
}> = ({ title, actions, children, bodyClassName = 'p-4' }) => (
  <div className="rounded-xl border border-border bg-surface shadow-[var(--e1)] overflow-hidden">
    {(title || actions) && (
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-surface-2">
        {title && <h3 className="text-sm font-semibold text-ink">{title}</h3>}
        {actions}
      </div>
    )}
    <div className={bodyClassName}>{children}</div>
  </div>
);
