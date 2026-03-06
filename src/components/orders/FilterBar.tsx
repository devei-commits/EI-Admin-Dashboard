/**
 * FilterBar Component
 * Displays filter chips and search box for filtering orders/batches
 */

import React from 'react';
import { X, Search } from 'lucide-react';
import type { FilterBarProps } from '../../types/orderFulfillment';
import { SO_FILTER_CHIPS, BATCH_FILTER_CHIPS } from '../../constants/orderFulfillment';

export const FilterBar: React.FC<FilterBarProps> = ({ 
  activeFilter, 
  onFilterChange, 
  searchValue, 
  onSearchChange,
  onClearFilters,
  filterType 
}) => {
  const chips = filterType === 'so' ? SO_FILTER_CHIPS : BATCH_FILTER_CHIPS;

  return (
    <div className="flex items-center gap-2 flex-wrap bg-white/60 backdrop-blur-sm border border-gray-200/80 rounded-lg px-3 py-2.5 shadow-sm">
      <div className="flex items-center gap-2">
        {chips.map(chip => {
          const Icon = chip.icon;
          const isActive = activeFilter === chip.key;
          return (
            <button
              key={chip.key}
              onClick={() => onFilterChange(chip.key)}
              className={`
                px-3 py-1 rounded-full border text-xs font-semibold
                transition-all duration-150 flex items-center gap-1.5
                ${isActive
                  ? 'text-orange-600 bg-orange-50 border-orange-300 shadow-sm'
                  : 'text-gray-600 bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                }
              `}
            >
              {Icon && <Icon size={13} />}
              {chip.label}
            </button>
          );
        })}
      </div>

      <div className="w-px h-5 bg-gray-200 mx-2" />

      <div className="relative flex-grow" style={{ minWidth: '250px' }}>
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={filterType === 'so' ? 'Search SO no, customer, product...' : 'Search product, SO, BPR...'}
          className="
            w-full pl-9 pr-4 py-1.5 rounded-md border border-gray-300 bg-white 
            text-gray-900 text-sm outline-none
            focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors
            placeholder:text-gray-400
          "
        />
      </div>

      {(searchValue || activeFilter !== 'all') && (
        <button
          onClick={onClearFilters}
          className="
            ml-auto px-3 py-1 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-full
            hover:bg-gray-100 hover:text-gray-800 transition-all flex items-center gap-1.5
          "
        >
          <X size={14} />
          Clear Filters
        </button>
      )}
    </div>
  );
};
