// Unified UI Components and Theme System
export * from './theme';
export {
 UnifiedButton,
 UnifiedBadge,
 UnifiedCard,
 UnifiedLabel,
} from './UnifiedComponents';

// Atomic reusable components
export { SearchInput } from './SearchInput';
export { Pagination } from './Pagination';
export { FormField, inputClassName, selectClassName, textareaClassName } from './FormField';
export { ConfirmDialog } from './ConfirmDialog';
export { PageHeader } from './PageHeader';

// Re-export types for convenience
export type { UnifiedButtonProps } from './UnifiedComponents';
export type { UnifiedBadgeProps } from './UnifiedComponents';
export type { UnifiedCardProps } from './UnifiedComponents';
export type { UnifiedLabelProps } from './UnifiedComponents';
export type { SearchInputProps } from './SearchInput';
export type { PaginationProps } from './Pagination';
export type { FormFieldProps } from './FormField';
export type { ConfirmDialogProps } from './ConfirmDialog';
export type { PageHeaderProps } from './PageHeader';

export { StatusBadge } from './StatusBadge';
export { StatCard } from './StatCard';
export type { StatCardTrend } from './StatCard';
export { DataTable } from './DataTable';
export type { TableColumn } from './DataTable';

// Design-language primitives (Phase 2)
export { Icon } from './Icon';
export type { IconProps, IconWeight } from './Icon';
export { Segmented } from './Segmented';
export type { SegmentedProps, SegmentedOption } from './Segmented';
export { FilterChip } from './FilterChip';
export type { FilterChipProps } from './FilterChip';
export { SortableTableTh } from './SortableTableTh';
export type { SortDirection, SortableTableAccent } from './SortableTableTh';

// UnifiedComponents that were not previously re-exported
export {
 UnifiedModal,
 UnifiedInput,
 UnifiedSelect,
 UnifiedTableHeaderCell,
 UnifiedTableCell,
} from './UnifiedComponents';
export type {
 UnifiedInputProps,
 UnifiedSelectProps,
} from './UnifiedComponents';
