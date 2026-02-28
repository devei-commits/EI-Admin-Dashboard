import React, { useState } from 'react';
import { CheckSquare, ArrowRight } from 'lucide-react';
import MaterialRequestModal from './MaterialRequestModal';

const mockMaterialSourcingData = [
  {
    id: 'ms1',
    bmrNo: 'BMR-01002',
    batch: 'SO-03074-B02',
    product: 'Anti-Acne Facewash 100g',
    scheduleDate: '2026-03-02',
    tank: 'TANK-01',
    area: 'AREA-1',
    materialStatus: {
      overall: '5/6',
      factory: '3/6',
    },
    transferRequest: 'No request yet',
    materials: [
      { item: 'Niacinamide', code: 'RM-AC-001', totalRequired: 42, unit: 'kg', atFactory: 0, freeAtWH: 50, whStock: 160 },
      { item: 'Aqua Oat Extract', code: 'RM-BS-014', totalRequired: 84, unit: 'kg', atFactory: 0, freeAtWH: 160, whStock: 420 },
      { item: 'Emulsifying Wax NF', code: 'RM-EM-003', totalRequired: 490, unit: 'kg', atFactory: 0, freeAtWH: 440, whStock: 470 },
      { item: 'Fragrance Accord', code: 'RM-FR-007', totalRequired: 28, unit: 'kg', atFactory: 0, freeAtWH: 8, whStock: 12 },
      { item: 'Phenoxyethanol', code: 'RM-PR-011', totalRequired: 35, unit: 'kg', atFactory: 0, freeAtWH: 20, whStock: 30 },
      { item: 'Glycerin USP', code: 'RM-GL-002', totalRequired: 21, unit: 'kg', atFactory: 0, freeAtWH: 120, whStock: 200 },
    ],
  },
];

interface MaterialSourcingProps {
  onMaterialRequestSubmit?: (data: {
    bmrNo: string;
    factory: string;
    requiredBy: string;
    materials: any[];
  }) => void;
}

const MaterialSourcing: React.FC<MaterialSourcingProps> = ({ onMaterialRequestSubmit }) => {
  const [selectedBMRs, setSelectedBMRs] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [consolidatedData, setConsolidatedData] = useState<any>(null);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedBMRs(mockMaterialSourcingData.map(item => item.id));
    } else {
      setSelectedBMRs([]);
    }
  };

  const handleSelectBMR = (id: string) => {
    setSelectedBMRs(prev => 
      prev.includes(id) ? prev.filter(bmrId => bmrId !== id) : [...prev, id]
    );
  };

  const handleConsolidateRequest = () => {
    if (selectedBMRs.length === 0) return;

    // Get selected BMR items
    const selected = mockMaterialSourcingData.filter(item => selectedBMRs.includes(item.id));
    
    // Consolidate materials from all selected BMRs
    const materialMap = new Map();
    
    selected.forEach(bmr => {
      bmr.materials.forEach(material => {
        const key = material.code;
        if (materialMap.has(key)) {
          const existing = materialMap.get(key);
          existing.totalRequired += material.totalRequired;
          existing.atFactory += material.atFactory;
        } else {
          materialMap.set(key, { ...material });
        }
      });
    });

    // Convert map to array and calculate toTransfer
    const consolidatedMaterials = Array.from(materialMap.values()).map(mat => ({
      item: mat.item,
      code: mat.code,
      totalRequired: `${mat.totalRequired} ${mat.unit}`,
      atFactory: `${mat.atFactory} ${mat.unit}`,
      freeAtWH: mat.freeAtWH,
      toTransfer: Math.max(0, mat.totalRequired - mat.atFactory),
      whStock: mat.whStock,
    }));

    setConsolidatedData({
      bmrNo: selected.length === 1 ? selected[0].bmrNo : `${selected.length} BMRs Selected`,
      factory: selected[0].area,
      requiredBy: '2026-03-01',
      materials: consolidatedMaterials,
    });

    setIsModalOpen(true);
  };

  const handleRequestMaterial = (item: typeof mockMaterialSourcingData[0]) => {
    // Calculate toTransfer for individual request
    const materials = item.materials.map(mat => ({
      item: mat.item,
      code: mat.code,
      totalRequired: `${mat.totalRequired} ${mat.unit}`,
      atFactory: `${mat.atFactory} ${mat.unit}`,
      freeAtWH: mat.freeAtWH,
      toTransfer: Math.max(0, mat.totalRequired - mat.atFactory),
      whStock: mat.whStock,
    }));

    setConsolidatedData({
      bmrNo: item.bmrNo,
      factory: item.area,
      requiredBy: '2026-03-01',
      materials,
    });

    setIsModalOpen(true);
  };

  return (
    <>
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="bg-gray-100 p-3 rounded-md mb-4 flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex items-center text-blue-600 font-semibold">
              <CheckSquare className="mr-2" />
              Consolidated Material Request
            </div>
            <div className="ml-6 text-sm text-gray-600 flex items-center space-x-2">
              <span>Select All</span>
              <span>—</span>
              <span>Check BMRs</span>
              <ArrowRight size={16} />
              <span>Request</span>
              <ArrowRight size={16} />
              <span>Warehouse to pick & transfer</span>
            </div>
          </div>
          <button
            onClick={handleConsolidateRequest}
            disabled={selectedBMRs.length === 0}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              selectedBMRs.length > 0
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Consolidate Material Request {selectedBMRs.length > 0 && `(${selectedBMRs.length})`}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left">
                  <input 
                    type="checkbox" 
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    checked={selectedBMRs.length === mockMaterialSourcingData.length && mockMaterialSourcingData.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                {['BMR No', 'Batch', 'Product', 'Schedule Date', 'Tank', 'Area', 'Material Status', 'Transfer Request', 'Actions'].map(header => (
                  <th key={header} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mockMaterialSourcingData.map((item) => (
                <tr key={item.id} className={selectedBMRs.includes(item.id) ? 'bg-blue-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input 
                      type="checkbox" 
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      checked={selectedBMRs.includes(item.id)}
                      onChange={() => handleSelectBMR(item.id)}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">{item.bmrNo}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.batch}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.product}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.scheduleDate}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.tank}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.area}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="text-orange-500">{item.materialStatus.overall} overall</div>
                    <div className="text-orange-500">{item.materialStatus.factory} @ factory</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.transferRequest}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button className="px-3 py-1 text-sm font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50">View BOM</button>
                    <button 
                      onClick={() => handleRequestMaterial(item)}
                      className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                      Request Material
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {consolidatedData && (
        <MaterialRequestModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setConsolidatedData(null);
            setSelectedBMRs([]);
          }}
          bmrData={consolidatedData}
          onSubmit={onMaterialRequestSubmit}
        />
      )}
    </>
  );
};

export default MaterialSourcing;
