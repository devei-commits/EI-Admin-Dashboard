import React from 'react';
import { Search, X } from 'lucide-react';

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
 value: string;
 onChange: (value: string) => void;
 onClear?: () => void;
 /** Placeholder text (default: "Search...") */
 placeholder?: string;
 /** Width class (default: "w-full sm:w-64") */
 widthClass?: string;
 /** Show clear button when value is non-empty (default: true) */
 showClear?: boolean;
}

/**
 * Reusable search input with search icon and optional clear button.
 * Replaces 12+ duplicated search input patterns across the codebase.
 */
export const SearchInput: React.FC<SearchInputProps> = ({
 value,
 onChange,
 onClear,
 placeholder = 'Search...',
 widthClass = 'w-full sm:w-64',
 showClear = true,
 className = '',
 ...props
}) => {
 const handleClear = () => {
  onChange('');
  onClear?.();
 };

 return (
  <div className={`relative ${widthClass}`}>
   <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
   <input
    type="text"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className={`w-full pl-10 pr-${showClear && value ? '8' : '4'} py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-700 text-sm transition-all bg-white ${className}`}
    {...props}
   />
   {showClear && value && (
    <button
     type="button"
     onClick={handleClear}
     className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
     aria-label="Clear search"
    >
     <X className="w-4 h-4" />
    </button>
   )}
  </div>
 );
};

export default SearchInput;
