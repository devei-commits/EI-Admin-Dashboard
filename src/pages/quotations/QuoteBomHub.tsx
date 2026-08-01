/**
 * BOM Quote Hub — BOM-specific dashboard.
 * Shows aggregated stats, price trend, accuracy KPIs, and job-grouped quote table.
 */
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Package, Plus, ArrowLeft, Trophy, ShoppingCart, IndianRupee, FileText, Target, TrendingUp, TrendingDown, Minus, FlaskConical, ClipboardCheck } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { PageHeader } from '../../components/ui';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import * as quotesApi from '../../services/quotations.service';
import type { SavedQuoteListItem, BomQuoteStats, BomQuoteJob, QuoteActuals } from '../../services/quotations.service';
import { fetchBOMs, type BOMRecord } from '../../services/bom.service';
import { statusBadge } from './quoteStatus';
import QuotationsNav from './QuotationsNav';

const SCOPE_META: Record<string, { label: string; cls: string }> = {
  full: { label: 'Full', cls: 'bg-slate-100 text-slate-700' },
  rm_only: { label: 'RM Only', cls: 'bg-amber-100 text-amber-700' },
  pm_only: { label: 'PM Only', cls: 'bg-violet-100 text-violet-700' },
};
const CAT_META: Record<string, { label: string; cls: string }> = {
  pre_production: { label: 'Pre-Prod', cls: 'bg-blue-50 text-blue-600 border border-blue-200' },
  post_production: { label: 'Post-Prod', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
};
const money = (n: number | null | undefined) => n == null ? '—' : `₹${Number(n).toFixed(2)}`;
const pct = (n: number | null | undefined) => n == null ? '—' : `${Math.round(Number(n) * 100)}%`;

function variance(prePrice: number | null, postPrice: number | null): { diff: number; pct: number } | null {
  if (prePrice == null || postPrice == null || prePrice === 0) return null;
  const diff = postPrice - prePrice;
  return { diff, pct: (diff / prePrice) * 100 };
}

export default function QuoteBomHub() {
  const { bom_code } = useParams<{ bom_code: string }>();
  const navigate = useNavigate();
  const [stats, setStats] = useState<BomQuoteStats | null>(null);
  const [jobs, setJobs] = useState<BomQuoteJob[]>([]);
  const [quotes, setQuotes] = useState<SavedQuoteListItem[]>([]);
  const [bom, setBom] = useState<BOMRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [actuals, setActuals] = useState<QuoteActuals[]>([]);

  useEffect(() => {
    if (!bom_code) return;
    Promise.all([
      quotesApi.fetchBomQuoteStats(bom_code),
      quotesApi.fetchQuotesByBom(bom_code),
      fetchBOMs(bom_code),
      quotesApi.fetchActualsByBom(bom_code),
    ]).then(([sRes, qRes, bomRes, actRes]) => {
      setLoading(false);
      if (sRes.success && sRes.data) setStats(sRes.data);
      if (qRes.success && qRes.data) { setJobs(qRes.data.jobs); setQuotes(qRes.data.quotes); }
      if (bomRes.success && bomRes.data.length) {
        const match = bomRes.data.find((b) => b.bomCode === bom_code) || bomRes.data[0];
        setBom(match);
      }
      if (actRes.success) setActuals(actRes.data);
    });
  }, [bom_code]);

  // Accuracy: average variance % across all paired jobs
  const accuracyData = useMemo(() => {
    const pairs: number[] = [];
    for (const job of jobs) {
      const preQ = job.quotes.find((q) => q.quote_category === 'pre_production');
      const postQ = job.quotes.find((q) => q.quote_category === 'post_production');
      if (!preQ || !postQ) continue;
      const v = variance(preQ.headline_sell, postQ.headline_sell);
      if (v) pairs.push(v.pct);
    }
    if (!pairs.length) return null;
    const avgDiff = pairs.reduce((s, v) => s + v, 0) / pairs.length;
    const avgAbsDiff = pairs.reduce((s, v) => s + Math.abs(v), 0) / pairs.length;
    return { avgDiff, avgAbsDiff, pairs: pairs.length };
  }, [jobs]);

  // Price trend: all quotes sorted by date
  const trendData = useMemo(() => {
    return [...quotes]
      .filter((q) => q.headline_sell != null)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((q) => {
        const cat = q.quote_category || 'pre_production';
        return {
          date: new Date(q.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }),
          pre: cat === 'pre_production' ? Number(q.headline_sell) : null,
          post: cat === 'post_production' ? Number(q.headline_sell) : null,
          ref: q.quote_ref,
        };
      });
  }, [quotes]);

  // Map post_quote_id → actuals row for job-level variance display
  const actualsMap = useMemo(() => {
    const m: Record<number, QuoteActuals> = {};
    for (const a of actuals) { if (a.post_quote_id) m[a.post_quote_id] = a; }
    return m;
  }, [actuals]);

  // Accuracy from real actuals (preferred over estimated quote drift)
  const actualsAccuracy = useMemo(() => {
    const variances = actuals
      .filter((a) => a.variance?.total?.pct != null)
      .map((a) => a.variance!.total!.pct!);
    if (!variances.length) return null;
    const avgAbs = variances.reduce((s, v) => s + Math.abs(v), 0) / variances.length;
    const avgSigned = variances.reduce((s, v) => s + v, 0) / variances.length;
    return { avgAbs, avgSigned, count: variances.length };
  }, [actuals]);

  // Est vs Actual cost breakdown (from most recent actuals)
  const costComparisonData = useMemo(() => {
    const a = actuals[0];
    if (!a) return null;
    return [
      { name: 'Raw Materials', est: a.est_rm ? Number(a.est_rm) : 0, actual: a.actual_rm ? Number(a.actual_rm) : 0 },
      { name: 'Pack Materials', est: a.est_pm ? Number(a.est_pm) : 0, actual: a.actual_pm ? Number(a.actual_pm) : 0 },
      { name: 'Conversion', est: a.est_conversion ? Number(a.est_conversion) : 0, actual: a.actual_conversion ? Number(a.actual_conversion) : 0 },
      { name: 'Overhead', est: a.est_overhead ? Number(a.est_overhead) : 0, actual: a.actual_overhead ? Number(a.actual_overhead) : 0 },
    ].filter((row) => row.est > 0 || row.actual > 0);
  }, [actuals]);

  const hasTrend = trendData.length >= 2;
  const avgSell = stats?.avg_price;

  return (
    <div className="pt-4 md:pt-6 space-y-6">
      <PageHeader
        title={bom ? `${bom.name || bom_code}` : `BOM Hub — ${bom_code}`}
        subtitle={`${bom_code} · All quotations grouped by production job`}
        icon={<Package className="w-6 h-6" />}
        actions={
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => navigate('/quotations')} className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 text-sm font-medium"><ArrowLeft className="w-4 h-4" /> All Quotes</button>
            <button onClick={() => navigate(`/quotations/new?bomCode=${bom_code}&quoteScope=full`)} className="inline-flex items-center gap-2 px-3.5 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 text-sm font-medium"><Plus className="w-4 h-4" /> Full</button>
            <button onClick={() => navigate(`/quotations/new?bomCode=${bom_code}&quoteScope=rm_only`)} className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium"><FlaskConical className="w-4 h-4" /> RM Only</button>
            <button onClick={() => navigate(`/quotations/new?bomCode=${bom_code}&quoteScope=pm_only`)} className="inline-flex items-center gap-2 px-3.5 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium"><Package className="w-4 h-4" /> PM Only</button>
          </div>
        }
      />
      <QuotationsNav />

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">{Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}</div>
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard icon={<FileText className="w-5 h-5" />} label="Total Quotes" value={String(stats?.total ?? 0)} cls="bg-slate-100 text-slate-700" />
            <StatCard icon={<Trophy className="w-5 h-5" />} label="Win Rate" value={pct(stats?.win_rate ?? null)} cls="bg-emerald-100 text-emerald-600" />
            <StatCard icon={<ShoppingCart className="w-5 h-5" />} label="Converted to SO" value={String(stats?.converted ?? 0)} cls="bg-violet-100 text-violet-600" />
            <StatCard icon={<IndianRupee className="w-5 h-5" />} label="Avg Sell Price" value={money(stats?.avg_price ?? null)} cls="bg-amber-100 text-amber-600" />
            {actualsAccuracy ? (
              <StatCard
                icon={<ClipboardCheck className="w-5 h-5" />}
                label={`Real Accuracy (${actualsAccuracy.count} run${actualsAccuracy.count !== 1 ? 's' : ''})`}
                value={`${actualsAccuracy.avgSigned > 0 ? '+' : ''}${actualsAccuracy.avgSigned.toFixed(1)}%`}
                cls={actualsAccuracy.avgAbs <= 5 ? 'bg-emerald-100 text-emerald-600' : actualsAccuracy.avgAbs <= 15 ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}
              />
            ) : accuracyData ? (
              <StatCard
                icon={accuracyData.avgDiff > 5 ? <TrendingUp className="w-5 h-5" /> : accuracyData.avgDiff < -5 ? <TrendingDown className="w-5 h-5" /> : <Target className="w-5 h-5" />}
                label={`Quote Drift (${accuracyData.pairs} pairs)`}
                value={`${accuracyData.avgDiff > 0 ? '+' : ''}${accuracyData.avgDiff.toFixed(1)}%`}
                cls={Math.abs(accuracyData.avgDiff) <= 5 ? 'bg-emerald-100 text-emerald-600' : Math.abs(accuracyData.avgDiff) <= 15 ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}
              />
            ) : (
              <StatCard icon={<Target className="w-5 h-5" />} label="Avg Accuracy" value="No data yet" cls="bg-gray-100 text-gray-400" />
            )}
          </div>

          {/* Price trend chart + type/client split */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Trend chart — spans 2 cols */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-100 p-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Headline Sell Price — All Quotes Over Time</h3>
              {hasTrend ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(v) => `₹${v}`} width={60} />
                    <Tooltip formatter={(v) => [`₹${Number(v).toFixed(2)}`]} contentStyle={{ fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {avgSell != null && <ReferenceLine y={avgSell} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Avg', position: 'right', fontSize: 10, fill: '#94a3b8' }} />}
                    <Line type="monotone" dataKey="pre" name="Pre-Production" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} connectNulls={true} />
                    <Line type="monotone" dataKey="post" name="Post-Production" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} connectNulls={true} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex flex-col items-center justify-center text-gray-300">
                  <TrendingUp className="w-10 h-10 mb-2" />
                  <p className="text-sm">At least 2 quotes needed for trend</p>
                </div>
              )}
            </div>

            {/* Type split + price range + accuracy */}
            <div className="space-y-4">
              {stats && Object.keys(stats.by_type).length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Quote Type Split</h3>
                  <div className="space-y-2">
                    {Object.entries(stats.by_type).map(([type, count]) => {
                      const total = stats.total || 1;
                      const m = SCOPE_META[type] || SCOPE_META.full;
                      return (
                        <div key={type}>
                          <div className="flex justify-between text-sm mb-0.5">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.cls}`}>{m.label}</span>
                            <span className="text-gray-600">{count} ({Math.round((count / total) * 100)}%)</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full"><div className="h-full bg-slate-700 rounded-full" style={{ width: `${(count / total) * 100}%` }} /></div>
                        </div>
                      );
                    })}
                  </div>
                  {stats.by_category && Object.keys(stats.by_category).length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-50">
                      <p className="text-xs font-bold text-gray-400 uppercase mb-2">Pre vs Post</p>
                      <div className="flex gap-2 flex-wrap">
                        {Object.entries(stats.by_category).map(([cat, count]) => {
                          const cm = CAT_META[cat] || CAT_META.pre_production;
                          return <span key={cat} className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cm.cls}`}>{cm.label}: {count}</span>;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {stats && (stats.min_price != null || stats.max_price != null) && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Price Range</h3>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm"><span className="text-gray-400">Min</span><span className="font-semibold text-slate-900">{money(stats.min_price)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-400">Avg</span><span className="font-semibold text-slate-900">{money(stats.avg_price)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-400">Max</span><span className="font-semibold text-slate-900">{money(stats.max_price)}</span></div>
                  </div>
                  {stats.top_clients.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-50">
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">Top Clients</p>
                      {stats.top_clients.slice(0, 3).map((c) => (
                        <p key={c.customer_name} className="text-sm text-gray-700">{c.customer_name} <span className="text-gray-400">× {c.c}</span></p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {(actualsAccuracy || accuracyData) && (() => {
                const useReal = !!actualsAccuracy;
                const val = useReal ? actualsAccuracy!.avgAbs : accuracyData!.avgAbsDiff;
                const signed = useReal ? actualsAccuracy!.avgSigned : accuracyData!.avgDiff;
                const tier = val <= 5 ? 'emerald' : val <= 15 ? 'amber' : 'red';
                const bgCls = tier === 'emerald' ? 'bg-emerald-50 border-emerald-200' : tier === 'amber' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
                const textCls = tier === 'emerald' ? 'text-emerald-700' : tier === 'amber' ? 'text-amber-700' : 'text-red-700';
                return (
                  <div className={`rounded-lg border p-4 ${bgCls}`}>
                    <p className="text-xs font-bold uppercase tracking-wider mb-1 text-gray-500">
                      {useReal ? `Real Accuracy (${actualsAccuracy!.count} actuals)` : 'Pre→Post Accuracy (estimated)'}
                    </p>
                    <p className="text-2xl font-bold text-slate-900">{val.toFixed(1)}% <span className="text-sm font-normal text-gray-500">avg deviation</span></p>
                    <p className={`text-xs ${textCls} mt-1`}>
                      {val <= 5 ? 'Excellent — estimates closely match production.' : val <= 15 ? 'Moderate variance — review pricing assumptions.' : 'High variance — investigate cost drivers.'}
                    </p>
                    {signed !== 0 && <p className="text-xs text-gray-500 mt-0.5">Bias: {signed > 0 ? 'over-estimating' : 'under-estimating'} by {Math.abs(signed).toFixed(1)}%</p>}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Est vs Actual cost comparison */}
          {costComparisonData && costComparisonData.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Estimated vs Actual — Cost Per Unit (₹) — Most Recent Production Run</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={costComparisonData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(v) => `₹${v}`} width={55} />
                  <Tooltip formatter={(v) => [`₹${Number(v).toFixed(2)}`]} contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="est" name="Estimated" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actual" name="Actual" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Job groups */}
          {quotes.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100">
              <EmptyState
                icon={<Package />}
                title="No quotes for this BOM yet."
                action={
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => navigate(`/quotations/new?bomCode=${bom_code}&quoteScope=full`)} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900"><Plus className="w-4 h-4" /> Full Quote</button>
                    <button onClick={() => navigate(`/quotations/new?bomCode=${bom_code}&quoteScope=rm_only`)} className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-semibold hover:bg-amber-200"><FlaskConical className="w-4 h-4" /> RM Only</button>
                  </div>
                }
              />
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">Production Jobs ({jobs.length})</h3>
              {jobs.map((job, ji) => (
                <div key={ji} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900">{job.job_ref || 'Ungrouped Quotes'}</span>
                    <span className="text-xs text-gray-400">{job.quotes.length} quote{job.quotes.length !== 1 ? 's' : ''}</span>
                    {(() => {
                      const preQ = job.quotes.find(q => q.quote_category === 'pre_production');
                      if (preQ && !job.quotes.some(q => q.quote_category === 'post_production')) {
                        return (
                          <button
                            onClick={() => navigate(`/quotations/new?fromQuoteId=${preQ.id}`)}
                            className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-medium border border-violet-200 hover:border-violet-400 rounded px-2 py-0.5 transition-colors"
                          >
                            Post-Prod Bill →
                          </button>
                        );
                      }
                      return null;
                    })()}
                    {(() => {
                      const preQ = job.quotes.find(q => q.quote_category === 'pre_production');
                      const postQ = job.quotes.find(q => q.quote_category === 'post_production');
                      if (!preQ || !postQ) return null;
                      const v = variance(preQ.headline_sell, postQ.headline_sell);
                      return (
                        <div className="ml-auto flex items-center gap-2">
                          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Pre + Post paired</span>
                          {v && (
                            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${v.diff > 0 ? 'bg-red-50 text-red-600 border border-red-200' : v.diff < 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>
                              {v.diff > 0 ? <TrendingUp className="w-3 h-3" /> : v.diff < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                              {v.diff > 0 ? '+' : ''}{money(v.diff)} ({v.pct > 0 ? '+' : ''}{v.pct.toFixed(1)}%)
                            </span>
                          )}
                          {postQ && actualsMap[postQ.id] && (() => {
                            const a = actualsMap[postQ.id];
                            const tv = a.variance?.total;
                            if (!tv) return null;
                            const abs = Math.abs(tv.pct ?? 99);
                            const cls = abs <= 5 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : abs <= 15 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-600 border-red-200';
                            return (
                              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
                                <ClipboardCheck className="w-3 h-3" />
                                Actuals: {tv.pct != null ? `${tv.pct > 0 ? '+' : ''}${tv.pct.toFixed(1)}%` : '—'}
                              </span>
                            );
                          })()}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                        <th scope="col" className="py-2.5 px-4">Ref</th>
                        <th scope="col" className="py-2.5 px-3">Category</th>
                        <th scope="col" className="py-2.5 px-3">Type</th>
                        <th scope="col" className="py-2.5 px-4">Name</th>
                        <th scope="col" className="py-2.5 px-3">Status</th>
                        <th scope="col" className="py-2.5 px-3">Customer</th>
                        <th scope="col" className="py-2.5 px-3 text-right">Sell ₹</th>
                        <th scope="col" className="py-2.5 px-3">Created</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {job.quotes.map((q) => {
                          const sm = SCOPE_META[q.quote_type || 'full'] || SCOPE_META.full;
                          const cm = CAT_META[q.quote_category || 'pre_production'] || CAT_META.pre_production;
                          return (
                            <tr key={q.id} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => navigate(`/quotations/${q.id}`)}>
                              <td className="py-2.5 px-4 font-medium text-slate-900">{q.quote_ref}</td>
                              <td className="py-2.5 px-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cm.cls}`}>{cm.label}</span></td>
                              <td className="py-2.5 px-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sm.cls}`}>{sm.label}</span></td>
                              <td className="py-2.5 px-4 text-gray-700 truncate max-w-[16rem]">{q.quote_name}</td>
                              <td className="py-2.5 px-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(q.status).cls}`}>{statusBadge(q.status).label}</span></td>
                              <td className="py-2.5 px-3 text-gray-500">{q.customer_name || '—'}</td>
                              <td className="py-2.5 px-3 text-right font-semibold text-slate-900">{q.headline_sell != null ? `₹${Number(q.headline_sell).toFixed(2)}` : '—'}</td>
                              <td className="py-2.5 px-3 text-gray-400 text-xs">{new Date(q.created_at).toLocaleDateString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, cls }: { icon: React.ReactNode; label: string; value: string; cls: string }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${cls}`}>{icon}</div>
      <div><p className="text-xs text-gray-500 font-medium">{label}</p><p className="text-xl font-bold text-slate-900 leading-tight">{value}</p></div>
    </div>
  );
}
