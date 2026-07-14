/**
 * PO → Vendor loop panel (Flowchart Sub-flow F).
 * Gated on approval: Send to Vendor (channel + SLA clock) → Acknowledge / Reject.
 * Self-contained: fetches its own vendor state for a PO.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Send, CheckCircle2, XCircle, Clock, Loader2, Lock, RotateCcw } from 'lucide-react';
import {
  fetchPoVendorState,
  sendPoToVendor,
  acknowledgePo,
  rejectPoByVendor,
  resendToVendor,
  reopenAfterReject,
  type PoVendorState,
  type PoSendChannel,
} from '../../services/poVendor.service';
import {
  PO_VENDOR_STATUS_CONFIG,
  PO_SEND_CHANNEL_OPTIONS,
  SLA_LEVEL_CLASSES,
  SLA_LEVEL_PREFIX,
  type PoVendorStatus,
} from '../../constants/procurement';

export interface PoVendorPanelProps {
  poId: string;
  onToast?: (type: 'success' | 'error' | 'info' | 'warning', msg: string) => void;
  onChanged?: () => void;
  /** Bump to force a refetch (e.g. after the approval panel approves the PO). */
  refreshKey?: number;
  /** Disable actions when the PO is on hold / cancelled. */
  locked?: boolean;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const SLA_LABEL: Record<'ok' | 'warn' | 'bad', string> = {
  ok: 'within SLA',
  warn: 'due today',
  bad: 'SLA breached',
};

export const PoVendorPanel: React.FC<PoVendorPanelProps> = ({ poId, onToast, onChanged, refreshKey = 0, locked = false }) => {
  const [state, setState] = useState<PoVendorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [channel, setChannel] = useState<PoSendChannel>('portal');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchPoVendorState(poId);
    if (res.success && res.data) { setState(res.data); setError(null); }
    else setError(typeof res.error === 'string' ? res.error : 'Failed to load vendor state');
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poId, refreshKey]);

  useEffect(() => { void load(); }, [load]);

  const run = useCallback(
    async (fn: () => Promise<{ success: boolean; error: unknown; data: PoVendorState | null }>, label: string, okMsg: string) => {
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
        <Loader2 className="h-4 w-4 animate-spin" /> Loading vendor status…
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
  if (!state) return null;

  const vs: PoVendorStatus = state.vendorStatus;
  const approved = state.approvalStatus === 'approved';
  const badge = PO_VENDOR_STATUS_CONFIG[vs];
  const btnBase = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-bold disabled:opacity-50';
  const actionsDisabled = busy != null || locked;

  // Not yet approved → the vendor loop is locked.
  if (!approved && vs === 'not_sent') {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] text-slate-500 flex items-center gap-2">
        <Lock className="h-4 w-4 shrink-0" /> Approve the PO to enable sending it to the vendor.
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-slate-200 bg-white ${locked ? 'opacity-60' : ''}`}>
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[10px] tracking-[0.14em] text-slate-500 uppercase">Vendor</span>
          <span className={`text-[11px] px-2 py-0.5 rounded border font-semibold ${badge.bg} ${badge.text} ${badge.border}`}>{badge.label}</span>
        </div>
        {vs === 'sent' && state.slaLevel && (
          <span className={`text-[11px] font-semibold inline-flex items-center gap-1 ${SLA_LEVEL_CLASSES[state.slaLevel]}`}>
            <Clock className="h-3.5 w-3.5" />
            {SLA_LEVEL_PREFIX[state.slaLevel]} Ack {SLA_LABEL[state.slaLevel]} · due {fmtDate(state.ackSlaDueAt)}
          </span>
        )}
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* NOT SENT (approved) → send controls */}
        {vs === 'not_sent' && approved && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Send channel</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as PoSendChannel)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-[12px]"
                >
                  {PO_SEND_CHANNEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Note (optional)</label>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ref / instructions…" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-[12px]" />
              </div>
            </div>
            <button
              type="button"
              disabled={actionsDisabled}
              onClick={() => run(() => sendPoToVendor(poId, channel, note.trim() || undefined), 'send', 'PO sent to vendor.')}
              className={`${btnBase} bg-cyan-600 text-white hover:bg-cyan-700`}
            >
              {busy === 'send' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send to Vendor
            </button>
            <p className="text-[10px] text-slate-400">Starts the 48h acknowledgement SLA clock and moves the PO to Issued.</p>
          </>
        )}

        {/* SENT → awaiting acknowledgement */}
        {vs === 'sent' && (
          <>
            <div className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-[12px] text-cyan-800">
              Sent {state.sentChannel ? `via ${state.sentChannel}` : ''} on {fmtDate(state.sentAt)}. Awaiting vendor acknowledgement.
            </div>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note…" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-[12px]" />
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={actionsDisabled} onClick={() => run(() => acknowledgePo(poId, note.trim() || undefined), 'ack', 'Vendor acknowledgement recorded.')} className={`${btnBase} bg-emerald-600 text-white hover:bg-emerald-700`}>
                {busy === 'ack' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Record Acknowledgement
              </button>
              <button type="button" disabled={actionsDisabled} onClick={() => run(() => rejectPoByVendor(poId, note.trim() || undefined), 'reject', 'Vendor rejection recorded.')} className={`${btnBase} bg-white text-red-600 border border-red-300 hover:bg-red-50`}>
                {busy === 'reject' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                Vendor Rejected
              </button>
            </div>
          </>
        )}

        {/* ACKNOWLEDGED */}
        {vs === 'acknowledged' && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Vendor acknowledged{state.acknowledgedAt ? ` on ${fmtDate(state.acknowledgedAt)}` : ''}. Ready to initiate transit.
            {state.ackNote ? <span className="opacity-80"> — {state.ackNote}</span> : null}
          </div>
        )}

        {/* REJECTED → recovery actions */}
        {vs === 'rejected' && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700 space-y-2">
            <div className="flex items-center gap-2 font-semibold"><XCircle className="h-4 w-4 shrink-0" /> Vendor rejected{state.rejectedAt ? ` on ${fmtDate(state.rejectedAt)}` : ''}.</div>
            {state.rejectNote ? <div className="opacity-80">{state.rejectNote}</div> : null}
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (renegotiation / reason)…" className="w-full rounded-md border border-red-300 px-2.5 py-1.5 text-[12px]" />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={actionsDisabled || !state.canResend}
                onClick={() => run(() => resendToVendor(poId, channel, note.trim() || undefined), 'resend', 'PO re-sent to vendor.')}
                className={`${btnBase} bg-cyan-600 text-white hover:bg-cyan-700`}
                title="Renegotiated & vendor will accept — re-send the same PO (restarts the ack SLA)."
              >
                {busy === 'resend' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Re-send to Vendor
              </button>
              <button
                type="button"
                disabled={actionsDisabled || !state.canReopen}
                onClick={() => run(() => reopenAfterReject(poId, note.trim() || undefined), 'reopen', 'PR reopened for an alternate vendor.')}
                className={`${btnBase} bg-white text-red-700 border border-red-300 hover:bg-red-100`}
                title="Vendor can't fulfil — cancel this PO and reopen the request for an alternate vendor."
              >
                {busy === 'reopen' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                Reopen PR (alt vendor)
              </button>
            </div>
            <p className="text-[10px] text-red-600">Changing qty/price/date instead? Use <b>Amend</b> above.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PoVendorPanel;
