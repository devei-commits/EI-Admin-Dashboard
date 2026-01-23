/**
 * Hooks - Central Export
 * 
 * Re-exports all custom hooks for convenient imports.
 * 
 * @example
 * import { useDebounce, usePagination, useModal } from '@/hooks';
 */

// Async operations
export { useAsync, useAsyncWithRetry } from './useAsyncWithRetry';
export type { UseAsyncState } from './useAsyncWithRetry';

// Analytics
export { useAnalytics } from './useAnalytics';

// Debouncing
export { useDebounce, useDebouncedCallback } from './useDebounce';

// Click outside detection
export { useOutsideClick, useClickAway } from './useOutsideClick';

// Pagination
export { usePagination } from './usePagination';
export type { UsePaginationReturn, UsePaginationOptions, HookPaginationConfig } from './usePagination';

// Filtering and sorting
export { useFilter } from './useFilter';
export type { UseFilterReturn, UseFilterOptions, FilterConfig, FilterSortConfig } from './useFilter';

// Modal management
export { useModal, useConfirm } from './useModal';
export type { UseModalReturn, UseConfirmReturn } from './useModal';

// Toggle and selection
export { useToggle, useSelection } from './useToggle';
export type { UseToggleReturn, UseSelectionReturn } from './useToggle';
