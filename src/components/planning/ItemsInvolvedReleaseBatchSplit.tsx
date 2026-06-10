import React from 'react';
import type { PlanningBatchAllRow } from '../../services/planningExtracted.service';

export type ReleaseBatchSplitRow = {
  key: string;
  batch: PlanningBatchAllRow;
  requiredKg: number;
  /** Qty in the same unit as the release form (procurement unit for RM, pcs for PM). */
  requiredPick: number;
};

export function ItemsInvolvedReleaseBatchSplit({
  rows,
  picks,
  pickUnitLabel,
  requiredUnitLabel,
  formatRequired,
  formatPick,
  onPickChange,
  onFillAllRequired,
  onFillMoq,
  onClearPicks,
  moqMin,
}: {
  rows: ReleaseBatchSplitRow[];
  picks: Record<string, string>;
  pickUnitLabel: string;
  requiredUnitLabel: string;
  /** Vendor MOQ — release may exceed per-batch required to meet this. */
  moqMin?: number;
  formatRequired: (kg: number) => string;
  formatPick: (n: number) => string;
  onPickChange: (key: string, value: string) => void;
  onFillAllRequired: () => void;
  onFillMoq?: () => void;
  onClearPicks: () => void;
}): React.ReactElement | null {
  if (rows.length === 0) return null;

  const pickSum = rows.reduce((sum, row) => {
    const v = parseFloat(String(picks[row.key] ?? '').replace(/,/g, ''));
    return sum + (Number.isFinite(v) && v > 0 ? v : 0);
  }, 0);
  const requiredSumKg = rows.reduce((sum, row) => sum + row.requiredKg, 0);

  return (
    <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Batch-wise split</h3>
          <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
            BOM requirement is split across batches for reference. Release qty per batch may exceed required (e.g.
            vendor MOQ){moqMin != null && moqMin > 0 ? ` — MOQ ${formatPick(moqMin)}` : ''}. The sum updates the
            quantity field below; or set total qty there directly.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={onFillAllRequired}
            className="px-2.5 py-1 rounded-lg border border-indigo-300 bg-white text-indigo-800 text-[11px] font-semibold hover:bg-indigo-50"
          >
            Fill all required
          </button>
          {onFillMoq != null ? (
            <button
              type="button"
              onClick={onFillMoq}
              className="px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-[11px] font-semibold hover:bg-amber-100"
            >
              Set qty = MOQ
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClearPicks}
            className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 text-[11px] font-semibold hover:bg-slate-50"
          >
            Clear picks
          </button>
        </div>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full min-w-[36rem] text-xs border-collapse">
          <thead>
            <tr className="border-b border-indigo-200 text-slate-600">
              <th className="text-left py-2 pr-2 font-semibold">Batch</th>
              <th className="text-left py-2 pr-2 font-semibold">SO</th>
              <th className="text-left py-2 pr-2 font-semibold">Product</th>
              <th className="text-right py-2 pr-2 font-semibold whitespace-nowrap">
                Required ({requiredUnitLabel})
              </th>
              <th className="text-right py-2 pr-2 font-semibold whitespace-nowrap min-w-[7rem]">
                Release qty ({pickUnitLabel})
              </th>
              <th className="w-14 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const b = row.batch;
              const batchLabel =
                b.batchCode?.trim() ||
                `PE-${b.planningExtractedId}-B${b.sequence ?? idx + 1}`;
              return (
                <tr key={row.key} className="border-b border-indigo-100/80">
                  <td className="py-2 pr-2 font-mono font-medium text-slate-900 align-top">{batchLabel}</td>
                  <td className="py-2 pr-2 text-slate-700 align-top">{b.soNumber ?? '—'}</td>
                  <td className="py-2 pr-2 text-slate-700 align-top max-w-[10rem] break-words">
                    {b.productName ?? b.productCode ?? '—'}
                  </td>
                  <td className="py-2 pr-2 text-right font-semibold text-slate-900 align-top whitespace-nowrap">
                    {formatRequired(row.requiredKg)}
                  </td>
                  <td className="py-2 pr-2 align-top" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={picks[row.key] ?? ''}
                      onChange={(e) => onPickChange(row.key, e.target.value)}
                      className="w-full min-w-[5rem] rounded border border-slate-300 px-2 py-1 text-right text-sm"
                      aria-label={`Release qty for ${batchLabel}`}
                    />
                  </td>
                  <td className="py-2 align-top">
                    <button
                      type="button"
                      onClick={() =>
                        onPickChange(
                          row.key,
                          row.requiredPick > 0 ? String(row.requiredPick) : ''
                        )
                      }
                      className="px-2 py-1 rounded border border-indigo-300 text-indigo-800 text-[10px] font-semibold hover:bg-indigo-50 whitespace-nowrap"
                      title="Copy required qty into release field"
                    >
                      Use
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="text-slate-800 font-semibold">
              <td colSpan={3} className="py-2 pr-2 text-right text-[11px] uppercase tracking-wide text-slate-500">
                Totals
              </td>
              <td className="py-2 pr-2 text-right whitespace-nowrap">{formatRequired(requiredSumKg)}</td>
              <td className="py-2 pr-2 text-right whitespace-nowrap text-indigo-900">
                {formatPick(pickSum)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
