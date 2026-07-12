import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ProcModalShell } from './ProcModalShell';
import {
  fetchPriceListPagePaginated,
  createItemList,
  createItemListRate,
  deleteItemListRate,
  createItemListTier,
  type PriceListItemPage,
} from '../../services/itemsList.service';
import type { Vendor } from '../../types/procurement.types';

export interface UpdatePriceListPopupProps {
  itemCode: string;
  itemName: string;
  itemType: 'RM' | 'PM';
  rawMaterialId?: number | null;
  packMaterialId?: number | null;
  defaultVendorName?: string;
  vendors: Vendor[];
  onClose: () => void;
  onSaved?: () => void;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return `${String(dt.getDate()).padStart(2, '0')}-${dt.toLocaleString('en-US', { month: 'short' })}-${dt.getFullYear()}`;
}

export const UpdatePriceListPopup: React.FC<UpdatePriceListPopupProps> = ({
  itemCode, itemName, itemType, rawMaterialId, packMaterialId,
  defaultVendorName, vendors, onClose, onSaved,
}) => {
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [priceListItem, setPriceListItem] = useState<PriceListItemPage | null>(null);

  const [vendorId, setVendorId] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [moqMin, setMoqMin] = useState('1');
  const [moqMax, setMoqMax] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState('');
  const [validTill, setValidTill] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Pre-select vendor from name hint
  useEffect(() => {
    if (!defaultVendorName || !vendors.length) return;
    const match = vendors.find(
      (v) => v.name.toLowerCase() === defaultVendorName.toLowerCase(),
    );
    if (match) setVendorId(String(match.id));
  }, [defaultVendorName, vendors]);

  const loadItem = useCallback(async () => {
    setFetching(true); setFetchError(null);
    try {
      const res = await fetchPriceListPagePaginated(itemType, { limit: 50, search: itemCode });
      if (res.success && res.data) {
        const found = res.data.rows.find(
          (r) => r.code?.toLowerCase() === itemCode.toLowerCase(),
        );
        setPriceListItem(found ?? null);
      } else {
        setFetchError('Could not load price list data.');
      }
    } catch {
      setFetchError('Could not load price list data.');
    } finally {
      setFetching(false);
    }
  }, [itemCode, itemType]);

  useEffect(() => { void loadItem(); }, [loadItem]);

  const selectedVendor = useMemo(
    () => vendors.find((v) => String(v.id) === vendorId) ?? null,
    [vendors, vendorId],
  );

  const existingRate = useMemo(
    () => priceListItem?.vendorRates.find((r) => String(r.vendor_id) === vendorId) ?? null,
    [priceListItem, vendorId],
  );

  const handleSave = async () => {
    if (!vendorId) { setSaveError('Select a vendor.'); return; }
    const price = parseFloat(pricePerUnit);
    if (!Number.isFinite(price) || price <= 0) { setSaveError('Enter a valid price per unit.'); return; }
    const moqMinNum = parseFloat(moqMin);
    if (!Number.isFinite(moqMinNum) || moqMinNum < 0) { setSaveError('Enter a valid MOQ.'); return; }

    setSaving(true); setSaveError(null);
    try {
      // 1. Resolve items-list entry ID
      let listId: string;
      if (priceListItem?.itemsListId != null) {
        listId = String(priceListItem.itemsListId);
      } else {
        if (!rawMaterialId && !packMaterialId) {
          setSaveError('This item is not yet in the price list. Add it under Masters → Price List first.');
          setSaving(false); return;
        }
        const created = await createItemList({
          type: itemType,
          raw_material_id: rawMaterialId ?? null,
          pack_material_id: packMaterialId ?? null,
        });
        if (!created.success || !created.data) {
          setSaveError('Failed to create price list entry for this item.');
          setSaving(false); return;
        }
        listId = String(created.data.id);
      }

      // 2. Resolve or create vendor rate
      let rateId: number;
      let rateWasNew = false;
      if (existingRate) {
        rateId = existingRate.id;
      } else {
        const lt = leadTimeDays ? parseFloat(leadTimeDays) : null;
        const newRate = await createItemListRate(listId, {
          vendor_id: Number(vendorId),
          currency: 'INR',
          lead_time_days: Number.isFinite(lt ?? NaN) && lt != null && lt > 0 ? lt : null,
        });
        if (!newRate.success || !newRate.data) {
          setSaveError('Failed to create vendor rate entry.');
          setSaving(false); return;
        }
        rateId = newRate.data.id;
        rateWasNew = true;
      }

      // 3. Add price tier — roll back the freshly-created rate if this fails
      const moqMaxNum = moqMax ? parseFloat(moqMax) : null;
      const tier = await createItemListTier(listId, rateId, {
        moq_min: moqMinNum,
        moq_max: Number.isFinite(moqMaxNum ?? NaN) && moqMaxNum != null && moqMaxNum > 0 ? moqMaxNum : null,
        price_per_unit: price,
        valid_till: validTill || null,
        note: notes || null,
      });
      if (!tier.success) {
        if (rateWasNew) await deleteItemListRate(listId, rateId);
        setSaveError('Failed to save the price tier.');
        setSaving(false); return;
      }

      setSaved(true);
      onSaved?.();
      void loadItem(); // refresh existing tiers display
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full border border-slate-200 rounded-md px-2.5 py-1.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white';

  return (
    <ProcModalShell
      eyebrow="Quote Requests · Price List"
      title="Update Price List"
      subtitle={
        <>
          {itemName}{' '}
          <span className="font-mono text-xs text-slate-500">{itemCode}</span>
        </>
      }
      width="max-w-xl"
      onClose={onClose}
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-white"
          >
            {saved ? 'Close' : 'Cancel'}
          </button>
          {!saved && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save to Price List'}
            </button>
          )}
        </>
      }
    >
      {/* ── Item header ────────────────────────────────────────────── */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase">Item</p>
          <p className="text-sm font-semibold text-slate-800">{itemName}</p>
          <p className="font-mono text-[11px] text-slate-500">
            {itemCode} &middot; {itemType}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase">Price List</p>
          {fetching ? (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Loader2 size={11} className="animate-spin" /> checking…
            </span>
          ) : priceListItem?.itemsListId != null ? (
            <span className="text-xs font-semibold text-emerald-600">In Price List ✓</span>
          ) : (
            <span className="text-xs font-semibold text-amber-600">Not yet in Price List</span>
          )}
        </div>
      </div>

      {fetchError && (
        <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600 flex gap-2 items-center">
          <AlertCircle size={13} /> {fetchError}
        </div>
      )}

      {/* ── Existing tiers for selected vendor ─────────────────────── */}
      {existingRate && existingRate.tiers.length > 0 && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">
            Existing Tiers — {existingRate.vendor_name ?? selectedVendor?.name}
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] text-slate-500 uppercase border-b border-slate-100">
                <th className="text-left pb-1.5">MOQ Min</th>
                <th className="text-left pb-1.5">MOQ Max</th>
                <th className="text-left pb-1.5">₹ / Unit</th>
                <th className="text-left pb-1.5">Valid Till</th>
                <th className="text-left pb-1.5">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {existingRate.tiers.map((t) => (
                <tr key={t.id}>
                  <td className="py-1.5 tabular-nums">{t.moq_min.toLocaleString('en-IN')}</td>
                  <td className="py-1.5 tabular-nums text-slate-500">
                    {t.moq_max != null ? t.moq_max.toLocaleString('en-IN') : '—'}
                  </td>
                  <td className="py-1.5 tabular-nums font-semibold text-slate-800">
                    ₹{t.price_per_unit.toLocaleString('en-IN')}
                  </td>
                  <td className="py-1.5 text-slate-500">{fmtDate(t.valid_till)}</td>
                  <td className="py-1.5 text-slate-400 truncate max-w-[90px]">{t.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── New tier form ───────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
          {existingRate ? 'Add Another Tier' : 'New Price Tier'}
        </p>

        {/* Vendor */}
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 mb-1">
            Vendor <span className="text-red-500">*</span>
          </label>
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={inputCls}>
            <option value="">— Select vendor —</option>
            {vendors.map((v) => (
              <option key={v.id} value={String(v.id)}>
                {v.name}{v.vendorCode ? ` (${v.vendorCode})` : ''}
              </option>
            ))}
          </select>
        </div>

        {selectedVendor && (
          <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 grid grid-cols-3 gap-2 text-[11px]">
            {selectedVendor.city && (
              <span><span className="text-slate-400">City </span><span className="text-slate-700">{selectedVendor.city}</span></span>
            )}
            {selectedVendor.paymentTerms && (
              <span><span className="text-slate-400">Terms </span><span className="text-slate-700">{selectedVendor.paymentTerms}</span></span>
            )}
            {selectedVendor.avgLeadTime > 0 && (
              <span><span className="text-slate-400">Avg Lead </span><span className="text-slate-700">{selectedVendor.avgLeadTime}d</span></span>
            )}
          </div>
        )}

        {/* Tier fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">
              Price per Unit (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number" min="0" step="0.01"
              value={pricePerUnit} onChange={(e) => setPricePerUnit(e.target.value)}
              className={inputCls} placeholder="e.g. 295.00"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">
              MOQ Min <span className="text-red-500">*</span>
            </label>
            <input
              type="number" min="0"
              value={moqMin} onChange={(e) => setMoqMin(e.target.value)}
              className={inputCls} placeholder="e.g. 100"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">MOQ Max</label>
            <input
              type="number" min="0"
              value={moqMax} onChange={(e) => setMoqMax(e.target.value)}
              className={inputCls} placeholder="optional"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Lead Time (days)</label>
            <input
              type="number" min="0"
              value={leadTimeDays} onChange={(e) => setLeadTimeDays(e.target.value)}
              className={inputCls} placeholder="e.g. 7"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Valid Till</label>
            <input
              type="date"
              value={validTill} onChange={(e) => setValidTill(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Note</label>
            <input
              value={notes} onChange={(e) => setNotes(e.target.value)}
              className={inputCls} placeholder="Optional"
            />
          </div>
        </div>
      </div>

      {/* Feedback */}
      {saveError && (
        <div className="mt-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600 flex gap-2 items-center">
          <AlertCircle size={13} /> {saveError}
        </div>
      )}
      {saved && (
        <div className="mt-3 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700 flex gap-2 items-center">
          <CheckCircle2 size={13} /> Price tier saved to the Price List successfully.
        </div>
      )}
    </ProcModalShell>
  );
};
