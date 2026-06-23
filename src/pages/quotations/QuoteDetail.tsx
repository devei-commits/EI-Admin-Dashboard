/**
 * Quote Detail — full breakdown of a saved quote + PDF export.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileText, ArrowLeft, Download, Mail, Pencil, Loader2, ChevronDown, X, Clock, ShoppingCart, GitBranch, AlertTriangle, ReceiptText, ExternalLink, ClipboardCheck, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, FormField, inputClassName } from '../../components/ui';
import * as quotesApi from '../../services/quotations.service';
import type { SavedQuoteFull, SavedQuoteListItem, QuoteActuals } from '../../services/quotations.service';
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
  const [convertOpen, setConvertOpen] = useState(false);
  const [clientQuotes, setClientQuotes] = useState<SavedQuoteListItem[]>([]);
  const [versions, setVersions] = useState<quotesApi.VersionItem[]>([]);
  const [preQuote, setPreQuote] = useState<quotesApi.SavedQuoteListItem | null>(null);
  const [preBands, setPreBands] = useState<Array<{ rm: number; pm: number; conversion: number; overhead: number; moq: string; moqv: number; total_cost: number }> | null>(null);
  const [actuals, setActuals] = useState<QuoteActuals[]>([]);
  const [actualsOpen, setActualsOpen] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!quote?.id) return;
    quotesApi.fetchVersions(quote.id).then((r) => { if (r.success && r.data) setVersions(r.data); });
  }, [quote?.id, quote?.superseded_by]);

  useEffect(() => {
    const pid = quote?.pre_quote_id;
    if (!pid) { setPreQuote(null); return; }
    quotesApi.fetchSavedQuote(pid).then((r) => {
      if (r.success && r.data) {
        setPreQuote(r.data);
        const fullData = r.data as unknown as SavedQuoteFull;
        setPreBands(fullData.result?.bands || null);
      }
    });
  }, [quote?.pre_quote_id]);

  useEffect(() => {
    if (!quote?.id) return;
    quotesApi.fetchActualsByQuote(quote.id).then((r) => { if (r.success) setActuals(r.data); });
  }, [quote?.id]);

  const doRevise = async () => {
    if (!quote) return;
    const r = await quotesApi.reviseQuote(quote.id);
    if (r.success && r.data) { toast.success(`Created v${r.data.version} · ${r.data.quote_ref}`); navigate(`/quotations/${r.data.id}`); }
    else toast.error(r.error ? String(r.error) : 'Failed to revise');
  };

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

  useEffect(() => {
    const cid = quote?.client_id;
    if (!cid) { setClientQuotes([]); return; }
    quotesApi.fetchSavedQuotes('', 20, 0, undefined, cid).then((r) => {
      if (r.success && r.data) setClientQuotes(r.data.quotes.filter((q) => q.id !== quote?.id));
    });
  }, [quote?.client_id, quote?.id]);

  const emailStub = () => toast.info('Email delivery is coming soon.');

  const downloadPdf = (variant: 'client' | 'internal') => { if (quote) generateQuotePdf(quote, variant); setPdfOpen(false); };

  if (loading) return (
    <div className="pt-4 md:pt-6 space-y-6 animate-pulse">
      <div className="h-20 bg-slate-200 rounded-xl" />
      <div className="h-16 bg-white rounded-lg border border-gray-100 shadow-sm" />
      <div className="h-44 bg-white rounded-lg border border-gray-100 shadow-sm" />
      <div className="h-64 bg-white rounded-lg border border-gray-100 shadow-sm" />
    </div>
  );
  if (!quote) return <div className="pt-4 md:pt-6"><div className="bg-white rounded-lg shadow-sm border border-gray-100 p-16 text-center text-gray-500">Quote not found.</div></div>;

  const r = quote.result;
  const meta = [quote.customer_name && `Customer: ${quote.customer_name}`, r.bom_code && `BOM: ${r.bom_code}`, r.pack_size && `Pack: ${r.pack_size}`, r.grade_name].filter(Boolean).join('  ·  ');

  return (
    <div className="pt-4 md:pt-6 space-y-6">
      <PageHeader
        title={quote.quote_ref}
        subtitle={quote.quote_name}
        icon={<FileText className="w-6 h-6" />}
        actions={
          <>
            <button onClick={() => navigate('/quotations')} className="inline-flex items-center gap-2 px-3.5 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all text-sm font-medium"><ArrowLeft className="w-4 h-4" /> Back</button>
            <button onClick={() => navigate(`/quotations/${quote.id}/edit`)} className="inline-flex items-center gap-2 px-3.5 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all text-sm font-medium"><Pencil className="w-4 h-4" /> Edit</button>
            {!quote.superseded_by && <button onClick={doRevise} className="inline-flex items-center gap-2 px-3.5 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all text-sm font-medium"><GitBranch className="w-4 h-4" /> Revise</button>}
            {quote.quote_category !== 'post_production' && !quote.superseded_by && (
              <button onClick={() => navigate(`/quotations/new?fromQuoteId=${quote.id}`)} className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all text-sm font-semibold"><ReceiptText className="w-4 h-4" /> Post-Production Bill</button>
            )}
            {quote.quote_category === 'post_production' && (
              <button onClick={() => setActualsOpen(true)} className="inline-flex items-center gap-2 px-3.5 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-all text-sm font-semibold"><ClipboardCheck className="w-4 h-4" /> {actuals.length > 0 ? 'Edit Actuals' : 'Enter Actuals'}</button>
            )}
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

      {quote.superseded_by && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <span className="text-sm text-amber-800 flex-1">This quote has been superseded by a newer version.</span>
          <button onClick={() => navigate(`/quotations/${quote.superseded_by}`)} className="text-sm font-semibold text-amber-700 hover:underline">View newer version →</button>
        </div>
      )}
      {quote.price_warnings && quote.price_warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-sm font-semibold text-amber-800">{quote.price_warnings.length} price change{quote.price_warnings.length !== 1 ? 's' : ''} since this quote was saved</span>
            </div>
            <button onClick={() => navigate(`/quotations/${quote.id}/edit`)} className="text-sm font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1 rounded-lg">Open to recalculate →</button>
          </div>
          <ul className="ml-6 space-y-0.5">
            {quote.price_warnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-700">
                <span className="font-medium">{w.name}</span> ({w.type}): ₹{w.was.toFixed(2)} → ₹{w.now.toFixed(2)}
                <span className={`ml-1 font-semibold ${w.pct_change > 0 ? 'text-red-600' : 'text-emerald-600'}`}>({w.pct_change > 0 ? '+' : ''}{w.pct_change.toFixed(1)}%)</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {quote.quote_type && quote.quote_type !== 'full' && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${quote.quote_type === 'rm_only' ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'}`}>{quote.quote_type === 'rm_only' ? 'RM Only' : 'PM Only'}</span>
          )}
          {quote.quote_category === 'post_production' ? (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Post-Production Actual</span>
          ) : (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">Pre-Production Estimate</span>
          )}
          {quote.job_ref && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{quote.job_ref}</span>}
          {quote.version > 1 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">v{quote.version}</span>}
          {quote.client_id && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">linked client</span>}
          {quote.bom_code && (
            <button onClick={() => navigate(`/quotations/bom/${quote.bom_code}`)} className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-full transition-colors">
              BOM Hub <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500">{meta}</p>
        {quote.notes && <p className="text-sm text-gray-600 mt-2">{quote.notes}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          {quote.result?.batch_yield_pct != null && quote.result.batch_yield_pct < 100 && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Yield: {quote.result.batch_yield_pct}%</span>
          )}
          {quote.result?.effective_rm_wastage_pct != null && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              RM Wastage: {Number(quote.result.effective_rm_wastage_pct).toFixed(1)}%
            </span>
          )}
          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
            Prices locked {new Date(quote.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>

      {preQuote && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-center gap-3">
          <FileText className="w-4 h-4 text-blue-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-blue-500 font-medium uppercase tracking-wider mb-0.5">Linked Pre-Production Estimate</p>
            <p className="text-sm font-semibold text-slate-900 truncate">{preQuote.quote_ref} · {preQuote.quote_name}</p>
            {preQuote.headline_sell != null && quote.result?.bands?.[3]?.sell_price != null && (
              <p className="text-xs text-gray-600 mt-0.5">
                Pre-prod sell: ₹{Number(preQuote.headline_sell).toFixed(2)} → Post-prod: ₹{Number(quote.result.bands[3].sell_price).toFixed(2)}
                {' '}<span className={`font-semibold ${quote.result.bands[3].sell_price > preQuote.headline_sell ? 'text-red-600' : 'text-emerald-600'}`}>
                  ({quote.result.bands[3].sell_price > preQuote.headline_sell ? '+' : ''}{((quote.result.bands[3].sell_price - Number(preQuote.headline_sell)) / Number(preQuote.headline_sell) * 100).toFixed(1)}%)
                </span>
              </p>
            )}
          </div>
          <button onClick={() => navigate(`/quotations/${preQuote.id}`)} className="text-blue-600 hover:text-blue-700 text-sm font-medium shrink-0">View →</button>
        </div>
      )}

      {versions.length > 1 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3"><GitBranch className="w-4 h-4" /> Revision History ({versions.length})</div>
          <ul className="divide-y divide-gray-50">
            {versions.map((v) => (
              <li key={v.id}>
                <button onClick={() => v.id !== quote.id && navigate(`/quotations/${v.id}`)} className={`w-full text-left py-2 flex items-center gap-3 rounded-lg px-2 -mx-2 ${v.id === quote.id ? 'bg-slate-50' : 'hover:bg-slate-50/50'}`}>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">v{v.version}</span>
                  <span className="font-medium text-slate-900 text-sm">{v.quote_ref}</span>
                  {v.id === quote.id && <span className="text-xs text-slate-500">(viewing)</span>}
                  {!v.superseded_by && <span className="text-xs text-emerald-600 font-medium">current</span>}
                  <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(v.status).cls}`}>{statusBadge(v.status).label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {quote.client_id && clientQuotes.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Other quotes from this client ({clientQuotes.length})</h3>
          <ul className="divide-y divide-gray-50">
            {clientQuotes.map((q) => (
              <li key={q.id}>
                <button onClick={() => navigate(`/quotations/${q.id}`)} className="w-full text-left py-2 flex items-center gap-3 hover:bg-slate-50/50 rounded-lg px-2 -mx-2">
                  <span className="font-medium text-slate-900 text-sm">{q.quote_ref}</span>
                  <span className="text-sm text-gray-600 flex-1 truncate">{q.quote_name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(q.status).cls}`}>{statusBadge(q.status).label}</span>
                  <span className="text-sm text-gray-500 w-20 text-right">{q.headline_sell != null ? `₹${Number(q.headline_sell).toFixed(2)}` : '—'}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

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

      {/* Sales Order */}
      {(quote.status === 'accepted' || quote.sales_order_ref) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <span className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Sales Order</span>
            {quote.sales_order_ref ? (
              <span className="inline-flex items-center gap-2 text-sm"><span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">{quote.sales_order_ref}</span><span className="text-gray-400">created from this quote</span></span>
            ) : (
              <button onClick={() => setConvertOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900"><ShoppingCart className="w-4 h-4" /> Convert to Sales Order</button>
            )}
          </div>
        </div>
      )}

      {actuals.length > 0 && (
        <ActualsCard
          actuals={actuals[0]}
          onEdit={() => setActualsOpen(true)}
          onDelete={async () => {
            if (!actuals[0] || !confirm('Delete actuals for this quote?')) return;
            const r = await quotesApi.deleteActuals(actuals[0].id);
            if (r.success) { setActuals([]); toast.success('Actuals deleted'); }
            else toast.error(r.error ?? 'Delete failed');
          }}
        />
      )}

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
      {actualsOpen && quote && (
        <ActualsModal
          quote={quote}
          existing={actuals[0] || null}
          preBands={preBands}
          onClose={() => setActualsOpen(false)}
          onSaved={(a) => { setActuals([a]); setActualsOpen(false); toast.success('Actuals saved'); }}
        />
      )}
      {convertOpen && (
        <ConvertModal quote={quote} onClose={() => setConvertOpen(false)}
          onDone={(ref) => { setConvertOpen(false); setQuote((q) => q ? { ...q, sales_order_ref: ref } : q); }} />
      )}
    </div>
  );
}

function ActualsCard({ actuals: a, onEdit, onDelete }: { actuals: QuoteActuals; onEdit: () => void; onDelete: () => void }) {
  const rows: { label: string; key: keyof QuoteActuals['variance'] }[] = [
    { label: 'Raw Materials', key: 'rm' },
    { label: 'Pack Materials', key: 'pm' },
    { label: 'Conversion', key: 'conversion' },
    { label: 'Overhead', key: 'overhead' },
    { label: 'Total Cost', key: 'total' },
  ];
  const fmt = (n: number | null | undefined) => n == null ? '—' : `₹${Number(n).toFixed(2)}`;
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Production Actuals vs Estimate</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {a.batch_size != null && `Batch: ${a.batch_size.toLocaleString()} units · `}
            {a.yield_pct != null && `Yield: ${a.yield_pct}% · `}
            Entered {new Date(a.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            {a.entered_by_name && ` by ${a.entered_by_name}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onEdit} className="text-sm text-slate-600 hover:text-slate-900 font-medium">Edit →</button>
          <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/40">
            <th className="py-2.5 px-4">Component</th>
            <th className="py-2.5 px-3 text-right">Estimated</th>
            <th className="py-2.5 px-3 text-right">Actual</th>
            <th className="py-2.5 px-3 text-right">Variance ₹</th>
            <th className="py-2.5 px-3 text-right">Variance %</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map(({ label, key }) => {
              const estKey = `est_${key}` as keyof QuoteActuals;
              const actKey = `actual_${key === 'total' ? 'total' : key}` as keyof QuoteActuals;
              const v = a.variance[key];
              const isTotalRow = key === 'total';
              const isPositive = v && v.diff > 0.005;
              const isNegative = v && v.diff < -0.005;
              return (
                <tr key={key} className={`${isTotalRow ? 'bg-gray-50/60 font-semibold' : 'hover:bg-slate-50/40'}`}>
                  <td className="py-2.5 px-4 text-slate-700">{label}</td>
                  <td className="py-2.5 px-3 text-right text-gray-500">{fmt(a[estKey] as number)}</td>
                  <td className="py-2.5 px-3 text-right text-slate-900">{fmt(a[actKey] as number)}</td>
                  <td className={`py-2.5 px-3 text-right ${isPositive ? 'text-red-600' : isNegative ? 'text-emerald-600' : 'text-gray-500'}`}>
                    {v ? `${v.diff > 0 ? '+' : ''}₹${Math.abs(v.diff).toFixed(2)}` : '—'}
                  </td>
                  <td className={`py-2.5 px-3 text-right ${isPositive ? 'text-red-600' : isNegative ? 'text-emerald-600' : 'text-gray-400'}`}>
                    <span className="inline-flex items-center gap-1">
                      {isPositive ? <TrendingUp className="w-3 h-3" /> : isNegative ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                      {v?.pct != null ? `${v.pct > 0 ? '+' : ''}${v.pct.toFixed(1)}%` : '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {a.notes && <div className="px-5 py-3 border-t border-gray-50 text-sm text-gray-500 italic">{a.notes}</div>}
    </div>
  );
}

function ActualsModal({ quote, existing, preBands, onClose, onSaved }: { quote: SavedQuoteFull; existing: QuoteActuals | null; preBands?: Array<{ rm: number; pm: number; conversion: number; overhead: number; moq: string; moqv: number; total_cost: number }> | null; onClose: () => void; onSaved: (a: QuoteActuals) => void }) {
  const bands = quote.result?.bands || [];
  const sourceBands = preBands && preBands.length > 0 ? preBands : bands;
  const defaultBand = sourceBands[Math.min(3, sourceBands.length - 1)];

  const [batchSize, setBatchSize] = useState(String(existing?.batch_size ?? ''));
  const [yieldPct, setYieldPct] = useState(String(existing?.yield_pct ?? '100'));
  const [actRm, setActRm] = useState(String(existing?.actual_rm ?? defaultBand?.rm ?? ''));
  const [actPm, setActPm] = useState(String(existing?.actual_pm ?? defaultBand?.pm ?? ''));
  const [actConv, setActConv] = useState(String(existing?.actual_conversion ?? defaultBand?.conversion ?? ''));
  const [actOh, setActOh] = useState(String(existing?.actual_overhead ?? defaultBand?.overhead ?? ''));
  const [estRm, setEstRm] = useState(String(existing?.est_rm ?? defaultBand?.rm ?? ''));
  const [estPm, setEstPm] = useState(String(existing?.est_pm ?? defaultBand?.pm ?? ''));
  const [estConv, setEstConv] = useState(String(existing?.est_conversion ?? defaultBand?.conversion ?? ''));
  const [estOh, setEstOh] = useState(String(existing?.est_overhead ?? defaultBand?.overhead ?? ''));
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const pf = (s: string) => parseFloat(s) || 0;
  const actTotal = pf(actRm) + pf(actPm) + pf(actConv) + pf(actOh);
  const estTotal = pf(estRm) + pf(estPm) + pf(estConv) + pf(estOh);

  const varRow = (act: string, est: string) => {
    const a = pf(act), e = pf(est);
    const diff = a - e;
    const p = e !== 0 ? (diff / e) * 100 : null;
    return { diff, pct: p };
  };

  const pickBand = (i: number) => {
    const b = sourceBands[i];
    if (!b) return;
    setEstRm(String(b.rm)); setEstPm(String(b.pm)); setEstConv(String(b.conversion)); setEstOh(String(b.overhead));
    if (!existing) { setActRm(String(b.rm)); setActPm(String(b.pm)); setActConv(String(b.conversion)); setActOh(String(b.overhead)); }
  };

  const submit = async () => {
    setSaving(true);
    const payload = {
      bom_code: quote.bom_code || '', job_ref: quote.job_ref || null,
      pre_quote_id: quote.pre_quote_id || null, post_quote_id: quote.id,
      batch_size: batchSize ? parseInt(batchSize) : null,
      yield_pct: yieldPct ? parseFloat(yieldPct) : null,
      actual_rm: pf(actRm) || null, actual_pm: pf(actPm) || null,
      actual_conversion: pf(actConv) || null, actual_overhead: pf(actOh) || null,
      actual_total: actTotal || null,
      est_rm: pf(estRm) || null, est_pm: pf(estPm) || null,
      est_conversion: pf(estConv) || null, est_overhead: pf(estOh) || null,
      est_total: estTotal || null, notes: notes || null,
    };
    const r = existing
      ? await quotesApi.updateActuals(existing.id, payload)
      : await quotesApi.createActuals(payload as Parameters<typeof quotesApi.createActuals>[0]);
    setSaving(false);
    if (r.success && r.data) onSaved(r.data);
    else toast.error(r.error ? String(r.error) : 'Failed to save actuals');
  };

  const VarBadge = ({ act, est }: { act: string; est: string }) => {
    const { diff, pct: p } = varRow(act, est);
    if (!pf(act) && !pf(est)) return null;
    const cls = diff > 0.01 ? 'text-red-600' : diff < -0.01 ? 'text-emerald-600' : 'text-gray-400';
    return <span className={`text-xs font-semibold ${cls}`}>{diff > 0 ? '+' : ''}{diff.toFixed(2)}{p != null ? ` (${p > 0 ? '+' : ''}${p.toFixed(1)}%)` : ''}</span>;
  };

  return (
    <div className="fixed inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{existing ? 'Edit' : 'Enter'} Production Actuals</h2>
            <p className="text-xs text-gray-400 mt-0.5">{quote.quote_ref} · {quote.bom_code}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Actual Batch Size (units)">
              <input className={inputClassName} type="number" placeholder="e.g. 5000" value={batchSize} onChange={(e) => setBatchSize(e.target.value)} />
            </FormField>
            <FormField label="Actual Yield %">
              <input className={inputClassName} type="number" step="0.1" min="0" max="100" value={yieldPct} onChange={(e) => setYieldPct(e.target.value)} />
            </FormField>
          </div>

          {sourceBands.length > 0 && (
            <FormField label={preBands && preBands.length > 0 && !existing ? 'Pick MOQ band (from pre-production estimate)' : 'Pick MOQ band to update estimate fields'}>
              {preBands && preBands.length > 0 && !existing && (
                <p className="text-xs text-violet-600 mb-1.5">Estimates pre-filled from linked pre-production quote</p>
              )}
              <select className={inputClassName} onChange={(e) => pickBand(Number(e.target.value))} defaultValue={Math.min(3, sourceBands.length - 1)}>
                {sourceBands.map((b, i) => <option key={b.moqv} value={i}>{b.moq} — Total cost ₹{b.total_cost.toFixed(2)}</option>)}
              </select>
            </FormField>
          )}

          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cost per Unit (₹)</p>
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="text-xs font-semibold text-gray-400 uppercase border-b border-gray-100 bg-gray-50/60">
                  <th className="py-2 px-3 text-left">Component</th>
                  <th className="py-2 px-3 text-center">Estimated</th>
                  <th className="py-2 px-3 text-center">Actual</th>
                  <th className="py-2 px-3 text-right">Variance</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { label: 'Raw Materials (RM)', act: actRm, setAct: setActRm, est: estRm, setEst: setEstRm },
                    { label: 'Pack Materials (PM)', act: actPm, setAct: setActPm, est: estPm, setEst: setEstPm },
                    { label: 'Conversion / Filling', act: actConv, setAct: setActConv, est: estConv, setEst: setEstConv },
                    { label: 'Overhead', act: actOh, setAct: setActOh, est: estOh, setEst: setEstOh },
                  ].map(({ label, act, setAct, est, setEst }) => (
                    <tr key={label}>
                      <td className="py-2 px-3 text-gray-700 font-medium w-40">{label}</td>
                      <td className="py-2 px-2"><input className={`${inputClassName} text-center text-sm py-1`} type="number" step="0.01" value={est} onChange={(e) => setEst(e.target.value)} /></td>
                      <td className="py-2 px-2"><input className={`${inputClassName} text-center text-sm py-1`} type="number" step="0.01" value={act} onChange={(e) => setAct(e.target.value)} /></td>
                      <td className="py-2 px-3 text-right"><VarBadge act={act} est={est} /></td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50/60 font-semibold">
                    <td className="py-2 px-3 text-slate-900">Total</td>
                    <td className="py-2 px-3 text-center text-gray-600">₹{estTotal.toFixed(2)}</td>
                    <td className="py-2 px-3 text-center text-slate-900">₹{actTotal.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right"><VarBadge act={String(actTotal)} est={String(estTotal)} /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <FormField label="Notes">
            <textarea className={inputClassName} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes about this production run…" />
          </FormField>
        </div>
        <div className="p-5 border-t border-gray-200 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">Cancel</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-semibold disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {existing ? 'Update' : 'Save'} Actuals
          </button>
        </div>
      </div>
    </div>
  );
}

function ConvertModal({ quote, onClose, onDone }: { quote: SavedQuoteFull; onClose: () => void; onDone: (ref: string) => void }) {
  const bands = quote.result.bands;
  const [bandIdx, setBandIdx] = useState(Math.min(3, bands.length - 1));
  const [qty, setQty] = useState(String(bands[Math.min(3, bands.length - 1)]?.moqv ?? ''));
  const [price, setPrice] = useState(String(bands[Math.min(3, bands.length - 1)]?.sell_price ?? ''));
  const [busy, setBusy] = useState(false);

  const pickBand = (i: number) => { setBandIdx(i); setQty(String(bands[i].moqv)); setPrice(String(bands[i].sell_price)); };
  const total = (Number(qty) || 0) * (Number(price) || 0);

  const submit = async () => {
    setBusy(true);
    const r = await quotesApi.convertQuoteToSO(quote.id, bandIdx, Number(qty), Number(price));
    setBusy(false);
    if (r.success && r.data) { toast.success(`Sales order ${r.data.order_id} created`); onDone(r.data.order_id); }
    else toast.error(r.error ? String(r.error) : 'Failed to convert');
  };

  return (
    <div className="fixed inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-5 border-b border-gray-200"><h2 className="text-lg font-bold text-slate-900">Convert to Sales Order</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button></div>
        <div className="p-5 space-y-4">
          <FormField label="MOQ Band">
            <select className={inputClassName} value={bandIdx} onChange={(e) => pickBand(Number(e.target.value))}>
              {bands.map((b, i) => <option key={b.moqv} value={i}>{b.moq} units @ ₹{b.sell_price.toFixed(2)}</option>)}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Quantity"><input className={inputClassName} type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></FormField>
            <FormField label="Unit Price ₹"><input className={inputClassName} type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></FormField>
          </div>
          <div className="bg-slate-50 rounded-lg px-4 py-3 flex justify-between text-sm"><span className="text-gray-500">Order total</span><span className="font-semibold text-slate-900">₹{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
        </div>
        <div className="p-5 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">Cancel</button>
          <button onClick={submit} disabled={busy || !(Number(qty) > 0)} className="inline-flex items-center gap-2 px-5 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 text-sm font-semibold disabled:opacity-50">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Create Sales Order</button>
        </div>
      </div>
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
