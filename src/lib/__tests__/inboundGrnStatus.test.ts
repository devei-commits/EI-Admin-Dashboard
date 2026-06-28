import { describe, expect, it } from 'vitest';
import {
  inboundGrnSendToQcPayload,
  inboundGrnSendQcReportPayload,
  isInboundGrnInTransit,
  isInboundGrnLanded,
  isInboundGrnQcComplete,
  isInboundGrnQcRejected,
  isInboundGrnQcReportSent,
  isInboundGrnReceiptConfirmed,
  isInboundGrnSentToQc,
  isInboundGrnVerified,
} from '../inboundGrnStatus';

describe('inboundGrnStatus', () => {
  it('starts in transit before arrival dates', () => {
    expect(
      isInboundGrnInTransit({
        status: 'In Transit',
        expectedDate: '2026-06-26',
      }),
    ).toBe(true);
  });

  it('marks landed after arrival confirmation dates', () => {
    expect(
      isInboundGrnLanded({
        status: 'Under GRN',
        receivedDate: '2026-06-30',
      }),
    ).toBe(true);
  });

  it('marks verified after labels are generated', () => {
    expect(
      isInboundGrnVerified({
        status: 'Verified',
        receivedDate: '2026-06-30',
        workflowSteps: ['Label Generation'],
        generatedLabels: [{}],
      }),
    ).toBe(true);
  });

  it('detects receipt confirmed, sent to QC, and QC report sent workflow steps', () => {
    expect(isInboundGrnReceiptConfirmed({ workflowSteps: ['Receipt Confirmed'] })).toBe(true);
    expect(isInboundGrnSentToQc({ workflowSteps: ['Sent to QC'] })).toBe(true);
    expect(isInboundGrnQcReportSent({ workflowSteps: ['QC Report Sent'] })).toBe(true);
  });

  it('detects QC complete from pass or reject status', () => {
    expect(isInboundGrnQcComplete({ qcStatus: 'Passed' })).toBe(true);
    expect(isInboundGrnQcComplete({ qcStatus: 'Rejected' })).toBe(true);
    expect(isInboundGrnQcRejected({ qcStatus: 'Rejected' })).toBe(true);
    expect(isInboundGrnQcComplete({ qcStatus: 'Pending' })).toBe(false);
  });

  it('builds send to QC and send QC report payloads', () => {
    const sendQc = inboundGrnSendToQcPayload(['Label Generation']);
    expect(sendQc.workflowSteps).toEqual(['Label Generation', 'Sent to QC']);
    expect(sendQc.qcStatus).toBe('Pending');

    const report = inboundGrnSendQcReportPayload(['Sent to QC'], { lines: [] }, 'Suresh', 'Dr. Priya');
    expect(report.workflowSteps).toEqual(['Sent to QC', 'QC Report Sent']);
    expect(report.assignedTo).toBe('Suresh');
    expect(report.qcBy).toBe('Dr. Priya');
  });
});
