import React, { ReactNode } from 'react';

export interface FormFieldProps {
 /** Field label */
 label: string;
 /** Whether the field is required (shows * indicator) */
 required?: boolean;
 /** Error message to display */
 error?: string;
 /** Help text beneath the field */
 helpText?: string;
 /** Child input/select/textarea element */
 children: ReactNode;
 /** Additional className for wrapper */
 className?: string;
 /** Label size variant */
 labelSize?: 'sm' | 'md';
 /** HTML for attribute linking to input id */
 htmlFor?: string;
}

/**
 * Reusable form field wrapper with label, required indicator, error, and help text.
 * Replaces the repeated pattern of:
 *  <div><label>...</label><input .../></div>
 * found in 30+ locations across the codebase.
 */
export const FormField: React.FC<FormFieldProps> = ({
 label,
 required = false,
 error,
 helpText,
 children,
 className = '',
 labelSize = 'sm',
 htmlFor,
}) => {
 const labelClasses = labelSize === 'sm'
  ? 'text-sm font-medium text-ink-2'
  : 'text-sm font-semibold text-ink-2 uppercase tracking-wide';

 return (
  <div className={`space-y-1 ${className}`}>
   <label htmlFor={htmlFor} className={`block ${labelClasses}`}>
    {label}{required && <span className="text-[color:var(--st-red-fg)] ml-0.5">*</span>}
   </label>
   {children}
   {error && <p className="text-xs text-[color:var(--st-red-fg)] font-medium mt-0.5">{error}</p>}
   {helpText && <p className="text-xs text-ink-4 mt-0.5">{helpText}</p>}
  </div>
 );
};

// ----- Common input class strings (token-driven; theme-aware) -----

/** Standard input className for consistent styling */
export const inputClassName = 'w-full px-3 py-2 border border-border rounded-[var(--r-sm)] bg-surface text-ink placeholder:text-ink-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus:border-[color:var(--accent)] text-sm transition-all';

/** Standard select className for consistent styling */
export const selectClassName = 'w-full px-3 py-2 border border-border rounded-[var(--r-sm)] bg-surface text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus:border-[color:var(--accent)] text-sm transition-all';

/** Standard textarea className for consistent styling */
export const textareaClassName = 'w-full px-3 py-2 border border-border rounded-[var(--r-sm)] bg-surface text-ink placeholder:text-ink-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus:border-[color:var(--accent)] text-sm transition-all resize-none';

/** Error input className */
export const inputErrorClassName = 'w-full px-3 py-2 border border-[color:var(--st-red-fg)]/40 rounded-[var(--r-sm)] bg-[color:var(--st-red-bg)] text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--st-red-fg)]/40 text-sm transition-all';

export default FormField;
