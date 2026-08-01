/**
 * PO exception controls (Flowchart Hold · Cancel · Amend).
 * Self-contained: fetches its own exception state. Shows an ON HOLD / CANCELLED
 * banner and the available lifecycle actions with a reason prompt.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { PauseCircle, PlayCircle, XOctagon, PencilLine, Loader2, ShieldAlert } from 'lucide-react';
import {
  fetchPoExceptionState,
  holdPo,
  resumePo,
  cancelPo,
  amendPo,
  type PoExceptionState,
} from '../../services/poException.service';

export interface PoExceptionBarProps {
  poId: string;
  onToast?: (type: 'success' | 'error' | 'info' | 'warning', msg: string) => void;
  onChanged?: () => void;
  refreshKey?: number;
  /** Reports on/off-hold + cancelled so the host can grey out sibling workflow panels. */
  onLockChange?: (lock: { onHold: boolean; cancelled: boolean }) => void;
}

type PendingAction = 'hold' | 'cancel' | 'amend' | null;

const fmt = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export const PoExceptionBar: React.FC<PoExceptionBarProps> = ({ poId, onToast, onChanged, refreshKey = 0, onLockChange }) => {
  const [state, setState] = useState<PoExceptionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchPoExceptionState(poId);
    if (res.success && res.data) {
      setState(res.data);
      setError(null);
      onLockChange?.({ onHold: res.data.onHold, cancelled: res.data.cancelled });
    } else {
      setError(typeof res.error === 'string' ? res.error : 'Failed to load exception state');
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poId, refreshKey]);

  useEffect(() => { void load(); }, [load]);

  const run = useCallback(
    async (fn: () => Promise<{ success: boolean; error: unknown; data: PoExceptionState | null }>, label: string, okMsg: string) => {
      setBusy(label);
      const res = await fn();
      setBusy(null);
      if (res.success && res.data) {
        setState(res.data);
        setPending(null);
        setReason('');
        onLockChange?.({ onHold: res.data.onHold, cancelled: res.data.cancelled });
        onToast?.('success', okMsg);
        onChanged?.();
      } else {
        const msg = typeof res.error === 'string' ? res.error : 'Action failed';
        setError(msg);
        onToast?.('error', msg);
      }
    },
    [onToast, onChanged, onLockChange],
  );

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-surface-3 px-4 py-2.5 flex items-center gap-2 text-[12px] text-ink-3">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading PO status…
      </div>
    );
  }
  if (error && !state) {
    return (
      <div className="rounded-lg border border-[color:var(--st-red-fg)]/30 bg-err-soft px-4 py-2.5 text-[12px] text-err flex items-center justify-between gap-3">
        <span>{error}</span>
        <button type="button" onClick={() => void load()} className="text-err font-semibold underline shrink-0">Retry</button>
      </div>
    );
  }
  if (!state) return null;

  const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-bold disabled:opacity-50';

  // Cancelled = terminal.
  if (state.cancelled) {
    return (
      <div className="rounded-lg border border-[color:var(--st-red-fg)]/30 bg-err-soft px-4 py-3 text-[12px] text-err">
        <div className="flex items-center gap-2 font-bold"><XOctagon className="h-4 w-4 shrink-0" /> PO Cancelled{state.exceptionAt ? ` · ${fmt(state.exceptionAt)}` : ''}{state.exceptionBy ? ` · ${state.exceptionBy}` : ''}</div>
        {state.exceptionReason && <div className="mt-1 opacity-90">Reason: {state.exceptionReason}</div>}
        <div className="mt-1 opacity-80">The linked request has been reopened for re-planning.</div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border px-4 py-3 ${state.onHold ? 'border-[color:var(--st-amber-fg)]/30 bg-warn-soft' : 'border-border bg-surface'}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[10px] tracking-wide text-ink-3 uppercase">Lifecycle</span>
          {state.onHold ? (
            <span className="text-[11px] px-2 py-0.5 rounded border font-semibold bg-warn-soft text-warn border-[color:var(--st-amber-fg)]/30 inline-flex items-center gap-1">
              <PauseCircle className="h-3.5 w-3.5" /> On Hold
            </span>
          ) : (
            <span className="text-[11px] text-ink-4">Active</span>
          )}
          {state.amendmentCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-surface-3 text-ink-3 border-border">Amended ×{state.amendmentCount}</span>
          )}
        </div>

        {/* Primary actions (hidden while a reason prompt is open) */}
        {pending == null && (
          <div className="flex flex-wrap gap-1.5">
            {state.canResume && (
              <button type="button" disabled={busy != null} onClick={() => run(() => resumePo(poId), 'resume', 'PO resumed.')} className={`${btn} bg-ok text-white hover:brightness-95`}>
                {busy === 'resume' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />} Resume
              </button>
            )}
            {state.canHold && (
              <button type="button" onClick={() => { setPending('hold'); setReason(''); }} className={`${btn} bg-surface text-warn border border-[color:var(--st-amber-fg)]/30 hover:bg-warn-soft`}>
                <PauseCircle className="h-3.5 w-3.5" /> Hold
              </button>
            )}
            {state.canAmend && (
              <button type="button" onClick={() => { setPending('amend'); setReason(''); }} className={`${btn} bg-surface text-brand border border-brand-soft hover:bg-brand-soft`}>
                <PencilLine className="h-3.5 w-3.5" /> Amend
              </button>
            )}
            {state.canCancel && (
              <button type="button" onClick={() => { setPending('cancel'); setReason(''); }} className={`${btn} bg-surface text-err border border-[color:var(--st-red-fg)]/30 hover:bg-err-soft`}>
                <XOctagon className="h-3.5 w-3.5" /> Cancel PO
              </button>
            )}
          </div>
        )}
      </div>

      {/* On-hold reason line */}
      {state.onHold && state.exceptionReason && pending == null && (
        <div className="mt-2 text-[11px] text-warn">Reason: {state.exceptionReason}{state.exceptionBy ? ` · ${state.exceptionBy}` : ''}. Workflow actions are paused until resumed.</div>
      )}

      {/* Reason prompt for hold / cancel / amend */}
      {pending != null && (
        <div className="mt-2.5 rounded-md border border-border bg-surface-3 px-3 py-2.5 space-y-2">
          <div className="text-[11px] font-bold text-ink-2">
            {pending === 'hold' && 'Put this PO on hold'}
            {pending === 'amend' && 'Amend this PO (resets approval + vendor loop back to Draft)'}
            {pending === 'cancel' && 'Cancel this PO'}
          </div>
          {pending === 'cancel' && state.requiresCfoToCancel && (
            <div className="text-[11px] text-err flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> Amount is above ₹5L — CFO authority required to cancel.
            </div>
          )}
          {pending === 'cancel' && (
            <div className="text-[11px] text-ink-3">Cancelling reopens the linked request for re-planning. Any advance paid must be recovered (RTV / credit note).</div>
          )}
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (required)…"
            aria-label="Reason (required)"
            className="w-full rounded-md border border-border px-2.5 py-1.5 text-[12px]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy != null || !reason.trim()}
              onClick={() => {
                if (pending === 'hold') void run(() => holdPo(poId, reason.trim()), 'hold', 'PO put on hold.');
                else if (pending === 'amend') void run(() => amendPo(poId, reason.trim()), 'amend', 'PO amended — back to Draft for re-approval.');
                else if (pending === 'cancel') void run(() => cancelPo(poId, reason.trim()), 'cancel', 'PO cancelled.');
              }}
              className={`${btn} ${pending === 'cancel' ? 'bg-err hover:brightness-95' : pending === 'amend' ? 'bg-brand hover:bg-brand-press' : 'bg-warn hover:brightness-95'} text-white`}
            >
              {busy != null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Confirm {pending === 'hold' ? 'Hold' : pending === 'amend' ? 'Amend' : 'Cancel'}
            </button>
            <button type="button" disabled={busy != null} onClick={() => { setPending(null); setReason(''); }} className={`${btn} bg-surface text-ink-3 border border-border hover:bg-surface-3`}>
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PoExceptionBar;
