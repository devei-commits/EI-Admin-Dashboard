/**
 * ProgressBar Component
 * Displays progress bars with customizable colors and labels
 */

import React from 'react';
import type { ProgressBarProps } from '../../types/orderFulfillment';

export const ProgressBar: React.FC<ProgressBarProps> = ({ 
  percentage, 
  label, 
  color = 'emerald',
  showLabel = true 
}) => {
  const colorMap: Record<string, { bar: string; text: string }> = {
    emerald: { bar: 'bg-emerald-600', text: 'text-emerald-600' },
    amber: { bar: 'bg-amber-600', text: 'text-amber-600' },
    orange: { bar: 'bg-orange-600', text: 'text-orange-600' },
    red: { bar: 'bg-red-600', text: 'text-red-600' },
    teal: { bar: 'bg-teal-600', text: 'text-teal-600' },
    purple: { bar: 'bg-purple-600', text: 'text-purple-600' },
    gray: { bar: 'bg-gray-600', text: 'text-gray-600' }
  };

  const colors = colorMap[color] || colorMap.emerald;
  
  // Auto color based on percentage if color is 'auto'
  const getAutoColor = () => {
    if (percentage === 100) return colorMap.emerald;
    if (percentage > 50) return colorMap.amber;
    if (percentage > 0) return colorMap.orange;
    return colorMap.gray;
  };

  const appliedColors = color === 'auto' ? getAutoColor() : colors;

  return (
    <div className="text-right">
      {label && (
        <div className="text-[9px] text-gray-600 uppercase tracking-wider mb-1">
          {label}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <div className="w-18 h-1.5 rounded-full bg-gray-200 overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-400 ${appliedColors.bar}`}
            style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
          />
        </div>
        {showLabel && (
          <span className={`font-mono text-[11px] font-extrabold ${appliedColors.text}`}>
            {percentage}%
          </span>
        )}
      </div>
    </div>
  );
};
