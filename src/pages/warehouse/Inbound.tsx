import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { fetchGRNList, updateGRN, fetchGRNAssignableUsers, generateGRNLabels, type AssignableUser, type GeneratedLabel } from '../../services/grn.service';

type GRNType = 'RM' | 'PM';
type QCStatus = 'Passed' | 'In Progress' | 'Pending' | 'Failed';
type GRNStatus = 'GRN Complete' | 'Under GRN' | 'In Transit' | 'On Hold' | 'Delayed' | 'Pending';
type WorkflowStep = 'PO Received' | 'Qty Check' | 'QC Inspection' | 'Label Generation' | 'Dispatch Ready';

const WORKFLOW_STEPS_REQUIRED: WorkflowStep[] = ['PO Received', 'Qty Check', 'QC Inspection', 'Label Generation', 'Dispatch Ready'];

interface LineItem {
  id: string;
  item: string;
  itemCode: string;
  poQty: number;
  rcvdQty: number;
  invoiceQty: number;
  unitPrice: number;
  diff?: number;
  qcStatus: 'Pass' | 'Hold' | 'Pending' | 'Fail';
  qcBy: string;
  raw_material_id?: number;
  pack_material_id?: number;
  product_id?: number;
}

interface GRNRecord {
  id: string;
  grnNo: string;
  poNo: string;
  vendor: string;
  type: GRNType;
  items: number;
  poValue: number;
  expectedDate: string;
  receivedDate: string | null;
  assignedTo: string;
  qcStatus: QCStatus;
  status: GRNStatus;
  invoiceNo?: string;
  invoiceAmount?: number;
  grnDate?: string;
  lineItems?: LineItem[];
  workflowSteps?: WorkflowStep[];
  noOfBoxes?: number | null;
  unitsPerBox?: number | null;
  locationPrefix?: string | null;
  grnBatchMfg?: string | null;
  expiry?: string | null;
  mfgBatch?: string | null;
  generatedLabels?: GeneratedLabel[] | null;
}

// GRN Detail Modal Component
const GRNDetailModal = ({ grn, onClose, onSaveChanges, assignableUsers = [] }: { grn: GRNRecord; onClose: () => void; onSaveChanges: (updatedGRN: GRNRecord) => void; assignableUsers?: AssignableUser[] }) => {
  const [assignedTo, setAssignedTo] = useState(grn.assignedTo || '');
  const [grnDate, setGrnDate] = useState(grn.grnDate || new Date().toISOString().split('T')[0]);
  const [editedLineItems, setEditedLineItems] = useState<LineItem[]>(() =>
    (grn.lineItems || []).map(li => ({
      ...li,
      rcvdQty: (li.rcvdQty != null && li.rcvdQty !== 0) ? li.rcvdQty : li.poQty,
    }))
  );
  const [labelsGenerated, setLabelsGenerated] = useState(!!(grn.generatedLabels && grn.generatedLabels.length > 0));
  const [labels, setLabels] = useState<GeneratedLabel[] | null>(grn.generatedLabels ?? null);
  const [generatingLabels, setGeneratingLabels] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [selectedLineItemId, setSelectedLineItemId] = useState<string>('');
  const [noOfBoxes, setNoOfBoxes] = useState(String(grn.noOfBoxes ?? 1));
  const [unitsPerBox, setUnitsPerBox] = useState(String(grn.unitsPerBox ?? ''));
  const [locationPrefix, setLocationPrefix] = useState(grn.locationPrefix ?? '');
  const [grnBatchMfg, setGrnBatchMfg] = useState(grn.grnBatchMfg ?? '');
  const [expiry, setExpiry] = useState(grn.expiry ?? '');
  const [mfgBatch, setMfgBatch] = useState(grn.mfgBatch ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentWorkflowSteps, setCurrentWorkflowSteps] = useState<WorkflowStep[]>(grn.workflowSteps || []);

  const selectedLineItem = editedLineItems.find(li => li.id === selectedLineItemId) ?? null;

  const handleLineItemChange = (itemId: string, field: 'rcvdQty' | 'qcStatus', value: string | number) => {
    setEditedLineItems(prev =>
      prev.map(item => {
        if (item.id !== itemId) return item;
        const next = { ...item, [field === 'rcvdQty' ? 'rcvdQty' : 'qcStatus']: field === 'rcvdQty' ? parseInt(value as string) || 0 : value };
        if (field === 'rcvdQty') {
          const rcvdQty = next.rcvdQty;
          const diff = rcvdQty - item.poQty;
          if (diff < 0) next.qcStatus = 'Hold'; // shortfall => auto Hold
        }
        return next;
      })
    );
  };

  const persistUpdate = async (payload: { status?: string; qcStatus?: string; workflowSteps?: string[] }) => {
    setSaveError(null);
    setSaving(true);
    try {
      const res = await updateGRN(grn.id, {
        assignedTo,
        grnDate: grnDate || undefined,
        lineItems: editedLineItems,
        noOfBoxes: noOfBoxes ? parseInt(noOfBoxes, 10) : undefined,
        unitsPerBox: unitsPerBox ? parseInt(unitsPerBox, 10) : undefined,
        locationPrefix: locationPrefix || undefined,
        grnBatchMfg: grnBatchMfg || undefined,
        expiry: expiry || undefined,
        mfgBatch: mfgBatch || undefined,
        ...payload,
      });
      const updated: GRNRecord = {
        id: res.id,
        grnNo: res.grnNo,
        poNo: res.poNo,
        vendor: res.vendor,
        type: res.type as GRNType,
        items: res.items,
        poValue: res.poValue,
        expectedDate: res.expectedDate,
        receivedDate: res.receivedDate,
        assignedTo: res.assignedTo,
        qcStatus: res.qcStatus as QCStatus,
        status: res.status as GRNStatus,
        lineItems: res.lineItems,
        workflowSteps: (res.workflowSteps || []) as WorkflowStep[],
        invoiceNo: res.invoiceNo ?? undefined,
        invoiceAmount: res.invoiceAmount ?? undefined,
        grnDate: res.grnDate ?? undefined,
        noOfBoxes: res.noOfBoxes ?? undefined,
        unitsPerBox: res.unitsPerBox ?? undefined,
        locationPrefix: res.locationPrefix ?? undefined,
        grnBatchMfg: res.grnBatchMfg ?? undefined,
        expiry: res.expiry ?? undefined,
        mfgBatch: res.mfgBatch ?? undefined,
        generatedLabels: res.generatedLabels ?? undefined,
      };
      onSaveChanges(updated);
      if (payload.status === 'GRN Complete') onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOnly = () => persistUpdate({});

  const handleCompleteGRN = () => {
    persistUpdate({
      status: 'GRN Complete',
      qcStatus: 'Passed',
      workflowSteps: WORKFLOW_STEPS_REQUIRED,
    });
  };

  const getWorkflowStepColor = (step: WorkflowStep) => {
    if (!currentWorkflowSteps.length) return 'bg-slate-100 text-slate-600 border-slate-300';
    
    const stepIndex = WORKFLOW_STEPS_REQUIRED.indexOf(step);
    const completedUpTo = WORKFLOW_STEPS_REQUIRED.findIndex(s => !currentWorkflowSteps.includes(s));
    
    if (currentWorkflowSteps.includes(step)) {
      return 'bg-emerald-100 text-emerald-700 border-emerald-300';
    } else if (completedUpTo === stepIndex) {
      return 'bg-amber-100 text-amber-700 border-amber-300';
    }
    return 'bg-slate-100 text-slate-600 border-slate-300';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">GRN — {grn.grnNo}</h2>
            <p className="text-sm text-slate-600 mt-0.5">{grn.vendor}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Status and type */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
              currentWorkflowSteps.length === WORKFLOW_STEPS_REQUIRED.length
                ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                : 'bg-amber-100 text-amber-700 border-amber-300'
            }`}>
              {grn.status}
            </span>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 border border-blue-300 rounded-full text-xs font-semibold">
              {grn.type}
            </span>
          </div>

          {/* Workflow Steps */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {WORKFLOW_STEPS_REQUIRED.map((step, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${getWorkflowStepColor(step)}`}
                >
                  {currentWorkflowSteps.includes(step) ? 'Done' : '-'} {step}
                </div>
                {idx < WORKFLOW_STEPS_REQUIRED.length - 1 && (
                  <span className="text-slate-400 text-lg">&gt;</span>
                )}
              </div>
            ))}
          </div>

          {/* PO Details Section */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">PO & shipment</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-1">GRN NO.</p>
                <p className="text-sm font-mono font-bold text-blue-600">{grn.grnNo}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-1">PO NO.</p>
                <p className="text-sm font-mono font-bold text-emerald-600">{grn.poNo}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-1">Vendor</p>
                <p className="text-sm font-medium text-slate-900">{grn.vendor}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-1">PO Value</p>
                <p className="text-sm font-bold text-amber-700">₹{grn.poValue.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-1">Expected Date</p>
                <p className="text-sm font-medium text-slate-900">{new Date(grn.expectedDate).toLocaleDateString('en-IN')}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-1">Received Date</p>
                <p className="text-sm font-medium text-slate-900">
                  {grn.receivedDate ? new Date(grn.receivedDate).toLocaleDateString('en-IN') : '—'}
                </p>
              </div>
              {grn.invoiceNo && (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-1">Invoice No.</p>
                  <p className="text-sm font-mono font-medium text-slate-900">{grn.invoiceNo}</p>
                </div>
              )}
              {grn.invoiceAmount && (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-1">Invoice Amount</p>
                  <p className="text-sm font-bold text-amber-700">₹{grn.invoiceAmount.toLocaleString('en-IN')}</p>
                </div>
              )}
            </div>
          </section>

          {/* Assign GRN Team Section */}
          <section className="bg-slate-50/80 rounded-xl p-5 border border-slate-200/80 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Assign & dates</h3>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Assigned To
                </label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                >
                  <option value="">Unassigned</option>
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={u.displayName}>{u.displayName}</option>
                  ))}
                  {assignedTo && !assignableUsers.some((u) => u.displayName === assignedTo) && (
                    <option value={assignedTo}>{assignedTo}</option>
                  )}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  GRN Date
                </label>
                <input
                  type="date"
                  value={grnDate}
                  onChange={(e) => setGrnDate(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </section>

          {/* Line Items Table */}
          {grn.lineItems && grn.lineItems.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Line items — qty & QC</h3>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Item</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-700">PO QTY</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-700">RCVD QTY</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-700">Invoice QTY</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-700">Unit Price</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-700">Diff</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-700">QC Status</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-700">QC By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {editedLineItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-left">
                          <div className="font-medium text-slate-900">{item.item}</div>
                          <div className="text-slate-500">{item.itemCode}</div>
                        </td>
                        <td className="px-3 py-2 text-center font-medium text-slate-900">{item.poQty}</td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            value={item.rcvdQty}
                            onChange={(e) => handleLineItemChange(item.id, 'rcvdQty', e.target.value)}
                            className="w-16 px-3 py-2 border-2 border-blue-300 rounded-lg bg-white text-slate-900 text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                            min="0"
                          />
                        </td>
                        <td className="px-3 py-2 text-center font-medium text-slate-900">{item.invoiceQty}</td>
                        <td className="px-3 py-2 text-center font-medium text-amber-600">₹{item.unitPrice}</td>
                        <td className="px-3 py-2 text-center">
                          {(() => {
                            const calculatedDiff = item.rcvdQty - item.poQty; // positive = over-received, negative = shortfall
                            return (
                              <span className={`font-bold ${calculatedDiff === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {calculatedDiff === 0 ? '0' : calculatedDiff > 0 ? `+${calculatedDiff}` : calculatedDiff}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <select
                            value={item.qcStatus}
                            onChange={(e) => handleLineItemChange(item.id, 'qcStatus', e.target.value)}
                            className={`px-2 py-1 rounded-full font-semibold text-xs border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              item.qcStatus === 'Pass'
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                                : item.qcStatus === 'Hold'
                                ? 'bg-amber-100 text-amber-700 border-amber-300'
                                : item.qcStatus === 'Pending'
                                ? 'bg-slate-100 text-slate-600 border-slate-300'
                                : 'bg-rose-100 text-rose-700 border-rose-300'
                            }`}
                          >
                            <option value="Pass">Pass</option>
                            <option value="Hold">Hold</option>
                            <option value="Pending">Pending</option>
                            <option value="Fail">Fail</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-center text-slate-600">{item.qcBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Label data & Generate QR Labels */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Labels (QR per box)</h3>
            <p className="text-xs text-slate-600">Select a product, fill details below and click Generate Labels. Each box gets a QR containing product, GRN, units/box, location, batch, and expiry info.</p>

            {/* Product / Line Item Selection */}
            {editedLineItems.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Select product / line item <span className="text-red-500">*</span></label>
                <select
                  value={selectedLineItemId}
                  onChange={(e) => setSelectedLineItemId(e.target.value)}
                  className={`w-full px-2 py-1.5 border rounded text-sm ${!selectedLineItemId ? 'border-amber-400 bg-amber-50' : 'border-slate-300'}`}
                >
                  <option value="">— Select a product —</option>
                  {editedLineItems.map((li) => (
                    <option key={li.id} value={li.id}>{li.item} ({li.itemCode}) — PO Qty: {li.poQty}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">No of boxes</label>
                <input type="number" min={1} value={noOfBoxes} onChange={(e) => setNoOfBoxes(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Units/box</label>
                <input type="number" min={0} value={unitsPerBox} onChange={(e) => setUnitsPerBox(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Location prefix</label>
                <input type="text" value={locationPrefix} onChange={(e) => setLocationPrefix(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" placeholder="e.g. WH-A" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">GRN batch mfg</label>
                <input type="text" value={grnBatchMfg} onChange={(e) => setGrnBatchMfg(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Expiry</label>
                <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Mfg batch</label>
                <input type="text" value={mfgBatch} onChange={(e) => setMfgBatch(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!labelsGenerated ? (
                <button
                  onClick={async () => {
                    if (editedLineItems.length > 0 && !selectedLineItemId) {
                      setLabelError('Please select a product / line item before generating labels.');
                      return;
                    }
                    setLabelError(null);
                    setGeneratingLabels(true);
                    try {
                      const numBoxes = Math.max(1, parseInt(noOfBoxes, 10) || 1);
                      const res = await generateGRNLabels(grn.id, {
                        noOfBoxes: numBoxes,
                        unitsPerBox: unitsPerBox ? parseInt(unitsPerBox, 10) : undefined,
                        locationPrefix: locationPrefix || undefined,
                        grnBatchMfg: grnBatchMfg || undefined,
                        expiry: expiry || undefined,
                        mfgBatch: mfgBatch || undefined,
                        productName: selectedLineItem?.item || undefined,
                        itemCode: selectedLineItem?.itemCode || undefined,
                      });
                      setLabels(res.labels);
                      setLabelsGenerated(true);
                      if (res.workflowSteps) {
                        setCurrentWorkflowSteps(res.workflowSteps as WorkflowStep[]);
                      }
                    } catch (e) {
                      setLabelError(e instanceof Error ? e.message : 'Failed to generate labels');
                    } finally {
                      setGeneratingLabels(false);
                    }
                  }}
                  disabled={generatingLabels}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {generatingLabels ? 'Generating…' : 'Generate Labels'}
                </button>
              ) : (
                <button
                  onClick={() => { setLabelsGenerated(false); setLabels(null); }}
                  className="px-4 py-2 bg-slate-400 text-white rounded-lg font-medium text-sm hover:bg-slate-500 transition-colors"
                >
                  Hide Labels
                </button>
              )}
            </div>
            {labelError && <p className="text-sm text-red-600">{labelError}</p>}
          </section>

          {/* QR Label Preview — one card per box with scan payload */}
          {labelsGenerated && labels && labels.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Label preview</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {labels.map((label) => {
                  let payload: { grn_id?: number; grn_no?: string; product_name?: string; item_code?: string; units_per_box?: number; location_prefix?: string; grn_batch_mfg?: string; expiry?: string; mfg_batch?: string; box_index?: number } = {};
                  try {
                    payload = JSON.parse(label.qrPayload);
                  } catch {
                    payload = {};
                  }
                  return (
                    <div key={label.boxIndex} className="bg-white border-2 border-slate-300 rounded-lg p-4 shadow-sm">
                      <div className="text-center mb-2">
                        <p className="text-xs font-mono font-bold text-slate-900">Box {label.boxIndex}</p>
                      </div>
                      <div className="flex justify-center mb-3">
                        <img src={label.qrImageDataUrl} alt={`QR Box ${label.boxIndex}`} className="w-32 h-32 object-contain" />
                      </div>
                      <div className="space-y-1 text-xs text-slate-600">
                        {payload.product_name && <p><span className="font-semibold">Product:</span> {payload.product_name}</p>}
                        {payload.item_code && <p><span className="font-semibold">Item code:</span> {payload.item_code}</p>}
                        <p><span className="font-semibold">GRN:</span> {payload.grn_no || payload.grn_id}</p>
                        <p><span className="font-semibold">Units/box:</span> {payload.units_per_box}</p>
                        <p><span className="font-semibold">Location:</span> {payload.location_prefix || '—'}</p>
                        <p><span className="font-semibold">Batch mfg:</span> {payload.grn_batch_mfg || '—'}</p>
                        <p><span className="font-semibold">Expiry:</span> {payload.expiry || '—'}</p>
                        <p><span className="font-semibold">Mfg batch:</span> {payload.mfg_batch || '—'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Save error */}
          {saveError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
              {saveError}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-800 font-medium text-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Close
            </button>
            <button
              onClick={handleSaveOnly}
              disabled={saving}
              className="px-4 py-2 bg-slate-600 text-white rounded-lg font-medium text-sm hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              onClick={handleCompleteGRN}
              disabled={saving}
              className={`px-4 py-2 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${
                grn.status === 'In Transit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {grn.status === 'In Transit' ? 'Complete GRN & Initiate Stock' : 'Mark complete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function mapApiToGRNRecord(r: {
  id: string;
  grnNo: string;
  poNo: string;
  vendor: string;
  type: 'RM' | 'PM';
  items: number;
  poValue: number;
  expectedDate: string;
  receivedDate: string | null;
  assignedTo: string;
  qcStatus: string;
  status: string;
  lineItems?: LineItem[];
  workflowSteps?: WorkflowStep[];
  invoiceNo?: string | null;
  invoiceAmount?: number | null;
  grnDate?: string | null;
  noOfBoxes?: number | null;
  unitsPerBox?: number | null;
  locationPrefix?: string | null;
  grnBatchMfg?: string | null;
  expiry?: string | null;
  mfgBatch?: string | null;
  generatedLabels?: GeneratedLabel[] | null;
}): GRNRecord {
  return {
    id: r.id,
    grnNo: r.grnNo,
    poNo: r.poNo,
    vendor: r.vendor,
    type: r.type,
    items: r.items,
    poValue: r.poValue,
    expectedDate: r.expectedDate,
    receivedDate: r.receivedDate,
    assignedTo: r.assignedTo,
    qcStatus: r.qcStatus as QCStatus,
    status: r.status as GRNStatus,
    lineItems: r.lineItems,
    workflowSteps: r.workflowSteps,
    invoiceNo: r.invoiceNo ?? undefined,
    invoiceAmount: r.invoiceAmount ?? undefined,
    grnDate: r.grnDate ?? undefined,
    noOfBoxes: r.noOfBoxes ?? undefined,
    unitsPerBox: r.unitsPerBox ?? undefined,
    locationPrefix: r.locationPrefix ?? undefined,
    grnBatchMfg: r.grnBatchMfg ?? undefined,
    expiry: r.expiry ?? undefined,
    mfgBatch: r.mfgBatch ?? undefined,
    generatedLabels: r.generatedLabels ?? undefined,
  };
}

const WarehouseInbound = () => {
  const [activeTab, setActiveTab] = useState<'All' | 'Pending' | 'Under GRN' | 'Completed'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [grnData, setGrnData] = useState<GRNRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [selectedGRN, setSelectedGRN] = useState<GRNRecord | null>(null);
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [grnDate, setGrnDate] = useState<string>('');

  useEffect(() => {
    fetchGRNList()
      .then((list) => {
        setGrnData(list.map(mapApiToGRNRecord));
      })
      .catch(() => {
        setGrnData([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchGRNAssignableUsers()
      .then(setAssignableUsers)
      .catch(() => setAssignableUsers([]));
  }, []);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastRef.current) window.clearTimeout(toastRef.current);
    setToast({ message, type });
    toastRef.current = window.setTimeout(() => {
      setToast(null);
      toastRef.current = null;
    }, 2500);
  };

  // Update status from table dropdown (like MRN)
  const handleStatusChange = async (grnId: string, newStatus: GRNStatus) => {
    try {
      await updateGRN(grnId, { status: newStatus });
      setGrnData(prev =>
        prev.map(grn => (grn.id === grnId ? { ...grn, status: newStatus } : grn))
      );
      showToast(`Status updated to ${newStatus}.`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to update status', 'error');
    }
  };

  // Handle saving changes from modal back to dashboard
  const handleSaveChanges = (updatedGRN: GRNRecord) => {
    setGrnData(prev =>
      prev.map(grn => (grn.grnNo === updatedGRN.grnNo ? updatedGRN : grn))
    );
    setSelectedGRN(updatedGRN);
  };

  // Helper function to check if all workflow steps are completed
  const isGRNReady = (grn: GRNRecord): boolean => {
    if (!grn.workflowSteps || grn.workflowSteps.length === 0) return false;
    return WORKFLOW_STEPS_REQUIRED.every(step => grn.workflowSteps?.includes(step));
  };

  // Calculate stats
  const totalGRNs = grnData.length;
  const underGRN = grnData.filter(g => g.status === 'Under GRN').length;
  const onHold = grnData.filter(g => g.status === 'On Hold').length;
  const inTransit = grnData.filter(g => g.status === 'In Transit').length;
  const completed = grnData.filter(g => g.status === 'GRN Complete').length;

  // Filter data based on tab and search
  const filteredData = grnData.filter(grn => {
    // Tab filter
    if (activeTab === 'Pending' && grn.status !== 'Pending' && grn.status !== 'In Transit') return false;
    if (activeTab === 'Under GRN' && grn.status !== 'Under GRN') return false;
    if (activeTab === 'Completed' && grn.status !== 'GRN Complete') return false;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        grn.grnNo.toLowerCase().includes(query) ||
        grn.poNo.toLowerCase().includes(query) ||
        grn.vendor.toLowerCase().includes(query) ||
        grn.assignedTo.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const getQCStatusColor = (status: QCStatus) => {
    switch (status) {
      case 'Passed':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'In Progress':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Pending':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'Failed':
        return 'bg-rose-100 text-rose-700 border-rose-200';
    }
  };

  const getStatusColor = (status: GRNStatus) => {
    switch (status) {
      case 'GRN Complete':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Under GRN':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'In Transit':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'On Hold':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Delayed':
        return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'Pending':
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const formatCurrency = (value: number) => {
    return `₹${value.toLocaleString('en-IN')}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50/80 relative">
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <div
            className={`px-3 py-2 rounded-lg border text-sm font-medium shadow-lg ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">Inbound</h1>
          <p className="text-sm text-slate-600 mt-1">Goods receipt notes — receive, check, and complete GRNs</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/80 shadow-sm">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Total GRNs</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-800">{totalGRNs}</p>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/80 shadow-sm">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">Under GRN</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-800">{underGRN}</p>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/80 shadow-sm hidden sm:block">
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-1">On Hold</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-800">{onHold}</p>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/80 shadow-sm">
            <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-1">In Transit</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-800">{inTransit}</p>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/80 shadow-sm">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">Completed</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-800">{completed}</p>
          </div>
        </div>

        {/* Filters and search */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              {(['All', 'Pending', 'Under GRN', 'Completed'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search GRN, PO, vendor…"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">GRN No.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">PO No.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Vendor</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Items</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">PO Value</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Expected</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Received</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Assigned To</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">QC</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-slate-500">Loading GRNs…</td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-slate-500">No GRNs found</td>
                  </tr>
                ) : (
                filteredData.map((grn) => (
                  <tr
                    key={grn.id}
                    className="hover:bg-amber-50/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedGRN(grn)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedGRN(grn); } }}
                  >
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-mono font-medium text-blue-600">{grn.grnNo}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-mono text-emerald-600">{grn.poNo}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-medium text-slate-800">{grn.vendor}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        grn.type === 'RM' 
                          ? 'bg-cyan-100 text-cyan-700 border-cyan-200' 
                          : 'bg-violet-100 text-violet-700 border-violet-200'
                      }`}>
                        {grn.type}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-sm font-medium text-slate-700">{grn.items}</span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-sm font-semibold text-amber-700">{formatCurrency(grn.poValue)}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-sm text-slate-600">{formatDate(grn.expectedDate)}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {grn.receivedDate ? (
                        <span className="text-sm text-slate-600">{formatDate(grn.receivedDate)}</span>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-sm ${grn.assignedTo === 'Unassigned' ? 'text-slate-400 italic' : 'text-slate-700'}`}>
                        {grn.assignedTo}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getQCStatusColor(grn.qcStatus)}`}>
                        {grn.qcStatus}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={grn.status}
                        onChange={(e) => handleStatusChange(grn.id, e.target.value as GRNStatus)}
                        className={`text-xs font-medium rounded-lg border px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${getStatusColor(grn.status)}`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="In Transit">In Transit</option>
                        <option value="Under GRN">Under GRN</option>
                        <option value="On Hold">On Hold</option>
                        <option value="Delayed">Delayed</option>
                        <option value="GRN Complete">GRN Complete</option>
                      </select>
                    </td>
                  </tr>
                ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* GRN Detail Modal */}
        {selectedGRN && <GRNDetailModal grn={selectedGRN} onClose={() => setSelectedGRN(null)} onSaveChanges={handleSaveChanges} assignableUsers={assignableUsers} />}
      </div>
    </div>
  );
};

export default WarehouseInbound;
