import { useEffect, useMemo, useState } from 'react';
import { normalizeStageAssignees } from '../../constants/masterApprovalStatus';
import {
  canActOnPrTrack,
  normalizePrTrackApprovals,
  nextPrTrackAction,
  prTrackStatusBadgeClass,
  PR_TRACK_META,
  type PrTrackApprovals,
  type PrTrackKey,
} from '../../lib/prTrackApproval';
import { patchPrTrackApproval } from '../../services/masterApproval.service';
import { useToast } from '../../context/ToastContext';

export type MasterPrTrackApprovalCellProps = {
  itemId: string | number;
  /** Raw pr_track_approvals from the API row. */
  trackApprovals?: unknown;
  /** Raw approval_stage_assignees from the API row (owns each track). */
  stageAssignees?: unknown;
  currentUserId?: string | number;
  isAdmin?: boolean;
  onUpdated?: (tracks: PrTrackApprovals, overallStatus: string) => void;
  /** Stack the two tracks vertically (list cell) vs inline (form footer). */
  layout?: 'stack' | 'inline';
  /** Render only one track (for a dedicated table column). Omit to render both. */
  track?: PrTrackKey;
};

const ACTION_LABEL: Record<'send' | 'approve', (t: PrTrackKey) => string> = {
  send: (t) => `Send for ${PR_TRACK_META[t].label} approval`,
  approve: (t) => `Approve ${PR_TRACK_META[t].label} status`,
};

function TrackRow({
  track,
  tracks,
  itemId,
  canAct,
  onUpdated,
  showLabel = true,
}: {
  track: PrTrackKey;
  tracks: PrTrackApprovals;
  itemId: string | number;
  canAct: boolean;
  onUpdated?: (tracks: PrTrackApprovals, overallStatus: string) => void;
  showLabel?: boolean;
}): JSX.Element {
  const { addToast } = useToast();
  const [busy, setBusy] = useState(false);
  const state = tracks[track];
  const meta = PR_TRACK_META[track];
  const next = nextPrTrackAction(state);

  const run = async (action: 'send' | 'approve' | 'revert'): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await patchPrTrackApproval(itemId, track, action);
      if (!res.success || !res.data) throw new Error(res.error || 'Failed to update approval');
      const nextTracks = res.data.pr_track_approvals ?? tracks;
      onUpdated?.(nextTracks, res.data.status);
      addToast('success', `${meta.label} ${action === 'send' ? 'sent for approval' : action === 'approve' ? 'approved' : 'reverted'}.`);
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Failed to update approval');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {showLabel ? (
        <span className="text-[10px] font-bold uppercase tracking-wide text-ink-3 w-6">{meta.label}</span>
      ) : null}
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${prTrackStatusBadgeClass(state.status)}`}
        title={
          state.status === 'Approved' && state.approved_by
            ? `Approved by ${state.approved_by.display_name}`
            : state.status === 'Sent for Approval' && state.sent_by
              ? `Sent by ${state.sent_by.display_name}`
              : undefined
        }
      >
        {state.status}
      </span>
      {canAct && next ? (
        <button
          type="button"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            void run(next);
          }}
          className={`px-2 py-0.5 text-[10px] font-semibold rounded-md text-white disabled:opacity-60 whitespace-nowrap ${
            next === 'approve' ? 'bg-ok hover:bg-ok' : 'bg-brand hover:bg-brand-press'
          }`}
        >
          {busy ? '…' : ACTION_LABEL[next](track)}
        </button>
      ) : null}
      {canAct && state.status !== 'Draft' ? (
        <button
          type="button"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            void run('revert');
          }}
          className="px-1.5 py-0.5 text-[10px] font-medium rounded-md border border-border text-ink-3 hover:bg-surface-3 disabled:opacity-60"
          title={`Revert ${meta.label} one step`}
          aria-label={`Revert ${meta.label} one step`}
        >
          ↩
        </button>
      ) : null}
    </div>
  );
}

export function MasterPrTrackApprovalCell({
  itemId,
  trackApprovals: rawTracks,
  stageAssignees: rawAssignees,
  currentUserId,
  isAdmin = false,
  onUpdated,
  layout = 'stack',
  track,
}: MasterPrTrackApprovalCellProps): JSX.Element {
  const [tracks, setTracks] = useState<PrTrackApprovals>(() => normalizePrTrackApprovals(rawTracks));
  useEffect(() => {
    setTracks(normalizePrTrackApprovals(rawTracks));
  }, [rawTracks]);

  const assignees = useMemo(() => normalizeStageAssignees(rawAssignees), [rawAssignees]);
  const handleUpdated = (next: PrTrackApprovals, overall: string): void => {
    setTracks(next);
    onUpdated?.(next, overall);
  };

  const shown: PrTrackKey[] = track ? [track] : ['rm', 'pm'];

  return (
    <div className={layout === 'stack' ? 'flex flex-col gap-1' : 'flex flex-wrap items-center gap-3'}>
      {shown.map((t) => (
        <TrackRow
          key={t}
          track={t}
          tracks={tracks}
          itemId={itemId}
          canAct={canActOnPrTrack(isAdmin, currentUserId, assignees, t)}
          onUpdated={handleUpdated}
          showLabel={!track}
        />
      ))}
    </div>
  );
}
