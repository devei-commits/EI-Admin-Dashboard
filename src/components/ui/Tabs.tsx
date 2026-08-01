import React from 'react';

/**
 * Tabs — one underline tab-bar for the whole app (folds ProcTabs, Production's
 * inline TabBar, TransfersTabBar, MasterApprovalStatusTabs). Optional per-tab
 * count badge. Keys are strings; generic `<T extends string>` preserved so
 * callers keep their literal union types.
 */
export interface TabItem<T extends string = string> {
  key: T;
  label: React.ReactNode;
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  value: T;
  onChange: (key: T) => void;
  /** Trailing content aligned right of the tab row. */
  trailing?: React.ReactNode;
  className?: string;
}

export function Tabs<T extends string = string>({
  tabs,
  value,
  onChange,
  trailing,
  className = '',
}: TabsProps<T>): React.ReactElement {
  return (
    <div className={`flex items-center gap-1 border-b border-border ${className}`} role="tablist">
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] ${
              active ? 'text-brand border-brand' : 'text-ink-4 border-transparent hover:text-ink-2'
            }`}
          >
            {t.icon}
            {t.label}
            {t.count != null && <span className="tabular-nums opacity-70">({t.count})</span>}
          </button>
        );
      })}
      {trailing && <div className="ml-auto flex items-center">{trailing}</div>}
    </div>
  );
}
