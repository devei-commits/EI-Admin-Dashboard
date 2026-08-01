/**
 * Release to Draft PO popup (Spec §3C).
 * Final gate before a PR becomes a Draft PO. Editable PO Date drives a live
 * Expected-Date recompute: expected = po_date + avg_actual_lead. On Push it
 * hands the chosen po_date / expected_date back to the parent to create the PO.
 */
import React, { useMemo, useState } from 'react';
import { Truck, Warning, ClipboardText, Package } from '@phosphor-icons/react';
import type { ProcurementRequest } from '../../types/procurement.types';
import { PrPopupShell, StatCell, PopupSection } from './PrPopupShell';

function parseDate(d: string | null | undefined): Date | null {
  if (!d) return null;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}
function fmtDate(d: string | Date | null | undefined): string {
  const dt = typeof d === 'string' || d == null ? parseDate(d as string) : d;
  if (!dt) return '—';
  const day = String(dt.getDate()).padStart(2, '0');
  const mon = dt.toLocaleString('en-US', { month: 'short' });
  return `${day}-${mon}-${dt.getFullYear()}`;
}
function toInputDate(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + Math.round(days));
  return d;
}
function dayDiff(a: Date, b: Date): number {
  const x = new Date(a); x.setHours(0, 0, 0, 0);
  const y = new Date(b); y.setHours(0, 0, 0, 0);
  return Math.round((x.getTime() - y.getTime()) / 86_400_000);
}

export interface ReleaseToDraftPayload {
  prId: string;
  poDate: string;        // yyyy-mm-dd
  expectedDate: string;  // yyyy-mm-dd
  leadDays: number;
}

export interface ReleaseToDraftPopupProps {
  req: ProcurementRequest;
  onClose: () => void;
  onPush: (payload: ReleaseToDraftPayload) => void | Promise<void>;
}

export const ReleaseToDraftPopup: React.FC<ReleaseToDraftPopupProps> = ({ req, onClose, onPush }) => {
  const item = req.itemDetails?.[0] ?? null;
  const leadDays = item?.leadTimeDays ?? 0;
  const reqQty = item?.reqQty ?? 0;
  const unit = item?.unit ?? '';
  const price = item?.plannedPrice ?? 0;
  const needBy = parseDate(req.dueDate);
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  const [poDateStr, setPoDateStr] = useState<string>(toInputDate(today));
  const [busy, setBusy] = useState(false);

  const poDate = parseDate(poDateStr) ?? today;
  const expected = addDays(poDate, leadDays);
  const lateBy = needBy ? Math.max(0, dayDiff(expected, needBy)) : 0;
  const totalValue = reqQty * price;

  // Live recompute scenarios (informational — only top PO Date is used on push).
  const scenarios = useMemo(() => {
    const opts: { label: string; date: Date }[] = [
      { label: `${fmtDate(poDate)} (chosen)`, date: poDate },
      { label: `${fmtDate(addDays(poDate, -1))} (−1 day)`, date: addDays(poDate, -1) },
      { label: `${fmtDate(addDays(poDate, -4))} (−4 days)`, date: addDays(poDate, -4) },
    ];
    if (needBy) opts.push({ label: `${fmtDate(addDays(needBy, -leadDays))} (earliest on-time)`, date: addDays(needBy, -leadDays) });
    return opts.map((o) => {
      const exp = addDays(o.date, leadDays);
      const late = needBy ? Math.max(0, dayDiff(exp, needBy)) : 0;
      return { ...o, expected: exp, late };
    });
  }, [poDate, needBy, leadDays]);

  const handlePush = async () => {
    try {
      setBusy(true);
      await onPush({ prId: req.id, poDate: toInputDate(poDate), expectedDate: toInputDate(expected), leadDays });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PrPopupShell
      title={<span className="inline-flex items-center gap-2"><Truck className="w-4 h-4" /> Release to Draft PO — {req.code}</span>}
      code={item ? `${item.itemName} · ${item.itemCode}` : undefined}
      subtitle={item ? `Vendor: ${req.preferredVendor || '—'} · ${reqQty} ${unit} @ ₹${price} = ₹${totalValue.toLocaleString('en-IN')}` : undefined}
      primaryLabel="Push to Draft"
      onPrimary={handlePush}
      primaryBusy={busy}
      onClose={onClose}
    >
      {/* Top stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <StatCell label="Vendor Lead (Actual)" value={`${leadDays}d`} />
        <div className="bg-surface-3 border border-border rounded-lg px-3 py-2">
          <div className="text-[9.5px] font-bold text-ink-4 uppercase tracking-wide">PO Date</div>
          <input
            type="date"
            aria-label="PO Date"
            value={poDateStr}
            onChange={(e) => setPoDateStr(e.target.value)}
            className="mt-0.5 w-full bg-warn-soft border border-dashed border-[color:var(--st-amber-fg)]/40 rounded px-1.5 py-0.5 font-mono text-[12px] font-bold text-warn focus:outline-none focus:ring-1 focus:ring-[color:var(--ring)]"
          />
        </div>
        <StatCell label="Computed Expected" value={fmtDate(expected)} tone="info" />
        <StatCell label="Need-By" value={fmtDate(needBy)} />
      </div>

      {/* Warning if late */}
      {lateBy > 0 && (
        <div className="mt-3 rounded-lg border border-[color:var(--st-red-fg)]/30 bg-err-soft px-3.5 py-2.5 text-xs text-err flex items-start gap-1.5">
          <Warning className="w-4 h-4 shrink-0" />
          <div>
          <b>Expected ({fmtDate(expected)}) is AFTER Need-By ({fmtDate(needBy)})</b> — {lateBy} day{lateBy !== 1 ? 's' : ''} late.
          <ul className="mt-1.5 ml-4 list-disc space-y-0.5 text-err">
            <li>Negotiate faster delivery (committed lead drops)</li>
            <li>Switch to a closer vendor</li>
            <li>Push the batch need-by back (handled in Planning)</li>
          </ul>
          </div>
        </div>
      )}

      {/* Live recompute table */}
      <PopupSection title={<><ClipboardText className="w-4 h-4" /> Live recompute — change PO Date to see Expected shift</>}>
        <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-surface-3 text-ink-3">
              <th scope="col" className="px-3 py-1.5 text-left text-[10px] font-bold uppercase">If PO Date =</th>
              <th scope="col" className="px-3 py-1.5 text-center text-[10px] font-bold uppercase">→ Expected Date</th>
              <th scope="col" className="px-3 py-1.5 text-left text-[10px] font-bold uppercase">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {scenarios.map((s, i) => (
              <tr key={i} className={i === 0 ? 'bg-brand-soft' : ''}>
                <td className="px-3 py-1.5 font-mono text-ink-2">{s.label}</td>
                <td className="px-3 py-1.5 text-center font-bold text-ink">{fmtDate(s.expected)}</td>
                <td className="px-3 py-1.5">
                  {s.late > 0
                    ? <span className="inline-block px-2 py-0.5 rounded-full bg-err-soft text-err text-[10px] font-bold">{s.late}d late</span>
                    : <span className="inline-block px-2 py-0.5 rounded-full bg-ok-soft text-ok text-[10px] font-bold">on time</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1.5 text-[10px] text-ink-4">Live recompute is informational — only the chosen PO Date (top) is used when pushing to Draft.</p>
      </PopupSection>

      {/* PO summary */}
      <PopupSection title={<><Package className="w-4 h-4" /> PO summary at push time</>}>
        <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
          <tbody className="divide-y divide-hairline">
            {[
              ['PO Number', '(auto-generated on push)'],
              ['Vendor', req.preferredVendor || '—'],
              ['Item', item ? `${item.itemCode} · ${item.itemName}` : '—'],
              ['Qty', `${reqQty} ${unit}`],
              ['Price / unit', `₹${price}`],
              ['Total', `₹${totalValue.toLocaleString('en-IN')} + GST`],
              ['PO Date', fmtDate(poDate)],
              ['Expected Date', `${fmtDate(expected)} (PO Date + ${leadDays}d actual lead)`],
            ].map(([k, v]) => (
              <tr key={k}>
                <th scope="col" className="px-3 py-1.5 text-left bg-surface-3 text-[10px] font-bold uppercase text-ink-3 w-40">{k}</th>
                <td className="px-3 py-1.5 font-mono text-ink-2">{v}</td>
              </tr>
            ))}
            <tr>
              <th scope="col" className="px-3 py-1.5 text-left bg-surface-3 text-[10px] font-bold uppercase text-ink-3">Status on push</th>
              <td className="px-3 py-1.5"><span className="inline-block px-2 py-0.5 rounded-full bg-surface-3 text-ink-3 text-[10px] font-bold">DRAFT</span></td>
            </tr>
          </tbody>
        </table>
      </PopupSection>
    </PrPopupShell>
  );
};
