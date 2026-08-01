/**
 * PR Edit popup (Spec §3A).
 * Top: read-only item info. Middle: editable PR fields (vendor / qty / price /
 * lead / payment terms) with Save. Bottom: Price-List (vendor × MOQ tiers) +
 * Purchase History dual pane — "Pick" auto-fills the editable fields above.
 */
import React, { useEffect, useState } from 'react';
import { AlertTriangle, FileQuestion } from 'lucide-react';
import { Check } from '@phosphor-icons/react';
import type { ProcurementRequest } from '../../types/procurement.types';
import { fetchItemPriceList } from '../../services/procurement.service';
import { StatCell } from './PrPopupShell';
import { ProcModalShell, ModalSection } from './ProcModalShell';

export interface PriceTier { vendor: string; tier: string; price: number; lead: number; }
export interface HistoryRow { vendor: string; qty: number; price: number; date: string; }

export interface PrEditPayload {
  vendor: string;
  qty: number;
  pricePerUnit: number;
  leadDays: number;
  paymentTerms: string;
}

export interface PrEditPopupProps {
  req: ProcurementRequest;
  priceList?: PriceTier[];
  purchaseHistory?: HistoryRow[];
  onClose: () => void;
  onSave: (payload: PrEditPayload) => void | Promise<void | { moqError?: string }>;
  onRaiseQuoteRequest?: (payload: PrEditPayload) => void | Promise<void>;
}

function toNum(v: unknown): number {
  const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export const PrEditPopup: React.FC<PrEditPopupProps> = ({ req, priceList = [], purchaseHistory = [], onClose, onSave, onRaiseQuoteRequest }) => {
  const item = req.itemDetails?.[0] ?? null;
  const isPlanning = !!(req.planningProductCode || req.planningSoNumber || req.batchId);

  const [vendor, setVendor] = useState(req.preferredVendor ?? '');
  const [qty, setQty] = useState<string>(String(item?.reqQty ?? ''));
  const [price, setPrice] = useState<string>(String(item?.plannedPrice ?? ''));
  const [leadDays, setLeadDays] = useState<string>(String(item?.leadTimeDays ?? ''));
  const [paymentTerms, setPaymentTerms] = useState<string>('Net 30');
  const [pickedTier, setPickedTier] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [moqError, setMoqError] = useState<string | null>(null);
  const [moqPayload, setMoqPayload] = useState<PrEditPayload | null>(null);
  const [loadedTiers, setLoadedTiers] = useState<PriceTier[]>([]);
  const [tiersLoading, setTiersLoading] = useState(false);
  const [tiersError, setTiersError] = useState<string | null>(null);

  // Fetch the real vendor × MOQ price tiers for this item on open.
  useEffect(() => {
    let cancelled = false;
    const rmId = item?.raw_material_id ?? null;
    const pmId = item?.pack_material_id ?? null;
    if (rmId == null && pmId == null) return;
    setTiersLoading(true);
    setTiersError(null);
    fetchItemPriceList({ rawMaterialId: rmId, packMaterialId: pmId })
      .then((tiers) => { if (!cancelled) setLoadedTiers(tiers); })
      .catch(() => { if (!cancelled) setTiersError('Could not load price tiers — check your connection and reopen.'); })
      .finally(() => { if (!cancelled) setTiersLoading(false); });
    return () => { cancelled = true; };
  }, [item?.raw_material_id, item?.pack_material_id]);

  const tiers = priceList.length ? priceList : loadedTiers;

  const pick = (t: PriceTier, idx: number) => {
    setVendor(t.vendor);
    setPrice(String(t.price));
    setLeadDays(String(t.lead));
    setPickedTier(idx);
  };

  const handleSave = async () => {
    const payload = { vendor: vendor.trim(), qty: toNum(qty), pricePerUnit: toNum(price), leadDays: toNum(leadDays), paymentTerms: paymentTerms.trim() };
    try {
      setBusy(true);
      setMoqError(null);
      const result = await onSave(payload);
      if (result && typeof result === 'object' && 'moqError' in result && result.moqError) {
        setMoqError(result.moqError);
        setMoqPayload(payload);
      }
    } finally {
      setBusy(false);
    }
  };

  const sih = req.stockSummary?.stockInHand;
  const inputCls = 'w-full bg-warn-soft border border-dashed border-[color:var(--st-amber-fg)]/40 rounded px-2 py-1 font-mono text-xs text-warn focus:outline-none focus:ring-1 focus:ring-[color:var(--ring)]';

  return (
    <ProcModalShell
      eyebrow={isPlanning ? 'Planning Request' : 'Procurement Request'}
      title={`Edit PR — ${req.code}`}
      subtitle={item ? `${item.itemName}${item.itemCode ? ` · ${item.itemCode}` : ''}` : undefined}
      onClose={onClose}
      width="max-w-4xl"
      footer={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-ink-2 text-sm font-semibold hover:bg-surface">Cancel</button>
          <button type="button" onClick={() => void handleSave()} disabled={busy} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-bold hover:bg-brand-press disabled:opacity-60">{busy ? 'Saving…' : 'Save Request'}</button>
        </>
      }
    >
      {/* Item info (read-only) */}
      <ModalSection title="Item Info (read-only)">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          <StatCell label="Item Code" value={item?.itemCode ?? '—'} />
          <StatCell label="Item Name" value={<span className="text-[11px]">{item?.itemName ?? '—'}</span>} />
          <StatCell label="Req Qty" value={`${item?.reqQty ?? '—'} ${item?.unit ?? ''}`} />
          <StatCell label="SIH" value={sih != null ? `${sih}` : '—'} tone={sih != null && sih <= 0 ? 'bad' : 'default'} />
          <StatCell label="Planned Qty" value="—" />
          <StatCell label="MOQ" value={item?.moq ?? '—'} />
          {req.planningProductMrp != null && Number(req.planningProductMrp) > 0 ? (
            <StatCell label="MRP (read-only)" value={`₹${Number(req.planningProductMrp).toLocaleString('en-IN')}`} />
          ) : null}
        </div>
      </ModalSection>

      {/* Editable PR fields */}
      <ModalSection title="PR Fields (editable)">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-3 text-ink-3">
                {['PR #', 'Item', 'Vendor', 'Qty Req', 'Price / unit', 'Lead Time', 'Payment Terms'].map((h) => (
                  <th scope="col" key={h} className="px-3 py-1.5 text-left text-[10px] font-bold uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-3 py-2 font-mono"><b>{req.code}</b></td>
                <td className="px-3 py-2"><b>{item?.itemName ?? '—'}</b><div className="text-[9.5px] text-ink-4 font-mono">{item?.itemCode}{isPlanning ? ' · locked from Planning' : ''}</div></td>
                <td className="px-3 py-2"><input value={vendor} onChange={(e) => setVendor(e.target.value)} className={inputCls} placeholder="Vendor" aria-label="Vendor" /></td>
                <td className="px-3 py-2"><input value={qty} onChange={(e) => setQty(e.target.value)} className={`${inputCls} text-center`} inputMode="decimal" aria-label="Qty Req" /></td>
                <td className="px-3 py-2"><input value={price} onChange={(e) => setPrice(e.target.value)} className={`${inputCls} text-center`} inputMode="decimal" aria-label="Price / unit" /></td>
                <td className="px-3 py-2"><input value={leadDays} onChange={(e) => setLeadDays(e.target.value)} className={`${inputCls} text-center`} inputMode="decimal" aria-label="Lead Time" /><div className="text-[9px] text-ink-4 mt-0.5 text-center">actual avg</div></td>
                <td className="px-3 py-2"><input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className={inputCls} aria-label="Payment Terms" /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-[10px] text-ink-4"><span className="inline-block w-3 h-3 align-middle bg-warn-soft border border-dashed border-[color:var(--st-amber-fg)]/40 rounded" /> = editable. Picking a price-list tier below auto-fills Vendor / Price / Lead.</p>
      </ModalSection>

      {moqError && (
        <div className="mx-0 rounded-lg border border-[color:var(--st-amber-fg)]/30 bg-warn-soft px-3.5 py-2.5 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-warn mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-warn mb-0.5">Quantity below vendor MOQ — save blocked</p>
            <p className="text-[11px] text-warn">{moqError}</p>
            <p className="text-[11px] text-warn mt-0.5">Adjust the qty to meet the minimum, or raise a Quote Request to ask the vendor for a special allowance.</p>
            {onRaiseQuoteRequest && moqPayload && (
              <button
                type="button"
                onClick={() => void onRaiseQuoteRequest(moqPayload)}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand text-white text-[11px] font-bold hover:bg-brand-press"
              >
                <FileQuestion className="h-3.5 w-3.5" />
                Raise Quote Request for {moqPayload.qty} {item?.unit ?? ''}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dual pane */}
      <ModalSection title="Price List + Purchase History">
        <div className="grid md:grid-cols-2 gap-3">
          {/* Price list */}
          <div className="bg-surface-3 border border-border rounded-lg p-2.5">
            <div className="text-[10px] font-bold text-ink-4 uppercase mb-1.5">Price List · vendor × MOQ tiers</div>
            {tiersLoading ? (
              <p className="text-[11px] text-ink-4 py-3 text-center">Loading price list…</p>
            ) : tiersError ? (
              <p className="text-[11px] text-err py-3 text-center">{tiersError}</p>
            ) : tiers.length === 0 ? (
              <p className="text-[11px] text-ink-4 py-3 text-center">No price-list tiers on record for this item.</p>
            ) : (
              <table className="w-full text-[11px]">
                <thead><tr className="text-ink-4">{['Vendor', 'Tier', 'Price', 'Lead', ''].map((h) => <th scope="col" key={h} className="px-2 py-1 text-left text-[9.5px] font-bold uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-hairline">
                  {tiers.map((t, i) => (
                    <tr key={i} className={pickedTier === i ? 'bg-ok-soft' : ''}>
                      <td className="px-2 py-1">{t.vendor}</td>
                      <td className="px-2 py-1 text-center">{t.tier}</td>
                      <td className="px-2 py-1 text-center font-mono">₹{t.price}</td>
                      <td className="px-2 py-1 text-center font-mono">{t.lead}d</td>
                      <td className="px-2 py-1 text-center">
                        {pickedTier === i
                          ? <span className="inline-flex items-center gap-1 text-ok font-bold text-[10px]"><Check className="w-3 h-3" />Picked</span>
                          : <button onClick={() => pick(t, i)} className="text-brand font-bold text-[10px] hover:underline">Pick</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {/* Purchase history */}
          <div className="bg-surface-3 border border-border rounded-lg p-2.5">
            <div className="text-[10px] font-bold text-ink-4 uppercase mb-1.5">Purchase History · last 6 POs</div>
            {purchaseHistory.length === 0 ? (
              <p className="text-[11px] text-ink-4 py-3 text-center">No purchase history on record for this item.</p>
            ) : (
              <table className="w-full text-[11px]">
                <thead><tr className="text-ink-4">{['Vendor', 'Qty', 'Price', 'Date'].map((h) => <th scope="col" key={h} className="px-2 py-1 text-left text-[9.5px] font-bold uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-hairline">
                  {purchaseHistory.slice(0, 6).map((h, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1">{h.vendor}</td>
                      <td className="px-2 py-1 text-center font-mono">{h.qty}</td>
                      <td className="px-2 py-1 text-center font-mono">₹{h.price}</td>
                      <td className="px-2 py-1 text-center font-mono">{h.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </ModalSection>

      <div className="rounded-lg border border-brand-soft bg-brand-soft px-3.5 py-2 text-[11px] text-brand">
        <b>On Save:</b> updates the PR row in the inbox. Does not push to PO — that's the Draft PO action.
      </div>
    </ProcModalShell>
  );
};
