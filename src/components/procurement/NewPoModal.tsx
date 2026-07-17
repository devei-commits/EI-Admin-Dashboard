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
import {
  serializeStagedPaymentTerms,
  validateStagedPercents,
  formatStagedPaymentTermsObject,
  type StagedPaymentTerms,
} from '../../lib/stagedPaymentTerms';

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
  /** Auto-derived from the picked item (RM/PM) — no longer a manual selector. */
  type: 'RM' | 'PM';
  itemName: string;
  itemCode: string;
  /** Selected RM/PM master option key ('rm:123' | 'pm:45'); empty when free-typed. */
  itemKey: string;
  rawMaterialId?: number;
  packMaterialId?: number;
  qty: string;
}
const emptyLine = (): LineDraft => ({ type: 'RM', itemName: '', itemCode: '', itemKey: '', qty: '' });
/** Qty unit is auto-set by item kind: KG for RMs, PCS for PMs. */
const unitForType = (type: 'RM' | 'PM') => (type === 'PM' ? 'PCS' : 'KG');

function todayIso(): string {
  // Local-safe YYYY-MM-DD without Date.now math elsewhere.
  return new Date().toISOString().slice(0, 10);
}

export const NewPoModal: React.FC<NewPoModalProps> = ({ poNumber, vendors, onClose, onCreate }) => {
  const [vendorName, setVendorName] = useState('');
  const [poType, setPoType] = useState<PoType>('regular');
  const [orderDate, setOrderDate] = useState(todayIso());
  const [expectedDate, setExpectedDate] = useState('');
  // Staged payment split (same model as Planning / SO): advance · pre-shipment · post-shipment + credit.
  const [advancePctStr, setAdvancePctStr] = useState('0');
  const [preShipmentPctStr, setPreShipmentPctStr] = useState('0');
  const [postShipmentPctStr, setPostShipmentPctStr] = useState('0');
  const [creditDaysStr, setCreditDaysStr] = useState('');
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
  // Item name drives everything now (no manual Type): search RM + PM together; the picked item's
  // kind sets the row Type and its Qty unit (KG / PCS). Suggestions filter by query before the 50-cap.
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
    setLine(i, { itemKey: '', itemCode: '', type: 'RM', rawMaterialId: undefined, packMaterialId: undefined });

  const validLines = lines.filter((l) => l.itemName.trim() && Number(l.qty) > 0);
  const matchedVendor = useMemo(
    () => vendors.find((v) => v.name.trim().toLowerCase() === vendorName.trim().toLowerCase()) || null,
    [vendors, vendorName],
  );

  // Staged payment split (advance · pre-shipment · post-shipment + credit) — serialized to JSON like SO/Planning.
  const stagedTerms: StagedPaymentTerms = {
    advance_pct: Number(advancePctStr) || 0,
    pre_shipment_pct: Number(preShipmentPctStr) || 0,
    post_shipment_pct: Number(postShipmentPctStr) || 0,
    credit_days: Math.max(0, Math.floor(Number(creditDaysStr) || 0)),
  };
  const ptError = validateStagedPercents(stagedTerms.advance_pct, stagedTerms.pre_shipment_pct, stagedTerms.post_shipment_pct);
  const ptSummary = formatStagedPaymentTermsObject(stagedTerms);

  const submit = async () => {
    setErr(null);
    if (!vendorName.trim()) { setErr('Select or enter a vendor.'); return; }
    if (validLines.length === 0) { setErr('Add at least one line with an item name and quantity.'); return; }
    if (ptError) { setErr(ptError); return; }
    const items = validLines.map((l) => ({
      itemName: l.itemName.trim(),
      itemCode: l.itemCode.trim() || `MAN-${l.type}-${Math.abs(Math.round(Number(l.qty) || 0))}`,
      type: l.type,
      quantity: String(Number(l.qty) || 0),
      unit: unitForType(l.type), // KG for RM, PCS for PM — auto-set; price is captured later
      // Link to the master when picked from suggestions (enables warehouse / Items-Involved matching).
      ...(l.rawMaterialId != null ? { raw_material_id: l.rawMaterialId } : {}),
      ...(l.packMaterialId != null ? { pack_material_id: l.packMaterialId } : {}),
    }));
    const payload: NewPoPayload = {
      orderId: poNumber,
      vendorName: vendorName.trim(),
      orderDate,
      expectedShipmentDate: expectedDate || undefined,
      paymentTerms: serializeStagedPaymentTerms(stagedTerms),
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

        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Payment split (advance · pre-shipment · post-shipment)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">Advance %</label>
              <input value={advancePctStr} onChange={(e) => setAdvancePctStr(e.target.value)} inputMode="decimal" className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">Pre-shipment %</label>
              <input value={preShipmentPctStr} onChange={(e) => setPreShipmentPctStr(e.target.value)} inputMode="decimal" className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">Post-shipment %</label>
              <input value={postShipmentPctStr} onChange={(e) => setPostShipmentPctStr(e.target.value)} inputMode="decimal" className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">Credit (days)</label>
              <input value={creditDaysStr} onChange={(e) => setCreditDaysStr(e.target.value)} inputMode="numeric" className={inputCls} placeholder="—" />
            </div>
          </div>
          <p className="text-[11px] text-slate-600 mt-2">{ptSummary}</p>
          {ptError && <p className="text-[11px] text-red-600 mt-1">{ptError}</p>}
        </div>
      </ModalSection>

      <ModalSection title="Line items">
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500">
                {['Item name', 'Code', 'Qty req', ''].map((h) => <th key={h} className="px-2 py-1.5 text-left text-[10px] font-bold uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-2 py-1.5 min-w-[16rem]">
                    <MaterialMasterTypeahead
                      options={materialOptions}
                      loading={materialsLoading}
                      value={l.itemName}
                      selectedId={l.itemKey}
                      onValueChange={(next) => setLine(i, { itemName: next })}
                      onSelect={(opt) => selectLineItem(i, opt)}
                      onClearSelection={() => clearLineItem(i)}
                      requirePickFromList={false}
                      placeholder="Search item by name or code…"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input value={l.itemCode} readOnly title="Auto-filled from the selected item" className={`${inputCls} bg-slate-50 text-slate-600`} placeholder="—" />
                  </td>
                  <td className="px-2 py-1.5 w-36">
                    <div className="flex items-center gap-1.5">
                      <input value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} inputMode="decimal" className={inputCls} placeholder="0" />
                      <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap" title={`Auto-set: ${unitForType(l.type)} for ${l.type === 'PM' ? 'pack materials' : 'raw materials'}`}>{unitForType(l.type)}</span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5"><button type="button" onClick={() => removeLine(i)} disabled={lines.length === 1} className="text-slate-400 hover:text-red-600 disabled:opacity-30" aria-label="Remove line"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2">
          <button type="button" onClick={addLine} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"><Plus className="h-3.5 w-3.5" /> Add line</button>
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
