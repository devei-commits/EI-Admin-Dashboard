import React, { useState, useEffect } from 'react';
import { UnifiedModal } from '../../ui/UnifiedComponents';

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

  return (
    <UnifiedModal
      isOpen={isOpen}
      onClose={onClose}
      title="Schedule BMR"
      size="md"
      footer={
        <>
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
        </>
      }
    >
      <p className="text-sm text-gray-600">
        {bmrData.bmrNo} · {bmrData.batch} · {bmrData.product} · {bmrData.units} units · {bmrData.bulkKg} kg
      </p>

      <h3 className="text-base font-semibold text-gray-900 mb-4">Schedule Production</h3>
      
      <div className="grid grid-cols-2 gap-6 mb-6">
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
    </UnifiedModal>
  );
};

export default ScheduleBMRModal;
