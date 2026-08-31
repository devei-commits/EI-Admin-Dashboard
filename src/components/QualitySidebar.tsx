import React from 'react';
import {
  SquaresFour, ClipboardText, MagnifyingGlass, ClockCounterClockwise, Flask, Leaf, Package, Sparkle,
  type Icon,
} from '@phosphor-icons/react';
import { NavSidebar } from './ui/NavSidebar';
import { QUALITY_DEVELOPMENT_SECTIONS } from '../constants/qualityDevelopmentsStatic';

interface QualitySidebarProps {
  activeSection: string;
  onSectionChange: (sectionId: string) => void;
}

const OPERATIONS_NAV: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'order-management', label: 'Order Management' },
  { id: 'inbound-qc', label: 'Inbound QC' },
  { id: 'qc-history', label: 'QC History' },
  { id: 'third-party-tracking', label: '3rd-Party Tracking' },
];

const DEVELOPMENTS_NAV = QUALITY_DEVELOPMENT_SECTIONS.map((section) => ({
  id: section.routeId,
  label: section.navLabel,
}));

const SECTION_ICON: Record<string, Icon> = {
  overview: SquaresFour,
  'order-management': ClipboardText,
  'inbound-qc': MagnifyingGlass,
  'qc-history': ClockCounterClockwise,
  'third-party-tracking': Flask,
  'rm-developments': Leaf,
  'pm-developments': Package,
  'pis-developments': Sparkle,
};

const COLLAPSE_KEY = 'quality-sidebar-collapsed';

const QualitySidebar: React.FC<QualitySidebarProps> = ({ activeSection, onSectionChange }) => {
  return (
    <NavSidebar
      title="Quality"
      moduleName="quality"
      collapseKey={COLLAPSE_KEY}
      activeKey={activeSection}
      onNavigate={onSectionChange}
      sections={[...OPERATIONS_NAV, ...DEVELOPMENTS_NAV].map((item) => {
        const Ico = SECTION_ICON[item.id] ?? SquaresFour;
        return {
          key: item.id,
          label: item.label,
          icon: <Ico className="w-4 h-4 shrink-0" weight={activeSection === item.id ? 'fill' : 'regular'} />,
        };
      })}
    />
  );
};

export default QualitySidebar;
