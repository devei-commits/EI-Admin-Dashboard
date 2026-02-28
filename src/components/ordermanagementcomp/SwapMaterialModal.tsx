import React, { useState } from 'react';
import { useItems } from '../../context/ItemsContext';
import { useToast } from '../../context/ToastContext';
import { X, ArrowRightLeft } from 'lucide-react';

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
  const { items } = useItems();
  const { addToast } = useToast();
  
  const [formData, setFormData] = useState({
    toMaterial: '',
    swapRatio: 1.0,
    reason: '',
    approvedBy: ''
  });

  // Filter items to show only same category materials as alternatives
  const availableMaterials = items
    .filter(item => 
      item.type === 'raw-material' && 
      item.name !== material.itemName
    )
    .map(item => item.name)
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
    addToast('success', `Material swap applied: ${material.itemName} → ${formData.toMaterial}`);
    onClose();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleApplySwap();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-white/60 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="relative z-10 w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Swap Material</h2>
              <p className="text-sm text-gray-600">Replace shortage material with alternative</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleFormSubmit} className="p-6 space-y-6">
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

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
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
              type="submit"
              disabled={!formData.toMaterial || !formData.reason.trim() || !formData.approvedBy.trim()}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
            >
              Apply Swap
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SwapMaterialModal;