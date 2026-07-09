import { api } from '../lib/apiClient';
import type {
  MasterApprovalKind,
  MasterApprovalStageAssignees,
} from '../constants/masterApprovalStatus';
import { normalizeStageAssignees } from '../constants/masterApprovalStatus';
import { normalizePrApprovalTeamPending, type PrApprovalTeamPending } from '../lib/prMasterTeamApproval';
import { normalizePrTrackApprovals, type PrTrackApprovals, type PrTrackKey } from '../lib/prTrackApproval';

export type PatchMasterApprovalPayload =
  | { status: string; note?: string }
  | { advance: true; note?: string }
  | { revert: true; note?: string }
  | { track: PrTrackKey; action: 'send' | 'approve' | 'revert'; note?: string }
  | { approval_stage_assignees: MasterApprovalStageAssignees }
  | {
      approval_assigned_user_id: number | null;
      approval_assigned_display_name?: string | null;
    };

export type PatchMasterApprovalResult = {
  success: boolean;
  data: {
    status: string;
    approval_stage_assignees: MasterApprovalStageAssignees;
    approval_assigned_user_id: number | null;
    approval_assigned_display_name: string | null;
    approval_team_pending?: PrApprovalTeamPending | null;
    pr_track_approvals?: PrTrackApprovals | null;
  } | null;
  error: string | null;
};

function approvalPath(kind: MasterApprovalKind, itemId: string | number): string {
  const id = encodeURIComponent(String(itemId));
  switch (kind) {
    case 'RM':
      return `/api/v1/raw-materials/${id}/approval-status`;
    case 'PM':
      return `/api/v1/pack-materials/${id}/approval-status`;
    case 'PR':
      return `/api/v1/products/${id}/approval-status`;
  }
}

function approvalHistoryPath(kind: MasterApprovalKind, itemId: string | number): string {
  const id = encodeURIComponent(String(itemId));
  switch (kind) {
    case 'RM':
      return `/api/v1/raw-materials/${id}/approval-status/history`;
    case 'PM':
      return `/api/v1/pack-materials/${id}/approval-status/history`;
    case 'PR':
      return `/api/v1/products/${id}/approval-status/history`;
  }
}

export type MasterApprovalStatusHistoryEntry = {
  id: number;
  masterKind: MasterApprovalKind;
  masterId: number;
  masterCode: string | null;
  fromStatus: string | null;
  toStatus: string;
  changedByUserId: number | null;
  changedByDisplayName: string | null;
  source: string | null;
  note: string | null;
  createdAt: string;
};

export type FetchMasterApprovalStatusHistoryResult = {
  success: boolean;
  data: { entries: MasterApprovalStatusHistoryEntry[] } | null;
  error: string | null;
};

export async function fetchMasterApprovalStatusHistory(
  kind: MasterApprovalKind,
  itemId: string | number,
  limit = 50
): Promise<FetchMasterApprovalStatusHistoryResult> {
  try {
    const qs = limit !== 50 ? `?limit=${encodeURIComponent(String(limit))}` : '';
    const body = await api.get<{ success?: boolean; data?: { entries?: MasterApprovalStatusHistoryEntry[] } }>(
      `${approvalHistoryPath(kind, itemId)}${qs}`
    );
    return {
      success: true,
      data: { entries: body?.data?.entries ?? [] },
      error: null,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load approval status history';
    return { success: false, data: null, error: message };
  }
}

function readStatusFromResponse(kind: MasterApprovalKind, body: Record<string, unknown>): string {
  if (kind === 'PM') {
    const fd = body.form_data;
    if (fd && typeof fd === 'object' && !Array.isArray(fd)) {
      const fdObj = fd as { masterApprovalStatus?: string; status?: string };
      return String(fdObj.masterApprovalStatus ?? fdObj.status ?? body.status ?? 'Draft');
    }
  }
  if (kind === 'RM') {
    const fd = body.form_data;
    if (fd && typeof fd === 'object' && !Array.isArray(fd)) {
      const fdObj = fd as { masterApprovalStatus?: string; status?: string };
      const fromForm = fdObj.masterApprovalStatus ?? fdObj.status;
      if (fromForm) {
        return String(fromForm);
      }
    }
  }
  return String(body.status ?? body.lifecycle_status ?? 'Draft');
}

function readAssigneesFromResponse(body: Record<string, unknown>): MasterApprovalStageAssignees {
  if (body.approval_stage_assignees != null) {
    return normalizeStageAssignees(body.approval_stage_assignees);
  }
  return normalizeStageAssignees(null);
}

export async function patchMasterApprovalStatus(
  kind: MasterApprovalKind,
  itemId: string | number,
  payload: PatchMasterApprovalPayload
): Promise<PatchMasterApprovalResult> {
  try {
    const body = await api.patch<Record<string, unknown>>(approvalPath(kind, itemId), payload);
    const assignees = readAssigneesFromResponse(body ?? {});
    const approver = assignees.approver;
    return {
      success: true,
      data: {
        status: readStatusFromResponse(kind, body ?? {}),
        approval_stage_assignees: assignees,
        approval_assigned_user_id: approver?.user_id ?? null,
        approval_assigned_display_name: approver?.display_name ?? null,
        approval_team_pending:
          kind === 'PR' ? normalizePrApprovalTeamPending(body?.approval_team_pending) : null,
        pr_track_approvals:
          kind === 'PR' ? normalizePrTrackApprovals(body?.pr_track_approvals) : null,
      },
      error: null,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update approval status';
    return { success: false, data: null, error: message };
  }
}

/**
 * Claim ownership of an open RM/PM section (called when a user first touches its fields).
 * No-op if already the owner; fails with the owner's name if someone else owns it.
 */
export async function claimPrTrackOwnership(
  itemId: string | number,
  track: PrTrackKey
): Promise<PatchMasterApprovalResult> {
  try {
    const id = encodeURIComponent(String(itemId));
    const body = await api.patch<Record<string, unknown>>(
      `/api/v1/products/${id}/approval-track-claim`,
      { track }
    );
    return {
      success: true,
      data: {
        status: readStatusFromResponse('PR', body ?? {}),
        approval_stage_assignees: readAssigneesFromResponse(body ?? {}),
        approval_assigned_user_id: readAssigneesFromResponse(body ?? {}).approver?.user_id ?? null,
        approval_assigned_display_name:
          readAssigneesFromResponse(body ?? {}).approver?.display_name ?? null,
        pr_track_approvals: normalizePrTrackApprovals(body?.pr_track_approvals),
      },
      error: null,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to claim section ownership';
    return { success: false, data: null, error: message };
  }
}

/**
 * PR dual-track workflow action — Send for / Approve / Revert the RM or PM approval track.
 */
export async function patchPrTrackApproval(
  itemId: string | number,
  track: PrTrackKey,
  action: 'send' | 'approve' | 'revert',
  note?: string
): Promise<PatchMasterApprovalResult> {
  return patchMasterApprovalStatus('PR', itemId, { track, action, ...(note ? { note } : {}) });
}
