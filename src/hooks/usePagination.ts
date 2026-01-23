import { useState, useCallback, useMemo } from 'react';

/**
 * Pagination configuration for the hook
 */
export interface HookPaginationConfig {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  pageSizeOptions: number[];
}

/**
 * Pagination state and handlers
 */
export interface UsePaginationReturn<T> {
  /** Currently displayed items for the current page */
  paginatedItems: T[];
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Total number of items */
  totalItems: number;
  /** Number of items per page */
  pageSize: number;
  /** Whether there is a previous page */
  hasPreviousPage: boolean;
  /** Whether there is a next page */
  hasNextPage: boolean;
  /** Go to a specific page */
  goToPage: (page: number) => void;
  /** Go to the next page */
  nextPage: () => void;
  /** Go to the previous page */
  previousPage: () => void;
  /** Go to the first page */
  firstPage: () => void;
  /** Go to the last page */
  lastPage: () => void;
  /** Change the page size */
  setPageSize: (size: number) => void;
  /** Reset to first page */
  reset: () => void;
  /** Pagination config object for components */
  paginationConfig: HookPaginationConfig;
}

export interface UsePaginationOptions {
  /** Initial page number (1-indexed) */
  initialPage?: number;
  /** Initial page size */
  initialPageSize?: number;
  /** Available page size options */
  pageSizeOptions?: number[];
}

/**
 * usePagination Hook
 * Manages pagination state for a list of items.
 * 
 * @template T The type of items being paginated
 * @param items Array of items to paginate
 * @param options Pagination configuration options
 * @returns Pagination state and handlers
 * 
 * @example
 * const { paginatedItems, currentPage, totalPages, goToPage, nextPage, previousPage } = 
 *   usePagination(items, { initialPageSize: 10 });
 * 
 * return (
 *   <>
 *     {paginatedItems.map(item => <ItemRow key={item.id} item={item} />)}
 *     <div>
 *       <button onClick={previousPage} disabled={currentPage === 1}>Previous</button>
 *       <span>Page {currentPage} of {totalPages}</span>
 *       <button onClick={nextPage} disabled={currentPage === totalPages}>Next</button>
 *     </div>
 *   </>
 * );
 */
export function usePagination<T>(
  items: T[],
  options: UsePaginationOptions = {}
): UsePaginationReturn<T> {
  const {
    initialPage = 1,
    initialPageSize = 10,
    pageSizeOptions = [5, 10, 25, 50, 100],
  } = options;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Ensure current page is within bounds
  const validatedCurrentPage = useMemo(() => {
    if (currentPage < 1) return 1;
    if (currentPage > totalPages) return totalPages;
    return currentPage;
  }, [currentPage, totalPages]);

  // Get paginated items
  const paginatedItems = useMemo(() => {
    const startIndex = (validatedCurrentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return items.slice(startIndex, endIndex);
  }, [items, validatedCurrentPage, pageSize]);

  const hasPreviousPage = validatedCurrentPage > 1;
  const hasNextPage = validatedCurrentPage < totalPages;

  const goToPage = useCallback((page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  }, [totalPages]);

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setCurrentPage(prev => prev + 1);
    }
  }, [hasNextPage]);

  const previousPage = useCallback(() => {
    if (hasPreviousPage) {
      setCurrentPage(prev => prev - 1);
    }
  }, [hasPreviousPage]);

  const firstPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const lastPage = useCallback(() => {
    setCurrentPage(totalPages);
  }, [totalPages]);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    // Reset to first page when changing page size
    setCurrentPage(1);
  }, []);

  const reset = useCallback(() => {
    setCurrentPage(initialPage);
    setPageSizeState(initialPageSize);
  }, [initialPage, initialPageSize]);

  const paginationConfig: HookPaginationConfig = useMemo(() => ({
    currentPage: validatedCurrentPage,
    pageSize,
    totalItems,
    totalPages,
    pageSizeOptions,
  }), [validatedCurrentPage, pageSize, totalItems, totalPages, pageSizeOptions]);

  return {
    paginatedItems,
    currentPage: validatedCurrentPage,
    totalPages,
    totalItems,
    pageSize,
    hasPreviousPage,
    hasNextPage,
    goToPage,
    nextPage,
    previousPage,
    firstPage,
    lastPage,
    setPageSize,
    reset,
    paginationConfig,
  };
}

export default usePagination;
