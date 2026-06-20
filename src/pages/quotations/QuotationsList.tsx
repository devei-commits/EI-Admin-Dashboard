/**
 * Quotations — saved quotes list with search, pagination, and delete.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Settings, Trash2, Loader2, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, SearchInput, Pagination, ConfirmDialog } from '../../components/ui';
import * as quotesApi from '../../services/quotations.service';
import type { SavedQuoteListItem } from '../../services/quotations.service';

const PAGE_SIZE = 20;

export default function QuotationsList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [quotes, setQuotes] = useState<SavedQuoteListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState<SavedQuoteListItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await quotesApi.fetchSavedQuotes(search, PAGE_SIZE, (page - 1) * PAGE_SIZE);
    setLoading(false);
    if (r.success && r.data) { setQuotes(r.data.quotes); setTotal(r.data.total); }
    else toast.error(r.error ? String(r.error) : 'Failed to load quotes');
  }, [search, page]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { setPage(1); }, [search]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    const r = await quotesApi.deleteSavedQuote(toDelete.id);
    setToDelete(null);
    if (r.success) { toast.success('Quote deleted'); load(); }
    else toast.error(r.error ? String(r.error) : 'Failed to delete');
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotations"
        subtitle="BOM-driven price & timeline quotes"
        icon={<FileText className="w-6 h-6" />}
        actions={
          <>
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

      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by ref, name, customer, or BOM…" className="max-w-md" />
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
                  <th className="py-3 px-4">Ref</th><th className="py-3 px-4">Name</th><th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">BOM</th><th className="py-3 px-4 text-right">Headline ₹</th><th className="py-3 px-4">MOQ</th>
                  <th className="py-3 px-4">Created</th><th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {quotes.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => navigate(`/quotations/${q.id}`)}>
                    <td className="py-3 px-4 font-medium text-slate-900">{q.quote_ref}</td>
                    <td className="py-3 px-4 text-gray-700 max-w-[16rem] truncate">{q.quote_name}</td>
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
