import React from 'react';
import type { PlannedReleaseWeekSummary } from '../../lib/plannedReleaseTargets';

export function ItemsInvolvedReleaseWeekSummary({
  rows,
  totalQty,
  requestCount,
  pickUnitLabel,
  formatPickQty,
  weekQtyOverrides,
  onWeekQtyChange,
  onResetOverrides,
  hasOverrides,
  qtyInputStep,
}: {
  rows: PlannedReleaseWeekSummary[];
  totalQty: number;
  requestCount: number;
  pickUnitLabel: string;
  formatPickQty: (n: number) => string;
  weekQtyOverrides: Record<string, string>;
  onWeekQtyChange: (weekKey: string, value: string) => void;
  onResetOverrides: () => void;
  hasOverrides: boolean;
  qtyInputStep: number | 'any';
}): React.ReactElement {
  return (
    <div className="mb-4 rounded-xl border-2 border-indigo-300 bg-indigo-50 p-3 sm:p-4 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-indigo-950">Qty releasing by week</h3>
          <p className="text-[11px] text-indigo-900/80 mt-0.5 leading-relaxed">
            Edit qty per week before Add Planned Line. Changes here update the total quantity below.
          </p>
        </div>
        {rows.length > 0 ? (
          <div className="text-right shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700">Total release</p>
            <p className="text-lg font-bold text-indigo-950">
              {formatPickQty(totalQty)} {pickUnitLabel}
            </p>
          </div>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-700 rounded-lg border border-dashed border-indigo-200 bg-white/70 px-3 py-4 text-center">
          Enter release qty on batch lines above or set total quantity in Planned line details to see the week-wise
          breakdown.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[20rem] text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-indigo-200 text-indigo-900">
                  <th className="text-left py-2 pr-3 font-bold">Week</th>
                  <th className="text-left py-2 pr-3 font-bold whitespace-nowrap">Required by</th>
                  <th className="text-right py-2 pr-3 font-bold whitespace-nowrap">
                    Qty ({pickUnitLabel})
                  </th>
                  <th className="text-right py-2 font-bold whitespace-nowrap">PRs</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const overrideRaw = weekQtyOverrides[row.weekKey];
                  // Strip thousands separators: this is a <input type="number">, and a locale
                  // string like "5,000" would render blank / fail to parse.
                  const displayValue =
                    overrideRaw !== undefined ? overrideRaw : formatPickQty(row.qty).replace(/,/g, '');
                  const isEdited =
                    overrideRaw !== undefined &&
                    parseFloat(String(overrideRaw).replace(/,/g, '')) !== row.qty;
                  return (
                    <tr key={row.weekKey} className="border-b border-indigo-100 bg-white/60">
                      <td className="py-2.5 pr-3 font-semibold text-slate-900">{row.weekLabel}</td>
                      <td className="py-2.5 pr-3 text-slate-700 whitespace-nowrap">{row.expectedDate}</td>
                      <td className="py-2.5 pr-3 text-right whitespace-nowrap">
                        <label className="sr-only" htmlFor={`release-week-qty-${row.weekKey}`}>
                          Release qty for {row.weekLabel}
                        </label>
                        <input
                          id={`release-week-qty-${row.weekKey}`}
                          type="number"
                          min={0}
                          step={qtyInputStep}
                          value={displayValue}
                          onChange={(e) => onWeekQtyChange(row.weekKey, e.target.value)}
                          className={`w-full max-w-[7rem] ml-auto rounded-lg border px-2 py-1 text-right text-sm font-bold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                            isEdited ? 'border-amber-400 bg-amber-50' : 'border-indigo-200 bg-white'
                          }`}
                        />
                      </td>
                      <td className="py-2.5 text-right text-slate-600 whitespace-nowrap">1</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-indigo-100/80 text-indigo-950 font-bold">
                  <td className="py-2.5 pr-3" colSpan={2}>
                    Total ({rows.length} week{rows.length === 1 ? '' : 's'})
                  </td>
                  <td className="py-2.5 pr-3 text-right whitespace-nowrap">{formatPickQty(totalQty)}</td>
                  <td className="py-2.5 text-right whitespace-nowrap">{requestCount}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
            <p className="text-[11px] text-indigo-900/75 leading-relaxed flex-1 min-w-[12rem]">
              Same vendor + ISO week merges into one procurement request. Sub-MOQ batch lines in the same week roll up
              together when total qty meets MOQ.
            </p>
            {hasOverrides ? (
              <button
                type="button"
                onClick={onResetOverrides}
                className="shrink-0 px-2.5 py-1 rounded-lg border border-indigo-300 bg-white text-indigo-800 text-[11px] font-semibold hover:bg-indigo-50"
              >
                Reset to batch picks
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
