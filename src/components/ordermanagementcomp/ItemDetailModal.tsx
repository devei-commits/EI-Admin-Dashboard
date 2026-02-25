/**
 * ItemDetailModal — Port of openItemModal from v15f.
 * 3 modes: STOCK (warehouse breakdown), RESERVED (BMR/BPR reservations + orders), DETAIL (inventory logic + actions).
 */
import { useState } from 'react';
import { useGlobalState } from '../../context/GlobalStateContext';
import { fmtNum, getGap, getPriorityQty } from '../../utils/manufacturing';

interface Props {
  itemId: string;
  initialMode?: 'STOCK' | 'RESERVED' | 'DETAIL';
  onClose: () => void;
  onReleaseToPlan?: (itemId: string) => void;
}

type Mode = 'STOCK' | 'RESERVED' | 'DETAIL';

export default function ItemDetailModal({ itemId, initialMode = 'DETAIL', onClose, onReleaseToPlan }: Props) {
  const { state } = useGlobalState();
  const [mode, setMode] = useState<Mode>(initialMode);

  const item = state.items.find((x: any) => x.id === itemId);
  if (!item) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6">
          <p className="text-red-600">Item not found.</p>
          <button onClick={onClose} className="mt-3 px-4 py-2 bg-gray-200 rounded-lg">Close</button>
        </div>
      </div>
    );
  }

  const gap = getGap(item);
  const pq = getPriorityQty(item);
  const free = Math.max(0, (item.stock || 0) - (item.reserved || 0));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold">
              {item.name} <span className="ml-2 px-2 py-0.5 bg-white/10 rounded text-xs font-mono">{item.id}</span>
            </h2>
            <p className="text-slate-300 text-sm mt-1">{item.type} · {item.uom} · {item.spec}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3 p-4 border-b bg-gray-50">
          <div className="text-center">
            <div className="text-xs text-gray-500">Total Required</div>
            <div className="font-bold text-lg">{fmtNum(item.required || 0)} <span className="text-xs text-gray-400">{item.uom}</span></div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">Stock in hand</div>
            <div className="font-bold text-lg">{fmtNum(item.stock)} <span className="text-xs text-gray-400">{item.uom}</span></div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">Reserved</div>
            <div className="font-bold text-lg">{fmtNum(item.reserved)} <span className="text-xs text-gray-400">{item.uom}</span></div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">Gap</div>
            <div className={`font-bold text-lg ${gap > 0 ? 'text-red-500' : 'text-green-600'}`}>
              {fmtNum(gap)} <span className="text-xs text-gray-400">{item.uom}</span>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b">
          {(['DETAIL', 'STOCK', 'RESERVED'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-5 py-3 text-sm font-medium ${mode === m ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {m === 'DETAIL' ? 'Overview' : m === 'STOCK' ? 'Warehouse Stock' : 'Reservations'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {mode === 'STOCK' && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-800">Warehouse-wise stock</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left p-3">Warehouse</th>
                    <th className="text-right p-3">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {(item.warehouses || []).map((w: any, i: number) => (
                    <tr key={i} className="border-b">
                      <td className="p-3">{w.name}</td>
                      <td className="p-3 text-right font-bold">{fmtNum(w.qty)} <span className="text-gray-400">{item.uom}</span></td>
                    </tr>
                  ))}
                  {(!item.warehouses || item.warehouses.length === 0) && (
                    <tr><td colSpan={2} className="p-3 text-gray-400">No warehouse data available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {mode === 'RESERVED' && (
            <div className="space-y-4">
              {/* BMR or BPR reservations */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">
                  {item.type === 'RM' ? 'BMR reservations (RM)' : 'BPR reservations (PM)'}
                </h3>
                <div className="overflow-auto max-h-48">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left p-2">{item.type === 'RM' ? 'BMR' : 'BPR'}</th>
                        <th className="text-left p-2">Order</th>
                        <th className="text-left p-2">Batch</th>
                        <th className="text-right p-2">Qty</th>
                        <th className="text-left p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const rows = item.type === 'RM' ? item.reservations?.rmBMR : item.reservations?.pmBPR;
                        if (!rows || rows.length === 0) {
                          return <tr><td colSpan={5} className="p-2 text-gray-400">No reservations recorded.</td></tr>;
                        }
                        return rows.map((r: any, i: number) => (
                          <tr key={i} className="border-t">
                            <td className="p-2 font-mono font-bold">{r.doc}</td>
                            <td className="p-2 font-mono">{r.order}</td>
                            <td className="p-2 font-mono">{r.batch}</td>
                            <td className="p-2 text-right font-bold">{fmtNum(r.qty)} <span className="text-gray-400">{item.uom}</span></td>
                            <td className="p-2">{r.status}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Involved orders */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-800 mb-2">Involved orders</h3>
                <div className="overflow-auto max-h-48">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left p-2">Order</th>
                        <th className="text-left p-2">Product</th>
                        <th className="text-right p-2">Required</th>
                        <th className="text-right p-2">Planning %</th>
                        <th className="text-center p-2">Blocker</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(item.orders || []).map((o: any, i: number) => (
                        <tr key={i} className="border-t">
                          <td className="p-2 font-mono font-bold">{o.order}</td>
                          <td className="p-2">{o.product}</td>
                          <td className="p-2 text-right font-bold">{fmtNum(o.required)} <span className="text-gray-400">{item.uom}</span></td>
                          <td className="p-2 text-right">{o.planning}%</td>
                          <td className="p-2 text-center">
                            {o.pendingBlocker
                              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs"><span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>Yes</span>
                              : <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs"><span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>No</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 text-xs text-gray-500">Priority Qty = <b>{fmtNum(pq)}</b> {item.uom}</div>
              </div>
            </div>
          )}

          {mode === 'DETAIL' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Inventory logic */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Inventory logic</h3>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b"><td className="py-2 text-gray-600">Free stock</td><td className="py-2 text-right font-bold">{fmtNum(free)} <span className="text-gray-400">{item.uom}</span></td></tr>
                    <tr className="border-b"><td className="py-2 text-gray-600">PO qty</td><td className="py-2 text-right font-bold">{fmtNum(item.poQty)} <span className="text-gray-400">(incl in transit)</span></td></tr>
                    <tr className="border-b"><td className="py-2 text-gray-600">In transit</td><td className="py-2 text-right font-bold">{fmtNum(item.inTransit)}</td></tr>
                    <tr className="border-b"><td className="py-2 text-gray-600">Gap</td><td className={`py-2 text-right font-bold ${gap > 0 ? 'text-red-500' : 'text-green-600'}`}>{fmtNum(gap)}</td></tr>
                    <tr><td className="py-2 text-gray-600">Priority qty</td><td className={`py-2 text-right font-bold ${pq > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{fmtNum(pq)}</td></tr>
                  </tbody>
                </table>
              </div>

              {/* Actions */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Actions</h3>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setMode('STOCK')} className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
                    Warehouse report
                  </button>
                  <button onClick={() => setMode('RESERVED')} className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
                    {item.type === 'RM' ? 'BMR' : 'BPR'} reservations
                  </button>
                  {onReleaseToPlan && (
                    <button
                      onClick={() => onReleaseToPlan(item.id)}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                    >
                      Release to Planned
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
