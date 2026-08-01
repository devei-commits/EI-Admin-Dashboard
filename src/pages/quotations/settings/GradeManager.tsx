/**
 * Grade Manager — system grades (read-only) + custom grade CRUD.
 * Each grade defines 7 MOQ bands: label, value, markup, and a conversion
 * bmap entry (bracket + factor), plus zero_pm and qc_days.
 */
import { useState, useEffect, useId } from 'react';
import { Plus, Pencil, Trash2, Lock, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { FormField, inputClassName, selectClassName, ConfirmDialog } from '../../../components/ui';
import { CardSkeleton } from '../../../components/ui/Skeleton';
import * as api from '../../../services/quotations.service';
import type { QuoteGrade, BmapEntry } from '../../../services/quotations.service';

const BRACKETS = ['1-1000', '1000-5000', '5000-10000', '10000+'];

const blankGrade = (): Partial<QuoteGrade> => ({
  name: '', description: '', zero_pm: false, qc_days: 7,
  moq_labels: ['500', '1,000', '2,500', '5,000', '10,000', '15,000', '25,000'],
  moq_values: [500, 1000, 2500, 5000, 10000, 15000, 25000],
  markups: [0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2],
  bmap: [
    { b: '1-1000', f: 1.05 }, { b: '1-1000', f: 1.0 }, { b: '1000-5000', f: 1.05 }, { b: '1000-5000', f: 1.0 },
    { b: '5000-10000', f: 1.0 }, { b: '10000+', f: 1.0 }, { b: '10000+', f: 0.92 },
  ],
});

export default function GradeManager() {
  const [grades, setGrades] = useState<QuoteGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<QuoteGrade> | null>(null);
  const [toDelete, setToDelete] = useState<QuoteGrade | null>(null);

  const load = () => { setLoading(true); api.fetchGrades().then((r) => { setLoading(false); if (r.success) setGrades(r.data); }); };
  useEffect(load, []);

  const confirmDelete = async () => {
    if (!toDelete) return;
    const r = await api.deleteGrade(toDelete.id);
    setToDelete(null);
    if (r.success) { toast.success('Grade deleted'); load(); } else toast.error(String(r.error));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-3">System grades are read-only. Create custom grades for bespoke pricing tiers.</p>
        <button onClick={() => setEditing(blankGrade())} className="inline-flex items-center gap-2 px-4 py-2 bg-ink text-white rounded-lg hover:bg-ink text-sm font-semibold">
          <Plus className="w-4 h-4" /> New Grade
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {grades.map((g) => (
            <div key={g.id} className="border border-border rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-ink">{g.name}</h4>
                    {g.is_system && <span className="inline-flex items-center gap-1 text-xs text-ink-3 bg-surface-3 px-2 py-0.5 rounded-full"><Lock className="w-3 h-3" /> system</span>}
                    {g.zero_pm && <span className="text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">no PM</span>}
                  </div>
                  {g.description && <p className="text-xs text-ink-3 mt-0.5">{g.description}</p>}
                </div>
                {!g.is_system && (
                  <div className="flex gap-1">
                    <button onClick={() => setEditing(g)} aria-label="Edit grade" className="text-ink-4 hover:text-ink-2 p-1"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setToDelete(g)} aria-label="Delete grade" className="text-ink-4 hover:text-err p-1"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
              <div className="mt-2 text-xs text-ink-2">
                MOQ {g.moq_labels[0]}–{g.moq_labels[6]} · Markup {(g.markups[0] * 100).toFixed(0)}%→{(g.markups[6] * 100).toFixed(0)}% · QC {g.qc_days ?? '—'}d
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <GradeEditor grade={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      <ConfirmDialog isOpen={!!toDelete} onClose={() => setToDelete(null)} onConfirm={confirmDelete}
        title="Delete grade?" message={toDelete ? `Delete custom grade "${toDelete.name}"?` : ''} confirmText="Delete" variant="danger" />
    </div>
  );
}

function GradeEditor({ grade, onClose, onSaved }: { grade: Partial<QuoteGrade>; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(grade.name ?? '');
  const [description, setDescription] = useState(grade.description ?? '');
  const [zeroPm, setZeroPm] = useState(!!grade.zero_pm);
  const [qcDays, setQcDays] = useState(String(grade.qc_days ?? 7));
  const [labels, setLabels] = useState<string[]>(grade.moq_labels ?? []);
  const [values, setValues] = useState<number[]>(grade.moq_values ?? []);
  const [markups, setMarkups] = useState<number[]>(grade.markups ?? []);
  const [bmap, setBmap] = useState<BmapEntry[]>(grade.bmap ?? []);
  const [saving, setSaving] = useState(false);
  const isEdit = grade.id != null;
  const headingId = useId();

  const setAt = <T,>(arr: T[], i: number, v: T, set: (a: T[]) => void) => { const c = [...arr]; c[i] = v; set(c); };

  const submit = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    const payload: Partial<QuoteGrade> = {
      name, description, zero_pm: zeroPm, qc_days: Number(qcDays) || null,
      moq_labels: labels, moq_values: values.map(Number), markups: markups.map(Number), bmap,
    };
    const r = isEdit ? await api.updateGrade(grade.id!, payload) : await api.createGrade(payload);
    setSaving(false);
    if (r.success) { toast.success(isEdit ? 'Grade updated' : 'Grade created'); onSaved(); } else toast.error(String(r.error));
  };

  return (
    <div className="fixed inset-0 bg-surface/60 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={headingId} className="bg-surface rounded-xl shadow-lg w-full max-w-3xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-5 border-b border-border sticky top-0 bg-surface">
          <h2 id={headingId} className="text-lg font-bold text-ink">{isEdit ? 'Edit Grade' : 'New Grade'}</h2>
          <button onClick={onClose} aria-label="Close" className="text-ink-4 hover:text-ink-2"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Name" required><input className={inputClassName} value={name} onChange={(e) => setName(e.target.value)} /></FormField>
            <FormField label="QC Days"><input className={inputClassName} type="number" value={qcDays} onChange={(e) => setQcDays(e.target.value)} /></FormField>
          </div>
          <FormField label="Description"><input className={inputClassName} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="optional" /></FormField>
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={zeroPm} onChange={(e) => setZeroPm(e.target.checked)} className="rounded border-border text-ink focus:ring-border" />
            Customer supplies packaging (zero PM cost)
          </label>

          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs font-semibold text-ink-3 uppercase tracking-wider border-b border-hairline bg-surface-2">
                <th scope="col" className="py-2 px-3">Band</th><th scope="col" className="py-2 px-3">MOQ Label</th><th scope="col" className="py-2 px-3">MOQ Value</th>
                <th scope="col" className="py-2 px-3">Markup %</th><th scope="col" className="py-2 px-3">Conv. Bracket</th><th scope="col" className="py-2 px-3">Factor</th>
              </tr></thead>
              <tbody className="divide-y divide-hairline">
                {Array.from({ length: 7 }).map((_, i) => (
                  <tr key={i}>
                    <td className="py-1.5 px-3 text-ink-4">{i}</td>
                    <td className="py-1.5 px-3"><input aria-label={`MOQ Label band ${i}`} className={`${inputClassName} py-1.5`} value={labels[i] ?? ''} onChange={(e) => setAt(labels, i, e.target.value, setLabels)} /></td>
                    <td className="py-1.5 px-3"><input aria-label={`MOQ Value band ${i}`} className={`${inputClassName} py-1.5 w-24`} type="number" value={values[i] ?? 0} onChange={(e) => setAt(values, i, Number(e.target.value), setValues)} /></td>
                    <td className="py-1.5 px-3"><input aria-label={`Markup % band ${i}`} className={`${inputClassName} py-1.5 w-20`} type="number" value={Math.round((markups[i] ?? 0) * 10000) / 100} onChange={(e) => setAt(markups, i, Number(e.target.value) / 100, setMarkups)} /></td>
                    <td className="py-1.5 px-3">
                      <select aria-label={`Conversion bracket band ${i}`} className={`${selectClassName} py-1.5`} value={bmap[i]?.b ?? '1-1000'} onChange={(e) => setAt(bmap, i, { ...(bmap[i] ?? { f: 1 }), b: e.target.value }, setBmap)}>
                        {BRACKETS.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 px-3"><input aria-label={`Factor band ${i}`} className={`${inputClassName} py-1.5 w-20`} type="number" step="0.01" value={bmap[i]?.f ?? 1} onChange={(e) => setAt(bmap, i, { ...(bmap[i] ?? { b: '1-1000' }), f: Number(e.target.value) }, setBmap)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="p-5 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-surface">
          <button onClick={onClose} className="px-5 py-2 bg-surface-3 text-ink-2 rounded-lg hover:bg-surface-3 text-sm font-medium">Cancel</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 bg-ink text-white rounded-lg hover:bg-ink text-sm font-semibold disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
