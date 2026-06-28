/**
 * Stock Audit Request popup (Spec §3B).
 * Lets Procurement ask Warehouse to physically count an item before committing
 * a PR. Shows SIH-by-warehouse, lets the user pick target warehouse(s) + date,
 * add a reason, and Submit → creates an audit request (§6 tracker).
 *
 * NOTE: per-warehouse SIH + "existing audits on this date" load-hint need
 * backend endpoints (GET items/:code/sih-by-warehouse, GET audits/by-date/:date)
 * that don't exist yet — those areas degrade gracefully until wired.
 */
import React, { useMemo, useState } from 'react';
import type { ProcurementRequest } from '../../types/procurement.types';
import { PrPopupShell, PopupSection } from './PrPopupShell';

export interface WarehouseSih { code: string; name: string; sih: number | null; locations: string; }

export interface StockAuditPayload {
  prId: string;
  warehouseCodes: string[];
  targetDate: string;
  comments: string;
}

export interface StockAuditPopupProps {
  req: ProcurementRequest;
  /** Per-warehouse SIH; when empty the spec's 3 EI warehouses are shown with unknown SIH. */
  warehouses?: WarehouseSih[];
  onClose: () => void;
  onSubmit: (payload: StockAuditPayload) => void | Promise<void>;
}

const DEFAULT_WAREHOUSES: WarehouseSih[] = [
  { code: 'WH-01', name: 'Hyderabad Main', sih: null, locations: '—' },
  { code: 'WH-02', name: 'Hyderabad Annexe', sih: null, locations: '—' },
  { code: 'WH-03', name: 'Bangalore', sih: null, locations: '—' },
];

function todayInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const StockAuditPopup: React.FC<StockAuditPopupProps> = ({ req, warehouses, onClose, onSubmit }) => {
  const item = req.itemDetails?.[0] ?? null;
  const totalSih = req.stockSummary?.stockInHand ?? null;
  const whs = warehouses && warehouses.length ? warehouses : DEFAULT_WAREHOUSES;

  const [selected, setSelected] = useState<Set<string>>(() => new Set(whs.filter((w) => (w.sih ?? 0) > 0).map((w) => w.code)));
  const [targetDate, setTargetDate] = useState(todayInput());
  const [comments, setComments] = useState('');
  const [busy, setBusy] = useState(false);

  const toggle = (code: string) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(code) ? next.delete(code) : next.add(code);
    return next;
  });

  const canSubmit = useMemo(() => selected.size > 0 && !!targetDate, [selected, targetDate]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setBusy(true);
      await onSubmit({ prId: req.id, warehouseCodes: [...selected], targetDate, comments: comments.trim() });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PrPopupShell
      title={<span>📦 Stock Audit Request — {item?.itemName ?? req.code}</span>}
      code={item?.itemCode}
      subtitle={`System SIH ${totalSih != null ? `${totalSih}` : '—'} · Linked ${req.code}`}
      primaryLabel="Submit Audit Request"
      onPrimary={handleSubmit}
      primaryBusy={busy}
      primaryDisabled={!canSubmit}
      onClose={onClose}
    >
      {/* SIH by warehouse cards */}
      <PopupSection title="🏭 SIH by warehouse + location" first>
        {(!warehouses || !warehouses.length) && (
          <p className="mb-2 text-[10.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
            Per-warehouse SIH isn't wired yet — showing EI's 3 warehouses with unknown split (total SIH {totalSih != null ? totalSih : '—'}). Needs <code className="font-mono">GET items/:code/sih-by-warehouse</code>.
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {whs.map((w) => (
            <div key={w.code} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
              <h5 className="text-[10px] font-extrabold text-slate-700 uppercase">{w.name} · {w.code}</h5>
              <div className={`font-mono text-lg font-extrabold ${(w.sih ?? 0) > 0 ? 'text-blue-600' : 'text-slate-400'}`}>{w.sih != null ? `${w.sih}` : '—'}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Loc: {w.locations}</div>
            </div>
          ))}
        </div>
      </PopupSection>

      {/* Audit request — WH selection + date */}
      <PopupSection title="📅 Audit request — target warehouse(s) & date">
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500">
                {['Audit?', 'Warehouse', 'SIH', 'Existing requests for this date'].map((h) => (
                  <th key={h} className="px-3 py-1.5 text-left text-[10px] font-bold uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {whs.map((w) => {
                const disabled = w.sih != null && w.sih <= 0;
                return (
                  <tr key={w.code} className={selected.has(w.code) ? 'bg-emerald-50' : disabled ? 'opacity-50' : ''}>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" disabled={disabled} checked={selected.has(w.code)} onChange={() => toggle(w.code)} className="w-4 h-4 accent-blue-600" />
                    </td>
                    <td className="px-3 py-2"><b>{w.name} · {w.code}</b></td>
                    <td className="px-3 py-2 font-mono">{w.sih != null ? `${w.sih}` : '—'}</td>
                    <td className="px-3 py-2 text-[10.5px] text-slate-400">load hint unavailable (needs audits/by-date)</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <label className="text-[11px] font-semibold text-slate-600">Target date</label>
          <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
            className="bg-amber-50 border border-dashed border-amber-400 rounded px-2 py-1 font-mono text-xs text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-500" />
        </div>
      </PopupSection>

      {/* Comments */}
      <PopupSection title="📝 Comments & urgency">
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={3}
          placeholder="Why this audit is needed (e.g. system SIH doesn't match dispense log), urgency, deadline…"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </PopupSection>

      <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-[11px] text-emerald-800">
        <b>On Submit:</b> creates an audit request (status <b>REQUESTED</b>) in the Stock Audit tracker (§6) and shows an "📦 Audit pending" chip on this PR. When Warehouse submits the count, the PR's SIH refreshes.
      </div>
    </PrPopupShell>
  );
};
