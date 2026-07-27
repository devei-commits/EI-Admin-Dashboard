/**
 * "Packaging List" step (step 4): one row per pack, numbered PKG-<grnNo>-NNN, expanded
 * from Batch Details. Per-pack quantity is editable; Received Qty and Variance roll up
 * automatically. Each pack is labelled later in Generate Labels.
 */

import React from 'react';
import type { GrnBatchRow } from '../../lib/inboundGrnBatchesMeta';
import type { GrnPackagingRow } from '../../lib/inboundGrnPackagingMeta';

const cellInput =
  'w-24 rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100';

export interface GrnPackagingListSectionProps {
  rows: GrnPackagingRow[];
  batches: GrnBatchRow[];
  onChangeRow: (index: number, patch: Partial<GrnPackagingRow>) => void;
  disabled?: boolean;
  unit?: string;
  poQty: number;
  shippedQty: number | null;
  billedQty: number;
  onBilledQtyChange: (n: number) => void;
}

function fmtQty(n: number, unit?: string): string {
  return `${n.toLocaleString('en-IN')}${unit ? ` ${unit}` : ''}`;
}

export const GrnPackagingListSection: React.FC<GrnPackagingListSectionProps> = ({
  rows,
  batches,
  onChangeRow,
  disabled = false,
  unit,
  poQty,
  shippedQty,
  billedQty,
  onBilledQtyChange,
}) => {
  const received = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const variance = received - poQty;

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-800">4 · Packaging List</h3>
          <p className="mt-1 text-xs text-slate-500">
            One row per pack, expanded from Batch Details. Each pack has a unique packaging number and
            is labelled in the next step. Adjust per-pack quantity if the physical weight differs.
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
            No packs yet — set "No. of packs" per batch in the previous step.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Packaging No.</th>
                  <th className="px-3 py-2 text-left">Batch</th>
                  <th className="px-3 py-2 text-left">Vendor Batch</th>
                  <th className="px-3 py-2 text-left">MFG</th>
                  <th className="px-3 py-2 text-left">EXP</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-left">Label status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, i) => {
                  const batch = batches[row.batchIndex];
                  const labelled = row.labelStatus === 'labelled';
                  return (
                    <tr key={row.packagingNo}>
                      <td className="px-3 py-2 font-mono text-xs font-semibold text-slate-800 whitespace-nowrap">
                        {row.packagingNo}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-700">Batch {row.batchIndex + 1}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-700">{batch?.vendorBatchNo || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-700">{batch?.mfgDate || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-700">{batch?.expDate || '—'}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            value={row.qty ?? ''}
                            disabled={disabled}
                            onChange={(e) =>
                              onChangeRow(i, { qty: e.target.value.trim() === '' ? null : Number(e.target.value) })
                            }
                            className={cellInput}
                          />
                          {unit ? <span className="text-xs text-slate-500">{unit}</span> : null}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                            labelled
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-amber-200 bg-amber-50 text-amber-700'
                          }`}
                        >
                          {labelled ? 'Labelled' : 'Pending label'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quantity roll-up */}
      <div className="rounded-xl border border-slate-200 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">📊 Quantity roll-up (auto-calculated)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="py-2 pr-4 font-medium text-slate-600">PO Qty (from PO)</td>
                <td className="py-2 font-semibold text-slate-900">{fmtQty(poQty, unit)}</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium text-slate-600">Shipped Qty (from vendor challan)</td>
                <td className="py-2 font-semibold text-slate-900">
                  {shippedQty != null ? fmtQty(shippedQty, unit) : '—'}
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium text-slate-600">Billed Qty (enter below)</td>
                <td className="py-2">
                  <div className="inline-flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      value={billedQty || ''}
                      disabled={disabled}
                      onChange={(e) => onBilledQtyChange(Number(e.target.value) || 0)}
                      className={cellInput}
                    />
                    {unit ? <span className="text-xs text-slate-500">{unit}</span> : null}
                  </div>
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium text-slate-600">Received Qty (auto-computed from packaging list)</td>
                <td className="py-2 font-semibold text-slate-900">{fmtQty(received, unit)}</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium text-slate-600">Variance</td>
                <td
                  className={`py-2 font-semibold ${
                    variance === 0 ? 'text-emerald-700' : variance > 0 ? 'text-amber-700' : 'text-rose-700'
                  }`}
                >
                  {variance === 0
                    ? '0 · matches PO'
                    : `${variance > 0 ? '+' : ''}${fmtQty(variance, unit)} ${variance > 0 ? 'overage' : 'shortage'}`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
