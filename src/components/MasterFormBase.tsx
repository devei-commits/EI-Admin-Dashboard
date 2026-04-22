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
 onFillMock?: () => void;
 onReset?: () => void;
 primaryFields?: string[];
 /** When true, disables the Next button (e.g. Zoho sync gate on step 0). */
 nextDisabled?: boolean;
 /** Optional title for disabled Next (tooltip). */
 nextDisabledTitle?: string;
 /** When true, disables clicking a stage in the sidebar. */
 isStageDisabled?: (stageIndex: number) => boolean;
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
 onFillMock,
 onReset,
 primaryFields = [],
 nextDisabled = false,
 nextDisabledTitle,
 isStageDisabled
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
  <div className="min-h-screen bg-gray-50 flex flex-col">
   {/* Top header bar */}
   <div className="bg-white border-b border-gray-200">
    <div className="w-full px-4 md:px-6 lg:px-8 py-3 flex items-center justify-between gap-6">
     <h1 className="text-base md:text-lg font-bold text-gray-800 leading-tight truncate">
      {title}
     </h1>
     <div className="flex items-center gap-2">
      {onFillMock && (
       <button
        type="button"
        onClick={onFillMock}
        className="px-3 py-1.5 border border-amber-200 text-amber-800 text-sm font-medium rounded-lg hover:bg-amber-50 transition"
       >
        Fill mock values
       </button>
      )}
      {onReset && (
       <button
        type="button"
        onClick={onReset}
        className="px-3 py-1.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
       >
        Reset Form
       </button>
      )}
      {onSave && (
       <button
        type="button"
        onClick={onSave}
        className="px-3 py-1.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
       >
        Save
       </button>
      )}
      {onSubmit && (
       <button
        type="button"
        onClick={onSubmit}
        className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 shadow-sm transition"
       >
        Submit
       </button>
      )}
     </div>
    </div>
   </div>

   {/* Body: Sidebar + Content, similar to Packaging layout */}
   <div className="flex-1 min-w-0">
    <div className="flex w-full min-w-0 flex-col gap-4 px-4 py-4 md:px-6 lg:flex-row lg:items-stretch lg:px-8">
     {/* Left sidebar with stages */}
     <aside className="flex w-full shrink-0 flex-col overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-sm lg:w-60">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
       <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
        Sections
       </span>
      </div>
      <nav className="flex-1 px-2 py-2">
       {stages.map((stage, idx) => {
        const disabled = isStageDisabled?.(idx) ?? false;
        return (
        <button
         key={stage}
         type="button"
         disabled={disabled}
         onClick={() => {
          if (disabled) return;
          onStageChange(idx);
         }}
         className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium mb-0.5 transition-colors ${
          currentStage === idx
           ? 'bg-indigo-50 text-indigo-700 font-semibold'
           : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
         } ${disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
        >
         {idx + 1}) {stage}
        </button>
        );
       })}
      </nav>
      <div className="px-4 py-3 border-t border-gray-100 text-[11px] text-gray-500">
       {currentStage + 1}) {stages.length} sections
      </div>
     </aside>

     {/* Right content card */}
     <main className="min-w-0 flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 shadow-sm">
     {/* Section header with stage title + Prev/Next (mirrors Packaging master) */}
     <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:px-6">
       <h2 className="text-sm font-bold text-gray-800 truncate">
        {stages[currentStage]}
       </h2>
       <div className="flex items-center gap-2 shrink-0">
        <button
         type="button"
         onClick={() => onStageChange(Math.max(0, currentStage - 1))}
         disabled={currentStage === 0}
         className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg text-sm hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
         Previous
        </button>
        <button
         type="button"
         title={nextDisabled && nextDisabledTitle ? nextDisabledTitle : undefined}
         onClick={() => onStageChange(Math.min(stages.length - 1, currentStage + 1))}
         disabled={currentStage === stages.length - 1 || (nextDisabled && currentStage === 0)}
         className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
         Next
        </button>
       </div>
      </div>
     </div>

      {/* Body */}
      <div className="px-3 py-4 sm:px-4 sm:py-6">
       <div className="mx-auto max-w-4xl min-w-0 space-y-4">
        {/* Primary Fields Notice */}
        {primaryFields.length > 0 && currentStage === 0 && (
         <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-xs text-blue-800">
           <strong>Tip:</strong> Fill the highlighted primary fields first. Derived fields can auto-populate from them.
          </p>
         </div>
        )}

        {/* Main content injected by page */}
        <div>{children}</div>

        {/* Global Errors */}
        {Object.keys(errors).length > 0 && (
         <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          {Object.entries(errors).map(([field, message]) => (
           <p key={field} className="text-sm text-red-700 mb-1">
            • {message}
           </p>
          ))}
         </div>
        )}
       </div>
      </div>
     </main>
    </div>
   </div>
  </div>
 );
};

export default MasterFormBase;
