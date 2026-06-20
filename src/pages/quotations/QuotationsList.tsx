/**
 * Quotations — saved quotes list with search, pagination, and delete.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Settings, Trash2, Loader2, BookOpen, Clock, CheckCircle2, ShoppingCart, BarChart3, GitCompare, Download } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, SearchInput, Pagination, ConfirmDialog, StatCard, selectClassName } from '../../components/ui';
import * as quotesApi from '../../services/quotations.service';
import type { SavedQuoteListItem, QuoteStats } from '../../services/quotations.service';
import { statusBadge, STATUS_META } from './quoteStatus';

const PAGE_SIZE = 20;

export default function QuotationsList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
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
    const r = await quotesApi.fetchSavedQuotes(search, PAGE_SIZE, (page - 1) * PAGE_SIZE, statusFilter || undefined);
    setLoading(false);
    if (r.success && r.data) { setQuotes(r.data.quotes); setTotal(r.data.total); }
    else toast.error(r.error ? String(r.error) : 'Failed to load quotes');
  }, [search, page, statusFilter]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    const r = await quotesApi.deleteSavedQuote(toDelete.id);
    setToDelete(null);
    if (r.success) { toast.success('Quote deleted'); load(); loadStats(); }
    else toast.error(r.error ? String(r.error) : 'Failed to delete');
  };

  const exportCsv = async () => {
    const r = await quotesApi.fetchSavedQuotes(search, 1000, 0, statusFilter || undefined);
    if (!r.success || !r.data) { toast.error('Export failed'); return; }
    const rows = r.data.quotes;
    const headers = ['Ref', 'Name', 'Status', 'Customer', 'BOM', 'Headline', 'MOQ', 'Sales Order', 'Created'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.join(','), ...rows.map((q) => [q.quote_ref, q.quote_name, q.status, q.customer_name, q.bom_code, q.headline_sell, q.headline_moq, q.sales_order_ref, new Date(q.created_at).toLocaleDateString()].map(esc).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `quotations-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} quotes`);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="pt-4 md:pt-6 space-y-6">
      <PageHeader
        title="Quotations"
        subtitle="BOM-driven price & timeline quotes"
        icon={<FileText className="w-6 h-6" />}
        actions={
          <>
            <button onClick={() => navigate('/quotations/dashboard')} className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all text-sm font-medium">
              <BarChart3 className="w-4 h-4" /> Dashboard
            </button>
            <button onClick={() => navigate('/quotations/guide')} className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all text-sm font-medium">
              <BookOpen className="w-4 h-4" /> Guide
            </button>
            <button onClick={() => navigate('/quotations/settings')} className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all text-sm font-medium">
              <Settings className="w-4 h-4" /> Settings
            </button>
            <button onClick={() => navigate('/quotations/new')} className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-800 rounded-lg hover:bg-gray-100 transition-all text-sm font-semibold">
              <Plus className="w-4 h-4" /> New Quote
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<FileText className="w-5 h-5" />} title="Total Quotes" value={stats?.total ?? '—'} iconBgClass="bg-slate-100" iconColorClass="text-slate-700" />
        <StatCard icon={<Clock className="w-5 h-5" />} title="Pending Approval" value={stats?.by_status?.pending_approval ?? 0} iconBgClass="bg-amber-100" iconColorClass="text-amber-600" />
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} title="Accepted" value={stats?.by_status?.accepted ?? 0} iconBgClass="bg-emerald-100" iconColorClass="text-emerald-600" />
        <StatCard icon={<ShoppingCart className="w-5 h-5" />} title="Converted to SO" value={stats?.converted ?? 0} iconBgClass="bg-violet-100" iconColorClass="text-violet-600" />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by ref, name, customer, or BOM…" className="max-w-md flex-1" />
          <select className={`${selectClassName} w-auto`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {selected.size >= 2 && (
            <button onClick={() => navigate(`/quotations/compare?ids=${[...selected].join(',')}`)} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900">
              <GitCompare className="w-4 h-4" /> Compare ({selected.size})
            </button>
          )}
          <button onClick={exportCsv} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200" title="Export CSV">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center"><Loader2 className="w-6 h-6 mx-auto text-slate-400 animate-spin" /></div>
        ) : quotes.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">{search ? 'No quotes match your search.' : 'No saved quotes yet.'}</p>
            {!search && <button onClick={() => navigate('/quotations/new')} className="mt-3 text-sm text-slate-700 font-medium hover:underline">Create your first quote</button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="py-3 px-4 w-8"></th><th className="py-3 px-4">Ref</th><th className="py-3 px-4">Name</th><th className="py-3 px-4">Status</th><th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">BOM</th><th className="py-3 px-4 text-right">Headline ₹</th><th className="py-3 px-4">MOQ</th>
                  <th className="py-3 px-4">Created</th><th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {quotes.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => navigate(`/quotations/${q.id}`)}>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggleSel(q.id)} disabled={!selected.has(q.id) && selected.size >= 4} className="rounded border-gray-300 text-slate-800 focus:ring-slate-800" />
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">{q.quote_ref}</td>
                    <td className="py-3 px-4 text-gray-700 max-w-[16rem] truncate">{q.quote_name}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(q.status).cls}`}>{statusBadge(q.status).label}</span>
                      {q.sales_order_ref && <span className="block text-xs text-emerald-600 mt-0.5">→ {q.sales_order_ref}</span>}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{q.customer_name || '—'}</td>
                    <td className="py-3 px-4 text-gray-500">{q.bom_code || '—'}</td>
                    <td className="py-3 px-4 text-right text-slate-900 font-semibold">{q.headline_sell != null ? Number(q.headline_sell).toFixed(2) : '—'}</td>
                    <td className="py-3 px-4 text-gray-500">{q.headline_moq || '—'}</td>
                    <td className="py-3 px-4 text-gray-500">{new Date(q.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={(e) => { e.stopPropagation(); setToDelete(q); }} className="text-gray-400 hover:text-red-500 p-1" title="Delete">
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
          <div className="p-4 border-t border-gray-100">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={total} itemsPerPage={PAGE_SIZE} />
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
