import React, { ReactNode } from 'react';

interface StatCardProps {
  icon: ReactNode;
  title: string;
  value: string | number;
  description?: string;
  iconBgClass?: string;
  iconColorClass?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  title,
  value,
  description,
  iconBgClass = 'bg-blue-100',
  iconColorClass = 'text-blue-600',
}) => (
  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${iconBgClass}`}>
        <span className={iconColorClass}>{icon}</span>
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
    </div>
  </div>
);

export default StatCard;
