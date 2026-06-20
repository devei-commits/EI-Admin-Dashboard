/**
 * Timeline Configuration — Procurement, Manufacturing, QC, Dispatch rules.
 * All values feed the timing engine; admin-editable with full CRUD.
 */
import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { inputClassName, selectClassName, ConfirmDialog } from '../../../components/ui';
import * as api from '../../../services/quotations.service';
import type { ProcurementRule, ManufacturingRule, QcRule, DispatchRule } from '../../../services/quotations.service';

type Sub = 'procurement' | 'manufacturing' | 'qc' | 'dispatch';
const SUBS: { key: Sub; label: string }[] = [
  { key: 'procurement', label: 'Procurement' }, { key: 'manufacturing', label: 'Manufacturing' },
  { key: 'qc', label: 'QC' }, { key: 'dispatch', label: 'Dispatch' },
];

export default function TimelineConfig() {
  const [sub, setSub] = useState<Sub>('procurement');
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 flex-wrap">
        {SUBS.map((s) => (
          <button key={s.key} onClick={() => setSub(s.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${sub === s.key ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s.label}
          </button>
        ))}
      </div>
      {sub === 'procurement' && <ProcurementTab />}
      {sub === 'manufacturing' && <ManufacturingTab />}
      {sub === 'qc' && <QcTab />}
      {sub === 'dispatch' && <DispatchTab />}
    </div>
  );
}

// ─────────────── Procurement ───────────────
function ProcurementTab() {
  const [type, setType] = useState<'RM' | 'PM'>('RM');
  const [rows, setRows] = useState<ProcurementRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState<Set<number>>(new Set());
  const [toDelete, setToDelete] = useState<ProcurementRule | null>(null);
  const [newKey, setNewKey] = useState(''); const [newInd, setNewInd] = useState('12'); const [newBatch, setNewBatch] = useState('10');

  const load = (t: 'RM' | 'PM') => { setLoading(true); setDirty(new Set()); api.fetchProcurementRules(t).then((r) => { setLoading(false); if (r.success) setRows(r.data); }); };
  useEffect(() => { load(type); }, [type]);

  const edit = (id: number, field: 'individual_lead_days' | 'batch_lead_days', v: string) => {
    setRows((p) => p.map((r) => r.id === id ? { ...r, [field]: v === '' ? null : Number(v) } : r));
    setDirty((d) => new Set(d).add(id));
  };
  const save = async (row: ProcurementRule) => {
    const r = await api.updateProcurementRule(row.id, { individual_lead_days: row.individual_lead_days, batch_lead_days: row.batch_lead_days });
    if (r.success) { toast.success('Saved'); setDirty((d) => { const n = new Set(d); n.delete(row.id); return n; }); } else toast.error(String(r.error));
  };
  const add = async () => {
    if (!newKey.trim()) { toast.error('Category/material required'); return; }
    const r = await api.createProcurementRule({ material_type: type, category_or_material: newKey, individual_lead_days: Number(newInd), batch_lead_days: Number(newBatch) });
    if (r.success) { toast.success('Rule added'); setNewKey(''); load(type); } else toast.error(String(r.error));
  };
  const confirmDelete = async () => { if (!toDelete) return; const r = await api.deleteProcurementRule(toDelete.id); setToDelete(null); if (r.success) { toast.success('Deleted'); load(type); } else toast.error(String(r.error)); };

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(['RM', 'PM'] as const).map((t) => (
          <button key={t} onClick={() => setType(t)} className={`px-3 py-1 rounded-md text-xs font-semibold ${type === t ? 'bg-slate-200 text-slate-900' : 'bg-gray-50 text-gray-500'}`}>{t}</button>
        ))}
      </div>
      <p className="text-xs text-gray-500">'DEFAULT' is the fallback for unmatched {type === 'RM' ? 'categories' : 'materials'}. Procurement = max across all lines.</p>
      {loading ? <Loader2 className="w-5 h-5 mx-auto text-slate-400 animate-spin my-6" /> : (
        <div className="border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50">
              <th className="py-2.5 px-3">{type === 'RM' ? 'Category' : 'Material'}</th><th className="py-2.5 px-3 text-right">Individual (d)</th><th className="py-2.5 px-3 text-right">Batch (d)</th><th className="py-2.5 px-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-1.5 px-3 text-gray-800">{row.category_or_material}</td>
                  <td className="py-1.5 px-3 text-right"><input className={`${inputClassName} py-1 px-2 w-20 text-right`} type="number" value={row.individual_lead_days} onChange={(e) => edit(row.id, 'individual_lead_days', e.target.value)} /></td>
                  <td className="py-1.5 px-3 text-right"><input className={`${inputClassName} py-1 px-2 w-20 text-right`} type="number" value={row.batch_lead_days ?? ''} onChange={(e) => edit(row.id, 'batch_lead_days', e.target.value)} /></td>
                  <td className="py-1.5 px-3 text-right whitespace-nowrap">
                    {dirty.has(row.id) && <button onClick={() => save(row)} className="text-emerald-600 p-1"><Save className="w-4 h-4" /></button>}
                    {row.category_or_material !== 'DEFAULT' && <button onClick={() => setToDelete(row)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-end gap-2 flex-wrap">
        <input className={`${inputClassName} w-56`} placeholder={type === 'RM' ? 'Category name' : 'Material name'} value={newKey} onChange={(e) => setNewKey(e.target.value)} />
        <input className={`${inputClassName} w-24`} type="number" placeholder="Individual" value={newInd} onChange={(e) => setNewInd(e.target.value)} />
        <input className={`${inputClassName} w-24`} type="number" placeholder="Batch" value={newBatch} onChange={(e) => setNewBatch(e.target.value)} />
        <button onClick={add} className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900"><Plus className="w-4 h-4" /> Add</button>
      </div>
      <ConfirmDialog isOpen={!!toDelete} onClose={() => setToDelete(null)} onConfirm={confirmDelete} title="Delete rule?" message={toDelete ? `Delete "${toDelete.category_or_material}"?` : ''} confirmText="Delete" variant="danger" />
    </div>
  );
}

// ─────────────── Manufacturing ───────────────
const PRODUCT_TYPES = ['serum', 'emulsion', 'wash', 'gel', 'general'];
function ManufacturingTab() {
  const [filter, setFilter] = useState('');
  const [rows, setRows] = useState<ManufacturingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState<Set<number>>(new Set());
  const [toDelete, setToDelete] = useState<ManufacturingRule | null>(null);
  const [nType, setNType] = useState('serum'); const [nSub, setNSub] = useState(''); const [nBand, setNBand] = useState('0'); const [nDays, setNDays] = useState('3');

  const load = () => { setLoading(true); setDirty(new Set()); api.fetchManufacturingRules(filter || undefined).then((r) => { setLoading(false); if (r.success) setRows(r.data); }); };
  useEffect(load, [filter]);

  const edit = (id: number, field: 'manufacturing_days' | 'cycle_time_days', v: string) => {
    setRows((p) => p.map((r) => r.id === id ? { ...r, [field]: v === '' ? null : Number(v) } : r));
    setDirty((d) => new Set(d).add(id));
  };
  const save = async (row: ManufacturingRule) => {
    const r = await api.updateManufacturingRule(row.id, { manufacturing_days: row.manufacturing_days, cycle_time_days: row.cycle_time_days });
    if (r.success) { toast.success('Saved'); setDirty((d) => { const n = new Set(d); n.delete(row.id); return n; }); } else toast.error(String(r.error));
  };
  const add = async () => {
    const r = await api.createManufacturingRule({ product_type: nType, product_subtype: nSub, band_index: Number(nBand), manufacturing_days: Number(nDays) });
    if (r.success) { toast.success('Rule added'); load(); } else toast.error(String(r.error));
  };
  const confirmDelete = async () => { if (!toDelete) return; const r = await api.deleteManufacturingRule(toDelete.id); setToDelete(null); if (r.success) { toast.success('Deleted'); load(); } else toast.error(String(r.error)); };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Filter:</span>
        <select className={`${selectClassName} py-1.5 w-40`} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All types</option>
          {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-xs text-gray-400">Empty subtype = base rule for that type. Band 0 = smallest MOQ.</span>
      </div>
      {loading ? <Loader2 className="w-5 h-5 mx-auto text-slate-400 animate-spin my-6" /> : (
        <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50">
              <th className="py-2.5 px-3">Type</th><th className="py-2.5 px-3">Subtype</th><th className="py-2.5 px-3 text-right">Band</th><th className="py-2.5 px-3 text-right">Mfg (d)</th><th className="py-2.5 px-3 text-right">Cycle (d)</th><th className="py-2.5 px-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-1.5 px-3 text-gray-800">{row.product_type}</td>
                  <td className="py-1.5 px-3 text-gray-500">{row.product_subtype || '—'}</td>
                  <td className="py-1.5 px-3 text-right text-gray-500">{row.band_index}</td>
                  <td className="py-1.5 px-3 text-right"><input className={`${inputClassName} py-1 px-2 w-16 text-right`} type="number" value={row.manufacturing_days} onChange={(e) => edit(row.id, 'manufacturing_days', e.target.value)} /></td>
                  <td className="py-1.5 px-3 text-right"><input className={`${inputClassName} py-1 px-2 w-16 text-right`} type="number" placeholder="=mfg" value={row.cycle_time_days ?? ''} onChange={(e) => edit(row.id, 'cycle_time_days', e.target.value)} /></td>
                  <td className="py-1.5 px-3 text-right whitespace-nowrap">
                    {dirty.has(row.id) && <button onClick={() => save(row)} className="text-emerald-600 p-1"><Save className="w-4 h-4" /></button>}
                    <button onClick={() => setToDelete(row)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-end gap-2 flex-wrap border-t border-gray-100 pt-3">
        <select className={`${selectClassName} w-32`} value={nType} onChange={(e) => setNType(e.target.value)}>{PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        <input className={`${inputClassName} w-36`} placeholder="Subtype (optional)" value={nSub} onChange={(e) => setNSub(e.target.value)} />
        <select className={`${selectClassName} w-20`} value={nBand} onChange={(e) => setNBand(e.target.value)}>{[0, 1, 2, 3, 4, 5, 6].map((b) => <option key={b} value={b}>{b}</option>)}</select>
        <input className={`${inputClassName} w-20`} type="number" placeholder="Days" value={nDays} onChange={(e) => setNDays(e.target.value)} />
        <button onClick={add} className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900"><Plus className="w-4 h-4" /> Add</button>
      </div>
      <ConfirmDialog isOpen={!!toDelete} onClose={() => setToDelete(null)} onConfirm={confirmDelete} title="Delete rule?" message={toDelete ? `Delete ${toDelete.product_type} band ${toDelete.band_index}?` : ''} confirmText="Delete" variant="danger" />
    </div>
  );
}

// ─────────────── QC ───────────────
function QcTab() {
  const [rows, setRows] = useState<QcRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState<Set<number>>(new Set());
  const load = () => { setLoading(true); setDirty(new Set()); api.fetchQcRules().then((r) => { setLoading(false); if (r.success) setRows(r.data); }); };
  useEffect(load, []);
  const edit = (id: number, v: string) => { setRows((p) => p.map((r) => r.id === id ? { ...r, qc_days: Number(v) } : r)); setDirty((d) => new Set(d).add(id)); };
  const save = async (row: QcRule) => { const r = await api.upsertQcRule({ grade_ref: row.grade_ref, qc_days: row.qc_days }); if (r.success) { toast.success('Saved'); setDirty((d) => { const n = new Set(d); n.delete(row.id); return n; }); } else toast.error(String(r.error)); };
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">QC days per grade. 'default' is the fallback for custom grades without an explicit rule.</p>
      {loading ? <Loader2 className="w-5 h-5 mx-auto text-slate-400 animate-spin my-6" /> : (
        <div className="border border-gray-200 rounded-lg overflow-hidden max-w-md">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50"><th className="py-2.5 px-3">Grade Ref</th><th className="py-2.5 px-3 text-right">QC Days</th><th className="py-2.5 px-3"></th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-1.5 px-3 text-gray-800 font-medium">{row.grade_ref}</td>
                  <td className="py-1.5 px-3 text-right"><input className={`${inputClassName} py-1 px-2 w-20 text-right`} type="number" value={row.qc_days} onChange={(e) => edit(row.id, e.target.value)} /></td>
                  <td className="py-1.5 px-3 text-right">{dirty.has(row.id) && <button onClick={() => save(row)} className="text-emerald-600 p-1"><Save className="w-4 h-4" /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────── Dispatch ───────────────
function DispatchTab() {
  const [rows, setRows] = useState<DispatchRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState<Set<number>>(new Set());
  const load = () => { setLoading(true); setDirty(new Set()); api.fetchDispatchRules().then((r) => { setLoading(false); if (r.success) setRows(r.data); }); };
  useEffect(load, []);
  const edit = (id: number, v: string) => { setRows((p) => p.map((r) => r.id === id ? { ...r, dispatch_days: Number(v) } : r)); setDirty((d) => new Set(d).add(id)); };
  const save = async (row: DispatchRule) => { const r = await api.upsertDispatchRule({ grade_ref: row.grade_ref, dispatch_days: row.dispatch_days }); if (r.success) { toast.success('Saved'); setDirty((d) => { const n = new Set(d); n.delete(row.id); return n; }); } else toast.error(String(r.error)); };
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Dispatch days. 'default' applies to all grades unless overridden.</p>
      {loading ? <Loader2 className="w-5 h-5 mx-auto text-slate-400 animate-spin my-6" /> : (
        <div className="border border-gray-200 rounded-lg overflow-hidden max-w-md">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50"><th className="py-2.5 px-3">Grade Ref</th><th className="py-2.5 px-3 text-right">Dispatch Days</th><th className="py-2.5 px-3"></th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-1.5 px-3 text-gray-800 font-medium">{row.grade_ref}</td>
                  <td className="py-1.5 px-3 text-right"><input className={`${inputClassName} py-1 px-2 w-20 text-right`} type="number" value={row.dispatch_days} onChange={(e) => edit(row.id, e.target.value)} /></td>
                  <td className="py-1.5 px-3 text-right">{dirty.has(row.id) && <button onClick={() => save(row)} className="text-emerald-600 p-1"><Save className="w-4 h-4" /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
