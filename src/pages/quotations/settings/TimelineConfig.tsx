/**
 * Timeline Configuration — Procurement, Manufacturing, QC, Dispatch rules.
 * All values feed the timing engine; admin-editable with full CRUD.
 */
import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { inputClassName, selectClassName, SearchInput, ConfirmDialog } from '../../../components/ui';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import * as api from '../../../services/quotations.service';
import type { ProcurementRule, ManufacturingRule, QcRule, DispatchRule, LeadTimeItem } from '../../../services/quotations.service';

type Sub = 'procurement' | 'manufacturing' | 'qc' | 'dispatch' | 'leads';
const SUBS: { key: Sub; label: string }[] = [
  { key: 'procurement', label: 'Procurement Rules' }, { key: 'manufacturing', label: 'Manufacturing' },
  { key: 'qc', label: 'QC' }, { key: 'dispatch', label: 'Dispatch' }, { key: 'leads', label: 'Material Leads' },
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
      {sub === 'leads' && <MaterialLeadsTab />}
    </div>
  );
}

// ─────────────── Material Leads (per-material lead_time_days) ───────────────
const LEADS_PAGE = 25;
function MaterialLeadsTab() {
  const [type, setType] = useState<'RM' | 'PM'>('RM');
  const [search, setSearch] = useState('');
  const [missingOnly, setMissingOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<LeadTimeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.fetchLeadTimes(type, search, missingOnly, LEADS_PAGE, page * LEADS_PAGE).then((r) => {
      setLoading(false);
      if (r.success && r.data) { setItems(r.data.items); setTotal(r.data.total); }
    });
  };
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [type, search, missingOnly, page]);
  useEffect(() => { setPage(0); setEdits({}); }, [type, search, missingOnly]);

  const dirty = Object.keys(edits).length > 0;
  const saveAll = async () => {
    const updates = Object.entries(edits).map(([id, v]) => ({ id: Number(id), lead_time_days: v.trim() === '' ? null : Number(v) }));
    setSaving(true);
    const r = await api.saveLeadTimes(type, updates);
    setSaving(false);
    if (r.success && r.data) { toast.success(`Updated ${r.data.updated} material(s)`); setEdits({}); load(); }
    else toast.error(String(r.error));
  };

  const totalPages = Math.max(1, Math.ceil(total / LEADS_PAGE));
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Set exact procurement lead time per material. The engine prefers this over the vendor rate and the category rule.</p>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1">
          {(['RM', 'PM'] as const).map((t) => (
            <button key={t} onClick={() => setType(t)} className={`px-3 py-1 rounded-md text-xs font-semibold ${type === t ? 'bg-slate-200 text-slate-900' : 'bg-gray-50 text-gray-500'}`}>{t}</button>
          ))}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search code or name…" className="max-w-xs" />
        <label className="flex items-center gap-1.5 text-sm text-gray-600"><input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} className="rounded border-gray-300 text-slate-800 focus:ring-slate-800" /> Missing only</label>
        {dirty && <button onClick={saveAll} disabled={saving} className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900 disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save {Object.keys(edits).length}</button>}
      </div>
      {loading ? <div className="my-6"><TableSkeleton rows={5} cols={4} /></div> : (
        <div className="border border-gray-200 rounded-lg overflow-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-20"><tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50 whitespace-nowrap [&_th]:bg-gray-50">
              <th scope="col" className="py-2.5 px-3">Code</th><th scope="col" className="py-2.5 px-3">Name</th><th scope="col" className="py-2.5 px-3">{type === 'RM' ? 'Category' : 'Material'}</th><th scope="col" className="py-2.5 px-3 text-right">Vendor lead</th><th scope="col" className="py-2.5 px-3 text-right">Master lead (d)</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {items.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-gray-400">No materials match.</td></tr>}
              {items.map((it) => (
                <tr key={it.id} className={edits[it.id] !== undefined ? 'bg-amber-50/40' : ''}>
                  <td className="py-1.5 px-3 font-medium text-slate-900">{it.code}</td>
                  <td className="py-1.5 px-3 text-gray-600 truncate max-w-[18rem]" title={it.name}>{it.name}</td>
                  <td className="py-1.5 px-3 text-gray-500">{it.klass || '—'}</td>
                  <td className="py-1.5 px-3 text-right text-gray-400">{it.vendor_lead ?? '—'}</td>
                  <td className="py-1.5 px-3 text-right">
                    <input className={`${inputClassName} py-1 px-2 w-20 text-right`} type="number" placeholder={it.vendor_lead != null ? `${it.vendor_lead} (vendor)` : 'rule'}
                      value={edits[it.id] !== undefined ? edits[it.id] : (it.lead_time_days ?? '')}
                      onChange={(e) => setEdits((p) => ({ ...p, [it.id]: e.target.value }))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">{total} materials · page {page + 1}/{totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 bg-gray-100 rounded-lg text-gray-700 disabled:opacity-40">Prev</button>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 bg-gray-100 rounded-lg text-gray-700 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
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
      {loading ? <div className="my-6"><TableSkeleton rows={5} cols={4} /></div> : (
        <div className="border border-gray-200 rounded-lg overflow-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-20"><tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50 [&_th]:bg-gray-50">
              <th scope="col" className="py-2.5 px-3">{type === 'RM' ? 'Category' : 'Material'}</th><th scope="col" className="py-2.5 px-3 text-right">Individual (d)</th><th scope="col" className="py-2.5 px-3 text-right">Batch (d)</th><th scope="col" className="py-2.5 px-3"></th>
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
      {loading ? <div className="my-6"><TableSkeleton rows={5} cols={4} /></div> : (
        <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-20"><tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50 [&_th]:bg-gray-50">
              <th scope="col" className="py-2.5 px-3">Type</th><th scope="col" className="py-2.5 px-3">Subtype</th><th scope="col" className="py-2.5 px-3 text-right">Band</th><th scope="col" className="py-2.5 px-3 text-right">Mfg (d)</th><th scope="col" className="py-2.5 px-3 text-right">Cycle (d)</th><th scope="col" className="py-2.5 px-3"></th>
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
      {loading ? <div className="my-6"><TableSkeleton rows={5} cols={4} /></div> : (
        <div className="border border-gray-200 rounded-lg overflow-hidden max-w-md">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-20"><tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50 [&_th]:bg-gray-50"><th scope="col" className="py-2.5 px-3">Grade Ref</th><th scope="col" className="py-2.5 px-3 text-right">QC Days</th><th scope="col" className="py-2.5 px-3"></th></tr></thead>
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
      {loading ? <div className="my-6"><TableSkeleton rows={5} cols={4} /></div> : (
        <div className="border border-gray-200 rounded-lg overflow-hidden max-w-md">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-20"><tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50 [&_th]:bg-gray-50"><th scope="col" className="py-2.5 px-3">Grade Ref</th><th scope="col" className="py-2.5 px-3 text-right">Dispatch Days</th><th scope="col" className="py-2.5 px-3"></th></tr></thead>
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
