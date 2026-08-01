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
    <div className="flex items-center gap-2 flex-wrap bg-white/60 backdrop-blur-sm border border-border rounded-lg px-3 py-2.5 shadow-sm">
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
                  ? 'text-brand bg-brand-soft border-brand-soft shadow-sm'
                  : 'text-ink-3 bg-surface border-border hover:bg-surface-2 hover:border-border'
                }
              `}
            >
              {Icon && <Icon size={13} />}
              {chip.label}
            </button>
          );
        })}
      </div>

      <div className="w-px h-5 bg-surface-3 mx-2" />

      <div className="relative flex-grow" style={{ minWidth: '250px' }}>
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label={filterType === 'so' ? 'Search SO no, customer, product...' : 'Search product, SO, BPR...'}
          placeholder={filterType === 'so' ? 'Search SO no, customer, product...' : 'Search product, SO, BPR...'}
          className="
            w-full pl-9 pr-4 py-1.5 rounded-md border border-border bg-surface
            text-ink text-sm outline-none
            focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--ring)] transition-colors
            placeholder:text-ink-4
          "
        />
      </div>

      {(searchValue || activeFilter !== 'all') && (
        <button
          onClick={onClearFilters}
          className="
            ml-auto px-3 py-1 text-xs font-semibold text-ink-3 bg-surface border border-border rounded-full
            hover:bg-surface-3 hover:text-ink transition-all flex items-center gap-1.5
          "
        >
          <X size={14} />
          Clear Filters
        </button>
      )}
    </div>
  );
};
