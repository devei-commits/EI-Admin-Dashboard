import React, { ReactNode } from 'react';

export interface PageHeaderProps {
 /** Page title */
 title: string;
 /** Optional subtitle/description */
 subtitle?: string;
 /** Icon to display before the title */
 icon?: ReactNode;
 /** Right-side actions (buttons, filters, etc.) */
 actions?: ReactNode;
 /** Additional className */
 className?: string;
}

/**
 * Reusable page header with title, optional icon, subtitle, and action area.
 * Replaces the repeated pattern of gradient headers across pages.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
 title,
 subtitle,
 icon,
 actions,
 className = '',
}) => {
 return (
  <div className={`bg-slate-800 text-white p-4 sm:p-6 rounded-xl shadow-md ${className}`}>
   <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
    <div className="flex items-center gap-3">
     {icon && <div className="text-white/90">{icon}</div>}
     <div>
      <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && (
       <p className="text-white/80 text-sm mt-0.5">{subtitle}</p>
      )}
     </div>
    </div>
    {actions && (
     <div className="flex items-center gap-2 flex-wrap">
      {actions}
     </div>
    )}
   </div>
  </div>
 );
};

export default PageHeader;
