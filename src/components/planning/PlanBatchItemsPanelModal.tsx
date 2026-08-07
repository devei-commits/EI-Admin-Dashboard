import type { ReactElement } from 'react';
import { X, Lock, Plus, Minus } from 'lucide-react';
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
  /** Reserve one kind's items (codes=null → all lines of that kind on this batch). */
  onReserveItems?: (kind: 'RM' | 'PM', codes: string[] | null) => void;
  /** Remove manual reservations for the given item codes of one kind. */
  onUnreserveItems?: (kind: 'RM' | 'PM', codes: string[]) => void;
  /** Stock-backed qty already held by THIS batch, keyed by item code (drives button state). */
  reservedForBatchByCode?: Record<string, number>;
  /**
   * Qty this batch has claimed that the facility cannot back yet, keyed by item code. The claim is
   * real — it is allocated automatically (oldest claim first) when the material is received.
   */
  pendingForBatchByCode?: Record<string, number>;
  /** Disables the reserve controls while a request is in flight. */
  reserveBusy?: boolean;
  /** Once sent to production, reservations are managed in the Production module. */
  batchSentToProduction?: boolean;
}

const RESERVE_EPS = 1e-6;

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
  onReserveItems,
  onUnreserveItems,
  reservedForBatchByCode,
  pendingForBatchByCode,
  reserveBusy = false,
  batchSentToProduction = false,
}: PlanBatchItemsPanelModalProps): ReactElement {
  const sizeKg = Number(batch.sizeKg) || 0;
  const allShortfallResolved = rows.length > 0 && rows.every((r) => r.shortfall <= 0);

  // Reserve controls: shown only in the single-kind (RM / PM) popups, per the spec.
  const reserveKind: 'RM' | 'PM' | null =
    materialFilter === 'RM' ? 'RM' : materialFilter === 'PM' ? 'PM' : null;
  const showReserve = Boolean(onReserveItems && reserveKind);
  const reservedFor = (code: string) => Number(reservedForBatchByCode?.[code] ?? 0);
  const pendingFor = (code: string) => Number(pendingForBatchByCode?.[code] ?? 0);
  /** Claimed = held now OR queued against incoming stock — both are releasable. */
  const claimedFor = (code: string) => reservedFor(code) + pendingFor(code);
  const anyReservedOnBatch = rows.some((r) => claimedFor(r.itemCode) > RESERVE_EPS);
  const awaitingCount = rows.filter((r) => pendingFor(r.itemCode) > RESERVE_EPS).length;

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
        {showReserve && reserveKind ? (
          <div className="px-4 pt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-ink-2">Reserve stock for this batch</span>
            <button
              type="button"
              disabled={reserveBusy || rows.length === 0}
              onClick={() => onReserveItems?.(reserveKind, null)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-brand-soft bg-brand-soft text-brand text-xs font-semibold hover:bg-brand hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={13} /> Reserve all {reserveKind}
            </button>
            <button
              type="button"
              disabled={reserveBusy || !anyReservedOnBatch}
              onClick={() => onUnreserveItems?.(reserveKind, rows.filter((r) => reservedFor(r.itemCode) > RESERVE_EPS).map((r) => r.itemCode))}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-border bg-surface text-ink-2 text-xs font-semibold hover:bg-surface-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Minus size={13} /> Un-reserve all {reserveKind}
            </button>
            {awaitingCount > 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-warn-soft text-warn text-[11px] font-semibold">
                {awaitingCount} awaiting stock — allocated automatically on receipt
              </span>
            ) : null}
            {batchSentToProduction ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-ink-3">
                <Lock size={12} /> Sent to production — reserving acts on its production batch
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="p-4 overflow-x-auto max-h-[70vh]">
          <table className="w-full text-sm min-w-[1100px]">
            <thead className="sticky top-0 z-20 [&_th]:bg-surface-2">
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
                {showReserve ? (
                  <th scope="col" className="px-3 py-2 text-center font-semibold text-ink-2 whitespace-nowrap">Reserve</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={showReserve ? 12 : 11} className="px-4 py-8 text-center text-sm text-ink-3">
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
                  {showReserve ? (
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      {(() => {
                        const reserved = reservedFor(row.itemCode);
                        const pending = pendingFor(row.itemCode);
                        if (reserved + pending > RESERVE_EPS) {
                          // Partly or wholly awaiting arrival → amber "Awaiting" instead of green.
                          const waiting = pending > RESERVE_EPS;
                          const title = waiting
                            ? `Claimed for this batch: ${formatBatchItemsPanelCount(reserved)} held, `
                              + `${formatBatchItemsPanelCount(pending)} awaiting stock (allocated automatically `
                              + 'when the material is received) — click to release'
                            : `Reserved ${formatBatchItemsPanelCount(reserved)} for this batch — click to release`;
                          return (
                            <button
                              type="button"
                              disabled={reserveBusy}
                              onClick={() => onUnreserveItems?.(row.itemType, [row.itemCode])}
                              title={title}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-semibold hover:bg-surface-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                waiting
                                  ? 'border-warn-soft bg-warn-soft text-warn'
                                  : 'border-[color:var(--st-green-fg)]/30 bg-ok-soft text-ok'
                              }`}
                            >
                              <Minus size={12} /> {waiting ? 'Awaiting stock' : 'Reserved'}
                            </button>
                          );
                        }
                        return (
                          <button
                            type="button"
                            disabled={reserveBusy}
                            onClick={() => onReserveItems?.(row.itemType, [row.itemCode])}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-brand-soft bg-surface text-brand text-[11px] font-semibold hover:bg-brand-soft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Plus size={12} /> Reserve
                          </button>
                        );
                      })()}
                    </td>
                  ) : null}
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
