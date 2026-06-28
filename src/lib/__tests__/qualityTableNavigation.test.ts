import { describe, expect, it } from 'vitest';
import {
  buildQualityItemMasterHref,
  buildQualityItemMasterHint,
  buildQualitySourceDetailHref,
  buildQualityTableNavigation,
  isQualityRdDraftSource,
  resolveMasterQualityStageIndex,
  resolveQualitySourceDetailKind,
} from '../qualityTableNavigation';
import type { QualityOrderManagementInput } from '../qualityOrderManagementTableDisplay';

const baseGrn = (overrides: Partial<QualityOrderManagementInput> = {}): QualityOrderManagementInput => ({
  id: 'grn-42',
  grnNo: 'GRN-2026-0304',
  poNo: 'PO-100',
  vendor: 'Acme',
  type: 'RM',
  status: 'On Hold',
  receiptSource: 'po',
  lineItems: [{ item: 'SLES 70%', itemCode: '1000098', poQty: 200, rcvdQty: 200, diff: 0, unit: 'kg' }],
  ...overrides,
});

describe('qualityTableNavigation', () => {
  it('routes PO GRN to warehouse inbound detail', () => {
    const grn = baseGrn();
    expect(resolveQualitySourceDetailKind(grn)).toBe('warehouse-grn');
    expect(buildQualitySourceDetailHref(grn)).toBe('/warehouse/inbound?grn=grn-42');
  });

  it('routes transfer GRN to production batch', () => {
    const grn = baseGrn({ receiptSource: 'transfer', poNo: 'BMR-2026-001' });
    expect(resolveQualitySourceDetailKind(grn)).toBe('production-batch');
    expect(buildQualitySourceDetailHref(grn)).toBe('/production?section=batches&bmr=BMR-2026-001');
  });

  it('routes R&D draft GRN to item master quality step', () => {
    const grn = baseGrn({ receiptSource: 'rd', poNo: 'RD-001' });
    expect(isQualityRdDraftSource(grn)).toBe(true);
    expect(resolveQualitySourceDetailKind(grn)).toBe('rd-draft');
    expect(buildQualitySourceDetailHref(grn)).toBe('/raw-material?step=quality&rm=1000098');
  });

  it('builds item master links for RM and PM', () => {
    expect(buildQualityItemMasterHref('RM', '1000098')).toBe('/raw-material?step=quality&rm=1000098');
    expect(buildQualityItemMasterHref('PM', '5B00012')).toBe('/packaging?step=quality&pm=5B00012');
    expect(buildQualityItemMasterHint('RM')).toContain('Quality specifications');
    expect(buildQualityItemMasterHint('PM')).toContain('GRN Quality Checks');
  });

  it('builds full table navigation row meta', () => {
    const nav = buildQualityTableNavigation(baseGrn({ type: 'PM', lineItems: [{ itemCode: '5B00012' }] }));
    expect(nav.sourceDetailLabel).toBe('Warehouse GRN');
    expect(nav.itemMasterHref).toBe('/packaging?step=quality&pm=5B00012');
    expect(nav.itemMasterHint).toContain('GRN Quality Checks');
  });

  it('resolves master quality stage indices', () => {
    expect(resolveMasterQualityStageIndex('RM')).toBe(4);
    expect(resolveMasterQualityStageIndex('PM')).toBe(5);
  });
});
