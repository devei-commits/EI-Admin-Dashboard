/**
 * BD Management sidebar — controlled 5-tab navigator (§2). Thin wrapper over the
 * shared NavSidebar: keeps the BD_NAV vocabulary + lucide icons; counts shown as
 * badges only where > 0.
 */
import React from 'react';
import { NavSidebar } from '../ui/NavSidebar';
import { BD_NAV, type BdTab } from '../../lib/bdNav';

export interface BDSidebarProps {
  activeTab: BdTab;
  counts?: Partial<Record<BdTab, number>>;
  onNavigate: (tab: BdTab) => void;
}

const COLLAPSE_KEY = 'bd-sidebar-collapsed';

export const BDSidebar: React.FC<BDSidebarProps> = ({ activeTab, counts = {}, onNavigate }) => {
  return (
    <NavSidebar
      title="BD Management"
      moduleName="bd"
      collapseKey={COLLAPSE_KEY}
      activeKey={activeTab}
      onNavigate={(k) => onNavigate(k as BdTab)}
      sections={BD_NAV.map((item) => {
        const Icon = item.icon;
        const count = counts[item.key] ?? 0;
        return {
          key: item.key,
          label: item.key,
          icon: <Icon size={18} className="shrink-0" />,
          count: count > 0 ? count : undefined,
        };
      })}
    />
  );
};
