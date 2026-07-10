/**
 * RFQ Template popup — editable RFQ document with Save, Send Email, and Approve.
 * Vendor dropdown is connected to the live vendor list.
 * Works for both planning-sourced and procurement-sourced quote requests.
 */
import React, { useMemo, useState } from 'react';
import { ProcModalShell } from './ProcModalShell';
import type { Vendor } from '../../types/procurement.types';

export interface RfqTemplateData {
  qtId: string;
  requestDate: string | null;
  vendor: string;
  itemCode: string;
  itemName: string;
  qtyTiers: string[];
  targetPrice?: string;
  needBy?: string | null;
  comments?: string;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return `${String(dt.getDate()).padStart(2, '0')}-${dt.toLocaleString('en-US', { month: 'short' })}-${dt.getFullYear()}`;
}

function buildEmailBody(params: {
  qtId: string; requestDate: string | null; vendor: string;
  itemCode: string; itemName: string; qtyTiers: string[];
  targetPrice: string; needBy: string; comments: string;
}): string {
  const tiers = params.qtyTiers.filter(Boolean).join(' / ') || '—';
  return [
    `REQUEST FOR QUOTATION — ${params.qtId}`,
    `Date: ${fmtDate(params.requestDate)}`,
    '',
    `To: ${params.vendor}`,
    '',
    'Dear Sir/Madam,',
    '',
    'Please provide your best quote for the following material at the qty tiers indicated. Kindly include delivery lead time, payment terms and validity of the offer.',
    '',
    `Item: ${params.itemName} (${params.itemCode})`,
    `Qty tiers: ${tiers}`,
    params.targetPrice ? `Target price: ${params.targetPrice}` : '',
    params.needBy ? `Need-by: ${fmtDate(params.needBy)}` : '',
    params.comments ? `\nComments: ${params.comments}` : '',
    '',
    'Awaiting your earliest response.',
    '',
    'Regards,',
    'Procurement Team · Esthetic Insights',
  ].filter((l) => l !== '').join('\n');
}

export interface RfqEditedFields {
  vendor: string;
  qtyTiers: string[];
  targetPrice: string;
  needBy: string;
  comments: string;
}

export interface RfqTemplatePopupProps {
  data: RfqTemplateData;
  vendors?: Vendor[];
  onClose: () => void;
  onSave?: (edited: RfqEditedFields) => void | Promise<void>;
  onApprove?: () => void | Promise<void>;
  onSent?: () => void;
}

export const RfqTemplatePopup: React.FC<RfqTemplatePopupProps> = ({
  data, vendors = [], onClose, onSave, onApprove, onSent,
}) => {
  const [vendorName, setVendorName] = useState(data.vendor || '');
  const [qtyTiersRaw, setQtyTiersRaw] = useState(data.qtyTiers.filter(Boolean).join(', '));
  const [needBy, setNeedBy] = useState(data.needBy ?? '');
  const [targetPrice, setTargetPrice] = useState(data.targetPrice ?? '');
  const [comments, setComments] = useState(data.comments ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [approving, setApproving] = useState(false);

  const tiers = useMemo(() => qtyTiersRaw.split(',').map((s) => s.trim()).filter(Boolean), [qtyTiersRaw]);

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.name === vendorName) ?? null,
    [vendors, vendorName],
  );

  const handleVendorChange = (name: string) => {
    setVendorName(name);
  };

  const sendEmail = () => {
    const subject = encodeURIComponent(`Request for Quotation — ${data.qtId} (${data.itemName})`);
    const body = encodeURIComponent(
      buildEmailBody({ ...data, vendor: vendorName, qtyTiers: tiers, targetPrice, needBy, comments }),
    );
    const emailTo = selectedVendor?.email ? encodeURIComponent(selectedVendor.email) : '';
    window.open(`mailto:${emailTo}?subject=${subject}&body=${body}`, '_blank');
    onSent?.();
  };

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true); setSaved(false);
    try {
      await onSave({ vendor: vendorName, qtyTiers: tiers, targetPrice, needBy, comments });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  };

  const handleApprove = async () => {
    if (!onApprove) return;
    setApproving(true);
    try { await onApprove(); } finally { setApproving(false); }
  };

  const inputCls = 'w-full border border-slate-200 rounded-md px-2.5 py-1.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white';

  return (
    <ProcModalShell
      eyebrow="RFQ · template"
      title={`RFQ — ${data.qtId}`}
      subtitle={<>{data.itemName} <span className="font-mono text-xs text-slate-500">{data.itemCode}</span></>}
      width="max-w-2xl"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-white">
            Close
          </button>
          {onSave && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-white disabled:opacity-60"
            >
              {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save Changes'}
            </button>
          )}
          <button onClick={() => window.print()} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-white">
            Save as PDF
          </button>
          <button onClick={sendEmail} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700">
            📧 Send Email
          </button>
          {onApprove && (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-60"
            >
              {approving ? 'Approving…' : '✓ Approve Quote'}
            </button>
          )}
        </>
      }
    >
      {/* ── Vendor selector + details ─────────────────────────────────── */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3 mb-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Customise before sending</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Vendor</label>
            {vendors.length > 0 ? (
              <select
                value={vendorName}
                onChange={(e) => handleVendorChange(e.target.value)}
                className={inputCls}
              >
                <option value="">— Select vendor —</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.name}>{v.name}</option>
                ))}
              </select>
            ) : (
              <input
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                className={inputCls}
                placeholder="Vendor name"
              />
            )}
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Target Price</label>
            <input value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} className={inputCls} placeholder="e.g. ≤ ₹295 / kg" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Qty Tiers (comma-separated)</label>
            <input value={qtyTiersRaw} onChange={(e) => setQtyTiersRaw(e.target.value)} className={inputCls} placeholder="e.g. 200 kg, 500 kg" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Need-By Date</label>
            <input type="date" value={needBy} onChange={(e) => setNeedBy(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 mb-1">Comments</label>
          <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2} className={inputCls + ' resize-none'} placeholder="Additional instructions for vendor…" />
        </div>

        {/* Vendor details card */}
        {selectedVendor && (
          <div className="rounded-md border border-slate-200 bg-white p-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
            <p className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Vendor Details</p>
            {selectedVendor.vendorCode && (
              <div><span className="text-slate-400">Code </span><span className="font-mono text-slate-700">{selectedVendor.vendorCode}</span></div>
            )}
            {selectedVendor.city && (
              <div><span className="text-slate-400">City </span><span className="text-slate-700">{selectedVendor.city}</span></div>
            )}
            {selectedVendor.contact && (
              <div><span className="text-slate-400">Contact </span><span className="text-slate-700">{selectedVendor.contact}</span></div>
            )}
            {selectedVendor.phone && (
              <div><span className="text-slate-400">Phone </span><span className="text-slate-700">{selectedVendor.phone}</span></div>
            )}
            {selectedVendor.email && (
              <div className="col-span-2"><span className="text-slate-400">Email </span><span className="text-slate-700">{selectedVendor.email}</span></div>
            )}
            {selectedVendor.paymentTerms && (
              <div><span className="text-slate-400">Payment Terms </span><span className="text-slate-700">{selectedVendor.paymentTerms}</span></div>
            )}
            {selectedVendor.avgLeadTime > 0 && (
              <div><span className="text-slate-400">Avg Lead </span><span className="text-slate-700">{selectedVendor.avgLeadTime}d</span></div>
            )}
            {selectedVendor.rating > 0 && (
              <div><span className="text-slate-400">Rating </span><span className="text-slate-700">{'★'.repeat(Math.round(selectedVendor.rating))}{'☆'.repeat(Math.max(0, 5 - Math.round(selectedVendor.rating)))}</span></div>
            )}
          </div>
        )}
      </div>

      {/* ── RFQ document preview ──────────────────────────────────────── */}
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

        <p className="text-sm my-1"><b>To Vendor:</b> {vendorName || '—'}</p>
        {selectedVendor?.city && <p className="text-[11px] text-slate-500 my-0.5">{selectedVendor.city}</p>}
        {selectedVendor?.email && <p className="text-[11px] text-slate-500 my-0.5">{selectedVendor.email}</p>}
        <p className="text-sm my-1 mt-2"><b>From:</b> Procurement, Esthetic Insights</p>

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
              <td className="px-2 py-1.5">{targetPrice || '—'}</td>
              <td className="px-2 py-1.5">{fmtDate(needBy || null)}</td>
            </tr>
          </tbody>
        </table>

        {comments && (
          <p className="mt-3 text-sm italic text-slate-600">
            <b className="not-italic text-slate-700">Comments:</b> {comments}
          </p>
        )}

        <p className="mt-3 text-sm">Awaiting your earliest response.</p>
        <p className="mt-2 text-sm font-bold">Regards,<br />Procurement Team · Esthetic Insights</p>
        <p className="mt-3 text-[10px] text-slate-400 italic">Auto-generated · {data.qtId}</p>
      </div>

      <p className="text-[10.5px] text-slate-500 mt-3">
        Select a vendor from the dropdown to auto-fill their email in Send Email.
        {onApprove && <> Use <b>Approve Quote</b> to confirm this quotation.</>}
      </p>
    </ProcModalShell>
  );
};
