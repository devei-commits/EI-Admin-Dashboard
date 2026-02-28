import React, { useState } from 'react';
import { UnifiedModal } from '../../ui/UnifiedComponents';

interface SubmitBMRModalProps {
  isOpen: boolean;
  onClose: () => void;
  bmrData: {
    bmrNo: string;
    batch: string;
    product: string;
  };
}

interface MaterialConsumption {
  material: string;
  planned: number;
  actual: number;
}

const SubmitBMRModal: React.FC<SubmitBMRModalProps> = ({ isOpen, onClose, bmrData }) => {
  const [materials, setMaterials] = useState<MaterialConsumption[]>([
    { material: 'Niacinamide', planned: 24, actual: 0 },
    { material: 'Aqua Oat Extract', planned: 48, actual: 0 },
    { material: 'Emulsifying Wax NF', planned: 280, actual: 0 },
    { material: 'Fragrance Accord', planned: 16, actual: 0 },
    { material: 'Phenoxyethanol', planned: 20, actual: 0 },
    { material: 'Glycerin USP', planned: 12, actual: 0 },
  ]);

  const [actualYield, setActualYield] = useState('400');
  const [batchStartTime, setBatchStartTime] = useState('2026-02-28T08:00');
  const [batchEndTime, setBatchEndTime] = useState('2026-02-28T16:00');
  const [operatorName, setOperatorName] = useState('');
  const [productionNotes, setProductionNotes] = useState('');

  const handleActualChange = (index: number, value: string) => {
    const updated = [...materials];
    updated[index].actual = parseFloat(value) || 0;
    setMaterials(updated);
  };

  const calculateVariance = (planned: number, actual: number) => {
    return actual - planned;
  };

  const handleSubmit = () => {
    console.log('Submitting BMR:', {
      bmrData,
      materials,
      actualYield,
      batchStartTime,
      batchEndTime,
      operatorName,
      productionNotes,
    });
    onClose();
  };

  return (
    <UnifiedModal
      isOpen={isOpen}
      onClose={onClose}
      title="Submit Filled BMR — Production Details"
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
            onClick={handleSubmit}
            className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Submit to Quality Review
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-500">
        {bmrData.bmrNo} · {bmrData.batch} · {bmrData.product}
      </p>

      <div className="space-y-6">
        {/* Material Consumption Actuals */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Material Consumption Actuals</h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Material</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Planned</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actual</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variance</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {materials.map((material, index) => {
                  const variance = calculateVariance(material.planned, material.actual);
                  return (
                    <tr key={index}>
                      <td className="px-6 py-3 text-sm text-gray-900">{material.material}</td>
                      <td className="px-6 py-3 text-sm text-gray-500">{material.planned}</td>
                      <td className="px-6 py-3 text-sm">
                        <input
                          type="number"
                          value={material.actual || ''}
                          onChange={(e) => handleActualChange(index, e.target.value)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className={`px-6 py-3 text-sm font-medium ${variance < 0 ? 'text-orange-500' : variance > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                        {variance !== 0 ? (variance > 0 ? `+${variance}` : variance) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Production Details */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Production Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="actual-yield" className="block text-sm font-medium text-gray-700 mb-2">
                Actual Yield (kg)
              </label>
              <input
                type="number"
                id="actual-yield"
                value={actualYield}
                onChange={(e) => setActualYield(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="batch-start-time" className="block text-sm font-medium text-gray-700 mb-2">
                Batch Start Time
              </label>
              <input
                type="datetime-local"
                id="batch-start-time"
                value={batchStartTime}
                onChange={(e) => setBatchStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="batch-end-time" className="block text-sm font-medium text-gray-700 mb-2">
                Batch End Time
              </label>
              <input
                type="datetime-local"
                id="batch-end-time"
                value={batchEndTime}
                onChange={(e) => setBatchEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="operator-name" className="block text-sm font-medium text-gray-700 mb-2">
                Operator Name
              </label>
              <input
                type="text"
                id="operator-name"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                placeholder="Name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-4">
            <label htmlFor="production-notes" className="block text-sm font-medium text-gray-700 mb-2">
              Production Notes
            </label>
            <textarea
              id="production-notes"
              rows={4}
              value={productionNotes}
              onChange={(e) => setProductionNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter production notes..."
            />
          </div>
        </div>
      </div>
    </UnifiedModal>
  );
};

export default SubmitBMRModal;
