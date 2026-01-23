import React, { ReactNode } from 'react';
import { 
  autoPopulateDerivedFields 
} from '../utils/masterFormUtils';

interface FormData {
  [key: string]: unknown;
}

interface MasterFormBaseProps {
  title: string;
  stages: string[];
  currentStage: number;
  onStageChange: (stage: number) => void;
  errors: Record<string, string>;
  formData: FormData;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onAutoPopulate?: (field: string, data: FormData) => void;
  children: ReactNode;
  onSave?: () => void;
  onSubmit?: () => void;
  primaryFields?: string[];
}

/**
 * Base component for all master data forms
 * Handles:
 * - Stage navigation
 * - Error display
 * - Auto-population hints
 * - Primary field highlighting
 */
const MasterFormBase: React.FC<MasterFormBaseProps> = ({
  title,
  stages,
  currentStage,
  onStageChange,
  errors,
  formData,
  onInputChange,
  onAutoPopulate,
  children,
  onSave,
  onSubmit,
  primaryFields = []
}) => {
  // Utility functions that may be used by child components
  const _isPrimaryField = (fieldId: string) => primaryFields.includes(fieldId);

  const _handleInputWithAutoPopulate = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    onInputChange(e);
    
    // Check if this field has dependencies
    if (onAutoPopulate && e.target.id) {
      const updated = autoPopulateDerivedFields(formData, 'packaging', e.target.id);
      if (updated !== formData) {
        onAutoPopulate(e.target.id, updated as FormData);
      }
    }
  };
  
  // Export utility functions for potential use
  void _isPrimaryField;
  void _handleInputWithAutoPopulate;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-5xl mx-auto bg-white rounded-lg shadow-sm p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">{title}</h1>
          
          <div className="flex items-center justify-between mb-6">
            <div className="w-48">
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                id="status"
                value={(formData.status as string) || 'Draft'}
                onChange={onInputChange}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option>Draft</option>
                <option>Under Review</option>
                <option>Approved</option>
                <option>Archived</option>
              </select>
            </div>
            
            <div className="flex gap-2">
              {onSave && (
                <button 
                  onClick={onSave}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 transition"
                >
                  Save Draft
                </button>
              )}
              {onSubmit && (
                <button 
                  onClick={onSubmit}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition"
                >
                  Submit
                </button>
              )}
            </div>
          </div>
          
          {/* Step Indicator */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            {stages.map((stage, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <button
                  onClick={() => onStageChange(idx)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition ${
                    currentStage === idx
                      ? 'bg-orange-500 text-white'
                      : currentStage > idx
                      ? 'bg-gray-300 text-gray-600'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                  title={stage}
                >
                  {idx + 1}
                </button>
                {idx < stages.length - 1 && (
                  <div className="h-1 w-6 bg-gray-300"></div>
                )}
              </div>
            ))}
          </div>

          {/* Stage Title */}
          <h2 className="text-lg font-semibold text-gray-700 mb-4">
            {stages[currentStage]}
          </h2>

          {/* Primary Fields Notice */}
          {primaryFields.length > 0 && currentStage === 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                <strong>💡 Tip:</strong> Fill the primary fields first below. Derived fields will auto-populate based on your entries.
              </p>
            </div>
          )}
        </div>

        {/* Main Form Content */}
        <div className="mb-6">
          {children}
        </div>

        {/* Global Errors */}
        {Object.keys(errors).length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            {Object.entries(errors).map(([field, message]) => (
              <p key={field} className="text-sm text-red-700 mb-1">
                • {message}
              </p>
            ))}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center pt-6 border-t border-gray-200">
          <button
            onClick={() => onStageChange(Math.max(0, currentStage - 1))}
            disabled={currentStage === 0}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg text-sm hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            ← Previous
          </button>
          
          <span className="text-sm text-gray-600">
            Stage {currentStage + 1} of {stages.length}
          </span>
          
          <button
            onClick={() => onStageChange(Math.min(stages.length - 1, currentStage + 1))}
            disabled={currentStage === stages.length - 1}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
};

export default MasterFormBase;
