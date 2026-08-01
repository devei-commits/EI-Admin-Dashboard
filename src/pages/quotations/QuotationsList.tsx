/**
 * Quotations — saved quotes list with search, pagination, and delete.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Trash2, Clock, CheckCircle2, ShoppingCart, GitCompare, Download } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, SearchInput, Pagination, ConfirmDialog, StatCard, selectClassName } from '../../components/ui';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import * as quotesApi from '../../services/quotations.service';
import type { SavedQuoteListItem, QuoteStats } from '../../services/quotations.service';
import { statusBadge, STATUS_META } from './quoteStatus';
import QuotationsNav from './QuotationsNav';

const SCOPE_META: Record<string, { label: string; cls: string }> = {
  full: { label: 'Full', cls: 'bg-surface-3 text-ink-2' },
  rm_only: { label: 'RM Only', cls: 'bg-warn-soft text-warn' },
  pm_only: { label: 'PM Only', cls: 'bg-violet-100 text-violet-700' },
};
const CAT_META: Record<string, { label: string; cls: string }> = {
  pre_production: { label: 'Pre-Prod', cls: 'bg-brand-soft text-brand' },
  post_production: { label: 'Post-Prod', cls: 'bg-ok-soft text-ok' },
};

const PAGE_SIZE = 20;

export default function QuotationsList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [catFilter, setCatFilter] = useState<'' | 'pre_production' | 'post_production' | 'needs_actuals'>('');
  const [page, setPage] = useState(1);
  const [quotes, setQuotes] = useState<SavedQuoteListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState<SavedQuoteListItem | null>(null);
  const [stats, setStats] = useState<QuoteStats | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const toggleSel = (id: number) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else if (n.size < 4) n.add(id); return n; });

  const loadStats = useCallback(() => { quotesApi.fetchQuoteStats().then((r) => { if (r.success && r.data) setStats(r.data); }); }, []);
  useEffect(() => { loadStats(); }, [loadStats]);

  const load = useCallback(async () => {
    setLoading(true);
    const effectiveCat = catFilter === 'needs_actuals' ? 'post_production' : catFilter || undefined;
    const r = await quotesApi.fetchSavedQuotes(search, PAGE_SIZE, (page - 1) * PAGE_SIZE, statusFilter || undefined, undefined, undefined, effectiveCat);
    setLoading(false);
    if (r.success && r.data) { setQuotes(r.data.quotes); setTotal(r.data.total); }
    else toast.error(r.error ? String(r.error) : 'Failed to load quotes');
  }, [search, page, statusFilter, catFilter]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { setPage(1); }, [search, statusFilter, catFilter]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    const r = await quotesApi.deleteSavedQuote(toDelete.id);
    setToDelete(null);
    if (r.success) { toast.success('Quote deleted'); load(); loadStats(); }
    else toast.error(r.error ? String(r.error) : 'Failed to delete');
  };

  const exportCsv = async () => {
    const exportCategory = catFilter === 'needs_actuals' ? 'post_production' : catFilter || undefined;
    const exportNoActuals = catFilter === 'needs_actuals';
    const r = await quotesApi.fetchSavedQuotes(search, 1000, 0, statusFilter || undefined, undefined, undefined, exportCategory, undefined, exportNoActuals);
    if (!r.success || !r.data) { toast.error('Export failed'); return; }
    const rows = exportNoActuals ? r.data.quotes.filter(q => !q.actuals_count) : r.data.quotes;
    const headers = ['Ref', 'Name', 'Status', 'Customer', 'BOM', 'Headline', 'MOQ', 'Sales Order', 'Created'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.join(','), ...rows.map((q) => [q.quote_ref, q.quote_name, q.status, q.customer_name, q.bom_code, q.headline_sell, q.headline_moq, q.sales_order_ref, new Date(q.created_at).toLocaleDateString()].map(esc).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `quotations-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} quotes`);
  };

  const displayQuotes = catFilter === 'needs_actuals' ? quotes.filter(q => !q.actuals_count) : quotes;
  const totalPages = Math.max(1, Math.ceil((catFilter === 'needs_actuals' ? displayQuotes.length : total) / PAGE_SIZE));

  return (
    <div className="pt-4 md:pt-6 space-y-6">
      <PageHeader
        title="Quotations"
        subtitle="BOM-driven price & timeline quotes"
        icon={<FileText className="w-6 h-6" />}
        actions={
          <button onClick={() => navigate('/quotations/new')} className="inline-flex items-center gap-2 px-4 py-2 bg-surface text-ink rounded-lg hover:bg-surface-3 transition-all text-sm font-semibold">
            <Plus className="w-4 h-4" /> New Quote
          </button>
        }
      />

      <QuotationsNav />

      {/* Category quick-filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {([
          { key: '' as const, label: 'All Quotes' },
          { key: 'pre_production' as const, label: 'Pre-Production' },
          { key: 'post_production' as const, label: 'Post-Production' },
          { key: 'needs_actuals' as const, label: 'Pending Actuals' },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setCatFilter(key)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${catFilter === key ? 'bg-ink text-white' : 'bg-surface-3 text-ink-2 hover:bg-surface-3'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<FileText className="w-5 h-5" />} title="Total Quotes" value={stats?.total ?? '—'} iconBgClass="bg-surface-3" iconColorClass="text-ink-2" />
        <StatCard icon={<Clock className="w-5 h-5" />} title="Pending Approval" value={stats?.by_status?.pending_approval ?? 0} iconBgClass="bg-warn-soft" iconColorClass="text-warn" />
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} title="Accepted" value={stats?.by_status?.accepted ?? 0} iconBgClass="bg-ok-soft" iconColorClass="text-ok" />
        <StatCard icon={<ShoppingCart className="w-5 h-5" />} title="Converted to SO" value={stats?.converted ?? 0} iconBgClass="bg-violet-100" iconColorClass="text-violet-600" />
      </div>

      <div className="bg-surface rounded-lg shadow-sm border border-hairline">
        <div className="p-4 border-b border-hairline flex items-center gap-3 flex-wrap">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by ref, name, customer, or BOM…" className="max-w-md flex-1" />
          <select className={`${selectClassName} w-auto`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {selected.size >= 2 && (
            <button onClick={() => navigate(`/quotations/compare?ids=${[...selected].join(',')}`)} className="inline-flex items-center gap-2 px-4 py-2 bg-ink text-white rounded-lg text-sm font-semibold hover:bg-ink">
              <GitCompare className="w-4 h-4" /> Compare ({selected.size})
            </button>
          )}
          <button onClick={exportCsv} className="inline-flex items-center gap-2 px-4 py-2 bg-surface-3 text-ink-2 rounded-lg text-sm font-medium hover:bg-surface-3" title="Export CSV">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>

        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={6} cols={6} />
          </div>
        ) : displayQuotes.length === 0 ? (
          <EmptyState
            icon={<FileText />}
            title={catFilter === 'needs_actuals' ? 'All post-production quotes have actuals entered.' : (search || statusFilter ? 'No quotes match your filters.' : 'No quotes yet')}
            description={catFilter === 'needs_actuals' ? 'Nothing pending — great job!' : (search || statusFilter ? 'Try clearing the search or status filter.' : 'Generate your first BOM-driven quote.')}
            action={!search && !statusFilter && catFilter !== 'needs_actuals' ? (
              <button onClick={() => navigate('/quotations/new')} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-ink text-white rounded-lg text-sm font-semibold hover:bg-ink">
                <Plus className="w-4 h-4" /> New Quote
              </button>
            ) : undefined}
          />
        ) : (
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-20">
                <tr className="text-left text-xs font-semibold text-ink-3 uppercase tracking-wider border-b border-hairline bg-surface-2/50 [&_th]:bg-surface-2">
                  <th scope="col" className="py-3 px-4 w-8"></th><th scope="col" className="py-3 px-4">Ref</th><th scope="col" className="py-3 px-4">Type</th><th scope="col" className="py-3 px-4">Name</th><th scope="col" className="py-3 px-4">Status</th><th scope="col" className="py-3 px-4">Customer</th>
                  <th scope="col" className="py-3 px-4">BOM</th><th scope="col" className="py-3 px-4 text-right">Headline ₹</th><th scope="col" className="py-3 px-4">MOQ</th>
                  <th scope="col" className="py-3 px-4">Created</th><th scope="col" className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {displayQuotes.map((q) => (
                  <tr key={q.id} className="hover:bg-surface-2/50 cursor-pointer" onClick={() => navigate(`/quotations/${q.id}`)}>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggleSel(q.id)} disabled={!selected.has(q.id) && selected.size >= 4} className="rounded border-border text-ink focus:ring-border" />
                    </td>
                    <td className="py-3 px-4 font-medium text-ink">{q.quote_ref}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${(SCOPE_META[q.quote_type || 'full'] || SCOPE_META.full).cls}`}>{(SCOPE_META[q.quote_type || 'full'] || SCOPE_META.full).label}</span>
                      {q.quote_category === 'post_production' && (
                        <>
                          <span className={`ml-1 text-xs font-semibold px-2 py-0.5 rounded-full ${CAT_META.post_production.cls}`}>{CAT_META.post_production.label}</span>
                          {q.actuals_count != null && q.actuals_count > 0 && (
                            <span className="ml-1 text-xs font-semibold text-ok bg-ok-soft px-1.5 py-0.5 rounded-full">✓</span>
                          )}
                        </>
                      )}
                      {q.job_ref && <p className="text-xs text-ink-4 mt-0.5 truncate max-w-[10rem]" title={q.job_ref}>{q.job_ref}</p>}
                    </td>
                    <td className="py-3 px-4 text-ink-2 max-w-[16rem] truncate">{q.quote_name}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(q.status).cls}`}>{statusBadge(q.status).label}</span>
                      {q.sales_order_ref && <span className="block text-xs text-ok mt-0.5">→ {q.sales_order_ref}</span>}
                    </td>
                    <td className="py-3 px-4 text-ink-2">{q.customer_name || '—'}</td>
                    <td className="py-3 px-4">
                      {q.bom_code ? (
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/quotations/bom/${q.bom_code}`); }} className="text-ink-2 hover:text-ink hover:underline text-sm font-medium">{q.bom_code}</button>
                      ) : <span className="text-ink-4">—</span>}
                    </td>
                    <td className="py-3 px-4 text-right text-ink font-semibold">{q.headline_sell != null ? Number(q.headline_sell).toFixed(2) : '—'}</td>
                    <td className="py-3 px-4 text-ink-3">{q.headline_moq || '—'}</td>
                    <td className="py-3 px-4 text-ink-3">{new Date(q.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={(e) => { e.stopPropagation(); setToDelete(q); }} className="text-ink-4 hover:text-err p-1" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="p-4 border-t border-hairline">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={catFilter === 'needs_actuals' ? displayQuotes.length : total} itemsPerPage={PAGE_SIZE} />
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete quote?"
        message={toDelete ? `Delete "${toDelete.quote_name}" (${toDelete.quote_ref})? This cannot be undone.` : ''}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
