import {
  MASTER_APPROVAL_STATUSES,
  masterApprovalStatusBadgeClass,
  type MasterApprovalStatus,
} from '../../constants/masterApprovalStatus';

export type MasterApprovalStatusTabsAccent = 'teal' | 'violet' | 'blue' | 'brand';

export type MasterApprovalStatusTabsProps = {
  value: string;
  onChange: (tab: string) => void;
  counts: Record<string, number>;
  /** Extra tabs after the standard approval workflow (e.g. Discontinued on PR). */
  extraTabs?: readonly { id: string; label: string }[];
  accent?: MasterApprovalStatusTabsAccent;
  className?: string;
};

const ACCENT_ACTIVE: Record<MasterApprovalStatusTabsAccent, string> = {
  teal: 'bg-brand text-brand-ink border-brand shadow-[var(--e1)]',
  violet: 'bg-brand text-brand-ink border-brand shadow-[var(--e1)]',
  blue: 'bg-brand text-brand-ink border-brand shadow-[var(--e1)]',
  brand: 'bg-brand text-brand-ink border-brand shadow-[var(--e1)]',
};

const ACCENT_RING: Record<MasterApprovalStatusTabsAccent, string> = {
  teal: 'focus-visible:ring-[color:var(--ring)]',
  violet: 'focus-visible:ring-[color:var(--ring)]',
  blue: 'focus-visible:ring-[color:var(--ring)]',
  brand: 'focus-visible:ring-[color:var(--ring)]',
};

function tabBadgeClass(statusId: string, isSelected: boolean): string {
  if (isSelected) return 'bg-surface/20 text-inherit border-white/30';
  if (statusId === 'all') return 'bg-surface-3 text-ink-3 border-hairline';
  return masterApprovalStatusBadgeClass(statusId);
}

export function MasterApprovalStatusTabs({
  value,
  onChange,
  counts,
  extraTabs = [],
  accent = 'teal',
  className = '',
}: MasterApprovalStatusTabsProps): JSX.Element {
  const tabs: { id: string; label: string }[] = [
    { id: 'all', label: 'All' },
    ...MASTER_APPROVAL_STATUSES.map((s) => ({ id: s, label: s })),
    ...extraTabs,
  ];

  return (
    <div
      role="tablist"
      aria-label="Filter by approval status"
      className={`flex flex-wrap items-center gap-2 ${className}`}
    >
      {tabs.map((tab) => {
        const isSelected = value === tab.id;
        const count = counts[tab.id] ?? 0;
        const isApprovalStatus = MASTER_APPROVAL_STATUSES.includes(tab.id as MasterApprovalStatus);
        const inactiveClass = isApprovalStatus
          ? 'border-border bg-surface text-ink-2 hover:bg-surface-3'
          : tab.id === 'all'
            ? 'border-border bg-surface text-ink-2 hover:bg-surface-3'
            : 'border-border bg-surface text-ink-3 hover:bg-surface-3';

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors focus:outline-none focus-visible:ring-2 ${ACCENT_RING[accent]} ${
              isSelected ? ACCENT_ACTIVE[accent] : inactiveClass
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`inline-flex min-w-[1.25rem] justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${tabBadgeClass(tab.id, isSelected)}`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
