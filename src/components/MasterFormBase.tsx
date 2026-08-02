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
 /** Label for the submit button (default: Review & submit). */
 submitLabel?: string;
 onReset?: () => void;
 onRevert?: () => void;
 /** Label for send-back button (e.g. Send back to Draft). */
 revertLabel?: string;
 primaryFields?: string[];
 /** When true, disables the Next button (e.g. Zoho sync gate on step 0). */
 nextDisabled?: boolean;
 /** Per-stage Next disable (overrides nextDisabled when provided). */
 isNextDisabled?: (stageIndex: number) => boolean;
 /** Optional title for disabled Next (tooltip). */
 nextDisabledTitle?: string;
 /** Per-stage tooltip when Next is disabled. */
 getNextDisabledTitle?: (stageIndex: number) => string | undefined;
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
 submitLabel = 'Review & submit',
 onReset,
 onRevert,
 revertLabel,
 primaryFields = [],
 nextDisabled = false,
 nextDisabledTitle,
 isNextDisabled,
 getNextDisabledTitle,
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

 const nextButtonDisabled =
  currentStage === stages.length - 1 ||
  (isNextDisabled ? isNextDisabled(currentStage) : nextDisabled && currentStage === 0);
 const nextButtonTitle = isNextDisabled
  ? getNextDisabledTitle?.(currentStage)
  : nextDisabled && currentStage === 0
    ? nextDisabledTitle
    : undefined;

 return (
  <div className="min-h-screen bg-surface-3 flex flex-col">
   {/* Top header bar */}
   <div className="bg-surface border-b border-border">
    <div className="w-full px-4 md:px-6 lg:px-8 py-3 flex items-center justify-between gap-6">
     <h1 className="text-base md:text-lg font-bold text-ink leading-tight truncate">
      {title}
     </h1>
     <div className="flex items-center gap-2">
      {onReset && (
       <button
        type="button"
        onClick={onReset}
        className="px-3 py-1.5 border border-border text-ink-3 text-sm font-medium rounded-lg hover:bg-surface-3 transition"
       >
        Reset Form
       </button>
      )}
      {onSave && (
       <button
        type="button"
        onClick={onSave}
        className="px-3 py-1.5 border border-border text-ink-3 text-sm font-medium rounded-lg hover:bg-surface-3 transition"
       >
        Save draft
       </button>
      )}
      {onRevert && revertLabel && (
       <button
        type="button"
        onClick={onRevert}
        className="px-3 py-1.5 border border-[color:var(--st-amber-fg)]/30 text-warn text-sm font-medium rounded-lg hover:bg-warn-soft transition"
       >
        {revertLabel}
       </button>
      )}
      {onSubmit && (
       <button
        type="button"
        onClick={onSubmit}
        className="px-4 py-1.5 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-press shadow-sm transition"
       >
        {submitLabel}
       </button>
      )}
     </div>
    </div>
   </div>

   {/* Body: Sidebar + Content, similar to Packaging layout */}
   <div className="flex-1 min-w-0">
    <div className="flex w-full min-w-0 flex-col gap-4 px-4 py-4 md:px-6 lg:h-[calc(100vh-5.25rem)] lg:flex-row lg:items-stretch lg:px-8 lg:overflow-hidden">
     {/* Left sidebar with stages */}
     <aside className="flex w-full shrink-0 flex-col overflow-y-auto rounded-xl border border-border bg-surface shadow-sm lg:w-60">
      <div className="px-4 pt-4 pb-3 border-b border-hairline">
       <span className="text-xs font-bold uppercase tracking-widest text-ink-3">
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
           ? 'bg-brand-soft text-brand font-semibold'
           : 'text-ink-3 hover:bg-surface-3 hover:text-ink'
         } ${disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
        >
         {idx + 1}) {stage}
        </button>
        );
       })}
      </nav>
      <div className="px-4 py-3 border-t border-hairline text-[11px] text-ink-3">
       {currentStage + 1}) {stages.length} sections
      </div>
     </aside>

     {/* Right content card */}
     <main className="min-w-0 flex-1 overflow-y-auto rounded-xl border border-border bg-surface-3 shadow-sm">
     {/* Section header with stage title + Prev/Next (mirrors Packaging master) */}
     <div className="sticky top-0 z-10 bg-surface-3 border-b border-border">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:px-6">
       <h2 className="text-sm font-bold text-ink truncate">
        {stages[currentStage]}
       </h2>
       <div className="flex items-center gap-2 shrink-0">
        <button
         type="button"
         onClick={() => onStageChange(Math.max(0, currentStage - 1))}
         disabled={currentStage === 0}
         className="px-4 py-2 bg-surface-3 text-ink rounded-lg text-sm hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
         Previous
        </button>
        <button
         type="button"
         title={nextButtonTitle}
         onClick={() => onStageChange(Math.min(stages.length - 1, currentStage + 1))}
         disabled={nextButtonDisabled}
         className="px-4 py-2 bg-brand text-white rounded-lg text-sm hover:bg-brand-press disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
         Next
        </button>
       </div>
      </div>
     </div>

      {/* Body */}
      <div className="px-3 py-4 pb-24 sm:px-4 sm:py-6 sm:pb-24">
       <div className="mx-auto max-w-4xl min-w-0 space-y-4">
        {/* Primary Fields Notice */}
        {primaryFields.length > 0 && currentStage === 0 && (
         <div className="bg-brand-soft border border-brand-soft rounded-lg p-4">
          <p className="text-xs text-brand">
           <strong>Tip:</strong> Fill the highlighted primary fields first. Derived fields can auto-populate from them.
          </p>
         </div>
        )}

        {/* Main content injected by page */}
        <div>{children}</div>

        {/* Global Errors */}
        {Object.entries(errors).some(([, message]) => String(message ?? '').trim()) && (
         <div className="bg-err-soft border border-[color:var(--st-red-fg)]/30 rounded-lg p-4">
          {Object.entries(errors)
           .filter(([, message]) => String(message ?? '').trim())
           .map(([field, message]) => (
           <p key={field} className="text-sm text-err mb-1">
            • {message}
           </p>
          ))}
         </div>
        )}
       </div>
      </div>

      {/* Bottom sticky actions for long sections */}
      <div className="sticky bottom-0 z-10 border-t border-border bg-surface/95 backdrop-blur">
       <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:px-6">
        <button
         type="button"
         onClick={() => onStageChange(Math.max(0, currentStage - 1))}
         disabled={currentStage === 0}
         className="px-4 py-2 bg-surface-3 text-ink rounded-lg text-sm hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
         Previous
        </button>
        <div className="flex items-center gap-2">
         {onSave && (
          <button
           type="button"
           onClick={onSave}
           className="px-4 py-2 border border-border text-ink-2 rounded-lg text-sm font-medium hover:bg-surface-3 transition"
          >
           Save draft
          </button>
         )}
         {onSubmit && currentStage === stages.length - 1 && (
          <button
           type="button"
           onClick={onSubmit}
           className="px-4 py-2 bg-ok text-white rounded-lg text-sm font-semibold hover:brightness-95 transition"
          >
           {submitLabel}
          </button>
         )}
         <button
          type="button"
          title={nextButtonTitle}
          onClick={() => onStageChange(Math.min(stages.length - 1, currentStage + 1))}
          disabled={nextButtonDisabled}
          className="px-4 py-2 bg-brand text-white rounded-lg text-sm hover:bg-brand-press disabled:opacity-50 disabled:cursor-not-allowed transition"
         >
          Next
         </button>
        </div>
       </div>
      </div>
     </main>
    </div>
   </div>
  </div>
 );
};

export default MasterFormBase;
