import type { MainTab, SideSection } from '../types/procurement.types';

/** Five procurement views per spec (§1–§7). */
export const PROCUREMENT_SECTIONS: SideSection[] = [
  'Requests',
  'Purchase Orders',
  'Quote Requests',
  'Stock Audit',
  'GRN Tracker',
];

/** @deprecated Use PROCUREMENT_SECTIONS */
export const PROCUREMENT_PIPELINE_SECTIONS = PROCUREMENT_SECTIONS;

/** @deprecated Operations merged into PROCUREMENT_SECTIONS */
export const PROCUREMENT_OPERATIONS_SECTIONS: SideSection[] = [];

export const PROCUREMENT_MAIN_TABS: MainTab[] = ['Procurement'];

const LEGACY_SECTION_ALIASES: Record<string, SideSection> = {
  Overview: 'Requests',
  Quotations: 'Quote Requests',
  'Draft POs': 'Purchase Orders',
  'Issued POs': 'Purchase Orders',
  'GRN Monitor': 'GRN Tracker',
  'Inventory Audit': 'Stock Audit',
};

export function normalizeProcurementSection(raw: string | null | undefined): SideSection {
  if (!raw) return 'Requests';
  if ((PROCUREMENT_SECTIONS as string[]).includes(raw)) return raw as SideSection;
  return LEGACY_SECTION_ALIASES[raw] ?? 'Requests';
}

export function procurementSectionPath(section: SideSection): string {
  const params = new URLSearchParams({ tab: 'Procurement', section });
  return `/procurement?${params.toString()}`;
}

export function procurementMainTabPath(_tab: MainTab = 'Procurement'): string {
  return procurementSectionPath('Requests');
}

export function parseProcurementRoute(search: string): { tab: MainTab; section: SideSection } {
  const params = new URLSearchParams(search);
  const tabRaw = params.get('tab');
  const sectionRaw = params.get('section');
  const tab: MainTab = tabRaw === 'Procurement' ? 'Procurement' : 'Procurement';
  const section = normalizeProcurementSection(sectionRaw);
  return { tab, section };
}
