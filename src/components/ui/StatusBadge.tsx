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
  /** Density: `md` (default) = text-xs px-2.5 py-1; `sm` = compact text-[10px] px-2 py-0.5. */
  size?: 'sm' | 'md';
}

const SIZE_CLASSES: Record<'sm' | 'md', string> = {
  md: 'px-2.5 py-1 text-xs',
  sm: 'px-2 py-0.5 text-[10px]',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  colorMap,
  className = '',
  icon,
  label,
  size = 'md',
}) => {
  const map = colorMap ?? ALL_STATUS_COLORS;
  const colorClass = map[status] ?? 'bg-[color:var(--st-neutral-bg)] text-[color:var(--st-neutral-fg)]';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${SIZE_CLASSES[size]} ${colorClass} ${className}`}>
      {icon}
      {label ?? status}
    </span>
  );
};

export default StatusBadge;
