/**
 * Shared "Request Quotation" (RFQ) interface — identical in Planning (Items Involved → Request quotation
 * action) and Procurement (Quote Requests button + per-PR row action). Captures the qty to quote, a
 * vendor (or broadcast), expected required date, multiple MOQ qty tiers (no price — vendor fills prices
 * back), and notes. Submits a planning_quotation_ask (source = planning | procurement).
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { ProcModalShell, ModalSection } from './ProcModalShell';
import { procInputClass } from './ProcSection';
import VendorClientNameTypeahead from '../VendorClientNameTypeahead';
import MaterialMasterTypeahead from '../MaterialMasterTypeahead';
import { buildMaterialTypeaheadOptions, type MaterialTypeaheadOption } from '../../lib/materialTypeahead';
import { fetchVendorClients } from '../../services/vendorClient.service';
import { fetchRawMaterialsList } from '../../services/rawMaterials.service';
import { fetchPackMaterialsList } from '../../services/packMaterials.service';
import {
  createPlanningQuotationAsk,
  updatePlanningQuotationAsk,
  type CreatePlanningQuotationAskPayload,
  type PlanningQuotationAsk,
} from '../../services/planningQuotationAsks.service';

export interface RequestQuotationContext {
  itemType: 'RM' | 'PM';
  itemCode: string;
  itemName: string;
  rawMaterialId?: number | null;
  packMaterialId?: number | null;
  unit?: string;
  /** Set when opened from Planning (links the ask to a PI); omit for a Procurement-origin request. */
  planningExtractedId?: number | null;
  defaultQty?: number;
  /** When true (no fixed item), the modal shows an item typeahead to pick the RM/PM. */
  allowItemPick?: boolean;
}

interface PickedItem {
  itemType: 'RM' | 'PM';
  itemCode: string;
  itemName: string;
  rawMaterialId: number | null;
  packMaterialId: number | null;
  unit: string;
}

export interface RequestQuotationModalProps {
  context: RequestQuotationContext;
  /** When set, the modal edits this existing RFQ (updates instead of creating). */
  editAsk?: PlanningQuotationAsk | null;
  onClose: () => void;
  onSubmitted?: () => void;
}

const num = (v: string): number | null => {
  if (String(v).trim() === '') return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

export const RequestQuotationModal: React.FC<RequestQuotationModalProps> = ({ context, editAsk, onClose, onSubmitted }) => {
  const isEdit = !!editAsk;
  const [picked, setPicked] = useState<PickedItem>({
    itemType: context.itemType,
    itemCode: context.itemCode || '',
    itemName: context.itemName || '',
    rawMaterialId: context.rawMaterialId ?? null,
    packMaterialId: context.packMaterialId ?? null,
    unit: context.unit || (context.itemType === 'PM' ? 'PCS' : 'KG'),
  });
  const [itemKey, setItemKey] = useState('');
  const unit = picked.unit;
  const hasItem = !!picked.itemCode || picked.rawMaterialId != null || picked.packMaterialId != null;
  const [qty, setQty] = useState(context.defaultQty && context.defaultQty > 0 ? String(context.defaultQty) : '');
  const [vendorName, setVendorName] = useState(editAsk?.vendorHint ?? '');
  const [expectedDate, setExpectedDate] = useState(editAsk?.expectedRequiredDate ? String(editAsk.expectedRequiredDate).slice(0, 10) : '');
  const [moqs, setMoqs] = useState<string[]>(
    Array.isArray(editAsk?.moqBands) && editAsk!.moqBands!.length > 0 ? editAsk!.moqBands!.map((m) => String(m)) : ['']
  );
  const [notes, setNotes] = useState(editAsk?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { data: vendorList = [], isLoading: vendorsLoading } = useQuery({
    queryKey: ['vendor-clients', 'vendor', 'for-rfq'],
    queryFn: async () => {
      const res = await fetchVendorClients('vendor');
      return res.success ? res.data : [];
    },
    staleTime: 5 * 60_000,
  });
  const { data: rmList = [] } = useQuery({ queryKey: ['raw-materials', 'for-rfq'], queryFn: () => fetchRawMaterialsList(), staleTime: 5 * 60_000, enabled: !!context.allowItemPick });
  const { data: pmList = [] } = useQuery({ queryKey: ['pack-materials', 'for-rfq'], queryFn: () => fetchPackMaterialsList(), staleTime: 5 * 60_000, enabled: !!context.allowItemPick });
  const materialOptions = React.useMemo(() => buildMaterialTypeaheadOptions(rmList, pmList), [rmList, pmList]);
  const selectPickedItem = (opt: MaterialTypeaheadOption) => {
    const isPm = opt.kind === 'pm';
    setItemKey(opt.key);
    setPicked({
      itemType: isPm ? 'PM' : 'RM',
      itemCode: opt.code,
      itemName: opt.name,
      rawMaterialId: isPm ? null : (opt.rawMaterialId ?? null),
      packMaterialId: isPm ? (opt.packMaterialId ?? null) : null,
      unit: isPm ? 'PCS' : 'KG',
    });
  };

  const setMoq = (i: number, val: string) => setMoqs((prev) => prev.map((m, idx) => (idx === i ? val : m)));
  const addMoq = () => setMoqs((prev) => [...prev, '']);
  const removeMoq = (i: number) => setMoqs((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const submit = async () => {
    setErr(null);
    if (!hasItem) { setErr('Pick an item to quote.'); return; }
    const q = Number(qty) || 0;
    if (!(q > 0)) { setErr('Enter a quantity to quote.'); return; }
    const cleanMoqs = moqs.map((m) => num(m)).filter((n): n is number => n != null && n > 0);
    setBusy(true);
    if (isEdit && editAsk) {
      const res = await updatePlanningQuotationAsk(editAsk.id, {
        itemType: picked.itemType,
        rawMaterialId: picked.rawMaterialId,
        packMaterialId: picked.packMaterialId,
        itemCode: picked.itemCode,
        itemName: picked.itemName,
        quantityRequested: q,
        unit,
        vendorHint: vendorName.trim() || null,
        moqBands: cleanMoqs,
        expectedRequiredDate: expectedDate || null,
        notes: notes.trim(),
      });
      setBusy(false);
      if (res.success) { onSubmitted?.(); onClose(); }
      else setErr(res.error || 'Failed to update the quotation request.');
      return;
    }
    const payload: CreatePlanningQuotationAskPayload = {
      ...(context.planningExtractedId != null
        ? { planningExtractedId: context.planningExtractedId, source: 'planning' }
        : { source: 'procurement' }),
      itemType: picked.itemType,
      ...(picked.rawMaterialId != null ? { rawMaterialId: picked.rawMaterialId } : {}),
      ...(picked.packMaterialId != null ? { packMaterialId: picked.packMaterialId } : {}),
      itemCode: picked.itemCode,
      itemName: picked.itemName,
      quantityRequested: q,
      unit,
      vendorHint: vendorName.trim() || null,
      moqBands: cleanMoqs,
      expectedRequiredDate: expectedDate || null,
      notes: notes.trim() || undefined,
    };
    const res = await createPlanningQuotationAsk(payload);
    setBusy(false);
    if (res.success) { onSubmitted?.(); onClose(); }
    else setErr(res.error || 'Failed to send the quotation request.');
  };

  const inputCls = procInputClass;

  return (
    <ProcModalShell
      eyebrow="Quotation"
      title={isEdit ? 'Edit Quotation Request' : 'Request Quotation'}
      subtitle={<><span className="font-semibold text-ink">{context.itemName}</span> <span className="font-mono text-xs text-ink-3">{context.itemCode}</span></>}
      width="max-w-2xl"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 rounded-lg border border-border text-ink-2 text-sm font-semibold hover:bg-surface disabled:opacity-60">Cancel</button>
          <button type="button" onClick={() => void submit()} disabled={busy || !(Number(qty) > 0) || !hasItem} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-bold hover:bg-brand-press disabled:opacity-60 inline-flex items-center gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {isEdit ? 'Save changes' : 'Send request'}
          </button>
        </>
      }
    >
      <ModalSection title="What to quote">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className="block text-[11px] font-bold text-ink-3 uppercase mb-1">Item</label>
            {context.allowItemPick ? (
              <MaterialMasterTypeahead
                options={materialOptions}
                value={picked.itemName}
                selectedId={itemKey}
                onValueChange={(next) => setPicked((p) => ({ ...p, itemName: next }))}
                onSelect={selectPickedItem}
                onClearSelection={() => { setItemKey(''); setPicked((p) => ({ ...p, itemCode: '', rawMaterialId: null, packMaterialId: null })); }}
                requirePickFromList={false}
                placeholder="Search RM / PM by name or code…"
              />
            ) : (
              <>
                <div className="text-sm text-ink">{picked.itemName} <span className="text-[11px] font-semibold text-ink-3">({picked.itemType})</span></div>
                <div className="text-[11px] font-mono text-ink-3">{picked.itemCode}</div>
              </>
            )}
          </div>
          <div>
            <label className="block text-[11px] font-bold text-ink-3 uppercase mb-1">Qty to quote</label>
            <div className="flex items-center gap-1.5">
              <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" className={inputCls} placeholder="0" />
              <span className="text-[11px] font-semibold text-ink-3">{unit}</span>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-ink-3 uppercase mb-1">Expected by</label>
            <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className={inputCls} />
          </div>
        </div>
      </ModalSection>

      <ModalSection title="Vendor (optional)">
        <VendorClientNameTypeahead
          parties={vendorList}
          selectedId={''}
          loading={vendorsLoading}
          partyKind="vendor"
          allowFreeText
          placeholder="Select a vendor to quote, or leave blank to broadcast…"
          onSelect={(party) => setVendorName(party ? party.name : '')}
          onFreeTextChange={(value) => setVendorName(value)}
        />
        <p className="mt-1 text-[11px] text-ink-3">Leave blank to request a quote from any/all vendors.</p>
      </ModalSection>

      <ModalSection title="MOQs to quote">
        <div className="flex flex-col gap-2">
          {moqs.map((m, i) => (
            <div key={`moq-${i}`} className="flex items-center gap-1.5">
              <input value={m} onChange={(e) => setMoq(i, e.target.value)} inputMode="decimal" className={`${inputCls} w-40`} placeholder={`MOQ ${i + 1} (e.g. 100)`} aria-label={`MOQ ${i + 1}`} />
              <span className="text-[11px] font-semibold text-ink-3">{unit}</span>
              <button type="button" onClick={() => removeMoq(i)} disabled={moqs.length === 1} className="text-ink-4 hover:text-err disabled:opacity-30" aria-label="Remove MOQ"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addMoq} className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-ink-2 text-xs font-semibold hover:bg-surface-3">
          <Plus className="h-3.5 w-3.5" /> Add MOQ
        </button>
        <p className="mt-1 text-[11px] text-ink-3">Enter the order quantities to get quoted. Prices are entered by Procurement when the vendor responds (Record Quote).</p>
      </ModalSection>

      <ModalSection title="Additional notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="Anything the vendor should know (specs, packing, delivery terms…)" aria-label="Additional notes" />
      </ModalSection>

      {err && <p className="text-[12px] text-err">{err}</p>}
    </ProcModalShell>
  );
};

export default RequestQuotationModal;
