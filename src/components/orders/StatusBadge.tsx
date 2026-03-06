/**
 * StatusBadge Component
 * Displays status badges for fulfillment and sale order statuses
 */

import React from 'react';
import { FF_STATUS_CONFIG, SO_STATUS_CONFIG } from '../../constants/orderFulfillment';
import type { StatusBadgeProps } from '../../types/orderFulfillment';

export const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  type, 
  size = 'md' 
}) => {
  const config = type === 'ff' ? FF_STATUS_CONFIG[status] : SO_STATUS_CONFIG[status];
  
  if (!config) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-gray-500/10 text-gray-600 border border-gray-500/20">
        {status}
      </span>
    );
  }

  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-[8px] px-1.5 py-0.5 gap-0.5',
    md: 'text-[9px] px-2 py-0.5 gap-1',
    lg: 'text-[10px] px-2.5 py-1 gap-1.5'
  };

  const iconSizes = {
    sm: 8,
    md: 10,
    lg: 12
  };

  return (
    <span 
      className={`
        inline-flex items-center rounded-full font-bold font-mono whitespace-nowrap border
        ${config.color} ${config.bgColor} ${config.borderColor} ${sizeClasses[size]}
      `}
    >
      <Icon size={iconSizes[size]} className="shrink-0" />
      <span>{config.label}</span>
    </span>
  );
};
