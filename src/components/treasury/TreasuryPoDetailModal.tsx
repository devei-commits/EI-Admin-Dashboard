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
        className="relative w-full max-w-2xl max-h-[min(90vh,52rem)] flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-3">
          <div>
            <h3 id="treasury-po-detail-title" className="text-lg font-bold text-gray-900">
              {po.poNumber}
            </h3>
            <p className="text-sm text-gray-600">{po.vendorName || '—'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100 flex items-center justify-center"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 text-sm">
          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Purchase order</h4>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <dt className="text-gray-500 text-xs">Status</dt>
                <dd className="font-medium text-gray-900">{po.status || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">Order date</dt>
                <dd className="font-medium text-gray-900">{formatDate(po.orderDate)}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">PO value</dt>
                <dd className="font-bold text-gray-900">{fmtMoney(po.grandTotal)}</dd>
              </div>
              {requestCode ? (
                <div>
                  <dt className="text-gray-500 text-xs">Linked request</dt>
                  <dd className="font-medium text-gray-900">{requestCode}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800">Payment terms</h4>
            {po.paymentTerms?.trim() ? (
              <>
                <p className="text-sm font-medium text-amber-950 leading-snug">
                  {formatStagedPaymentTermsSummary(po.paymentTerms)}
                </p>
                <PaymentTermsDisplay value={po.paymentTerms} />
              </>
            ) : (
              <p className="text-sm text-gray-500">—</p>
            )}
          </section>

          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Payment transaction</h4>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <dt className="text-gray-500 text-xs">Transaction no.</dt>
                <dd className="font-mono font-medium text-gray-900 break-all">{tr?.paymentTransactionNo || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">Mode of payment</dt>
                <dd className="font-medium text-gray-900">{tr?.paymentMode || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">Payment date</dt>
                <dd className="font-medium text-gray-900">{formatDate(tr?.paymentTransactionDate)}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">Advance recorded</dt>
                <dd className="font-medium text-gray-900">{formatDate(tr?.advancePaidAt)}</dd>
              </div>
            </dl>
            {tr?.advancePaidNote ? (
              <p className="mt-2 text-xs text-gray-600">
                <span className="font-semibold text-gray-700">Note:</span> {tr.advancePaidNote}
              </p>
            ) : null}
          </section>

          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Release</h4>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <dt className="text-gray-500 text-xs">Released on</dt>
                <dd className="font-medium text-gray-900">{formatDate(tr?.poReleasedAt)}</dd>
              </div>
            </dl>
            {tr?.poReleasedNote ? (
              <p className="mt-2 text-xs text-gray-600 whitespace-pre-wrap break-words">
                <span className="font-semibold text-gray-700">Release note:</span> {tr.poReleasedNote}
              </p>
            ) : null}
          </section>

          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Line items ({po.items.length})
            </h4>
            {po.items.length === 0 ? (
              <p className="text-gray-400 text-sm">No line items on record.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Item</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Qty</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Rate</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {po.items.map((line, i) => {
                      const amt = line.quantity * line.rate;
                      return (
                        <tr key={i} className="border-b border-gray-100 last:border-0">
                          <td className="px-3 py-2 text-gray-800">
                            {line.description || '—'}
                            {line.unit ? <span className="text-gray-400 ml-1">({line.unit})</span> : null}
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

        <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-5 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
