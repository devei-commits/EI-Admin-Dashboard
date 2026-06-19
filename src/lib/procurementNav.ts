import type { MainTab, SideSection } from '../types/procurement.types';

export const PROCUREMENT_PIPELINE_SECTIONS: SideSection[] = [
  'Overview',
  'Requests',
  'Quotations',
  'Draft POs',
  'Issued POs',
];

export const PROCUREMENT_OPERATIONS_SECTIONS: SideSection[] = ['GRN Monitor', 'Inventory Audit'];

export const PROCUREMENT_MAIN_TABS: MainTab[] = ['Procurement', 'Vendors', 'Reports'];

export function procurementSectionPath(section: SideSection): string {
  const params = new URLSearchParams({ tab: 'Procurement', section });
  return `/procurement?${params.toString()}`;
}

export function procurementMainTabPath(tab: MainTab): string {
  if (tab === 'Procurement') {
    return procurementSectionPath('Overview');
  }
  const params = new URLSearchParams({ tab });
  return `/procurement?${params.toString()}`;
}

export function parseProcurementRoute(search: string): { tab: MainTab; section: SideSection } {
  const params = new URLSearchParams(search);
  const tabRaw = params.get('tab');
  const sectionRaw = params.get('section');
  const tab: MainTab =
    tabRaw === 'Vendors' || tabRaw === 'Reports' || tabRaw === 'Procurement' ? tabRaw : 'Procurement';
  const section: SideSection =
    sectionRaw === 'Overview' ||
    sectionRaw === 'Requests' ||
    sectionRaw === 'Quotations' ||
    sectionRaw === 'Draft POs' ||
    sectionRaw === 'Issued POs' ||
    sectionRaw === 'GRN Monitor' ||
    sectionRaw === 'Inventory Audit'
      ? sectionRaw
      : 'Overview';
  return { tab, section };
}
