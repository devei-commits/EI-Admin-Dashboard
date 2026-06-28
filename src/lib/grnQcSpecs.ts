/** GRN inbound QC — master quality specs with measured results and pass/fail tracking. */

import { deriveAutoPassedFromResult } from './grnQcAutoPass';

export interface GrnQcTestRow {
  specId: string;
  parameter: string;
  specLimit: string;
  method: string;
  mandatory: boolean;
  tolerance: string;
  frequency: string;
  sample: string;
  acceptance: string;
  /** GRN result input type from master QC spec (pass-fail, number-range, etc.). */
  outputType?: string;
  /** Dropdown options when outputType is select. */
  selectOptions?: string[];
  result: string;
  passed: boolean | null;
}

export interface GrnQcLineSpec {
  lineItemId: string;
  itemCode: string;
  itemName: string;
  masterType: 'RM' | 'PM';
  masterId: number | null;
  /** master = from item master; default-inbound = fallback checklist when master has no specs */
  testsSource?: 'master' | 'default-inbound';
  tests: GrnQcTestRow[];
}

export interface GrnQcSpecsStored {
  lines: GrnQcLineSpec[];
  remarks?: string;
  attachments?: GrnQcAttachment[];
}

export type GrnQcAttachment = {
  id: string;
  fileName: string;
  type: string;
  uploadedAt: string;
  uploadedBy?: string;
};

export const GRN_QC_ATTACHMENT_TYPES = [
  'Vendor COA',
  'In-house test',
  'Sample photo',
  'Lab report',
  'Equipment photo',
  'Other',
] as const;

export type GrnQcAttachmentType = (typeof GRN_QC_ATTACHMENT_TYPES)[number];

export type GrnDerivedQcStatus = 'Under test' | 'Passed' | 'Rejected';

export function collectGrnQcTests(payload: GrnQcSpecsStored | null | undefined): GrnQcTestRow[] {
  const lines = payload?.lines ?? [];
  return lines.flatMap((l) => l.tests ?? []);
}

function hasMeasuredResult(test: GrnQcTestRow): boolean {
  return String(test.result ?? '').trim().length > 0;
}

function isTestReviewed(test: GrnQcTestRow): boolean {
  return test.passed === true || test.passed === false;
}

/** Mandatory (Mand) rows must have result + Pass. Optional rows may stay untested. */
export function isMandatoryTestComplete(test: GrnQcTestRow): boolean {
  if (!test.mandatory) return true;
  return test.passed === true && hasMeasuredResult(test);
}

export function isMandatoryTestPending(test: GrnQcTestRow): boolean {
  if (!test.mandatory) return false;
  return test.passed !== true || !hasMeasuredResult(test);
}

export function deriveGrnQcStatusFromSpecs(payload: GrnQcSpecsStored | null | undefined): GrnDerivedQcStatus {
  const tests = collectGrnQcTests(payload);
  if (tests.length === 0) return 'Under test';

  const failed = tests.filter((t) => t.passed === false);
  if (failed.length > 0) return 'Rejected';

  const mandatoryPending = tests.filter((t) => isMandatoryTestPending(t));
  if (mandatoryPending.length > 0) return 'Under test';

  const reviewedWithoutResult = tests.filter((t) => isTestReviewed(t) && !hasMeasuredResult(t));
  if (reviewedWithoutResult.length > 0) return 'Under test';

  return 'Passed';
}

export function grnQcCompletionBlockers(
  payload: GrnQcSpecsStored | null | undefined
): string[] {
  const tests = collectGrnQcTests(payload);
  const blockers: string[] = [];
  if (tests.length === 0) {
    blockers.push('No QC tests available — refresh the GRN or link the line item to an RM/PM master.');
    return blockers;
  }
  const mandatoryPending = tests.filter((t) => isMandatoryTestPending(t));
  if (mandatoryPending.length > 0) {
    blockers.push(
      `${mandatoryPending.length} mandatory QC test(s) still need a measured result and Pass verdict (Mand).`
    );
  }
  const reviewedWithoutResult = tests.filter((t) => isTestReviewed(t) && !hasMeasuredResult(t));
  if (reviewedWithoutResult.length > 0) {
    blockers.push('Enter a measured result for each QC test you marked Pass or Fail.');
  }
  const failed = tests.filter((t) => t.passed === false);
  if (failed.length > 0) {
    blockers.push(`${failed.length} QC test(s) failed.`);
  }
  return blockers;
}

export function summarizeGrnQcTests(payload: GrnQcSpecsStored | null | undefined): {
  total: number;
  mandatory: number;
  mandatoryPending: number;
  passed: number;
  failed: number;
  pending: number;
  optionalSkipped: number;
} {
  const tests = collectGrnQcTests(payload);
  const mandatory = tests.filter((t) => t.mandatory);
  return {
    total: tests.length,
    mandatory: mandatory.length,
    mandatoryPending: mandatory.filter((t) => isMandatoryTestPending(t)).length,
    passed: tests.filter((t) => t.passed === true).length,
    failed: tests.filter((t) => t.passed === false).length,
    pending: tests.filter((t) => t.passed === null).length,
    optionalSkipped: tests.filter((t) => !t.mandatory && t.passed === null).length,
  };
}

export function updateGrnQcTestAt(
  payload: GrnQcSpecsStored,
  lineItemId: string,
  testIndex: number,
  patch: Partial<Pick<GrnQcTestRow, 'result' | 'passed'>>
): GrnQcSpecsStored {
  return {
    ...payload,
    lines: payload.lines.map((line) => {
      if (line.lineItemId !== lineItemId) return line;
      const tests = line.tests.map((t, idx) => {
        if (idx !== testIndex) return t;
        const next = { ...t, ...patch };
        if ('result' in patch && patch.result !== undefined && !('passed' in patch)) {
          next.passed = deriveAutoPassedFromResult(next);
        }
        return next;
      });
      return { ...line, tests };
    }),
  };
}

export function cycleGrnQcTestPassed(current: boolean | null): boolean | null {
  if (current === null) return true;
  if (current === true) return false;
  return null;
}

export function createGrnQcAttachment(
  fileName: string,
  type: string,
  uploadedBy?: string,
): GrnQcAttachment {
  return {
    id: `qca-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    fileName: String(fileName ?? '').trim(),
    type: String(type ?? '').trim() || 'Other',
    uploadedAt: new Date().toISOString(),
    uploadedBy: uploadedBy?.trim() || undefined,
  };
}

export function addGrnQcAttachment(
  payload: GrnQcSpecsStored,
  attachment: GrnQcAttachment,
): GrnQcSpecsStored {
  const existing = Array.isArray(payload.attachments) ? payload.attachments : [];
  return { ...payload, attachments: [...existing, attachment] };
}

export function removeGrnQcAttachment(payload: GrnQcSpecsStored, attachmentId: string): GrnQcSpecsStored {
  const existing = Array.isArray(payload.attachments) ? payload.attachments : [];
  return { ...payload, attachments: existing.filter((a) => a.id !== attachmentId) };
}
