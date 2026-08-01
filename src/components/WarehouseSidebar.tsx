import React from 'react';
import {
  SquaresFour, MapPin, Package, TrayArrowDown, ArrowsLeftRight, ClipboardText,
  type Icon,
} from '@phosphor-icons/react';
import { NavSidebar } from './ui/NavSidebar';

interface WarehouseSidebarProps {
  activeSection: string;
  onSectionChange: (sectionId: string) => void;
  counts?: Record<string, number>;
}

const SECTIONS: { id: string; label: string; icon: Icon }[] = [
  { id: 'overview', label: 'Overview', icon: SquaresFour },
  { id: 'locations', label: 'Locations', icon: MapPin },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'inbound', label: 'Inbound', icon: TrayArrowDown },
  { id: 'outbound', label: 'Transfer orders', icon: ArrowsLeftRight },
  { id: 'stock-check-requests', label: 'Stock Check Requests', icon: ClipboardText },
];

const COLLAPSE_KEY = 'warehouse-sidebar-collapsed';

const WarehouseSidebar: React.FC<WarehouseSidebarProps> = ({
  activeSection,
  onSectionChange,
  counts,
}) => {
  return (
    <NavSidebar
      title="Warehouse"
      moduleName="warehouse"
      collapseKey={COLLAPSE_KEY}
      activeKey={activeSection}
      onNavigate={onSectionChange}
      sections={SECTIONS.map(({ id, label, icon: Ico }) => ({
        key: id,
        label,
        icon: <Ico className="w-4 h-4 shrink-0" weight={activeSection === id ? 'fill' : 'regular'} />,
        count: counts?.[id],
      }))}
    />
  );
};

export default WarehouseSidebar;
