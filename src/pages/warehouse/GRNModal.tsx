import { useState } from 'react';

interface GRN {
  id: string;
  grnNo: string;
  poNo: string;
  vendor: string;
  poValue: string;
  expectedDate: string;
  receivedDate: string;
  invoiceNo: string;
  invoiceAmount: string;
  status: string;
  lineItems: Array<{
    item: string;
    poQty: number;
    rcvdQty: number;
    invoiceQty: number;
    unitPrice: string;
    diff: number;
    qcStatus: string;
  }>;
}

interface GRNModalProps {
  grn: GRN;
  onClose: () => void;
}

const GRNModal = ({ grn, onClose }: GRNModalProps) => {
  const [activeStep, setActiveStep] = useState('Qty Check');

  const steps = ['PO Received', 'Qty Check', 'QC Inspection', 'Label Generation', 'Complete'];

  const currentStepIndex = steps.indexOf(activeStep);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">{grn.grnNo}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {/* Status Badges */}
          <div className="flex gap-2 mb-6">
            <span className="px-3 py-1 bg-amber-100 text-amber-700 text-sm font-medium rounded">
              Under GRN
            </span>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded">
              IN
            </span>
          </div>

          {/* Workflow Steps */}
          <div className="mb-8">
            <div className="flex items-center gap-2">
              {steps.map((step, index) => (
                <div key={step} className="flex items-center flex-1">
                  <button
                    onClick={() => setActiveStep(step)}
                    className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      index < currentStepIndex
                        ? 'bg-emerald-500 text-white'
                        : index === currentStepIndex
                          ? 'bg-amber-500 text-white'
                          : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {index < currentStepIndex ? 'Done' : index + 1}
                  </button>
                  <div
                    className={`flex-1 h-1 ml-2 ${
                      index < currentStepIndex ? 'bg-emerald-500' : 'bg-gray-200'
                    }`}
                  />
                </div>
              ))}
              <div className="shrink-0 text-right">
                <span className="text-sm font-medium text-gray-900">{activeStep}</span>
              </div>
            </div>
          </div>

          {/* PO Details */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4">PO DETAILS</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-gray-500 text-sm mb-1">GRN NO.</p>
                <p className="text-gray-900 font-medium">{grn.grnNo}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">PO NO.</p>
                <p className="text-emerald-600 font-medium">{grn.poNo}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">VENDOR</p>
                <p className="text-gray-900 font-medium">{grn.vendor}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">PO VALUE</p>
                <p className="text-gray-900 font-medium">{grn.poValue}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">EXPECTED DATE</p>
                <p className="text-gray-900 font-medium">{grn.expectedDate}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">RECEIVED DATE</p>
                <p className="text-gray-900 font-medium">{grn.receivedDate}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">INVOICE NO.</p>
                <p className="text-gray-900 font-medium">{grn.invoiceNo}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">INVOICE AMOUNT</p>
                <p className="text-gray-900 font-medium">{grn.invoiceAmount}</p>
              </div>
            </div>
          </div>

          {/* Assign GRN Team */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4">ASSIGN GRN TEAM</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-gray-600 text-sm font-medium mb-2 block">ASSIGNED TO</label>
                <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option>Ravi Kumar (WH Executive)</option>
                  <option>Other User</option>
                </select>
              </div>
              <div>
                <label className="text-gray-600 text-sm font-medium mb-2 block">GRN DATE</label>
                <input
                  type="text"
                  value="Not yet"
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              LINE ITEMS — QTY CHECK VS PO VS INVOICE
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">ITEM</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">PO QTY</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">RCVD QTY</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">INVOICE QTY</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">UNIT PRICE</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">DIFF</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">QC STATUS</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">QC BY</th>
                  </tr>
                </thead>
                <tbody>
                  {grn.lineItems.map((item, index) => (
                    <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{item.item.split(' ')[0]}</p>
                          <p className="text-gray-500 text-xs">{item.item.split(' ').slice(1).join(' ')}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-900 font-medium">{item.poQty}</td>
                      <td className="px-4 py-3 text-gray-900 font-medium">{item.rcvdQty}</td>
                      <td className="px-4 py-3 text-gray-900 font-medium">{item.invoiceQty}</td>
                      <td className="px-4 py-3 text-amber-600 font-medium">{item.unitPrice}</td>
                      <td className="px-4 py-3 font-medium">
                        <span className={item.diff < 0 ? 'text-red-600' : 'text-gray-600'}>
                          {item.diff}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          defaultValue={item.qcStatus}
                          className={`px-3 py-1 rounded text-sm font-medium border-0 ${
                            item.qcStatus === 'Hold'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          <option value="Hold">Hold</option>
                          <option value="Pass">Pass</option>
                          <option value="Reject">Reject</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          placeholder="Enter name"
                          className="px-3 py-1 border border-gray-300 rounded text-sm w-32"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-6 border-t border-gray-200">
            <button className="px-6 py-2 bg-emerald-500 text-white font-medium rounded-lg hover:bg-emerald-600 transition-colors">
              Complete GRN & Update Stock
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GRNModal;
