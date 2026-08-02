/**
 * Initiate Transit popups (Procurement spec §4A per-line, §4B consolidated).
 * Light tool-native styling via ProcModalShell. Each collects a shipment qty +
 * shared vehicle details and submits to create 1 SB + 1/N GRNs.
 */
import React, { useMemo, useState } from 'react';
import { ProcModalShell, ModalSection, Field } from './ProcModalShell';
import type { InitiateTransitPayload, ConsolidatedShipmentPayload, TransitVehicle } from '../../services/grn.service';

function todayInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function toNum(v: string): number {
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

// ── Shared vehicle fields ────────────────────────────────────────────────────
function useVehicle() {
  const [v, setV] = useState<TransitVehicle>({ shippedDate: todayInput() });
  const set = (k: keyof TransitVehicle) => (val: string) => setV((p) => ({ ...p, [k]: val }));
  return { v, set };
}
const VehicleFields: React.FC<{ v: TransitVehicle; set: (k: keyof TransitVehicle) => (val: string) => void }> = ({ v, set }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
    <Field label="Vehicle No." value={v.vehicleNo ?? ''} onChange={set('vehicleNo')} placeholder="MH-04-XX-9981" />
    <Field label="Driver Name" value={v.driverName ?? ''} onChange={set('driverName')} />
    <Field label="Driver Phone" value={v.driverPhone ?? ''} onChange={set('driverPhone')} />
    <Field label="Transporter" value={v.transporter ?? ''} onChange={set('transporter')} />
    <Field label="Shipped Date" type="date" value={v.shippedDate ?? ''} onChange={set('shippedDate')} />
    <Field label="Vendor Invoice #" value={v.vendorInvoiceNo ?? ''} onChange={set('vendorInvoiceNo')} />
    <Field label="Expected Arrival" type="date" value={v.expectedArrival ?? ''} onChange={set('expectedArrival')} />
  </div>
);

const PrimaryBtn: React.FC<{ onClick: () => void; busy?: boolean; disabled?: boolean; children: React.ReactNode }> = ({ onClick, busy, disabled, children }) => (
  <button type="button" onClick={onClick} disabled={busy || disabled}
    className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-bold hover:bg-brand-press disabled:opacity-60 disabled:cursor-not-allowed">
    {busy ? 'Creating…' : children}
  </button>
);
const CancelBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button type="button" onClick={onClick} className="px-4 py-2 rounded-lg border border-border text-ink-2 text-sm font-semibold hover:bg-surface-3">Cancel</button>
);

const QtyStat: React.FC<{ label: string; value: React.ReactNode; tone?: 'default' | 'bad' }> = ({ label, value, tone = 'default' }) => (
  <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
    <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wide">{label}</p>
    <p className={`text-base font-bold tabular-nums mt-0.5 ${tone === 'bad' ? 'text-warn' : 'text-ink'}`}>{value}</p>
  </div>
);

// ─── §4A Initiate Transit (per line) ─────────────────────────────────────────
export interface InitiateTransitPopupProps {
  poId?: number | string | null;
  poNo: string;
  vendor?: string;
  item: { code: string; name: string; type?: string; unit?: string };
  poQty: number;
  alreadyShipped: number;
  onClose: () => void;
  onSubmit: (payload: InitiateTransitPayload) => Promise<void>;
}

export const InitiateTransitPopup: React.FC<InitiateTransitPopupProps> = ({ poId, poNo, vendor, item, poQty, alreadyShipped, onClose, onSubmit }) => {
  const pending = Math.max(0, poQty - alreadyShipped);
  const [qty, setQty] = useState(String(pending));
  const { v, set } = useVehicle();
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const thisQty = toNum(qty);
  const canSubmit = thisQty > 0 && thisQty <= pending;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitError(null);
    try {
      setBusy(true);
      await onSubmit({ poId, poNo, vendor, item: { code: item.code, name: item.name, type: item.type }, shippedQty: thisQty, vehicle: v });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to create shipment. Please try again.');
    } finally { setBusy(false); }
  };

  return (
    <ProcModalShell
      eyebrow="Initiate Transit · per line"
      title={poNo}
      subtitle={<>{vendor ? `${vendor} · ` : ''}<span className="font-medium text-ink">{item.name}</span> <span className="font-mono text-xs text-ink-3">{item.code}</span></>}
      onClose={onClose}
      footer={<><CancelBtn onClick={onClose} /><PrimaryBtn onClick={submit} busy={busy} disabled={!canSubmit}>Create Shipment + GRN</PrimaryBtn></>}
    >
      <ModalSection title="PO qty vs shipped (confirm before truck moves)">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <QtyStat label="PO Qty" value={`${poQty.toLocaleString('en-IN')}${item.unit ? ` ${item.unit}` : ''}`} />
          <QtyStat label="Already Shipped" value={alreadyShipped.toLocaleString('en-IN')} />
          <QtyStat label="Pending" value={pending.toLocaleString('en-IN')} tone={pending > 0 ? 'bad' : 'default'} />
          <label className="rounded-lg border border-brand-soft bg-brand-soft px-3 py-2 block">
            <span className="text-[10px] font-semibold text-brand uppercase tracking-wide">This Shipment Qty</span>
            <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal"
              className="mt-0.5 w-full bg-surface border border-brand-soft rounded px-2 py-1 text-base font-bold tabular-nums text-ink focus:ring-2 focus:ring-[color:var(--ring)] focus:outline-none" />
          </label>
        </div>
        <p className="text-[10.5px] text-ink-3 mt-1.5">Pre-filled with Pending. Reduce for a partial dispatch — the remainder stays pending for the next transit.</p>
      </ModalSection>

      <ModalSection title="Vehicle & transit details">
        <VehicleFields v={v} set={set} />
      </ModalSection>

      {submitError && (
        <div className="rounded-lg border border-[color:var(--st-red-fg)]/30 bg-err-soft px-3.5 py-2.5 text-xs text-err">
          {submitError}
        </div>
      )}
      <div className="rounded-lg border border-border bg-surface-2 px-3.5 py-2 text-[11px] text-ink-3">
        On create: a <b>Shipment Batch (SB)</b> + one <b>GRN</b> are generated (stage <b>In Transit</b>) and appear in the GRN tracker.
      </div>
    </ProcModalShell>
  );
};

// ─── §4B Consolidated Shipment (multi-item from PO) ──────────────────────────
export interface ConsolidatedLine {
  code: string; name: string; type?: string; unit?: string; poQty: number; alreadyShipped: number;
}
export interface ConsolidatedShipmentPopupProps {
  poId?: number | string | null;
  poNo: string;
  vendor?: string;
  lines: ConsolidatedLine[];
  onClose: () => void;
  onSubmit: (payload: ConsolidatedShipmentPayload) => Promise<void>;
}

export const ConsolidatedShipmentPopup: React.FC<ConsolidatedShipmentPopupProps> = ({ poId, poNo, vendor, lines, onClose, onSubmit }) => {
  const initial = useMemo(() => lines.map((l) => {
    const pending = Math.max(0, l.poQty - l.alreadyShipped);
    return { checked: pending > 0, qty: String(pending), pending };
  }), [lines]);
  const [rows, setRows] = useState(initial);
  const { v, set } = useVehicle();
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const allDispatched = rows.every((r) => r.pending <= 0) && lines.length > 0;

  const setRow = (i: number, patch: Partial<{ checked: boolean; qty: string }>) =>
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const selected = rows
    .map((r, i) => ({ r, line: lines[i] }))
    .filter(({ r }) => r.checked && toNum(r.qty) > 0);
  const totalLoad = selected.reduce((s, { r }) => s + toNum(r.qty), 0);
  const canSubmit = selected.length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitError(null);
    try {
      setBusy(true);
      await onSubmit({
        poId, poNo, vendor,
        lines: selected.map(({ r, line }) => ({ code: line.code, name: line.name, type: line.type, shippedQty: toNum(r.qty) })),
        vehicle: v,
      });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to create shipment. Please try again.');
    } finally { setBusy(false); }
  };

  return (
    <ProcModalShell
      eyebrow="Consolidated Shipment · multi-item"
      title={poNo}
      subtitle={<>{vendor ? `${vendor} · ` : ''}select items on THIS truck — creates 1 SB + N GRNs</>}
      width="max-w-3xl"
      onClose={onClose}
      footer={<><CancelBtn onClick={onClose} /><PrimaryBtn onClick={submit} busy={busy} disabled={!canSubmit}>Create Shipment + {selected.length} GRN{selected.length !== 1 ? 's' : ''}</PrimaryBtn></>}
    >
      <ModalSection title="PO lines · pick which go on this truck">
        {allDispatched && (
          <div className="mb-3 rounded-lg border border-[color:var(--st-amber-fg)]/30 bg-warn-soft px-3.5 py-2.5 text-xs text-warn">
            <b>All items in this PO are already dispatched.</b> Pending is 0 for every line — either goods are in transit or have been received. To ship additional quantity, raise a new PO or cancel the existing GRN if it was created in error.
          </div>
        )}
        <div className="overflow-auto max-h-[70vh] rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="bg-surface-3 text-ink-3 [&_th]:bg-surface-3">
                {['Ship?', 'Item', 'PO Qty', 'Already Dispatched', 'Pending', 'This Shipment Qty'].map((h) => (
                  <th scope="col" key={h} className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wide ${['PO Qty', 'Already Dispatched', 'Pending', 'This Shipment Qty'].includes(h) ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {lines.map((l, i) => {
                const r = rows[i];
                const disabled = r.pending <= 0;
                const dispatchedFull = disabled && l.alreadyShipped > 0 && l.alreadyShipped >= l.poQty;
                const noQty = disabled && l.poQty <= 0;
                return (
                  <tr key={`${l.code}-${i}`} className={r.checked ? 'bg-brand-soft' : disabled ? 'opacity-50' : ''}>
                    <td className="px-3 py-2 text-center"><input type="checkbox" disabled={disabled} checked={r.checked} onChange={(e) => setRow(i, { checked: e.target.checked })} aria-label={`Ship ${l.name}`} className="w-4 h-4 accent-brand" /></td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-ink text-xs">{l.name}</div>
                      <div className="text-[10px] text-ink-4 font-mono">{l.code}</div>
                      {dispatchedFull && <span className="inline-flex mt-0.5 items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-warn-soft text-warn border border-[color:var(--st-amber-fg)]/30">Dispatched</span>}
                      {noQty && <span className="inline-flex mt-0.5 items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-surface-3 text-ink-3 border border-border">No PO qty</span>}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums text-xs text-ink-2">{l.poQty.toLocaleString('en-IN')}{l.unit ? ` ${l.unit}` : ''}</td>
                    <td className="px-3 py-2 text-center tabular-nums text-xs text-ink-3">{l.alreadyShipped.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-center tabular-nums text-xs text-warn font-semibold">{r.pending.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-center">
                      {disabled ? <span className="text-ink-4 text-xs">—</span> : (
                        <input value={r.qty} onChange={(e) => setRow(i, { qty: e.target.value })} disabled={!r.checked} inputMode="decimal" aria-label={`This shipment qty for ${l.name}`}
                          className="w-20 text-center bg-surface border border-border rounded px-1.5 py-1 text-xs font-bold tabular-nums focus:ring-2 focus:ring-[color:var(--ring)] focus:outline-none disabled:bg-surface-2 disabled:text-ink-4" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10.5px] text-ink-3 mt-1.5"><b>{selected.length}</b> line{selected.length !== 1 ? 's' : ''} selected · total load <b>{totalLoad.toLocaleString('en-IN')}</b>. Unchecked lines keep their Pending open for a later transit.</p>
      </ModalSection>

      <ModalSection title="Vehicle & transit details (apply to all checked items)">
        <VehicleFields v={v} set={set} />
      </ModalSection>

      {submitError && (
        <div className="rounded-lg border border-[color:var(--st-red-fg)]/30 bg-err-soft px-3.5 py-2.5 text-xs text-err">
          {submitError}
        </div>
      )}
      <div className="rounded-lg border border-border bg-surface-2 px-3.5 py-2 text-[11px] text-ink-3">
        On create: <b>one Shipment Batch</b> with <b>{selected.length || 'N'}</b> child GRN{selected.length !== 1 ? 's' : ''} (all stage <b>In Transit</b>, same truck) — they share the SB# in the GRN tracker.
      </div>
    </ProcModalShell>
  );
};
