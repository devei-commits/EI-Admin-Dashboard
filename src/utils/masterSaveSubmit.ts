import type {
  MasterApprovalKind,
  MasterApprovalStatus,
} from '../constants/masterApprovalStatus';
import {
  getNextMasterApprovalStatus,
  getPreviousMasterApprovalStatus,
  normalizeMasterApprovalStatus,
  readSavedMasterApprovalStatus,
  type MasterApprovalStageAssignees,
} from '../constants/masterApprovalStatus';
import { patchMasterApprovalStatus, type PatchMasterApprovalPayload } from '../services/masterApproval.service';

/** True when the record can be advanced from Draft → Under Review via Submit. */
export function canSubmitMasterForReview(status: unknown): boolean {
  return normalizeMasterApprovalStatus(status, 'Draft') === 'Draft';
}

export type MasterApprovalSubmitAction = {
  submitLabel: string;
  previewSubtitle: string;
  confirmLabel: string;
  nextStatus: MasterApprovalStatus;
};

/** Labels and copy for the next workflow step from the edit form (Draft → … → Active). */
export function getMasterApprovalSubmitAction(status: unknown): MasterApprovalSubmitAction | null {
  const norm = normalizeMasterApprovalStatus(status);
  const next = getNextMasterApprovalStatus(norm);
  if (!next) return null;

  switch (norm) {
    case 'Draft':
      return {
        submitLabel: 'Submit for review',
        previewSubtitle: 'Review all values below. Optionally add a comment, then confirm to save and submit for Under Review.',
        confirmLabel: 'Confirm & submit for review',
        nextStatus: next,
      };
    case 'Under Review':
      return {
        submitLabel: 'Submit for approval',
        previewSubtitle: 'Review all values below. Optionally add a comment, then confirm to save and submit for Under Approval.',
        confirmLabel: 'Confirm & submit for approval',
        nextStatus: next,
      };
    case 'Under Approval':
      return {
        submitLabel: 'Submit for active',
        previewSubtitle: 'Review all values below. Optionally add a comment, then confirm to save and activate this master.',
        confirmLabel: 'Confirm & activate',
        nextStatus: next,
      };
    default:
      return null;
  }
}

/** Persist current approval status on draft save (new records default to Draft). */
export function withMasterDraftApprovalStatus(
  payload: Record<string, unknown>,
  currentStatus: unknown
): Record<string, unknown> {
  const status = normalizeMasterApprovalStatus(currentStatus, 'Draft');
  const next: Record<string, unknown> = {
    ...payload,
    masterApprovalStatus: status,
    status,
    lifecycle_status: status,
  };
  if (next.form_data != null && typeof next.form_data === 'object' && !Array.isArray(next.form_data)) {
    next.form_data = {
      ...(next.form_data as Record<string, unknown>),
      masterApprovalStatus: status,
      status,
    };
  }
  return next;
}

export type MasterApprovalRevertAction = {
  revertLabel: string;
  previewSubtitle: string;
  confirmLabel: string;
  previousStatus: MasterApprovalStatus;
};

/** Labels and copy for sending approval status back one step. */
export function getMasterApprovalRevertAction(status: unknown): MasterApprovalRevertAction | null {
  const norm = normalizeMasterApprovalStatus(status);
  const previous = getPreviousMasterApprovalStatus(norm);
  if (!previous) return null;

  switch (norm) {
    case 'Under Review':
      return {
        revertLabel: 'Send back to Draft',
        previewSubtitle: 'Optionally add a comment, then confirm to save and return this master to Draft.',
        confirmLabel: 'Confirm & send back to Draft',
        previousStatus: previous,
      };
    case 'Under Approval':
      return {
        revertLabel: 'Send back to Under Review',
        previewSubtitle:
          'Optionally add a comment, then confirm to save and return this master to Under Review.',
        confirmLabel: 'Confirm & send back to Under Review',
        previousStatus: previous,
      };
    case 'Active':
      return {
        revertLabel: 'Send back to Under Approval',
        previewSubtitle:
          'Optionally add a comment, then confirm to save and return this master to Under Approval.',
        confirmLabel: 'Confirm & send back to Under Approval',
        previousStatus: previous,
      };
    default:
      return null;
  }
}

/** Advance to the next approval status after a successful save on Submit. */
export async function advanceMasterApprovalStatus(
  kind: MasterApprovalKind,
  itemId: string | number,
  note?: string,
  targetStatus?: MasterApprovalStatus
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const trimmed = String(note ?? '').trim();
  const payload: PatchMasterApprovalPayload = targetStatus
    ? { status: targetStatus, ...(trimmed ? { note: trimmed } : {}) }
    : { advance: true, ...(trimmed ? { note: trimmed } : {}) };
  const res = await patchMasterApprovalStatus(kind, itemId, payload);
  if (!res.success || !res.data) {
    return { ok: false, error: res.error || 'Failed to advance approval status' };
  }
  return { ok: true, status: res.data.status };
}

export type MasterApprovalAdvanceAfterSaveResult =
  | { ok: true; status: string; advanced: boolean; expectedStatus?: string }
  | { ok: false; error: string };

/** After a successful save, advance workflow when the user started submit from a non-final status. */
export async function advanceMasterApprovalAfterSave(opts: {
  kind: MasterApprovalKind;
  itemId: string | number;
  /** Status when the user clicked Submit (source of truth for the intended step). */
  intentStatus: unknown;
  /** Latest status read from the server after save (for mismatch detection). */
  serverStatusAfterSave?: unknown;
  assignees: MasterApprovalStageAssignees;
  canApproveAtStatus: (currentStatus: unknown, stageAssignees: unknown) => boolean;
  comment?: string;
}): Promise<MasterApprovalAdvanceAfterSaveResult> {
  const intent = readSavedMasterApprovalStatus({ status: opts.intentStatus });
  const submitAction = getMasterApprovalSubmitAction(intent);
  if (!submitAction) {
    const serverStatus = readSavedMasterApprovalStatus({ status: opts.serverStatusAfterSave ?? intent });
    return { ok: true, status: serverStatus, advanced: false };
  }

  const serverNorm = opts.serverStatusAfterSave != null
    ? readSavedMasterApprovalStatus({ status: opts.serverStatusAfterSave })
    : intent;
  if (serverNorm !== intent) {
    return {
      ok: false,
      error: `Server status is "${serverNorm}" but the form showed "${intent}". Refresh the record and submit again.`,
    };
  }

  if (!opts.canApproveAtStatus(intent, opts.assignees)) {
    return {
      ok: false,
      error:
        'Only the person assigned to this approval stage (or a team approver when the stage is open) can submit for the next status. Assign them in the list, then try again.',
    };
  }

  const advanced = await advanceMasterApprovalStatus(
    opts.kind,
    opts.itemId,
    opts.comment,
    submitAction.nextStatus
  );
  if (advanced.ok === false) {
    return { ok: false, error: advanced.error };
  }

  const actual = normalizeMasterApprovalStatus(advanced.status, intent);
  if (actual !== submitAction.nextStatus) {
    return {
      ok: false,
      error: `Expected status "${submitAction.nextStatus}" but server returned "${actual}". Please refresh and try again.`,
    };
  }

  return {
    ok: true,
    status: actual,
    advanced: true,
    expectedStatus: submitAction.nextStatus,
  };
}

/** Move approval status back one step (e.g. Under Review → Draft). */
export async function revertMasterApprovalStatus(
  kind: MasterApprovalKind,
  itemId: string | number,
  note?: string
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const payload: { revert: true; note?: string } = { revert: true };
  const trimmed = String(note ?? '').trim();
  if (trimmed) payload.note = trimmed;
  const res = await patchMasterApprovalStatus(kind, itemId, payload);
  if (!res.success || !res.data) {
    return { ok: false, error: res.error || 'Failed to revert approval status' };
  }
  return { ok: true, status: res.data.status };
}

/** @deprecated Use advanceMasterApprovalStatus */
export async function submitMasterForReview(
  kind: MasterApprovalKind,
  itemId: string | number
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  return advanceMasterApprovalStatus(kind, itemId);
}
