/**
 * ConsolidatedMRModal — Port of openMaterialRequest / submitMaterialRequest from v15f.
 * Shows consolidated material requirements across selected BMRs, then can submit request to warehouse.
 */
import { useState, useMemo } from 'react';
import { useGlobalState } from '../../context/GlobalStateContext';
import { fmtNum, round2, addDaysISO, todayISO } from '../../utils/manufacturing';

interface Props {
  bmrIds: string[];
  onClose: () => void;
}

interface ConsolidatedLine {
  itemId: string;
  name: string;
  uom: string;
  required: number;
  atFactory: number;
  whStock: number;
  free: number;
  toTransfer: number;
}

export default function ConsolidatedMRModal({ bmrIds, onClose }: Props) {
  const { state, dispatch } = useGlobalState();
  const [requiredBy, setRequiredBy] = useState(addDaysISO(todayISO(), 1));

  const bmrs = bmrIds
    .map((id) => state.mfg.bmrs.find((b: any) => b.id === id))
    .filter(Boolean);

  const factory = bmrs[0]?.mfgArea || 'Manufacturing Area';

  const lines: ConsolidatedLine[] = useMemo(() => {
    const map: Record<string, ConsolidatedLine> = {};
    bmrs.forEach((b: any) => {
      (b.rmLines || []).forEach((l: any) => {
        if (!map[l.itemId])
          map[l.itemId] = {
            itemId: l.itemId,
            name: l.name,
            uom: l.uom,
            required: 0,
            atFactory: 0,
            whStock: 0,
            free: 0,
            toTransfer: 0,
          };
        map[l.itemId].required = round2(map[l.itemId].required + (l.required || 0));
        map[l.itemId].atFactory = round2(map[l.itemId].atFactory + (l.atFactory || 0));
      });
    });

    Object.values(map).forEach((l) => {
      const it = state.items.find((x: any) => x.id === l.itemId);
      l.whStock = it ? it.stock || 0 : 0;
      l.free = it ? Math.max(0, (it.stock || 0) - (it.reserved || 0)) : 0;
      l.toTransfer = Math.max(0, round2(l.required - l.atFactory - l.free));
    });

    return Object.values(map);
  }, [bmrs, state.items]);

  const submitRequest = () => {
    if (!bmrs.length) return;

    const reqLines = lines.map((l) => ({
      itemId: l.itemId,
      name: l.name,
      uom: l.uom,
      required: l.required,
      atFactory: l.atFactory,
      toTransfer: l.toTransfer,
      picked: false,
      transferred: false,
    }));

    const mrId =
      'MR-' +
      String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0');

    const req = {
      id: mrId,
      bmrIds,
      bmrNos: bmrs.map((b: any) => b.docNo).join(', '),
      factory,
      requestDate: todayISO(),
      requiredBy,
      status: 'pending',
      lines: reqLines,
      transferDate: null,
      completedDate: null,
    };

    dispatch({ type: 'ADD_MATERIAL_REQUEST', payload: req });

    // Advance each BMR to "Material Sourced" (stage 4) if currently at stage ≤ 3
    bmrs.forEach((b: any) => {
      if (b.stage <= 3) {
        dispatch({
          type: 'ADVANCE_BMR_STAGE',
          payload: { bmrId: b.id, newStage: 4 },
        });
      }
    });

    onClose();
  };

  if (!bmrs.length) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6">
          <p className="text-red-600">No BMRs found.</p>
          <button onClick={onClose} className="mt-3 px-4 py-2 bg-gray-200 rounded-lg">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold">Consolidated Material Request</h2>
            <p className="text-slate-300 text-sm mt-1">{bmrs.map((b: any) => b.docNo).join(', ')}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">
              Factory: <b className="text-gray-800">{factory}</b>
            </span>
            <span className="text-gray-500">
              Required by:{' '}
              <input
                type="date"
                value={requiredBy}
                onChange={(e) => setRequiredBy(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
            </span>
          </div>

          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left p-3">Item</th>
                  <th className="text-right p-3">Total Required</th>
                  <th className="text-right p-3">At Factory</th>
                  <th className="text-right p-3">Free at WH</th>
                  <th className="text-right p-3">To Transfer</th>
                  <th className="text-right p-3">WH Stock</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.itemId} className="border-b">
                    <td className="p-3">
                      <b>{l.name}</b>
                      <div className="text-xs text-gray-400 font-mono">{l.itemId}</div>
                    </td>
                    <td className="p-3 text-right font-mono">
                      {fmtNum(l.required)} {l.uom}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {fmtNum(l.atFactory)} {l.uom}
                    </td>
                    <td className="p-3 text-right font-mono">
                      <span className={l.free > 0 ? 'text-green-600' : 'text-red-500'}>
                        {fmtNum(l.free)}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono">
                      <b className={l.toTransfer > 0 ? 'text-red-500' : 'text-green-600'}>
                        {fmtNum(l.toTransfer)}
                      </b>
                    </td>
                    <td className="p-3 text-right font-mono">{fmtNum(l.whStock)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-3 flex justify-end gap-3 bg-gray-50">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-200 rounded-lg text-sm hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={submitRequest}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 font-medium"
          >
            Submit Request to Warehouse
          </button>
        </div>
      </div>
    </div>
  );
}
