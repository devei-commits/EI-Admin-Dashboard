import React, { ReactNode } from 'react';

export interface SegmentedOption<T extends string> {
 value: T;
 label: ReactNode;
 icon?: ReactNode;
 disabled?: boolean;
}

export interface SegmentedProps<T extends string> {
 options: SegmentedOption<T>[];
 value: T;
 onChange: (value: T) => void;
 size?: 'sm' | 'md';
 className?: string;
 'aria-label'?: string;
}

/**
 * iOS-style segmented control (a pill track with a raised active segment).
 * Use for small mutually-exclusive view switches (2–5 options). For page-level
 * tab navigation keep the existing tab bars; this is a compact inline control.
 */
export function Segmented<T extends string>({
 options,
 value,
 onChange,
 size = 'md',
 className = '',
 ...rest
}: SegmentedProps<T>): JSX.Element {
 const pad = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm';
 return (
  <div
   role="tablist"
   aria-label={rest['aria-label']}
   className={`inline-flex items-center gap-0.5 p-[3px] rounded-[var(--r-sm)] bg-surface-3 border border-hairline ${className}`}
  >
   {options.map((opt) => {
    const active = opt.value === value;
    return (
     <button
      key={opt.value}
      type="button"
      role="tab"
      aria-selected={active}
      disabled={opt.disabled}
      onClick={() => onChange(opt.value)}
      className={`inline-flex items-center gap-1.5 rounded-[calc(var(--r-sm)-3px)] font-medium whitespace-nowrap transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${pad} ${
       active ? 'bg-surface text-ink shadow-[var(--e1)]' : 'text-ink-3 hover:text-ink'
      }`}
     >
      {opt.icon}
      {opt.label}
     </button>
    );
   })}
  </div>
 );
}

export default Segmented;
