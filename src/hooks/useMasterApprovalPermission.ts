import { useCallback, useMemo } from 'react';
import {
  ASSIGN_STAGE_COLUMN_BY_KIND,
} from '../components/rolemanagementcomp/types/mastersModuleDefinition';
import type {
  MasterApprovalKind,
  MasterApprovalStageAssignees,
} from '../constants/masterApprovalStatus';
import { canActAtCurrentStage, normalizeStageAssignees } from '../constants/masterApprovalStatus';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from './usePermissions';

const SUBMODULE_BY_KIND: Record<MasterApprovalKind, string> = {
  RM: 'raw-materials',
  PM: 'packaging',
  PR: 'bom',
};

export interface UseMasterApprovalPermissionReturn {
  /** Can advance approval status when assigned to the current stage (requires Approve action). */
  hasTeamAccess: boolean;
  /** Can open Assign modal and save drafter / reviewer / approver (requires Assign approval stages → Edit). */
  canAssignApprover: boolean;
  canApproveAtStatus: (currentStatus: unknown, stageAssignees: unknown) => boolean;
  /** @deprecated use canApproveAtStatus */
  canApproveItem: (assignedUserId: number | null | undefined) => boolean;
  canUpdateApprovalStatus: boolean;
}

export function useMasterApprovalPermission(kind: MasterApprovalKind): UseMasterApprovalPermissionReturn {
  const { user } = useAuth();
  const { isAdmin, canPerformAction, getColumnPermission } = usePermissions();

  const subModuleId = SUBMODULE_BY_KIND[kind];
  const assignStageColumnId = ASSIGN_STAGE_COLUMN_BY_KIND[kind];

  const hasTeamAccess = useMemo(() => {
    return isAdmin || canPerformAction('inventory', subModuleId, 'canApprove');
  }, [isAdmin, canPerformAction, subModuleId]);

  const canAssignApprover = useMemo(() => {
    if (isAdmin) return true;
    return getColumnPermission('inventory', subModuleId, assignStageColumnId).canEdit;
  }, [isAdmin, getColumnPermission, subModuleId, assignStageColumnId]);

  const canApproveAtStatus = useCallback(
    (currentStatus: unknown, stageAssignees: unknown): boolean => {
      const assignees = normalizeStageAssignees(stageAssignees) as MasterApprovalStageAssignees;
      return canActAtCurrentStage(isAdmin, hasTeamAccess, user?.id, currentStatus, assignees);
    },
    [isAdmin, hasTeamAccess, user?.id]
  );

  const canApproveItem = useCallback(
    (_assignedUserId: number | null | undefined): boolean => hasTeamAccess,
    [hasTeamAccess]
  );

  return {
    hasTeamAccess,
    canAssignApprover,
    canApproveAtStatus,
    canApproveItem,
    canUpdateApprovalStatus: hasTeamAccess,
  };
}
