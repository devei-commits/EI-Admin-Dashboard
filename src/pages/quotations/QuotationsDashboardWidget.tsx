import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ClipboardCheck, AlertCircle, TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
import * as quotesApi from '../../services/quotations.service';
import type { QuoteDashboardStats } from '../../services/quotations.service';
import { CardSkeleton } from '../../components/ui/Skeleton';

export default function QuotationsDashboardWidget() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<QuoteDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    quotesApi.fetchQuoteDashboardStats().then((r) => {
      setLoading(false);
      if (r.success) setStats(r.data);
    });
  }, []);

  if (loading) return <CardSkeleton className="h-40" />;
  if (!stats) return null;

  const accuracy = stats.avg_accuracy_pct;
  const accColor = accuracy == null ? 'text-ink-4' : accuracy <= 5 ? 'text-ok' : accuracy <= 15 ? 'text-warn' : 'text-err';
  const AccIcon = accuracy == null ? Minus : accuracy <= 5 ? TrendingUp : accuracy <= 15 ? Minus : TrendingDown;

  return (
    <div className="bg-surface rounded-xl shadow-sm border border-hairline overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-hairline">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-surface-3 flex items-center justify-center">
            <FileText className="w-4 h-4 text-ink-2" />
          </div>
          <h3 className="text-sm font-bold text-ink">Quotations</h3>
        </div>
        <button onClick={() => navigate('/quotations')} className="inline-flex items-center gap-1 text-xs font-semibold text-ink-3 hover:text-ink">
          View All <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-hairline">
        <div className="px-4 py-4">
          <p className="text-xs text-ink-4 font-medium mb-1">Total Quotes</p>
          <p className="text-2xl font-bold text-ink">{stats.total_quotes}</p>
          <p className="text-xs text-ink-4 mt-0.5">+{stats.quotes_this_month} this month</p>
        </div>
        <div className="px-4 py-4">
          <p className="text-xs text-ink-4 font-medium mb-1">Actuals Entered</p>
          <div className="flex items-center gap-1.5">
            <ClipboardCheck className="w-4 h-4 text-violet-500" />
            <p className="text-2xl font-bold text-ink">{stats.actuals_count}</p>
          </div>
          <p className="text-xs text-ink-4 mt-0.5">production runs</p>
        </div>
        <div className="px-4 py-4">
          <p className="text-xs text-ink-4 font-medium mb-1">Cost Accuracy</p>
          <div className={`flex items-center gap-1.5 ${accColor}`}>
            <AccIcon className="w-4 h-4" />
            <p className="text-2xl font-bold">{accuracy != null ? `${accuracy.toFixed(1)}%` : 'No data'}</p>
          </div>
          <p className="text-xs text-ink-4 mt-0.5">avg cost variance</p>
        </div>
        <div className="px-4 py-4">
          <p className="text-xs text-ink-4 font-medium mb-1">Pending Actuals</p>
          <div className="flex items-center gap-1.5">
            {stats.pending_actuals > 0 && <AlertCircle className="w-4 h-4 text-warn" />}
            <p className={`text-2xl font-bold ${stats.pending_actuals > 0 ? 'text-warn' : 'text-ink'}`}>{stats.pending_actuals}</p>
          </div>
          <p className="text-xs text-ink-4 mt-0.5">post-production bills</p>
        </div>
      </div>

      {/* Top BOMs + Recent */}
      {(stats.top_boms.length > 0 || stats.recent.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-hairline border-t border-hairline">
          {stats.top_boms.length > 0 && (
            <div className="px-5 py-4">
              <p className="text-xs font-bold text-ink-4 uppercase tracking-wider mb-2">Top BOMs</p>
              <div className="space-y-1.5">
                {stats.top_boms.slice(0, 3).map((b) => (
                  <button key={b.bom_code} onClick={() => navigate(`/quotations/bom/${b.bom_code}`)} className="w-full flex items-center justify-between text-sm hover:bg-surface-2 rounded px-1.5 py-0.5 transition-colors">
                    <span className="font-medium text-ink truncate max-w-[160px]">{b.bom_code}</span>
                    <span className="text-ink-4 shrink-0 ml-2">{b.count} quote{b.count !== 1 ? 's' : ''}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {stats.recent.length > 0 && (
            <div className="px-5 py-4">
              <p className="text-xs font-bold text-ink-4 uppercase tracking-wider mb-2">Recent Quotes</p>
              <div className="space-y-1.5">
                {stats.recent.slice(0, 3).map((q) => (
                  <button key={q.id} onClick={() => navigate(`/quotations/${q.id}`)} className="w-full flex items-center justify-between text-sm hover:bg-surface-2 rounded px-1.5 py-0.5 transition-colors">
                    <span className="font-medium text-ink">{q.quote_ref}</span>
                    <span className="text-ink-4 text-xs">{new Date(q.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="px-5 py-3 border-t border-gray-50 flex items-center gap-4 flex-wrap">
        {Object.entries(stats.by_category).map(([cat, count]) => (
          <span key={cat} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cat === 'pre_production' ? 'bg-brand-soft text-brand' : 'bg-ok-soft text-ok'}`}>
            {cat === 'pre_production' ? 'Pre-Production' : 'Post-Production'}: {count}
          </span>
        ))}
        {Object.entries(stats.by_scope).map(([scope, count]) => (
          <span key={scope} className="text-xs font-medium text-ink-4">
            {scope === 'full' ? 'Full' : scope === 'rm_only' ? 'RM Only' : 'PM Only'}: {count}
          </span>
        ))}
      </div>
    </div>
  );
}
