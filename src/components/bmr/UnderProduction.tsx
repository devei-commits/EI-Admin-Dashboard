import React, { useState } from 'react';
import SubmitBMRModal from './modals/SubmitBMRModal';
import type { ProducingBatch } from '../../types/bmr.types';

interface UnderProductionProps {
  producingBatches: ProducingBatch[];
}

const mockUnderProductionData = [
    {
        id: 'up1',
        bmrNo: 'BMR-01003',
        batch: 'SO-03088-B01',
        product: 'Sunscreen Gel SPF50 50g',
        units: 8000,
        bulkKg: 400,
        schedule: '2026-02-26',
        tankArea: 'TANK-02 / AREA-1',
        progress: 65,
        status: 'Under Production' as const,
    }
];

const UnderProduction: React.FC<UnderProductionProps> = ({ producingBatches = [] }) => {
  const [selectedBMR, setSelectedBMR] = useState<ProducingBatch | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSubmitBMR = (item: ProducingBatch) => {
    setSelectedBMR(item);
    setIsModalOpen(true);
  };

  // Combine mock data with actual producing batches
  const allBatches = [...mockUnderProductionData, ...producingBatches];

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'Dispensed':
        return 'bg-purple-200 text-purple-800';
      case 'Under Production':
        return 'bg-blue-200 text-blue-800';
      case 'Completed':
        return 'bg-green-200 text-green-800';
      default:
        return 'bg-gray-200 text-gray-800';
    }
  };

  return (
    <>
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="mb-4">
          <p className="text-sm text-gray-600">Production team fills physical BMR Sheet and submits yield + batch data below.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['BMR', 'Batch', 'Product', 'Units', 'Bulk', 'Schedule', 'Tank/Area', 'Progress', 'Stage', 'Action'].map(header => (
                  <th key={header} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {allBatches.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">{item.bmrNo}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.batch}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.product}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.units.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.bulkKg} kg</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.schedule}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.tankArea}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className="bg-green-600 h-2.5 rounded-full" style={{ width: `${item.progress}%` }}></div>
                      </div>
                      <span className="ml-2">{item.progress}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeStyle(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button 
                      onClick={() => handleSubmitBMR(item)}
                      className="px-3 py-1 text-sm font-medium text-white bg-orange-500 rounded-md hover:bg-orange-600"
                    >
                      Submit BMR
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedBMR && (
        <SubmitBMRModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          bmrData={{
            bmrNo: selectedBMR.bmrNo,
            batch: selectedBMR.batch,
            product: selectedBMR.product,
          }}
        />
      )}
    </>
  );
};

export default UnderProduction;
