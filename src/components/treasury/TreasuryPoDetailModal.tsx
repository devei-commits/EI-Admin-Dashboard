import { X } from 'lucide-react';
import { PaymentTermsDisplay } from '../procurement/PaymentTermsDisplay';
import { formatStagedPaymentTermsSummary } from '../../lib/stagedPaymentTerms';
import type { TreasuryPurchaseOrderRow } from '../../services/treasury.service';

function formatDate(d: string | null | undefined) {
  if (!d || !String(d).trim()) return '—';
  try {
    return new Date(String(d).slice(0, 10)).toLocaleDateString('en-IN');
  } catch {
    return String(d);
  }
}

function fmtMoney(n: number) {
  return '₹' + new Intl.NumberFormat('en-IN').format(Math.round(n));
}

export function TreasuryPoDetailModal({
  po,
  onClose,
}: {
  po: TreasuryPurchaseOrderRow;
  onClose: () => void;
}) {
  const tr = po.tracking;
  const requestCode =
    (po.formData?.requestCode as string) ||
    (po.formData?.request_code as string) ||
    String(po.formData?.requestId ?? '') ||
    '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="treasury-po-detail-title"
    >
      <div
        className="relative w-full max-w-2xl max-h-[min(90vh,52rem)] flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface-2 px-5 py-3">
          <div>
            <h3 id="treasury-po-detail-title" className="text-lg font-bold text-ink">
              {po.poNumber}
            </h3>
            <p className="text-sm text-ink-2">{po.vendorName || '—'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg border border-border text-ink-3 hover:bg-surface-3 flex items-center justify-center"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 text-sm">
          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-3 mb-2">Purchase order</h4>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <dt className="text-ink-3 text-xs">Status</dt>
                <dd className="font-medium text-ink">{po.status || '—'}</dd>
              </div>
              <div>
                <dt className="text-ink-3 text-xs">Order date</dt>
                <dd className="font-medium text-ink">{formatDate(po.orderDate)}</dd>
              </div>
              <div>
                <dt className="text-ink-3 text-xs">PO value</dt>
                <dd className="font-bold text-ink">{fmtMoney(po.grandTotal)}</dd>
              </div>
              {requestCode ? (
                <div>
                  <dt className="text-ink-3 text-xs">Linked request</dt>
                  <dd className="font-medium text-ink">{requestCode}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="rounded-lg border border-warn bg-warn-soft/60 px-4 py-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-warn">Payment terms</h4>
            {po.paymentTerms?.trim() ? (
              <>
                <p className="text-sm font-medium text-warn leading-snug">
                  {formatStagedPaymentTermsSummary(po.paymentTerms)}
                </p>
                <PaymentTermsDisplay value={po.paymentTerms} />
              </>
            ) : (
              <p className="text-sm text-ink-3">—</p>
            )}
          </section>

          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-3 mb-2">Payment transaction</h4>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <dt className="text-ink-3 text-xs">Transaction no.</dt>
                <dd className="font-mono font-medium text-ink break-all">{tr?.paymentTransactionNo || '—'}</dd>
              </div>
              <div>
                <dt className="text-ink-3 text-xs">Mode of payment</dt>
                <dd className="font-medium text-ink">{tr?.paymentMode || '—'}</dd>
              </div>
              <div>
                <dt className="text-ink-3 text-xs">Payment date</dt>
                <dd className="font-medium text-ink">{formatDate(tr?.paymentTransactionDate)}</dd>
              </div>
              <div>
                <dt className="text-ink-3 text-xs">Advance recorded</dt>
                <dd className="font-medium text-ink">{formatDate(tr?.advancePaidAt)}</dd>
              </div>
            </dl>
            {tr?.advancePaidNote ? (
              <p className="mt-2 text-xs text-ink-2">
                <span className="font-semibold text-ink-2">Note:</span> {tr.advancePaidNote}
              </p>
            ) : null}
          </section>

          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-3 mb-2">Release</h4>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <dt className="text-ink-3 text-xs">Released on</dt>
                <dd className="font-medium text-ink">{formatDate(tr?.poReleasedAt)}</dd>
              </div>
            </dl>
            {tr?.poReleasedNote ? (
              <p className="mt-2 text-xs text-ink-2 whitespace-pre-wrap break-words">
                <span className="font-semibold text-ink-2">Release note:</span> {tr.poReleasedNote}
              </p>
            ) : null}
          </section>

          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-3 mb-2">
              Line items ({po.items.length})
            </h4>
            {po.items.length === 0 ? (
              <p className="text-ink-4 text-sm">No line items on record.</p>
            ) : (
              <div className="overflow-auto max-h-[70vh] rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-20 [&_th]:bg-surface-2">
                    <tr className="bg-surface-2 border-b border-border">
                      <th scope="col" className="px-3 py-2 text-left font-semibold text-ink-2">Item</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">Qty</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">Rate</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {po.items.map((line, i) => {
                      const amt = line.quantity * line.rate;
                      return (
                        <tr key={i} className="border-b border-hairline last:border-0">
                          <td className="px-3 py-2 text-ink">
                            {line.description || '—'}
                            {line.unit ? <span className="text-ink-4 ml-1">({line.unit})</span> : null}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{line.quantity}</td>
                          <td className="px-3 py-2 text-right tabular-nums">₹{line.rate.toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">
                            ₹{amt.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="shrink-0 border-t border-border bg-surface-2 px-5 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-ink text-white text-sm font-semibold hover:bg-ink transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
