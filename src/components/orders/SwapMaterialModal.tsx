import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { fetchRawMaterialsList } from '../../services/rawMaterials.service';
import { ArrowRightLeft } from 'lucide-react';
import { UnifiedModal } from '../ui/UnifiedComponents';

interface SwapMaterialModalProps {
  material: {
    itemName: string;
    qty: number;
    gap: number;
  };
  onClose: () => void;
  onSwapApplied: (swapData: {
    fromMaterial: string;
    toMaterial: string;
    swapRatio: number;
    reason: string;
  }) => void;
}

const SwapMaterialModal: React.FC<SwapMaterialModalProps> = ({
  material,
  onClose,
  onSwapApplied
}) => {
  const { addToast } = useToast();
  const [rawMaterials, setRawMaterials] = useState<Array<{ id: string; name: string }>>([]);
  const [formData, setFormData] = useState({
    toMaterial: '',
    swapRatio: 1.0,
    reason: '',
    approvedBy: ''
  });

  useEffect(() => {
    fetchRawMaterialsList().then(list => {
      setRawMaterials(list?.map(r => ({ id: r.id, name: r.name || r.code })) ?? []);
    }).catch(() => setRawMaterials([]));
  }, []);

  const availableMaterials = rawMaterials
    .filter(r => r.name !== material.itemName)
    .map(r => r.name)
    .sort();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'swapRatio' ? parseFloat(value) || 0 : value
    }));
  };

  const handleApplySwap = () => {
    if (!formData.toMaterial) {
      addToast('error', 'Please select a replacement material');
      return;
    }
    
    if (!formData.reason.trim()) {
      addToast('error', 'Please provide a reason for the swap');
      return;
    }

    if (!formData.approvedBy.trim()) {
      addToast('error', 'Please specify who approved this swap');
      return;
    }

    const swapData = {
      fromMaterial: material.itemName,
      toMaterial: formData.toMaterial,
      swapRatio: formData.swapRatio,
      reason: formData.reason
    };

    onSwapApplied(swapData);
    addToast('success', `Material swap applied: ${material.itemName} -> ${formData.toMaterial}`);
    onClose();
  };

  const _handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleApplySwap();
  };

  return (
    <UnifiedModal
      isOpen={true}
      onClose={onClose}
      title="Swap Material"
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApplySwap}
            disabled={!formData.toMaterial || !formData.reason.trim() || !formData.approvedBy.trim()}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            Apply Swap
          </button>
        </>
      }
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
          <ArrowRightLeft className="w-5 h-5 text-orange-600" />
        </div>
        <p className="text-sm text-gray-600">Replace shortage material with alternative</p>
      </div>

      {/* Current Material Info */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="font-semibold text-red-800 mb-2">Current Material (Shortage)</h3>
        <div className="text-sm text-red-700 space-y-1">
          <div><span className="font-medium">Material:</span> {material.itemName}</div>
          <div><span className="font-medium">Required:</span> {material.qty}</div>
          <div><span className="font-medium">Shortage:</span> {material.gap}</div>
        </div>
      </div>

      {/* Swap Form */}
      <div className="space-y-4">
        {/* To Material Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            REPLACEMENT MATERIAL
          </label>
          <select
            name="toMaterial"
            value={formData.toMaterial}
            onChange={handleInputChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">— Select replacement material —</option>
            {availableMaterials.map(materialName => (
              <option key={materialName} value={materialName}>
                {materialName}
              </option>
            ))}
          </select>
        </div>

        {/* Swap Ratio */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            SWAP RATIO
          </label>
          <input
            type="number"
            name="swapRatio"
            value={formData.swapRatio}
            onChange={handleInputChange}
            step="0.1"
            min="0.1"
            max="3.0"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            1.0 = same quantity; 0.9 = 90% of original; 1.1 = 110% of original
          </p>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            REASON FOR SWAP
          </label>
          <textarea
            name="reason"
            value={formData.reason}
            onChange={handleInputChange}
            rows={3}
            placeholder="e.g., Material shortage, cost optimization, supplier issue..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Approved By */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            APPROVED BY
          </label>
          <input
            type="text"
            name="approvedBy"
            value={formData.approvedBy}
            onChange={handleInputChange}
            placeholder="Enter approver name"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
    </UnifiedModal>
  );
};

export default SwapMaterialModal;