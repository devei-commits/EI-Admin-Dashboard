import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

/**
 * Transfer Copy pick modal (Option 1 — picker enters packs).
 *
 * The system stores stock as an aggregate qty per item (no per-pack records), so the picker
 * enters the packs they physically take from the rack. From those entries we compute residuals
 * and generate labels: one per taken portion (tagged to its TR) and one per residual (restock at
 * the rack). Inventory stays aggregate — only the taken total transfers out; a residual is just a
 * re-labelled leftover pack, so it prints a restock label and does not change the item total.
 *
 * QR: labels render a code + a QR slot. Install `qrcode.react` and drop <QRCodeSVG value={label.code}/>
 * into the slot to make them scannable — kept as a placeholder so the build never breaks.
 */

export interface TransferPickLine {
  id: string;
  itemName: string;
  itemCode: string;
  requiredQty: number;
  uom: string;
  sih: number;
  rack: string;
  /** TR this line belongs to (for label tagging + the consolidated header). */
  trNo?: string;
}

export interface TransferLabel {
  code: string;
  itemName: string;
  itemCode: string;
  qty: number;
  uom: string;
  kind: 'transfer' | 'restock';
  trNo?: string;
  route?: string;
  rack?: string;
}

interface PackRow {
  id: string;
  packSize: string; // controlled input strings
  take: string;
}

interface TransferPickModalProps {
  open: boolean;
  onClose: () => void;
  /** Consolidated TR/transfer lines being picked. */
  lines: TransferPickLine[];
  /** Header context. */
  route?: string; // e.g. "MW → ML1"
  requiredDate?: string;
  requestedBy?: string;
  /** Called with generated labels + per-line picked totals when the picker confirms. */
  onConfirm: (result: { labels: TransferLabel[]; pickedByLine: Record<string, number> }) => Promise<void> | void;
  saving?: boolean;
  /** Starting label number. Pass the backend-issued next sequence when available;
   * otherwise a time-based unique seed is used (never the old hardcoded value). */
  labelSeqStart?: number;
  /** Picker assignment — required to confirm the pick. Rendered in the footer. */
  pickers?: { id: number; displayName: string }[];
  assignedPicker?: string;
  onAssignPicker?: (value: string) => void;
}

const num = (v: string): number => {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};

const uid = (() => {
  let i = 0;
  return () => `r${++i}`;
})();

const TransferPickModal = ({
  open,
  onClose,
  lines,
  route = 'MW → ML1',
  requiredDate,
  requestedBy,
  onConfirm,
  saving = false,
  labelSeqStart,
  pickers = [],
  assignedPicker,
  onAssignPicker,
}: TransferPickModalProps) => {
  // per-line pack rows keyed by line id
  const [packsByLine, setPacksByLine] = useState<Record<string, PackRow[]>>({});
  const [labels, setLabels] = useState<TransferLabel[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trNumbers = useMemo(() => {
    const set = new Set(lines.map((l) => l.trNo).filter(Boolean) as string[]);
    return Array.from(set);
  }, [lines]);

  const headerTitle =
    trNumbers.length > 0
      ? `Transfer Copy — ${trNumbers.join('/')}${trNumbers.length > 1 ? ' (consolidated)' : ''}`
      : 'Transfer Copy';

  const rowsFor = (lineId: string): PackRow[] => packsByLine[lineId] ?? [];

  const setRows = (lineId: string, rows: PackRow[]) =>
    setPacksByLine((prev) => ({ ...prev, [lineId]: rows }));

  const addRow = (lineId: string) =>
    setRows(lineId, [...rowsFor(lineId), { id: uid(), packSize: '', take: '' }]);

  const removeRow = (lineId: string, rowId: string) =>
    setRows(lineId, rowsFor(lineId).filter((r) => r.id !== rowId));

  const updateRow = (lineId: string, rowId: string, patch: Partial<PackRow>) =>
    setRows(lineId, rowsFor(lineId).map((r) => (r.id === rowId ? { ...r, ...patch } : r)));

  const takenFor = (lineId: string) => rowsFor(lineId).reduce((s, r) => s + num(r.take), 0);

  const buildLabels = (): TransferLabel[] | { error: string } => {
    const out: TransferLabel[] = [];
    // Dynamic sequence: use the backend-issued start when provided, else a time-based
    // unique seed (seconds since epoch) so each pick generates fresh, non-colliding labels.
    let seq =
      labelSeqStart && labelSeqStart > 0 ? Math.floor(labelSeqStart) : Math.floor(Date.now() / 1000);
    for (const line of lines) {
      const rows = rowsFor(line.id).filter((r) => num(r.packSize) > 0 && num(r.take) > 0);
      if (!rows.length) {
        return { error: `Add at least one pack for "${line.itemName}".` };
      }
      const taken = rows.reduce((s, r) => s + num(r.take), 0);
      if (Math.abs(taken - line.requiredQty) > 1e-6) {
        return {
          error: `"${line.itemName}": taken ${taken}${line.uom} must equal required ${line.requiredQty}${line.uom}.`,
        };
      }
      for (const r of rows) {
        const packSize = num(r.packSize);
        const take = num(r.take);
        if (take > packSize + 1e-6) {
          return { error: `"${line.itemName}": take (${take}) can't exceed pack size (${packSize}).` };
        }
        out.push({
          code: `L-${seq++}`,
          itemName: line.itemName,
          itemCode: line.itemCode,
          qty: take,
          uom: line.uom,
          kind: 'transfer',
          trNo: line.trNo,
          route,
        });
        const residual = Math.round((packSize - take) * 1e6) / 1e6;
        if (residual > 0) {
          out.push({
            code: `L-${seq++}`,
            itemName: `${line.itemName} (resid)`,
            itemCode: line.itemCode,
            qty: residual,
            uom: line.uom,
            kind: 'restock',
            rack: line.rack,
          });
        }
      }
    }
    return out;
  };

  const handleGenerate = () => {
    setError(null);
    const result = buildLabels();
    if ('error' in result) {
      setError(result.error);
      setLabels(null);
      return;
    }
    setLabels(result);
  };

  const handleConfirm = async () => {
    if (!labels) return;
    const pickedByLine: Record<string, number> = {};
    for (const line of lines) pickedByLine[line.id] = takenFor(line.id);
    await onConfirm({ labels, pickedByLine });
  };

  const handlePrint = () => window.print();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-auto py-8 px-4 print:bg-white print:p-0">
      <div
        className="bg-surface rounded-xl shadow-2xl w-full max-w-5xl print:shadow-none print:max-w-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-pick-modal-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border print:hidden">
          <div>
            <h2 id="transfer-pick-modal-title" className="text-lg font-bold text-ink">📋 {headerTitle}</h2>
            <p className="text-xs text-ink-3 mt-0.5">
              {route} · {lines.length} item{lines.length === 1 ? '' : 's'}
              {requiredDate ? ` · Required ${requiredDate}` : ''}
              {requestedBy ? ` · Requested by ${requestedBy}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-ink-4 hover:text-ink-2 text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="px-4 py-3 rounded-lg border border-err-soft bg-err-soft text-err text-sm print:hidden">{error}</div>
          )}

          {/* Items + pack entry */}
          <div className="print:hidden">
            <div className="text-sm font-semibold text-ink-2 mb-2">📦 Items + current packs available</div>
            <div className="space-y-4">
              {lines.map((line) => {
                const taken = takenFor(line.id);
                const short = line.sih < line.requiredQty;
                const balanced = Math.abs(taken - line.requiredQty) < 1e-6 && taken > 0;
                const shortBy = Math.round((line.requiredQty - line.sih) * 100) / 100;
                return (
                  <div key={line.id} className="border border-border rounded-lg">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 bg-surface-2 rounded-t-lg text-sm">
                      <div className="font-semibold text-ink">
                        {line.itemName} <span className="text-ink-4 font-normal">{line.itemCode}</span>
                      </div>
                      <div className="text-ink-2">Req <b>{line.requiredQty} {line.uom}</b></div>
                      <div className={short ? 'text-warn' : 'text-ink-2'}>
                        SIH <b>{line.sih} {line.uom}</b>{short ? ` ⚠ short ${shortBy}` : ''}
                      </div>
                      <div className="text-ink-3">
                        Rack <b className="text-ink-2">{line.rack || '—'}</b> · <b className="text-ink-2">{line.sih} {line.uom}</b> available
                      </div>
                      <div className={`ml-auto text-xs font-semibold ${balanced ? 'text-ok' : 'text-ink-4'}`}>
                        taken {taken} / {line.requiredQty} {line.uom}
                      </div>
                    </div>

                    <div className="px-4 py-3">
                      <p className="mb-1.5 text-[11px] text-ink-3 leading-snug">
                        🪓 Add one row per pack you handle. Enter the <b>pack&apos;s full size</b> and how much of it
                        you&apos;re <b>transferring</b> — the leftover auto-returns to stock with its own restock label.
                        Taking a whole pack means no leftover.
                      </p>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-ink-3">
                            <th scope="col" className="py-1 font-medium">Pack size ({line.uom})</th>
                            <th scope="col" className="py-1 font-medium">Transfer qty ({line.uom})</th>
                            <th scope="col" className="py-1 font-medium">Stays in stock</th>
                            <th scope="col" className="py-1 font-medium">Labels generated</th>
                            <th scope="col" className="py-1"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {rowsFor(line.id).map((r) => {
                            const packSize = num(r.packSize);
                            const take = num(r.take);
                            const residual = Math.max(0, Math.round((packSize - take) * 1e6) / 1e6);
                            return (
                              <tr key={r.id} className="align-top">
                                <td className="py-1 pr-2">
                                  <input value={r.packSize} onChange={(e) => updateRow(line.id, r.id, { packSize: e.target.value })}
                                    inputMode="decimal" placeholder="full pack e.g. 50"
                                    aria-label={`Pack size for ${line.itemName}`}
                                    className="w-28 px-2 py-1 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                                </td>
                                <td className="py-1 pr-2">
                                  <div className="flex items-center gap-1.5">
                                    <input value={r.take} onChange={(e) => updateRow(line.id, r.id, { take: e.target.value })}
                                      inputMode="decimal" placeholder="e.g. 25"
                                      aria-label={`Transfer quantity for ${line.itemName}`}
                                      className="w-20 px-2 py-1 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                                    {packSize > 0 && take !== packSize ? (
                                      <button type="button" onClick={() => updateRow(line.id, r.id, { take: String(packSize) })}
                                        className="text-[10px] font-semibold text-brand hover:text-brand-press whitespace-nowrap">whole pack</button>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="py-1 pr-2 text-ink-2 whitespace-nowrap">
                                  {residual > 0 ? `${residual} ${line.uom}` : take > 0 ? 'nothing (full pack)' : '—'}
                                </td>
                                <td className="py-1 pr-2 text-[11px] leading-snug">
                                  {take > 0 ? (
                                    <span className="text-ok">🏷️ Transfer {take} {line.uom}{line.trNo ? ` → ${line.trNo}` : ''}</span>
                                  ) : (
                                    <span className="text-ink-4">—</span>
                                  )}
                                  {residual > 0 ? (
                                    <span className="block text-brand">♻️ Restock {residual} {line.uom} @ {line.rack || 'rack'}</span>
                                  ) : null}
                                </td>
                                <td className="py-1 text-right">
                                  <button onClick={() => removeRow(line.id, r.id)} className="text-ink-4 hover:text-err text-xs">remove</button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <button onClick={() => addRow(line.id)} className="mt-2 text-xs font-semibold text-brand hover:text-brand-press">🪓 + Split / add pack</button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button onClick={handleGenerate} disabled={saving}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand hover:bg-brand-press text-white text-sm font-semibold disabled:opacity-50">
              Generate Labels &amp; Pick
            </button>
          </div>

          {/* Labels preview */}
          {labels && (
            <div>
              <div className="flex items-center justify-between mb-2 print:hidden">
                <div className="text-sm font-semibold text-ink-2">🏷️ Generated labels ({labels.length}) — preview before print</div>
                <button onClick={handlePrint} className="px-3 py-1.5 rounded-lg border border-border text-ink-2 text-xs font-semibold hover:bg-surface-2">Print</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {labels.map((l) => (
                  <div key={l.code} className={`border rounded-lg p-3 text-xs ${l.kind === 'restock' ? 'border-brand-soft bg-brand-soft' : 'border-border bg-surface'}`}>
                    <div className="flex items-start justify-between">
                      <div className="font-bold text-ink">{l.code}</div>
                      <QRCodeSVG
                        value={`${l.code}|${l.itemCode}|${l.qty}${l.uom}|${l.kind === 'transfer' ? l.trNo ?? '' : `RESTOCK:${l.rack ?? ''}`}`}
                        size={44}
                        level="M"
                      />

                    </div>
                    <div className="mt-1 font-semibold text-ink-2">{l.itemName}</div>
                    <div className="text-ink-3">{l.itemCode} · {l.qty} {l.uom}</div>
                    {l.kind === 'transfer' ? (
                      <div className="mt-1 text-ink-2">{l.trNo}<br />{l.route}</div>
                    ) : (
                      <div className="mt-1 text-brand font-medium">Restock<br />{l.rack}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-end gap-2 px-6 py-4 border-t border-border print:hidden">
          {onAssignPicker ? (
            <div className="mr-auto flex items-center gap-2">
              <label className="text-xs font-semibold text-ink-2 whitespace-nowrap">Picker</label>
              <select
                value={assignedPicker ?? ''}
                onChange={(e) => onAssignPicker(e.target.value)}
                aria-label="Picker"
                className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-ink"
              >
                <option value="">— Assign picker —</option>
                {pickers.map((p) => (
                  <option key={p.id} value={p.displayName}>{p.displayName}</option>
                ))}
              </select>
            </div>
          ) : null}
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-ink-2 text-sm font-semibold hover:bg-surface-2">Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={!labels || saving || (Boolean(onAssignPicker) && !String(assignedPicker ?? '').trim())}
            title={Boolean(onAssignPicker) && !String(assignedPicker ?? '').trim() ? 'Assign a picker first' : undefined}
            className="px-4 py-2 rounded-lg bg-ok hover:bg-ok text-white text-sm font-semibold disabled:opacity-50">
            {saving ? 'Saving…' : 'Confirm pick & save labels'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransferPickModal;
