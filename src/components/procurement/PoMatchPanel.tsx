/**
 * 3-way match + Payment → Closed panel (Flowchart Sub-flow I).
 * Self-contained: fetches its own match state for a PO. Reconciles PO ↔ GRN ↔
 * Invoice, gates payment/close on a passing (or overridden) match.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Scale, FileText, IndianRupee, Lock, CheckCircle2, AlertTriangle, Loader2, Archive, Landmark } from 'lucide-react';
import {
  fetchPoMatch,
  captureInvoice,
  overrideMatch,
  recordFinalPayment,
  sendPoToTreasury,
  closePo,
  type PoMatchState,
  type PoPaymentMode,
} from '../../services/poMatch.service';
import {
  PO_MATCH_VERDICT_CONFIG,
  PO_MATCH_LINE_CONFIG,
  PO_PAYMENT_MODE_OPTIONS,
  type PoMatchVerdict,
  type PoMatchLineVerdict,
} from '../../constants/procurement';

export interface PoMatchPanelProps {
  poId: string;
  onToast?: (type: 'success' | 'error' | 'info' | 'warning', msg: string) => void;
  onChanged?: () => void;
  refreshKey?: number;
  /** Disable actions when the PO is on hold / cancelled. */
  locked?: boolean;
}

const inr = (n: number | null | undefined) =>
  n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const qty = (n: number) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 3 });
const fmtDate = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const PoMatchPanel: React.FC<PoMatchPanelProps> = ({ poId, onToast, onChanged, refreshKey = 0, locked = false }) => {
  const [state, setState] = useState<PoMatchState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // form fields
  const [invNo, setInvNo] = useState('');
  const [invDate, setInvDate] = useState('');
  const [invAmount, setInvAmount] = useState('');
  const [overrideNote, setOverrideNote] = useState('');
  const [payMode, setPayMode] = useState<PoPaymentMode>('neft');
  const [payTxn, setPayTxn] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [closeNote, setCloseNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchPoMatch(poId);
    if (res.success && res.data) {
      setState(res.data);
      setError(null);
      if (res.data.invoice.invoiceAmount != null) setInvAmount(String(res.data.invoice.invoiceAmount));
      if (res.data.invoice.invoiceNo) setInvNo(res.data.invoice.invoiceNo);
      if (res.data.invoice.invoiceDate) setInvDate(String(res.data.invoice.invoiceDate).slice(0, 10));
    } else {
      setError(typeof res.error === 'string' ? res.error : 'Failed to load 3-way match');
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poId, refreshKey]);

  useEffect(() => { void load(); }, [load]);

  const run = useCallback(
    async (fn: () => Promise<{ success: boolean; error: unknown; data: PoMatchState | null }>, label: string, okMsg: string) => {
      setBusy(label);
      const res = await fn();
      setBusy(null);
      if (res.success && res.data) {
        setState(res.data);
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
        <Loader2 className="h-4 w-4 animate-spin" /> Loading 3-way match…
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

  // Gate the whole panel on GRN completion.
  if (!state.grnComplete && !state.closure.isClosed) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] text-slate-500 flex items-center gap-2">
        <Lock className="h-4 w-4 shrink-0" /> Complete the GRN for this PO to run the 3-way match &amp; close it.
      </div>
    );
  }

  const verdict: PoMatchVerdict = state.match.verdict;
  const vcfg = PO_MATCH_VERDICT_CONFIG[verdict];
  const t = state.match.totals;
  const isOverridden = state.matchStatus === 'overridden';
  const btnBase = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-bold disabled:opacity-50';
  const actionsDisabled = busy != null || locked;

  return (
    <div className={`rounded-lg border border-slate-200 bg-white ${locked ? 'opacity-60' : ''}`}>
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-slate-500" />
          <span className="text-[10px] tracking-[0.14em] text-slate-500 uppercase">3-way match</span>
          <span className={`text-[11px] px-2 py-0.5 rounded border font-semibold ${vcfg.bg} ${vcfg.text} ${vcfg.border}`}>{vcfg.label}</span>
          {isOverridden && (
            <span className="text-[11px] px-2 py-0.5 rounded border font-semibold bg-amber-50 text-amber-700 border-amber-200">Overridden</span>
          )}
          {state.closure.isClosed && (
            <span className="text-[11px] px-2 py-0.5 rounded border font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">Closed</span>
          )}
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Reconciliation table */}
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500">
                {['Item', 'Ordered', 'Received', 'Billed', 'Rcvd value', 'Status'].map((h) => (
                  <th key={h} className="px-2.5 py-1.5 text-left text-[10px] font-bold uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.match.lines.map((ln, i) => {
                const lc = PO_MATCH_LINE_CONFIG[ln.verdict as PoMatchLineVerdict];
                return (
                  <tr key={`${ln.code}-${i}`}>
                    <td className="px-2.5 py-1.5">
                      <div className="font-medium text-slate-800">{ln.name}</div>
                      <div className="text-[9.5px] text-slate-400 font-mono">{ln.code}{ln.unit ? ` · ${ln.unit}` : ''}</div>
                    </td>
                    <td className="px-2.5 py-1.5 tabular-nums">{qty(ln.orderedQty)}</td>
                    <td className="px-2.5 py-1.5 tabular-nums">{qty(ln.receivedQty)}</td>
                    <td className="px-2.5 py-1.5 tabular-nums">{qty(ln.billedQty)}</td>
                    <td className="px-2.5 py-1.5 tabular-nums">{inr(ln.receivedValue)}</td>
                    <td className="px-2.5 py-1.5">
                      <span className={`inline-flex px-1.5 py-0.5 rounded border text-[9.5px] font-semibold ${lc.bg} ${lc.text} ${lc.border}`}>{lc.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          <div className="rounded-md border border-slate-200 px-2.5 py-1.5"><div className="text-slate-400">PO total</div><div className="font-semibold text-slate-800 tabular-nums">{inr(t.poTotal)}</div></div>
          <div className="rounded-md border border-slate-200 px-2.5 py-1.5"><div className="text-slate-400">Received payable</div><div className="font-semibold text-slate-800 tabular-nums">{inr(t.receivedPayable)}</div></div>
          <div className="rounded-md border border-slate-200 px-2.5 py-1.5"><div className="text-slate-400">Invoice</div><div className="font-semibold text-slate-800 tabular-nums">{inr(t.invoiceAmount)}</div></div>
          <div className={`rounded-md border px-2.5 py-1.5 ${t.amountOk ? 'border-slate-200' : 'border-red-200 bg-red-50'}`}>
            <div className="text-slate-400">Amount variance</div>
            <div className={`font-semibold tabular-nums ${t.amountOk ? 'text-slate-800' : 'text-red-700'}`}>{t.invoiceAmount == null ? '—' : `${t.amountVariancePct > 0 ? '+' : ''}${t.amountVariancePct}%`}</div>
          </div>
        </div>

        {/* Closed summary short-circuits the action area */}
        {state.closure.isClosed ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800 flex items-center gap-2">
            <Archive className="h-4 w-4 shrink-0" />
            PO closed on {fmtDate(state.closure.closedAt)}.
            {state.payment.isPaid ? ` Paid ${inr(state.payment.finalPaidAmount)}${state.payment.transactionDate ? ` on ${fmtDate(state.payment.transactionDate)}` : ''}.` : ' Payment pending per terms.'}
          </div>
        ) : (
          <>
            {/* Invoice capture */}
            <div className="rounded-md border border-slate-200 px-3 py-2.5 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600"><FileText className="h-3.5 w-3.5" /> Vendor invoice</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <input value={invNo} onChange={(e) => setInvNo(e.target.value)} placeholder="Invoice no." className="rounded-md border border-slate-300 px-2 py-1.5 text-[12px]" />
                <input type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-[12px]" />
                <input value={invAmount} onChange={(e) => setInvAmount(e.target.value)} inputMode="decimal" placeholder="Amount (incl. GST)" className="rounded-md border border-slate-300 px-2 py-1.5 text-[12px]" />
              </div>
              <button
                type="button"
                disabled={actionsDisabled || !(Number(invAmount) > 0)}
                onClick={() => run(() => captureInvoice(poId, { invoiceNo: invNo.trim() || undefined, invoiceDate: invDate || undefined, invoiceAmount: Number(invAmount) }), 'invoice', 'Invoice captured — match recomputed.')}
                className={`${btnBase} bg-blue-600 text-white hover:bg-blue-700`}
              >
                {busy === 'invoice' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                {state.hasInvoice ? 'Update Invoice' : 'Capture Invoice'}
              </button>
            </div>

            {/* Variance → override */}
            {state.hasInvoice && verdict === 'variance' && !isOverridden && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-700"><AlertTriangle className="h-3.5 w-3.5" /> Match variance — payment &amp; close are blocked</div>
                <p className="text-[11px] text-red-700">Fix the invoice/GRN, or override with a justification to proceed.</p>
                <input value={overrideNote} onChange={(e) => setOverrideNote(e.target.value)} placeholder="Justification (required to override)…" className="w-full rounded-md border border-red-300 px-2 py-1.5 text-[12px]" />
                <button
                  type="button"
                  disabled={actionsDisabled || !overrideNote.trim()}
                  onClick={() => run(() => overrideMatch(poId, overrideNote.trim()), 'override', 'Variance overridden.')}
                  className={`${btnBase} bg-white text-red-700 border border-red-300 hover:bg-red-100`}
                >
                  {busy === 'override' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                  Override variance
                </button>
              </div>
            )}

            {/* Match cleared → payment + close */}
            {state.matchCleared && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 space-y-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800"><CheckCircle2 className="h-3.5 w-3.5" /> Match cleared — pay via Treasury &amp; close</div>

                {/* Treasury linkage (Flowchart Sub-flow I → Treasury outward) */}
                {state.sentToTreasury && state.treasury ? (
                  <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-[12px] text-indigo-800 flex items-center gap-2 flex-wrap">
                    <Landmark className="h-4 w-4 shrink-0" />
                    <span>Sent to Treasury · <span className="font-mono font-bold">{state.treasury.outwardCode}</span></span>
                    <span className="px-1.5 py-0.5 rounded border border-indigo-200 bg-white text-[10px] font-semibold uppercase tracking-wide">{state.treasury.status}</span>
                    {state.treasury.utr && <span className="text-[11px]">UTR {state.treasury.utr}</span>}
                  </div>
                ) : !state.payment.isPaid ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={actionsDisabled || !state.canSendToTreasury}
                      onClick={() => run(() => sendPoToTreasury(poId), 'treasury', 'Payable sent to Treasury.')}
                      className={`${btnBase} bg-indigo-600 text-white hover:bg-indigo-700`}
                    >
                      {busy === 'treasury' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Landmark className="h-3.5 w-3.5" />}
                      Send to Treasury
                    </button>
                    <span className="text-[10px] text-slate-500">Treasury runs the cash-flow gate + approval; the PO is stamped paid on execution.</span>
                  </div>
                ) : null}

                {state.payment.isPaid ? (
                  <div className="text-[12px] text-emerald-800 flex items-center gap-1.5">
                    <IndianRupee className="h-3.5 w-3.5" /> Paid {inr(state.payment.finalPaidAmount)} via {state.payment.mode?.toUpperCase()}{state.payment.transactionNo ? ` · ${state.payment.transactionNo}` : ''}{state.payment.transactionDate ? ` · ${fmtDate(state.payment.transactionDate)}` : ''}.
                  </div>
                ) : !state.sentToTreasury ? (
                  <div className="space-y-1">
                    <div className="text-[10px] text-slate-500">Or record a payment made outside Treasury:</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <select value={payMode} onChange={(e) => setPayMode(e.target.value as PoPaymentMode)} className="rounded-md border border-slate-300 px-2 py-1.5 text-[12px]">
                        {PO_PAYMENT_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <input value={payTxn} onChange={(e) => setPayTxn(e.target.value)} placeholder="UTR / ref" className="rounded-md border border-slate-300 px-2 py-1.5 text-[12px]" />
                      <input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} inputMode="decimal" placeholder={`Amount (${t.invoiceAmount ?? ''})`} className="rounded-md border border-slate-300 px-2 py-1.5 text-[12px]" />
                      <button
                        type="button"
                        disabled={actionsDisabled || !state.canPay}
                        onClick={() => run(() => recordFinalPayment(poId, { mode: payMode, transactionNo: payTxn.trim() || undefined, amount: Number(payAmount) > 0 ? Number(payAmount) : undefined }), 'pay', 'Payment recorded.')}
                        className={`${btnBase} bg-emerald-600 text-white hover:bg-emerald-700 justify-center`}
                      >
                        {busy === 'pay' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <IndianRupee className="h-3.5 w-3.5" />}
                        Record Payment
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-emerald-200/70">
                  <input value={closeNote} onChange={(e) => setCloseNote(e.target.value)} placeholder="Closure note (optional)…" className="flex-1 min-w-[160px] rounded-md border border-slate-300 px-2 py-1.5 text-[12px]" />
                  <button
                    type="button"
                    disabled={actionsDisabled || !state.canClose}
                    onClick={() => run(() => closePo(poId, closeNote.trim() || undefined), 'close', 'PO closed.')}
                    className={`${btnBase} bg-slate-800 text-white hover:bg-slate-900`}
                  >
                    {busy === 'close' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                    Close PO
                  </button>
                </div>
                {!state.payment.isPaid && (
                  <p className="text-[10px] text-slate-500">Net terms? You can close now and pay later — payment is recorded independently.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PoMatchPanel;
