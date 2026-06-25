import type { MasterApprovalStageAssignees } from '../constants/masterApprovalStatus';
import type { PrQualitySpecSectionKey } from '../constants/prQualitySpecSections';

export type PrFormTeamRole = 'admin' | 'rm_team' | 'pack_team' | 'both_teams' | 'unassigned';

export type PrFormSubsection =
  | 'primary'
  | 'formulaBom'
  | 'skuBom'
  | 'packBom'
  | 'processProduction'
  | 'processPackaging'
  | 'specsProduct'
  | 'specsPackaging'
  | 'qualityBulk'
  | 'qualityFinal'
  | 'qualityDispatch'
  | 'licensing';

export type PrProcessStepKind = 'production' | 'packaging';

export function resolvePrFormTeamRole(
  isAdmin: boolean,
  userId: string | number | undefined,
  assignees: MasterApprovalStageAssignees
): PrFormTeamRole {
  if (isAdmin) return 'admin';
  const me = parseInt(String(userId ?? ''), 10);
  if (!Number.isFinite(me) || me <= 0) return 'unassigned';
  const isRm = assignees.rm_team?.user_id === me;
  const isPack = assignees.pack_team?.user_id === me;
  if (isRm && isPack) return 'both_teams';
  if (isRm) return 'rm_team';
  if (isPack) return 'pack_team';
  return 'unassigned';
}

function roleMayEditProductSections(role: PrFormTeamRole): boolean {
  return role === 'admin' || role === 'rm_team' || role === 'both_teams';
}

function roleMayEditPackagingSections(role: PrFormTeamRole): boolean {
  return role === 'admin' || role === 'pack_team' || role === 'both_teams';
}

/** Whether the current user may edit a PR form subsection (non-admin rules). */
export function canEditPrFormSubsection(role: PrFormTeamRole, subsection: PrFormSubsection): boolean {
  if (subsection === 'skuBom') return false;
  if (role === 'admin') return true;
  switch (subsection) {
    case 'primary':
    case 'formulaBom':
      return role !== 'unassigned';
    case 'skuBom':
      return false;
    case 'packBom':
    case 'processPackaging':
    case 'specsPackaging':
    case 'qualityFinal':
    case 'qualityDispatch':
      return roleMayEditPackagingSections(role);
    case 'processProduction':
    case 'specsProduct':
    case 'qualityBulk':
      return roleMayEditProductSections(role);
    case 'licensing':
      return false;
    default:
      return false;
  }
}

export function canEditPrFormStage(role: PrFormTeamRole, stageIndex: number): boolean {
  switch (stageIndex) {
    case 0:
      return canEditPrFormSubsection(role, 'primary');
    case 1:
      return canEditPrFormSubsection(role, 'formulaBom');
    case 2:
      return canEditPrFormSubsection(role, 'skuBom');
    case 3:
      return canEditPrFormSubsection(role, 'packBom');
    case 4:
      return (
        canEditPrFormSubsection(role, 'processProduction') ||
        canEditPrFormSubsection(role, 'processPackaging')
      );
    case 5:
      return (
        canEditPrFormSubsection(role, 'specsProduct') ||
        canEditPrFormSubsection(role, 'specsPackaging')
      );
    case 6:
      return (
        canEditPrFormSubsection(role, 'qualityBulk') ||
        canEditPrFormSubsection(role, 'qualityFinal') ||
        canEditPrFormSubsection(role, 'qualityDispatch')
      );
    case 7:
      return canEditPrFormSubsection(role, 'licensing');
    default:
      return false;
  }
}

export function prQualitySpecSectionEditable(
  role: PrFormTeamRole,
  section: PrQualitySpecSectionKey
): boolean {
  if (section === 'bulkClearance') return canEditPrFormSubsection(role, 'qualityBulk');
  if (section === 'finalClearance') return canEditPrFormSubsection(role, 'qualityFinal');
  return canEditPrFormSubsection(role, 'qualityDispatch');
}

export function normalizePrProcessStepKind(raw: unknown): PrProcessStepKind {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'packaging' || s === 'pack') return 'packaging';
  return 'production';
}
