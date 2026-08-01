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
  const accColor = accuracy == null ? 'text-gray-400' : accuracy <= 5 ? 'text-emerald-600' : accuracy <= 15 ? 'text-amber-600' : 'text-red-600';
  const AccIcon = accuracy == null ? Minus : accuracy <= 5 ? TrendingUp : accuracy <= 15 ? Minus : TrendingDown;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <FileText className="w-4 h-4 text-slate-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Quotations</h3>
        </div>
        <button onClick={() => navigate('/quotations')} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
          View All <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-gray-100">
        <div className="px-4 py-4">
          <p className="text-xs text-gray-400 font-medium mb-1">Total Quotes</p>
          <p className="text-2xl font-bold text-slate-900">{stats.total_quotes}</p>
          <p className="text-xs text-gray-400 mt-0.5">+{stats.quotes_this_month} this month</p>
        </div>
        <div className="px-4 py-4">
          <p className="text-xs text-gray-400 font-medium mb-1">Actuals Entered</p>
          <div className="flex items-center gap-1.5">
            <ClipboardCheck className="w-4 h-4 text-violet-500" />
            <p className="text-2xl font-bold text-slate-900">{stats.actuals_count}</p>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">production runs</p>
        </div>
        <div className="px-4 py-4">
          <p className="text-xs text-gray-400 font-medium mb-1">Cost Accuracy</p>
          <div className={`flex items-center gap-1.5 ${accColor}`}>
            <AccIcon className="w-4 h-4" />
            <p className="text-2xl font-bold">{accuracy != null ? `${accuracy.toFixed(1)}%` : 'No data'}</p>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">avg cost variance</p>
        </div>
        <div className="px-4 py-4">
          <p className="text-xs text-gray-400 font-medium mb-1">Pending Actuals</p>
          <div className="flex items-center gap-1.5">
            {stats.pending_actuals > 0 && <AlertCircle className="w-4 h-4 text-amber-500" />}
            <p className={`text-2xl font-bold ${stats.pending_actuals > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{stats.pending_actuals}</p>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">post-production bills</p>
        </div>
      </div>

      {/* Top BOMs + Recent */}
      {(stats.top_boms.length > 0 || stats.recent.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 border-t border-gray-100">
          {stats.top_boms.length > 0 && (
            <div className="px-5 py-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Top BOMs</p>
              <div className="space-y-1.5">
                {stats.top_boms.slice(0, 3).map((b) => (
                  <button key={b.bom_code} onClick={() => navigate(`/quotations/bom/${b.bom_code}`)} className="w-full flex items-center justify-between text-sm hover:bg-gray-50 rounded px-1.5 py-0.5 transition-colors">
                    <span className="font-medium text-slate-800 truncate max-w-[160px]">{b.bom_code}</span>
                    <span className="text-gray-400 shrink-0 ml-2">{b.count} quote{b.count !== 1 ? 's' : ''}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {stats.recent.length > 0 && (
            <div className="px-5 py-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Recent Quotes</p>
              <div className="space-y-1.5">
                {stats.recent.slice(0, 3).map((q) => (
                  <button key={q.id} onClick={() => navigate(`/quotations/${q.id}`)} className="w-full flex items-center justify-between text-sm hover:bg-gray-50 rounded px-1.5 py-0.5 transition-colors">
                    <span className="font-medium text-slate-800">{q.quote_ref}</span>
                    <span className="text-gray-400 text-xs">{new Date(q.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="px-5 py-3 border-t border-gray-50 flex items-center gap-4 flex-wrap">
        {Object.entries(stats.by_category).map(([cat, count]) => (
          <span key={cat} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cat === 'pre_production' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {cat === 'pre_production' ? 'Pre-Production' : 'Post-Production'}: {count}
          </span>
        ))}
        {Object.entries(stats.by_scope).map(([scope, count]) => (
          <span key={scope} className="text-xs font-medium text-gray-400">
            {scope === 'full' ? 'Full' : scope === 'rm_only' ? 'RM Only' : 'PM Only'}: {count}
          </span>
        ))}
      </div>
    </div>
  );
}
