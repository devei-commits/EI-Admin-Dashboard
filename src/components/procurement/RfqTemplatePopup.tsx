/**
 * RFQ template generator (Procurement spec §5.3).
 * Renders a standard Request-for-Quotation document for a quote request, with
 * Save-as-PDF (browser print) and Send-Email (mailto) actions. Tool-native
 * modal chrome; the document area is a clean print-friendly sheet.
 */
import React, { useMemo } from 'react';
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
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return `${String(dt.getDate()).padStart(2, '0')}-${dt.toLocaleString('en-US', { month: 'short' })}-${dt.getFullYear()}`;
}

function buildEmailBody(d: RfqTemplateData): string {
  const tiers = d.qtyTiers.filter(Boolean).join(' / ') || '—';
  return [
    `REQUEST FOR QUOTATION — ${d.qtId}`,
    `Date: ${fmtDate(d.requestDate)}`,
    '',
    `To: ${d.vendor}`,
    '',
    'Dear Sir/Madam,',
    '',
    'Please provide your best quote for the following material at the qty tiers indicated. Kindly include delivery lead time, payment terms and validity of the offer.',
    '',
    `Item: ${d.itemName} (${d.itemCode})`,
    `Qty tiers: ${tiers}`,
    d.targetPrice ? `Target price: ${d.targetPrice}` : '',
    d.needBy ? `Need-by: ${fmtDate(d.needBy)}` : '',
    d.comments ? `\nComments: ${d.comments}` : '',
    '',
    'Awaiting your earliest response.',
    '',
    'Regards,',
    'Procurement Team · Esthetic Insights',
  ].filter((l) => l !== '').join('\n');
}

export interface RfqTemplatePopupProps {
  data: RfqTemplateData;
  onClose: () => void;
  /** Called when the email is dispatched (so the parent can flip status → REQUESTED). */
  onSent?: () => void;
}

export const RfqTemplatePopup: React.FC<RfqTemplatePopupProps> = ({ data, onClose, onSent }) => {
  const tiers = useMemo(() => data.qtyTiers.filter(Boolean), [data.qtyTiers]);

  const savePdf = () => window.print();
  const sendEmail = () => {
    const subject = encodeURIComponent(`Request for Quotation — ${data.qtId} (${data.itemName})`);
    const body = encodeURIComponent(buildEmailBody(data));
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    onSent?.();
  };

  return (
    <ProcModalShell
      eyebrow="Quote request · template"
      title={`RFQ — ${data.qtId}`}
      subtitle={<>{data.itemName} <span className="font-mono text-xs text-slate-500">{data.itemCode}</span></>}
      width="max-w-2xl"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-white">Close</button>
          <button onClick={savePdf} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-white">💾 Save as PDF</button>
          <button onClick={sendEmail} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700">📧 Send Email</button>
        </>
      }
    >
      {/* Document sheet */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 text-slate-800" style={{ fontFamily: 'Georgia, serif' }}>
        <div className="flex justify-between items-start border-b-2 border-slate-800 pb-3 mb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900 m-0">REQUEST FOR QUOTATION</h3>
            <p className="text-[11px] text-slate-500 mt-1">Esthetic Insights Pvt Ltd · Hyderabad · GSTIN 36AAFCE1234M1Z2</p>
          </div>
          <div className="text-right font-mono text-[11px] text-slate-600">
            <div className="font-bold">{data.qtId}</div>
            <div>Date: {fmtDate(data.requestDate)}</div>
          </div>
        </div>

        <p className="text-sm my-1"><b>To Vendor:</b> {data.vendor}</p>
        <p className="text-sm my-1"><b>From:</b> Procurement, Esthetic Insights</p>

        <p className="mt-3 text-sm">Dear Sir/Madam,</p>
        <p className="text-sm">Please provide your best quote for the following material at the qty tiers indicated. Kindly include delivery lead time, payment terms and validity of the offer.</p>

        <table className="w-full text-[12px] mt-3 border-collapse">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="px-2 py-1.5 text-left font-semibold">Item Code</th>
              <th className="px-2 py-1.5 text-left font-semibold">Item Name</th>
              {tiers.map((_, i) => <th key={i} className="px-2 py-1.5 text-left font-semibold">Qty Tier {i + 1}</th>)}
              <th className="px-2 py-1.5 text-left font-semibold">Target Price</th>
              <th className="px-2 py-1.5 text-left font-semibold">Need-By</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-200">
              <td className="px-2 py-1.5 font-bold">{data.itemCode}</td>
              <td className="px-2 py-1.5">{data.itemName}</td>
              {tiers.map((t, i) => <td key={i} className="px-2 py-1.5">{t}</td>)}
              <td className="px-2 py-1.5">{data.targetPrice || '—'}</td>
              <td className="px-2 py-1.5">{fmtDate(data.needBy)}</td>
            </tr>
          </tbody>
        </table>

        {data.comments && <p className="mt-3 text-sm italic text-slate-600"><b className="not-italic text-slate-700">Comments:</b> {data.comments}</p>}

        <p className="mt-3 text-sm">Awaiting your earliest response.</p>
        <p className="mt-2 text-sm font-bold">Regards,<br />Procurement Team · Esthetic Insights</p>
        <p className="mt-3 text-[10px] text-slate-400 italic">Auto-generated from Procurement → Track Quote Requests · {data.qtId}</p>
      </div>

      <p className="text-[10.5px] text-slate-500">
        <b>Save as PDF</b> opens the browser print dialog (choose “Save as PDF”). <b>Send Email</b> opens your mail client pre-filled to the vendor.
      </p>
    </ProcModalShell>
  );
};
