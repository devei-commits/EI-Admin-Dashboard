/**
 * "Batch Details" step (step 3): one row per batch received. Row count is fixed by the
 * "No. of batches received" declared in step 2. Each row's "No. of packs" drives step 4
 * (Packaging List), where every pack gets a unique packaging number.
 */

import React, { useRef } from 'react';
import { Paperclip } from 'lucide-react';
import type { GrnBatchRow } from '../../lib/inboundGrnBatchesMeta';

const cellInput =
  'w-full rounded-md border border-border px-2 py-1.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:cursor-not-allowed disabled:bg-surface-3';

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
        className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs font-semibold text-ink-2 hover:bg-surface-2 disabled:opacity-60"
      >
        <Paperclip className="h-3 w-3" aria-hidden /> Choose file
      </button>
      {row.coaFileName ? (
        <span className="max-w-[120px] truncate text-xs text-ink-2" title={row.coaFileName}>
          {row.coaFileName}
        </span>
      ) : (
        <span className="text-xs text-ink-4">No file chosen</span>
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
    <section className="rounded-xl border border-border p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-ink">3 · Batch Details</h3>
        <p className="mt-1 text-xs text-ink-3">
          Enter details for each batch received. No. of packs drives Step 4 (Packaging List) — each pack
          gets a unique packaging number.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-ink-3">
          Set "No. of batches received" in the previous step to generate batch rows.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wide text-ink-2">
              <tr>
                <th scope="col" className="px-3 py-2 text-left">#</th>
                <th scope="col" className="px-3 py-2 text-left">Vendor Batch No.</th>
                <th scope="col" className="px-3 py-2 text-left">MFG Date</th>
                <th scope="col" className="px-3 py-2 text-left">EXP Date</th>
                <th scope="col" className="px-3 py-2 text-right">No. of Packs</th>
                <th scope="col" className="px-3 py-2 text-right">Qty per pack (approx)</th>
                <th scope="col" className="px-3 py-2 text-left">Batch COA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.map((row, i) => (
                <tr key={i} className="align-top">
                  <td className="px-3 py-2 font-medium text-ink-2 whitespace-nowrap">Batch {i + 1}</td>
                  <td className="px-3 py-2 min-w-[150px]">
                    <input
                      type="text"
                      value={row.vendorBatchNo ?? ''}
                      disabled={disabled}
                      onChange={(e) => onChangeRow(i, { vendorBatchNo: e.target.value || null })}
                      placeholder="VB-2026-01000"
                      aria-label={`Batch ${i + 1} vendor batch no.`}
                      className={cellInput}
                    />
                  </td>
                  <td className="px-3 py-2 min-w-[140px]">
                    <input
                      type="date"
                      value={row.mfgDate ?? ''}
                      disabled={disabled}
                      onChange={(e) => onChangeRow(i, { mfgDate: e.target.value || null })}
                      aria-label={`Batch ${i + 1} MFG date`}
                      className={cellInput}
                    />
                  </td>
                  <td className="px-3 py-2 min-w-[140px]">
                    <input
                      type="date"
                      value={row.expDate ?? ''}
                      disabled={disabled}
                      onChange={(e) => onChangeRow(i, { expDate: e.target.value || null })}
                      aria-label={`Batch ${i + 1} EXP date`}
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
                      aria-label={`Batch ${i + 1} no. of packs`}
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
                      aria-label={`Batch ${i + 1} qty per pack`}
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
