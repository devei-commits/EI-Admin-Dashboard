import React, { useState } from 'react';
import QCReviewModal from './modals/QCReviewModal';

const mockQcReviewData = [
    {
        id: 'qc1',
        bmrNo: 'BMR-01004',
        batch: 'SO-03079-B01',
        product: 'Anti-Itch Lotion 100g (100g Tube)',
        units: 4000,
        bulk: 400,
        notes: 'Slight viscosity variation noted, within spec',
        actualYield: 398,
        targetBulk: 400,
        operator: 'Suresh K.',
    }
];

const QCReview = () => {
  const [selectedBMR, setSelectedBMR] = useState<typeof mockQcReviewData[0] | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleQCReview = (item: typeof mockQcReviewData[0]) => {
    setSelectedBMR(item);
    setIsModalOpen(true);
  };

  return (
    <>
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="mb-4">
          <p className="text-sm text-gray-600">Quality team reviews product specifications and confirms batch yield.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['BMR', 'Batch', 'Product', 'Units', 'Bulk', 'Notes', 'Action'].map(header => (
                  <th key={header} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mockQcReviewData.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">{item.bmrNo}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.batch}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.product}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.units.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.bulk} kg</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.notes}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button 
                      onClick={() => handleQCReview(item)}
                      className="px-3 py-1 text-sm font-medium text-white bg-orange-500 rounded-md hover:bg-orange-600"
                    >
                      QC Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedBMR && (
        <QCReviewModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          bmrData={{
            bmrNo: selectedBMR.bmrNo,
            batch: selectedBMR.batch,
            product: selectedBMR.product,
            actualYield: selectedBMR.actualYield,
            targetBulk: selectedBMR.targetBulk,
            operator: selectedBMR.operator,
          }}
        />
      )}
    </>
  );
};

export default QCReview;
