/**
 * KPICard Component
 * Displays key performance indicator cards
 */

import React from 'react';
import type { KPICardProps } from '../../types/orderFulfillment';

export const KPICard: React.FC<KPICardProps> = ({ 
  label, 
  value, 
  sub, 
  trend,
  color,
  onClick 
}) => {
  return (
    <div 
      className={`
        flex-1 min-w-27.5 bg-white border border-gray-200 rounded-[10px] 
        px-3.5 py-3 transition-all duration-150 relative overflow-hidden shadow-sm
        hover:border-gray-300 hover:shadow
        ${onClick ? 'cursor-pointer' : 'cursor-default'}
      `}
      onClick={onClick}
      style={{ color }}
    >
      {/* Bottom accent line */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-0.5 opacity-20"
        style={{ background: 'currentColor' }}
      />

      <div className="text-[9.5px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
        {label}
      </div>
      
      <div className="font-mono text-[22px] font-extrabold leading-none text-gray-900">
        {value}
      </div>
      
      {sub && (
        <div className="text-[10px] text-gray-600 mt-1">
          {sub}
        </div>
      )}
      
      {trend && (
        <div className="text-[9.5px] font-bold mt-0.5">
          {trend}
        </div>
      )}
    </div>
  );
};
