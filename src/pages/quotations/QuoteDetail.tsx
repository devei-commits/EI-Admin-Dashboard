/**
 * Quote Detail — full breakdown of a saved quote + PDF export.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileText, ArrowLeft, Download, Mail, Pencil, Loader2, ChevronDown, X, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, FormField, inputClassName } from '../../components/ui';
import * as quotesApi from '../../services/quotations.service';
import type { SavedQuoteFull } from '../../services/quotations.service';
import { generateQuotePdf } from '../../lib/quotePdf';
import { statusBadge, NEXT_ACTIONS, type Action } from './quoteStatus';

const f2 = (n: number | null | undefined) => (n == null ? '—' : Number(n).toFixed(2));
const pct = (n: number | null | undefined) => (n == null ? '—' : (Number(n) * 100).toFixed(1) + '%');

export default function QuoteDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [quote, setQuote] = useState<SavedQuoteFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (pdfRef.current && !pdfRef.current.contains(e.target as Node)) setPdfOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    if (!id) return;
    quotesApi.fetchSavedQuote(Number(id)).then((r) => {
      setLoading(false);
      if (r.success && r.data) setQuote(r.data);
      else toast.error(r.error ? String(r.error) : 'Failed to load quote');
    });
  }, [id]);

  const emailStub = () => toast.info('Email delivery is coming soon.');

  const downloadPdf = (variant: 'client' | 'internal') => { if (quote) generateQuotePdf(quote, variant); setPdfOpen(false); };

  if (loading) return <div className="p-12 text-center"><Loader2 className="w-6 h-6 mx-auto text-slate-400 animate-spin" /></div>;
  if (!quote) return <div className="p-12 text-center text-gray-500">Quote not found.</div>;

  const r = quote.result;
  const meta = [quote.customer_name && `Customer: ${quote.customer_name}`, r.bom_code && `BOM: ${r.bom_code}`, r.pack_size && `Pack: ${r.pack_size}`, r.grade_name].filter(Boolean).join('  ·  ');

  return (
    <div className="space-y-6">
      <PageHeader
        title={quote.quote_ref}
        subtitle={quote.quote_name}
        icon={<FileText className="w-6 h-6" />}
        actions={
          <>
            <button onClick={() => navigate('/quotations')} className="inline-flex items-center gap-2 px-3.5 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all text-sm font-medium"><ArrowLeft className="w-4 h-4" /> Back</button>
            <button onClick={() => navigate(`/quotations/${quote.id}/edit`)} className="inline-flex items-center gap-2 px-3.5 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all text-sm font-medium"><Pencil className="w-4 h-4" /> Edit</button>
            <button onClick={emailStub} className="inline-flex items-center gap-2 px-3.5 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all text-sm font-medium"><Mail className="w-4 h-4" /> Email</button>
            <div ref={pdfRef} className="relative">
              <button onClick={() => setPdfOpen((o) => !o)} className="inline-flex items-center gap-2 px-3.5 py-2 bg-white text-slate-800 rounded-lg hover:bg-gray-100 transition-all text-sm font-semibold"><Download className="w-4 h-4" /> PDF <ChevronDown className="w-3.5 h-3.5" /></button>
              {pdfOpen && (
                <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-30 overflow-hidden">
                  <button onClick={() => downloadPdf('client')} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-slate-50">Client PDF <span className="block text-xs text-gray-400">price + delivery</span></button>
                  <button onClick={() => downloadPdf('internal')} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-slate-50 border-t border-gray-50">Internal PDF <span className="block text-xs text-gray-400">full cost breakdown</span></button>
                </div>
              )}
            </div>
          </>
        }
      />

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
        <p className="text-sm text-gray-500">{meta}</p>
        {quote.notes && <p className="text-sm text-gray-600 mt-2">{quote.notes}</p>}
      </div>

      {/* Status & approvals */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Status</span>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(quote.status).cls}`}>{statusBadge(quote.status).label}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(NEXT_ACTIONS[quote.status] || []).map((a) => (
              <button key={a.to} onClick={() => setPendingAction(a)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  a.variant === 'primary' ? 'bg-slate-800 text-white hover:bg-slate-900'
                    : a.variant === 'danger' ? 'bg-red-50 text-red-600 hover:bg-red-100'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {a.label}
              </button>
            ))}
            {(NEXT_ACTIONS[quote.status] || []).length === 0 && <span className="text-sm text-gray-400">No further actions</span>}
          </div>
        </div>
        {quote.status_history.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2"><Clock className="w-3.5 h-3.5" /> History</div>
            <ul className="space-y-1.5">
              {quote.status_history.slice().reverse().map((h, i) => (
                <li key={i} className="text-sm text-gray-600 flex flex-wrap gap-x-2">
                  <span className="text-gray-400">{new Date(h.at).toLocaleString()}</span>
                  <span><span className="text-gray-500">{statusBadge(h.from).label}</span> → <span className="font-medium text-slate-800">{statusBadge(h.to).label}</span></span>
                  {h.by_name && <span className="text-gray-400">by {h.by_name}</span>}
                  {h.note && <span className="text-gray-500 italic">“{h.note}”</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Pricing */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Pricing — 7 MOQ Bands</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
              <th className="py-3 px-4">MOQ</th><th className="py-3 px-3 text-right">RM</th><th className="py-3 px-3 text-right">PM</th><th className="py-3 px-3 text-right">Conv.</th>
              <th className="py-3 px-3 text-right">OH</th><th className="py-3 px-3 text-right">Cost</th><th className="py-3 px-3 text-right">Markup</th>
              <th className="py-3 px-3 text-right">Margin</th><th className="py-3 px-4 text-right">Sell ₹</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {r.bands.map((b) => (
                <tr key={b.moqv} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-4 font-medium text-slate-900">{b.moq}</td>
                  <td className="py-2.5 px-3 text-right text-gray-600">{f2(b.rm)}</td>
                  <td className="py-2.5 px-3 text-right text-gray-600">{f2(b.pm)}</td>
                  <td className="py-2.5 px-3 text-right text-gray-600">{f2(b.conversion)}</td>
                  <td className="py-2.5 px-3 text-right text-gray-600">{f2(b.overhead)}</td>
                  <td className="py-2.5 px-3 text-right text-gray-700">{f2(b.total_cost)}</td>
                  <td className="py-2.5 px-3 text-right text-gray-500">{pct(b.markup_pct)}</td>
                  <td className="py-2.5 px-3 text-right text-gray-500">{pct(b.gross_margin_pct)}</td>
                  <td className="py-2.5 px-4 text-right font-semibold text-slate-900">{f2(b.sell_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Delivery Timeline (days)</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
              <th className="py-3 px-4">MOQ</th><th className="py-3 px-3 text-right">Procurement</th><th className="py-3 px-3 text-right">Manufacturing</th>
              <th className="py-3 px-3 text-right">QC</th><th className="py-3 px-3 text-right">Dispatch</th><th className="py-3 px-3 text-right">Total</th><th className="py-3 px-4 text-right">Weeks</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {r.bands.map((b) => (
                <tr key={b.moqv} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-4 font-medium text-slate-900">{b.moq}</td>
                  <td className="py-2.5 px-3 text-right text-gray-600">{b.timeline.procurement}</td>
                  <td className="py-2.5 px-3 text-right text-gray-600">{b.timeline.manufacturing}</td>
                  <td className="py-2.5 px-3 text-right text-gray-600">{b.timeline.qc}</td>
                  <td className="py-2.5 px-3 text-right text-gray-600">{b.timeline.dispatch}</td>
                  <td className="py-2.5 px-3 text-right text-gray-700 font-medium">{b.timeline.total}</td>
                  <td className="py-2.5 px-4 text-right font-semibold text-slate-900">{b.timeline.weeks}w</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pendingAction && (
        <StatusModal action={pendingAction} quoteRef={quote.quote_ref} onClose={() => setPendingAction(null)}
          onDone={(updated) => { setPendingAction(null); setQuote((q) => q ? { ...q, status: updated.status, status_history: updated.status_history } : q); }} quoteId={quote.id} />
      )}
    </div>
  );
}

function StatusModal({ action, quoteId, quoteRef, onClose, onDone }: { action: Action; quoteId: number; quoteRef: string; onClose: () => void; onDone: (u: { status: string; status_history: quotesApi.StatusEvent[] }) => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const r = await quotesApi.changeQuoteStatus(quoteId, action.to, note || undefined);
    setBusy(false);
    if (r.success && r.data) { toast.success(`${quoteRef} → ${action.label}`); onDone(r.data); }
    else toast.error(r.error ? String(r.error) : 'Failed to change status');
  };
  return (
    <div className="fixed inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-5 border-b border-gray-200"><h2 className="text-lg font-bold text-slate-900">{action.label}</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button></div>
        <div className="p-5">
          <FormField label="Note (optional)"><textarea className={inputClassName} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason or comment for the audit trail…" /></FormField>
        </div>
        <div className="p-5 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">Cancel</button>
          <button onClick={submit} disabled={busy} className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 ${action.variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-800 text-white hover:bg-slate-900'}`}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} {action.label}</button>
        </div>
      </div>
    </div>
  );
}
