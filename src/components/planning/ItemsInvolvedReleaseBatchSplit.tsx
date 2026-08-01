import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { PlanningBatchAllRow } from '../../services/planningExtracted.service';
import type { ReleaseBatchSiblingItemRow } from '../../lib/releaseBatchSiblingItems';
import { formatQtyExact } from '../../utils/formatQty';
import { itemsInvolvedUsesDecimalQty } from '../../lib/rmUnitConversion';

export type ReleaseBatchSplitRow = {
  key: string;
  batch: PlanningBatchAllRow;
  requiredKg: number;
  /** Qty in the same unit as the release form (procurement unit for RM, pcs for PM). */
  requiredPick: number;
};

function formatSiblingQty(value: number, itemType: 'RM' | 'PM', unit?: string): string {
  if (!(value > 0)) return '—';
  const kind = itemsInvolvedUsesDecimalQty(itemType, unit) ? 'kg' : 'pcs';
  return formatQtyExact(value, kind);
}

function formatPlannedDates(dates: string[]): string {
  if (dates.length === 0) return '—';
  return dates
    .map((d) => {
      const parsed = Date.parse(`${d}T00:00:00`);
      if (!Number.isFinite(parsed)) return d;
      return new Date(parsed).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    })
    .join(', ');
}

function ReleaseBatchSiblingItemsTable({
  rows,
  formatRequired,
}: {
  rows: ReleaseBatchSiblingItemRow[];
  formatRequired: (kg: number) => string;
}): React.ReactElement {
  if (rows.length === 0) {
    return (
      <p className="text-[11px] text-ink-3 py-2 px-1">No other items on Items Involved for this batch.</p>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-brand-soft/80 bg-surface overflow-x-auto">
      <table className="w-full min-w-[52rem] text-[11px] border-collapse">
        <thead>
          <tr className="border-b border-brand-soft text-ink-2 bg-brand-soft/60">
            <th scope="col" className="text-left py-1.5 px-2 font-semibold">Code</th>
            <th scope="col" className="text-left py-1.5 px-2 font-semibold min-w-[10rem]">Item / Vendor</th>
            <th scope="col" className="text-right py-1.5 px-2 font-semibold whitespace-nowrap">Req (this batch)</th>
            <th scope="col" className="text-right py-1.5 px-2 font-semibold whitespace-nowrap">Consolidated Req</th>
            <th scope="col" className="text-right py-1.5 px-2 font-semibold">SIH</th>
            <th scope="col" className="text-right py-1.5 px-2 font-semibold">Reserved</th>
            <th scope="col" className="text-right py-1.5 px-2 font-semibold whitespace-nowrap">Planned Qty</th>
            <th scope="col" className="text-right py-1.5 px-2 font-semibold whitespace-nowrap">Under PO</th>
            <th scope="col" className="text-right py-1.5 px-2 font-semibold">Lead</th>
            <th scope="col" className="text-left py-1.5 px-2 font-semibold whitespace-nowrap min-w-[7rem]">Planned by</th>
            <th scope="col" className="text-right py-1.5 px-2 font-semibold">Coverage</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.itemKey}
              className={`border-b border-brand-soft/80 ${row.isCurrentItem ? 'bg-warn-soft/70' : ''}`}
            >
              <td className="py-1.5 px-2 font-mono text-ink align-top">
                {row.code}
                {row.isCurrentItem ? (
                  <span className="ml-1 text-[10px] font-bold text-warn" title="Item you are releasing">
                    📍 THIS
                  </span>
                ) : null}
              </td>
              <td className="py-1.5 px-2 align-top">
                <div className="font-medium text-ink">{row.name}</div>
                {row.sublabel ? (
                  <div className="text-[10px] text-ink-3 mt-0.5 leading-snug">{row.sublabel}</div>
                ) : null}
              </td>
              <td className="py-1.5 px-2 text-right align-top tabular-nums">
                <div className="font-semibold text-ink">
                  {row.itemType === 'RM'
                    ? formatRequired(row.reqThisBatch)
                    : formatSiblingQty(row.reqThisBatch, row.itemType, row.unit)}
                </div>
                <div className="text-[10px] text-ink-3">this batch</div>
              </td>
              <td className="py-1.5 px-2 text-right align-top tabular-nums">
                <div className="font-semibold text-ink">
                  {row.itemType === 'RM'
                    ? formatRequired(row.consolidatedReq)
                    : formatSiblingQty(row.consolidatedReq, row.itemType, row.unit)}
                </div>
                {row.batchCount > 0 ? (
                  <div className="text-[10px] text-ink-3">
                    {row.batchCount} batch{row.batchCount === 1 ? '' : 'es'}
                  </div>
                ) : null}
              </td>
              <td className="py-1.5 px-2 text-right align-top tabular-nums text-ink">
                {formatSiblingQty(row.sihNum, row.itemType, row.unit)}
              </td>
              <td className="py-1.5 px-2 text-right align-top tabular-nums text-ink-2">
                {formatSiblingQty(row.reservedNum, row.itemType, row.unit)}
              </td>
              <td className="py-1.5 px-2 text-right align-top tabular-nums">
                <div className="font-semibold text-brand">
                  {formatSiblingQty(row.plannedQtyBatch, row.itemType, row.unit)}
                </div>
                <div className="text-[10px] text-ink-3">
                  {row.plannedReqCount} req
                </div>
              </td>
              <td className="py-1.5 px-2 text-right align-top tabular-nums text-ink">
                {formatSiblingQty(row.poQtyNum, row.itemType, row.unit)}
              </td>
              <td className="py-1.5 px-2 text-right align-top tabular-nums text-ink-2">
                {row.leadDays != null && row.leadDays > 0 ? `${row.leadDays}d` : '—'}
              </td>
              <td className="py-1.5 px-2 align-top text-[10px] text-ink-2 leading-snug">
                {formatPlannedDates(row.plannedDates)}
              </td>
              <td className="py-1.5 px-2 text-right align-top tabular-nums">
                {row.coverageOk ? (
                  <span className="font-semibold text-ok" title="Supply meets consolidated requirement">
                    ✓ {formatSiblingQty(row.supplyTowardGrossNum, row.itemType, row.unit)}
                  </span>
                ) : (
                  <span className="font-semibold text-err" title="Short vs consolidated requirement">
                    {formatSiblingQty(row.supplyTowardGrossNum, row.itemType, row.unit)}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ItemsInvolvedReleaseBatchSplit({
  rows,
  picks,
  expectedDates,
  pickUnitLabel,
  requiredUnitLabel,
  formatRequired,
  formatPick,
  onPickChange,
  onExpectedDateChange,
  onFillAllRequired,
  onFillMoq,
  onClearPicks,
  onPickBatch,
  moqMin,
  siblingItemsByBatchKey = {},
}: {
  rows: ReleaseBatchSplitRow[];
  picks: Record<string, string>;
  /** Per-batch required-by date (YYYY-MM-DD) sent to Procurement on each PR line. */
  expectedDates: Record<string, string>;
  pickUnitLabel: string;
  requiredUnitLabel: string;
  /** Vendor MOQ — release may exceed per-batch required to meet this. */
  moqMin?: number;
  formatRequired: (kg: number) => string;
  formatPick: (n: number) => string;
  onPickChange: (key: string, value: string) => void;
  onExpectedDateChange: (key: string, value: string) => void;
  onFillAllRequired: () => void;
  onFillMoq?: () => void;
  onClearPicks: () => void;
  /** Pick a single batch: fills the Planned line below with only this batch's qty + expected date. */
  onPickBatch: (key: string, requiredPick: number) => void;
  /** Other Items Involved rows per batch key — shown when a batch row is expanded. */
  siblingItemsByBatchKey?: Record<string, ReleaseBatchSiblingItemRow[]>;
}): React.ReactElement | null {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());

  if (rows.length === 0) return null;

  const toggleExpanded = (key: string): void => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const pickSum = rows.reduce((sum, row) => {
    const v = parseFloat(String(picks[row.key] ?? '').replace(/,/g, ''));
    return sum + (Number.isFinite(v) && v > 0 ? v : 0);
  }, 0);
  const requiredSumKg = rows.reduce((sum, row) => sum + row.requiredKg, 0);

  return (
    <div className="mb-4 rounded-xl border border-brand-soft bg-brand-soft/40 p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-ink">Batch-wise split</h3>
          <p className="text-[11px] text-ink-2 mt-0.5 leading-relaxed">
            BOM requirement is split across batches for reference. Set release qty and expected date per batch;
            each line becomes a separate procurement request with vendor and required-by date.
            Expand a batch to see all other planned items on that batch with SIH, planned qty, and required-by dates.
            {moqMin != null && moqMin > 0 ? ` MOQ ${formatPick(moqMin)}.` : ''} The sum updates the quantity field
            below; or set total qty there directly.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={onFillAllRequired}
            className="px-2.5 py-1 rounded-lg border border-brand-soft bg-surface text-brand text-[11px] font-semibold hover:bg-brand-soft"
          >
            Fill all required
          </button>
          {onFillMoq != null ? (
            <button
              type="button"
              onClick={onFillMoq}
              className="px-2.5 py-1 rounded-lg border border-warn-soft bg-warn-soft text-warn text-[11px] font-semibold hover:bg-warn-soft"
            >
              Set qty = MOQ
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClearPicks}
            className="px-2.5 py-1 rounded-lg border border-border bg-surface text-ink-2 text-[11px] font-semibold hover:bg-surface-2"
          >
            Clear picks
          </button>
        </div>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full min-w-[36rem] text-xs border-collapse">
          <thead>
            <tr className="border-b border-brand-soft text-ink-2">
              <th scope="col" className="w-8 py-2 pr-1" aria-label="Expand batch items" />
              <th scope="col" className="text-left py-2 pr-2 font-semibold">Batch</th>
              <th scope="col" className="text-left py-2 pr-2 font-semibold">SO</th>
              <th scope="col" className="text-left py-2 pr-2 font-semibold">Product</th>
              <th scope="col" className="text-right py-2 pr-2 font-semibold whitespace-nowrap">
                Required ({requiredUnitLabel})
              </th>
              <th scope="col" className="text-right py-2 pr-2 font-semibold whitespace-nowrap min-w-[7rem]">
                Release qty ({pickUnitLabel})
              </th>
              <th scope="col" className="text-left py-2 pr-2 font-semibold whitespace-nowrap min-w-[9rem]">
                Expected date
              </th>
              <th scope="col" className="w-14 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const b = row.batch;
              const batchLabel =
                b.batchCode?.trim() ||
                `PE-${b.planningExtractedId}-B${b.sequence ?? idx + 1}`;
              const isExpanded = expandedKeys.has(row.key);
              const siblings = siblingItemsByBatchKey[row.key] ?? [];
              const hasSiblings = siblings.length > 0;

              return (
                <React.Fragment key={row.key}>
                  <tr className="border-b border-brand-soft/80">
                    <td className="py-2 pr-1 align-top">
                      {hasSiblings ? (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(row.key)}
                          className="p-1 rounded hover:bg-brand-soft text-brand"
                          aria-expanded={isExpanded}
                          aria-label={
                            isExpanded
                              ? `Collapse items for ${batchLabel}`
                              : `Expand items for ${batchLabel}`
                          }
                          title={isExpanded ? 'Hide batch items' : 'Show all items on this batch'}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" aria-hidden />
                          ) : (
                            <ChevronRight className="w-4 h-4" aria-hidden />
                          )}
                        </button>
                      ) : null}
                    </td>
                    <td className="py-2 pr-2 font-mono font-medium text-ink align-top">{batchLabel}</td>
                    <td className="py-2 pr-2 text-ink-2 align-top">{b.soNumber ?? '—'}</td>
                    <td className="py-2 pr-2 text-ink-2 align-top max-w-[10rem] break-words">
                      {b.productName ?? b.productCode ?? '—'}
                    </td>
                    <td className="py-2 pr-2 text-right font-semibold text-ink align-top whitespace-nowrap">
                      {formatRequired(row.requiredKg)}
                    </td>
                    <td className="py-2 pr-2 align-top" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={String(picks[row.key] ?? '').replace(/,/g, '')}
                        onChange={(e) => onPickChange(row.key, e.target.value)}
                        className="w-full min-w-[5rem] rounded border border-border px-2 py-1 text-right text-sm"
                        aria-label={`Release qty for ${batchLabel}`}
                      />
                    </td>
                    <td className="py-2 pr-2 align-top" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="date"
                        value={expectedDates[row.key] ?? ''}
                        onChange={(e) => onExpectedDateChange(row.key, e.target.value)}
                        className="w-full min-w-[9rem] rounded border border-border px-2 py-1 text-sm"
                        aria-label={`Expected date for ${batchLabel}`}
                      />
                    </td>
                    <td className="py-2 align-top">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onPickBatch(row.key, row.requiredPick)}
                          className="px-2 py-1 rounded border border-brand-soft bg-brand text-white text-[10px] font-semibold hover:bg-brand whitespace-nowrap"
                          title="Pick this batch into the Planned line below (its qty + expected date)"
                        >
                          Pick
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onPickChange(
                              row.key,
                              row.requiredPick > 0 ? String(row.requiredPick) : ''
                            )
                          }
                          className="px-2 py-1 rounded border border-brand-soft text-brand text-[10px] font-semibold hover:bg-brand-soft whitespace-nowrap"
                          title="Add this batch's required qty to the picks above (keeps other picks)"
                        >
                          + Add
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && hasSiblings ? (
                    <tr className="border-b border-brand-soft/80 bg-brand-soft/30">
                      <td colSpan={8} className="py-2 px-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-brand mb-1">
                          All items on {batchLabel}
                        </p>
                        <ReleaseBatchSiblingItemsTable
                          rows={siblings}
                          formatRequired={formatRequired}
                        />
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="text-ink font-semibold">
              <td colSpan={4} className="py-2 pr-2 text-right text-[11px] uppercase tracking-wide text-ink-3">
                Totals
              </td>
              <td className="py-2 pr-2 text-right whitespace-nowrap">{formatRequired(requiredSumKg)}</td>
              <td className="py-2 pr-2 text-right whitespace-nowrap text-brand">
                {formatPick(pickSum)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
