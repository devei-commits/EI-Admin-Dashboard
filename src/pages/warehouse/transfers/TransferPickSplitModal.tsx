/**
 * Transfer Pick / Split modal (step 2 of the transfer flow).
 *
 * Shows real available packs (warehouse pack inventory, FEFO-sorted) for the required item.
 * Pick takes what's still needed from a pack/rack; Split takes a chosen quantity. Everything
 * here is CLIENT-SIDE — no packs are written to the DB — so Remove cleanly undoes a pick, the
 * available list reverts, and labels stay in sync. The picks are materialised only when the
 * transfer is completed. Labels shown here (transfer + the warehouse remainder) use provisional
 * pack numbers finalised at completion.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { X, Package, Scissors, Trash2, Loader2, Printer } from 'lucide-react';
import { fetchAvailablePacks, type WarehousePack } from '../../../services/warehousePacks.service';

export interface TransferPickSplitItem {
  name: string;
  itemCode?: string;
  rawMaterialId?: number | null;
  packMaterialId?: number | null;
  productId?: number | null;
}

/** A take from a source pack/rack — `pack` is the source, `qty` is how much is taken. */
export interface PickedCartEntry {
  pack: WarehousePack;
  qty: number;
}

interface CartLine {
  id: string;
  source: WarehousePack;
  qty: number;
}

export interface TransferPickSplitModalProps {
  open: boolean;
  onClose: () => void;
  requestNo: string;
  item: TransferPickSplitItem;
  qtyRequired: number;
  unit?: string;
  sourceLabel?: string;
  pickers: { id: number; email: string; displayName: string }[];
  assignedPicker: string;
  onAssignPicker: (value: string) => void;
  onNext: (cart: PickedCartEntry[]) => void;
  onError?: (message: string) => void;
}

function fmtMonYear(date: string | null | undefined): string {
  const raw = String(date ?? '').trim();
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(raw);
  if (!m) return raw || '—';
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const mi = Number(m[2]) - 1;
  return mi >= 0 && mi < 12 ? `${months[mi]}/${m[1]}` : raw;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Provisional pack-number base for a source (real pack keeps its number; loose uses its rack). */
function baseCode(source: WarehousePack): string {
  return source.packagingNo ?? `PKG-WH-${source.rackId ?? source.rack ?? 'x'}`;
}

export const TransferPickSplitModal: React.FC<TransferPickSplitModalProps> = ({
  open,
  onClose,
  requestNo,
  item,
  qtyRequired,
  unit = 'kg',
  sourceLabel,
  pickers,
  assignedPicker,
  onAssignPicker,
  onNext,
  onError,
}) => {
  const [packs, setPacks] = useState<WarehousePack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [splitDraft, setSplitDraft] = useState<{ source: WarehousePack; take: number } | null>(null);
  const idRef = useRef(0);
  const labelsRef = useRef<HTMLDivElement>(null);

  const materialQuery = useMemo(
    () => ({
      rawMaterialId: item.rawMaterialId ?? null,
      packMaterialId: item.packMaterialId ?? null,
      productId: item.productId ?? null,
    }),
    [item.rawMaterialId, item.packMaterialId, item.productId],
  );

  const loadPacks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPacks(await fetchAvailablePacks(materialQuery));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load available packs');
    } finally {
      setLoading(false);
    }
  }, [materialQuery]);

  useEffect(() => {
    if (!open) return;
    setCart([]);
    setSplitDraft(null);
    void loadPacks();
  }, [open, loadPacks]);

  const takenFrom = useCallback(
    (key: string) => round2(cart.filter((c) => c.source.key === key).reduce((s, c) => s + c.qty, 0)),
    [cart],
  );

  if (!open) return null;

  const pickedTotal = round2(cart.reduce((s, c) => s + c.qty, 0));
  const remaining = round2(qtyRequired - pickedTotal);
  const remainingOf = (source: WarehousePack) => round2(source.qty - takenFrom(source.key));
  const availableToShow = packs.filter((p) => remainingOf(p) > 0);

  const pick = (source: WarehousePack): void => {
    const rem = remainingOf(source);
    const take = remaining > 0 ? Math.min(rem, remaining) : rem;
    if (!(take > 0)) return;
    idRef.current += 1;
    setCart((prev) => [...prev, { id: `L${idRef.current}`, source, qty: round2(take) }]);
  };
  const openSplit = (source: WarehousePack): void => {
    const rem = remainingOf(source);
    const take = remaining > 0 ? Math.min(rem, remaining) : round2(rem / 2);
    setSplitDraft({ source, take: round2(take) });
  };
  const confirmSplit = (): void => {
    if (!splitDraft) return;
    const rem = remainingOf(splitDraft.source);
    const take = round2(splitDraft.take);
    if (!(take > 0)) {
      onError?.('Enter a quantity to take.');
      return;
    }
    if (take > rem + 0.001) {
      onError?.(`Only ${rem} ${unit} left on this ${splitDraft.source.kind === 'stock' ? 'rack' : 'pack'}.`);
      return;
    }
    idRef.current += 1;
    setCart((prev) => [...prev, { id: `L${idRef.current}`, source: splitDraft.source, qty: take }]);
    setSplitDraft(null);
  };
  const removeFromCart = (id: string): void => {
    setCart((prev) => prev.filter((c) => c.id !== id));
  };

  // Labels: one per take (transfer) + one remainder per source that's been partially taken (warehouse).
  const getLabelPacks = (): { code: string; source: WarehousePack; qty: number; forTransfer: boolean }[] => {
    const out: { code: string; source: WarehousePack; qty: number; forTransfer: boolean }[] = [];
    cart.forEach((c, i) => out.push({ code: `${baseCode(c.source)}-T${i + 1}`, source: c.source, qty: c.qty, forTransfer: true }));
    const bySource = new Map<string, WarehousePack>();
    for (const c of cart) bySource.set(c.source.key, c.source);
    for (const source of bySource.values()) {
      const rem = remainingOf(source);
      if (rem > 0.001) out.push({ code: `${baseCode(source)}-R`, source, qty: rem, forTransfer: false });
    }
    return out;
  };

  const printLabels = (): void => {
    const labelPacks = getLabelPacks();
    if (!labelPacks.length) return;
    const canvases = labelsRef.current
      ? Array.from(labelsRef.current.querySelectorAll<HTMLCanvasElement>('canvas'))
      : [];
    const win = window.open('', '_blank', 'width=900,height=760');
    if (!win) {
      onError?.('Could not open print window. Allow popups and try again.');
      return;
    }
    const esc = (v: unknown) =>
      String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const cards = labelPacks
      .map((lp, i) => {
        const qr = canvases[i]?.toDataURL('image/png') ?? '';
        const rows = [
          ['Use', lp.forTransfer ? 'TRANSFER' : 'WAREHOUSE (stays)'],
          ['Item', item.name],
          ['Batch', lp.source.vendorBatch || '—'],
          ['MFG', fmtMonYear(lp.source.mfgDate)],
          ['EXP', fmtMonYear(lp.source.expDate)],
          ['Qty', `${lp.qty} ${lp.source.unit || unit}`],
          ['Location', [lp.source.zone, lp.source.rack].filter(Boolean).join(' · ') || '—'],
        ]
          .map(([k, v]) => `<div class="row"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`)
          .join('');
        return `<article class="label"><div class="pkg">📦 ${esc(lp.code)}</div><div class="qrwrap">${qr ? `<img src="${esc(qr)}"/>` : ''}</div><div class="rows">${rows}</div><div class="pkgfoot">${esc(lp.code)}</div></article>`;
      })
      .join('');
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>Transfer Pack Labels</title><style>
      body{font-family:Arial,sans-serif;padding:12px;color:#0f172a;}
      .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;}
      .label{border:1px solid #cbd5e1;border-radius:8px;padding:12px;break-inside:avoid;}
      .pkg{font-size:13px;font-weight:700;margin-bottom:8px;}
      .qrwrap{text-align:center;margin-bottom:8px;} .qrwrap img{width:150px;height:150px;object-fit:contain;}
      .row{display:flex;justify-content:space-between;gap:8px;font-size:12px;margin:3px 0;}
      .k{color:#64748b;font-weight:600;} .v{color:#0f172a;font-weight:700;text-align:right;}
      .pkgfoot{margin-top:8px;text-align:center;font-family:monospace;font-size:11px;color:#334155;}
      @media print{body{padding:0;} .label{border:1px solid #000;page-break-inside:avoid;}}
    </style></head><body><div class="grid">${cards}</div><script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};</script></body></html>`);
    win.document.close();
  };

  const labelPacks = getLabelPacks();
  const warehouseCount = labelPacks.filter((lp) => !lp.forTransfer).length;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="relative my-4 w-full max-w-5xl rounded-xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Request No.</div>
              <div className="font-semibold text-slate-900">{requestNo}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Item</div>
              <div className="font-semibold text-slate-900">{item.name}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Qty required</div>
              <div className="font-semibold text-slate-900">
                {qtyRequired.toLocaleString('en-IN')} {unit}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step 1 · Assign picker (required) */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-amber-50/50 px-6 py-3">
          <label htmlFor="pick-assign-picker" className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            1 · Assign picker *
          </label>
          <select
            id="pick-assign-picker"
            value={assignedPicker}
            onChange={(e) => onAssignPicker(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="">Select picker…</option>
            {pickers.map((p) => (
              <option key={p.id} value={p.displayName}>
                {p.displayName}
              </option>
            ))}
          </select>
          {assignedPicker.trim() ? (
            <span className="text-xs font-semibold text-emerald-700">✓ {assignedPicker}</span>
          ) : (
            <span className="text-xs text-amber-700">Assign a picker before picking.</span>
          )}
        </div>

        <div className="space-y-4 px-6 py-5">
          {/* Available packaging */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">
              Available packaging{sourceLabel ? ` (source: ${sourceLabel})` : ''}
            </h3>
            {loading ? (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-6 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading available packs…
              </div>
            ) : error ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">{error}</p>
            ) : availableToShow.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
                No available packs for this item at the source warehouse.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Packaging No.</th>
                      <th className="px-3 py-2 text-left">Zone</th>
                      <th className="px-3 py-2 text-left">Rack</th>
                      <th className="px-3 py-2 text-left">Vendor Batch</th>
                      <th className="px-3 py-2 text-left">MFG</th>
                      <th className="px-3 py-2 text-left">EXP</th>
                      <th className="px-3 py-2 text-right">Qty available</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {availableToShow.map((p) => (
                      <tr key={p.key} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2 font-mono text-xs font-semibold text-slate-800">
                          {p.packagingNo ?? <span className="italic text-slate-500">Loose stock</span>}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{p.zone || '—'}</td>
                        <td className="px-3 py-2 text-slate-700">{p.rack || '—'}</td>
                        <td className="px-3 py-2 text-slate-700">{p.vendorBatch || '—'}</td>
                        <td className="px-3 py-2 text-slate-700">{fmtMonYear(p.mfgDate)}</td>
                        <td className="px-3 py-2 text-slate-700">{fmtMonYear(p.expDate)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                          {remainingOf(p).toLocaleString('en-IN')} {p.unit || unit}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => pick(p)}
                              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                            >
                              <Package className="h-3.5 w-3.5" /> Pick
                            </button>
                            <button
                              type="button"
                              onClick={() => openSplit(p)}
                              title="Take a specific quantity — the remainder stays with its own label"
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              <Scissors className="h-3.5 w-3.5" /> Split
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-xs text-slate-500">
              📌 FEFO (First Expiry First Out) — earliest-expiry packs first. Pick takes what's still needed; Split
              takes a specific amount and labels the remainder. Nothing is committed until you complete the transfer.
            </p>
          </div>

          {/* Split draft */}
          {splitDraft ? (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-800">
                  Split {splitDraft.source.packagingNo ?? `loose stock @ ${splitDraft.source.rack || splitDraft.source.zone || 'rack'}`} ·{' '}
                  {remainingOf(splitDraft.source)} {unit} left
                </h4>
                <button onClick={() => setSplitDraft(null)} className="text-slate-400 hover:text-slate-700" aria-label="Cancel split">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="split-take">
                      Qty to take *
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        id="split-take"
                        type="number"
                        min={0}
                        max={remainingOf(splitDraft.source)}
                        value={splitDraft.take}
                        onChange={(e) =>
                          setSplitDraft((prev) =>
                            prev
                              ? { ...prev, take: Math.max(0, Math.min(remainingOf(prev.source), Number(e.target.value) || 0)) }
                              : prev,
                          )
                        }
                        className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <span className="text-sm text-slate-500">{unit}</span>
                    </div>
                  </div>
                  <div className="text-sm text-slate-600">
                    Remaining:{' '}
                    <span className="font-semibold text-slate-900">
                      {round2(remainingOf(splitDraft.source) - (Number(splitDraft.take) || 0)).toLocaleString('en-IN')} {unit}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Two labels — <strong>{round2(Number(splitDraft.take) || 0)} {unit}</strong> for the transfer and{' '}
                  <strong>{round2(remainingOf(splitDraft.source) - (Number(splitDraft.take) || 0))} {unit}</strong> that stays
                  in the warehouse.
                </p>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button onClick={() => setSplitDraft(null)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  onClick={confirmSplit}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  <Scissors className="h-4 w-4" /> Take {round2(Number(splitDraft.take) || 0)} {unit} → cart
                </button>
              </div>
            </div>
          ) : null}

          {/* Cart */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800">Pick List Cart (running)</h3>
              <span className={`text-xs font-semibold ${remaining <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                Picked {pickedTotal.toLocaleString('en-IN')} / {qtyRequired.toLocaleString('en-IN')} {unit}
                {remaining > 0 ? ` · ${remaining.toLocaleString('en-IN')} ${unit} to go` : ' · target met'}
              </span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left">From</th>
                    <th className="px-3 py-2 text-right">Qty picked</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-sm text-slate-400">
                        Empty · click Pick on packages above to add
                      </td>
                    </tr>
                  ) : (
                    cart.map((c) => (
                      <tr key={c.id}>
                        <td className="px-3 py-2 font-mono text-xs font-semibold text-slate-800">
                          {c.source.packagingNo ?? `Loose @ ${c.source.rack || c.source.zone || 'rack'}`}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                          {c.qty.toLocaleString('en-IN')} {c.source.unit || unit}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeFromCart(c.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Labels */}
          {labelPacks.length > 0 ? (
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-800">
                  Labels ({labelPacks.length}){warehouseCount > 0 ? ` · ${warehouseCount} stay in warehouse` : ''}
                </h3>
                <button
                  type="button"
                  onClick={printLabels}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <Printer className="h-4 w-4" aria-hidden /> Print all {labelPacks.length}
                </button>
              </div>
              <div ref={labelsRef} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {labelPacks.map((lp) => (
                  <div key={lp.code} className="rounded-lg border border-slate-300 p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">📦 {lp.code}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          lp.forTransfer ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {lp.forTransfer ? 'TRANSFER' : 'WAREHOUSE'}
                      </span>
                    </div>
                    <div className="mb-2 flex justify-center">
                      <QRCodeCanvas value={lp.code} size={110} includeMargin />
                    </div>
                    <p className="text-xs text-slate-700">
                      <span className="font-semibold">Item:</span> {item.name}
                    </p>
                    <p className="text-xs text-slate-700">
                      <span className="font-semibold">Qty:</span> {lp.qty.toLocaleString('en-IN')} {lp.source.unit || unit}
                    </p>
                    {lp.source.vendorBatch ? (
                      <p className="text-xs text-slate-700">
                        <span className="font-semibold">Batch:</span> {lp.source.vendorBatch}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          {!assignedPicker.trim() ? (
            <span className="mr-auto text-xs font-medium text-amber-700">Assign a picker (step 1) to continue.</span>
          ) : null}
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onNext(cart.map((c) => ({ pack: c.source, qty: c.qty })))}
            disabled={cart.length === 0 || !assignedPicker.trim()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next · Complete Transfer →
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransferPickSplitModal;
