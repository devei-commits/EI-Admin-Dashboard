/**
 * FastForwardModal Component
 * One-click-ish catch-up for an SO the facility already completed outside the tool. Unlike
 * Pick/Invoice/Ship (which follow batches that already exist), this asks the user how much of
 * each BATCH is actually done — that's the qty marked FG Ready → Picked and invoiced immediately.
 * One row per batch with remaining production capacity, so the user picks which real batch the qty
 * belongs to instead of the backend guessing. The facility can run more batches than the SO
 * originally asked for, so a batch's own remaining (planned − done) is the only cap — NOT the SO's
 * ordered qty; more can genuinely get shipped/invoiced than was originally ordered.
 */
import React, { useEffect, useState } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import { UnifiedModal as Modal, UnifiedInput as Input, UnifiedButton as Button } from '../ui/UnifiedComponents';
import type { SaleOrder, OrderItem, BatchSplit } from '../../types/orderFulfillment';
import { formatNumber } from '../../utils/orderFulfillmentUtils';

const TERMINAL_FF_STATUSES = ['invoiced', 'shipped', 'delivered', 'closed'];

export interface FastForwardLineInput {
  itemId: number;
  qty: number;
  /** Which batch split to apply the qty to. Omitted only for a line with no batch yet. */
  splitId?: number;
}

export interface FastForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleOrder: SaleOrder | null;
  /** May return a Promise; modal waits for it before closing, and stays open on failure. */
  onConfirm: (lines: FastForwardLineInput[]) => void | Promise<void>;
}

type FastForwardRow = {
  key: string;
  item: OrderItem;
  split: BatchSplit | null;
  splitLabel: string;
  planned: number;
  /** This batch's own remaining production/invoice qty — the only cap on this row's input. */
  remaining: number;
};

function splitLabelFor(split: BatchSplit, index: number): string {
  if (split.bmrNo) return split.bmrNo;
  if (split.bprNo) return split.bprNo;
  return split.productionBatchId != null ? `Batch #${split.productionBatchId}` : `Batch ${index + 1}`;
}

/**
 * How much of this batch is still un-produced/un-invoiced. A split tied to a real production batch
 * keeps a numeric ceiling (planned − done) even after it's already been invoiced once for a partial
 * qty — e.g. 204 of a 258-unit batch invoiced still leaves 54 fast-forwardable on that SAME batch.
 * An unlinked (no real batch) split has no ceiling of its own while still open, and stops being
 * reusable once it's gone through a terminal status (a one-off manual entry, nothing to top up).
 */
function splitCapacity(split: BatchSplit): number {
  if (split.productionBatchId != null) {
    const planned = split.plannedQty || 0;
    const done = Math.max(split.fgQty || 0, split.pickedQty || 0);
    return Math.max(0, planned - done);
  }
  return TERMINAL_FF_STATUSES.includes(split.ffStatus) ? 0 : Number.POSITIVE_INFINITY;
}

function buildRows(saleOrder: SaleOrder | null): FastForwardRow[] {
  const rows: FastForwardRow[] = [];
  for (const item of saleOrder?.items ?? []) {
    if (item.id == null) continue;
    const splits = item.batchSplits ?? [];
    const eligibleSplits = splits.filter((sp) => splitCapacity(sp) > 0);

    if (eligibleSplits.length === 0) {
      // Nothing batched for this line yet — fall back to the order's own remaining as the only
      // sensible default (there's no real batch yet to size the entry against).
      const alreadyDone = splits
        .filter((sp) => TERMINAL_FF_STATUSES.includes(sp.ffStatus))
        .reduce((sum, sp) => sum + (Number(sp.pickedQty ?? sp.fgQty) || 0), 0);
      const orderRemaining = Math.max(0, item.orderedQty - alreadyDone);
      if (orderRemaining <= 0) continue;
      rows.push({
        key: `${item.id}-new`,
        item,
        split: null,
        splitLabel: 'Not yet batched',
        planned: orderRemaining,
        remaining: orderRemaining,
      });
      continue;
    }
    eligibleSplits.forEach((split, index) => {
      const capacity = splitCapacity(split);
      if (!(capacity > 0)) return;
      rows.push({
        key: `${item.id}-${split.id ?? index}`,
        item,
        split,
        splitLabel: splitLabelFor(split, index),
        planned: split.plannedQty || 0,
        remaining: capacity,
      });
    });
  }
  return rows;
}

export const FastForwardModal: React.FC<FastForwardModalProps> = ({
  isOpen,
  onClose,
  saleOrder,
  onConfirm,
}) => {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const rows = buildRows(saleOrder);

  useEffect(() => {
    if (!isOpen) return;
    // Each row is an independent batch — default it to its own full remaining.
    const initial: Record<string, number> = {};
    for (const row of rows) {
      initial[row.key] = Number.isFinite(row.remaining) ? row.remaining : 0;
    }
    setQuantities(initial);
    // Re-seed only when the modal (re)opens for a given SO — not on every render, so a value the
    // user is mid-typing doesn't get clobbered by the same defaults on each keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, saleOrder?.soNo]);

  if (!saleOrder) return null;

  const lines: FastForwardLineInput[] = rows
    .map((row) => ({
      itemId: row.item.id as number,
      qty: Math.max(0, Math.min(row.remaining, Math.floor(quantities[row.key] ?? 0))),
      splitId: row.split?.id,
    }))
    .filter((l) => l.qty > 0);

  const handleConfirm = async () => {
    if (lines.length === 0) return;
    setSubmitting(true);
    try {
      await Promise.resolve(onConfirm(lines));
      onClose();
    } catch {
      // Parent surfaces the error via toast; keep the modal open so the entered quantities aren't lost.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Fast Forward — ${saleOrder.soNo}`} size="lg">
      <div className="p-6">
        <div className="mb-5 p-4 bg-brand-soft border border-brand-soft rounded-lg flex items-start gap-3">
          <Zap className="h-5 w-5 text-brand shrink-0 mt-0.5" />
          <p className="text-sm text-brand">
            Use this only when the facility has already completed this quantity outside the tool. Each row is one
            batch — enter how much of that batch is actually done. That quantity is marked FG Ready → Picked and a
            real invoice is generated for it immediately, with placeholder transporter details (no AWB yet; do that
            from Ship). Production, Planning, GRN and QC records are left untouched.
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="p-4 bg-warn-soft border border-[color:var(--st-amber-fg)]/30 rounded-lg">
            <p className="text-sm text-warn">
              Every batch on this order is already fully invoiced — nothing left to fast-forward.
            </p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[60vh] rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-surface-3 sticky top-0 z-10 [&_th]:bg-surface-3">
                <tr>
                  <th scope="col" className="px-4 py-2 text-left font-semibold text-ink-3">Product</th>
                  <th scope="col" className="px-4 py-2 text-left font-semibold text-ink-3">Batch</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold text-ink-3">Planned</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold text-ink-3">Remaining</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold text-ink-3">Qty to FG Ready</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{row.item.productName}</p>
                      <p className="text-xs text-ink-3">{row.item.sku}{row.item.pack ? ` · ${row.item.pack}` : ''}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-2">{row.splitLabel}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatNumber(row.planned)}</td>
                    <td className="px-4 py-3 text-right font-mono text-ok">
                      {Number.isFinite(row.remaining) ? formatNumber(row.remaining) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Input
                        type="number"
                        aria-label={`Qty to FG ready for ${row.item.productName} — ${row.splitLabel}`}
                        className="w-28 text-right"
                        min={0}
                        max={Number.isFinite(row.remaining) ? row.remaining : undefined}
                        value={quantities[row.key] ?? ''}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10);
                          setQuantities((q) => ({
                            ...q,
                            [row.key]: Number.isFinite(n) ? Math.max(0, Math.min(row.remaining, n)) : 0,
                          }));
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 p-4 bg-surface-3 border-t">
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={submitting || lines.length === 0}
          className="flex items-center gap-1.5"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {submitting ? 'Generating invoice…' : 'Fast Forward & Generate Invoice'}
        </Button>
      </div>
    </Modal>
  );
};
