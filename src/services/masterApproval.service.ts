import { api } from '../lib/apiClient';
import type {
  MasterApprovalKind,
  MasterApprovalStageAssignees,
} from '../constants/masterApprovalStatus';
import { normalizeStageAssignees } from '../constants/masterApprovalStatus';

export type PatchMasterApprovalPayload =
  | { status: string }
  | { advance: true }
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

function readStatusFromResponse(kind: MasterApprovalKind, body: Record<string, unknown>): string {
  if (kind === 'PM') {
    const fd = body.form_data;
    if (fd && typeof fd === 'object' && !Array.isArray(fd)) {
      const fdObj = fd as { masterApprovalStatus?: string; status?: string };
      return String(fdObj.masterApprovalStatus ?? fdObj.status ?? body.status ?? 'Draft');
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
      },
      error: null,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update approval status';
    return { success: false, data: null, error: message };
  }
}
