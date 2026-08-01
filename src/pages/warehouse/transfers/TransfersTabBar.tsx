export type TransfersTab = 'transfer-orders' | 'returns' | 'invoice';

const TABS: { id: TransfersTab; label: string }[] = [
  { id: 'transfer-orders', label: 'Transfer orders' },
  { id: 'returns', label: 'Returns' },
  { id: 'invoice', label: 'Invoice' },
];

/** Shared category switcher for Warehouse → Transfers. Rendered directly below each view's search bar. */
const TransfersTabBar = ({
  active,
  onChange,
}: {
  active: TransfersTab;
  onChange: (tab: TransfersTab) => void;
}) => (
  <div className="flex gap-1 border-b border-border my-3">
    {TABS.map((t) => (
      <button
        key={t.id}
        type="button"
        onClick={() => onChange(t.id)}
        className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
          active === t.id
            ? 'border-brand text-brand'
            : 'border-transparent text-ink-3 hover:text-ink hover:border-border'
        }`}
      >
        {t.label}
      </button>
    ))}
  </div>
);

export default TransfersTabBar;
