/**
 * "Batch Details" step (step 3): one row per batch received. Row count is fixed by the
 * "No. of batches received" declared in step 2. Each row's "No. of packs" drives step 4
 * (Packaging List), where every pack gets a unique packaging number.
 */

import React, { useRef } from 'react';
import { Paperclip } from 'lucide-react';
import type { GrnBatchRow } from '../../lib/inboundGrnBatchesMeta';

const cellInput =
  'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100';

export interface GrnBatchDetailsSectionProps {
  rows: GrnBatchRow[];
  onChangeRow: (index: number, patch: Partial<GrnBatchRow>) => void;
  disabled?: boolean;
}

function toNumOrNull(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const CoaCell: React.FC<{
  row: GrnBatchRow;
  disabled: boolean;
  onPick: (name: string | null) => void;
}> = ({ row, disabled, onPick }) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-2">
      <input
        ref={ref}
        type="file"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          onPick(e.target.files?.[0]?.name ?? null);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        <Paperclip className="h-3 w-3" aria-hidden /> Choose file
      </button>
      {row.coaFileName ? (
        <span className="max-w-[120px] truncate text-xs text-slate-600" title={row.coaFileName}>
          {row.coaFileName}
        </span>
      ) : (
        <span className="text-xs text-slate-400">No file chosen</span>
      )}
    </div>
  );
};

export const GrnBatchDetailsSection: React.FC<GrnBatchDetailsSectionProps> = ({
  rows,
  onChangeRow,
  disabled = false,
}) => {
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-800">3 · Batch Details</h3>
        <p className="mt-1 text-xs text-slate-500">
          Enter details for each batch received. No. of packs drives Step 4 (Packaging List) — each pack
          gets a unique packaging number.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
          Set "No. of batches received" in the previous step to generate batch rows.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Vendor Batch No.</th>
                <th className="px-3 py-2 text-left">MFG Date</th>
                <th className="px-3 py-2 text-left">EXP Date</th>
                <th className="px-3 py-2 text-right">No. of Packs</th>
                <th className="px-3 py-2 text-right">Qty per pack (approx)</th>
                <th className="px-3 py-2 text-left">Batch COA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, i) => (
                <tr key={i} className="align-top">
                  <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">Batch {i + 1}</td>
                  <td className="px-3 py-2 min-w-[150px]">
                    <input
                      type="text"
                      value={row.vendorBatchNo ?? ''}
                      disabled={disabled}
                      onChange={(e) => onChangeRow(i, { vendorBatchNo: e.target.value || null })}
                      placeholder="VB-2026-01000"
                      className={cellInput}
                    />
                  </td>
                  <td className="px-3 py-2 min-w-[140px]">
                    <input
                      type="date"
                      value={row.mfgDate ?? ''}
                      disabled={disabled}
                      onChange={(e) => onChangeRow(i, { mfgDate: e.target.value || null })}
                      className={cellInput}
                    />
                  </td>
                  <td className="px-3 py-2 min-w-[140px]">
                    <input
                      type="date"
                      value={row.expDate ?? ''}
                      disabled={disabled}
                      onChange={(e) => onChangeRow(i, { expDate: e.target.value || null })}
                      className={cellInput}
                    />
                  </td>
                  <td className="px-3 py-2 min-w-[90px]">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={row.noOfPacks ?? ''}
                      disabled={disabled}
                      onChange={(e) => onChangeRow(i, { noOfPacks: toNumOrNull(e.target.value) })}
                      className={`${cellInput} text-right`}
                    />
                  </td>
                  <td className="px-3 py-2 min-w-[110px]">
                    <input
                      type="number"
                      min={0}
                      value={row.qtyPerPack ?? ''}
                      disabled={disabled}
                      onChange={(e) => onChangeRow(i, { qtyPerPack: toNumOrNull(e.target.value) })}
                      className={`${cellInput} text-right`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <CoaCell row={row} disabled={disabled} onPick={(name) => onChangeRow(i, { coaFileName: name })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
