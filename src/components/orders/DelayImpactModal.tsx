/**
 * DelayImpactModal — Port of triggerDelay / openDelayImpact from v15f.
 * Shows impacted BMRs/BPRs and blocker orders when a PO is delayed.
 */
import React from 'react';
import { useGlobalState } from '../../context/GlobalStateContext';
import { fmtNum, formatDate, addDaysISO, todayISO } from '../../utils/manufacturing';
import { UnifiedModal } from '../ui/UnifiedComponents';

interface Props {
  poId: string;
  onClose: () => void;
}

export default function DelayImpactModal({ poId, onClose }: Props) {
  const { state, dispatch } = useGlobalState();

  const po = state.po.issued.find((p: any) => p.id === poId);
  if (!po) {
    return (
      <div className="fixed inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center z-50">
        <div className="bg-surface rounded-xl p-6" role="dialog" aria-modal="true" aria-label="PO not found">
          <p className="text-err">PO not found.</p>
          <button onClick={onClose} className="mt-3 px-4 py-2 bg-surface-3 rounded-lg">Close</button>
        </div>
      </div>
    );
  }

  const triggerDelay = () => {
    const delayedTo = addDaysISO(po.expectedDelivery || todayISO(), 6);
    dispatch({
      type: 'SET_STATE',
      payload: {
        po: {
          ...state.po,
          issued: state.po.issued.map((p: any) =>
            p.id === poId
              ? {
                  ...p,
                  delayed: true,
                  delayedTo,
                  expectedDelivery: delayedTo,
                  expectedStockUpdate: addDaysISO(delayedTo, 1),
                }
              : p
          ),
        },
      },
    });
  };

  // Find impacted items from PO lines
  const impactedItems = (po.lines || []).map((l: any) => l.itemId);
  const impacted = impactedItems
    .map((id: string) => {
      const it = state.items.find((x: any) => x.id === id);
      if (!it) return null;
      return {
        id,
        name: it.name,
        uom: it.uom,
        bmr: (it.reservations?.rmBMR || []).slice(0, 3),
        bpr: (it.reservations?.pmBPR || []).slice(0, 3),
        orders: (it.orders || []).filter((o: any) => o.pendingBlocker).slice(0, 4),
      };
    })
    .filter(Boolean);

  return (
    <UnifiedModal
      isOpen={true}
      onClose={onClose}
      title="Delay Impact"
      size="lg"
      footer={
        <>
          <span className="text-xs text-ink-4 mr-auto">
            Triggers when Expected Delivery slips beyond committed date.
          </span>
          <button onClick={onClose} className="px-5 py-2 bg-brand text-white rounded-lg text-sm hover:bg-brand-press">
            Ok
          </button>
        </>
      }
    >
      <p className="text-sm text-ink-3 -mt-4">
        {po.id} · {po.vendor} · delayed to {po.delayedTo ? formatDate(po.delayedTo) : '—'}
      </p>

      <div className="space-y-4">
          {!po.delayed && (
            <div className="bg-warn-soft border border-[color:var(--st-amber-fg)]/30 rounded-lg p-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-warn">PO not yet delayed</div>
                <div className="text-xs text-warn">Click "Trigger Delay" to mark this PO as delayed (+6 days).</div>
              </div>
              <button
                onClick={triggerDelay}
                className="px-4 py-2 bg-err text-white rounded-lg text-sm hover:bg-err"
              >
                Trigger Delay
              </button>
            </div>
          )}

          {impacted.length === 0 ? (
            <div className="text-ink-4 text-center py-8">No impacted items found.</div>
          ) : (
            impacted.map((x: any) => {
              const hasBMR = x.bmr.length > 0;
              const reservations = hasBMR ? x.bmr : x.bpr;
              return (
                <div key={x.id} className="border rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-ink">{x.name}</h3>
                    <span className="px-2 py-0.5 bg-surface-3 rounded text-xs font-mono">{x.id}</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* BMR/BPR reservations */}
                    <div>
                      <h4 className="font-medium text-ink-2 text-sm mb-2">
                        {hasBMR ? 'Impacted BMR' : 'Impacted BPR'}
                      </h4>
                      <div className="overflow-auto max-h-44">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-surface-3">
                              <th scope="col" className="text-left p-2">Doc</th>
                              <th scope="col" className="text-left p-2">Order</th>
                              <th scope="col" className="text-left p-2">Batch</th>
                              <th scope="col" className="text-right p-2">Qty</th>
                              <th scope="col" className="text-left p-2">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reservations.length > 0 ? (
                              reservations.map((r: any, i: number) => (
                                <tr key={i} className="border-t">
                                  <td className="p-2 font-mono font-bold">{r.doc}</td>
                                  <td className="p-2 font-mono">{r.order}</td>
                                  <td className="p-2 font-mono">{r.batch}</td>
                                  <td className="p-2 text-right font-bold">
                                    {fmtNum(r.qty)} <span className="text-ink-4">{x.uom}</span>
                                  </td>
                                  <td className="p-2">{r.status}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5} className="p-2 text-ink-4">
                                  No BMR/BPR reservations found.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Impacted orders */}
                    <div>
                      <h4 className="font-medium text-ink-2 text-sm mb-2">Impacted Orders (blockers)</h4>
                      <div className="overflow-auto max-h-44">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-surface-3">
                              <th scope="col" className="text-left p-2">Order</th>
                              <th scope="col" className="text-left p-2">Product</th>
                              <th scope="col" className="text-right p-2">Planning</th>
                              <th scope="col" className="text-right p-2">Req</th>
                            </tr>
                          </thead>
                          <tbody>
                            {x.orders.length > 0 ? (
                              x.orders.map((o: any, i: number) => (
                                <tr key={i} className="border-t">
                                  <td className="p-2 font-mono font-bold">{o.order}</td>
                                  <td className="p-2">{o.product}</td>
                                  <td className="p-2 text-right">{o.planning}%</td>
                                  <td className="p-2 text-right font-bold">
                                    {fmtNum(o.required)} <span className="text-ink-4">{x.uom}</span>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={4} className="p-2 text-ink-4">
                                  No blocker orders found.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
    </UnifiedModal>
  );
}
