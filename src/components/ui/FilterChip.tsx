import React, { ReactNode } from 'react';

export interface FilterChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
 /** Selected/active state. */
 active?: boolean;
 /** Optional leading icon. */
 icon?: ReactNode;
 /** If provided, renders a trailing ✕ that calls this instead of toggling. */
 onRemove?: () => void;
 children: ReactNode;
}

/**
 * Filter / toggle pill — facet filters, active-filter tokens, quick toggles.
 * Prop-forwarding: spreads remaining button props (onClick, disabled, title, …).
 */
export const FilterChip: React.FC<FilterChipProps> = ({
 active = false,
 icon,
 onRemove,
 children,
 className = '',
 ...props
}) => (
 <button
  type="button"
  aria-pressed={active}
  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] ${
   active
    ? 'bg-brand-soft text-brand border border-transparent'
    : 'bg-surface text-ink-2 border border-hairline hover:border-strong hover:text-ink'
  } ${className}`}
  {...props}
 >
  {icon}
  {children}
  {onRemove && (
   <span
    role="button"
    tabIndex={-1}
    aria-label="Remove filter"
    onClick={(e) => {
     e.stopPropagation();
     onRemove();
    }}
    className="ml-0.5 -mr-1 grid place-items-center w-4 h-4 rounded-full text-current/70 hover:bg-black/10"
   >
    ×
   </span>
  )}
 </button>
);

export default FilterChip;
