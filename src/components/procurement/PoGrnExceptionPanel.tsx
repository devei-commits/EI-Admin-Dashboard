/**
 * GRN-stage PO exceptions panel (Flowchart: Short-supply · QC-fail RTV).
 * Self-contained; renders only when there's an actual exception to act on.
 * Reads GRN read-only via the backend; PO-side records only.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { PackageMinus, ShieldX, Undo2, CheckCircle2, Loader2 } from 'lucide-react';
import {
  fetchPoGrnException,
  shortClosePo,
  raiseRtv,
  resolveRtv,
  type PoGrnExceptionState,
} from '../../services/poGrnException.service';

export interface PoGrnExceptionPanelProps {
  poId: string;
  onToast?: (type: 'success' | 'error' | 'info' | 'warning', msg: string) => void;
  onChanged?: () => void;
  refreshKey?: number;
  locked?: boolean;
}

const qty = (n: number) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 3 });
const fmtDate = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const PoGrnExceptionPanel: React.FC<PoGrnExceptionPanelProps> = ({ poId, onToast, onChanged, refreshKey = 0, locked = false }) => {
  const [state, setState] = useState<PoGrnExceptionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [scNote, setScNote] = useState('');
  const [rtvReason, setRtvReason] = useState('');
  const [rtvRef, setRtvRef] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchPoGrnException(poId);
    if (res.success && res.data) { setState(res.data); setError(null); }
    else setError(typeof res.error === 'string' ? res.error : 'Failed to load GRN exception state');
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poId, refreshKey]);

  useEffect(() => { void load(); }, [load]);

  const run = useCallback(
    async (fn: () => Promise<{ success: boolean; error: unknown; data: PoGrnExceptionState | null }>, label: string, okMsg: string) => {
      setBusy(label);
      const res = await fn();
      setBusy(null);
      if (res.success && res.data) {
        setState(res.data);
        setScNote(''); setRtvReason(''); setRtvRef('');
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

  if (loading || error && !state) return null; // stay quiet until we know there's an exception
  if (!state) return null;

  // Only surface the panel when there's something to show/act on.
  const relevant = state.partialReceipt || state.shortClosed || state.qcFailed || state.rtvStatus != null;
  if (!relevant) return null;

  const actionsDisabled = busy != null || locked;
  const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-bold disabled:opacity-50';

  return (
    <div className={`rounded-xl border border-[color:var(--st-amber-fg)]/30 bg-surface ${locked ? 'opacity-60' : ''}`}>
      <div className="px-4 py-2.5 border-b border-[color:var(--st-amber-fg)]/30 flex items-center gap-2">
        <span className="text-[10px] tracking-wide text-warn uppercase font-semibold">GRN exceptions</span>
      </div>
      <div className="px-4 py-3 space-y-3">

        {/* Short-supply / partial receipt */}
        {(state.partialReceipt || state.shortClosed) && (
          <div className="rounded-md border border-[color:var(--st-amber-fg)]/30 bg-warn-soft px-3 py-2.5 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-warn"><PackageMinus className="h-3.5 w-3.5" /> Short supply — received less than ordered</div>
            {state.partialLines.length > 0 && (
              <ul className="text-[11px] text-warn space-y-0.5">
                {state.partialLines.map((l) => (
                  <li key={l.code} className="flex flex-wrap gap-x-2">
                    <span className="font-medium">{l.name}</span>
                    <span className="text-warn font-mono text-[10px]">{l.code}</span>
                    <span>ordered {qty(l.orderedQty)} · received {qty(l.receivedQty)} · <b>balance {qty(l.balanceQty)}{l.unit ? ` ${l.unit}` : ''}</b></span>
                  </li>
                ))}
              </ul>
            )}
            {state.shortClosed ? (
              <div className="text-[11px] text-ok flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Balance short-closed{state.shortClosedAt ? ` · ${fmtDate(state.shortClosedAt)}` : ''}. Shortfall reopened on the request for re-planning.{state.shortCloseNote ? ` — ${state.shortCloseNote}` : ''}</div>
            ) : (
              <>
                <input value={scNote} onChange={(e) => setScNote(e.target.value)} placeholder="Note (optional)…" aria-label="Note (optional)" className="w-full rounded-md border border-[color:var(--st-amber-fg)]/30 px-2 py-1.5 text-[12px]" />
                <button
                  type="button"
                  disabled={actionsDisabled || !state.canShortClose}
                  onClick={() => run(() => shortClosePo(poId, scNote.trim() || undefined), 'sc', 'Balance short-closed.')}
                  className={`${btn} bg-warn text-white hover:brightness-95`}
                >
                  {busy === 'sc' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PackageMinus className="h-3.5 w-3.5" />}
                  Short-close balance
                </button>
                <p className="text-[10px] text-warn">Accepts the received qty as final (pay on received qty) and reopens the shortfall for Planning.</p>
              </>
            )}
          </div>
        )}

        {/* QC fail → RTV */}
        {(state.qcFailed || state.rtvStatus != null) && (
          <div className="rounded-md border border-[color:var(--st-red-fg)]/30 bg-err-soft px-3 py-2.5 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-err"><ShieldX className="h-3.5 w-3.5" /> QC failure {state.qcFailed ? '(GRN QC rejected)' : ''}</div>

            {state.rtvStatus === 'raised' ? (
              <>
                <div className="text-[11px] text-err">
                  RTV raised{state.rtvAt ? ` · ${fmtDate(state.rtvAt)}` : ''}{state.rtvDebitNoteRef ? ` · Debit note ${state.rtvDebitNoteRef}` : ''}. Payment &amp; close are blocked until resolved.
                  {state.rtvReason ? <span className="block opacity-80 mt-0.5">Reason: {state.rtvReason}</span> : null}
                </div>
                <div className="text-[10px] text-err">Physical return + payables adjustment are handled in Warehouse / Treasury.</div>
                <button
                  type="button"
                  disabled={actionsDisabled || !state.canResolveRtv}
                  onClick={() => run(() => resolveRtv(poId), 'rtv-resolve', 'RTV resolved.')}
                  className={`${btn} bg-surface text-err border border-[color:var(--st-red-fg)]/30 hover:bg-err-soft`}
                >
                  {busy === 'rtv-resolve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                  Resolve RTV
                </button>
              </>
            ) : state.rtvStatus === 'resolved' ? (
              <div className="text-[11px] text-ok flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> RTV resolved — payment/close unblocked.</div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <input value={rtvReason} onChange={(e) => setRtvReason(e.target.value)} placeholder="RTV reason (required)…" aria-label="RTV reason (required)" className="rounded-md border border-[color:var(--st-red-fg)]/30 px-2 py-1.5 text-[12px]" />
                  <input value={rtvRef} onChange={(e) => setRtvRef(e.target.value)} placeholder="Debit note ref (optional)" aria-label="Debit note ref (optional)" className="rounded-md border border-[color:var(--st-red-fg)]/30 px-2 py-1.5 text-[12px]" />
                </div>
                <button
                  type="button"
                  disabled={actionsDisabled || !state.canRaiseRtv || !rtvReason.trim()}
                  onClick={() => run(() => raiseRtv(poId, rtvReason.trim(), rtvRef.trim() || undefined), 'rtv', 'RTV raised — payment blocked.')}
                  className={`${btn} bg-err text-white hover:brightness-95`}
                >
                  {busy === 'rtv' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldX className="h-3.5 w-3.5" />}
                  Raise RTV
                </button>
                <p className="text-[10px] text-err">Blocks payment/close on this PO. Physical return + debit note handled downstream.</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PoGrnExceptionPanel;
