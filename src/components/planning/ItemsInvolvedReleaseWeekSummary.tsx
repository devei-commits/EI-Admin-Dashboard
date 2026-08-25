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
  onPickWeek,
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
  /**
   * Fill this week's qty from its own requirement, like Pick on a batch line. Other weeks are
   * untouched — zeroing them discarded their quantities and removed their rows from the summary.
   */
  onPickWeek?: (weekKey: string) => void;
}): React.ReactElement {
  return (
    <div className="mb-4 rounded-xl border-2 border-brand-soft bg-brand-soft p-3 sm:p-4 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-brand">Qty releasing by week</h3>
          <p className="text-[11px] text-brand/80 mt-0.5 leading-relaxed">
            Edit qty per week before Add Planned Line. Changes here update the total quantity below.
          </p>
        </div>
        {rows.length > 0 ? (
          <div className="text-right shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-brand">Total release</p>
            <p className="text-lg font-bold text-brand">
              {formatPickQty(totalQty)} {pickUnitLabel}
            </p>
          </div>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-2 rounded-lg border border-dashed border-brand-soft bg-surface/70 px-3 py-4 text-center">
          Enter release qty on batch lines above or set total quantity in Planned line details to see the week-wise
          breakdown.
        </p>
      ) : (
        <>
          <div className="overflow-auto max-h-[70vh] -mx-1 px-1">
            <table className="w-full min-w-[20rem] text-sm border-collapse">
              <thead className="sticky top-0 z-20 [&_th]:bg-surface-2">
                <tr className="border-b-2 border-brand-soft text-brand">
                  <th scope="col" className="text-left py-2 pr-3 font-bold">Week</th>
                  <th scope="col" className="text-left py-2 pr-3 font-bold whitespace-nowrap">Required by</th>
                  <th scope="col" className="text-right py-2 pr-3 font-bold whitespace-nowrap">
                    Qty ({pickUnitLabel})
                  </th>
                  <th scope="col" className="text-right py-2 pr-3 font-bold whitespace-nowrap">PRs</th>
                  {onPickWeek ? <th scope="col" className="text-right py-2 font-bold whitespace-nowrap" /> : null}
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
                    <tr key={row.weekKey} className="border-b border-brand-soft bg-surface/60">
                      <td className="py-2.5 pr-3 font-semibold text-ink">{row.weekLabel}</td>
                      <td className="py-2.5 pr-3 text-ink-2 whitespace-nowrap">{row.expectedDate}</td>
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
                          className={`w-full max-w-[7rem] ml-auto rounded-lg border px-2 py-1 text-right text-sm font-bold text-brand focus:outline-none focus:ring-2 focus:ring-brand ${
                            isEdited ? 'border-warn-soft bg-warn-soft' : 'border-brand-soft bg-surface'
                          }`}
                        />
                      </td>
                      <td className="py-2.5 pr-3 text-right text-ink-2 whitespace-nowrap">1</td>
                      {onPickWeek ? (
                        <td className="py-2.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onPickWeek(row.weekKey)}
                            title={`Fill ${row.weekLabel} release qty from its requirement (required by ${row.expectedDate})`}
                            className="px-2 py-1 rounded-lg border border-brand-soft bg-surface text-brand text-[11px] font-semibold hover:bg-brand-soft"
                          >
                            Pick
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-brand-soft/80 text-brand font-bold">
                  <td className="py-2.5 pr-3" colSpan={2}>
                    Total ({rows.length} week{rows.length === 1 ? '' : 's'})
                  </td>
                  <td className="py-2.5 pr-3 text-right whitespace-nowrap">{formatPickQty(totalQty)}</td>
                  <td className="py-2.5 pr-3 text-right whitespace-nowrap">{requestCount}</td>
                  {onPickWeek ? <td /> : null}
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
            <p className="text-[11px] text-brand/75 leading-relaxed flex-1 min-w-[12rem]">
              Same vendor + ISO week merges into one procurement request. Sub-MOQ batch lines in the same week roll up
              together when total qty meets MOQ.
            </p>
            {hasOverrides ? (
              <button
                type="button"
                onClick={onResetOverrides}
                className="shrink-0 px-2.5 py-1 rounded-lg border border-brand-soft bg-surface text-brand text-[11px] font-semibold hover:bg-brand-soft"
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
