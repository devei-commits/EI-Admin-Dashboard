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
        <div className="bg-white rounded-xl p-6">
          <p className="text-red-600">PO not found.</p>
          <button onClick={onClose} className="mt-3 px-4 py-2 bg-gray-200 rounded-lg">Close</button>
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
          <span className="text-xs text-gray-400 mr-auto">
            Triggers when Expected Delivery slips beyond committed date.
          </span>
          <button onClick={onClose} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            Ok
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-500 -mt-4">
        {po.id} · {po.vendor} · delayed to {po.delayedTo ? formatDate(po.delayedTo) : '—'}
      </p>

      <div className="space-y-4">
          {!po.delayed && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-amber-800">PO not yet delayed</div>
                <div className="text-xs text-amber-600">Click "Trigger Delay" to mark this PO as delayed (+6 days).</div>
              </div>
              <button
                onClick={triggerDelay}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
              >
                Trigger Delay
              </button>
            </div>
          )}

          {impacted.length === 0 ? (
            <div className="text-gray-400 text-center py-8">No impacted items found.</div>
          ) : (
            impacted.map((x: any) => {
              const hasBMR = x.bmr.length > 0;
              const reservations = hasBMR ? x.bmr : x.bpr;
              return (
                <div key={x.id} className="border rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-800">{x.name}</h3>
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">{x.id}</span>
                  </div>
                  <div className="h-px bg-gray-200" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* BMR/BPR reservations */}
                    <div>
                      <h4 className="font-medium text-gray-700 text-sm mb-2">
                        {hasBMR ? 'Impacted BMR' : 'Impacted BPR'}
                      </h4>
                      <div className="overflow-auto max-h-44">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="text-left p-2">Doc</th>
                              <th className="text-left p-2">Order</th>
                              <th className="text-left p-2">Batch</th>
                              <th className="text-right p-2">Qty</th>
                              <th className="text-left p-2">Status</th>
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
                                    {fmtNum(r.qty)} <span className="text-gray-400">{x.uom}</span>
                                  </td>
                                  <td className="p-2">{r.status}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5} className="p-2 text-gray-400">
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
                      <h4 className="font-medium text-gray-700 text-sm mb-2">Impacted Orders (blockers)</h4>
                      <div className="overflow-auto max-h-44">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="text-left p-2">Order</th>
                              <th className="text-left p-2">Product</th>
                              <th className="text-right p-2">Planning</th>
                              <th className="text-right p-2">Req</th>
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
                                    {fmtNum(o.required)} <span className="text-gray-400">{x.uom}</span>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={4} className="p-2 text-gray-400">
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
