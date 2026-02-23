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
 *   <div><label>...</label><input .../></div>
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
    ? 'text-sm font-medium text-gray-700'
    : 'text-sm font-semibold text-gray-700 uppercase tracking-wide';

  return (
    <div className={`space-y-1 ${className}`}>
      <label htmlFor={htmlFor} className={`block ${labelClasses}`}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 font-medium mt-0.5">{error}</p>}
      {helpText && <p className="text-xs text-gray-400 mt-0.5">{helpText}</p>}
    </div>
  );
};

// ----- Common input class strings -----

/** Standard input className for consistent styling */
export const inputClassName = 'w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm transition-all';

/** Standard select className for consistent styling */
export const selectClassName = 'w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm transition-all';

/** Standard textarea className for consistent styling */
export const textareaClassName = 'w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm transition-all resize-none';

/** Error input className */
export const inputErrorClassName = 'w-full px-3 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 text-sm transition-all bg-red-50/50';

export default FormField;
