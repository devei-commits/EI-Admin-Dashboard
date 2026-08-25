import { describe, expect, it } from 'vitest';
import {
  buildQualityGrnQueueRow,
  filterInboundQcQueue,
  filterQuarantineQueue,
  filterQcHistory,
  searchQualityGrnQueueRows,
  sortQualityGrnQueueRows,
  type QualityGrnQueueInput,
} from '../qualityGrnQueueDisplay';

const baseGrn = (overrides: Partial<QualityGrnQueueInput> = {}): QualityGrnQueueInput => ({
  id: '1',
  grnNo: 'GRN-001',
  poNo: 'PO-100',
  vendor: 'Acme',
  status: 'Verified',
  qcStatus: 'Pending',
  workflowSteps: ['Label Generation'],
  generatedLabels: [{ id: 'L1' }],
  lineItems: [{ item: 'Retinol', itemCode: 'RM-01', poQty: 10, rcvdQty: 10 }],
  ...overrides,
});

describe('qualityGrnQueueDisplay', () => {
  it('builds queue row labels', () => {
    const row = buildQualityGrnQueueRow(baseGrn());
    expect(row.grnNo).toBe('GRN-001');
    expect(row.itemLabel).toContain('Retinol');
    expect(row.statusLabel).toBe('VERIFIED');
    expect(row.qcDecided).toBe(false);
  });

  it('marks a row qcDecided once QC is passed or rejected', () => {
    expect(buildQualityGrnQueueRow(baseGrn({ qcStatus: 'Passed' })).qcDecided).toBe(true);
    expect(buildQualityGrnQueueRow(baseGrn({ qcStatus: 'Rejected' })).qcDecided).toBe(true);
    expect(buildQualityGrnQueueRow(baseGrn({ qcStatus: 'Pending' })).qcDecided).toBe(false);
  });

  it('filters inbound QC to GRNs sent from warehouse', () => {
    const sent = baseGrn({ workflowSteps: ['Sent to QC'] });
    const verified = baseGrn({ id: '2' });
    const passed = baseGrn({ id: '3', qcStatus: 'Passed' });
    const result = filterInboundQcQueue([sent, verified, passed]);
    expect(result.map((g) => g.id)).toEqual(['1']);
  });

  // A GRN whose QC has already been decided must stay in the queue (read-only) instead of
  // vanishing the moment it's completed — the queue is the record, not just a to-do list.
  it('keeps a QC-decided GRN in the queue instead of dropping it once completed', () => {
    const pending = baseGrn({ workflowSteps: ['Sent to QC'] });
    const decided = baseGrn({ id: '2', workflowSteps: ['Sent to QC'], qcStatus: 'Passed' });
    const completed = baseGrn({
      id: '3',
      status: 'GRN Complete',
      workflowSteps: ['Sent to QC'],
      qcStatus: 'Passed',
    });
    const result = filterInboundQcQueue([pending, decided, completed]);
    expect(result.map((g) => g.id)).toEqual(['1', '2', '3']);
  });

  it('filters quarantine queue to not-yet-sent GRNs', () => {
    const quarantine = baseGrn({ id: '2', status: 'On Hold' });
    const sent = baseGrn({ id: '3', status: 'On Hold', workflowSteps: ['Sent to QC'] });
    expect(filterQuarantineQueue([baseGrn(), quarantine, sent]).map((g) => g.id)).toEqual(['2']);
  });

  it('filters QC history', () => {
    const passed = baseGrn({ qcStatus: 'Pass' });
    expect(filterQcHistory([baseGrn(), passed]).map((g) => g.id)).toEqual(['1']);
  });

  it('searches queue rows across GRN, item, PO and vendor', () => {
    const rows = [
      buildQualityGrnQueueRow(baseGrn({ id: '1', vendor: 'Acme' })),
      buildQualityGrnQueueRow(baseGrn({ id: '2', vendor: 'Zenith', grnNo: 'GRN-002' })),
    ];
    expect(searchQualityGrnQueueRows(rows, 'acme').map((r) => r.id)).toEqual(['1']);
    expect(searchQualityGrnQueueRows(rows, 'retinol').map((r) => r.id)).toEqual(['1', '2']);
    expect(searchQualityGrnQueueRows(rows, '').map((r) => r.id)).toEqual(['1', '2']);
  });

  it('sorts queue rows by a column in either direction', () => {
    const rows = [
      buildQualityGrnQueueRow(baseGrn({ id: '1', vendor: 'Zenith' })),
      buildQualityGrnQueueRow(baseGrn({ id: '2', vendor: 'Acme' })),
    ];
    expect(sortQualityGrnQueueRows(rows, 'vendor', 'asc').map((r) => r.id)).toEqual(['2', '1']);
    expect(sortQualityGrnQueueRows(rows, 'vendor', 'desc').map((r) => r.id)).toEqual(['1', '2']);
  });
});
