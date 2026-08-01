import React from 'react';
import { ShoppingCart, Package, type Icon } from '@phosphor-icons/react';
import { NavSidebar } from '../ui/NavSidebar';

export type FulfillmentView = 'so-dashboard' | 'products-batches';

const SECTIONS: { key: FulfillmentView; label: string; icon: Icon }[] = [
  { key: 'so-dashboard', label: 'SO Dashboard', icon: ShoppingCart },
  { key: 'products-batches', label: 'Products & Batches', icon: Package },
];

const COLLAPSE_KEY = 'fulfillment-sidebar-collapsed';

export type FulfillmentSidebarProps = {
  activeView: FulfillmentView;
  onNavigate: (view: FulfillmentView) => void;
  counts?: Partial<Record<FulfillmentView, number>>;
};

export function FulfillmentSidebar({ activeView, onNavigate, counts }: FulfillmentSidebarProps): React.ReactElement {
  return (
    <NavSidebar
      title="Fulfillment"
      moduleName="fulfillment"
      collapseKey={COLLAPSE_KEY}
      activeKey={activeView}
      onNavigate={(k) => onNavigate(k as FulfillmentView)}
      sections={SECTIONS.map(({ key, label, icon: Ico }) => ({
        key,
        label,
        icon: <Ico className="w-4 h-4 shrink-0" weight={activeView === key ? 'fill' : 'regular'} />,
        count: counts?.[key],
      }))}
    />
  );
}
