import React, { useState } from 'react';
import { UnifiedModal } from '../../ui/UnifiedComponents';

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
    console.log('BMR Approved:', { bmrData, specifications, qcRemarks });
    onClose();
  };

  return (
    <UnifiedModal
      isOpen={isOpen}
      onClose={onClose}
      title="Quality Review — BMR"
      size="lg"
      footer={
        <>
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
        </>
      }
    >
      <p className="text-sm text-gray-500">
        {bmrData.bmrNo} · {bmrData.batch} · {bmrData.product}
      </p>

      <div className="space-y-6">
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
    </UnifiedModal>
  );
};

export default QCReviewModal;
