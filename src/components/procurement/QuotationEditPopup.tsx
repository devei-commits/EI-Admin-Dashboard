/**
 * Quotation edit popup — first step of the procurement "Record Quotation" flow.
 * Procurement enters the vendor + received price/MOQ/lead time/terms here, then
 * continues to the RFQ email step. The price is written into the Items List
 * (price list) only when that email is sent (see RfqTemplatePopup → onSend).
 *
 * - MOQ defaults to Planning's "Quantity to quote".
 * - Picking a vendor auto-pulls payment terms, lead time and notes from the
 *   vendor master (list row first, then the full record for accurate terms).
 * - Vendor selection uses the shared typeahead (searchable, ranked, capped).
 */
import React, { useRef, useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { CheckCircle } from '@phosphor-icons/react';
import { ProcModalShell } from './ProcModalShell';
import type { RfqTemplateData } from './RfqTemplatePopup';
import VendorClientNameTypeahead from '../VendorClientNameTypeahead';
import type { VendorClientRecord } from '../../services/vendorClient.service';
import { fetchVendorClientById } from '../../services/vendorClient.service';
import {
  serializeStagedPaymentTerms,
  validateStagedPercents,
  resolveStagedPaymentTermsFromVendorRecord,
  mergeCreditDaysFromClientData,
} from '../../lib/stagedPaymentTerms';
import type { RecordedQuoteInput, QuoteBand } from '../../utils/recordQuotationToPriceList';

interface BandDraft {
  moqMin: string;
  moqMax: string;
  price: string;
}

export interface QuotationEditPopupProps {
  data: RfqTemplateData;
  vendors: VendorClientRecord[];
  vendorsLoading?: boolean;
  onClose: () => void;
  /**
   * Approve & write the quotation (all MOQ bands) into the Items List / price list.
   * Returns the write result so the popup can show an error or close on success.
   */
  onApproveSave: (quote: RecordedQuoteInput) => Promise<{ success: boolean; error?: string }>;
}

const inputCls =
  'w-full rounded-lg border border-border px-3 py-2 text-sm bg-surface focus:ring-2 focus:ring-[color:var(--ring)] focus:border-[color:var(--accent)]';
const pctCls =
  'w-full min-w-[4rem] rounded border border-border px-2 py-1 text-sm tabular-nums';

function asRecord(data: unknown): Record<string, unknown> | undefined {
  return data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : undefined;
}

export const QuotationEditPopup: React.FC<QuotationEditPopupProps> = ({ data, vendors, vendorsLoading, onClose, onApproveSave }) => {
  const [vendorId, setVendorId] = useState('');
  const firstMoq =
    data.quantityToQuote != null ? String(data.quantityToQuote) : data.moqHint != null ? String(data.moqHint) : '1';
  // One or more MOQ→price bands (Masters-style tiers). First band's MOQ defaults to the qty to quote.
  const [bands, setBands] = useState<BandDraft[]>([{ moqMin: firstMoq, moqMax: '', price: '' }]);
  const [leadTimeDays, setLeadTimeDays] = useState('');
  const [advancePct, setAdvancePct] = useState('');
  const [preShipmentPct, setPreShipmentPct] = useState('');
  const [postShipmentPct, setPostShipmentPct] = useState('');
  const [creditDays, setCreditDays] = useState('0');
  const [validTill, setValidTill] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const hydrateRef = useRef(0);

  const setBand = (idx: number, field: keyof BandDraft, value: string) =>
    setBands((prev) => prev.map((b, i) => (i === idx ? { ...b, [field]: value } : b)));
  const addBand = () => setBands((prev) => [...prev, { moqMin: '', moqMax: '', price: '' }]);
  const removeBand = (idx: number) => setBands((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  const type = data.itemType;
  const materialId = type === 'RM' ? data.rawMaterialId : type === 'PM' ? data.packMaterialId : null;

  /** Fill payment terms, lead time and notes from a vendor master record. */
  const applyVendorDefaults = (
    paymentTerms: string | null | undefined,
    vData: Record<string, unknown> | undefined,
    leadTime: string | null | undefined,
    notes: string | null | undefined,
  ) => {
    const staged = mergeCreditDaysFromClientData(
      resolveStagedPaymentTermsFromVendorRecord(paymentTerms, vData),
      vData,
    );
    setAdvancePct(String(staged.advance_pct));
    setPreShipmentPct(String(staged.pre_shipment_pct));
    setPostShipmentPct(String(staged.post_shipment_pct));
    setCreditDays(staged.credit_days ? String(staged.credit_days) : '0');
    const lead = String(leadTime ?? '').replace(/[^\d]/g, '');
    if (lead) setLeadTimeDays(lead);
    const n = String(notes ?? '').trim();
    if (n) setNote(n);
  };

  const handleVendorSelect = (party: VendorClientRecord | null) => {
    setError(null);
    if (!party) {
      setVendorId('');
      return;
    }
    setVendorId(String(party.id));
    // Fill from the list row immediately, then refine from the full record (accurate payables/terms).
    applyVendorDefaults(party.paymentTerms, asRecord(party.data), party.leadTime, party.notes);
    const reqId = ++hydrateRef.current;
    void (async () => {
      try {
        const full = await fetchVendorClientById(String(party.id));
        if (reqId !== hydrateRef.current) return;
        if (full.success && full.data) {
          applyVendorDefaults(full.data.paymentTerms, asRecord(full.data.data), full.data.leadTime, full.data.notes);
        }
      } catch {
        // List row is enough when the detail fetch fails.
      }
    })();
  };

  const handleApproveSave = async () => {
    if (saving) return;
    setError(null);
    if (!type || materialId == null) {
      setError('This item is not linked to a material master, so it cannot be priced.');
      return;
    }
    const vendor = vendors.find((v) => String(v.id) === vendorId);
    if (!vendor) {
      setError('Select a vendor.');
      return;
    }
    // Validate & normalise the MOQ bands.
    const cleanBands: QuoteBand[] = [];
    const seenMoq = new Set<number>();
    for (const b of bands) {
      const moqNum = Number(b.moqMin);
      const priceNum = Number(b.price);
      if (!Number.isFinite(moqNum) || moqNum <= 0) {
        setError('Each band needs a MOQ greater than zero.');
        return;
      }
      if (!Number.isFinite(priceNum) || priceNum <= 0) {
        setError('Each band needs a price greater than zero.');
        return;
      }
      const moqMaxNum = b.moqMax.trim() === '' ? null : Number(b.moqMax);
      if (moqMaxNum != null && (!Number.isFinite(moqMaxNum) || moqMaxNum < moqNum)) {
        setError('Each band’s MOQ max must be blank or ≥ its MOQ.');
        return;
      }
      if (seenMoq.has(moqNum)) {
        setError(`Duplicate MOQ ${moqNum} — each band needs a distinct MOQ.`);
        return;
      }
      seenMoq.add(moqNum);
      cleanBands.push({ moqMin: moqNum, moqMax: moqMaxNum, price: priceNum });
    }
    if (cleanBands.length === 0) {
      setError('Add at least one MOQ band.');
      return;
    }
    const leadNum = leadTimeDays.trim() === '' ? null : Math.max(0, Math.floor(Number(leadTimeDays)));
    const pctErr = validateStagedPercents(Number(advancePct), Number(preShipmentPct), Number(postShipmentPct));
    if (pctErr) {
      setError(pctErr);
      return;
    }
    const hasTerms =
      advancePct.trim() !== '' || preShipmentPct.trim() !== '' || postShipmentPct.trim() !== '' || Number(creditDays) > 0;
    const paymentTerms = hasTerms
      ? serializeStagedPaymentTerms({
          advance_pct: Number(advancePct) || 0,
          pre_shipment_pct: Number(preShipmentPct) || 0,
          post_shipment_pct: Number(postShipmentPct) || 0,
          credit_days: Number(creditDays) || 0,
        })
      : null;

    setSaving(true);
    try {
      const res = await onApproveSave({
        vendorId: String(vendor.id),
        vendorName: vendor.name,
        vendorEmail: vendor.email ?? null,
        bands: cleanBands,
        leadTimeDays: leadNum,
        paymentTerms,
        validTill: validTill.trim() || null,
        note: note.trim() || null,
      });
      if (!res.success) {
        setError(res.error ?? 'Failed to save to the price list.');
        return;
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProcModalShell
      eyebrow="Quote request · record quotation"
      title={`Record Quotation — ${data.qtId}`}
      subtitle={
        <>
          {data.itemName} <span className="font-mono text-xs text-ink-3">{data.itemCode}</span>
          {type && <span className="ml-1 text-xs text-ink-4">· {type}</span>}
        </>
      }
      width="max-w-2xl"
      onClose={onClose}
      footer={
        <>
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-border text-ink-2 text-sm font-semibold hover:bg-surface disabled:opacity-60"
          >
            Close
          </button>
          <button
            onClick={() => void handleApproveSave()}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-bold hover:bg-brand-press disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle weight="fill" className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Approve & Save to Price List'}
          </button>
        </>
      }
    >
      {error && (
        <div className="rounded-lg border border-[color:var(--st-red-fg)]/30 bg-err-soft px-3 py-2 text-sm text-err">{error}</div>
      )}

      <div>
        <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-wide mb-1">Vendor</label>
        <VendorClientNameTypeahead
          parties={vendors}
          selectedId={vendorId}
          onSelect={handleVendorSelect}
          loading={vendorsLoading}
          partyKind="vendor"
          placeholder="Search vendor by name, code, city…"
        />
        {data.vendor && data.vendor !== 'Any (broadcast)' && (
          <p className="text-[11px] text-ink-3 mt-1">Requested vendor hint: {data.vendor}</p>
        )}
        {vendorId && (
          <p className="text-[11px] text-ok mt-1">Payment terms, lead time and notes auto-filled from the vendor master — edit if needed.</p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-wide">
            MOQ price bands
            {data.quantityToQuote != null && <span className="ml-1 font-normal normal-case text-ink-4">(first MOQ from qty to quote)</span>}
          </label>
          <button
            type="button"
            onClick={addBand}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border text-ink-2 text-[11px] font-semibold hover:bg-surface-3"
          >
            <Plus className="h-3.5 w-3.5" /> Add band
          </button>
        </div>
        <p className="text-[11px] text-ink-3 mb-2">Enter a price for each MOQ band, exactly like the Masters price list (e.g. 1–99 @ ₹X, 100–499 @ ₹Y).</p>
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-surface-3 text-left text-ink-3">
                <th scope="col" className="px-2 py-1.5 font-semibold border-b border-border">MOQ min</th>
                <th scope="col" className="px-2 py-1.5 font-semibold border-b border-border">MOQ max (optional)</th>
                <th scope="col" className="px-2 py-1.5 font-semibold border-b border-border">Price / unit (₹)</th>
                <th scope="col" className="px-2 py-1.5 font-semibold border-b border-border w-8" aria-label="Remove" />
              </tr>
            </thead>
            <tbody>
              {bands.map((band, idx) => (
                <tr key={`band-${idx}`}>
                  <td className="px-2 py-1.5 border-t border-hairline">
                    <input aria-label="MOQ min" value={band.moqMin} onChange={(e) => setBand(idx, 'moqMin', e.target.value)} type="number" min={1} step="any" inputMode="decimal" className={pctCls} />
                  </td>
                  <td className="px-2 py-1.5 border-t border-hairline">
                    <input aria-label="MOQ max (optional)" value={band.moqMax} onChange={(e) => setBand(idx, 'moqMax', e.target.value)} type="number" min={0} step="any" inputMode="decimal" placeholder="—" className={pctCls} />
                  </td>
                  <td className="px-2 py-1.5 border-t border-hairline">
                    <input aria-label="Price / unit (₹)" value={band.price} onChange={(e) => setBand(idx, 'price', e.target.value)} type="number" min={0} step="0.01" inputMode="decimal" className={pctCls} />
                  </td>
                  <td className="px-2 py-1.5 border-t border-hairline text-center">
                    <button type="button" onClick={() => removeBand(idx)} disabled={bands.length === 1} className="text-ink-4 hover:text-err disabled:opacity-30" aria-label="Remove band">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="w-1/2 pr-1.5">
        <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-wide mb-1">Lead time (days)</label>
        <input value={leadTimeDays} onChange={(e) => setLeadTimeDays(e.target.value)} type="number" min={0} className={inputCls} />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-wide mb-1">Payment terms</label>
        <p className="text-[11px] text-ink-3 mb-2">
          Same three-way split as Items List and vendor masters (advance, pre-shipment, post-shipment, credit days). Auto-filled from the vendor; leave blank for “as per contract”.
        </p>
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full max-w-xl text-xs border-collapse">
            <thead>
              <tr className="bg-surface-3 text-left text-ink-3">
                <th scope="col" className="px-2 py-1.5 font-semibold border-b border-border">Advance %</th>
                <th scope="col" className="px-2 py-1.5 font-semibold border-b border-border">Pre-ship %</th>
                <th scope="col" className="px-2 py-1.5 font-semibold border-b border-border">Post-ship %</th>
                <th scope="col" className="px-2 py-1.5 font-semibold border-b border-border">Credit days</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-2 py-1.5 border-t border-hairline">
                  <input aria-label="Advance %" type="number" min={0} max={100} value={advancePct} onChange={(e) => setAdvancePct(e.target.value)} className={pctCls} />
                </td>
                <td className="px-2 py-1.5 border-t border-hairline">
                  <input aria-label="Pre-ship %" type="number" min={0} max={100} value={preShipmentPct} onChange={(e) => setPreShipmentPct(e.target.value)} className={pctCls} />
                </td>
                <td className="px-2 py-1.5 border-t border-hairline">
                  <input aria-label="Post-ship %" type="number" min={0} max={100} value={postShipmentPct} onChange={(e) => setPostShipmentPct(e.target.value)} className={pctCls} />
                </td>
                <td className="px-2 py-1.5 border-t border-hairline">
                  <input aria-label="Credit days" type="number" min={0} value={creditDays} onChange={(e) => setCreditDays(e.target.value)} className={pctCls} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-wide mb-1">Valid till (optional)</label>
          <input value={validTill} onChange={(e) => setValidTill(e.target.value)} type="date" className={inputCls} />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-wide mb-1">Note (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} type="text" placeholder="e.g. quoted on call, freight extra" className={inputCls} />
        </div>
      </div>

      <p className="text-[11px] text-ink-3">
        Approve & Save writes every MOQ band into the Items List (price list) for this vendor and marks the request fulfilled — no email is sent.
      </p>
    </ProcModalShell>
  );
};
