import React from 'react';

interface KPICardProps {
 title: string;
 value: string | number;
 subtitle?: string;
 icon?: React.ReactNode;
 trend?: {
  value: number;
  label: string;
  isPositive?: boolean;
 };
 color?: 'amber' | 'green' | 'blue' | 'red' | 'purple';
 size?: 'sm' | 'md' | 'lg';
 onClick?: () => void;
}

const colorClasses = {
 amber: {
  bg: 'bg-gray-50',
  icon: 'text-slate-700',
  accent: 'text-slate-800',
 },
 green: {
  bg: 'bg-green-50',
  icon: 'text-green-500',
  accent: 'text-green-600',
 },
 blue: {
  bg: 'bg-blue-50',
  icon: 'text-blue-500',
  accent: 'text-blue-600',
 },
 red: {
  bg: 'bg-red-50',
  icon: 'text-red-500',
  accent: 'text-red-600',
 },
 purple: {
  bg: 'bg-purple-50',
  icon: 'text-purple-500',
  accent: 'text-purple-600',
 },
};

const sizeClasses = {
 sm: {
  padding: 'p-4',
  title: 'text-xs',
  value: 'text-xl',
  icon: 'w-6 h-6',
 },
 md: {
  padding: 'p-6',
  title: 'text-sm',
  value: 'text-3xl',
  icon: 'w-8 h-8',
 },
 lg: {
  padding: 'p-8',
  title: 'text-base',
  value: 'text-4xl',
  icon: 'w-10 h-10',
 },
};

export const KPICard: React.FC<KPICardProps> = ({
 title,
 value,
 subtitle,
 icon,
 trend,
 color = 'amber',
 size = 'md',
 onClick,
}) => {
 const colorStyle = colorClasses[color];
 const sizeStyle = sizeClasses[size];

 return (
  <div
   className={`bg-white rounded-xl ${sizeStyle.padding} shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 ${
    onClick ? 'cursor-pointer hover:scale-[1.02]' : ''
   }`}
   onClick={onClick}
  >
   <div className="flex items-center justify-between">
    <div className="flex-1">
     <p className={`${sizeStyle.title} text-gray-500 font-medium uppercase tracking-wide`}>
      {title}
     </p>
     <p className={`${sizeStyle.value} font-bold text-gray-800 mt-1`}>{value}</p>
     
     {subtitle && (
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
     )}
     
     {trend && (
      <div className="flex items-center gap-1 mt-2">
       <span className={`text-xs font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
       </span>
       <span className="text-xs text-gray-400">{trend.label}</span>
      </div>
     )}
    </div>
    
    {icon && (
     <div className={`${colorStyle.icon} opacity-80`}>
      <div className={sizeStyle.icon}>{icon}</div>
     </div>
    )}
   </div>
  </div>
 );
};

interface KPIGridProps {
 children: React.ReactNode;
 columns?: 2 | 3 | 4 | 5;
 gap?: 'sm' | 'md' | 'lg';
}

export const KPIGrid: React.FC<KPIGridProps> = ({
 children,
 columns = 4,
 gap = 'md',
}) => {
 const columnClasses = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
 };

 const gapClasses = {
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-6',
 };

 return (
  <div className={`grid ${columnClasses[columns]} ${gapClasses[gap]}`}>
   {children}
  </div>
 );
};

export default KPICard;
