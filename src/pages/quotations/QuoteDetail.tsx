/**
 * Quote Detail — full breakdown of a saved quote + PDF export.
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileText, ArrowLeft, Download, Mail, Pencil, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../../components/ui';
import * as quotesApi from '../../services/quotations.service';
import type { SavedQuoteFull } from '../../services/quotations.service';
import { generateQuotePdf } from '../../lib/quotePdf';

const f2 = (n: number | null | undefined) => (n == null ? '—' : Number(n).toFixed(2));
const pct = (n: number | null | undefined) => (n == null ? '—' : (Number(n) * 100).toFixed(1) + '%');

export default function QuoteDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [quote, setQuote] = useState<SavedQuoteFull | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    quotesApi.fetchSavedQuote(Number(id)).then((r) => {
      setLoading(false);
      if (r.success && r.data) setQuote(r.data);
      else toast.error(r.error ? String(r.error) : 'Failed to load quote');
    });
  }, [id]);

  const emailStub = () => toast.info('Email delivery is coming soon.');

  if (loading) return <div className="p-12 text-center"><Loader2 className="w-6 h-6 mx-auto text-slate-400 animate-spin" /></div>;
  if (!quote) return <div className="p-12 text-center text-gray-500">Quote not found.</div>;

  const r = quote.result;
  const meta = [quote.customer_name && `Customer: ${quote.customer_name}`, r.bom_code && `BOM: ${r.bom_code}`, r.pack_size && `Pack: ${r.pack_size}`, r.grade_name].filter(Boolean).join('  ·  ');

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title={quote.quote_ref}
        subtitle={quote.quote_name}
        icon={<FileText className="w-6 h-6" />}
        actions={
          <>
            <button onClick={() => navigate('/quotations')} className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all text-sm font-medium"><ArrowLeft className="w-4 h-4" /> Back</button>
            <button onClick={() => navigate(`/quotations/${quote.id}/edit`)} className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all text-sm font-medium"><Pencil className="w-4 h-4" /> Edit</button>
            <button onClick={emailStub} className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all text-sm font-medium"><Mail className="w-4 h-4" /> Email</button>
            <button onClick={() => generateQuotePdf(quote)} className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-800 rounded-lg hover:bg-gray-100 transition-all text-sm font-semibold"><Download className="w-4 h-4" /> PDF</button>
          </>
        }
      />

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
        <p className="text-sm text-gray-500">{meta}</p>
        {quote.notes && <p className="text-sm text-gray-600 mt-2">{quote.notes}</p>}
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
    </div>
  );
}
