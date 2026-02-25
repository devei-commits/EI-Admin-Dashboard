import React, { useState } from 'react';
import { exportToCSV, exportToExcel } from '../../lib/exportUtils';

interface ExportButtonProps {
 data: Record<string, unknown>[];
 filename: string;
 formatData?: (data: Record<string, unknown>[]) => Record<string, unknown>[];
 disabled?: boolean;
 className?: string;
 size?: 'sm' | 'md';
}

export const ExportButton: React.FC<ExportButtonProps> = ({
 data,
 filename,
 formatData,
 disabled = false,
 className = '',
 size = 'md',
}) => {
 const [showMenu, setShowMenu] = useState(false);

 const handleExport = (format: 'csv' | 'xlsx') => {
  const exportData = formatData ? formatData(data) : data;
  
  if (format === 'csv') {
   exportToCSV(exportData, filename);
  } else {
   exportToExcel(exportData, filename);
  }
  
  setShowMenu(false);
 };

 const sizeClasses = size === 'sm' 
  ? 'px-3 py-1.5 text-sm gap-1.5'
  : 'px-4 py-2 text-sm gap-2';

 return (
  <div className={`relative ${className}`}>
   <button
    onClick={() => setShowMenu(!showMenu)}
    disabled={disabled || data.length === 0}
    className={`flex items-center ${sizeClasses} bg-white border border-gray-200 rounded-lg font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150`}
   >
    <svg className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
    Export
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
   </button>

   {showMenu && (
    <>
     <div 
      className="fixed inset-0 z-10" 
      onClick={() => setShowMenu(false)}
     />
     <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-20 py-1 animate-fadeIn">
      <button
       onClick={() => handleExport('csv')}
       className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 hover:text-slate-900 flex items-center gap-2 transition-colors"
      >
       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
       </svg>
       CSV
      </button>
      <button
       onClick={() => handleExport('xlsx')}
       className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 hover:text-slate-900 flex items-center gap-2 transition-colors"
      >
       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
       </svg>
       Excel (.xlsx)
      </button>
     </div>
    </>
   )}
  </div>
 );
};

export default ExportButton;
