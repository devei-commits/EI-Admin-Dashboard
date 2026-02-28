import React, { useState } from 'react';
import { X, User } from 'lucide-react';

interface QCReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  bmrData: {
    bmrNo: string;
    batch: string;
    product: string;
    actualYield: number;
    targetBulk: number;
    operator: string;
  };
}

interface SpecificationRow {
  parameter: string;
  method: string;
  specLimit: string;
  measured: string;
  result: 'Pass' | 'Fail' | '---';
}

const QCReviewModal: React.FC<QCReviewModalProps> = ({ isOpen, onClose, bmrData }) => {
  const [specifications, setSpecifications] = useState<SpecificationRow[]>([
    { parameter: 'pH', method: 'pH meter', specLimit: '5 - 6.5', measured: '', result: '---' },
    { parameter: 'Viscosity', method: 'Brookfield RVT', specLimit: '4000 - 8000 cP', measured: '', result: '---' },
    { parameter: 'Appearance', method: 'Visual', specLimit: 'White smooth cream', measured: '', result: '---' },
    { parameter: 'Odour', method: 'Organoleptic', specLimit: 'Characteristic', measured: '', result: '---' },
    { parameter: 'Niacinamide', method: 'HPLC', specLimit: '3.8 - 4.2 %w/w', measured: '', result: '---' },
  ]);

  const [qcRemarks, setQcRemarks] = useState('');

  const batchYield = ((bmrData.actualYield / bmrData.targetBulk) * 100).toFixed(1);

  const handleMeasuredChange = (index: number, value: string) => {
    const updated = [...specifications];
    updated[index].measured = value;
    setSpecifications(updated);
  };

  const handleApprove = () => {
    // Handle approval logic here
    console.log('BMR Approved:', { bmrData, specifications, qcRemarks });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <div className="flex items-center space-x-2">
              <User className="h-5 w-5 text-gray-500" />
              <h2 className="text-xl font-bold text-gray-900">Quality Review — BMR</h2>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {bmrData.bmrNo} · {bmrData.batch} · {bmrData.product}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Batch Yield Summary */}
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
            <div className="grid grid-cols-4 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Batch Yield</p>
                <p className="text-4xl font-bold text-green-600">{batchYield}%</p>
                <p className="text-xs text-gray-500 mt-1">Target: 95-103%</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Actual Yield</p>
                <p className="text-2xl font-bold text-gray-900">{bmrData.actualYield} kg</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Target Bulk</p>
                <p className="text-2xl font-bold text-gray-900">{bmrData.targetBulk} kg</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Operator</p>
                <p className="text-2xl font-bold text-gray-900">{bmrData.operator}</p>
              </div>
            </div>
          </div>

          {/* Product Specification Review */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Product Specification Review</h3>
            <p className="text-sm text-gray-500 mb-4">Enter measured values. All specs must pass.</p>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parameter</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Spec Limit</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Measured</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Result</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {specifications.map((spec, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{spec.parameter}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{spec.method}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{spec.specLimit}</td>
                      <td className="px-4 py-3 text-sm">
                        <input
                          type="text"
                          value={spec.measured}
                          onChange={(e) => handleMeasuredChange(index, e.target.value)}
                          placeholder="Result"
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{spec.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* QC Remarks */}
          <div>
            <label htmlFor="qc-remarks" className="block text-sm font-medium text-gray-700 mb-2">
              QC Remarks
            </label>
            <textarea
              id="qc-remarks"
              rows={4}
              value={qcRemarks}
              onChange={(e) => setQcRemarks(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter any quality control remarks..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleApprove}
            className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
          >
            Approve & Mark Completed
          </button>
        </div>
      </div>
    </div>
  );
};

export default QCReviewModal;
