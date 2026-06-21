import {
  MASTER_APPROVAL_STATUSES,
  masterApprovalStatusBadgeClass,
  type MasterApprovalStatus,
} from '../../constants/masterApprovalStatus';

export type MasterApprovalStatusTabsAccent = 'teal' | 'violet' | 'blue';

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
  teal: 'bg-teal-600 text-white border-teal-600 shadow-sm',
  violet: 'bg-violet-600 text-white border-violet-600 shadow-sm',
  blue: 'bg-blue-600 text-white border-blue-600 shadow-sm',
};

const ACCENT_RING: Record<MasterApprovalStatusTabsAccent, string> = {
  teal: 'focus-visible:ring-teal-500',
  violet: 'focus-visible:ring-violet-500',
  blue: 'focus-visible:ring-blue-500',
};

function tabBadgeClass(statusId: string, isSelected: boolean): string {
  if (isSelected) return 'bg-white/20 text-inherit border-white/30';
  if (statusId === 'all') return 'bg-gray-100 text-gray-600 border-gray-200';
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
          ? 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          : tab.id === 'all'
            ? 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50';

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
