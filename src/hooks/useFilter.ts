import { useState, useCallback, useMemo } from 'react';

/**
 * Sort configuration for filtering
 */
export interface FilterSortConfig {
 field: string;
 direction: 'asc' | 'desc';
}

/**
 * Filter configuration for a field
 */
export interface FilterConfig<T> {
 field: keyof T;
 value: string | number | boolean | null;
 operator?: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'gte' | 'lte';
}

/**
 * Filter and sort state with handlers
 */
export interface UseFilterReturn<T> {
 /** Filtered and sorted items */
 filteredItems: T[];
 /** Current search query */
 searchQuery: string;
 /** Set search query */
 setSearchQuery: (query: string) => void;
 /** Current active filters */
 filters: FilterConfig<T>[];
 /** Add or update a filter */
 setFilter: (filter: FilterConfig<T>) => void;
 /** Remove a filter */
 removeFilter: (field: keyof T) => void;
 /** Clear all filters */
 clearFilters: () => void;
 /** Current sort configuration */
 sortConfig: FilterSortConfig | null;
 /** Set sort configuration */
 setSortConfig: (config: FilterSortConfig | null) => void;
 /** Toggle sort for a field */
 toggleSort: (field: string) => void;
 /** Reset all filters and sorting */
 reset: () => void;
 /** Check if any filters are active */
 hasActiveFilters: boolean;
}

export interface UseFilterOptions<T> {
 /** Fields to search when using search query */
 searchFields?: (keyof T)[];
 /** Initial sort configuration */
 initialSort?: FilterSortConfig;
 /** Initial filters */
 initialFilters?: FilterConfig<T>[];
 /** Case-insensitive search (default: true) */
 caseInsensitive?: boolean;
}

/**
 * useFilter Hook
 * Provides filtering, searching, and sorting functionality for a list of items.
 * 
 * @template T The type of items being filtered
 * @param items Array of items to filter
 * @param options Filter configuration options
 * @returns Filter state and handlers
 * 
 * @example
 * const { 
 *  filteredItems, 
 *  searchQuery, 
 *  setSearchQuery, 
 *  setFilter, 
 *  sortConfig, 
 *  toggleSort 
 * } = useFilter(orders, {
 *  searchFields: ['orderCode', 'customer', 'itemName'],
 *  initialSort: { field: 'createdAt', direction: 'desc' }
 * });
 * 
 * return (
 *  <>
 *   <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
 *   <select onChange={e => setFilter({ field: 'status', value: e.target.value, operator: 'equals' })}>
 *    <option value="">All</option>
 *    <option value="pending">Pending</option>
 *   </select>
 *   {filteredItems.map(item => <Row key={item.id} item={item} />)}
 *  </>
 * );
 */
export function useFilter<T extends Record<string, unknown>>(
 items: T[],
 options: UseFilterOptions<T> = {}
): UseFilterReturn<T> {
 const {
  searchFields = [],
  initialSort = null,
  initialFilters = [],
  caseInsensitive = true,
 } = options;

 const [searchQuery, setSearchQuery] = useState('');
 const [filters, setFilters] = useState<FilterConfig<T>[]>(initialFilters);
 const [sortConfig, setSortConfig] = useState<FilterSortConfig | null>(initialSort);

 // Add or update a filter
 const setFilter = useCallback((filter: FilterConfig<T>) => {
  setFilters(prev => {
   const existing = prev.findIndex(f => f.field === filter.field);
   if (existing >= 0) {
    const updated = [...prev];
    updated[existing] = filter;
    return updated;
   }
   return [...prev, filter];
  });
 }, []);

 // Remove a filter
 const removeFilter = useCallback((field: keyof T) => {
  setFilters(prev => prev.filter(f => f.field !== field));
 }, []);

 // Clear all filters
 const clearFilters = useCallback(() => {
  setFilters([]);
  setSearchQuery('');
 }, []);

 // Toggle sort for a field
 const toggleSort = useCallback((field: string) => {
  setSortConfig(prev => {
   if (prev?.field === field) {
    // Cycle through: asc -> desc -> null
    if (prev.direction === 'asc') {
     return { field, direction: 'desc' };
    }
    return null;
   }
   return { field, direction: 'asc' };
  });
 }, []);

 // Reset all filters and sorting
 const reset = useCallback(() => {
  setSearchQuery('');
  setFilters(initialFilters);
  setSortConfig(initialSort);
 }, [initialFilters, initialSort]);

 // Apply filters, search, and sort
 const filteredItems = useMemo(() => {
  let result = [...items];

  // Apply search query
  if (searchQuery && searchFields.length > 0) {
   const query = caseInsensitive ? searchQuery.toLowerCase() : searchQuery;
   result = result.filter(item =>
    searchFields.some(field => {
     const value = item[field];
     if (value == null) return false;
     const stringValue = String(value);
     return caseInsensitive
      ? stringValue.toLowerCase().includes(query)
      : stringValue.includes(query);
    })
   );
  }

  // Apply filters
  for (const filter of filters) {
   if (filter.value == null || filter.value === '') continue;

   result = result.filter(item => {
    const itemValue = item[filter.field];
    const filterValue = filter.value;
    const operator = filter.operator || 'equals';

    if (itemValue == null) return false;

    switch (operator) {
     case 'equals':
      return caseInsensitive && typeof itemValue === 'string' && typeof filterValue === 'string'
       ? itemValue.toLowerCase() === filterValue.toLowerCase()
       : itemValue === filterValue;
     case 'contains':
      return String(itemValue).toLowerCase().includes(String(filterValue).toLowerCase());
     case 'startsWith':
      return String(itemValue).toLowerCase().startsWith(String(filterValue).toLowerCase());
     case 'endsWith':
      return String(itemValue).toLowerCase().endsWith(String(filterValue).toLowerCase());
     case 'gt':
      return Number(itemValue) > Number(filterValue);
     case 'lt':
      return Number(itemValue) < Number(filterValue);
     case 'gte':
      return Number(itemValue) >= Number(filterValue);
     case 'lte':
      return Number(itemValue) <= Number(filterValue);
     default:
      return itemValue === filterValue;
    }
   });
  }

  // Apply sorting
  if (sortConfig) {
   result.sort((a, b) => {
    const aValue = a[sortConfig.field as keyof T];
    const bValue = b[sortConfig.field as keyof T];

    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return sortConfig.direction === 'asc' ? 1 : -1;
    if (bValue == null) return sortConfig.direction === 'asc' ? -1 : 1;

    let comparison = 0;
    if (typeof aValue === 'string' && typeof bValue === 'string') {
     comparison = aValue.localeCompare(bValue);
    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
     comparison = aValue - bValue;
    } else {
     comparison = String(aValue).localeCompare(String(bValue));
    }

    return sortConfig.direction === 'asc' ? comparison : -comparison;
   });
  }

  return result;
 }, [items, searchQuery, searchFields, filters, sortConfig, caseInsensitive]);

 const hasActiveFilters = searchQuery.length > 0 || filters.length > 0;

 return {
  filteredItems,
  searchQuery,
  setSearchQuery,
  filters,
  setFilter,
  removeFilter,
  clearFilters,
  sortConfig,
  setSortConfig,
  toggleSort,
  reset,
  hasActiveFilters,
 };
}

export default useFilter;
