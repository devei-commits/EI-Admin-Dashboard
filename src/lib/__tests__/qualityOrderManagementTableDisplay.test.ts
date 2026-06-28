import { describe, expect, it } from 'vitest';
import {
  applyQualityOrderManagementFilters,
  buildQualityOrderManagementRow,
  buildQualitySlaView,
  filterQualityOrderManagementQueue,
  formatQualityApproverDisplay,
  formatQualityAssigneeShortName,
  formatQualityQuarantineDateTime,
  hasActiveQualityOrderManagementFilters,
  isQualityGrnMismatch,
  matchesQualityOrderManagementSearch,
  resolveQualitySection,
  sortQualityOrderManagementRows,
  type QualityOrderManagementInput,
} from '../qualityOrderManagementTableDisplay';

const baseGrn = (overrides: Partial<QualityOrderManagementInput> = {}): QualityOrderManagementInput => ({
  id: '1',
  grnNo: 'GRN-2026-0304',
  poNo: 'PO-100',
  vendor: 'Acme',
  type: 'RM',
  status: 'On Hold',
  assignedTo: 'Suresh Mehta',
  qcBy: 'Dr. Priya Reddy',
  grnDate: '2026-06-30T11:42:00',
  receiptSource: 'po',
  workflowSteps: ['Label Generation'],
  generatedLabels: [{ id: 'L1' }],
  lineItems: [{ item: 'SLES 70%', itemCode: '1000098', poQty: 200, rcvdQty: 200, diff: -2, unit: 'kg' }],
  ...overrides,
});

const DEFAULT_FILTERS = {
  search: '',
  section: 'all' as const,
  priority: 'all' as const,
  sourceKind: 'all' as const,
  assignStatus: 'all' as const,
};

describe('qualityOrderManagementTableDisplay', () => {
  it('resolves RM/PM section from type or item code', () => {
    expect(resolveQualitySection(baseGrn())).toBe('RM');
    expect(resolveQualitySection(baseGrn({ type: 'PM', lineItems: [{ itemCode: '5B00012' }] }))).toBe('PM');
  });

  it('formats quarantine date with time', () => {
    expect(formatQualityQuarantineDateTime('2026-06-30T11:42:00')).toBe('30-Jun 11:42');
  });

  it('builds row matching quarantine mock shape', () => {
    const row = buildQualityOrderManagementRow(baseGrn());
    expect(row.section).toBe('RM');
    expect(row.quarantineDateDisplay).toBe('30-Jun 11:42');
    expect(row.grnSourceNo).toBe('GRN-2026-0304');
    expect(row.itemName).toBe('SLES 70%');
    expect(row.itemCode).toBe('1000098');
    expect(row.qtyInQ).toBe('200 kg');
    expect(row.source).toBe('Bill GRN · mismatch');
    expect(row.assignDisplay).toBe('Suresh M.');
    expect(row.approverDisplay).toBe('Dr. Priya R.');
    expect(row.priorityDisplay).toBe('HIGH');
    expect(row.actionLabel).toBe('QC');
    expect(row.actionPrefix).toBe('🧪');
    expect(row.sourceDetailHref).toBe('/warehouse/inbound?grn=1');
    expect(row.sourceDetailLabel).toBe('Warehouse GRN');
    expect(row.itemMasterHref).toBe('/raw-material?step=quality&rm=1000098');
    expect(row.itemMasterHint).toContain('Quality specifications');
  });

  it('detects mismatch vs routine source', () => {
    expect(isQualityGrnMismatch(baseGrn())).toBe(true);
    expect(
      isQualityGrnMismatch(
        baseGrn({ status: 'Verified', lineItems: [{ poQty: 3000, rcvdQty: 3000, diff: 0 }] }),
      ),
    ).toBe(false);
    const routine = buildQualityOrderManagementRow(
      baseGrn({
        status: 'Verified',
        type: 'PM',
        lineItems: [{ item: 'Bottle 200ml HDPE', itemCode: '5B00012', poQty: 3000, rcvdQty: 3000, diff: 0, unit: 'pcs' }],
      }),
    );
    expect(routine.source).toBe('Bill GRN · routine');
    expect(routine.priorityDisplay).toBe('MEDIUM');
    expect(routine.slaLabel).toBe('in time');
  });

  it('builds SLA for hours in Q and days in QC', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const slaQ = buildQualitySlaView(baseGrn({ grnDate: twoHoursAgo }));
    expect(slaQ.label).toMatch(/h in Q/);
    expect(slaQ.icon).toBe('⚠');

    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
    const slaQc = buildQualitySlaView(baseGrn({ grnDate: fourDaysAgo, status: 'Verified' }));
    expect(slaQc.label).toBe('4d in QC');
    expect(slaQc.icon).toBe('🚩');
  });

  it('formats assignee and approver short names', () => {
    expect(formatQualityAssigneeShortName('Anjali Mehta')).toBe('Anjali M.');
    expect(formatQualityAssigneeShortName('')).toBe('Open');
    expect(formatQualityApproverDisplay('Dr. Priya Reddy')).toBe('Dr. Priya R.');
  });

  it('includes only GRNs sent to QC from warehouse', () => {
    const sent = baseGrn({ workflowSteps: ['Sent to QC'] });
    const quarantined = baseGrn({ id: '2', status: 'On Hold' });
    const routineQc = baseGrn({
      id: '3',
      status: 'Verified',
      lineItems: [{ poQty: 5000, rcvdQty: 5000, diff: 0, unit: 'pcs' }],
    });
    const completed = baseGrn({ id: '4', status: 'GRN Complete', qcStatus: 'Passed' });
    expect(filterQualityOrderManagementQueue([sent, quarantined, routineQc, completed]).map((g) => g.id)).toEqual([
      '1',
    ]);
  });

  it('sorts by priority', () => {
    const high = buildQualityOrderManagementRow(baseGrn());
    const medium = buildQualityOrderManagementRow(
      baseGrn({ id: '2', status: 'Verified', lineItems: [{ poQty: 10, rcvdQty: 10, diff: 0, unit: 'kg' }] }),
    );
    const sorted = sortQualityOrderManagementRows([medium, high], 'priority', 'asc');
    expect(sorted[0].priority).toBe('High');
  });

  it('filters by search, section, and assign status', () => {
    const high = buildQualityOrderManagementRow(baseGrn());
    const medium = buildQualityOrderManagementRow(
      baseGrn({
        id: '2',
        type: 'PM',
        assignedTo: '',
        status: 'Verified',
        lineItems: [{ item: 'Bottle', itemCode: '5B00012', poQty: 10, rcvdQty: 10, diff: 0, unit: 'pcs' }],
      }),
    );
    const rows = [high, medium];
    expect(
      applyQualityOrderManagementFilters(rows, {
        search: '5B00012',
        section: 'all',
        priority: 'all',
        sourceKind: 'all',
        assignStatus: 'all',
      }),
    ).toHaveLength(1);
    expect(
      applyQualityOrderManagementFilters(rows, {
        search: '',
        section: 'PM',
        priority: 'all',
        sourceKind: 'all',
        assignStatus: 'open',
      }),
    ).toEqual([medium]);
    expect(matchesQualityOrderManagementSearch(high, 'sles')).toBe(true);
    expect(hasActiveQualityOrderManagementFilters({ ...DEFAULT_FILTERS, search: 'x' })).toBe(true);
  });

  it('sorts by item name and qty', () => {
    const a = buildQualityOrderManagementRow(
      baseGrn({ lineItems: [{ item: 'Alpha', itemCode: '1000001', poQty: 50, rcvdQty: 50, unit: 'kg' }] }),
    );
    const b = buildQualityOrderManagementRow(
      baseGrn({
        id: '2',
        lineItems: [{ item: 'Beta', itemCode: '1000002', poQty: 200, rcvdQty: 200, unit: 'kg' }],
      }),
    );
    expect(sortQualityOrderManagementRows([b, a], 'item', 'asc')[0].itemName).toBe('Alpha');
    expect(sortQualityOrderManagementRows([a, b], 'qtyInQ', 'desc')[0].qtyInQValue).toBe(200);
  });
});
