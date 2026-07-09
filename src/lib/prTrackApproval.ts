/**
 * PR master dual-track approval (frontend mirror of backend src/lib/prTrackApproval.js).
 *
 * A PR carries two independent approval tracks — RM and PM. Each moves
 * Draft → Sent for Approval → Approved. The PR is Active only when BOTH are Approved.
 * The RM track is owned by the `rm_team` assignee, the PM track by the `pack_team` assignee.
 */
import type { MasterApprovalStageAssignees } from '../constants/masterApprovalStatus';

export type PrTrackKey = 'rm' | 'pm';

export const PR_TRACK_STATUSES = ['Draft', 'Sent for Approval', 'Approved'] as const;
export type PrTrackStatus = (typeof PR_TRACK_STATUSES)[number];

export type PrTrackActor = { user_id: number; display_name: string } | null;

export type PrTrackState = {
  status: PrTrackStatus;
  sent_at: string | null;
  sent_by: PrTrackActor;
  approved_at: string | null;
  approved_by: PrTrackActor;
  note: string | null;
};

export type PrTrackApprovals = { rm: PrTrackState; pm: PrTrackState };

export const PR_TRACK_META: Record<PrTrackKey, { label: string; long: string; emoji: string; stageKey: 'rm_team' | 'pack_team' }> = {
  rm: { label: 'RM', long: 'RM approval', emoji: '🧪', stageKey: 'rm_team' },
  pm: { label: 'PM', long: 'PM approval', emoji: '📦', stageKey: 'pack_team' },
};

function emptyTrackState(): PrTrackState {
  return { status: 'Draft', sent_at: null, sent_by: null, approved_at: null, approved_by: null, note: null };
}

export function emptyPrTrackApprovals(): PrTrackApprovals {
  return { rm: emptyTrackState(), pm: emptyTrackState() };
}

function normalizeStatus(raw: unknown): PrTrackStatus {
  const s = String(raw ?? '').trim().toLowerCase();
  const found = PR_TRACK_STATUSES.find((x) => x.toLowerCase() === s);
  return found ?? 'Draft';
}

function normalizeActor(raw: unknown): PrTrackActor {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = parseInt(String(o.user_id ?? o.userId ?? ''), 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  const name = String(o.display_name ?? o.displayName ?? `User #${id}`).trim();
  return { user_id: id, display_name: name || `User #${id}` };
}

function normalizeState(raw: unknown): PrTrackState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyTrackState();
  const o = raw as Record<string, unknown>;
  return {
    status: normalizeStatus(o.status),
    sent_at: (o.sent_at ?? o.sentAt ?? null) as string | null,
    sent_by: normalizeActor(o.sent_by ?? o.sentBy),
    approved_at: (o.approved_at ?? o.approvedAt ?? null) as string | null,
    approved_by: normalizeActor(o.approved_by ?? o.approvedBy),
    note: o.note != null && String(o.note).trim() !== '' ? String(o.note).trim() : null,
  };
}

export function normalizePrTrackApprovals(raw: unknown): PrTrackApprovals {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyPrTrackApprovals();
  const o = raw as Record<string, unknown>;
  return { rm: normalizeState(o.rm), pm: normalizeState(o.pm) };
}

/** PR overall status derived from the two tracks (matches backend). */
export function derivePrOverallStatus(tracks: PrTrackApprovals): 'Active' | 'Under Approval' | 'Draft' {
  if (tracks.rm.status === 'Approved' && tracks.pm.status === 'Approved') return 'Active';
  if (tracks.rm.status !== 'Draft' || tracks.pm.status !== 'Draft') return 'Under Approval';
  return 'Draft';
}

export function prTrackOwnerId(assignees: MasterApprovalStageAssignees, track: PrTrackKey): number | null {
  const slot = assignees[PR_TRACK_META[track].stageKey];
  return slot?.user_id ?? null;
}

/** May the current user act (send/approve/revert) on this track? Owner-of-open-slot or admin. */
export function canActOnPrTrack(
  isAdmin: boolean,
  currentUserId: string | number | undefined,
  assignees: MasterApprovalStageAssignees,
  track: PrTrackKey
): boolean {
  if (isAdmin) return true;
  const me = parseInt(String(currentUserId ?? ''), 10);
  if (!Number.isFinite(me)) return false;
  const ownerId = prTrackOwnerId(assignees, track);
  if (ownerId == null) return true; // open slot — editor may take it
  return ownerId === me;
}

/** The next forward action available for a track, or null if fully approved. */
export function nextPrTrackAction(state: PrTrackState): 'send' | 'approve' | null {
  if (state.status === 'Draft') return 'send';
  if (state.status === 'Sent for Approval') return 'approve';
  return null;
}

export function prTrackStatusBadgeClass(status: PrTrackStatus): string {
  switch (status) {
    case 'Approved':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'Sent for Approval':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'Draft':
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}
