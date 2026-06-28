export const INBOUND_GRN_RECEIPT_CONFIRMED_STEP = 'Receipt Confirmed';
export const INBOUND_GRN_SENT_TO_QC_STEP = 'Sent to QC';
export const INBOUND_GRN_QC_REPORT_SENT_STEP = 'QC Report Sent';

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

export function isInboundGrnQuarantined(grn: InboundGrnStatusInput): boolean {
  const status = String(grn.status ?? '').trim();
  if (status === 'On Hold') return true;
  const line = grn.lineItem;
  if (!line) return false;
  if (line.diff != null && Number.isFinite(Number(line.diff)) && Math.abs(Number(line.diff)) > 0.0001) {
    return true;
  }
  const po = Number(line.poQty);
  const rcvd = Number(line.rcvdQty);
  if (Number.isFinite(po) && Number.isFinite(rcvd) && Math.abs(rcvd - po) > 0.0001) return true;
  return false;
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
