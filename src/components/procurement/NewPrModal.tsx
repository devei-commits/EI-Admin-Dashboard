/**
 * New (manual / direct) Procurement Request — Flowchart SEED "Direct PR (manual)".
 * Creates a PR without a Planning row (source='manual'). Multi-line.
 */
import React, { useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { ProcModalShell, ModalSection } from './ProcModalShell';
import type { CreateProcurementPayload, ProcurementRequestItem } from '../../services/procurement.service';

export interface NewPrModalProps {
  onClose: () => void;
  onCreate: (payload: CreateProcurementPayload) => Promise<boolean>;
}

interface LineDraft {
  type: 'RM' | 'PM';
  code: string;
  name: string;
  qty: string;
  unit: string;
  price: string;
}

const emptyLine = (): LineDraft => ({ type: 'RM', code: '', name: '', qty: '', unit: '', price: '' });

export const NewPrModal: React.FC<NewPrModalProps> = ({ onClose, onCreate }) => {
  const [priority, setPriority] = useState('Medium');
  const [requiredBy, setRequiredBy] = useState('');
  const [preferredVendor, setPreferredVendor] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const setLine = (i: number, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (i: number) => setLines((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const validLines = lines.filter((l) => l.name.trim() && Number(l.qty) > 0);

  const submit = async () => {
    setErr(null);
    if (validLines.length === 0) { setErr('Add at least one line with an item name and a positive quantity.'); return; }
    const items: ProcurementRequestItem[] = validLines.map((l) => {
      const qty = Number(l.qty) || 0;
      const price = Number(l.price) || 0;
      return {
        type: l.type,
        code: l.code.trim() || `MAN-${l.type}-${Math.abs(Math.round(qty))}`,
        name: l.name.trim(),
        required: qty,
        sih: 0,
        shortage: qty,
        quantity_requested: qty,
        unit: l.unit.trim() || (l.type === 'PM' ? 'PCS' : 'KG'),
        ...(price > 0 ? { planned_unit_price: price } : {}),
      };
    });
    const payload: CreateProcurementPayload = {
      source: 'manual',
      priority,
      requiredByDate: requiredBy || null,
      notes: notes.trim() || null,
      preferredVendor: preferredVendor.trim() || null,
      items,
    };
    setBusy(true);
    const ok = await onCreate(payload);
    setBusy(false);
    if (ok) onClose();
    else setErr('Failed to create the procurement request.');
  };

  const inputCls = 'w-full rounded border border-slate-300 px-2 py-1.5 text-xs';

  return (
    <ProcModalShell
      eyebrow="Procurement Request · manual"
      title="New Procurement Request"
      subtitle="Direct PR — not from Planning"
      width="max-w-3xl"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-white disabled:opacity-60">Cancel</button>
          <button type="button" onClick={() => void submit()} disabled={busy || validLines.length === 0} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60 inline-flex items-center gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create PR
          </button>
        </>
      }
    >
      <ModalSection title="Request">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
              {['Low', 'Medium', 'High'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Required by</label>
            <input type="date" value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Preferred vendor (optional)</label>
            <input value={preferredVendor} onChange={(e) => setPreferredVendor(e.target.value)} className={inputCls} placeholder="Vendor name" />
          </div>
        </div>
      </ModalSection>

      <ModalSection title="Line items">
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500">
                {['Type', 'Item name', 'Code', 'Qty', 'Unit', '₹/unit', ''].map((h) => (
                  <th key={h} className="px-2 py-1.5 text-left text-[10px] font-bold uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-2 py-1.5">
                    <select value={l.type} onChange={(e) => setLine(i, { type: e.target.value as 'RM' | 'PM' })} className={inputCls}>
                      <option value="RM">RM</option>
                      <option value="PM">PM</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5"><input value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} className={inputCls} placeholder="Item name" /></td>
                  <td className="px-2 py-1.5"><input value={l.code} onChange={(e) => setLine(i, { code: e.target.value })} className={inputCls} placeholder="Code" /></td>
                  <td className="px-2 py-1.5 w-20"><input value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} inputMode="decimal" className={inputCls} placeholder="0" /></td>
                  <td className="px-2 py-1.5 w-20"><input value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} className={inputCls} placeholder={l.type === 'PM' ? 'PCS' : 'KG'} /></td>
                  <td className="px-2 py-1.5 w-24"><input value={l.price} onChange={(e) => setLine(i, { price: e.target.value })} inputMode="decimal" className={inputCls} placeholder="0" /></td>
                  <td className="px-2 py-1.5">
                    <button type="button" onClick={() => removeLine(i)} disabled={lines.length === 1} className="text-slate-400 hover:text-red-600 disabled:opacity-30" aria-label="Remove line"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addLine} className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50">
          <Plus className="h-3.5 w-3.5" /> Add line
        </button>
      </ModalSection>

      <ModalSection title="Notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Optional notes / justification…" />
      </ModalSection>

      {err && <p className="text-[12px] text-red-600">{err}</p>}
    </ProcModalShell>
  );
};

export default NewPrModal;
