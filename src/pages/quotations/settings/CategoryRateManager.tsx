import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Save } from 'lucide-react';
import { fetchCategoryRates, upsertCategoryRate, deleteCategoryRate } from '../../../services/quotations.service';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import type { CategoryRate } from '../../../services/quotations.service';

interface DraftRow {
  id?: number;
  category: string;
  wastage_pct: string;
  notes: string;
  isNew?: boolean;
  saving?: boolean;
}

export default function CategoryRateManager() {
  const [rows, setRows]       = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchCategoryRates();
    if (res.success) {
      setRows(res.data.map(r => ({
        id: r.id,
        category: r.category,
        wastage_pct: String(r.wastage_pct),
        notes: r.notes ?? '',
      })));
    } else {
      toast.error(res.error ?? 'Failed to load category rates');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = (idx: number, field: keyof DraftRow, value: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const save = async (idx: number) => {
    const row = rows[idx];
    const wastage = parseFloat(row.wastage_pct);
    if (!row.category.trim()) { toast.error('Category name is required'); return; }
    if (isNaN(wastage) || wastage < 0 || wastage > 100) { toast.error('Wastage % must be 0–100'); return; }
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, saving: true } : r));
    const res = await upsertCategoryRate({
      category: row.category.trim(),
      wastage_pct: wastage,
      notes: row.notes.trim() || null,
    });
    if (res.success) {
      toast.success(`${row.isNew ? 'Added' : 'Updated'} "${res.data.category}"`);
      await load();
    } else {
      toast.error(res.error ?? 'Save failed');
      setRows(prev => prev.map((r, i) => i === idx ? { ...r, saving: false } : r));
    }
  };

  const del = async (idx: number) => {
    const row = rows[idx];
    if (!row.id) { setRows(prev => prev.filter((_, i) => i !== idx)); return; }
    if (!confirm(`Delete category "${row.category}"? This cannot be undone.`)) return;
    setDeleting(row.id);
    const res = await deleteCategoryRate(row.id);
    setDeleting(null);
    if (res.success) { toast.success('Category deleted'); await load(); }
    else toast.error(res.error ?? 'Delete failed');
  };

  const addRow = () => {
    setRows(prev => [...prev, { category: '', wastage_pct: '3.0', notes: '', isNew: true }]);
  };

  if (loading) return <div className="p-6"><TableSkeleton rows={5} cols={3} /></div>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Per-Category RM Wastage Rates</h3>
        <p className="text-sm text-gray-500 mb-4">
          Wastage % applied per raw material category, blended by pct w/w.
          Falls back to the global RM wastage setting when a category has no entry.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-20">
            <tr className="bg-gray-50 border-b border-gray-200 [&_th]:bg-gray-50">
              <th scope="col" className="px-4 py-2 text-left font-medium text-gray-600">Category</th>
              <th scope="col" className="px-4 py-2 text-center font-medium text-gray-600">Wastage %</th>
              <th scope="col" className="px-4 py-2 text-left font-medium text-gray-600">Notes</th>
              <th scope="col" className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id ?? `new-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-2">
                  {row.isNew ? (
                    <input
                      type="text"
                      aria-label="Category"
                      className="border border-gray-300 rounded px-2 py-1 text-sm w-40 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={row.category}
                      onChange={e => update(i, 'category', e.target.value)}
                      placeholder="e.g. Emollient"
                      autoFocus
                    />
                  ) : (
                    <span className="font-medium text-gray-800">{row.category}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      aria-label="Wastage %"
                      className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={row.wastage_pct}
                      onChange={e => update(i, 'wastage_pct', e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') save(i); }}
                    />
                    <span className="text-gray-400 text-xs">%</span>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    aria-label="Optional note"
                    className="border border-gray-300 rounded px-2 py-1 text-sm w-48 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={row.notes}
                    onChange={e => update(i, 'notes', e.target.value)}
                    placeholder="Optional note"
                    onKeyDown={e => { if (e.key === 'Enter') save(i); }}
                  />
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => save(i)}
                      disabled={!!row.saving}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40"
                    >
                      <Save className="h-3 w-3" />
                      {row.saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => del(i)}
                      disabled={deleting === row.id}
                      className="p-1 text-red-500 hover:text-red-700 disabled:opacity-40"
                      title="Delete"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={addRow}
        className="flex items-center gap-2 px-3 py-2 text-sm border border-dashed border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 hover:border-gray-400"
      >
        <Plus className="h-4 w-4" />
        Add Category
      </button>
    </div>
  );
}
