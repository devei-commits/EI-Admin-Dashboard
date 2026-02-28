/**
 * BatchPlannerModal — Port of openBatchSplit / confirmCreateBatches from v15f.
 * Allows splitting an Ordered Product into multiple batches with BOM preview.
 */
import { useState, useMemo, useCallback } from 'react';
import { useGlobalState } from '../../context/GlobalStateContext';
import { ArrowRightLeft } from 'lucide-react';
import {
  parseSkuToGrams, buildRMLines, buildPMLines,
  lineAvailability, materialStatus, todayISO, fmtNum,
} from '../../utils/manufacturing';
import SwapMaterialModal from './SwapMaterialModal';
import { useToast } from '../../context/ToastContext';

interface Props {
  orderedProduct: any;
  onClose: () => void;
}

export default function BatchPlannerModal({ orderedProduct, onClose }: Props) {
  const { state, dispatch } = useGlobalState();
  const { addToast } = useToast();
  const [splitInput, setSplitInput] = useState(
    orderedProduct.qty <= 10000
      ? String(orderedProduct.qty)
      : `${Math.ceil(orderedProduct.qty / 2)}, ${Math.floor(orderedProduct.qty / 2)}`
  );
  const [previewQty, setPreviewQty] = useState(orderedProduct.qty);
  const [allowPartial, setAllowPartial] = useState(false);
  const [error, setError] = useState('');
  const [materialSwaps, setMaterialSwaps] = useState<Record<string, { toMaterial: string; swapRatio: number }>>({});
  const [swapModalMaterial, setSwapModalMaterial] = useState<{
    itemName: string;
    qty: number;
    gap: number;
  } | null>(null);

  const skuGrams = parseSkuToGrams(orderedProduct.sku || '100g');
  const baseRMLines = useMemo(() => buildRMLines(previewQty, skuGrams, state.items), [previewQty, skuGrams, state.items]);
  const basePMLines = useMemo(() => buildPMLines(previewQty, state.items), [previewQty, state.items]);
  
  // Apply material swaps
  const applySwapsToLines = useCallback((lines: any[]) => {
    return lines.map(line => {
      const swap = materialSwaps[line.itemName];
      if (swap) {
        return {
          ...line,
          itemName: swap.toMaterial,
          qty: line.qty * swap.swapRatio,
          originalMaterial: line.itemName
        };
      }
      return line;
    });
  }, [materialSwaps]);

  const rmLines = useMemo(() => applySwapsToLines(baseRMLines), [baseRMLines, applySwapsToLines]);
  const pmLines = useMemo(() => applySwapsToLines(basePMLines), [basePMLines, applySwapsToLines]);
  
  const rmStatus = materialStatus(rmLines);
  const pmStatus = materialStatus(pmLines);

  const handleSwapApplied = useCallback((swapData: {
    fromMaterial: string;
    toMaterial: string;
    swapRatio: number;
    reason: string;
  }) => {
    setMaterialSwaps(prev => ({
      ...prev,
      [swapData.fromMaterial]: {
        toMaterial: swapData.toMaterial,
        swapRatio: swapData.swapRatio
      }
    }));
    setSwapModalMaterial(null);
  }, []);

  // Max executable units from BOM
  const maxRMUnits = useMemo(() => {
    if (rmLines.length === 0) return Infinity;
    return Math.min(
      ...rmLines.map(l => {
        const freeStock = l.free + (l.poQty || 0);
        const bulkPerUnit = (skuGrams / 1000) * (l.qty / ((previewQty * skuGrams) / 1000 || 1));
        return bulkPerUnit > 0 ? Math.floor(freeStock / bulkPerUnit) : Infinity;
      })
    );
  }, [rmLines, skuGrams, previewQty]);

  const maxPMUnits = useMemo(() => {
    if (pmLines.length === 0) return Infinity;
    return Math.min(
      ...pmLines.map(l => {
        const perUnit = l.qty / (previewQty || 1);
        return perUnit > 0 ? Math.floor((l.free + (l.poQty || 0)) / perUnit) : Infinity;
      })
    );
  }, [pmLines, previewQty]);

  const executable = Math.min(maxRMUnits, maxPMUnits, orderedProduct.qty);

  // Parse splits
  const splits = useMemo(() => {
    return splitInput
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n > 0);
  }, [splitInput]);

  const splitsTotal = splits.reduce((a, b) => a + b, 0);

  const confirmCreateBatches = useCallback(() => {
    if (splits.length === 0) { setError('Enter at least one batch quantity.'); return; }
    if (!allowPartial && splitsTotal !== orderedProduct.qty) {
      setError(`Total ${fmtNum(splitsTotal)} ≠ ordered ${fmtNum(orderedProduct.qty)}. Enable "Allow partial" or adjust.`);
      return;
    }
    setError('');

    splits.forEach((units, idx) => {
      const batchSeq = (state.mfg.seq?.batch || 1) + idx;
      const bmrSeq = (state.mfg.seq?.bmr || 1001) + idx;
      const bprSeq = (state.mfg.seq?.bpr || 2001) + idx;

      const batchNo = `BULK-${orderedProduct.so.replace('SO-', '')}-${String(idx + 1).padStart(2, '0')}`;
      const bmrDocNo = `BMR-${bmrSeq}`;
      const bprDocNo = `BPR-${bprSeq}`;
      const bulkKg = (units * skuGrams) / 1000;

      const batch = {
        id: batchSeq,
        batchNo,
        so: orderedProduct.so,
        product: orderedProduct.product,
        units,
        skuG: skuGrams,
        bulkKg,
        bmrNo: bmrDocNo,
        bprNo: bprDocNo,
        createdAt: todayISO(),
      };

      const bmrRMLines = buildRMLines(units, skuGrams, state.items);
      const bprPMLines = buildPMLines(units, state.items);

      const bmr = {
        id: bmrSeq,
        docNo: bmrDocNo,
        batchId: batchSeq,
        batchNo,
        so: orderedProduct.so,
        product: orderedProduct.product,
        sku: orderedProduct.sku,
        orderDate: orderedProduct.orderDate,
        deliveryDate: orderedProduct.deliveryDate,
        units,
        skuG: skuGrams,
        bulkKg,
        stage: 0, // Pending
        confirmedUnits: null,
        confirmedBulkKg: null,
        tankId: null,
        scheduleDate: null,
        mfgArea: null,
        rmLines: bmrRMLines,
        notes: '',
        actualYield: null,
        startTime: null,
        endTime: null,
        operator: null,
        productionNotes: '',
        productionProgress: 0,
        qcResults: [],
        qcRemarks: '',
      };

      const bpr = {
        id: bprSeq,
        docNo: bprDocNo,
        batchId: batchSeq,
        batchNo,
        so: orderedProduct.so,
        product: orderedProduct.product,
        sku: orderedProduct.sku,
        orderDate: orderedProduct.orderDate,
        deliveryDate: orderedProduct.deliveryDate,
        units,
        stage: 0, // Pending
        pmLines: bprPMLines,
        notes: '',
        scheduleDate: null,
        actualUnits: null,
        operator: null,
        packagingNotes: '',
        qcResults: [],
        qcRemarks: '',
      };

      dispatch({ type: 'CREATE_BMR_BATCH', payload: { batch, bmr, bpr } });
    });

    // Update SO status
    const soData = state.orders.salesOrders.find((s: any) => s.so === orderedProduct.so);
    if (soData) {
      dispatch({
        type: 'SET_STATE',
        payload: {
          ...state,
          orders: {
            ...state.orders,
            salesOrders: state.orders.salesOrders.map((s: any) =>
              s.so === orderedProduct.so ? { ...s, internalStatus: 'Batch created', splitBatches: splits.length } : s
            ),
            orderedProducts: state.orders.orderedProducts.map((op: any) =>
              op.id === orderedProduct.id ? { ...op, stage: 'Batch created' } : op
            ),
          },
          mfg: {
            ...state.mfg,
            seq: {
              batch: (state.mfg.seq?.batch || 1) + splits.length,
              bmr: (state.mfg.seq?.bmr || 1001) + splits.length,
              bpr: (state.mfg.seq?.bpr || 2001) + splits.length,
            },
          },
        },
      });
    }

    onClose();
  }, [splits, splitsTotal, allowPartial, orderedProduct, state, dispatch, onClose, skuGrams]);

  return (
    <div className="fixed inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-275 max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold">Batch Planner</h2>
            <p className="text-slate-300 text-sm mt-1">
              {orderedProduct.so} · {orderedProduct.product} · {orderedProduct.sku} · {fmtNum(orderedProduct.qty)} units · Due {orderedProduct.deliveryDate}
            </p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        {/* Availability Bar */}
        <div className="bg-gray-50 border-b px-6 py-3 grid grid-cols-5 gap-4 text-center text-sm">
          <div>
            <div className="text-2xl font-bold text-gray-800">{fmtNum(orderedProduct.qty)}</div>
            <div className="text-gray-500">ORDER QTY</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{fmtNum(maxRMUnits === Infinity ? orderedProduct.qty : maxRMUnits)}</div>
            <div className="text-gray-500">RM COVERS</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">{fmtNum(maxPMUnits === Infinity ? orderedProduct.qty : maxPMUnits)}</div>
            <div className="text-gray-500">PM COVERS</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-600">{fmtNum(executable)}</div>
            <div className="text-gray-500">EXECUTABLE</div>
          </div>
          <div>
            <div className={`text-lg font-bold ${executable >= orderedProduct.qty ? 'text-green-600' : 'text-red-600'}`}>
              {executable >= orderedProduct.qty ? '✅ All material available' : '⚠️ Short on some materials'}
            </div>
            <div className="text-gray-500">STATUS</div>
          </div>
        </div>

        {/* Body: 2 columns */}
        <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* LEFT: BOM / Material Status */}
          <div className="border-r p-4 overflow-auto">
            <div className="flex items-center gap-2 mb-3">
              <span className="font-semibold text-gray-700">Preview qty:</span>
              <input
                type="number"
                value={previewQty}
                onChange={e => setPreviewQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-28 border rounded-lg px-3 py-1.5 text-sm"
              />
            </div>

            {/* RM Table */}
            <h4 className="font-semibold text-gray-600 mb-2">🧪 Raw Materials ({rmStatus.ok}/{rmStatus.total} available)</h4>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-2 py-1.5 text-left">Item</th>
                    <th className="px-2 py-1.5 text-right">Req</th>
                    <th className="px-2 py-1.5 text-right">Stock</th>
                    <th className="px-2 py-1.5 text-right">Free</th>
                    <th className="px-2 py-1.5 text-right">PO/Transit</th>
                    <th className="px-2 py-1.5 text-right">Gap</th>
                    <th className="px-2 py-1.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rmLines.map((l, i) => {
                    const avail = lineAvailability(l);
                    const isSwapped = l.originalMaterial;
                    return (
                      <tr key={i} className="border-b">
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{l.itemName}</span>
                            {isSwapped && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                Swapped from {l.originalMaterial}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right">{fmtNum(l.qty)}</td>
                        <td className="px-2 py-1.5 text-right">{fmtNum(l.stock)}</td>
                        <td className="px-2 py-1.5 text-right">{fmtNum(l.free)}</td>
                        <td className="px-2 py-1.5 text-right">{fmtNum((l.poQty || 0) + (l.inTransit || 0))}</td>
                        <td className={`px-2 py-1.5 text-right font-bold ${avail.gap > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {avail.gap > 0 ? fmtNum(avail.gap) : '—'}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {avail.sufficient
                              ? <span className="text-green-600">✅</span>
                              : (
                                <>
                                  <span className="text-red-500">⚠️</span>
                                  {!isSwapped && (
                                    <button
                                      onClick={() => setSwapModalMaterial({
                                        itemName: l.itemName,
                                        qty: l.qty,
                                        gap: avail.gap
                                      })}
                                      className="ml-1 w-6 h-6 rounded bg-orange-100 hover:bg-orange-200 flex items-center justify-center transition"
                                      title="Swap material"
                                    >
                                      <ArrowRightLeft className="w-3 h-3 text-orange-600" />
                                    </button>
                                  )}
                                </>
                              )
                            }
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* PM Table */}
            <h4 className="font-semibold text-gray-600 mb-2">📦 Packing Materials ({pmStatus.ok}/{pmStatus.total} available)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-2 py-1.5 text-left">Item</th>
                    <th className="px-2 py-1.5 text-right">Req</th>
                    <th className="px-2 py-1.5 text-right">Stock</th>
                    <th className="px-2 py-1.5 text-right">Free</th>
                    <th className="px-2 py-1.5 text-right">PO/Transit</th>
                    <th className="px-2 py-1.5 text-right">Gap</th>
                    <th className="px-2 py-1.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pmLines.map((l, i) => {
                    const avail = lineAvailability(l);
                    const isSwapped = l.originalMaterial;
                    return (
                      <tr key={i} className="border-b">
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{l.itemName}</span>
                            {isSwapped && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                Swapped from {l.originalMaterial}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right">{fmtNum(l.qty)}</td>
                        <td className="px-2 py-1.5 text-right">{fmtNum(l.stock)}</td>
                        <td className="px-2 py-1.5 text-right">{fmtNum(l.free)}</td>
                        <td className="px-2 py-1.5 text-right">{fmtNum((l.poQty || 0) + (l.inTransit || 0))}</td>
                        <td className={`px-2 py-1.5 text-right font-bold ${avail.gap > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {avail.gap > 0 ? fmtNum(avail.gap) : '—'}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {avail.sufficient
                              ? <span className="text-green-600">✅</span>
                              : (
                                <>
                                  <span className="text-red-500">⚠️</span>
                                  {!isSwapped && (
                                    <button
                                      onClick={() => setSwapModalMaterial({
                                        itemName: l.itemName,
                                        qty: l.qty,
                                        gap: avail.gap
                                      })}
                                      className="ml-1 w-6 h-6 rounded bg-orange-100 hover:bg-orange-200 flex items-center justify-center transition"
                                      title="Swap material"
                                    >
                                      <ArrowRightLeft className="w-3 h-3 text-orange-600" />
                                    </button>
                                  )}
                                </>
                              )
                            }
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT: Batch Split Plan */}
          <div className="p-4 overflow-auto">
            <h4 className="font-semibold text-gray-700 mb-2">Batch Split Plan</h4>
            <p className="text-xs text-gray-500 mb-3">Enter comma-separated batch sizes (e.g., "7000, 7000")</p>

            <input
              type="text"
              value={splitInput}
              onChange={e => { setSplitInput(e.target.value); setError(''); }}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-2"
              placeholder="7000, 7000"
            />

            <label className="flex items-center gap-2 text-sm text-gray-600 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={allowPartial}
                onChange={e => setAllowPartial(e.target.checked)}
                className="rounded"
              />
              Allow partial (total ≠ ordered qty)
            </label>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-3">{error}</div>
            )}

            {/* Split preview cards */}
            <div className="space-y-3">
              {splits.map((units, idx) => {
                const batchRMLines = buildRMLines(units, skuGrams, state.items);
                const batchPMLines = buildPMLines(units, state.items);
                const batchRMStatus = materialStatus(batchRMLines);
                const batchPMStatus = materialStatus(batchPMLines);
                const allOk = batchRMStatus.ok === batchRMStatus.total && batchPMStatus.ok === batchPMStatus.total;
                return (
                  <div key={idx} className={`border rounded-lg p-3 ${allOk ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-800">Batch B{String(idx + 1).padStart(2, '0')}</span>
                      <span className="text-sm text-gray-600">{fmtNum(units)} units · {fmtNum((units * skuGrams) / 1000)} kg bulk</span>
                    </div>
                    <div className="flex gap-4 mt-1 text-xs">
                      <span>RM: {batchRMStatus.ok}/{batchRMStatus.total} ✅</span>
                      <span>PM: {batchPMStatus.ok}/{batchPMStatus.total} 📦</span>
                      <span className={allOk ? 'text-green-700 font-bold' : 'text-amber-700 font-bold'}>
                        {allOk ? 'All available' : 'Some short'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {splits.length > 0 && (
              <div className="mt-4 p-3 bg-gray-100 rounded-lg text-sm">
                <strong>Summary:</strong> {splits.length} batches, total {fmtNum(splitsTotal)} units
                {splitsTotal === orderedProduct.qty
                  ? <span className="text-green-700"> ✅ Exact match</span>
                  : splitsTotal > orderedProduct.qty
                    ? <span className="text-amber-700"> Over by {fmtNum(splitsTotal - orderedProduct.qty)}</span>
                    : <span className="text-red-700"> Under by {fmtNum(orderedProduct.qty - splitsTotal)}</span>
                }
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 px-6 py-3 flex justify-between items-center">
          <p className="text-xs text-gray-500">Each split creates a BMR + BPR linked to this order.</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-100 text-sm">Cancel</button>
            <button
              onClick={confirmCreateBatches}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
              disabled={splits.length === 0}
            >
              Create {splits.length} Batch{splits.length !== 1 ? 'es' : ''}
            </button>
          </div>
        </div>
      </div>

      {/* Swap Material Modal */}
      {swapModalMaterial && (
        <SwapMaterialModal
          material={swapModalMaterial}
          onClose={() => setSwapModalMaterial(null)}
          onSwapApplied={handleSwapApplied}
        />
      )}
    </div>
  );
}
