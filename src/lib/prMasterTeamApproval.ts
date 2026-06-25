import type { MasterApprovalStageAssignees, MasterApprovalStageSlot } from '../constants/masterApprovalStatus';

export type PrTeamKey = 'rm_team' | 'pack_team';

export type PrApprovalTeamPending = {
  from_status: string;
  target_status: string;
  rm_signed_at?: string | null;
  rm_signed_by?: MasterApprovalStageSlot | null;
  rm_note?: string | null;
  pack_signed_at?: string | null;
  pack_signed_by?: MasterApprovalStageSlot | null;
  pack_note?: string | null;
};

export function normalizePrApprovalTeamPending(raw: unknown): PrApprovalTeamPending | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const from_status = String(o.from_status ?? o.fromStatus ?? '').trim();
  const target_status = String(o.target_status ?? o.targetStatus ?? '').trim();
  if (!from_status || !target_status) return null;

  const readSlot = (v: unknown): MasterApprovalStageSlot | null => {
    if (v == null || typeof v !== 'object' || Array.isArray(v)) return null;
    const s = v as Record<string, unknown>;
    const id = parseInt(String(s.user_id ?? s.userId ?? ''), 10);
    if (!Number.isFinite(id) || id <= 0) return null;
    return {
      user_id: id,
      display_name: String(s.display_name ?? s.displayName ?? `User #${id}`).trim(),
      role_name:
        s.role_name != null && String(s.role_name).trim() !== ''
          ? String(s.role_name).trim()
          : s.roleName != null && String(s.roleName).trim() !== ''
            ? String(s.roleName).trim()
            : null,
    };
  };

  return {
    from_status,
    target_status,
    rm_signed_at: (o.rm_signed_at ?? o.rmSignedAt ?? null) as string | null,
    rm_signed_by: readSlot(o.rm_signed_by ?? o.rmSignedBy),
    rm_note: (o.rm_note ?? o.rmNote ?? null) as string | null,
    pack_signed_at: (o.pack_signed_at ?? o.packSignedAt ?? null) as string | null,
    pack_signed_by: readSlot(o.pack_signed_by ?? o.packSignedBy),
    pack_note: (o.pack_note ?? o.packNote ?? null) as string | null,
  };
}

function resolveCallerTeamKey(
  userId: string | number | undefined,
  assignees: MasterApprovalStageAssignees
): PrTeamKey | null {
  const me = parseInt(String(userId ?? ''), 10);
  if (!Number.isFinite(me) || me <= 0) return null;
  if (assignees.rm_team?.user_id === me) return 'rm_team';
  if (assignees.pack_team?.user_id === me) return 'pack_team';
  return null;
}

function isTeamSlotOpen(key: PrTeamKey, assignees: MasterApprovalStageAssignees): boolean {
  return !assignees[key]?.user_id;
}

/** PR masters require RM team + Pack team sign-off before status advances. */
export function canPrTeamActAtCurrentStage(
  isAdmin: boolean,
  hasTeamAccess: boolean,
  currentUserId: string | number | undefined,
  assignees: MasterApprovalStageAssignees,
  pending: PrApprovalTeamPending | null
): boolean {
  if (isAdmin) return true;
  if (!hasTeamAccess) return false;
  const teamKey = resolveCallerTeamKey(currentUserId, assignees);
  if (teamKey) {
    if (!pending) return true;
    if (teamKey === 'rm_team' && pending.rm_signed_at) return false;
    if (teamKey === 'pack_team' && pending.pack_signed_at) return false;
    return true;
  }
  return isTeamSlotOpen('rm_team', assignees) || isTeamSlotOpen('pack_team', assignees);
}

export function formatPrTeamPendingSummary(pending: PrApprovalTeamPending | null): string {
  if (!pending) return '';
  const rm = pending.rm_signed_at ? 'RM ✓' : 'RM pending';
  const pack = pending.pack_signed_at ? 'Pack ✓' : 'Pack pending';
  return `${rm} · ${pack} → ${pending.target_status}`;
}

export function prTeamAssigneeSummary(assignees: MasterApprovalStageAssignees): string {
  const rm = assignees.rm_team?.display_name?.split(' ')[0] ?? 'Open';
  const pack = assignees.pack_team?.display_name?.split(' ')[0] ?? 'Open';
  return `RM: ${rm} · Pack: ${pack}`;
}

/** RM team assignee may only edit rm_team; Pack team assignee may only edit pack_team. */
export function canEditPrTeamAssignSlot(
  team: PrTeamKey,
  isAdmin: boolean,
  userId: string | number | undefined,
  assignees: MasterApprovalStageAssignees,
  hasAssignPermission: boolean
): boolean {
  if (!hasAssignPermission) return false;
  if (isAdmin) return true;
  const me = parseInt(String(userId ?? ''), 10);
  if (!Number.isFinite(me) || me <= 0) return true;
  const isRm = assignees.rm_team?.user_id === me;
  const isPack = assignees.pack_team?.user_id === me;
  if (team === 'rm_team') return !isPack || isRm;
  return !isRm || isPack;
}
