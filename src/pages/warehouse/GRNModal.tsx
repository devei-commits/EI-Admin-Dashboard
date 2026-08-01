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
      <div className="bg-surface rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl" role="dialog" aria-modal="true" aria-labelledby="grn-modal-title">
        {/* Header */}
        <div className="sticky top-0 bg-surface border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 id="grn-modal-title" className="text-2xl font-bold text-ink">{grn.grnNo}</h2>
          <button
            onClick={onClose}
            className="text-ink-4 hover:text-ink-2 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {/* Status Badges */}
          <div className="flex gap-2 mb-6">
            <span className="px-3 py-1 bg-warn-soft text-warn text-sm font-medium rounded">
              Under GRN
            </span>
            <span className="px-3 py-1 bg-brand-soft text-brand text-sm font-medium rounded">
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
                        ? 'bg-ok text-white'
                        : index === currentStepIndex
                          ? 'bg-brand text-white'
                          : 'bg-surface-3 text-ink-2'
                    }`}
                  >
                    {index < currentStepIndex ? 'Done' : index + 1}
                  </button>
                  <div
                    className={`flex-1 h-1 ml-2 ${
                      index < currentStepIndex ? 'bg-ok' : 'bg-surface-3'
                    }`}
                  />
                </div>
              ))}
              <div className="shrink-0 text-right">
                <span className="text-sm font-medium text-ink">{activeStep}</span>
              </div>
            </div>
          </div>

          {/* PO Details */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-ink mb-4">PO DETAILS</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-ink-3 text-sm mb-1">GRN NO.</p>
                <p className="text-ink font-medium">{grn.grnNo}</p>
              </div>
              <div>
                <p className="text-ink-3 text-sm mb-1">PO NO.</p>
                <p className="text-ok font-medium">{grn.poNo}</p>
              </div>
              <div>
                <p className="text-ink-3 text-sm mb-1">VENDOR</p>
                <p className="text-ink font-medium">{grn.vendor}</p>
              </div>
              <div>
                <p className="text-ink-3 text-sm mb-1">PO VALUE</p>
                <p className="text-ink font-medium">{grn.poValue}</p>
              </div>
              <div>
                <p className="text-ink-3 text-sm mb-1">EXPECTED DATE</p>
                <p className="text-ink font-medium">{grn.expectedDate}</p>
              </div>
              <div>
                <p className="text-ink-3 text-sm mb-1">RECEIVED DATE</p>
                <p className="text-ink font-medium">{grn.receivedDate}</p>
              </div>
              <div>
                <p className="text-ink-3 text-sm mb-1">INVOICE NO.</p>
                <p className="text-ink font-medium">{grn.invoiceNo}</p>
              </div>
              <div>
                <p className="text-ink-3 text-sm mb-1">INVOICE AMOUNT</p>
                <p className="text-ink font-medium">{grn.invoiceAmount}</p>
              </div>
            </div>
          </div>

          {/* Assign GRN Team */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-ink mb-4">ASSIGN GRN TEAM</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-ink-2 text-sm font-medium mb-2 block">ASSIGNED TO</label>
                <select aria-label="Assigned to" className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ok">
                  <option>Ravi Kumar (WH Executive)</option>
                  <option>Other User</option>
                </select>
              </div>
              <div>
                <label className="text-ink-2 text-sm font-medium mb-2 block">GRN DATE</label>
                <input
                  type="text"
                  value="Not yet"
                  aria-label="GRN date"
                  disabled
                  className="w-full px-4 py-2 border border-border rounded-lg bg-surface-2 text-ink-2"
                />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-ink mb-4">
              LINE ITEMS — QTY CHECK VS PO VS INVOICE
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="text-left px-4 py-3 text-ink-2 font-medium">ITEM</th>
                    <th scope="col" className="text-left px-4 py-3 text-ink-2 font-medium">PO QTY</th>
                    <th scope="col" className="text-left px-4 py-3 text-ink-2 font-medium">RCVD QTY</th>
                    <th scope="col" className="text-left px-4 py-3 text-ink-2 font-medium">INVOICE QTY</th>
                    <th scope="col" className="text-left px-4 py-3 text-ink-2 font-medium">UNIT PRICE</th>
                    <th scope="col" className="text-left px-4 py-3 text-ink-2 font-medium">DIFF</th>
                    <th scope="col" className="text-left px-4 py-3 text-ink-2 font-medium">QC STATUS</th>
                    <th scope="col" className="text-left px-4 py-3 text-ink-2 font-medium">QC BY</th>
                  </tr>
                </thead>
                <tbody>
                  {grn.lineItems.map((item, index) => (
                    <tr key={index} className="border-b border-border hover:bg-surface-2">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-ink">{item.item.split(' ')[0]}</p>
                          <p className="text-ink-3 text-xs">{item.item.split(' ').slice(1).join(' ')}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-ink font-medium">{item.poQty}</td>
                      <td className="px-4 py-3 text-ink font-medium">{item.rcvdQty}</td>
                      <td className="px-4 py-3 text-ink font-medium">{item.invoiceQty}</td>
                      <td className="px-4 py-3 text-brand font-medium">{item.unitPrice}</td>
                      <td className="px-4 py-3 font-medium">
                        <span className={item.diff < 0 ? 'text-err' : 'text-ink-2'}>
                          {item.diff}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          defaultValue={item.qcStatus}
                          aria-label="QC status"
                          className={`px-3 py-1 rounded text-sm font-medium border-0 ${
                            item.qcStatus === 'Hold'
                              ? 'bg-err-soft text-err'
                              : 'bg-ok-soft text-ok'
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
                          aria-label="Enter name"
                          className="px-3 py-1 border border-border rounded text-sm w-32"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-6 border-t border-border">
            <button className="px-6 py-2 bg-ok text-white font-medium rounded-lg hover:bg-ok-press transition-colors">
              Complete GRN & Update Stock
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 border border-border text-ink-2 font-medium rounded-lg hover:bg-surface-2 transition-colors"
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
