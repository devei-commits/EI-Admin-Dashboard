import { describe, expect, it } from 'vitest';
import {
  buildQualityGrnQueueRow,
  filterInboundQcQueue,
  filterQuarantineQueue,
  filterQcHistory,
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
  });

  it('filters inbound QC to GRNs sent from warehouse', () => {
    const sent = baseGrn({ workflowSteps: ['Sent to QC'] });
    const verified = baseGrn({ id: '2' });
    const passed = baseGrn({ id: '3', qcStatus: 'Passed' });
    const result = filterInboundQcQueue([sent, verified, passed]);
    expect(result.map((g) => g.id)).toEqual(['1']);
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
});
