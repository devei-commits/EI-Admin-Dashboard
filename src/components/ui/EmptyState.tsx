import React from 'react';

/**
 * EmptyState — unified "nothing here yet" appearance (icon + title + hint + action).
 * Token-driven, theme-aware. Pass a Phosphor/lucide icon element as `icon`.
 */
export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /** Compact padding for use inside dense panels/cards. */
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
  compact = false,
}) => (
  <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-8 px-4' : 'py-14 px-6'} ${className}`}>
    {icon && (
      <div className="mb-3 text-ink-4 [&_svg]:h-10 [&_svg]:w-10" aria-hidden="true">
        {icon}
      </div>
    )}
    <p className="text-sm font-semibold text-ink-2">{title}</p>
    {description && <p className="mt-1 max-w-sm text-xs text-ink-3">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
