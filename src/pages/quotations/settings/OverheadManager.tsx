/**
 * Overhead Management — category-wise overhead heads × 7 MOQ bands.
 * Category-specific rows override the 'all' baseline at the head level.
 * Inline-editable band values; add/delete heads.
 */
import { useState, useEffect } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { inputClassName, ConfirmDialog } from '../../../components/ui';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import * as api from '../../../services/quotations.service';
import type { OverheadRow } from '../../../services/quotations.service';

const CATEGORIES = ['all', 'serum', 'emulsion', 'wash', 'gel', 'general'];
const BAND_LABELS = ['500', '1K', '2.5K', '5K', '10K', '15K', '25K'];

export default function OverheadManager() {
  const [category, setCategory] = useState('all');
  const [rows, setRows] = useState<OverheadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState<Set<number>>(new Set());
  const [toDelete, setToDelete] = useState<OverheadRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newVals, setNewVals] = useState<string[]>(Array(7).fill('0'));

  const load = (cat: string) => { setLoading(true); setDirty(new Set()); api.fetchOverheads(cat).then((r) => { setLoading(false); if (r.success) setRows(r.data); }); };
  useEffect(() => { load(category); }, [category]);

  const editBand = (rowId: number, bandIdx: number, value: string) => {
    setRows((prev) => prev.map((r) => r.id === rowId ? { ...r, band_values: r.band_values.map((v, i) => i === bandIdx ? Number(value) : v) } : r));
    setDirty((d) => new Set(d).add(rowId));
  };

  const saveRow = async (row: OverheadRow) => {
    const r = await api.updateOverhead(row.id, { band_values: row.band_values });
    if (r.success) { toast.success(`${row.head_name} saved`); setDirty((d) => { const n = new Set(d); n.delete(row.id); return n; }); }
    else toast.error(String(r.error));
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const r = await api.deleteOverhead(toDelete.id);
    setToDelete(null);
    if (r.success) { toast.success('Head deleted'); load(category); } else toast.error(String(r.error));
  };

  const addHead = async () => {
    if (!newName.trim()) { toast.error('Head name required'); return; }
    const r = await api.createOverhead({ product_category: category, head_name: newName, band_values: newVals.map(Number) });
    if (r.success) { toast.success('Head added'); setAdding(false); setNewName(''); setNewVals(Array(7).fill('0')); load(category); }
    else toast.error(String(r.error));
  };

  const totals = BAND_LABELS.map((_, i) => rows.reduce((s, r) => s + (Number(r.band_values[i]) || 0), 0));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 flex-wrap">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${category === c ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {c}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        {category === 'all' ? "Baseline overhead applied to all products unless a category overrides a head." : `Overrides the 'all' baseline for ${category} products (per head).`}
      </p>

      {loading ? (
        <TableSkeleton rows={6} cols={8} />
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-20"><tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50 [&_th]:bg-gray-50">
              <th scope="col" className="py-2.5 px-3">Head</th>
              {BAND_LABELS.map((b) => <th scope="col" key={b} className="py-2.5 px-2 text-right">{b}</th>)}
              <th scope="col" className="py-2.5 px-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {rows.length === 0 && <tr><td colSpan={9} className="py-6 text-center text-gray-400">No overhead heads for this category{category !== 'all' ? " (uses 'all' baseline)" : ''}.</td></tr>}
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-1.5 px-3 text-gray-800 font-medium">{row.head_name}</td>
                  {row.band_values.map((v, i) => (
                    <td key={i} className="py-1.5 px-1"><input aria-label={`${row.head_name} — ${BAND_LABELS[i]}`} className={`${inputClassName} py-1 px-2 w-16 text-right`} type="number" step="0.01" value={v} onChange={(e) => editBand(row.id, i, e.target.value)} /></td>
                  ))}
                  <td className="py-1.5 px-3 text-right whitespace-nowrap">
                    {dirty.has(row.id) && <button onClick={() => saveRow(row)} aria-label="Save" className="text-emerald-600 hover:text-emerald-700 p-1" title="Save"><Save className="w-4 h-4" /></button>}
                    <button onClick={() => setToDelete(row)} aria-label="Delete" className="text-gray-400 hover:text-red-500 p-1" title="Delete"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold">
                <td className="py-2 px-3 text-gray-700">Total</td>
                {totals.map((t, i) => <td key={i} className="py-2 px-2 text-right text-slate-900">{t.toFixed(2)}</td>)}
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {adding ? (
        <div className="border border-gray-200 rounded-lg p-3 flex items-end gap-2 flex-wrap">
          <input className={`${inputClassName} w-48`} placeholder="Head name" aria-label="Head name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          {newVals.map((v, i) => <input key={i} aria-label={`New head — ${BAND_LABELS[i]}`} className={`${inputClassName} w-16 text-right`} type="number" step="0.01" value={v} onChange={(e) => setNewVals((p) => p.map((x, j) => j === i ? e.target.value : x))} title={BAND_LABELS[i]} />)}
          <button onClick={addHead} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900">Add</button>
          <button onClick={() => setAdding(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Head
        </button>
      )}

      <ConfirmDialog isOpen={!!toDelete} onClose={() => setToDelete(null)} onConfirm={confirmDelete}
        title="Delete overhead head?" message={toDelete ? `Delete "${toDelete.head_name}" from ${category}?` : ''} confirmText="Delete" variant="danger" />
    </div>
  );
}
