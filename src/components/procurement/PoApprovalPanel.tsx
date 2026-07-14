/**
 * PO Approval workflow panel (Flowchart Sub-flow E).
 * Self-contained: fetches its own approval state for a PO and renders the
 * stage badge, threshold-matrix route, action buttons, and the audit trail.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Send, RotateCcw, XCircle, ChevronRight, Loader2 } from 'lucide-react';
import {
  fetchPoApprovalTrail,
  submitPoForReview,
  actOnPoApproval,
  type PoApprovalState,
  type PoApprovalAction,
} from '../../services/poApproval.service';
import {
  PO_APPROVAL_STATUS_CONFIG,
  PO_TYPE_CONFIG,
  toPoApprovalStatus,
  toPoType,
  type PoApprovalStatus,
} from '../../constants/procurement';

export interface PoApprovalPanelProps {
  /** Backend purchase_orders id (numeric string, or "PO-42"). */
  poId: string;
  /** Optional toast hook from the host page. */
  onToast?: (type: 'success' | 'error' | 'info' | 'warning', msg: string) => void;
  /** Called after any successful transition so the host can refetch POs. */
  onChanged?: () => void;
  /** Bump to force a refetch from the host (keeps sibling panels in sync). */
  refreshKey?: number;
  /** Disable actions when the PO is on hold / cancelled. */
  locked?: boolean;
}

function fmtWhen(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export const PoApprovalPanel: React.FC<PoApprovalPanelProps> = ({ poId, onToast, onChanged, refreshKey = 0, locked = false }) => {
  const [state, setState] = useState<PoApprovalState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchPoApprovalTrail(poId);
    if (res.success && res.data) {
      setState(res.data);
      setError(null);
    } else {
      setError(typeof res.error === 'string' ? res.error : 'Failed to load approval state');
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poId, refreshKey]);

  useEffect(() => { void load(); }, [load]);

  const status: PoApprovalStatus = toPoApprovalStatus(state?.approvalStatus);
  const route = state?.route;

  const run = useCallback(
    async (fn: () => Promise<{ success: boolean; error: unknown; data: PoApprovalState | null }>, label: string, okMsg: string) => {
      setBusy(label);
      const res = await fn();
      setBusy(null);
      if (res.success && res.data) {
        setState(res.data);
        setNote('');
        onToast?.('success', okMsg);
        onChanged?.();
      } else {
        const msg = typeof res.error === 'string' ? res.error : 'Action failed';
        setError(msg);
        onToast?.('error', msg);
      }
    },
    [onToast, onChanged],
  );

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading approval status…
      </div>
    );
  }

  if (error && !state) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
        <span>{error}</span>
        <button type="button" onClick={() => void load()} className="text-red-700 font-semibold underline shrink-0">Retry</button>
      </div>
    );
  }

  const badge = PO_APPROVAL_STATUS_CONFIG[status];
  const poTypeCfg = PO_TYPE_CONFIG[toPoType(state?.poType)];
  const canSubmit = status === 'not_submitted' || status === 'changes_requested' || status === 'rejected';
  const isUnderReview = status === 'under_review';
  const isUnderApproval = status === 'under_approval';
  const twoStep = !!route?.twoStep;
  const btnBase = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-bold disabled:opacity-50';
  const actionsDisabled = busy != null || locked;

  const act = (action: PoApprovalAction, okMsg: string) =>
    run(() => actOnPoApproval(poId, action, note.trim() || undefined), action, okMsg);

  return (
    <div className={`rounded-lg border border-slate-200 bg-white ${locked ? 'opacity-60' : ''}`}>
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[10px] tracking-[0.14em] text-slate-500 uppercase">Approval</span>
          <span className={`text-[11px] px-2 py-0.5 rounded border font-semibold ${badge.bg} ${badge.text} ${badge.border}`}>{badge.label}</span>
          <span className={`text-[11px] px-2 py-0.5 rounded border font-semibold ${poTypeCfg.bg} ${poTypeCfg.text} ${poTypeCfg.border}`}>{poTypeCfg.label}</span>
        </div>
        {state?.approvalAmount != null && (
          <span className="text-[11px] text-slate-500 tabular-nums">₹{Number(state.approvalAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
        )}
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Route */}
        {route && (
          <div className={`rounded-md border px-3 py-2 text-[11px] ${route.requiresCfo ? 'border-orange-200 bg-orange-50 text-orange-800' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>
            <div className="font-bold flex items-center gap-1">
              Route: {twoStep && <>Procurement Head <ChevronRight className="h-3 w-3" /></>}{route.finalApproverLabel}
              {route.deviationFlag && <span className="ml-1 text-orange-700">· deviation-flagged</span>}
            </div>
            <div className="opacity-80 mt-0.5">{route.note}</div>
          </div>
        )}

        {/* Approved summary */}
        {status === 'approved' && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Approved{state?.approvedAt ? ` · ${fmtWhen(state.approvedAt)}` : ''}. Ready to send to vendor.
          </div>
        )}
        {status === 'rejected' && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700 flex items-center gap-2">
            <XCircle className="h-4 w-4 shrink-0" /> Rejected. Revise the draft and re-submit.
          </div>
        )}
        {status === 'changes_requested' && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" /> Changes requested. Edit the draft, then re-submit for review.
          </div>
        )}

        {/* Note input (shown whenever an action is available) */}
        {(canSubmit || isUnderReview || isUnderApproval) && (
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note (reason / comment)…"
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-[12px]"
          />
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {canSubmit && (
            <button
              type="button"
              disabled={actionsDisabled}
              onClick={() => run(() => submitPoForReview(poId, note.trim() || undefined), 'submit', 'Submitted for review.')}
              className={`${btnBase} bg-violet-600 text-white hover:bg-violet-700`}
            >
              {busy === 'submit' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Submit for Review
            </button>
          )}

          {isUnderReview && twoStep && (
            <button type="button" disabled={actionsDisabled} onClick={() => act('forward', 'Forwarded to approver.')} className={`${btnBase} bg-blue-600 text-white hover:bg-blue-700`}>
              {busy === 'forward' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Forward to {route?.finalApproverLabel}
            </button>
          )}

          {(isUnderApproval || (isUnderReview && !twoStep)) && (
            <button type="button" disabled={actionsDisabled} onClick={() => act('approve', 'PO approved.')} className={`${btnBase} bg-emerald-600 text-white hover:bg-emerald-700`}>
              {busy === 'approve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Approve
            </button>
          )}

          {(isUnderReview || isUnderApproval) && (
            <>
              <button type="button" disabled={actionsDisabled} onClick={() => act('request_changes', 'Sent back for changes.')} className={`${btnBase} bg-amber-500 text-white hover:bg-amber-600`}>
                {busy === 'request_changes' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                Request Changes
              </button>
              <button type="button" disabled={actionsDisabled} onClick={() => act('reject', 'PO rejected.')} className={`${btnBase} bg-white text-red-600 border border-red-300 hover:bg-red-50`}>
                {busy === 'reject' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                Reject
              </button>
            </>
          )}
        </div>

        {/* Trail */}
        {state?.trail && state.trail.length > 0 && (
          <div className="pt-1">
            <p className="text-[10px] tracking-[0.14em] text-slate-400 uppercase mb-1">Audit trail</p>
            <ul className="space-y-1">
              {state.trail.map((t) => (
                <li key={t.id} className="text-[11px] text-slate-600 flex items-start gap-2">
                  <span className="text-slate-400 tabular-nums shrink-0">{fmtWhen(t.at)}</span>
                  <span>
                    <span className="font-semibold text-slate-700">{t.action.replace(/_/g, ' ')}</span>
                    {t.actorName ? ` · ${t.actorName}` : ''}
                    {t.note ? ` — ${t.note}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default PoApprovalPanel;
