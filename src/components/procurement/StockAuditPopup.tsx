/**
 * Stock Audit Request popup (Spec §2.4).
 * Lets Procurement ask Warehouse to physically count an item before committing
 * a PR. Uses real warehouse locations from DB (passed via `warehouses` prop).
 */
import React, { useMemo, useState } from 'react';
import type { ProcurementRequest } from '../../types/procurement.types';
import { ProcModalShell, ModalSection } from './ProcModalShell';

export interface WarehouseSih { code: string; name: string; sih: number | null; locations: string; }

export interface StockAuditPayload {
  prId: string;
  warehouseCodes: string[];
  targetDate: string;
  comments: string;
}

export interface StockAuditPopupProps {
  req: ProcurementRequest;
  /** Per-warehouse SIH from DB locations + stock-by-location API. */
  warehouses: WarehouseSih[];
  warehousesLoading?: boolean;
  onClose: () => void;
  onSubmit: (payload: StockAuditPayload) => void | Promise<void>;
}

function todayInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const StockAuditPopup: React.FC<StockAuditPopupProps> = ({
  req,
  warehouses,
  warehousesLoading = false,
  onClose,
  onSubmit,
}) => {
  const item = req.itemDetails?.[0] ?? null;
  const totalSih = req.stockSummary?.stockInHand ?? null;
  const whs = warehouses;

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [targetDate, setTargetDate] = useState(todayInput());
  const [comments, setComments] = useState('');
  const [busy, setBusy] = useState(false);

  const toggle = (code: string) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(code) ? next.delete(code) : next.add(code);
    return next;
  });

  const canSubmit = useMemo(() => selected.size > 0 && !!targetDate && whs.length > 0, [selected, targetDate, whs.length]);

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
    <ProcModalShell
      eyebrow="Stock Audit Request"
      title={item?.itemName ?? req.code}
      subtitle={[item?.itemCode, `System SIH ${totalSih != null ? String(totalSih) : '—'}`, req.code].filter(Boolean).join(' · ')}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-ink-2 text-sm font-semibold hover:bg-surface">Cancel</button>
          <button type="button" onClick={() => void handleSubmit()} disabled={!canSubmit || busy} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-bold hover:bg-brand-press disabled:opacity-60">{busy ? 'Submitting…' : 'Submit Audit Request'}</button>
        </>
      }
    >
      <ModalSection title="SIH by Warehouse + Location">
        {warehousesLoading ? (
          <p className="mb-2 text-[10.5px] text-ink-3 bg-surface-3 border border-border rounded px-2.5 py-1.5">
            Loading warehouse locations from master data…
          </p>
        ) : whs.length === 0 ? (
          <p className="mb-2 text-[10.5px] text-err bg-err-soft border border-[color:var(--st-red-fg)]/30 rounded px-2.5 py-1.5">
            No warehouse locations found in the system. Add locations under Warehouse → Locations before raising an audit.
          </p>
        ) : null}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {whs.map((w) => (
            <div key={w.code} className="bg-surface-3 border border-border rounded-lg px-3 py-2.5">
              <h5 className="text-[10px] font-extrabold text-ink-2 uppercase">{w.name} · {w.code}</h5>
              <div className={`font-mono text-lg font-extrabold ${(w.sih ?? 0) > 0 ? 'text-brand' : 'text-ink-4'}`}>
                {(w.sih ?? 0) > 0 ? `${w.sih}` : 'No stock'}
              </div>
              <div className="text-[10px] text-ink-4 mt-0.5">Loc: {w.locations}</div>
            </div>
          ))}
        </div>
      </ModalSection>

      <ModalSection title="Audit Request — Warehouses & Target Date">
        {whs.length === 0 ? (
          <p className="text-xs text-ink-3">Select warehouses once locations are loaded.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface-3 text-ink-3">
                    {['Audit?', 'Warehouse', 'SIH', 'Existing requests for this date'].map((h) => (
                      <th scope="col" key={h} className="px-3 py-1.5 text-left text-[10px] font-bold uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {whs.map((w) => (
                    <tr key={w.code} className={selected.has(w.code) ? 'bg-ok-soft' : ''}>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={selected.has(w.code)} onChange={() => toggle(w.code)} aria-label={`Audit ${w.name} · ${w.code}`} className="w-4 h-4 accent-[color:var(--accent)]" />
                      </td>
                      <td className="px-3 py-2"><b>{w.name} · {w.code}</b></td>
                      <td className="px-3 py-2 font-mono">{(w.sih ?? 0) > 0 ? `${w.sih}` : '—'}</td>
                      <td className="px-3 py-2 text-[10.5px] text-ink-4">load hint unavailable (needs audits/by-date)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <label className="text-[11px] font-semibold text-ink-3">Target date</label>
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} aria-label="Target date"
                className="bg-warn-soft border border-dashed border-[color:var(--st-amber-fg)]/40 rounded px-2 py-1 font-mono text-xs text-warn focus:outline-none focus:ring-1 focus:ring-[color:var(--ring)]" />
            </div>
          </>
        )}
      </ModalSection>

      <ModalSection title="Comments & Urgency">
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={3}
          aria-label="Comments & urgency"
          placeholder="Why this audit is needed (e.g. system SIH doesn't match dispense log), urgency, deadline…"
          className="w-full border border-border rounded-lg px-3 py-2 text-xs bg-surface focus:ring-2 focus:ring-[color:var(--ring)] focus:border-[color:var(--accent)]"
        />
      </ModalSection>

      <div className="rounded-lg border border-[color:var(--st-green-fg)]/30 bg-ok-soft px-3.5 py-2 text-[11px] text-ok">
        <b>On Submit:</b> creates an audit request (status <b>REQUESTED</b>) in the Stock Audit tracker and sends a structured request to Warehouse Stock Check with real location codes.
      </div>
    </ProcModalShell>
  );
};
