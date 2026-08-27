export const INBOUND_GRN_RECEIPT_CONFIRMED_STEP = 'Receipt Confirmed';
export const INBOUND_GRN_SENT_TO_QC_STEP = 'Sent to QC';
export const INBOUND_GRN_QC_REPORT_SENT_STEP = 'QC Report Sent';
export const INBOUND_GRN_DOCUMENT_MISMATCH_STEP = 'Document-Physical Mismatch';

export type InboundGrnStatusInput = {
  status?: string | null;
  qcStatus?: string | null;
  grnDate?: string | null;
  receivedDate?: string | null;
  expectedDate?: string | null;
  workflowSteps?: string[] | null;
  generatedLabels?: unknown[] | null;
  lineItem?: {
    poQty?: number;
    rcvdQty?: number;
    diff?: number;
    qcStatus?: string;
    unit?: string;
  } | null;
};

/** Display lifecycle: IN TRANSIT → LANDED → VERIFIED → QUARANTINED → QC TESTED → GRN COMPLETED */
export const INBOUND_GRN_LIFECYCLE = [
  'IN TRANSIT',
  'LANDED',
  'VERIFIED',
  'QUARANTINED',
  'QC TESTED · PASS',
  'GRN COMPLETED',
] as const;

export type InboundGrnDisplayStatus = (typeof INBOUND_GRN_LIFECYCLE)[number];

export function inboundGrnLandedAt(grn: InboundGrnStatusInput): string | null {
  const raw = grn.grnDate ?? grn.receivedDate;
  return raw ? String(raw) : null;
}

export function isInboundGrnInTransit(grn: InboundGrnStatusInput): boolean {
  const status = String(grn.status ?? '').trim();
  if (status === 'GRN Complete' || status === 'Verified' || status === 'On Hold') return false;
  if (inboundGrnLandedAt(grn)) return false;
  return status === 'In Transit' || status === 'Delayed' || status === 'Pending';
}

export function isInboundGrnVerified(grn: InboundGrnStatusInput): boolean {
  const status = String(grn.status ?? '').trim();
  if (status === 'Verified') return true;
  const steps = Array.isArray(grn.workflowSteps) ? grn.workflowSteps : [];
  if (steps.includes('Label Generation')) return true;
  return Boolean(Array.isArray(grn.generatedLabels) && grn.generatedLabels.length > 0);
}

export function isInboundGrnLanded(grn: InboundGrnStatusInput): boolean {
  if (isInboundGrnVerified(grn)) return false;
  if (!inboundGrnLandedAt(grn)) return false;
  const status = String(grn.status ?? '').trim();
  return status === 'Under GRN' || status === 'Pending' || status === 'Delayed';
}

export function isInboundGrnDocumentMismatch(grn: InboundGrnStatusInput): boolean {
  const steps = Array.isArray(grn.workflowSteps) ? grn.workflowSteps : [];
  return steps.includes(INBOUND_GRN_DOCUMENT_MISMATCH_STEP);
}

export function isInboundGrnQuarantined(grn: InboundGrnStatusInput): boolean {
  const status = String(grn.status ?? '').trim();
  if (status === 'On Hold') return true;
  return isInboundGrnDocumentMismatch(grn);
}

export function isInboundGrnQcTested(grn: InboundGrnStatusInput): boolean {
  const qc = String(grn.qcStatus ?? grn.lineItem?.qcStatus ?? '').trim();
  return qc === 'Passed' || qc === 'Pass';
}

export function isInboundGrnQcRejected(grn: InboundGrnStatusInput): boolean {
  const qc = String(grn.qcStatus ?? grn.lineItem?.qcStatus ?? '').trim();
  return qc === 'Rejected' || qc === 'Fail' || qc === 'Failed';
}

/** Quality team finished QC (pass or reject) — no separate warehouse report step. */
export function isInboundGrnQcComplete(grn: InboundGrnStatusInput): boolean {
  return isInboundGrnQcTested(grn) || isInboundGrnQcRejected(grn);
}

export function isInboundGrnCompleted(grn: InboundGrnStatusInput): boolean {
  return String(grn.status ?? '').trim() === 'GRN Complete';
}

export function isInboundGrnReceiptConfirmed(grn: InboundGrnStatusInput): boolean {
  const steps = Array.isArray(grn.workflowSteps) ? grn.workflowSteps : [];
  if (steps.includes(INBOUND_GRN_RECEIPT_CONFIRMED_STEP)) return true;
  return isInboundGrnVerified(grn);
}

export function isInboundGrnSentToQc(grn: InboundGrnStatusInput): boolean {
  const steps = Array.isArray(grn.workflowSteps) ? grn.workflowSteps : [];
  return steps.includes(INBOUND_GRN_SENT_TO_QC_STEP);
}

export function isInboundGrnQcReportSent(grn: InboundGrnStatusInput): boolean {
  const steps = Array.isArray(grn.workflowSteps) ? grn.workflowSteps : [];
  return steps.includes(INBOUND_GRN_QC_REPORT_SENT_STEP);
}

export function appendInboundGrnWorkflowStep(
  existingSteps: string[] | null | undefined,
  step: string,
): string[] {
  const steps = [...(Array.isArray(existingSteps) ? existingSteps : [])];
  if (!steps.includes(step)) steps.push(step);
  return steps;
}

export function inboundGrnSendToQcPayload(existingSteps?: string[] | null): {
  workflowSteps: string[];
  qcStatus: string;
} {
  return {
    workflowSteps: appendInboundGrnWorkflowStep(existingSteps, INBOUND_GRN_SENT_TO_QC_STEP),
    qcStatus: 'Pending',
  };
}

/**
 * Send a labelled GRN into quarantine + QC (the normal path, not a mismatch): status → On Hold
 * (quarantined), workflow stamped "Sent to QC", QC opened as Pending.
 */
export function inboundGrnSendToQuarantineQcPayload(
  existingSteps?: string[] | null,
): { status: string; workflowSteps: string[]; qcStatus: string } {
  return {
    status: 'On Hold',
    workflowSteps: appendInboundGrnWorkflowStep(existingSteps, INBOUND_GRN_SENT_TO_QC_STEP),
    qcStatus: 'Pending',
  };
}

/**
 * Put-away recorded in Assign Rack: rack + zone + post-racking photos are saved and the GRN hands
 * off to GRN Copy.
 *
 * This used to persist with an EMPTY payload — rack, zone and photos landed, but `status` and
 * `workflow_steps` were never sent, so a racked GRN sat on "On Hold" with a blank stepper and
 * looked like the save had not happened (GRN-2026-0197: location_prefix DEFAULT saved, status
 * still On Hold, workflow_steps still just Receipt Confirmed / Sent to QC).
 *
 * Two things advance here:
 *  - Steps: by the time stock is being racked the PO was received, the qty was checked and QC is
 *    done, so those three are stamped. 'Label Generation' is deliberately NOT stamped — labels are
 *    generated in GRN Copy, and that step is also what the backend accepts as proof labels exist
 *    (`grnCompletionBlockers`), so stamping it here would let a GRN complete with no labels at all.
 *  - Status: a GRN quarantined into QC ('On Hold') is released to 'Under GRN' once QC has PASSED,
 *    matching what GRN Copy does on its own hold release. A failed or still-pending QC stays on
 *    hold — racking must not be a way out of quarantine.
 */
export const INBOUND_GRN_RACK_ASSIGNED_STEP = 'Rack Assigned';

export function inboundGrnRackAssignedPayload(grn: InboundGrnStatusInput): {
  status?: string;
  workflowSteps: string[];
} {
  let steps = appendInboundGrnWorkflowStep(grn.workflowSteps, INBOUND_GRN_RECEIPT_CONFIRMED_STEP);
  steps = appendInboundGrnWorkflowStep(steps, 'PO Received');
  steps = appendInboundGrnWorkflowStep(steps, 'Qty Check');
  if (isInboundGrnQcComplete(grn)) {
    steps = appendInboundGrnWorkflowStep(steps, 'QC Inspection');
  }
  steps = appendInboundGrnWorkflowStep(steps, INBOUND_GRN_RACK_ASSIGNED_STEP);

  const status = String(grn.status ?? '').trim();
  const releaseFromHold = status === 'On Hold' && isInboundGrnQcTested(grn);
  return releaseFromHold ? { status: 'Under GRN', workflowSteps: steps } : { workflowSteps: steps };
}

export function inboundGrnVerifiedAfterLabelsPayload(
  existingSteps?: string[] | null,
): { status: string; workflowSteps: string[] } {
  let steps = appendInboundGrnWorkflowStep(existingSteps, INBOUND_GRN_RECEIPT_CONFIRMED_STEP);
  for (const step of ['PO Received', 'Qty Check', 'Label Generation'] as const) {
    steps = appendInboundGrnWorkflowStep(steps, step);
  }
  return { status: 'Verified', workflowSteps: steps };
}

export function inboundGrnMismatchQuarantinePayload(
  existingSteps?: string[] | null,
): { status: string; workflowSteps: string[]; qcStatus: string } {
  let steps = appendInboundGrnWorkflowStep(existingSteps, INBOUND_GRN_RECEIPT_CONFIRMED_STEP);
  steps = appendInboundGrnWorkflowStep(steps, INBOUND_GRN_DOCUMENT_MISMATCH_STEP);
  steps = appendInboundGrnWorkflowStep(steps, INBOUND_GRN_SENT_TO_QC_STEP);
  return { status: 'On Hold', workflowSteps: steps, qcStatus: 'Pending' };
}

export function inboundGrnSendQcReportPayload(
  existingSteps: string[] | null | undefined,
  qcSpecs: unknown,
  assignedTo?: string,
  qcBy?: string,
): {
  workflowSteps: string[];
  qcSpecs: unknown;
  assignedTo?: string;
  qcBy?: string;
} {
  return {
    workflowSteps: appendInboundGrnWorkflowStep(existingSteps, INBOUND_GRN_QC_REPORT_SENT_STEP),
    qcSpecs,
    ...(assignedTo ? { assignedTo } : {}),
    ...(qcBy ? { qcBy } : {}),
  };
}
