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
  <div className="flex gap-1 border-b border-slate-200 my-3">
    {TABS.map((t) => (
      <button
        key={t.id}
        type="button"
        onClick={() => onChange(t.id)}
        className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
          active === t.id
            ? 'border-amber-500 text-amber-700'
            : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
        }`}
      >
        {t.label}
      </button>
    ))}
  </div>
);

export default TransfersTabBar;
