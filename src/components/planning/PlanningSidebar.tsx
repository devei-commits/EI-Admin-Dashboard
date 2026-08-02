import React from 'react';
import { ClipboardText, Package, Stack, type Icon } from '@phosphor-icons/react';
import { NavSidebar } from '../ui/NavSidebar';

export type PlanningView = 'pis-extracted' | 'items-involved' | 'batches';

const SECTIONS: { key: PlanningView; label: string; icon: Icon }[] = [
  { key: 'pis-extracted', label: 'PIS Extracted', icon: ClipboardText },
  { key: 'items-involved', label: 'Items Involved', icon: Package },
  { key: 'batches', label: 'Batches', icon: Stack },
];

const COLLAPSE_KEY = 'planning-sidebar-collapsed';

export type PlanningSidebarProps = {
  activeView: PlanningView;
  onNavigate: (view: PlanningView) => void;
  counts?: Partial<Record<PlanningView, number>>;
};

export function PlanningSidebar({ activeView, onNavigate, counts }: PlanningSidebarProps): React.ReactElement {
  return (
    <NavSidebar
      title="Planning"
      moduleName="planning"
      collapseKey={COLLAPSE_KEY}
      activeKey={activeView}
      onNavigate={(k) => onNavigate(k as PlanningView)}
      sections={SECTIONS.map(({ key, label, icon: Ico }) => ({
        key,
        label,
        icon: <Ico className="w-4 h-4 shrink-0" weight={activeView === key ? 'fill' : 'regular'} />,
        count: counts?.[key],
      }))}
    />
  );
}
