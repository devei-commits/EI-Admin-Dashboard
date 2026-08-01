import React, { ReactNode, useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

/* -------------------------------------------------------------------------------------------------
 * Apple-grade design language primitives. Token-driven (see index.css) so every variant is
 * theme-aware (light + dark) automatically. Public APIs are unchanged — these are drop-in restyles.
 * ---------------------------------------------------------------------------------------------- */

// Unified Button Component
export interface UnifiedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
 variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
 size?: 'sm' | 'md' | 'lg';
 children: ReactNode;
 icon?: ReactNode;
 isLoading?: boolean;
}

const BTN_BASE =
 'inline-flex items-center gap-2 justify-center whitespace-nowrap rounded-[var(--r-sm)] font-medium ' +
 'transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] ' +
 'focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--canvas)] ' +
 'disabled:opacity-50 disabled:cursor-not-allowed';

const BTN_VARIANT: Record<NonNullable<UnifiedButtonProps['variant']>, string> = {
 primary: 'bg-brand text-brand-ink hover:bg-brand-press shadow-[var(--e1)]',
 secondary: 'bg-surface text-ink border border-border hover:bg-surface-3',
 ghost: 'bg-transparent text-ink-2 hover:bg-surface-3',
 danger: 'bg-[color:var(--st-red-bg)] text-[color:var(--st-red-fg)] hover:brightness-95',
};

const BTN_SIZE: Record<NonNullable<UnifiedButtonProps['size']>, string> = {
 sm: 'px-3 py-1.5 text-sm',
 md: 'px-4 py-2 text-sm',
 lg: 'px-5 py-2.5 text-base',
};

export const UnifiedButton: React.FC<UnifiedButtonProps> = ({
 variant = 'primary',
 size = 'md',
 children,
 icon,
 isLoading = false,
 disabled,
 className = '',
 ...props
}) => (
 <button
  {...props}
  disabled={disabled || isLoading}
  className={`${BTN_BASE} ${BTN_VARIANT[variant]} ${BTN_SIZE[size]} ${className}`}
 >
  {isLoading && (
   <span
    aria-hidden
    className="inline-block w-3.5 h-3.5 rounded-full border-2 border-current/30 border-t-current animate-spin"
   />
  )}
  {icon && !isLoading && icon}
  {children}
 </button>
);

// Unified Badge Component
export interface UnifiedBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
 variant?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'outline';
 children: ReactNode;
}

const BADGE_BASE = 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider';

const BADGE_VARIANT: Record<NonNullable<UnifiedBadgeProps['variant']>, string> = {
 primary: 'bg-ink text-[color:var(--surface)]',
 success: 'bg-[color:var(--st-green-bg)] text-[color:var(--st-green-fg)]',
 warning: 'bg-[color:var(--st-amber-bg)] text-[color:var(--st-amber-fg)]',
 error: 'bg-[color:var(--st-red-bg)] text-[color:var(--st-red-fg)]',
 info: 'bg-[color:var(--st-blue-bg)] text-[color:var(--st-blue-fg)]',
 outline: 'bg-transparent border border-border text-ink-2',
};

export const UnifiedBadge: React.FC<UnifiedBadgeProps> = ({
 variant = 'primary',
 children,
 className = '',
 ...props
}) => (
 <span {...props} className={`${BADGE_BASE} ${BADGE_VARIANT[variant]} ${className}`}>
  {children}
 </span>
);

// Unified Card Component
export interface UnifiedCardProps extends React.HTMLAttributes<HTMLDivElement> {
 variant?: 'default' | 'elevated' | 'outlined';
 children: ReactNode;
}

const CARD_VARIANT: Record<NonNullable<UnifiedCardProps['variant']>, string> = {
 default: 'bg-surface rounded-[var(--r-lg)] border border-hairline shadow-[var(--e1)] p-6',
 elevated: 'bg-surface rounded-[var(--r-lg)] border border-hairline shadow-[var(--e2)] hover:shadow-[var(--e3)] transition-shadow p-6',
 outlined: 'bg-surface rounded-[var(--r-lg)] border border-strong p-6',
};

export const UnifiedCard: React.FC<UnifiedCardProps> = ({
 variant = 'default',
 children,
 className = '',
 ...props
}) => (
 <div {...props} className={`${CARD_VARIANT[variant]} ${className}`}>
  {children}
 </div>
);

// Unified Modal Component
export interface UnifiedModalProps {
 isOpen: boolean;
 onClose: () => void;
 title: ReactNode;
 children: ReactNode;
 footer?: ReactNode;
 size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const modalSizeClass: Record<string, string> = {
 sm: 'max-w-md',
 md: 'max-w-2xl',
 lg: 'max-w-4xl',
 xl: 'max-w-6xl',
 full: 'max-w-[95vw]',
};

export const UnifiedModal: React.FC<UnifiedModalProps> = ({
 isOpen,
 onClose,
 title,
 children,
 footer,
 size = 'lg',
}) => {
 const dialogRef = useRef<HTMLDivElement>(null);
 useFocusTrap(isOpen, dialogRef);
 if (!isOpen) return null;

 return (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
   <div
    ref={dialogRef}
    role="dialog"
    aria-modal="true"
    {...(typeof title === 'string' ? { 'aria-labelledby': 'unified-modal-title' } : { 'aria-label': 'Dialog' })}
    className={`bg-surface text-ink rounded-[var(--r-lg)] shadow-[var(--e3)] border border-hairline w-full ${modalSizeClass[size]} max-h-[90vh] overflow-auto`}
   >
    <div className="flex justify-between items-center p-6 border-b border-hairline">
     <div className="flex-1 min-w-0">
      {typeof title === 'string' ? <h3 id="unified-modal-title" className="text-2xl font-semibold text-ink tracking-tight">{title}</h3> : title}
     </div>
     <button
      onClick={onClose}
      aria-label="Close"
      className="w-8 h-8 flex items-center justify-center rounded-[var(--r-sm)] text-ink-4 hover:text-ink hover:bg-surface-3 transition-colors"
     >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
     </button>
    </div>

    <div className="p-6 space-y-8">{children}</div>

    {footer && (
     <div className="p-6 border-t border-hairline flex justify-end gap-3">{footer}</div>
    )}
   </div>
  </div>
 );
};

// Unified Table Header Component
export interface UnifiedTableHeaderCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
 children: ReactNode;
}

export const UnifiedTableHeaderCell: React.FC<UnifiedTableHeaderCellProps> = ({
 children,
 className = '',
 ...props
}) => (
 <th
  scope="col"
  {...props}
  className={`py-4 px-5 text-left text-xs font-semibold text-ink-3 uppercase tracking-wider leading-relaxed border-b border-border ${className}`}
 >
  {children}
 </th>
);

// Unified Table Cell Component
export interface UnifiedTableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
 children: ReactNode;
}

export const UnifiedTableCell: React.FC<UnifiedTableCellProps> = ({
 children,
 className = '',
 ...props
}) => (
 <td
  {...props}
  className={`py-4 px-5 text-ink-2 leading-relaxed border-b border-hairline ${className}`}
 >
  {children}
 </td>
);

// Shared field control class (input / select) — token-driven.
const FIELD_BASE =
 'w-full px-3.5 py-2.5 rounded-[var(--r-sm)] border bg-surface text-ink placeholder:text-ink-4 ' +
 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus:border-[color:var(--accent)] ' +
 'transition-all leading-normal';

// Unified Input Component
export interface UnifiedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
 label?: string;
 error?: string;
}

export const UnifiedInput: React.FC<UnifiedInputProps> = ({
 label,
 error,
 className = '',
 ...props
}) => {
 const isRequired = Boolean(props.required);
 return (
  <div className="space-y-2">
   {label && (
    <label className="block text-sm font-semibold text-ink-2 uppercase tracking-wide">
     {label}
     {isRequired && <span className="text-[color:var(--st-red-fg)] ml-0.5">*</span>}
    </label>
   )}
   <input
    {...props}
    className={`${FIELD_BASE} ${error ? 'border-[color:var(--st-red-fg)]/40' : 'border-border'} ${className}`}
   />
   {error && <p className="text-xs text-[color:var(--st-red-fg)] font-medium">{error}</p>}
  </div>
 );
};

// Unified Select Component
export interface UnifiedSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
 label?: string;
 error?: string;
 options: Array<{ value: string; label: string }>;
}

export const UnifiedSelect: React.FC<UnifiedSelectProps> = ({
 label,
 error,
 options,
 className = '',
 ...props
}) => {
 const hasCustomEmptyOption = options.some((opt) => String(opt.value) === '');
 const isRequired = Boolean(props.required);

 return (
  <div className="space-y-2">
   {label && (
    <label className="block text-sm font-semibold text-ink-2 uppercase tracking-wide">
     {label}
     {isRequired && <span className="text-[color:var(--st-red-fg)] ml-0.5">*</span>}
    </label>
   )}
   <select
    {...props}
    className={`${FIELD_BASE} ${error ? 'border-[color:var(--st-red-fg)]/40' : 'border-border'} ${className}`}
   >
    {!hasCustomEmptyOption && <option value="">Select an option</option>}
    {options.map((opt) => (
     <option key={opt.value} value={opt.value}>
      {opt.label}
     </option>
    ))}
   </select>
   {error && <p className="text-xs text-[color:var(--st-red-fg)] font-medium">{error}</p>}
  </div>
 );
};

// Unified Label Component
export interface UnifiedLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
 children: ReactNode;
}

export const UnifiedLabel: React.FC<UnifiedLabelProps> = ({
 children,
 className = '',
 ...props
}) => (
 <label
  {...props}
  className={`block text-sm font-semibold text-ink-2 mb-3 uppercase tracking-wide ${className}`}
 >
  {children}
 </label>
);
