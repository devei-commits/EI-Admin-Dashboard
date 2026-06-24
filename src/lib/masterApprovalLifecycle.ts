import {
  MASTER_APPROVAL_STATUSES,
  normalizeMasterApprovalStatus,
  type MasterApprovalStatus,
} from '../constants/masterApprovalStatus';
import type { MasterApprovalStatusHistoryEntry } from '../services/masterApproval.service';

export type MasterApprovalExitAction = 'advanced' | 'reverted' | 'set' | 'current';

export type MasterApprovalLifecycleStage = {
  status: MasterApprovalStatus;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  durationLabel: string;
  exitedBy: string | null;
  exitAction: MasterApprovalExitAction;
  exitNote: string | null;
  isCurrent: boolean;
};

/** Human-readable duration for approval stage time-in-stage. */
export function formatApprovalDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 60_000) return '< 1 min';
  const totalMins = Math.floor(ms / 60_000);
  if (totalMins < 60) return `${totalMins} min`;
  const hrs = Math.floor(totalMins / 60);
  const remMins = totalMins % 60;
  if (hrs < 24) {
    return remMins > 0 ? `${hrs} hr${hrs === 1 ? '' : 's'} ${remMins} min` : `${hrs} hr${hrs === 1 ? '' : 's'}`;
  }
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return remHrs > 0
    ? `${days} day${days === 1 ? '' : 's'} ${remHrs} hr${remHrs === 1 ? '' : 's'}`
    : `${days} day${days === 1 ? '' : 's'}`;
}

function parseTime(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

function mapExitAction(source: string | null | undefined): MasterApprovalExitAction {
  const s = String(source ?? '').trim().toLowerCase();
  if (s === 'revert') return 'reverted';
  if (s === 'advance') return 'advanced';
  if (s === 'current') return 'current';
  if (s === 'pr_rm_team_signoff' || s === 'pr_pack_team_signoff') return 'set';
  return 'set';
}

export function exitActionVerb(action: MasterApprovalExitAction, source?: string | null): string {
  const src = String(source ?? '').trim().toLowerCase();
  if (src === 'pr_rm_team_signoff') return 'RM team sign-off by';
  if (src === 'pr_pack_team_signoff') return 'Pack team sign-off by';
  switch (action) {
    case 'advanced':
      return 'Advanced by';
    case 'reverted':
      return 'Sent back by';
    case 'set':
      return 'Updated by';
    case 'current':
      return 'In stage';
    default:
      return 'By';
  }
}

function makeStage(
  partial: Omit<MasterApprovalLifecycleStage, 'durationLabel'> & { durationLabel?: string }
): MasterApprovalLifecycleStage {
  const durationLabel =
    partial.durationLabel ??
    (partial.durationMs != null ? formatApprovalDuration(partial.durationMs) : '—');
  return { ...partial, durationLabel };
}

/**
 * Build per-stage timeline (Draft, Under Review, …) with time-in-stage and who moved the record forward/back.
 */
export function buildMasterApprovalLifecycleStages(
  entries: readonly MasterApprovalStatusHistoryEntry[],
  currentStatus: unknown,
  opts?: { recordCreatedAt?: string | null; now?: Date }
): MasterApprovalLifecycleStage[] {
  const now = opts?.now ?? new Date();
  const nowMs = now.getTime();
  const current = normalizeMasterApprovalStatus(currentStatus);
  const recordStartMs = parseTime(opts?.recordCreatedAt);

  const sorted = [...entries].sort((a, b) => {
    const ta = parseTime(a.createdAt) ?? 0;
    const tb = parseTime(b.createdAt) ?? 0;
    return ta - tb || a.id - b.id;
  });

  if (sorted.length === 0) {
    const durationMs =
      recordStartMs != null ? Math.max(0, nowMs - recordStartMs) : null;
    return [
      makeStage({
        status: current,
        startedAt: opts?.recordCreatedAt ?? null,
        endedAt: null,
        durationMs,
        exitedBy: null,
        exitAction: 'current',
        exitNote: null,
        isCurrent: true,
      }),
    ];
  }

  const stages: MasterApprovalLifecycleStage[] = [];
  const first = sorted[0];
  const firstAtMs = parseTime(first.createdAt);
  const firstFrom = normalizeMasterApprovalStatus(first.fromStatus ?? 'Draft');

  if (firstAtMs != null && MASTER_APPROVAL_STATUSES.includes(firstFrom)) {
    const durationMs =
      recordStartMs != null ? Math.max(0, firstAtMs - recordStartMs) : null;
    stages.push(
      makeStage({
        status: firstFrom,
        startedAt: opts?.recordCreatedAt ?? null,
        endedAt: first.createdAt,
        durationMs,
        exitedBy: first.changedByDisplayName?.trim() || null,
        exitAction: mapExitAction(first.source),
        exitNote: first.note?.trim() || null,
        isCurrent: false,
      })
    );
  }

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const toStatus = normalizeMasterApprovalStatus(entry.toStatus);
    const startAt = entry.createdAt;
    const startMs = parseTime(startAt);
    if (startMs == null) continue;

    const next = sorted[i + 1];
    const isLast = next == null;

    if (isLast) {
      const durationMs = Math.max(0, nowMs - startMs);
      stages.push(
        makeStage({
          status: toStatus,
          startedAt: startAt,
          endedAt: null,
          durationMs,
          exitedBy: null,
          exitAction: 'current',
          exitNote: null,
          isCurrent: true,
        })
      );
      continue;
    }

    const endAt = next.createdAt;
    const endMs = parseTime(endAt);
    if (endMs == null) continue;

    stages.push(
      makeStage({
        status: toStatus,
        startedAt: startAt,
        endedAt: endAt,
        durationMs: Math.max(0, endMs - startMs),
        exitedBy: next.changedByDisplayName?.trim() || null,
        exitAction: mapExitAction(next.source),
        exitNote: next.note?.trim() || null,
        isCurrent: false,
      })
    );
  }

  return stages;
}

export function formatLifecycleWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}
