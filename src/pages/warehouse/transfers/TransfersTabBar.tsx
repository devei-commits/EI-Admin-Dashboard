import { Tabs, type TabItem } from '../../../components/ui';

export type TransfersTab = 'transfer-orders' | 'returns' | 'invoice';

const TABS: TabItem<TransfersTab>[] = [
  { key: 'transfer-orders', label: 'Transfer orders' },
  { key: 'returns', label: 'Returns' },
  { key: 'invoice', label: 'Invoice' },
];

/** Shared category switcher for Warehouse → Transfers. Thin wrapper over the shared ui Tabs. */
const TransfersTabBar = ({
  active,
  onChange,
}: {
  active: TransfersTab;
  onChange: (tab: TransfersTab) => void;
}) => <Tabs tabs={TABS} value={active} onChange={onChange} className="my-3" />;

export default TransfersTabBar;
