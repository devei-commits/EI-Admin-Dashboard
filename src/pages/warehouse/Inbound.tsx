import { useState } from 'react';
import { Search, X } from 'lucide-react';

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
  diff: number;
  qcStatus: 'Pass' | 'Hold' | 'Pending';
  qcBy: string;
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
}

const mockGRNData: GRNRecord[] = [
  {
    id: '1',
    grnNo: 'EI-GRN-2025-001',
    poNo: 'EI-PO-2025-001',
    vendor: 'Chemspec India Pvt Ltd',
    type: 'RM',
    items: 5,
    poValue: 312400,
    expectedDate: '2025-11-20',
    receivedDate: '2025-11-19',
    assignedTo: 'Karan Nair (WH Supervisor)',
    qcStatus: 'Passed',
    status: 'GRN Complete',
    invoiceNo: 'CHEM-INV-2025-1112',
    invoiceAmount: 312400,
    grnDate: '2025-11-20',
    workflowSteps: ['PO Received', 'Qty Check', 'QC Inspection', 'Label Generation', 'Dispatch Ready'],
    lineItems: [
      {
        id: 'l1',
        item: 'Homosalate',
        itemCode: 'EI-RM-UV-001',
        poQty: 60,
        rcvdQty: 60,
        invoiceQty: 60,
        unitPrice: 520,
        diff: 0,
        qcStatus: 'Pass',
        qcBy: 'Meera QC',
      },
      {
        id: 'l2',
        item: 'Octinoxate',
        itemCode: 'EI-RM-UV-002',
        poQty: 50,
        rcvdQty: 50,
        invoiceQty: 50,
        unitPrice: 600,
        diff: 0,
        qcStatus: 'Pass',
        qcBy: 'Meera QC',
      },
      {
        id: 'l3',
        item: 'Octocrylene',
        itemCode: 'EI-RM-UV-003',
        poQty: 80,
        rcvdQty: 80,
        invoiceQty: 80,
        unitPrice: 590,
        diff: 0,
        qcStatus: 'Pass',
        qcBy: 'Meera QC',
      },
    ],
  },
  {
    id: '2',
    grnNo: 'EI-GRN-2025-002',
    poNo: 'EI-PO-2025-002',
    vendor: 'Chemspec India',
    type: 'RM',
    items: 4,
    poValue: 185600,
    expectedDate: '2025-11-22',
    receivedDate: '2025-11-21',
    assignedTo: 'Ravi Kumar',
    qcStatus: 'In Progress',
    status: 'Under GRN',
    invoiceNo: 'CHEM-INV-2025-1115',
    invoiceAmount: 185200,
    grnDate: '2025-11-22',
    workflowSteps: ['PO Received', 'Qty Check', 'QC Inspection', 'Label Generation'],
    lineItems: [
      {
        id: 'l4',
        item: 'SLES 70%',
        itemCode: 'EI-RMS-SLES-002',
        poQty: 150,
        rcvdQty: 148,
        invoiceQty: 150,
        unitPrice: 125,
        diff: -2,
        qcStatus: 'Hold',
        qcBy: 'Meera QC',
      },
      {
        id: 'l5',
        item: 'CAPB 35%',
        itemCode: 'EI-RMS-CAPB-002',
        poQty: 80,
        rcvdQty: 80,
        invoiceQty: 80,
        unitPrice: 195,
        diff: 0,
        qcStatus: 'Pass',
        qcBy: 'Meera QC',
      },
      {
        id: 'l6',
        item: 'SCI',
        itemCode: 'EI-RMS-SCI-001',
        poQty: 100,
        rcvdQty: 100,
        invoiceQty: 100,
        unitPrice: 250,
        diff: 0,
        qcStatus: 'Hold',
        qcBy: 'Pending',
      },
    ],
  },
  {
    id: '3',
    grnNo: 'EI-GRN-2025-003',
    poNo: 'EI-PO-2025-003',
    vendor: 'Packwell Industries',
    type: 'PM',
    items: 3,
    poValue: 79250,
    expectedDate: '2025-11-25',
    receivedDate: '2025-11-24',
    assignedTo: 'Santosh Kumar',
    qcStatus: 'Passed',
    status: 'GRN Complete',
    invoiceNo: 'PKW-INV-2025-1118',
    invoiceAmount: 79250,
    grnDate: '2025-11-25',
    workflowSteps: ['PO Received', 'Qty Check', 'QC Inspection', 'Label Generation', 'Dispatch Ready'],
    lineItems: [
      {
        id: 'l7',
        item: 'HDPE Bottles 100ml',
        itemCode: 'EI-PKG-HDPE-100',
        poQty: 5000,
        rcvdQty: 5000,
        invoiceQty: 5000,
        unitPrice: 8,
        diff: 0,
        qcStatus: 'Pass',
        qcBy: 'Ravi QC',
      },
      {
        id: 'l8',
        item: 'Caps & Closures',
        itemCode: 'EI-PKG-CAPS-20',
        poQty: 5000,
        rcvdQty: 5000,
        invoiceQty: 5000,
        unitPrice: 2,
        diff: 0,
        qcStatus: 'Pass',
        qcBy: 'Ravi QC',
      },
      {
        id: 'l9',
        item: 'Labels 100x50',
        itemCode: 'EI-PKG-LBL-100',
        poQty: 10000,
        rcvdQty: 10000,
        invoiceQty: 10000,
        unitPrice: 1.5,
        diff: 0,
        qcStatus: 'Pass',
        qcBy: 'Ravi QC',
      },
    ],
  },
  {
    id: '4',
    grnNo: 'EI-GRN-2025-004',
    poNo: 'EI-PO-2025-004',
    vendor: 'Packwell Industries',
    type: 'PM',
    items: 4,
    poValue: 125600,
    expectedDate: '2025-11-28',
    receivedDate: null,
    assignedTo: 'Unassigned',
    qcStatus: 'Pending',
    status: 'In Transit',
    lineItems: [
      {
        id: 'l10',
        item: 'PET Bottles 500ml',
        itemCode: 'EI-PKG-PET-500',
        poQty: 2000,
        rcvdQty: 0,
        invoiceQty: 0,
        unitPrice: 15,
        diff: 0,
        qcStatus: 'Pending',
        qcBy: 'Pending',
      },
      {
        id: 'l11',
        item: 'Carton Boxes',
        itemCode: 'EI-PKG-CART-50',
        poQty: 500,
        rcvdQty: 0,
        invoiceQty: 0,
        unitPrice: 25,
        diff: 0,
        qcStatus: 'Pending',
        qcBy: 'Pending',
      },
      {
        id: 'l12',
        item: 'Tape & Accessories',
        itemCode: 'EI-PKG-TAPE-KIT',
        poQty: 100,
        rcvdQty: 0,
        invoiceQty: 0,
        unitPrice: 50,
        diff: 0,
        qcStatus: 'Pending',
        qcBy: 'Pending',
      },
      {
        id: 'l13',
        item: 'Bubble Wrap (Roll)',
        itemCode: 'EI-PKG-BUBBLE-10',
        poQty: 50,
        rcvdQty: 0,
        invoiceQty: 0,
        unitPrice: 200,
        diff: 0,
        qcStatus: 'Pending',
        qcBy: 'Pending',
      },
    ],
  },
];

// GRN Detail Modal Component
const GRNDetailModal = ({ grn, onClose, onSaveChanges }: { grn: GRNRecord; onClose: () => void; onSaveChanges: (updatedGRN: GRNRecord) => void }) => {
  const [assignedTo, setAssignedTo] = useState(grn.assignedTo || '');
  const [grnDate, setGrnDate] = useState(grn.grnDate || new Date().toISOString().split('T')[0]);
  const [editedLineItems, setEditedLineItems] = useState<LineItem[]>(grn.lineItems || []);
  const [labelsGenerated, setLabelsGenerated] = useState(false);

  const handleLineItemChange = (itemId: string, field: 'rcvdQty' | 'qcStatus', value: string | number) => {
    setEditedLineItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? { ...item, [field === 'rcvdQty' ? 'rcvdQty' : 'qcStatus']: field === 'rcvdQty' ? parseInt(value as string) || 0 : value }
          : item
      )
    );
  };

  const allQCPassed = editedLineItems.length > 0 && editedLineItems.every(item => item.qcStatus === 'Pass');

  const handleCompleteGRN = () => {
    if (!allQCPassed) {
      alert('⚠️ All items must have QC Status "Pass" before completing GRN. Please review the QC status of all line items.');
      return;
    }
    // Update parent state with changes, status, and QC status
    const updatedGRN = { 
      ...grn, 
      assignedTo, 
      grnDate, 
      lineItems: editedLineItems,
      status: 'GRN Complete' as GRNStatus,
      qcStatus: 'Passed' as QCStatus
    };
    onSaveChanges(updatedGRN);
    alert('✓ GRN completed successfully!');
    onClose();
  };

  const getWorkflowStepColor = (step: WorkflowStep) => {
    if (!grn.workflowSteps) return 'bg-slate-100 text-slate-600 border-slate-300';
    
    const stepIndex = WORKFLOW_STEPS_REQUIRED.indexOf(step);
    const completedUpTo = WORKFLOW_STEPS_REQUIRED.findIndex(s => !grn.workflowSteps?.includes(s));
    
    if (grn.workflowSteps.includes(step)) {
      return 'bg-emerald-100 text-emerald-700 border-emerald-300';
    } else if (completedUpTo === stepIndex) {
      return 'bg-amber-100 text-amber-700 border-amber-300';
    }
    return 'bg-slate-100 text-slate-600 border-slate-300';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">GRN — {grn.grnNo}</h2>
            <p className="text-xs text-slate-600 mt-1">{grn.vendor}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
              grn.workflowSteps?.length === WORKFLOW_STEPS_REQUIRED.length
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
          {grn.workflowSteps && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {WORKFLOW_STEPS_REQUIRED.map((step, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${getWorkflowStepColor(step)}`}
                  >
                    {grn.workflowSteps?.includes(step) ? '✓' : '○'} {step}
                  </div>
                  {idx < WORKFLOW_STEPS_REQUIRED.length - 1 && (
                    <span className="text-slate-400 text-lg">→</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* PO Details Section */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 pb-2 border-b border-slate-200">
              PO Details
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
          </div>

          {/* Assign GRN Team Section */}
          <div className="bg-slate-50 rounded-lg p-5 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">
              Assign GRN Team
            </h3>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Assigned To
                </label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={grn.assignedTo}>{grn.assignedTo}</option>
                  <option value="Karan Nair (WH Supervisor)">Karan Nair (WH Supervisor)</option>
                  <option value="Ravi Kumar">Ravi Kumar</option>
                  <option value="Santosh Kumar (WH Executive)">Santosh Kumar (WH Executive)</option>
                  <option value="Anand Store">Anand Store</option>
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
          </div>

          {/* Line Items Table */}
          {grn.lineItems && grn.lineItems.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 pb-2 border-b border-slate-200">
                Line Items — Qty Check vs PO vs Invoice
              </h3>
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
                            const calculatedDiff = item.rcvdQty - item.poQty;
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
            </div>
          )}

          {/* Generate QRN Labels Section */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 pb-2 border-b border-slate-200">
              Generate QRN Labels
            </h3>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <p className="text-xs text-slate-600 mb-4">Labels will be generated per item per batch received.</p>
              {!labelsGenerated ? (
                <button
                  onClick={() => setLabelsGenerated(true)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 transition-colors"
                >
                  ✓ Generate Labels
                </button>
              ) : (
                <button
                  onClick={() => setLabelsGenerated(false)}
                  className="px-4 py-2 bg-slate-400 text-white rounded-lg font-medium text-sm hover:bg-slate-500 transition-colors"
                >
                  Hide Labels
                </button>
              )}
            </div>
          </div>

          {/* Label Preview Section */}
          {labelsGenerated && editedLineItems.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 pb-2 border-b border-slate-200">
                Label Preview — Print per Batch
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {editedLineItems.map((item) => (
                  <div key={item.id} className="bg-white border-2 border-slate-300 rounded-lg p-5 shadow-sm">
                    <div className="text-center mb-4">
                      <p className="text-xs font-mono font-bold text-slate-900">EI WAREHOUSE — INBOUND LABEL</p>
                    </div>
                    <div className="space-y-2 text-xs mb-4">
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-700">Item</span>
                        <span className="text-slate-900 font-mono">{item.itemCode}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-700">Name</span>
                        <span className="text-slate-900">{item.item}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-700">GRN</span>
                        <span className="text-slate-900 font-mono">{grn.grnNo}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-700">PO</span>
                        <span className="text-slate-900 font-mono">{grn.poNo}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-700">Vendor</span>
                        <span className="text-slate-900">{grn.vendor}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-700">Rcvd Qty</span>
                        <span className="text-slate-900 font-mono">{item.rcvdQty} RM</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-700">Date</span>
                        <span className="text-slate-900 font-mono">{new Date(grnDate).toLocaleDateString('en-IN', { year: '2-digit', month: 'numeric', day: 'numeric' })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-700">QC</span>
                        <span className={`font-semibold ${
                          item.qcStatus === 'Pass' ? 'text-emerald-600' : item.qcStatus === 'Hold' ? 'text-amber-600' : 'text-slate-600'
                        }`}>
                          {item.qcStatus}
                        </span>
                      </div>
                    </div>
                    {/* Barcode */}
                    <div className="flex justify-center gap-1 pt-2 border-t border-slate-200">
                      {Array.from({ length: 15 }).map((_, i) => (
                        <div key={i} className={`h-8 w-1 ${i % 3 === 0 ? 'bg-slate-800' : 'bg-slate-400'}`} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-600 mt-4">GRN pending - qty mismatch on Bill of Lading</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-800 font-medium text-sm hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleCompleteGRN}
              disabled={!allQCPassed && grn.status === 'In Transit'}
              className={`px-4 py-2 text-white rounded-lg font-medium text-sm transition-colors ${
                grn.status === 'In Transit'
                  ? allQCPassed
                    ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                    : 'bg-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {grn.status === 'In Transit' ? '✓ Complete GRN & Initiate Stock' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const WarehouseInbound = () => {
  const [activeTab, setActiveTab] = useState<'All' | 'Pending' | 'Under GRN' | 'Completed'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [grnData, setGrnData] = useState<GRNRecord[]>(mockGRNData);
  const [selectedGRN, setSelectedGRN] = useState<GRNRecord | null>(null);
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [grnDate, setGrnDate] = useState<string>('');

  // Handle saving changes from modal back to dashboard
  const handleSaveChanges = (updatedGRN: GRNRecord) => {
    setGrnData(prev =>
      prev.map(grn => (grn.grnNo === updatedGRN.grnNo ? updatedGRN : grn))
    );
    // Update selectedGRN to reflect changes in modal
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
    <div className="flex-1 overflow-auto p-6 bg-slate-50">
      <div className="max-w-400 mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Inbound GRN Tracker</h1>
          <p className="text-sm text-slate-600 mt-1">Monitor and manage goods receipt notes</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-linear-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200 shadow-sm">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">Total GRNs</p>
            <p className="text-4xl font-bold text-blue-900">{totalGRNs}</p>
          </div>

          <div className="bg-linear-to-br from-amber-50 to-amber-100 rounded-xl p-5 border border-amber-200 shadow-sm">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Under GRN</p>
            <p className="text-4xl font-bold text-amber-900">{underGRN}</p>
          </div>

          <div className="bg-linear-to-br from-orange-50 to-orange-100 rounded-xl p-5 border border-orange-200 shadow-sm">
            <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider mb-1">On Hold</p>
            <p className="text-4xl font-bold text-orange-900">{onHold}</p>
          </div>

          <div className="bg-linear-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200 shadow-sm">
            <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-1">In Transit</p>
            <p className="text-4xl font-bold text-purple-900">{inTransit}</p>
          </div>

          <div className="bg-linear-to-br from-emerald-50 to-emerald-100 rounded-xl p-5 border border-emerald-200 shadow-sm">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1">Completed</p>
            <p className="text-4xl font-bold text-emerald-900">{completed}</p>
          </div>
        </div>

        {/* Navigation and Search */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Tabs */}
            <div className="flex items-center gap-2">
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
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search GRN, PO, vendor..."
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full lg:w-80"
              />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-linear-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">GRN No.</th>
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
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((grn) => (
                  <tr key={grn.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-4 py-4">
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
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(grn.status)}`}>
                        {grn.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedGRN(grn)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          View
                        </button>
                        {grn.status === 'Under GRN' && (
                          <button
                            onClick={() => setSelectedGRN(grn)}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all shadow-sm"
                          >
                            Process →
                          </button>
                        )}
                        {grn.status === 'In Transit' && (
                          <button
                            onClick={() => setSelectedGRN(grn)}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-all shadow-sm"
                          >
                            Start GRN
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-4 py-12 text-center text-sm text-slate-500">
                      No GRN records found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* GRN Detail Modal */}
        {selectedGRN && <GRNDetailModal grn={selectedGRN} onClose={() => setSelectedGRN(null)} onSaveChanges={handleSaveChanges} />}
      </div>
    </div>
  );
};

export default WarehouseInbound;
