/**
 * RFQ review & approve step (Procurement spec §5.3).
 * Second step of the "Record Quotation" flow: after Procurement enters the
 * vendor + price in QuotationEditPopup, this shows the RFQ document for that
 * vendor with the quoted price. "Approve & Save to Price List" treats the
 * quotation as approved and writes the price into the Items List via onApprove —
 * no email is sent. Save as PDF remains for a printable record.
 * Tool-native modal chrome; the document area is a clean print-friendly sheet.
 */
import React, { useMemo, useState } from 'react';
import { FloppyDisk, CheckCircle } from '@phosphor-icons/react';
import { ProcModalShell } from './ProcModalShell';

export interface RfqTemplateData {
  qtId: string;
  requestDate: string | null;
  vendor: string;
  itemCode: string;
  itemName: string;
  qtyTiers: string[];   // e.g. ["200 kg", "500 kg"]
  targetPrice?: string; // e.g. "≤ ₹295 / kg"
  needBy?: string | null;
  comments?: string;
  /** Item-master linkage — lets the quotation edit popup write into the right Items List row. */
  itemType?: 'RM' | 'PM';
  rawMaterialId?: number | null;
  packMaterialId?: number | null;
  /** Planning quotation-ask id — set fulfilled once a quote is recorded. Null for procurement rows. */
  askId?: number | null;
  /** MOQ hint from Planning, pre-fills the quotation form. */
  moqHint?: number | null;
  /** "Quantity to quote" from Planning items-involved — pre-fills MOQ in the record-quote popup. */
  quantityToQuote?: number | null;
}

/** The recorded quotation carried into the email step (price shown in the doc + mail body). */
export interface RfqRecordedQuote {
  vendorName: string;
  vendorEmail?: string | null;
  pricePerUnit: number;
  moq: number;
  moqMax: number | null;
  leadTimeDays: number | null;
  paymentTermsLabel?: string;
  validTill?: string | null;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return `${String(dt.getDate()).padStart(2, '0')}-${dt.toLocaleString('en-US', { month: 'short' })}-${dt.getFullYear()}`;
}

function fmtMoney(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export interface RfqTemplatePopupProps {
  data: RfqTemplateData;
  /** The recorded quotation (from the record-quotation step). */
  recordedQuote?: RfqRecordedQuote;
  onClose: () => void;
  /** Approves the quotation and writes the price into the Items List (price list). No email is sent. */
  onApprove?: () => Promise<void> | void;
}

export const RfqTemplatePopup: React.FC<RfqTemplatePopupProps> = ({ data, recordedQuote, onClose, onApprove }) => {
  const tiers = useMemo(() => data.qtyTiers.filter(Boolean), [data.qtyTiers]);
  const [saving, setSaving] = useState(false);
  const vendorLabel = recordedQuote?.vendorName ?? data.vendor;
  const priceLabel = recordedQuote ? fmtMoney(recordedQuote.pricePerUnit) : data.targetPrice || '—';

  const savePdf = () => window.print();
  const approveAndSave = async () => {
    if (saving || !onApprove) return;
    setSaving(true);
    try {
      await onApprove();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProcModalShell
      eyebrow="Quote request · review & approve"
      title={`RFQ — ${data.qtId}`}
      subtitle={<>{data.itemName} <span className="font-mono text-xs text-ink-3">{data.itemCode}</span></>}
      width="max-w-2xl"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg border border-border text-ink-2 text-sm font-semibold hover:bg-surface disabled:opacity-60">Close</button>
          <button onClick={savePdf} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-ink-2 text-sm font-semibold hover:bg-surface disabled:opacity-60"><FloppyDisk className="w-4 h-4" />Save as PDF</button>
          <button onClick={approveAndSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-bold hover:bg-brand-press disabled:opacity-60">
            {saving ? 'Saving…' : <><CheckCircle weight="fill" className="w-4 h-4" />Approve & Save to Price List</>}
          </button>
        </>
      }
    >
      {/* Document sheet */}
      <div className="rounded-lg border border-border bg-surface p-5 text-ink" style={{ fontFamily: 'Georgia, serif' }}>
        <div className="flex justify-between items-start border-b-2 border-brand pb-3 mb-3">
          <div>
            <h3 className="text-lg font-bold text-ink m-0">REQUEST FOR QUOTATION</h3>
            <p className="text-[11px] text-ink-3 mt-1">Esthetic Insights Pvt Ltd · Hyderabad · GSTIN 36AAFCE1234M1Z2</p>
          </div>
          <div className="text-right font-mono text-[11px] text-ink-3">
            <div className="font-bold">{data.qtId}</div>
            <div>Date: {fmtDate(data.requestDate)}</div>
          </div>
        </div>

        <p className="text-sm my-1">
          <b>To Vendor:</b> {vendorLabel}
          {recordedQuote?.vendorEmail && <span className="font-mono text-xs text-ink-3 ml-1">&lt;{recordedQuote.vendorEmail}&gt;</span>}
        </p>
        <p className="text-sm my-1"><b>From:</b> Procurement, Esthetic Insights</p>

        <p className="mt-3 text-sm">Quotation summary for the following material — approving records these terms to the price list.</p>

        <table className="w-full text-[12px] mt-3 border-collapse">
          <thead>
            <tr className="bg-brand text-white">
              <th scope="col" className="px-2 py-1.5 text-left font-semibold">Item Code</th>
              <th scope="col" className="px-2 py-1.5 text-left font-semibold">Item Name</th>
              {tiers.map((_, i) => <th scope="col" key={i} className="px-2 py-1.5 text-left font-semibold">Qty Tier {i + 1}</th>)}
              <th scope="col" className="px-2 py-1.5 text-left font-semibold">{recordedQuote ? 'Quoted Price' : 'Target Price'}</th>
              <th scope="col" className="px-2 py-1.5 text-left font-semibold">Need-By</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="px-2 py-1.5 font-bold">{data.itemCode}</td>
              <td className="px-2 py-1.5">{data.itemName}</td>
              {tiers.map((t, i) => <td key={i} className="px-2 py-1.5">{t}</td>)}
              <td className="px-2 py-1.5">{priceLabel}</td>
              <td className="px-2 py-1.5">{fmtDate(data.needBy)}</td>
            </tr>
          </tbody>
        </table>

        {recordedQuote && (
          <p className="mt-2 text-[12px] text-ink-3">
            <b className="text-ink-2">Terms:</b> MOQ {recordedQuote.moq}{recordedQuote.moqMax != null ? `–${recordedQuote.moqMax}` : ''}
            {recordedQuote.leadTimeDays != null && <> · Lead {recordedQuote.leadTimeDays}d</>}
            {recordedQuote.paymentTermsLabel && <> · {recordedQuote.paymentTermsLabel}</>}
            {recordedQuote.validTill && <> · Valid till {fmtDate(recordedQuote.validTill)}</>}
          </p>
        )}

        {data.comments && <p className="mt-3 text-sm italic text-ink-3"><b className="not-italic text-ink-2">Comments:</b> {data.comments}</p>}

        <p className="mt-3 text-sm">Awaiting your earliest response.</p>
        <p className="mt-2 text-sm font-bold">Regards,<br />Procurement Team · Esthetic Insights</p>
        <p className="mt-3 text-[10px] text-ink-4 italic">Auto-generated from Procurement → Track Quote Requests · {data.qtId}</p>
      </div>

      <p className="text-[10.5px] text-ink-3">
        <b>Save as PDF</b> opens the browser print dialog (choose “Save as PDF”). <b>Approve &amp; Save to Price List</b> treats this quotation as approved and writes the price into the Items List (price list) — no email is sent.
      </p>
    </ProcModalShell>
  );
};
