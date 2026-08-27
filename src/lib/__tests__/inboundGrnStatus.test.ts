import { describe, expect, it } from 'vitest';
import {
  INBOUND_GRN_RACK_ASSIGNED_STEP,
  inboundGrnRackAssignedPayload,
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

describe('inboundGrnRackAssignedPayload', () => {
  /** GRN-2026-0197 as saved: rack persisted, status stuck on hold, stepper empty. */
  const racked = {
    status: 'On Hold',
    qcStatus: 'Passed',
    workflowSteps: ['Receipt Confirmed', 'Sent to QC'],
  };

  it('releases a QC-passed GRN out of quarantine', () => {
    expect(inboundGrnRackAssignedPayload(racked).status).toBe('Under GRN');
  });

  it('advances the stepper to QC Inspection', () => {
    const { workflowSteps } = inboundGrnRackAssignedPayload(racked);
    expect(workflowSteps).toContain('PO Received');
    expect(workflowSteps).toContain('Qty Check');
    expect(workflowSteps).toContain('QC Inspection');
    expect(workflowSteps).toContain(INBOUND_GRN_RACK_ASSIGNED_STEP);
  });

  it('NEVER stamps Label Generation — that step is the backend proof that labels exist', () => {
    // grnCompletionBlockers accepts the step in place of generated_labels, so stamping it here
    // would let a GRN be completed with no labels printed at all.
    const { workflowSteps } = inboundGrnRackAssignedPayload(racked);
    expect(workflowSteps).not.toContain('Label Generation');
    expect(workflowSteps).not.toContain('Dispatch Ready');
    expect(isInboundGrnVerified({ workflowSteps })).toBe(false);
  });

  it('keeps the existing history rather than replacing it', () => {
    const { workflowSteps } = inboundGrnRackAssignedPayload(racked);
    expect(workflowSteps).toContain('Receipt Confirmed');
    expect(workflowSteps).toContain('Sent to QC');
  });

  it('does not duplicate steps when racking is saved twice', () => {
    const first = inboundGrnRackAssignedPayload(racked);
    const second = inboundGrnRackAssignedPayload({ ...racked, workflowSteps: first.workflowSteps });
    expect(second.workflowSteps).toEqual(first.workflowSteps);
  });

  it('keeps a failed QC in quarantine — racking is not an escape from hold', () => {
    const failed = inboundGrnRackAssignedPayload({ ...racked, qcStatus: 'Rejected' });
    expect(failed.status).toBeUndefined();
    // QC ran and concluded, so the inspection step is still recorded.
    expect(failed.workflowSteps).toContain('QC Inspection');
  });

  it('keeps a pending QC in quarantine and does not claim the inspection happened', () => {
    const pending = inboundGrnRackAssignedPayload({ ...racked, qcStatus: 'Pending' });
    expect(pending.status).toBeUndefined();
    expect(pending.workflowSteps).not.toContain('QC Inspection');
  });

  it('leaves a status that is not On Hold alone', () => {
    // Nothing to release, so no status is sent and the caller's other fields are untouched.
    expect(inboundGrnRackAssignedPayload({ ...racked, status: 'Under GRN' }).status).toBeUndefined();
  });

  it('handles a GRN with no steps recorded yet', () => {
    const { workflowSteps } = inboundGrnRackAssignedPayload({
      status: 'On Hold',
      qcStatus: 'Passed',
      workflowSteps: null,
    });
    expect(workflowSteps).toEqual([
      'Receipt Confirmed',
      'PO Received',
      'Qty Check',
      'QC Inspection',
      INBOUND_GRN_RACK_ASSIGNED_STEP,
    ]);
  });
});
