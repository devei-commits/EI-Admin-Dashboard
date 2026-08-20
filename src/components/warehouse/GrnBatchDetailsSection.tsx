/**
 * "Batch Details" step (step 3): one row per batch received. Row count is fixed by the
 * "No. of batches received" declared in step 2. Each row's "No. of packs" drives step 4
 * (Packaging List), where every pack gets a unique packaging number.
 */

import React, { useRef } from 'react';
import { Paperclip, X } from 'lucide-react';
import {
  addBatchCoaDocs,
  batchCoaDocs,
  removeBatchCoaDoc,
  type GrnBatchRow,
} from '../../lib/inboundGrnBatchesMeta';

const cellInput =
  'w-full rounded-md border border-border px-2 py-1.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:cursor-not-allowed disabled:bg-surface-3';

export interface GrnBatchDetailsSectionProps {
  rows: GrnBatchRow[];
  onChangeRow: (index: number, patch: Partial<GrnBatchRow>) => void;
  disabled?: boolean;
  /** Vendor supplied no batch identity — batch no. / MFG / EXP / COA are not asked for. */
  vendorBatchNotApplicable?: boolean;
  onChangeVendorBatchNotApplicable?: (next: boolean) => void;
}

function toNumOrNull(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * A batch can arrive with more than one COA — per test, per sub-lot, or a reissued revision — so the
 * cell holds a list that can be added to and pruned, rather than a single slot each pick overwrote.
 */
const CoaCell: React.FC<{
  row: GrnBatchRow;
  batchNo: number;
  disabled: boolean;
  onChange: (patch: Partial<GrnBatchRow>) => void;
}> = ({ row, batchNo, disabled, onChange }) => {
  const ref = useRef<HTMLInputElement>(null);
  const docs = batchCoaDocs(row);
  return (
    <div className="flex flex-col gap-1.5 min-w-[190px]">
      <input
        ref={ref}
        type="file"
        multiple
        className="hidden"
        disabled={disabled}
        aria-label={`Batch ${batchNo} COA documents`}
        onChange={(e) => {
          const names = Array.from(e.target.files ?? []).map((f) => f.name);
          if (names.length > 0) onChange(addBatchCoaDocs(row, names, new Date().toISOString()));
          // Reset so re-picking the same file still fires onChange.
          e.target.value = '';
        }}
      />
      {docs.length > 0 && (
        <ul className="flex flex-col gap-1">
          {docs.map((doc, di) => (
            <li
              key={`${doc.fileName}-${di}`}
              className="flex items-center gap-1 rounded border border-border bg-surface-3 px-1.5 py-0.5"
            >
              <Paperclip className="h-3 w-3 shrink-0 text-ink-4" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-xs text-ink-2" title={doc.fileName}>
                {doc.fileName}
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(removeBatchCoaDoc(row, di))}
                title={`Remove ${doc.fileName}`}
                aria-label={`Remove ${doc.fileName} from batch ${batchNo}`}
                className="shrink-0 rounded p-0.5 text-ink-4 hover:bg-err-soft hover:text-err disabled:opacity-50"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => ref.current?.click()}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs font-semibold text-ink-2 hover:bg-surface-2 disabled:opacity-60"
        >
          <Paperclip className="h-3 w-3" aria-hidden /> {docs.length > 0 ? 'Add more' : 'Choose files'}
        </button>
        <span className="text-xs text-ink-4">
          {docs.length === 0 ? 'No file chosen' : `${docs.length} file${docs.length === 1 ? '' : 's'}`}
        </span>
      </div>
    </div>
  );
};

export const GrnBatchDetailsSection: React.FC<GrnBatchDetailsSectionProps> = ({
  rows,
  onChangeRow,
  disabled = false,
  vendorBatchNotApplicable = false,
  onChangeVendorBatchNotApplicable,
}) => {
  // Identity is what the vendor may not provide. Pack counts are ours and still required: Step 4
  // mints a packaging number per pack and QR labels print per pack.
  const identityDisabled = disabled || vendorBatchNotApplicable;
  return (
    <section className="rounded-xl border border-border p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-ink">3 · Batch Details</h3>
        <p className="mt-1 text-xs text-ink-3">
          Enter details for each batch received. No. of packs drives Step 4 (Packaging List) — each pack
          gets a unique packaging number.
        </p>
        {onChangeVendorBatchNotApplicable && (
          <label className="mt-2 flex items-start gap-2 text-xs text-ink-2">
            <input
              type="checkbox"
              checked={vendorBatchNotApplicable}
              disabled={disabled}
              onChange={(e) => onChangeVendorBatchNotApplicable(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="font-semibold">Vendor batch details not applicable</span> — this shipment came
              without a batch number, MFG or EXP date.
              <span className="block text-ink-3">
                Those columns are skipped. No. of packs is still needed: each pack gets its own packaging
                number and QR label.
              </span>
            </span>
          </label>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-ink-3">
          Set "No. of batches received" in the previous step to generate batch rows.
        </p>
      ) : (
        <div className="overflow-auto max-h-[70vh] rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-20 bg-surface-2 text-xs uppercase tracking-wide text-ink-2">
              <tr className="[&_th]:bg-surface-2">
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
                      value={vendorBatchNotApplicable ? '' : (row.vendorBatchNo ?? '')}
                      disabled={identityDisabled}
                      onChange={(e) => onChangeRow(i, { vendorBatchNo: e.target.value || null })}
                      placeholder={vendorBatchNotApplicable ? 'Not applicable' : 'VB-2026-01000'}
                      aria-label={`Batch ${i + 1} vendor batch no.`}
                      className={cellInput}
                    />
                  </td>
                  <td className="px-3 py-2 min-w-[140px]">
                    <input
                      type="date"
                      value={vendorBatchNotApplicable ? '' : (row.mfgDate ?? '')}
                      disabled={identityDisabled}
                      onChange={(e) => onChangeRow(i, { mfgDate: e.target.value || null })}
                      aria-label={`Batch ${i + 1} MFG date`}
                      className={cellInput}
                    />
                  </td>
                  <td className="px-3 py-2 min-w-[140px]">
                    <input
                      type="date"
                      value={vendorBatchNotApplicable ? '' : (row.expDate ?? '')}
                      disabled={identityDisabled}
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
                    {vendorBatchNotApplicable ? (
                      <span className="text-xs text-ink-4">Not applicable</span>
                    ) : (
                      <CoaCell
                        row={row}
                        batchNo={i + 1}
                        disabled={disabled}
                        onChange={(patch) => onChangeRow(i, patch)}
                      />
                    )}
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
