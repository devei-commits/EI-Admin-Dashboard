/**
 * GRNWizardModal — Port of openGRNWizard / saveValidations / generateLabels / closeGRN from v15f.
 * 5-step validation + label generation + close GRN.
 */
import { useState, useCallback } from 'react';
import { useGlobalState } from '../../context/GlobalStateContext';
import { todayISO, addDaysISO, fmtNum, formatDate } from '../../utils/manufacturing';

interface Props {
  poId: string;
  lineItemId: string;
  onClose: () => void;
}

interface Validations {
  billVsPO: boolean;
  physicalQty: boolean;
  specificationMatch: boolean;
  documentationReview: boolean;
  qualityAcceptance: boolean;
  remarks: string;
  pass: boolean;
}

interface Label {
  grnBatch: string;
  boxNo: number;
  unitsPerBox: number;
  location: string;
  mfgDate: string;
  expDate: string;
  mfgBatch: string;
  itemCode: string;
  itemName: string;
}

export default function GRNWizardModal({ poId, lineItemId, onClose }: Props) {
  const { state, dispatch } = useGlobalState();

  const po = state.po.issued.find((p: any) => p.id === poId);
  const line = po?.lines?.find((l: any) => l.itemId === lineItemId);

  // Validation state
  const [validations, setValidations] = useState<Validations>({
    billVsPO: line?.grn?.validations?.billVsPO || false,
    physicalQty: line?.grn?.validations?.physicalQty || false,
    specificationMatch: line?.grn?.validations?.specificationMatch || false,
    documentationReview: line?.grn?.validations?.documentationReview || false,
    qualityAcceptance: line?.grn?.validations?.qualityAcceptance || false,
    remarks: line?.grn?.validations?.remarks || '',
    pass: line?.grn?.validations?.pass || false,
  });

  // Label generation state
  const defaultBoxes = 5;
  const defaultUnitsPerBox = line ? Math.floor(line.qty / defaultBoxes) : 10;
  const [boxes, setBoxes] = useState(defaultBoxes);
  const [unitsPerBox, setUnitsPerBox] = useState(defaultUnitsPerBox);
  const [location, setLocation] = useState('WH-1/R1/S2');
  const [grnBatch, setGrnBatch] = useState(`GRN-${poId}-${lineItemId.slice(-4)}`);
  const [mfgDate, setMfgDate] = useState(todayISO());
  const [expDate, setExpDate] = useState(addDaysISO(todayISO(), 730));
  const [mfgBatch, setMfgBatch] = useState(`MFG-${Math.random().toString(16).slice(2, 8).toUpperCase()}`);
  const [labels, setLabels] = useState<Label[]>(line?.grn?.labels || []);

  const [step, setStep] = useState<'validations' | 'labels'>('validations');

  if (!po || !line) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6">
          <p className="text-red-600">PO or line item not found.</p>
          <button onClick={onClose} className="mt-3 px-4 py-2 bg-gray-200 rounded-lg">Close</button>
        </div>
      </div>
    );
  }

  const allChecked = validations.billVsPO && validations.physicalQty && validations.specificationMatch && validations.documentationReview && validations.qualityAcceptance;

  const updateValidation = (key: keyof Omit<Validations, 'pass' | 'remarks'>, value: boolean) => {
    setValidations(prev => {
      const next = { ...prev, [key]: value };
      next.pass = next.billVsPO && next.physicalQty && next.specificationMatch && next.documentationReview && next.qualityAcceptance;
      return next;
    });
  };

  const autoPassAll = () => {
    setValidations({
      billVsPO: true,
      physicalQty: true,
      specificationMatch: true,
      documentationReview: true,
      qualityAcceptance: true,
      remarks: 'Auto-passed all validations',
      pass: true,
    });
  };

  const saveValidations = () => {
    dispatch({
      type: 'COMPLETE_GRN',
      payload: {
        poId,
        lineItemId,
        grnData: {
          validations,
          status: validations.pass ? 'Validated' : 'Hold',
        },
      },
    });
    if (validations.pass) setStep('labels');
  };

  const generateLabels = useCallback(() => {
    if (!boxes || !unitsPerBox || !location || !grnBatch) return;
    const newLabels: Label[] = [];
    for (let i = 1; i <= boxes; i++) {
      newLabels.push({
        grnBatch,
        boxNo: i,
        unitsPerBox,
        location: `${location}-B${String(i).padStart(2, '0')}`,
        mfgDate,
        expDate,
        mfgBatch,
        itemCode: line.itemId,
        itemName: line.itemName,
      });
    }
    setLabels(newLabels);
    // Save labels to state
    dispatch({
      type: 'COMPLETE_GRN',
      payload: {
        poId,
        lineItemId,
        grnData: { labels: newLabels },
      },
    });
  }, [boxes, unitsPerBox, location, grnBatch, mfgDate, expDate, mfgBatch, line, dispatch, poId, lineItemId]);

  const removeLabel = (idx: number) => {
    const newLabels = labels.filter((_, i) => i !== idx);
    setLabels(newLabels);
  };

  const closeGRN = () => {
    if (!validations.pass) { alert('Validations not passed.'); return; }
    if (labels.length === 0) { alert('Generate labels first.'); return; }

    dispatch({
      type: 'COMPLETE_GRN',
      payload: {
        poId,
        lineItemId,
        grnData: {
          status: 'Closed',
          validations,
          labels,
          receivedQty: line.qty,
        },
      },
    });

    // Reduce poQty and inTransit
    const item = state.items.find((i: any) => i.id === line.itemId);
    if (item) {
      dispatch({
        type: 'UPDATE_ITEM_STOCK',
        payload: { itemId: line.itemId, field: 'poQty', value: Math.max(0, (item.poQty || 0) - (line.qty || 0)) },
      });
      dispatch({
        type: 'UPDATE_ITEM_STOCK',
        payload: { itemId: line.itemId, field: 'inTransit', value: Math.max(0, (item.inTransit || 0) - Math.min(item.inTransit || 0, line.qty || 0)) },
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold">GRN Wizard</h2>
            <p className="text-slate-300 text-sm mt-1">
              {poId} · {line.itemName} · {fmtNum(line.qty)} {line.uom} · Status: {line.grn?.status || 'Pending'}
            </p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b">
          <button
            onClick={() => setStep('validations')}
            className={`px-6 py-3 text-sm font-medium ${step === 'validations' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          >
            1. Validations
          </button>
          <button
            onClick={() => validations.pass && setStep('labels')}
            className={`px-6 py-3 text-sm font-medium ${step === 'labels' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'} ${!validations.pass ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            2. Labels & Close
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {step === 'validations' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-800">GRN Validation Checks</h3>
                <button onClick={autoPassAll} className="text-xs text-blue-600 hover:text-blue-800 underline">Auto-pass all (Demo)</button>
              </div>

              {/* 5 Validation checks */}
              {[
                { key: 'billVsPO' as const, label: '1. Bill vs PO details match', desc: 'Verify invoice quantities, prices, and terms match PO' },
                { key: 'physicalQty' as const, label: '2. Physical quantity check', desc: 'Count received quantity and compare with invoice' },
                { key: 'specificationMatch' as const, label: '3. Specification match', desc: 'Check CoA parameters against approved specifications' },
                { key: 'documentationReview' as const, label: '4. Documentation review', desc: 'Verify CoA, SDS, test reports, and certificates are present' },
                { key: 'qualityAcceptance' as const, label: '5. Quality acceptance (QC pass)', desc: 'QC sampling and testing passed acceptance criteria' },
              ].map(({ key, label, desc }) => (
                <label key={key} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${validations[key] ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input
                    type="checkbox"
                    checked={validations[key]}
                    onChange={e => updateValidation(key, e.target.checked)}
                    className="mt-0.5 h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <div>
                    <div className="font-medium text-gray-800">{label}</div>
                    <div className="text-xs text-gray-500">{desc}</div>
                  </div>
                </label>
              ))}

              {/* Remarks */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                <textarea
                  value={validations.remarks}
                  onChange={e => setValidations(prev => ({ ...prev, remarks: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Any observation or note..."
                />
              </div>

              {/* Status */}
              <div className={`p-3 rounded-lg text-sm font-medium ${allChecked ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                {allChecked ? '✅ All validations passed — ready for labels' : `⚠️ ${5 - [validations.billVsPO, validations.physicalQty, validations.specificationMatch, validations.documentationReview, validations.qualityAcceptance].filter(Boolean).length} validation(s) pending`}
              </div>

              <button
                onClick={saveValidations}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
              >
                Save Validations {allChecked && '& Continue to Labels →'}
              </button>
            </div>
          )}

          {step === 'labels' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800">Label Generation</h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Boxes</label>
                  <input type="number" value={boxes} onChange={e => setBoxes(parseInt(e.target.value) || 0)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Units / Box</label>
                  <input type="number" value={unitsPerBox} onChange={e => setUnitsPerBox(parseInt(e.target.value) || 0)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Location Prefix</label>
                  <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">GRN Batch</label>
                  <input type="text" value={grnBatch} onChange={e => setGrnBatch(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">MFG Date</label>
                  <input type="date" value={mfgDate} onChange={e => setMfgDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">EXP Date</label>
                  <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">MFG Batch</label>
                  <input type="text" value={mfgBatch} onChange={e => setMfgBatch(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <button
                onClick={generateLabels}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
              >
                Generate {boxes} Labels
              </button>

              {/* Labels preview */}
              {labels.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Generated Labels ({labels.length})</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-auto">
                    {labels.map((lbl, idx) => (
                      <div key={idx} className="border rounded-lg p-3 text-xs bg-gray-50 relative">
                        <button onClick={() => removeLabel(idx)} className="absolute top-1 right-1 text-red-400 hover:text-red-600 text-sm">&times;</button>
                        <div className="font-bold">Box #{lbl.boxNo}</div>
                        <div>GRN: {lbl.grnBatch} · {lbl.unitsPerBox} units</div>
                        <div>Loc: {lbl.location}</div>
                        <div>MFG: {formatDate(lbl.mfgDate)} · EXP: {formatDate(lbl.expDate)}</div>
                        <div>Batch: {lbl.mfgBatch}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={closeGRN}
                disabled={labels.length === 0}
                className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ✅ Close GRN — Receive {fmtNum(line.qty)} {line.uom} into stock
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
