import React from 'react';
import { BadgeVariant, getStatusBadgeColor } from './theme';
import { UnifiedBadge } from './UnifiedComponents';

export interface StatusBadgeProps {
  /** Status string to display */
  status: string;
  /** Override the auto-detected variant */
  variant?: BadgeVariant;
  /** Custom label override (default: formatted status) */
  label?: string;
  /** Show a colored dot before the text */
  showDot?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Smart status badge that auto-maps status strings to appropriate colors.
 * Replaces 30+ inline status badge implementations with varying color logic.
 *
 * Usage:
 *   <StatusBadge status="active" />
 *   <StatusBadge status="pending" showDot />
 *   <StatusBadge status="custom" variant="info" label="In Review" />
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant,
  label,
  showDot = false,
  className = '',
}) => {
  const resolvedVariant = variant ?? getStatusBadgeColor(status);
  const displayLabel = label ?? formatStatus(status);

  const dotColors: Record<BadgeVariant, string> = {
    primary: 'bg-amber-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    outline: 'bg-gray-400',
  };

  return (
    <UnifiedBadge variant={resolvedVariant} className={className}>
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[resolvedVariant]}`} />
      )}
      {displayLabel}
    </UnifiedBadge>
  );
};

/** Format a status string for display (snake_case -> Title Case) */
function formatStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default StatusBadge;
