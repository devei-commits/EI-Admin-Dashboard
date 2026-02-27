/**
 * Common/shared type definitions
 * Reusable types used across multiple modules
 */

// ==================== UI Component Types ====================
export type BadgeVariant = 
 | 'default' 
 | 'success' 
 | 'warning' 
 | 'error' 
 | 'info' 
 | 'primary' 
 | 'secondary';

export type ButtonVariant = 
 | 'primary' 
 | 'secondary' 
 | 'outline' 
 | 'ghost' 
 | 'danger';

export type ButtonSize = 'sm' | 'md' | 'lg';

// ==================== Form Types ====================
export interface SelectOption {
 value: string;
 label: string;
 disabled?: boolean;
}

export interface FormFieldError {
 field: string;
 message: string;
}

export interface FormState<T> {
 data: T;
 errors: FormFieldError[];
 isSubmitting: boolean;
 isDirty: boolean;
}

// ==================== Table Types ====================
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
 key: string;
 direction: SortDirection;
}

export interface PaginationConfig {
 page: number;
 pageSize: number;
 total: number;
 totalPages: number;
}

export interface TableColumn<T> {
 key: keyof T | string;
 header: string;
 sortable?: boolean;
 width?: string;
 render?: (value: T[keyof T], row: T) => React.ReactNode;
}

// ==================== Modal Types ====================
export interface ModalProps {
 isOpen: boolean;
 onClose: () => void;
 title?: string;
 size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

// ==================== Filter Types ====================
export interface DateRange {
 from: string;
 to: string;
}

export interface BaseFilter {
 searchTerm: string;
 dateRange?: DateRange;
}

// ==================== Action Types ====================
export type ActionType = 'view' | 'edit' | 'delete' | 'export' | 'print';

export interface ActionButton {
 type: ActionType;
 label: string;
 icon?: React.ReactNode;
 disabled?: boolean;
 onClick: () => void;
}

// ==================== State Types ====================
export interface AsyncState<T> {
 data: T | null;
 loading: boolean;
 error: Error | null;
}

export interface LoadingState {
 isLoading: boolean;
 message?: string;
}

// ==================== Vendor/Client Types ====================
export interface Vendor {
 id: string;
 name: string;
 location: string;
 contactPerson: string;
 email: string;
 phone: string;
 status: 'Active' | 'Inactive';
 category: string;
 rating?: number;
}

export interface Client {
 id: string;
 name: string;
 companyName: string;
 address: string;
 email: string;
 phone: string;
 status: 'Active' | 'Inactive';
 accountManager?: string;
}

// ==================== Master Data Types ====================
export interface PackagingItem {
 id: string;
 pkgSku: string;
 pkgCode: string;
 name: string;
 category: string;
 material: string;
 volume: number;
 unit: string;
 status: 'Active' | 'Inactive' | 'Draft';
}

export interface RawMaterial {
 id: string;
 rmSku: string;
 inciName: string;
 tradeName: string;
 grade: string;
 category: string;
 unit: string;
 status: 'Active' | 'Inactive' | 'Draft';
}

export interface BOMRecord {
 id: string;
 bomCode: string;
 name: string;
 client: string;
 type: string;
 version: string;
 status: 'Draft' | 'Active' | 'Archived';
 rmLines: BOMLine[];
 pmLines: BOMLine[];
}

export interface BOMLine {
 id: string;
 code: string;
 name: string;
 quantity: number;
 unit: string;
 notes?: string;
}

// ==================== Notification Types ====================
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
 id: string;
 type: ToastType;
 title: string;
 message?: string;
 duration?: number;
}
