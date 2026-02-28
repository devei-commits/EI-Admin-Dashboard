import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle } from 'lucide-react';

interface MaterialItem {
  itemId: string;
  material: string;
  required: string | number;
  freeStock: number;
  incoming: number;
  status: string;
  gap?: number;
  cd: string;
}

interface UpdateStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: MaterialItem;
  onApplyUpdate: (updatedMaterial: MaterialItem) => void;
  gapProgress?: { current: number; total: number };
}

const UpdateStockModal: React.FC<UpdateStockModalProps> = ({
  isOpen,
  onClose,
  material,
  onApplyUpdate,
  gapProgress,
}) => {
  const [entryType, setEntryType] = useState('receipt');
  const [quantityToAdd, setQuantityToAdd] = useState('');
  const [reference, setReference] = useState('');

  // Reset form when modal opens with new material
  useEffect(() => {
    if (isOpen) {
      setQuantityToAdd('');
      setReference('');
      setEntryType('receipt');
    }
  }, [isOpen, material.itemId]);

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

  // Parse current values
  const quantity = parseFloat(quantityToAdd) || 0;
  const requiredAmount = typeof material.required === 'string' 
    ? parseFloat(material.required.split(' ')[0]) 
    : material.required;
  
  // Current state
  const currentTotalStock = material.freeStock + (material.incoming || 0);
  const currentReserved = material.incoming || 0;
  const currentFreeStock = material.freeStock;
  
  // Calculate stock after update based on entry type
  let newTotalStock = currentTotalStock;
  let newFreeStock = currentFreeStock;
  
  switch (entryType) {
    case 'receipt': // Add to stock
      newTotalStock = currentTotalStock + quantity;
      newFreeStock = currentFreeStock + quantity;
      break;
    case 'physical': // Set stock to value
      newTotalStock = quantity;
      newFreeStock = Math.max(0, quantity - currentReserved);
      break;
    case 'adjustment': // Adjust (can be positive or negative)
      newTotalStock = currentTotalStock + quantity;
      newFreeStock = currentFreeStock + quantity;
      break;
  }
  
  const gapAfter = Math.max(0, requiredAmount - newFreeStock);
  const stillShort = gapAfter > 0;
  const gapResolved = gapAfter === 0;

  const handleQuickFill = (type: 'exact' | 'plus10' | 'double') => {
    const gap = material.gap || 0;
    switch (type) {
      case 'exact':
        setQuantityToAdd(gap.toString());
        break;
      case 'plus10':
        setQuantityToAdd(Math.ceil(gap * 1.1).toString());
        break;
      case 'double':
        setQuantityToAdd((gap * 2).toString());
        break;
    }
  };

  const handleApplyUpdate = () => {
    if (!quantityToAdd) return;
    
    const updatedMaterial: MaterialItem = {
      ...material,
      freeStock: newFreeStock,
      status: gapAfter === 0 ? 'Available' : 'Gap',
      gap: gapAfter,
    };
    
    onApplyUpdate(updatedMaterial);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-60 p-4 animate-fade-in">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto transform transition-all duration-200">
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-gray-200 bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
              <span className="text-orange-500">🔧</span>
              <span>Update Stock — Manual Entry</span>
              {gapProgress && (
                <span className="ml-2 text-sm font-normal text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                  Gap {gapProgress.current} of {gapProgress.total}
                </span>
              )}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {material.material} ({material.itemId}) — Gap: {material.gap || 0} kg
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
        <div className="p-6 space-y-6">
          {/* Item Details */}
          <div>
            <h3 className="text-xs font-bold text-gray-700 uppercase mb-3">ITEM</h3>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-6">
                {/* Left: Material Name */}
                <div>
                  <div className="font-bold text-gray-900 text-lg">{material.material}</div>
                  <div className="text-sm text-gray-500 mt-1">{material.itemId} · kg</div>
                </div>
                
                {/* Right: Stock Details */}
                <div className="grid grid-cols-5 gap-3 text-center">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Current Stock</div>
                    <div className="font-bold text-gray-900">{currentTotalStock} kg</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Reserved</div>
                    <div className="font-bold text-gray-600">{currentReserved} kg</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Free Stock</div>
                    <div className="font-bold text-green-600">{material.freeStock} kg</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Required</div>
                    <div className="font-bold text-orange-600">{requiredAmount} kg</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Gap</div>
                    <div className="font-bold text-red-600">{material.gap || 0} kg</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Fill Options */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Quick fill:</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleQuickFill('exact')}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Fill exact gap
              </button>
              <button
                onClick={() => handleQuickFill('plus10')}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Gap + 10%
              </button>
              <button
                onClick={() => handleQuickFill('double')}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Gap x 2
              </button>
            </div>
          </div>

          {/* Entry Type and Quantity - Two Column Layout */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Entry Type</label>
              <select
                value={entryType}
                onChange={(e) => setEntryType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="receipt">✚ Add to Stock (GRN / Receipt)</option>
                <option value="physical">📊 Set Stock to Value (Physical Count)</option>
                <option value="adjustment">⚙️ Adjust (← or → correction)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {entryType === 'physical' ? 'New Stock Value' : 'Quantity to Add'}
              </label>
              <input
                type="number"
                value={quantityToAdd}
                onChange={(e) => setQuantityToAdd(e.target.value)}
                placeholder={entryType === 'physical' ? 'Enter new stock value' : 'Enter quantity'}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
          </div>

          {/* Reference */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reference / Reason (optional)</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. GRN-2501, Physical count, Adjustment"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          {/* Preview After Update */}
          {quantityToAdd && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-xs font-bold text-gray-700 uppercase mb-3">PREVIEW AFTER UPDATE</h3>
              <div className="flex items-center gap-8">
                <div>
                  <div className="text-xs text-gray-600 mb-1">New Stock</div>
                  <div className="text-2xl font-bold text-green-600">{newTotalStock} kg</div>
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">New Free</div>
                  <div className="text-2xl font-bold text-green-600">{newFreeStock} kg</div>
                </div>
                <div className="flex-1">
                  <div className="text-xs text-gray-600 mb-1">Gap After</div>
                  {gapResolved ? (
                    <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1 rounded-md text-sm font-bold">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Gap resolved</span>
                    </div>
                  ) : stillShort ? (
                    <div className="inline-flex items-center gap-2 bg-yellow-500 text-white px-3 py-1 rounded-md text-sm font-bold">
                      <span className="text-lg">⚠</span>
                      <span>Still {gapAfter} kg short</span>
                    </div>
                  ) : (
                    <div className="text-2xl font-bold text-green-600">0 kg</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-white sticky bottom-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleApplyUpdate}
            disabled={!quantityToAdd}
            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>
              {gapProgress && gapProgress.current < gapProgress.total 
                ? `Apply & Next (${gapProgress.total - gapProgress.current} more)` 
                : 'Apply & Complete'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateStockModal;
