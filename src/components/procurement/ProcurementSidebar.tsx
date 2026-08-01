import React from 'react';
import { ClipboardText, Package, ChatCircle, MagnifyingGlass, Truck, type Icon } from '@phosphor-icons/react';
import { NavSidebar } from '../ui/NavSidebar';
import type { MainTab, SideSection } from '../../types/procurement.types';
import { PROCUREMENT_SECTIONS } from '../../lib/procurementNav';

export type ProcurementSidebarProps = {
  mainTab: MainTab;
  sideSection: SideSection;
  sideCounts: Record<SideSection, number>;
  onNavigate: (tab: MainTab, section?: SideSection) => void;
};

const SECTION_ICON: Record<string, Icon> = {
  'Procurement Requests': ClipboardText,
  'Purchase Orders': Package,
  'Quote Requests': ChatCircle,
  'Stock Audit': MagnifyingGlass,
  'GRN Tracker': Truck,
};

const COLLAPSE_KEY = 'proc-sidebar-collapsed';

export function ProcurementSidebar({
  mainTab,
  sideSection,
  sideCounts,
  onNavigate,
}: ProcurementSidebarProps): React.ReactElement {
  const activeKey = mainTab === 'Procurement' ? sideSection : '';
  return (
    <NavSidebar
      title="Procurement"
      moduleName="procurement"
      collapseKey={COLLAPSE_KEY}
      activeKey={activeKey}
      onNavigate={(k) => onNavigate('Procurement', k as SideSection)}
      sections={PROCUREMENT_SECTIONS.map((section) => {
        const Ico = SECTION_ICON[section] ?? Package;
        return {
          key: section,
          label: section,
          icon: <Ico className="w-4 h-4 shrink-0" weight={activeKey === section ? 'fill' : 'regular'} />,
          count: sideCounts[section] ?? 0,
        };
      })}
    />
  );
}
