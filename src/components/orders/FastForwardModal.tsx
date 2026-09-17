/**
 * FastForwardModal Component
 * One-click-ish catch-up for an SO the facility already completed outside the tool. Unlike
 * Pick/Invoice/Ship (which follow batches that already exist), this asks the user how much of
 * each line is actually done — that's the qty marked FG Ready → Picked and invoiced immediately.
 */
import React, { useEffect, useState } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import { UnifiedModal as Modal, UnifiedInput as Input, UnifiedButton as Button } from '../ui/UnifiedComponents';
import type { SaleOrder } from '../../types/orderFulfillment';
import { formatNumber } from '../../utils/orderFulfillmentUtils';

const TERMINAL_FF_STATUSES = ['invoiced', 'shipped', 'delivered', 'closed'];

export interface FastForwardLineInput {
  itemId: number;
  qty: number;
}

export interface FastForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleOrder: SaleOrder | null;
  /** May return a Promise; modal waits for it before closing, and stays open on failure. */
  onConfirm: (lines: FastForwardLineInput[]) => void | Promise<void>;
}

export const FastForwardModal: React.FC<FastForwardModalProps> = ({
  isOpen,
  onClose,
  saleOrder,
  onConfirm,
}) => {
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);

  // Lines still worth fast-forwarding: an ordered qty not yet fully covered by an
  // invoiced-or-later split. "Already done" reads each terminal split's picked (fallback FG) qty.
  const rows = (saleOrder?.items ?? [])
    .filter((item) => item.id != null)
    .map((item) => {
      const alreadyDone = item.batchSplits
        .filter((sp) => TERMINAL_FF_STATUSES.includes(sp.ffStatus))
        .reduce((sum, sp) => sum + (Number(sp.pickedQty ?? sp.fgQty) || 0), 0);
      const remaining = Math.max(0, item.orderedQty - alreadyDone);
      return { item, alreadyDone, remaining };
    })
    .filter((r) => r.remaining > 0);

  useEffect(() => {
    if (!isOpen) return;
    const initial: Record<number, number> = {};
    for (const { item, remaining } of rows) {
      if (item.id != null) initial[item.id] = remaining;
    }
    setQuantities(initial);
    // Re-seed only when the modal (re)opens for a given SO — not on every render, so a value the
    // user is mid-typing doesn't get clobbered by the same defaults on each keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, saleOrder?.soNo]);

  if (!saleOrder) return null;

  const lines = rows
    .map(({ item, remaining }) => ({
      itemId: item.id as number,
      qty: Math.max(0, Math.min(remaining, Math.floor(quantities[item.id as number] ?? 0))),
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
            Use this only when the facility has already completed this quantity outside the tool. Enter how much of
            each line is actually done — that quantity is marked FG Ready → Picked and a real invoice is generated
            for it immediately, with placeholder transporter details (no AWB yet; do that from Ship). Production,
            Planning, GRN and QC records are left untouched.
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="p-4 bg-warn-soft border border-[color:var(--st-amber-fg)]/30 rounded-lg">
            <p className="text-sm text-warn">
              Every line on this order is already invoiced (or later) — nothing left to fast-forward.
            </p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[60vh] rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-surface-3 sticky top-0 z-10 [&_th]:bg-surface-3">
                <tr>
                  <th scope="col" className="px-4 py-2 text-left font-semibold text-ink-3">Product</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold text-ink-3">Ordered</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold text-ink-3">Already Invoiced+</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold text-ink-3">Remaining</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold text-ink-3">Qty to FG Ready</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map(({ item, alreadyDone, remaining }) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{item.productName}</p>
                      <p className="text-xs text-ink-3">{item.sku}{item.pack ? ` · ${item.pack}` : ''}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{formatNumber(item.orderedQty)}</td>
                    <td className="px-4 py-3 text-right font-mono text-ink-3">{formatNumber(alreadyDone)}</td>
                    <td className="px-4 py-3 text-right font-mono text-ok">{formatNumber(remaining)}</td>
                    <td className="px-4 py-3 text-right">
                      <Input
                        type="number"
                        aria-label={`Qty to FG ready for ${item.productName}`}
                        className="w-28 text-right"
                        min={0}
                        max={remaining}
                        value={quantities[item.id as number] ?? ''}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10);
                          setQuantities((q) => ({
                            ...q,
                            [item.id as number]: Number.isFinite(n) ? Math.max(0, Math.min(remaining, n)) : 0,
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
