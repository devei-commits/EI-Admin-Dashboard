/**
 * PR Edit popup (Spec §3A).
 * Top: read-only item info. Middle: editable PR fields (vendor / qty / price /
 * lead / payment terms) with Save. Bottom: Price-List (vendor × MOQ tiers) +
 * Purchase History dual pane — "Pick" auto-fills the editable fields above.
 */
import React, { useEffect, useState } from 'react';
import type { ProcurementRequest } from '../../types/procurement.types';
import { fetchItemPriceList } from '../../services/procurement.service';
import { PrPopupShell, StatCell, PopupSection } from './PrPopupShell';

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
  onSave: (payload: PrEditPayload) => void | Promise<void>;
}

function toNum(v: unknown): number {
  const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export const PrEditPopup: React.FC<PrEditPopupProps> = ({ req, priceList = [], purchaseHistory = [], onClose, onSave }) => {
  const item = req.itemDetails?.[0] ?? null;
  const isPlanning = !!(req.planningProductCode || req.planningSoNumber || req.batchId);

  const [vendor, setVendor] = useState(req.preferredVendor ?? '');
  const [qty, setQty] = useState<string>(String(item?.reqQty ?? ''));
  const [price, setPrice] = useState<string>(String(item?.plannedPrice ?? ''));
  const [leadDays, setLeadDays] = useState<string>(String(item?.leadTimeDays ?? ''));
  const [paymentTerms, setPaymentTerms] = useState<string>('Net 30');
  const [pickedTier, setPickedTier] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadedTiers, setLoadedTiers] = useState<PriceTier[]>([]);
  const [tiersLoading, setTiersLoading] = useState(false);

  // Fetch the real vendor × MOQ price tiers for this item on open.
  useEffect(() => {
    let cancelled = false;
    const rmId = item?.raw_material_id ?? null;
    const pmId = item?.pack_material_id ?? null;
    if (rmId == null && pmId == null) return;
    setTiersLoading(true);
    fetchItemPriceList({ rawMaterialId: rmId, packMaterialId: pmId })
      .then((tiers) => { if (!cancelled) setLoadedTiers(tiers); })
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
    try {
      setBusy(true);
      await onSave({ vendor: vendor.trim(), qty: toNum(qty), pricePerUnit: toNum(price), leadDays: toNum(leadDays), paymentTerms: paymentTerms.trim() });
    } finally {
      setBusy(false);
    }
  };

  const sih = req.stockSummary?.stockInHand;
  const inputCls = 'w-full bg-amber-50 border border-dashed border-amber-400 rounded px-2 py-1 font-mono text-xs text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-500';

  return (
    <PrPopupShell
      title={<span>✏ Edit PR — {req.code}</span>}
      code={item ? `${item.itemName} · ${item.itemCode}` : undefined}
      subtitle={isPlanning ? '📋 From Planning' : '⊕ Procurement-raised'}
      primaryLabel="Save Request"
      onPrimary={handleSave}
      primaryBusy={busy}
      onClose={onClose}
    >
      {/* Item info (read-only) */}
      <PopupSection title="📦 Item info (read-only)" first>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          <StatCell label="Item Code" value={item?.itemCode ?? '—'} />
          <StatCell label="Item Name" value={<span className="text-[11px]">{item?.itemName ?? '—'}</span>} />
          <StatCell label="Req Qty" value={`${item?.reqQty ?? '—'} ${item?.unit ?? ''}`} />
          <StatCell label="SIH" value={sih != null ? `${sih}` : '—'} tone={sih != null && sih <= 0 ? 'bad' : 'default'} />
          <StatCell label="Planned Qty" value="—" />
          <StatCell label="MOQ" value={item?.moq ?? '—'} />
        </div>
      </PopupSection>

      {/* Editable PR fields */}
      <PopupSection title="📝 PR fields (editable)">
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500">
                {['PR #', 'Item', 'Vendor', 'Qty Req', 'Price / unit', 'Lead Time', 'Payment Terms'].map((h) => (
                  <th key={h} className="px-3 py-1.5 text-left text-[10px] font-bold uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-3 py-2 font-mono"><b>{req.code}</b></td>
                <td className="px-3 py-2"><b>{item?.itemName ?? '—'}</b><div className="text-[9.5px] text-slate-400 font-mono">{item?.itemCode}{isPlanning ? ' · locked from Planning' : ''}</div></td>
                <td className="px-3 py-2"><input value={vendor} onChange={(e) => setVendor(e.target.value)} className={inputCls} placeholder="Vendor" /></td>
                <td className="px-3 py-2"><input value={qty} onChange={(e) => setQty(e.target.value)} className={`${inputCls} text-center`} inputMode="decimal" /></td>
                <td className="px-3 py-2"><input value={price} onChange={(e) => setPrice(e.target.value)} className={`${inputCls} text-center`} inputMode="decimal" /></td>
                <td className="px-3 py-2"><input value={leadDays} onChange={(e) => setLeadDays(e.target.value)} className={`${inputCls} text-center`} inputMode="decimal" /><div className="text-[9px] text-slate-400 mt-0.5 text-center">actual avg</div></td>
                <td className="px-3 py-2"><input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className={inputCls} /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-[10px] text-slate-400"><span className="inline-block w-3 h-3 align-middle bg-amber-50 border border-dashed border-amber-400 rounded" /> = editable. Picking a price-list tier below auto-fills Vendor / Price / Lead.</p>
      </PopupSection>

      {/* Dual pane */}
      <PopupSection title="📑 Price List + 📜 Purchase History (click Pick to auto-fill)">
        <div className="grid md:grid-cols-2 gap-3">
          {/* Price list */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Price List · vendor × MOQ tiers</div>
            {tiersLoading ? (
              <p className="text-[11px] text-slate-400 py-3 text-center">Loading price list…</p>
            ) : tiers.length === 0 ? (
              <p className="text-[11px] text-slate-400 py-3 text-center">No price-list tiers on record for this item.</p>
            ) : (
              <table className="w-full text-[11px]">
                <thead><tr className="text-slate-400">{['Vendor', 'Tier', 'Price', 'Lead', ''].map((h) => <th key={h} className="px-2 py-1 text-left text-[9.5px] font-bold uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {tiers.map((t, i) => (
                    <tr key={i} className={pickedTier === i ? 'bg-emerald-50' : ''}>
                      <td className="px-2 py-1">{t.vendor}</td>
                      <td className="px-2 py-1 text-center">{t.tier}</td>
                      <td className="px-2 py-1 text-center font-mono">₹{t.price}</td>
                      <td className="px-2 py-1 text-center font-mono">{t.lead}d</td>
                      <td className="px-2 py-1 text-center">
                        {pickedTier === i
                          ? <span className="text-emerald-700 font-bold text-[10px]">✓ Picked</span>
                          : <button onClick={() => pick(t, i)} className="text-blue-600 font-bold text-[10px] hover:underline">Pick</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {/* Purchase history */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Purchase History · last 6 POs</div>
            {purchaseHistory.length === 0 ? (
              <p className="text-[11px] text-slate-400 py-3 text-center">No purchase history on record for this item.</p>
            ) : (
              <table className="w-full text-[11px]">
                <thead><tr className="text-slate-400">{['Vendor', 'Qty', 'Price', 'Date'].map((h) => <th key={h} className="px-2 py-1 text-left text-[9.5px] font-bold uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
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
      </PopupSection>

      <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-[11px] text-blue-800">
        <b>On Save:</b> updates the PR row in the inbox. Does not push to PO — that's the 🚚 Draft PO action (§3C).
      </div>
    </PrPopupShell>
  );
};
