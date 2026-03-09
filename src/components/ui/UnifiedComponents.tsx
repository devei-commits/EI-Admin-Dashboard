import React, { ReactNode } from 'react';

// Unified Button Component
export interface UnifiedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
 variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
 size?: 'sm' | 'md' | 'lg';
 children: ReactNode;
 icon?: ReactNode;
 isLoading?: boolean;
}

export const UnifiedButton: React.FC<UnifiedButtonProps> = ({
 variant = 'primary',
 size = 'md',
 children,
 icon,
 isLoading = false,
 disabled,
 className,
 ...props
}) => {
 const variantStyles = {
  primary: 'px-6 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:ring-offset-2 transition-all font-semibold tracking-wider disabled:opacity-50 disabled:cursor-not-allowed',
  secondary: 'px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all font-medium tracking-wide disabled:opacity-50',
  ghost: 'px-6 py-3 bg-transparent text-gray-700 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all font-medium disabled:opacity-50',
  danger: 'px-6 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all font-medium tracking-wide disabled:opacity-50',
 };

 const sizeStyles = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-sm',
  lg: 'px-8 py-4 text-base',
 };

 return (
  <button
   {...props}
   disabled={disabled || isLoading}
   className={`
    ${variantStyles[variant]}
    ${size === 'sm' ? sizeStyles.sm : size === 'lg' ? sizeStyles.lg : sizeStyles.md}
    flex items-center gap-2 justify-center whitespace-nowrap
    ${className}
   `}
  >
   {isLoading && <span className="inline-block">Loading...</span>}
   {icon && !isLoading && icon}
   {children}
  </button>
 );
};

// Unified Badge Component
export interface UnifiedBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
 variant?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'outline';
 children: ReactNode;
}

export const UnifiedBadge: React.FC<UnifiedBadgeProps> = ({
 variant = 'primary',
 children,
 className,
 ...props
}) => {
 const variantStyles = {
  primary: 'px-3 py-1.5 bg-slate-800 text-white rounded-full text-xs font-semibold uppercase tracking-wider',
  success: 'px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-100 uppercase tracking-wider',
  warning: 'px-3 py-1.5 bg-gray-100 text-slate-900 rounded-full text-xs font-semibold border border-gray-100 uppercase tracking-wider',
  error: 'px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold border border-red-100 uppercase tracking-wider',
  info: 'px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold border border-blue-100 uppercase tracking-wider',
  outline: 'px-3 py-1.5 bg-transparent border border-gray-200 text-gray-700 rounded-full text-xs font-semibold uppercase tracking-wider',
 };

 return (
  <span {...props} className={`inline-flex items-center gap-1 ${variantStyles[variant]} ${className}`}>
   {children}
  </span>
 );
};

// Unified Card Component
export interface UnifiedCardProps extends React.HTMLAttributes<HTMLDivElement> {
 variant?: 'default' | 'elevated' | 'outlined';
 children: ReactNode;
}

export const UnifiedCard: React.FC<UnifiedCardProps> = ({
 variant = 'default',
 children,
 className,
 ...props
}) => {
 const variantStyles = {
  default: 'bg-white rounded-lg shadow-sm border border-gray-100 p-6',
  elevated: 'bg-white rounded-lg shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow',
  outlined: 'bg-white rounded-lg border-2 border-gray-200 p-6',
 };

 return (
  <div {...props} className={`${variantStyles[variant]} ${className}`}>
   {children}
  </div>
 );
};

// Unified Modal Component
export interface UnifiedModalProps {
 isOpen: boolean;
 onClose: () => void;
 title: string;
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
 if (!isOpen) return null;

 return (
  <div className="fixed inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
   <div className={`bg-white rounded-xl shadow-lg w-full ${modalSizeClass[size]} max-h-[90vh] overflow-auto`}>
    <div className="flex justify-between items-center p-6 border-b-2 border-gray-200">
     <h3 className="text-2xl font-semibold text-gray-800 tracking-tight">{title}</h3>
     <button
      onClick={onClose}
      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
     >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
     </button>
    </div>

    <div className="p-6 space-y-8">{children}</div>

    {footer && (
     <div className="p-6 border-t-2 border-gray-200 flex justify-end gap-3">{footer}</div>
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
 className,
 ...props
}) => {
 return (
  <th
   {...props}
   className={`py-4 px-5 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider leading-relaxed border-b-2 border-gray-200 ${className}`}
  >
   {children}
  </th>
 );
};

// Unified Table Cell Component
export interface UnifiedTableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
 children: ReactNode;
}

export const UnifiedTableCell: React.FC<UnifiedTableCellProps> = ({
 children,
 className,
 ...props
}) => {
 return (
  <td
   {...props}
   className={`py-4 px-5 text-gray-700 leading-relaxed border-b border-gray-100 ${className}`}
  >
   {children}
  </td>
 );
};

// Unified Input Component
export interface UnifiedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
 label?: string;
 error?: string;
}

export const UnifiedInput: React.FC<UnifiedInputProps> = ({
 label,
 error,
 className,
 ...props
}) => {
 return (
  <div className="space-y-2">
   {label && (
    <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide">
     {label}
    </label>
   )}
   <input
    {...props}
    className={`
     w-full px-5 py-3 border rounded-lg focus:outline-none focus:ring-2 
     focus:ring-slate-800 focus:border-transparent bg-gray-50/50 transition-all 
     leading-normal tracking-wide
     ${error ? 'border-red-200 focus:ring-red-500' : 'border-gray-200'}
     ${className}
    `}
   />
   {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
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
 className,
 ...props
}) => {
 return (
  <div className="space-y-2">
   {label && (
    <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide">
     {label}
    </label>
   )}
   <select
    {...props}
    className={`
     w-full px-5 py-3 border rounded-lg focus:outline-none focus:ring-2 
     focus:ring-slate-800 focus:border-transparent bg-gray-50/50 transition-all 
     leading-normal tracking-wide
     ${error ? 'border-red-200 focus:ring-red-500' : 'border-gray-200'}
     ${className}
    `}
   >
    <option value="">Select an option</option>
    {options.map((opt) => (
     <option key={opt.value} value={opt.value}>
      {opt.label}
     </option>
    ))}
   </select>
   {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
  </div>
 );
};

// Unified Label Component
export interface UnifiedLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
 children: ReactNode;
}

export const UnifiedLabel: React.FC<UnifiedLabelProps> = ({
 children,
 className,
 ...props
}) => {
 return (
  <label
   {...props}
   className={`block text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide ${className}`}
  >
   {children}
  </label>
 );
};
