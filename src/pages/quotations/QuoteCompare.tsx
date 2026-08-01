/**
 * Quote Comparison — up to 4 saved quotes side by side: meta, per-band
 * sell price (best highlighted), margins, and delivery.
 */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GitCompare, ArrowLeft } from 'lucide-react';
import { PageHeader } from '../../components/ui';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import * as quotesApi from '../../services/quotations.service';
import type { SavedQuoteFull } from '../../services/quotations.service';
import { statusBadge } from './quoteStatus';

const f2 = (n: number | null | undefined) => (n == null ? '—' : Number(n).toFixed(2));

export default function QuoteCompare() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const ids = (params.get('ids') || '').split(',').map((x) => parseInt(x)).filter(Boolean).slice(0, 4);
  const [quotes, setQuotes] = useState<SavedQuoteFull[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all(ids.map((id) => quotesApi.fetchSavedQuote(id))).then((rs) => {
      setLoading(false);
      setQuotes(rs.filter((r) => r.success && r.data).map((r) => r.data as SavedQuoteFull));
    });
  }, [params]); // eslint-disable-line

  // best (lowest) sell price per band index across quotes
  const bestPerBand = (bi: number) => {
    const vals = quotes.map((q) => q.result.bands[bi]?.sell_price).filter((v): v is number => v != null);
    return vals.length ? Math.min(...vals) : null;
  };
  const avgMargin = (q: SavedQuoteFull) => {
    const ms = q.result.bands.map((b) => b.gross_margin_pct).filter((v) => v != null);
    return ms.length ? (ms.reduce((a, b) => a + b, 0) / ms.length) : null;
  };

  return (
    <div className="pt-4 md:pt-6 space-y-6">
      <PageHeader
        title="Compare Quotes"
        subtitle={`${quotes.length} quotes side by side`}
        icon={<GitCompare className="w-6 h-6" />}
        actions={<button onClick={() => navigate('/quotations')} className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all text-sm font-medium"><ArrowLeft className="w-4 h-4" /> Back</button>}
      />

      {loading ? <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4"><TableSkeleton rows={6} cols={4} /></div>
        : quotes.length < 2 ? <div className="bg-white rounded-lg shadow-sm border border-gray-100"><EmptyState icon={<GitCompare />} title="Select at least 2 quotes from the list to compare." /></div>
          : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th scope="col" className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">Metric</th>
                    {quotes.map((q) => (
                      <th scope="col" key={q.id} className="py-3 px-4 text-left min-w-[12rem]">
                        <button onClick={() => navigate(`/quotations/${q.id}`)} className="font-semibold text-slate-900 hover:underline">{q.quote_ref}</button>
                        <div className="text-xs text-gray-500 font-normal truncate max-w-[12rem]" title={q.quote_name}>{q.quote_name}</div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(q.status).cls}`}>{statusBadge(q.status).label}</span>
                          {q.version > 1 && <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">v{q.version}</span>}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  <Row label="Grade">{quotes.map((q) => <Cell key={q.id}>{q.result.grade_name}</Cell>)}</Row>
                  <Row label="Product type">{quotes.map((q) => <Cell key={q.id} className="capitalize">{q.result.product_type}</Cell>)}</Row>
                  <Row label="Avg margin">{quotes.map((q) => <Cell key={q.id}>{avgMargin(q) != null ? `${(avgMargin(q)! * 100).toFixed(1)}%` : '—'}</Cell>)}</Row>
                  <tr className="bg-gray-50"><td colSpan={quotes.length + 1} className="py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sell price per MOQ band (best highlighted)</td></tr>
                  {Array.from({ length: 7 }).map((_, bi) => {
                    const best = bestPerBand(bi);
                    return (
                      <Row key={bi} label={`Band ${bi + 1}`}>
                        {quotes.map((q) => {
                          const b = q.result.bands[bi];
                          const isBest = b && best != null && Math.abs(b.sell_price - best) < 0.001;
                          return <Cell key={q.id}>{b ? <span className={isBest ? 'font-bold text-emerald-700' : 'text-slate-800'}>₹{f2(b.sell_price)} <span className="text-gray-400 text-xs">({b.moq})</span></span> : '—'}</Cell>;
                        })}
                      </Row>
                    );
                  })}
                  <tr className="bg-gray-50"><td colSpan={quotes.length + 1} className="py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Delivery (weeks) per band</td></tr>
                  {Array.from({ length: 7 }).map((_, bi) => (
                    <Row key={`t${bi}`} label={`Band ${bi + 1}`}>
                      {quotes.map((q) => { const b = q.result.bands[bi]; return <Cell key={q.id}>{b ? `${b.timeline.weeks}w` : '—'}</Cell>; })}
                    </Row>
                  ))}
                </tbody>
              </table>
            </div>
          )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <tr className="hover:bg-slate-50/40"><td className="py-2.5 px-4 text-gray-500 font-medium">{label}</td>{children}</tr>;
}
function Cell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-2.5 px-4 text-gray-700 ${className}`}>{children}</td>;
}
