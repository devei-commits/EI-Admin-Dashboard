import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
 currentPage: number;
 totalPages: number;
 onPageChange: (page: number) => void;
 /** Total items count for display (optional) */
 totalItems?: number;
 /** Items per page for display (optional) */
 itemsPerPage?: number;
 /** Max page buttons to show (default: 5) */
 maxButtons?: number;
 /** Style variant */
 variant?: 'default' | 'compact';
}

/**
 * Reusable pagination component.
 * Replaces 15+ duplicated pagination implementations across the codebase.
 */
export const Pagination: React.FC<PaginationProps> = ({
 currentPage,
 totalPages,
 onPageChange,
 totalItems,
 itemsPerPage,
 maxButtons = 5,
 variant = 'default',
}) => {
 if (totalPages <= 1) return null;

 const getPageNumbers = (): (number | '...')[] => {
  if (totalPages <= maxButtons) {
   return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | '...')[] = [];
  const half = Math.floor(maxButtons / 2);
  let start = Math.max(1, currentPage - half);
  const end = Math.min(totalPages, start + maxButtons - 1);

  if (end - start < maxButtons - 1) {
   start = Math.max(1, end - maxButtons + 1);
  }

  if (start > 1) {
   pages.push(1);
   if (start > 2) pages.push('...');
  }

  for (let i = start; i <= end; i++) {
   if (!pages.includes(i)) pages.push(i);
  }

  if (end < totalPages) {
   if (end < totalPages - 1) pages.push('...');
   pages.push(totalPages);
  }

  return pages;
 };

 const startItem = totalItems ? (currentPage - 1) * (itemsPerPage || 10) + 1 : undefined;
 const endItem = totalItems ? Math.min(currentPage * (itemsPerPage || 10), totalItems) : undefined;

 if (variant === 'compact') {
  return (
   <div className="flex items-center justify-between gap-4">
    {totalItems !== undefined && (
     <span className="text-sm text-gray-500">
      {startItem}–{endItem} of {totalItems}
     </span>
    )}
    <div className="flex items-center gap-1">
     <button
      onClick={() => onPageChange(currentPage - 1)}
      disabled={currentPage === 1}
      className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      aria-label="Previous page"
     >
      <ChevronLeft className="w-4 h-4" />
     </button>
     <span className="text-sm text-gray-600 px-2">
      {currentPage} / {totalPages}
     </span>
     <button
      onClick={() => onPageChange(currentPage + 1)}
      disabled={currentPage === totalPages}
      className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      aria-label="Next page"
     >
      <ChevronRight className="w-4 h-4" />
     </button>
    </div>
   </div>
  );
 }

 return (
  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
   {totalItems !== undefined && (
    <span className="text-sm text-gray-500">
     Showing {startItem}–{endItem} of {totalItems}
    </span>
   )}
   <div className="flex items-center gap-1.5">
    <button
     onClick={() => onPageChange(currentPage - 1)}
     disabled={currentPage === 1}
     className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
     aria-label="Previous page"
    >
     Previous
    </button>
    {getPageNumbers().map((page, idx) =>
     page === '...' ? (
      <span key={`ellipsis-${idx}`} className="px-2 text-gray-400 text-sm">
       ...
      </span>
     ) : (
      <button
       key={page}
       onClick={() => onPageChange(page)}
       className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
        currentPage === page
         ? 'bg-slate-800 text-white font-medium'
         : 'text-gray-600 hover:bg-gray-100'
       }`}
      >
       {page}
      </button>
     )
    )}
    <button
     onClick={() => onPageChange(currentPage + 1)}
     disabled={currentPage === totalPages}
     className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
     aria-label="Next page"
    >
     Next
    </button>
   </div>
  </div>
 );
};

export default Pagination;
