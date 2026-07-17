import { useState } from 'react';
import OutboundDashboard from './OverviewComplete';
import TransfersTabBar, { type TransfersTab } from './transfers/TransfersTabBar';

/**
 * Warehouse → Transfers. Three categories (Transfer orders / Returns / Invoice) share ONE
 * constant frame: the dashboard chrome (stat cards, title + actions, status chips, search, tab
 * bar) always renders; only the table below swaps by category. OverviewComplete hosts all three
 * and renders the Returns/Invoice tables inline, so switching tabs never changes the surrounding UI.
 */
const WarehouseOutbound = () => {
  const [tab, setTab] = useState<TransfersTab>('transfer-orders');
  const tabBar = <TransfersTabBar active={tab} onChange={setTab} />;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      <OutboundDashboard tab={tab} transfersTabBar={tabBar} />
    </div>
  );
};

export default WarehouseOutbound;
