import React, { useState, useEffect } from 'react';
import { UnifiedModal } from '../../ui/UnifiedComponents';

interface MaterialRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  bmrData: {
    bmrNo: string;
    factory: string;
    requiredBy: string;
    materials?: MaterialItem[];
  };
  onSubmit?: (data: {
    bmrNo: string;
    factory: string;
    requiredBy: string;
    materials: any[];
  }) => void;
}

interface MaterialItem {
  item: string;
  code: string;
  totalRequired: string;
  atFactory: string;
  freeAtWH: number;
  toTransfer: number;
  whStock: number;
}

const MaterialRequestModal: React.FC<MaterialRequestModalProps> = ({ isOpen, onClose, bmrData, onSubmit }) => {
  const defaultMaterials: MaterialItem[] = [
    { item: 'Niacinamide', code: 'RM-AC-001', totalRequired: '42 kg', atFactory: '0 kg', freeAtWH: 50, toTransfer: 0, whStock: 160 },
    { item: 'Aqua Oat Extract', code: 'RM-BS-014', totalRequired: '84 kg', atFactory: '0 kg', freeAtWH: 160, toTransfer: 0, whStock: 420 },
    { item: 'Emulsifying Wax NF', code: 'RM-EM-003', totalRequired: '490 kg', atFactory: '0 kg', freeAtWH: 440, toTransfer: 50, whStock: 470 },
    { item: 'Fragrance Accord', code: 'RM-FR-007', totalRequired: '28 kg', atFactory: '0 kg', freeAtWH: 8, toTransfer: 20, whStock: 12 },
    { item: 'Phenoxyethanol', code: 'RM-PR-011', totalRequired: '35 kg', atFactory: '0 kg', freeAtWH: 20, toTransfer: 15, whStock: 30 },
    { item: 'Glycerin USP', code: 'RM-GL-002', totalRequired: '21 kg', atFactory: '0 kg', freeAtWH: 120, toTransfer: 0, whStock: 200 },
  ];

  const [materials, setMaterials] = useState<MaterialItem[]>(bmrData.materials || defaultMaterials);

  useEffect(() => {
    if (bmrData.materials) {
      setMaterials(bmrData.materials);
    }
  }, [bmrData.materials]);

  const handleToTransferChange = (index: number, value: string) => {
    const updated = [...materials];
    updated[index].toTransfer = parseInt(value) || 0;
    setMaterials(updated);
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit({
        bmrNo: bmrData.bmrNo,
        factory: bmrData.factory,
        requiredBy: bmrData.requiredBy,
        materials,
      });
    }
    onClose();
  };

  return (
    <UnifiedModal
      isOpen={isOpen}
      onClose={onClose}
      title="Material Request to Warehouse"
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
            Submit Request to Warehouse
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-500">{bmrData.bmrNo}</p>

      <div className="space-y-4">
        {/* Factory and Required By */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Factory:</label>
            <input
              type="text"
              value={bmrData.factory}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Required by:</label>
            <input
              type="date"
              value={bmrData.requiredBy}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
            />
          </div>
        </div>

        {/* Materials Table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Required</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">At Factory</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Free at WH</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To Transfer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">WH Stock</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {materials.map((material, index) => (
                <tr key={index}>
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-gray-900">{material.item}</div>
                    <div className="text-xs text-gray-500">{material.code}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{material.totalRequired}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{material.atFactory}</td>
                  <td className={`px-4 py-3 text-sm font-medium ${material.freeAtWH > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {material.freeAtWH}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <input
                      type="number"
                      value={material.toTransfer || ''}
                      onChange={(e) => handleToTransferChange(index, e.target.value)}
                      className={`w-20 px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        material.toTransfer > 0 ? 'border-red-500 text-red-600' : 'border-gray-300'
                      }`}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{material.whStock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </UnifiedModal>
  );
};

export default MaterialRequestModal;
