/**
 * Quotations Dashboard — analytics overview: KPIs, status distribution,
 * monthly volume, top BOMs, and recent activity.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Loader2, FileText, Trophy, ShoppingCart, IndianRupee } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { PageHeader, StatCard } from '../../components/ui';
import * as quotesApi from '../../services/quotations.service';
import type { QuoteAnalytics } from '../../services/quotations.service';
import { statusBadge, STATUS_META } from './quoteStatus';
import QuotationsNav from './QuotationsNav';

const STATUS_COLOR: Record<string, string> = {
  draft: '#94a3b8', pending_approval: '#f59e0b', approved: '#3b82f6',
  sent: '#8b5cf6', accepted: '#10b981', rejected: '#ef4444',
};
const pct = (n: number | null) => (n == null ? '—' : `${Math.round(n * 100)}%`);
const money = (n: number | null) => (n == null ? '—' : `₹${Number(n).toFixed(0)}`);

export default function QuoteDashboard() {
  const navigate = useNavigate();
  const [a, setA] = useState<QuoteAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { quotesApi.fetchAnalytics().then((r) => { setLoading(false); if (r.success && r.data) setA(r.data); }); }, []);

  const statusData = a ? Object.entries(a.by_status).map(([k, v]) => ({ name: STATUS_META[k]?.label || k, key: k, value: v })) : [];
  const monthData = a ? a.by_month.map((m) => ({ month: m.m.slice(2), count: m.c })) : [];

  return (
    <div className="pt-4 md:pt-6 space-y-6">
      <PageHeader
        title="Quotations Dashboard"
        subtitle="Pipeline analytics & activity"
        icon={<BarChart3 className="w-6 h-6" />}
      />

      <QuotationsNav />

      {loading ? (
        <div className="p-12 text-center"><Loader2 className="w-6 h-6 mx-auto text-slate-400 animate-spin" /></div>
      ) : !a ? (
        <div className="p-12 text-center text-gray-500">No analytics available.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={<FileText className="w-5 h-5" />} title="Total Quotes" value={a.total} iconBgClass="bg-slate-100" iconColorClass="text-slate-700" />
            <StatCard icon={<Trophy className="w-5 h-5" />} title="Win Rate" value={pct(a.win_rate)} iconBgClass="bg-emerald-100" iconColorClass="text-emerald-600" />
            <StatCard icon={<ShoppingCart className="w-5 h-5" />} title="Conversion Rate" value={pct(a.conversion_rate)} iconBgClass="bg-violet-100" iconColorClass="text-violet-600" />
            <StatCard icon={<IndianRupee className="w-5 h-5" />} title="Avg Headline Price" value={money(a.avg_sell)} iconBgClass="bg-amber-100" iconColorClass="text-amber-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Status Distribution</h3>
              {statusData.length === 0 ? <Empty /> : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="55%" height={200}>
                    <PieChart>
                      <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                        {statusData.map((s) => <Cell key={s.key} fill={STATUS_COLOR[s.key] || '#94a3b8'} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="flex-1 space-y-1.5">
                    {statusData.map((s) => (
                      <li key={s.key} className="flex items-center gap-2 text-sm">
                        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: STATUS_COLOR[s.key] }} />
                        <span className="text-gray-600 flex-1">{s.name}</span>
                        <span className="font-semibold text-slate-900">{s.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Quotes per Month</h3>
              {monthData.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#1e293b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Most-Quoted BOMs</h3>
              {a.top_boms.length === 0 ? <Empty /> : (
                <ul className="space-y-2">
                  {a.top_boms.map((b) => {
                    const max = a.top_boms[0].c || 1;
                    return (
                      <li key={b.bom_code} className="text-sm">
                        <div className="flex justify-between mb-0.5"><span className="text-gray-700 truncate max-w-[16rem]" title={b.name}>{b.name}</span><span className="font-semibold text-slate-900">{b.c}</span></div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-slate-700 rounded-full" style={{ width: `${(b.c / max) * 100}%` }} /></div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Recent Activity</h3>
              <ul className="divide-y divide-gray-50">
                {a.recent.map((q) => (
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
          </div>
        </>
      )}
    </div>
  );
}

function Empty() { return <p className="text-sm text-gray-400 py-8 text-center">No data yet.</p>; }
