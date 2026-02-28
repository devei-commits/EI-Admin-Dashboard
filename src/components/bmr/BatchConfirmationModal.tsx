import React, { useState } from 'react';
import { X, AlertCircle, AlertTriangle, ChevronRight } from 'lucide-react';
import UpdateStockModal from './UpdateStockModal';
import ScheduleBMRModal from './ScheduleBMRModal';

interface BatchConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  bmrData: {
    bmrNo: string;
    batch: string;
    product: string;
    units: number;
    bulkKg: number;
    material: string;
    mcd: string;
  };
  onConfirmBatch?: (batchSize: number) => void;
  onScheduleConfirm?: (scheduleData: { productionDate: string; manufacturingArea: string; productionTank: string }) => void;
}

interface MaterialItem {
  itemId: string;
  material: string;
  required: string;
  freeStock: number;
  incoming: number;
  status: 'Available' | 'Gap';
  gap?: number;
  cd: string;
}

const BatchConfirmationModal: React.FC<BatchConfirmationModalProps> = ({
  isOpen,
  onClose,
  bmrData,
  onConfirmBatch,
  onScheduleConfirm,
}) => {
  const [batchSize, setBatchSize] = useState(bmrData.units.toString());
  const [currentStep, setCurrentStep] = useState(1); // 1 = Pending, 2 = Confirmed, etc.
  const [selectedAction, setSelectedAction] = useState<'reserve' | 'schedule' | 'next' | null>(null);
  const [isUpdateStockModalOpen, setIsUpdateStockModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedGapMaterial, setSelectedGapMaterial] = useState<MaterialItem | null>(null);
  const [materials, setMaterials] = useState<MaterialItem[]>([
    {
      itemId: 'RM-AC-001',
      material: 'Niacinamide',
      required: '42 kg',
      freeStock: 50,
      incoming: 200,
      status: 'Available',
      cd: '2026-02-28',
    },
    {
      itemId: 'RM-BS-814',
      material: 'Aqua Oat Extract',
      required: '84 kg',
      freeStock: 160,
      incoming: 150,
      status: 'Available',
      cd: '2026-02-28',
    },
    {
      itemId: 'RM-EM-003',
      material: 'Emulsifying Wax NF',
      required: '490 kg',
      freeStock: 50,
      incoming: 50,
      status: 'Gap',
      gap: 390,
      cd: '2026-03-07',
    },
    {
      itemId: 'RM-FR-007',
      material: 'Fragrance Accord',
      required: '28 kg',
      freeStock: 20,
      incoming: 20,
      status: 'Gap',
      gap: 32,
      cd: '2026-03-07',
    },
    {
      itemId: 'RM-PR-011',
      material: 'Phenoxyethanol',
      required: '35 kg',
      freeStock: 40,
      incoming: 40,
      status: 'Gap',
      gap: 30,
      cd: '2026-03-07',
    },
    {
      itemId: 'RM-GL-002',
      material: 'Glycerin USP',
      required: '21 kg',
      freeStock: 120,
      incoming: 100,
      status: 'Available',
      cd: '2026-02-28',
    },
  ]);

  const gapCount = materials.filter(m => m.status === 'Gap').length;
  const totalGapQuantity = materials.reduce((sum, m) => sum + (m.gap || 0), 0);
  const materialsWithGaps = materials.filter(m => m.status === 'Gap');

  const handleOpenUpdateStockModal = (material: MaterialItem | null = null) => {
    if (material) {
      setSelectedGapMaterial(material);
    } else if (materialsWithGaps.length > 0) {
      setSelectedGapMaterial(materialsWithGaps[0]);
    } else {
      return;
    }
    setIsUpdateStockModalOpen(true);
  };

  const handleApplyStockUpdate = (updatedMaterial: MaterialItem) => {
    // Update the material in the list
    const updatedMaterials = materials.map(m => 
      m.itemId === updatedMaterial.itemId ? updatedMaterial : m
    );
    setMaterials(updatedMaterials);
    
    // Check if there are remaining gaps after this update
    const remainingGaps = updatedMaterials.filter(m => m.status === 'Gap');
    
    if (remainingGaps.length > 0) {
      // Automatically open the next gap material
      setSelectedGapMaterial(remainingGaps[0]);
      // Keep modal open for next gap
    } else {
      // All gaps filled, close the modal
      setIsUpdateStockModalOpen(false);
      setSelectedGapMaterial(null);
    }
  };

  const timelineSteps = [
    '1. Pending',
    '2. Confirmed',
    '3. Reserved',
    '4. Scheduled',
    '5. Material Sourced',
    '6. Dispensed',
    '7. Under Production',
    '8. Under Review',
    '9. Completed',
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Batch Manufacturing Records</h2>
            <p className="text-sm text-gray-600 mt-1">
              {bmrData.bmrNo} · {bmrData.batch}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              {bmrData.product} · Units {bmrData.units.toLocaleString()} · Bulk {bmrData.bulkKg} kg · Material {bmrData.material} · MCD {bmrData.mcd}
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
          {/* Timeline */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-2">
            {timelineSteps.map((step, index) => (
              <div key={index} className="flex items-center space-x-1.5">
                <div
                  className={`px-3 py-1 rounded-full whitespace-nowrap transition-all ${
                    index === currentStep - 1
                      ? 'bg-blue-100 text-blue-700 text-xs font-semibold'
                      : index < currentStep - 1
                      ? 'bg-green-100 text-green-700 text-xs font-medium'
                      : 'bg-gray-100 text-gray-600 text-xs font-normal'
                  }`}
                >
                  {step}
                </div>
                {index < timelineSteps.length - 1 && (
                  <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                )}
              </div>
            ))}
          </div>

          {/* All Materials Available Success */}
          {gapCount === 0 && (
            <div className="bg-green-50 border-l-4 border-green-500 rounded-r-md p-4 flex items-center space-x-3">
              <svg className="h-5 w-5 text-green-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="font-semibold text-green-800">All materials available — ready to proceed</h3>
              </div>
            </div>
          )}

          {/* Material Gaps Warning */}
          {gapCount > 0 && (
            <div className="bg-red-50 border-l-4 border-red-500 rounded-r-md p-4 flex justify-between items-start">
              <div className="flex space-x-3">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-800">{gapCount} material gaps blocking next stage</h3>
                  <p className="text-sm text-red-700 mt-0.5">Click any Gap pill to fix or use the button</p>
                </div>
              </div>
              <button 
                onClick={() => handleOpenUpdateStockModal()}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 whitespace-nowrap ml-4">
                Update All Gaps
              </button>
            </div>
          )}

          {/* Confirm Batch Size */}
          <div className={`border-l-4 rounded-r-md p-4 ${currentStep > 1 ? 'bg-green-50 border-green-400' : 'bg-yellow-50 border-yellow-400'}`}>
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  {currentStep > 1 && (
                    <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span>{currentStep > 1 ? 'Batch size confirmed' : 'Confirm batch size'}</span>
                </h3>
                <p className="text-sm text-gray-600 mt-0.5">
                  {currentStep > 1 ? `${batchSize} units confirmed` : 'Adjust if needed — BOM recalculates.'}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  value={batchSize}
                  onChange={(e) => setBatchSize(e.target.value)}
                  disabled={currentStep > 1}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md text-right font-semibold text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <button 
                  onClick={() => {
                    setCurrentStep(2);
                    if (onConfirmBatch) {
                      onConfirmBatch(parseInt(batchSize) || bmrData.units);
                    }
                  }}
                  disabled={currentStep > 1}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {currentStep > 1 ? 'Confirmed' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>

          {/* Next Actions - Appears after confirming batch size */}
          {currentStep >= 2 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-900">Next step</h3>
                {gapCount > 0 && (
                  <span className="text-xs text-red-600 font-medium">⚠ Fix {gapCount} gap{gapCount > 1 ? 's' : ''} to proceed with Reserve/Schedule</span>
                )}
              </div>
              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="reserve"
                    name="action"
                    value="reserve"
                    checked={selectedAction === 'reserve'}
                    onChange={() => setSelectedAction('reserve')}
                    disabled={gapCount > 0}
                    className="h-4 w-4 text-blue-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <label htmlFor="reserve" className={`ml-3 ${gapCount > 0 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                    <span className="font-medium text-gray-900">Reserve Stock</span>
                    <p className="text-sm text-gray-600 mt-0.5">Lock materials for this batch</p>
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="schedule"
                    name="action"
                    value="schedule"
                    checked={selectedAction === 'schedule'}
                    onChange={() => setSelectedAction('schedule')}
                    disabled={gapCount > 0}
                    className="h-4 w-4 text-blue-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <label htmlFor="schedule" className={`ml-3 ${gapCount > 0 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                    <span className="font-medium text-gray-900">Schedule</span>
                    <p className="text-sm text-gray-600 mt-0.5">Set production date and timeline</p>
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="next"
                    name="action"
                    value="next"
                    checked={selectedAction === 'next'}
                    onChange={() => setSelectedAction('next')}
                    className="h-4 w-4 text-blue-600 cursor-pointer"
                  />
                  <label htmlFor="next" className="ml-3 cursor-pointer">
                    <span className="font-medium text-gray-900">Next Stage</span>
                    <p className="text-sm text-gray-600 mt-0.5">Proceed to the next workflow stage</p>
                  </label>
                </div>
              </div>
              
              {/* Action Button */}
              {selectedAction && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => {
                      if (selectedAction === 'schedule') {
                        setCurrentStep(4); // Move to Scheduled step
                        setIsScheduleModalOpen(true);
                      } else if (selectedAction === 'reserve') {
                        // Handle reserve stock action - mark materials as reserved
                        setCurrentStep(3); // Move to Reserved step
                        console.log('Reserve stock for BMR:', bmrData.bmrNo);
                        // In a real app, this would lock the materials for this batch
                        setTimeout(() => {
                          onClose();
                        }, 500);
                      } else if (selectedAction === 'next') {
                        // Proceed directly to material sourcing without scheduling
                        setCurrentStep(5); // Move to Material Sourced step
                        if (onConfirmBatch) {
                          onConfirmBatch(parseInt(batchSize) || bmrData.units);
                        }
                        setTimeout(() => {
                          onClose();
                        }, 500);
                      }
                    }}
                    className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    {selectedAction === 'schedule' && 'Proceed to Schedule'}
                    {selectedAction === 'reserve' && 'Reserve Materials'}
                    {selectedAction === 'next' && 'Go to Material Sourcing'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Material BOM */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-gray-900">Material BOM</h3>
              {gapCount > 0 && (
                <span className="text-xs text-gray-500">Click a Gap pill to fix or use the button</span>
              )}
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Required</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Free Stock</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Incoming</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CD</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {materials.map((material, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{material.itemId}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">{material.material}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{material.required}</td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600">{material.freeStock}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{material.incoming}</td>
                      <td className="px-4 py-3 text-sm">
                        {material.status === 'Available' ? (
                          <span className="px-3 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
                            ✓ Available
                          </span>
                        ) : (
                          <button 
                            onClick={() => handleOpenUpdateStockModal(material)}
                            className="px-3 py-1 text-xs font-semibold bg-red-100 text-red-800 rounded-full hover:bg-red-200 cursor-pointer">
                            ↓ Gap ({material.gap} kg) – Fix
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{material.cd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Update Stock Button */}
          {gapCount > 0 && (
            <button 
              onClick={() => handleOpenUpdateStockModal()}
              className="w-full px-4 py-3 text-sm font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 flex items-center justify-center space-x-2"
            >
              <AlertCircle className="h-4 w-4" />
              <span>Update Stock for Gaps</span>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>

      {/* Update Stock Modal */}
      {selectedGapMaterial && (() => {
        const currentGaps = materials.filter(m => m.status === 'Gap');
        const currentIndex = currentGaps.findIndex(m => m.itemId === selectedGapMaterial.itemId);
        
        return (
          <UpdateStockModal
            isOpen={isUpdateStockModalOpen}
            onClose={() => {
              setIsUpdateStockModalOpen(false);
              setSelectedGapMaterial(null);
            }}
            material={selectedGapMaterial}
            onApplyUpdate={handleApplyStockUpdate}
            gapProgress={{
              current: currentIndex + 1,
              total: currentGaps.length,
            }}
          />
        );
      })()}
      
      {/* Schedule BMR Modal */}
      <ScheduleBMRModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        bmrData={{
          bmrNo: bmrData.bmrNo,
          batch: bmrData.batch,
          product: bmrData.product,
          units: parseInt(batchSize) || bmrData.units,
          bulkKg: bmrData.bulkKg,
        }}
        onConfirm={(scheduleData) => {
          setIsScheduleModalOpen(false);
          setCurrentStep(5); // Move to Material Sourced step after scheduling
          if (onScheduleConfirm) {
            onScheduleConfirm(scheduleData);
          }
          // Small delay to show the step update before closing
          setTimeout(() => {
            onClose();
          }, 300);
        }}
      />
    </div>
  );
};

export default BatchConfirmationModal;
