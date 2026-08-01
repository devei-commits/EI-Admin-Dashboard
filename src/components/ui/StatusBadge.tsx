import React from 'react';
import { ALL_STATUS_COLORS } from '../../constants/statusMaps';

interface StatusBadgeProps {
  status: string;
  colorMap?: Record<string, string>;
  className?: string;
  /** Optional leading icon (folds the domain icon+config badge in orders/). */
  icon?: React.ReactNode;
  /** Override the displayed text (defaults to `status`). */
  label?: React.ReactNode;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  colorMap,
  className = '',
  icon,
  label,
}) => {
  const map = colorMap ?? ALL_STATUS_COLORS;
  const colorClass = map[status] ?? 'bg-[color:var(--st-neutral-bg)] text-[color:var(--st-neutral-fg)]';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${colorClass} ${className}`}>
      {icon}
      {label ?? status}
    </span>
  );
};

export default StatusBadge;
