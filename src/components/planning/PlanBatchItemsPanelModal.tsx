import type { ReactElement } from 'react';
import { X } from 'lucide-react';
import type { PlanningBatchAllRow } from '../../services/planningExtracted.service';
import {
  type BatchItemsPanelMaterialFilter,
  type BatchItemsPanelRow,
  formatBatchItemsPanelCount,
  formatBatchItemsPanelQty,
  planBatchStatusClass,
} from '../../lib/planBatchItemsPanelDisplay';

interface BatchReleaseSplit {
  rm: { released: number; remaining: number };
  pm: { released: number; remaining: number };
}

interface PlanBatchItemsPanelModalProps {
  batch: PlanningBatchAllRow;
  rows: BatchItemsPanelRow[];
  materialFilter: BatchItemsPanelMaterialFilter;
  itemsLoading?: boolean;
  releaseSplit: BatchReleaseSplit;
  onClose: () => void;
  onItemCodeClick: (row: BatchItemsPanelRow) => void;
  onSendToProduction?: () => void;
}

function ItemsReleasedSplitBadges({ split }: { split: BatchReleaseSplit }): ReactElement {
  return (
    <span className="inline-flex flex-wrap gap-1">
      <span className="px-1.5 py-0.5 rounded bg-brand-soft text-brand font-semibold">
        RM {split.rm.released}/{split.rm.released + split.rm.remaining}
      </span>
      <span className="px-1.5 py-0.5 rounded bg-warn-soft text-warn font-semibold">
        PM {split.pm.released}/{split.pm.released + split.pm.remaining}
      </span>
    </span>
  );
}

function PipelineCell({ value, unit }: { value: number; unit: string }): ReactElement {
  if (value <= 0) return <span className="text-ink-4">0</span>;
  return <span className="font-mono text-ink">{formatBatchItemsPanelCount(value)}</span>;
}

export function PlanBatchItemsPanelModal({
  batch,
  rows,
  materialFilter,
  itemsLoading = false,
  releaseSplit,
  onClose,
  onItemCodeClick,
  onSendToProduction,
}: PlanBatchItemsPanelModalProps): ReactElement {
  const sizeKg = Number(batch.sizeKg) || 0;
  const allShortfallResolved = rows.length > 0 && rows.every((r) => r.shortfall <= 0);

  return (
    <div className="fixed inset-0 backdrop-blur-md bg-black/30 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div
        className="bg-surface rounded-lg shadow-xl w-full max-w-6xl my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-batch-items-panel-title"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 id="plan-batch-items-panel-title" className="text-lg font-bold text-ink">
            Batch — {batch.batchCode ?? `PE-${batch.planningExtractedId}-B${batch.sequence}`}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-3 hover:text-ink-2"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <p className="px-4 pt-2 text-xs text-ink-2">
          {batch.productName ?? batch.productCode ?? '—'} · SO {batch.soNumber ?? '—'} · Size {sizeKg} kg
        </p>
        {materialFilter !== 'ALL' ? (
          <p className="px-4 pt-1 text-[11px] font-semibold text-brand">
            {materialFilter} items panel — stock and pipeline for this batch.
          </p>
        ) : null}
        <p className="px-4 pt-1 text-[11px] text-ink-3">
          Click an item code → Items Involved, pre-filtered on that item code.
        </p>
        <div className="px-4 pt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-ink-2">Items released</span>
          <ItemsReleasedSplitBadges split={releaseSplit} />
          {releaseSplit.rm.remaining + releaseSplit.pm.remaining > 0 ? (
            <span className="text-ink-3">
              ({releaseSplit.rm.remaining + releaseSplit.pm.remaining} remaining)
            </span>
          ) : null}
        </div>
        <div className="p-4 overflow-x-auto max-h-[70vh]">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="bg-surface-2 border-b border-border text-[11px]">
                <th scope="col" className="px-3 py-2 text-left font-semibold text-ink-2 whitespace-nowrap">Item Code</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold text-ink-2 min-w-[120px]">Item Name</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2 whitespace-nowrap">Req Qty</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">SIH</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2 whitespace-nowrap">
                  Total Required (all batches)
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">Reserved</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">Planned</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">PO Qty</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2 whitespace-nowrap">In Transit</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2 whitespace-nowrap">Under GRN</th>
                <th scope="col" className="px-3 py-2 text-center font-semibold text-ink-2 whitespace-nowrap">Item Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-sm text-ink-3">
                    {itemsLoading
                      ? 'Loading items…'
                      : `No ${materialFilter === 'ALL' ? 'RM/PM' : materialFilter} lines on this batch BOM.`}
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-hairline hover:bg-surface-2/60">
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="font-mono text-[12px] font-semibold text-brand hover:text-brand underline"
                      title="Open Items Involved filtered on this item code"
                      onClick={() => onItemCodeClick(row)}
                    >
                      {row.itemCode || '—'}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-ink">{row.itemName}</td>
                  <td className="px-3 py-2 text-right font-mono text-ink">
                    {formatBatchItemsPanelQty(row.reqQty, row.unit)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-ink-2">
                    {formatBatchItemsPanelCount(row.sih)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-ink-2">
                    {formatBatchItemsPanelCount(row.totalRequired)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-ink-2">
                    {formatBatchItemsPanelCount(row.reserved)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <PipelineCell value={row.plannedQty} unit={row.unit} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <PipelineCell value={row.poQty} unit={row.unit} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <PipelineCell value={row.inTransit} unit={row.unit} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <PipelineCell value={row.underGrn} unit={row.unit} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-[11px] ${planBatchStatusClass(row.status)}`}>{row.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {allShortfallResolved && onSendToProduction ? (
          <div className="px-4 py-3 border-t border-border bg-warn-soft flex items-center justify-between gap-3">
            <span className="text-sm text-warn">
              All materials available. Send this batch to production to allow scheduling in Production → Calendar.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onSendToProduction}
                className="px-4 py-2 bg-ok text-white text-sm font-semibold rounded-lg hover:bg-ok shadow-sm"
              >
                Send To Production
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-sm font-semibold text-ink-2 bg-surface border border-border rounded-lg hover:bg-surface-2"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3 border-t border-border flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm font-semibold text-ink-2 bg-surface-3 rounded-lg hover:bg-surface-3"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
