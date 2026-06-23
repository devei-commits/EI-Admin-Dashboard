import type {
  MasterApprovalKind,
  MasterApprovalStatus,
} from '../constants/masterApprovalStatus';
import {
  getNextMasterApprovalStatus,
  normalizeMasterApprovalStatus,
} from '../constants/masterApprovalStatus';
import { patchMasterApprovalStatus } from '../services/masterApproval.service';

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
        previewSubtitle: 'Review all values below. Confirm to save and submit for Under Review.',
        confirmLabel: 'Confirm & submit for review',
        nextStatus: next,
      };
    case 'Under Review':
      return {
        submitLabel: 'Submit for approval',
        previewSubtitle: 'Review all values below. Confirm to save and submit for Under Approval.',
        confirmLabel: 'Confirm & submit for approval',
        nextStatus: next,
      };
    case 'Under Approval':
      return {
        submitLabel: 'Submit for active',
        previewSubtitle: 'Review all values below. Confirm to save and activate this master.',
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

/** Advance to the next approval status after a successful save on Submit. */
export async function advanceMasterApprovalStatus(
  kind: MasterApprovalKind,
  itemId: string | number
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const res = await patchMasterApprovalStatus(kind, itemId, { advance: true });
  if (!res.success || !res.data) {
    return { ok: false, error: res.error || 'Failed to advance approval status' };
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
