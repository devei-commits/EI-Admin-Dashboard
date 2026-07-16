/**
 * New (manual) Purchase Order — Flowchart SEED "Direct PO".
 * Creates a Draft PO without a Procurement Request; it then enters the normal
 * approval → vendor → GRN → match flow. PO type is captured up front.
 */
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { ProcModalShell, ModalSection } from './ProcModalShell';
import { PO_TYPE_ORDER, PO_TYPE_CONFIG, type PoType } from '../../constants/procurement';
import MaterialMasterTypeahead from '../MaterialMasterTypeahead';
import { buildMaterialTypeaheadOptions, type MaterialTypeaheadOption } from '../../lib/materialTypeahead';
import { fetchRawMaterialsList } from '../../services/rawMaterials.service';
import { fetchPackMaterialsList } from '../../services/packMaterials.service';

export interface NewPoVendorOption {
  id: string | number;
  name: string;
  vendorCode?: string | null;
  paymentTerms?: string | null;
}

export interface NewPoPayload {
  orderId: string;
  vendorName: string;
  orderDate?: string;
  expectedShipmentDate?: string;
  paymentTerms?: string;
  status: string;
  formData: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
}

export interface NewPoModalProps {
  poNumber: string;
  vendors: NewPoVendorOption[];
  onClose: () => void;
  onCreate: (payload: NewPoPayload) => Promise<boolean>;
}

interface LineDraft {
  type: 'RM' | 'PM';
  itemName: string;
  itemCode: string;
  /** Selected RM/PM master option key ('rm:123' | 'pm:45'); empty when free-typed. */
  itemKey: string;
  rawMaterialId?: number;
  packMaterialId?: number;
  qty: string;
  rate: string;
  tax: string;
}
const emptyLine = (): LineDraft => ({ type: 'RM', itemName: '', itemCode: '', itemKey: '', qty: '', rate: '', tax: '18' });

function todayIso(): string {
  // Local-safe YYYY-MM-DD without Date.now math elsewhere.
  return new Date().toISOString().slice(0, 10);
}

export const NewPoModal: React.FC<NewPoModalProps> = ({ poNumber, vendors, onClose, onCreate }) => {
  const [vendorName, setVendorName] = useState('');
  const [poType, setPoType] = useState<PoType>('regular');
  const [orderDate, setOrderDate] = useState(todayIso());
  const [expectedDate, setExpectedDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const setLine = (i: number, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (i: number) => setLines((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  // RM/PM masters for the item-name typeahead (self-contained — no extra props needed).
  const { data: rmList = [], isLoading: rmLoading } = useQuery({
    queryKey: ['raw-materials', 'for-po-line'],
    queryFn: () => fetchRawMaterialsList(),
    staleTime: 5 * 60_000,
  });
  const { data: pmList = [], isLoading: pmLoading } = useQuery({
    queryKey: ['pack-materials', 'for-po-line'],
    queryFn: () => fetchPackMaterialsList(),
    staleTime: 5 * 60_000,
  });
  const materialOptions = useMemo(() => buildMaterialTypeaheadOptions(rmList, pmList), [rmList, pmList]);
  const materialsLoading = rmLoading || pmLoading;

  // Picking a suggestion fills name + code + RM/PM id and aligns the row's Type to the item's kind.
  const selectLineItem = (i: number, opt: MaterialTypeaheadOption) =>
    setLine(i, {
      itemName: opt.name,
      itemCode: opt.code,
      itemKey: opt.key,
      type: opt.kind === 'pm' ? 'PM' : 'RM',
      rawMaterialId: opt.rawMaterialId,
      packMaterialId: opt.packMaterialId,
    });
  const clearLineItem = (i: number) =>
    setLine(i, { itemKey: '', itemCode: '', rawMaterialId: undefined, packMaterialId: undefined });

  const validLines = lines.filter((l) => l.itemName.trim() && Number(l.qty) > 0 && Number(l.rate) >= 0);
  const matchedVendor = useMemo(
    () => vendors.find((v) => v.name.trim().toLowerCase() === vendorName.trim().toLowerCase()) || null,
    [vendors, vendorName],
  );
  const grandTotal = validLines.reduce((s, l) => {
    const base = (Number(l.qty) || 0) * (Number(l.rate) || 0);
    return s + base + base * ((Number(l.tax) || 0) / 100);
  }, 0);

  const submit = async () => {
    setErr(null);
    if (!vendorName.trim()) { setErr('Select or enter a vendor.'); return; }
    if (validLines.length === 0) { setErr('Add at least one line with item name, qty and rate.'); return; }
    const items = validLines.map((l) => ({
      itemName: l.itemName.trim(),
      itemCode: l.itemCode.trim() || `MAN-${l.type}-${Math.abs(Math.round(Number(l.qty) || 0))}`,
      type: l.type,
      quantity: String(Number(l.qty) || 0),
      rate: String(Number(l.rate) || 0),
      tax: String(Number(l.tax) || 0),
      // Link to the master when picked from suggestions (enables warehouse / Items-Involved matching).
      ...(l.rawMaterialId != null ? { raw_material_id: l.rawMaterialId } : {}),
      ...(l.packMaterialId != null ? { pack_material_id: l.packMaterialId } : {}),
    }));
    const payload: NewPoPayload = {
      orderId: poNumber,
      vendorName: vendorName.trim(),
      orderDate,
      expectedShipmentDate: expectedDate || undefined,
      paymentTerms: paymentTerms.trim() || matchedVendor?.paymentTerms || undefined,
      status: 'Draft',
      formData: {
        poType,
        manual: true,
        draftNotes: notes.trim() || undefined,
        ...(matchedVendor ? { vendorClientId: matchedVendor.id, vendorEntityCode: matchedVendor.vendorCode ?? undefined } : {}),
      },
      items,
    };
    setBusy(true);
    const ok = await onCreate(payload);
    setBusy(false);
    if (ok) onClose();
    else setErr('Failed to create the purchase order.');
  };

  const inputCls = 'w-full rounded border border-slate-300 px-2 py-1.5 text-xs';

  return (
    <ProcModalShell
      eyebrow="Purchase Order · manual"
      title="New Purchase Order"
      subtitle={<span className="font-mono">{poNumber}</span>}
      width="max-w-3xl"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-white disabled:opacity-60">Cancel</button>
          <button type="button" onClick={() => void submit()} disabled={busy || validLines.length === 0 || !vendorName.trim()} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60 inline-flex items-center gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create Draft PO
          </button>
        </>
      }
    >
      <ModalSection title="PO details">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Vendor</label>
            <input list="new-po-vendors" value={vendorName} onChange={(e) => setVendorName(e.target.value)} className={inputCls} placeholder="Vendor name" />
            <datalist id="new-po-vendors">
              {vendors.map((v) => <option key={String(v.id)} value={v.name} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Order date</label>
            <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Expected</label>
            <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">PO type</label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            {PO_TYPE_ORDER.map((t) => {
              const cfg = PO_TYPE_CONFIG[t];
              const active = poType === t;
              return (
                <button key={t} type="button" onClick={() => setPoType(t)} title={cfg.blurb}
                  className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold text-left transition ${active ? `${cfg.bg} ${cfg.text} ${cfg.border} ring-1 ring-inset ring-current` : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Payment terms (optional)</label>
          <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className={inputCls} placeholder={matchedVendor?.paymentTerms || 'e.g. Net 30'} />
        </div>
      </ModalSection>

      <ModalSection title="Line items">
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500">
                {['Type', 'Item name', 'Code', 'Qty', '₹/unit', 'GST %', ''].map((h) => <th key={h} className="px-2 py-1.5 text-left text-[10px] font-bold uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-2 py-1.5"><select value={l.type} onChange={(e) => setLine(i, { type: e.target.value as 'RM' | 'PM' })} className={inputCls}><option value="RM">RM</option><option value="PM">PM</option></select></td>
                  <td className="px-2 py-1.5 min-w-[15rem]">
                    <MaterialMasterTypeahead
                      options={materialOptions}
                      loading={materialsLoading}
                      value={l.itemName}
                      selectedId={l.itemKey}
                      onValueChange={(next) => setLine(i, { itemName: next })}
                      onSelect={(opt) => selectLineItem(i, opt)}
                      onClearSelection={() => clearLineItem(i)}
                      requirePickFromList={false}
                      placeholder="Search RM / PM by name or code…"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input value={l.itemCode} readOnly title="Auto-filled from the selected item" className={`${inputCls} bg-slate-50 text-slate-600`} placeholder="—" />
                  </td>
                  <td className="px-2 py-1.5 w-20"><input value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} inputMode="decimal" className={inputCls} placeholder="0" /></td>
                  <td className="px-2 py-1.5 w-24"><input value={l.rate} onChange={(e) => setLine(i, { rate: e.target.value })} inputMode="decimal" className={inputCls} placeholder="0" /></td>
                  <td className="px-2 py-1.5 w-16"><input value={l.tax} onChange={(e) => setLine(i, { tax: e.target.value })} inputMode="decimal" className={inputCls} placeholder="18" /></td>
                  <td className="px-2 py-1.5"><button type="button" onClick={() => removeLine(i)} disabled={lines.length === 1} className="text-slate-400 hover:text-red-600 disabled:opacity-30" aria-label="Remove line"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <button type="button" onClick={addLine} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"><Plus className="h-3.5 w-3.5" /> Add line</button>
          <span className="text-xs text-slate-600">Grand total (incl. GST): <b className="tabular-nums">₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</b></span>
        </div>
      </ModalSection>

      <ModalSection title="Notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Optional notes / T&C…" />
      </ModalSection>

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-[11px] text-blue-800">
        On create, this Draft PO enters the normal flow — submit it for approval from its detail panel.
      </div>
      {err && <p className="text-[12px] text-red-600">{err}</p>}
    </ProcModalShell>
  );
};

export default NewPoModal;
