import { PM_MASTER_MODULE_ORDER } from '../constants/pmMasterFieldSchema';
import { RM_MASTER_MODULE_ORDER } from '../constants/rmMasterFieldSchema';
import { resolveGrnReceiptSource } from './inboundGrnSourceFilter';
import {
  resolveQualitySection,
  type QualityMaterialSection,
  type QualityOrderManagementInput,
} from './qualityOrderManagementTableDisplay';

export type QualitySourceDetailKind = 'warehouse-grn' | 'production-batch' | 'rd-draft';

export const QUALITY_SOURCE_DETAIL_LABELS: Record<QualitySourceDetailKind, string> = {
  'warehouse-grn': 'Warehouse GRN',
  'production-batch': 'Production batch',
  'rd-draft': 'R&D draft',
};

export function resolveMasterQualityStageIndex(section: QualityMaterialSection): number {
  const order = section === 'PM' ? PM_MASTER_MODULE_ORDER : RM_MASTER_MODULE_ORDER;
  const idx = order.findIndex((m) => m.slug === 'quality');
  return idx >= 0 ? idx : 0;
}

export function isQualityRdDraftSource(grn: QualityOrderManagementInput): boolean {
  const explicit = String(grn.receiptSource ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (explicit === 'rd' || explicit === 'rnd' || explicit === 'r&d' || explicit === 'research') {
    return true;
  }
  const po = String(grn.poNo ?? '').trim();
  if (/^(RD|R&D|RND)[-_\s/]/i.test(po)) return true;
  const vendor = String(grn.vendor ?? '').trim();
  if (/\br\s*&?\s*d\b/i.test(vendor) || /research/i.test(vendor)) return true;
  const zone = String(grn.locationZone ?? '').trim();
  if (/r\s*&?\s*d|research/i.test(zone)) return true;
  return false;
}

export function resolveQualitySourceDetailKind(grn: QualityOrderManagementInput): QualitySourceDetailKind {
  if (isQualityRdDraftSource(grn)) return 'rd-draft';
  const receipt = resolveGrnReceiptSource(grn);
  if (receipt === 'transfer') return 'production-batch';
  return 'warehouse-grn';
}

export function buildQualityItemMasterHref(
  section: QualityMaterialSection,
  itemCode: string,
): string {
  const code = String(itemCode ?? '').trim();
  const params = new URLSearchParams({ step: 'quality' });
  if (section === 'PM') {
    if (code) params.set('pm', code);
    return `/packaging?${params.toString()}`;
  }
  if (code) params.set('rm', code);
  return `/raw-material?${params.toString()}`;
}

export function buildQualitySourceDetailHref(
  grn: QualityOrderManagementInput,
  kind: QualitySourceDetailKind = resolveQualitySourceDetailKind(grn),
): string {
  switch (kind) {
    case 'production-batch': {
      const ref = String(grn.transferOrderRef ?? grn.poNo ?? '').trim();
      const params = new URLSearchParams({ section: 'batches' });
      if (ref) params.set('bmr', ref);
      return `/production?${params.toString()}`;
    }
    case 'rd-draft': {
      const section = resolveQualitySection(grn);
      const code = String(grn.lineItems?.[0]?.itemCode ?? '').trim();
      return buildQualityItemMasterHref(section, code);
    }
    case 'warehouse-grn':
    default:
      return `/warehouse/inbound?grn=${encodeURIComponent(grn.id)}`;
  }
}

export function buildQualityItemMasterHint(section: QualityMaterialSection): string {
  if (section === 'PM') return 'Item master · GRN Quality Checks';
  return 'Item master · Quality specifications';
}

export type QualityTableNavigation = {
  sourceDetailKind: QualitySourceDetailKind;
  sourceDetailLabel: string;
  sourceDetailHref: string;
  itemMasterHref: string;
  itemMasterHint: string;
};

export function buildQualityTableNavigation(grn: QualityOrderManagementInput): QualityTableNavigation {
  const section = resolveQualitySection(grn);
  const code = String(grn.lineItems?.[0]?.itemCode ?? '').trim();
  const sourceDetailKind = resolveQualitySourceDetailKind(grn);
  return {
    sourceDetailKind,
    sourceDetailLabel: QUALITY_SOURCE_DETAIL_LABELS[sourceDetailKind],
    sourceDetailHref: buildQualitySourceDetailHref(grn, sourceDetailKind),
    itemMasterHref: buildQualityItemMasterHref(section, code),
    itemMasterHint: buildQualityItemMasterHint(section),
  };
}
