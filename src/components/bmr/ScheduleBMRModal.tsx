import React, { useState, useEffect } from 'react';
import { X, Calendar } from 'lucide-react';

interface ScheduleBMRModalProps {
  isOpen: boolean;
  onClose: () => void;
  bmrData: {
    bmrNo: string;
    batch: string;
    product: string;
    units: number;
    bulkKg: number;
  };
  onConfirm: (scheduleData: {
    productionDate: string;
    manufacturingArea: string;
    productionTank: string;
  }) => void;
}

const ScheduleBMRModal: React.FC<ScheduleBMRModalProps> = ({
  isOpen,
  onClose,
  bmrData,
  onConfirm,
}) => {
  const [productionDate, setProductionDate] = useState('2026-02-28');
  const [manufacturingArea, setManufacturingArea] = useState('area1');
  const [productionTank, setProductionTank] = useState('');

  // Handle Escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleConfirm = () => {
    onConfirm({
      productionDate,
      manufacturingArea,
      productionTank,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-60 p-4 animate-fade-in">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full transform transition-all duration-200">
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <span>Schedule BMR</span>
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {bmrData.bmrNo} · {bmrData.batch} · {bmrData.product} · {bmrData.units} units · {bmrData.bulkKg} kg
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Schedule Production</h3>
          
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Production Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Production Date
              </label>
              <input
                type="date"
                value={productionDate}
                onChange={(e) => setProductionDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>

            {/* Manufacturing Area */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Manufacturing Area
              </label>
              <select
                value={manufacturingArea}
                onChange={(e) => setManufacturingArea(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              >
                <option value="area1">Manufacturing Area 1 — Primary bulk area</option>
                <option value="area2">Manufacturing Area 2 — Secondary production</option>
                <option value="area3">Manufacturing Area 3 — Specialty products</option>
              </select>
            </div>
          </div>

          {/* Production Tank */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Production Tank
            </label>
            <select
              value={productionTank}
              onChange={(e) => setProductionTank(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
            >
              <option value="">Select production tank...</option>
              <option value="tank1">Tank 01 — 1000L capacity</option>
              <option value="tank2">Tank 02 — 1500L capacity</option>
              <option value="tank3">Tank 03 — 2000L capacity</option>
              <option value="tank4">Tank 04 — 800L capacity</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!productionTank}
            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Confirm & Request Materials
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleBMRModal;
