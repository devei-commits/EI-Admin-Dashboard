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
import type { RecordedQuoteInput } from '../../utils/recordQuotationToPriceList';

export interface QuotationEditPopupProps {
  data: RfqTemplateData;
  vendors: VendorClientRecord[];
  vendorsLoading?: boolean;
  onClose: () => void;
  /** Proceed to the RFQ email step with the collected quotation. */
  onContinue: (quote: RecordedQuoteInput) => void;
}

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
const pctCls =
  'w-full min-w-[4rem] rounded border border-slate-300 px-2 py-1 text-sm tabular-nums';

function asRecord(data: unknown): Record<string, unknown> | undefined {
  return data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : undefined;
}

export const QuotationEditPopup: React.FC<QuotationEditPopupProps> = ({ data, vendors, vendorsLoading, onClose, onContinue }) => {
  const [vendorId, setVendorId] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [moq, setMoq] = useState(
    data.quantityToQuote != null ? String(data.quantityToQuote) : data.moqHint != null ? String(data.moqHint) : '',
  );
  const [moqMax, setMoqMax] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState('');
  const [advancePct, setAdvancePct] = useState('');
  const [preShipmentPct, setPreShipmentPct] = useState('');
  const [postShipmentPct, setPostShipmentPct] = useState('');
  const [creditDays, setCreditDays] = useState('0');
  const [validTill, setValidTill] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const hydrateRef = useRef(0);

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

  const handleContinue = () => {
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
    const priceNum = Number(pricePerUnit);
    const moqNum = Number(moq);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setError('Enter a valid price per unit.');
      return;
    }
    if (!Number.isFinite(moqNum) || moqNum <= 0) {
      setError('Enter a valid MOQ.');
      return;
    }
    const moqMaxNum = moqMax.trim() === '' ? null : Number(moqMax);
    if (moqMaxNum != null && (!Number.isFinite(moqMaxNum) || moqMaxNum < moqNum)) {
      setError('MOQ max must be blank or ≥ MOQ.');
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

    onContinue({
      vendorId: String(vendor.id),
      vendorName: vendor.name,
      vendorEmail: vendor.email ?? null,
      pricePerUnit: priceNum,
      moq: moqNum,
      moqMax: moqMaxNum,
      leadTimeDays: leadNum,
      paymentTerms,
      validTill: validTill.trim() || null,
      note: note.trim() || null,
    });
  };

  return (
    <ProcModalShell
      eyebrow="Quote request · record quotation"
      title={`Record Quotation — ${data.qtId}`}
      subtitle={
        <>
          {data.itemName} <span className="font-mono text-xs text-slate-500">{data.itemCode}</span>
          {type && <span className="ml-1 text-xs text-slate-400">· {type}</span>}
        </>
      }
      width="max-w-2xl"
      onClose={onClose}
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-white"
          >
            Cancel
          </button>
          <button
            onClick={handleContinue}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700"
          >
            Continue to Review →
          </button>
        </>
      }
    >
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div>
        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Vendor</label>
        <VendorClientNameTypeahead
          parties={vendors}
          selectedId={vendorId}
          onSelect={handleVendorSelect}
          loading={vendorsLoading}
          partyKind="vendor"
          placeholder="Search vendor by name, code, city…"
        />
        {data.vendor && data.vendor !== 'Any (broadcast)' && (
          <p className="text-[11px] text-slate-500 mt-1">Requested vendor hint: {data.vendor}</p>
        )}
        {vendorId && (
          <p className="text-[11px] text-emerald-600 mt-1">Payment terms, lead time and notes auto-filled from the vendor master — edit if needed.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
            MOQ{data.quantityToQuote != null && <span className="ml-1 font-normal normal-case text-slate-400">(from qty to quote)</span>}
          </label>
          <input value={moq} onChange={(e) => setMoq(e.target.value)} type="number" min={1} step="any" inputMode="decimal" className={inputCls} />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">MOQ max (optional)</label>
          <input value={moqMax} onChange={(e) => setMoqMax(e.target.value)} type="number" min={0} step="any" inputMode="decimal" className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Price / unit (₹)</label>
          <input value={pricePerUnit} onChange={(e) => setPricePerUnit(e.target.value)} type="number" min={0} step="0.01" className={inputCls} />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Lead time (days)</label>
          <input value={leadTimeDays} onChange={(e) => setLeadTimeDays(e.target.value)} type="number" min={0} className={inputCls} />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Payment terms</label>
        <p className="text-[11px] text-slate-500 mb-2">
          Same three-way split as Items List and vendor masters (advance, pre-shipment, post-shipment, credit days). Auto-filled from the vendor; leave blank for “as per contract”.
        </p>
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="w-full max-w-xl text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-600">
                <th className="px-2 py-1.5 font-semibold border-b border-slate-200">Advance %</th>
                <th className="px-2 py-1.5 font-semibold border-b border-slate-200">Pre-ship %</th>
                <th className="px-2 py-1.5 font-semibold border-b border-slate-200">Post-ship %</th>
                <th className="px-2 py-1.5 font-semibold border-b border-slate-200">Credit days</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-2 py-1.5 border-t border-slate-100">
                  <input type="number" min={0} max={100} value={advancePct} onChange={(e) => setAdvancePct(e.target.value)} className={pctCls} />
                </td>
                <td className="px-2 py-1.5 border-t border-slate-100">
                  <input type="number" min={0} max={100} value={preShipmentPct} onChange={(e) => setPreShipmentPct(e.target.value)} className={pctCls} />
                </td>
                <td className="px-2 py-1.5 border-t border-slate-100">
                  <input type="number" min={0} max={100} value={postShipmentPct} onChange={(e) => setPostShipmentPct(e.target.value)} className={pctCls} />
                </td>
                <td className="px-2 py-1.5 border-t border-slate-100">
                  <input type="number" min={0} value={creditDays} onChange={(e) => setCreditDays(e.target.value)} className={pctCls} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Valid till (optional)</label>
          <input value={validTill} onChange={(e) => setValidTill(e.target.value)} type="date" className={inputCls} />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Note (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} type="text" placeholder="e.g. quoted on call, freight extra" className={inputCls} />
        </div>
      </div>

      <p className="text-[11px] text-slate-500">
        Next you’ll review this quotation. Approving it writes the price into the Items List (price list) and marks the request fulfilled — no email is sent.
      </p>
    </ProcModalShell>
  );
};
