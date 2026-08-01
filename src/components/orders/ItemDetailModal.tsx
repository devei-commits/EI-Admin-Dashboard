/**
 * ItemDetailModal — Port of openItemModal from v15f.
 * 3 modes: STOCK (warehouse breakdown), RESERVED (BMR/BPR reservations + orders), DETAIL (inventory logic + actions).
 */
import React, { useState } from 'react';
import { useGlobalState } from '../../context/GlobalStateContext';
import { fmtNum, getGap, getPriorityQty } from '../../utils/manufacturing';
import { UnifiedModal } from '../ui/UnifiedComponents';
import { ModalOverlay } from '../ui/ModalOverlay';
import { Tabs } from '../ui';

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
      <ModalOverlay onClose={onClose} z="z-50" dismissable={false} backdrop="light">
        <div className="bg-surface rounded-xl p-6" role="dialog" aria-modal="true" aria-label="Item not found" onClick={(e) => e.stopPropagation()}>
          <p className="text-err">Item not found.</p>
          <button onClick={onClose} className="mt-3 px-4 py-2 bg-surface-3 rounded-lg">Close</button>
        </div>
      </ModalOverlay>
    );
  }

  const gap = getGap(item);
  const pq = getPriorityQty(item);
  const free = Math.max(0, (item.stock || 0) - (item.reserved || 0));

  return (
    <UnifiedModal
      isOpen={true}
      onClose={onClose}
      title={`${item.name} — ${item.id}`}
      size="lg"
    >
      <p className="text-sm text-ink-3 -mt-4">{item.type} · {item.uom} · {item.spec}</p>

      {/* KPIs */}
        <div className="grid grid-cols-4 gap-3 p-4 border-b bg-surface-3">
          <div className="text-center">
            <div className="text-xs text-ink-3">Total Required</div>
            <div className="font-bold text-lg">{fmtNum(item.required || 0)} <span className="text-xs text-ink-4">{item.uom}</span></div>
          </div>
          <div className="text-center">
            <div className="text-xs text-ink-3">Stock in hand</div>
            <div className="font-bold text-lg">{fmtNum(item.stock)} <span className="text-xs text-ink-4">{item.uom}</span></div>
          </div>
          <div className="text-center">
            <div className="text-xs text-ink-3">Reserved</div>
            <div className="font-bold text-lg">{fmtNum(item.reserved)} <span className="text-xs text-ink-4">{item.uom}</span></div>
          </div>
          <div className="text-center">
            <div className="text-xs text-ink-3">Gap</div>
            <div className={`font-bold text-lg ${gap > 0 ? 'text-err' : 'text-ok'}`}>
              {fmtNum(gap)} <span className="text-xs text-ink-4">{item.uom}</span>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <Tabs<Mode>
          tabs={[
            { key: 'DETAIL', label: 'Overview' },
            { key: 'STOCK', label: 'Warehouse Stock' },
            { key: 'RESERVED', label: 'Reservations' },
          ]}
          value={mode}
          onChange={setMode}
        />

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {mode === 'STOCK' && (
            <div className="space-y-3">
              <h3 className="font-semibold text-ink">Warehouse-wise stock</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-3 border-b">
                    <th scope="col" className="text-left p-3">Warehouse</th>
                    <th scope="col" className="text-right p-3">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {(item.warehouses || []).map((w: any, i: number) => (
                    <tr key={i} className="border-b">
                      <td className="p-3">{w.name}</td>
                      <td className="p-3 text-right font-bold">{fmtNum(w.qty)} <span className="text-ink-4">{item.uom}</span></td>
                    </tr>
                  ))}
                  {(!item.warehouses || item.warehouses.length === 0) && (
                    <tr><td colSpan={2} className="p-3 text-ink-4">No warehouse data available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {mode === 'RESERVED' && (
            <div className="space-y-4">
              {/* BMR or BPR reservations */}
              <div>
                <h3 className="font-semibold text-ink mb-2">
                  {item.type === 'RM' ? 'BMR reservations (RM)' : 'BPR reservations (PM)'}
                </h3>
                <div className="overflow-auto max-h-48">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-3 border-b">
                        <th scope="col" className="text-left p-2">{item.type === 'RM' ? 'BMR' : 'BPR'}</th>
                        <th scope="col" className="text-left p-2">Order</th>
                        <th scope="col" className="text-left p-2">Batch</th>
                        <th scope="col" className="text-right p-2">Qty</th>
                        <th scope="col" className="text-left p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const rows = item.type === 'RM' ? item.reservations?.rmBMR : item.reservations?.pmBPR;
                        if (!rows || rows.length === 0) {
                          return <tr><td colSpan={5} className="p-2 text-ink-4">No reservations recorded.</td></tr>;
                        }
                        return rows.map((r: any, i: number) => (
                          <tr key={i} className="border-t">
                            <td className="p-2 font-mono font-bold">{r.doc}</td>
                            <td className="p-2 font-mono">{r.order}</td>
                            <td className="p-2 font-mono">{r.batch}</td>
                            <td className="p-2 text-right font-bold">{fmtNum(r.qty)} <span className="text-ink-4">{item.uom}</span></td>
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
                <h3 className="font-semibold text-ink mb-2">Involved orders</h3>
                <div className="overflow-auto max-h-48">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-3 border-b">
                        <th scope="col" className="text-left p-2">Order</th>
                        <th scope="col" className="text-left p-2">Product</th>
                        <th scope="col" className="text-right p-2">Required</th>
                        <th scope="col" className="text-right p-2">Planning %</th>
                        <th scope="col" className="text-center p-2">Blocker</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(item.orders || []).map((o: any, i: number) => (
                        <tr key={i} className="border-t">
                          <td className="p-2 font-mono font-bold">{o.order}</td>
                          <td className="p-2">{o.product}</td>
                          <td className="p-2 text-right font-bold">{fmtNum(o.required)} <span className="text-ink-4">{item.uom}</span></td>
                          <td className="p-2 text-right">{o.planning}%</td>
                          <td className="p-2 text-center">
                            {o.pendingBlocker
                              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-warn-soft text-warn rounded text-xs"><span className="w-1.5 h-1.5 bg-warn rounded-full"></span>Yes</span>
                              : <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-ok-soft text-ok rounded text-xs"><span className="w-1.5 h-1.5 bg-ok rounded-full"></span>No</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 text-xs text-ink-3">Priority Qty = <b>{fmtNum(pq)}</b> {item.uom}</div>
              </div>
            </div>
          )}

          {mode === 'DETAIL' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Inventory logic */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-ink mb-3">Inventory logic</h3>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b"><td className="py-2 text-ink-3">Free stock</td><td className="py-2 text-right font-bold">{fmtNum(free)} <span className="text-ink-4">{item.uom}</span></td></tr>
                    <tr className="border-b"><td className="py-2 text-ink-3">PO qty</td><td className="py-2 text-right font-bold">{fmtNum(item.poQty)} <span className="text-ink-4">(incl in transit)</span></td></tr>
                    <tr className="border-b"><td className="py-2 text-ink-3">In transit</td><td className="py-2 text-right font-bold">{fmtNum(item.inTransit)}</td></tr>
                    <tr className="border-b"><td className="py-2 text-ink-3">Gap</td><td className={`py-2 text-right font-bold ${gap > 0 ? 'text-err' : 'text-ok'}`}>{fmtNum(gap)}</td></tr>
                    <tr><td className="py-2 text-ink-3">Priority qty</td><td className={`py-2 text-right font-bold ${pq > 0 ? 'text-warn' : 'text-ink-4'}`}>{fmtNum(pq)}</td></tr>
                  </tbody>
                </table>
              </div>

              {/* Actions */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-ink mb-3">Actions</h3>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setMode('STOCK')} className="px-3 py-2 bg-surface-3 text-ink-2 rounded-lg text-sm hover:bg-surface-3">
                    Warehouse report
                  </button>
                  <button onClick={() => setMode('RESERVED')} className="px-3 py-2 bg-surface-3 text-ink-2 rounded-lg text-sm hover:bg-surface-3">
                    {item.type === 'RM' ? 'BMR' : 'BPR'} reservations
                  </button>
                  {onReleaseToPlan && (
                    <button
                      onClick={() => onReleaseToPlan(item.id)}
                      className="px-3 py-2 bg-brand text-white rounded-lg text-sm hover:bg-brand-press"
                    >
                      Release to Planned
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
    </UnifiedModal>
  );
}
