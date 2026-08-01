import React from 'react';
import { ALL_STATUS_COLORS } from '../../constants/statusMaps';

interface StatusBadgeProps {
  status: string;
  colorMap?: Record<string, string>;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  colorMap,
  className = '',
}) => {
  const map = colorMap ?? ALL_STATUS_COLORS;
  const colorClass = map[status] ?? 'bg-[color:var(--st-neutral-bg)] text-[color:var(--st-neutral-fg)]';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${colorClass} ${className}`}>
      {status}
    </span>
  );
};

export default StatusBadge;
