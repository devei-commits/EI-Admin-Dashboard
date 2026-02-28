# Project Optimization & Restructuring Plan
# Eisthetic EI Admin — Full Execution Guide

> **Last synced with codebase:** commit `1eea977` — "Order Management and Masters totally completed" (Mar 1, 2026)
>
> **Key changes reflected in this version vs original:**
> - localStorage keys corrected: `bom_draft_new`, `packaging_draft_new`, `raw_material_draft_new`
> - PackagingRefactored.tsx flagged as special case — only `useAutoSave` applies, NOT `useDraftLoader`
> - UnifiedModal `size` prop confirmed missing — Step 5.1 now includes exact code to add it
> - New file `SwapMaterialModal.tsx` (231 lines) added to modal migration list (Step 5.8)
> - SalesAndPurchase.tsx grew to 2001 lines — Phase 6B added to split it
> - Both `UniversalSwap.tsx` and `UniversalSwapPage.tsx` confirmed as separate active routes — both kept
> - Phase 5 modal list expanded to include ordermanagementcomp modals (14 total now)

## CRITICAL RULES — READ BEFORE ANY STEP

### FROZEN FILES — DO NOT TOUCH, EDIT, MOVE, OR RENAME
```
src/lib/apiClient.ts
src/lib/queryClient.ts
src/context/AuthContext.tsx
src/hooks/usePermissions.ts
src/services/auth.service.ts
src/services/role.service.ts
src/services/user.service.ts
src/components/ProtectedModuleRoute.tsx
src/components/rolemanagementcomp/          ← entire folder
src/pages/Login.tsx
src/pages/UserManagement.tsx
src/pages/RoleManagement.tsx
```

### FROZEN VALUES — DO NOT CHANGE THESE STRINGS ANYWHERE
- All URL path strings in `src/App.tsx` (e.g. `"/bom/new"`, `"/raw-material"`, `"/bmr-bpr"`)
- All `moduleId` and `subModuleId` values in `ProtectedModuleRoute` wrappers
- All keys in `MODULE_ROUTE_MAP` and `ROUTE_MODULE_MAP` inside `src/hooks/usePermissions.ts`
- All backend API endpoint strings (e.g. `"/api/v1/roles"`, `"/api/v1/users/login"`)

### IMPORT UPDATE RULE
Whenever a file is moved or renamed, update ONLY the `import` path — never change the URL route, moduleId, or component logic.

### CONTEXT
- All data in this project is mock/dummy data — will be connected to backend via API calls later
- Auth, Role Management, and User Management are already connected to a live backend
- All optimizations must preserve every URL route, every moduleId, every function behavior, and every UI interaction exactly as-is

---

## PHASE 1 — Type Deduplication (Zero Risk)

### Step 1.1 — Create `src/types/bmr.types.ts`

Create this file with all shared BMR types currently duplicated across
`BatchConfirmationModal.tsx`, `MaterialRequestModal.tsx`, `UpdateStockModal.tsx`,
`Warehouse.tsx`, `Dispensing.tsx`, `UnderProduction.tsx`, and `BMRBPR.tsx`.

```ts
// src/types/bmr.types.ts

export type BMRStage = 'Pending' | 'Scheduled' | 'In Production' | 'QC Review' | 'Completed';

export interface MaterialItem {
  id: string;
  name: string;
  code: string;
  quantity: number;
  unit: string;
  source: string;
  status: string;
}

export interface MaterialRequest {
  id: string;
  batchId: string;
  productName: string;
  batchNumber: string;
  requestedBy: string;
  requestDate: string;
  items: MaterialItem[];
  status: 'Pending' | 'Approved' | 'Dispatched' | 'Received';
}

export interface DispensingRequest {
  id: string;
  batchId: string;
  productName: string;
  batchNumber: string;
  items: MaterialItem[];
  status: 'Pending' | 'In Progress' | 'Completed';
  dispensedBy?: string;
  dispensedAt?: string;
}

export interface ProducingBatch {
  id: string;
  productName: string;
  batchNumber: string;
  stage: BMRStage;
  startDate: string;
  targetDate: string;
  quantity: number;
  unit: string;
  assignedTo: string;
}

export interface QCReviewItem {
  id: string;
  batchId: string;
  productName: string;
  batchNumber: string;
  parameter: string;
  specification: string;
  result?: string;
  status: 'Pending' | 'Pass' | 'Fail';
}
```

After creating this file, in each of these files remove the duplicate local interface
and replace with an import:
```ts
import type { MaterialItem, MaterialRequest, DispensingRequest, ProducingBatch, BMRStage } from '../../types/bmr.types';
```
Files to update:
- `src/components/bmr/BatchConfirmationModal.tsx`
- `src/components/bmr/MaterialRequestModal.tsx`
- `src/components/bmr/UpdateStockModal.tsx`
- `src/components/bmr/Warehouse.tsx`
- `src/components/bmr/Dispensing.tsx`
- `src/components/bmr/UnderProduction.tsx`
- `src/pages/BMRBPR.tsx`

---

### Step 1.2 — Create `src/constants/statusMaps.ts`

Create this file. Do NOT modify any component yet — just create the constants.

```ts
// src/constants/statusMaps.ts

export const BMR_STATUS_COLORS: Record<string, string> = {
  'Pending':        'bg-gray-100 text-gray-700 border border-gray-200',
  'Scheduled':      'bg-yellow-100 text-yellow-700 border border-yellow-200',
  'In Production':  'bg-blue-100 text-blue-700 border border-blue-200',
  'QC Review':      'bg-orange-100 text-orange-700 border border-orange-200',
  'Completed':      'bg-green-100 text-green-700 border border-green-200',
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  'Draft':          'bg-gray-100 text-gray-600',
  'Pending':        'bg-yellow-100 text-yellow-700',
  'Confirmed':      'bg-blue-100 text-blue-700',
  'In Progress':    'bg-indigo-100 text-indigo-700',
  'Completed':      'bg-green-100 text-green-700',
  'Cancelled':      'bg-red-100 text-red-700',
  'On Hold':        'bg-orange-100 text-orange-700',
};

export const GENERAL_STATUS_COLORS: Record<string, string> = {
  'Active':         'bg-green-100 text-green-700',
  'Inactive':       'bg-gray-100 text-gray-600',
  'Approved':       'bg-green-100 text-green-700',
  'Rejected':       'bg-red-100 text-red-700',
  'Under Review':   'bg-yellow-100 text-yellow-700',
  'Pass':           'bg-green-100 text-green-700',
  'Fail':           'bg-red-100 text-red-700',
};

export const ALL_STATUS_COLORS: Record<string, string> = {
  ...BMR_STATUS_COLORS,
  ...ORDER_STATUS_COLORS,
  ...GENERAL_STATUS_COLORS,
};
```

---

### Step 1.3 — Create `src/constants/routes.ts`

Move the route maps OUT of `usePermissions.ts` by creating this file.
Do NOT remove them from `usePermissions.ts` yet — just duplicate here for now.
(usePermissions.ts will import from here in a future phase.)

```ts
// src/constants/routes.ts

export const MODULE_ROUTE_MAP: Record<string, string> = {
  'dashboard': '/',
  'pis': '/pis',
  'order-management': '/order-management',
  'inventory': '/raw-material',
  'vendor-client': '/vendor-client',
  'sales-purchase': '/sales-and-purchase',
  'treasury': '/treasury',
  'enquiry-management': '/enquiry-management',
  'task-management': '/task-management',
  'user-management': '/user-management',
  'role-management': '/role-management',
  'settings': '/settings',
  'catalogue-management': '/catalogue-management',
  'items-master': '/items-master',
  'active-ingredients': '/active-ingredients',
  'coupon-management': '/coupon-management',
  'discount-management': '/discount-management',
  'doctor-appointments': '/doctor-appointments',
  'contact-enquiry': '/contact-enquiry',
  'new-developments': '/new-developments',
  'product-samples': '/product-samples',
  'packaging-management': '/packaging-management',
};

export const ROUTE_MODULE_MAP: Record<string, string> = {
  '/': 'dashboard',
  '/pis': 'pis',
  '/order-management': 'order-management',
  '/good-receiving': 'order-management',
  '/raw-material': 'inventory',
  '/packaging': 'inventory',
  '/bom': 'inventory',
  '/vendor-client': 'vendor-client',
  '/sales-and-purchase': 'sales-purchase',
  '/treasury': 'treasury',
  '/enquiry-management': 'enquiry-management',
  '/doctor-appointments': 'doctor-appointments',
  '/contact-enquiry': 'contact-enquiry',
  '/new-developments': 'new-developments',
  '/product-samples': 'product-samples',
  '/task-management': 'task-management',
  '/user-management': 'user-management',
  '/role-management': 'role-management',
  '/catalogue-management': 'catalogue-management',
  '/packaging-management': 'packaging-management',
  '/active-ingredients': 'active-ingredients',
  '/items-master': 'items-master',
  '/coupon-management': 'coupon-management',
  '/discount-management': 'discount-management',
};
```

---

## PHASE 2 — New Shared UI Components (Additive, No Breaking Changes)

### Step 2.1 — Create `src/components/ui/StatusBadge.tsx`

```tsx
// src/components/ui/StatusBadge.tsx
import React from 'react';
import { ALL_STATUS_COLORS } from '../../constants/statusMaps';

interface StatusBadgeProps {
  status: string;
  /** Optional override map for domain-specific colors */
  colorMap?: Record<string, string>;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  colorMap,
  className = '',
}) => {
  const map = colorMap ?? ALL_STATUS_COLORS;
  const colorClass = map[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${colorClass} ${className}`}>
      {status}
    </span>
  );
};

export default StatusBadge;
```

---

### Step 2.2 — Create `src/components/ui/StatCard.tsx`

```tsx
// src/components/ui/StatCard.tsx
import React, { ReactNode } from 'react';

interface StatCardProps {
  icon: ReactNode;
  title: string;
  value: string | number;
  description?: string;
  iconBgClass?: string;
  iconColorClass?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  title,
  value,
  description,
  iconBgClass = 'bg-blue-100',
  iconColorClass = 'text-blue-600',
}) => (
  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${iconBgClass}`}>
        <span className={iconColorClass}>{icon}</span>
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
    </div>
  </div>
);

export default StatCard;
```

---

### Step 2.3 — Create `src/components/ui/DataTable.tsx`

```tsx
// src/components/ui/DataTable.tsx
import React, { useState, useMemo, ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export interface TableColumn<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T, index: number) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyField?: keyof T;
  emptyMessage?: string;
  className?: string;
  rowClassName?: (row: T) => string;
  onRowClick?: (row: T) => void;
}

type SortDir = 'asc' | 'desc' | null;

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  emptyMessage = 'No data found.',
  className = '',
  rowClassName,
  onRowClick,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const handleSort = (key: string) => {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); return; }
    if (sortDir === 'asc') { setSortDir('desc'); return; }
    setSortKey(null); setSortDir(null);
  };

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const SortIcon = ({ col }: { col: TableColumn<T> }) => {
    if (!col.sortable) return null;
    const key = String(col.key);
    if (sortKey !== key) return <ChevronsUpDown className="w-3.5 h-3.5 text-gray-400 ml-1 inline" />;
    if (sortDir === 'asc') return <ChevronUp className="w-3.5 h-3.5 text-blue-500 ml-1 inline" />;
    return <ChevronDown className="w-3.5 h-3.5 text-blue-500 ml-1 inline" />;
  };

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                onClick={() => col.sortable && handleSort(String(col.key))}
                className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 ${col.sortable ? 'cursor-pointer select-none hover:bg-gray-100' : ''} ${col.headerClassName ?? ''}`}
              >
                {col.label}
                <SortIcon col={col} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-gray-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sorted.map((row, idx) => (
              <tr
                key={keyField ? String(row[keyField as string]) : idx}
                onClick={() => onRowClick?.(row)}
                className={`hover:bg-gray-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${rowClassName?.(row) ?? ''}`}
              >
                {columns.map((col) => (
                  <td key={String(col.key)} className={`px-4 py-3 ${col.className ?? ''}`}>
                    {col.render
                      ? col.render(row[String(col.key)], row, idx)
                      : String(row[String(col.key)] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
```

---

### Step 2.4 — Update `src/components/ui/index.ts`

Add the new exports to the existing barrel file. Do not remove any existing exports.

```ts
// ADD these lines to the existing src/components/ui/index.ts
export { StatusBadge } from './StatusBadge';
export { StatCard } from './StatCard';
export { DataTable } from './DataTable';
export type { TableColumn } from './DataTable';
```

---

## PHASE 3 — Custom Hooks

### Step 3.1 — Create `src/hooks/useAutoSave.ts`

```ts
// src/hooks/useAutoSave.ts
import { useEffect } from 'react';

/**
 * Auto-saves `data` to localStorage under `key` every `intervalMs` milliseconds.
 * Replaces duplicate useEffect blocks in BOMRefactored, PackagingRefactored, RawMaterialRefactored.
 */
export function useAutoSave(key: string, data: unknown, intervalMs = 30000): void {
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch {
        // ignore storage errors
      }
    }, intervalMs);
    return () => clearInterval(interval);
  }, [key, data, intervalMs]);
}

export default useAutoSave;
```

---

### Step 3.2 — Create `src/hooks/useDraftLoader.ts`

```ts
// src/hooks/useDraftLoader.ts
import { useEffect } from 'react';

/**
 * Loads saved draft from localStorage on mount and calls setData with the parsed value.
 * Replaces duplicate draft-loading useEffect blocks in form pages.
 */
export function useDraftLoader<T>(key: string, setData: (data: Partial<T>) => void): void {
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<T>;
        setData(parsed);
      }
    } catch {
      // ignore parse errors
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

export default useDraftLoader;
```

---

### Step 3.3 — Create `src/hooks/useSearchFilter.ts`

```ts
// src/hooks/useSearchFilter.ts
import { useState, useMemo } from 'react';
import { useDebounce } from './useDebounce';

interface UseSearchFilterReturn<T> {
  search: string;
  setSearch: (value: string) => void;
  filtered: T[];
}

/**
 * Generic search filter hook. Filters `data` by checking if any of the `fields`
 * contain the search string (case-insensitive, debounced 300ms).
 */
export function useSearchFilter<T extends Record<string, unknown>>(
  data: T[],
  fields: (keyof T)[]
): UseSearchFilterReturn<T> {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const filtered = useMemo(() => {
    if (!debouncedSearch.trim()) return data;
    const q = debouncedSearch.toLowerCase();
    return data.filter((item) =>
      fields.some((field) => String(item[field] ?? '').toLowerCase().includes(q))
    );
  }, [data, debouncedSearch, fields]);

  return { search, setSearch, filtered };
}

export default useSearchFilter;
```

---

### Step 3.4 — Apply hooks to form pages

**IMPORTANT — Actual localStorage keys (verified from source code):**
- `BOMRefactored.tsx` uses `'bom_draft_new'`
- `PackagingRefactored.tsx` uses `'packaging_draft_new'`
- `RawMaterialRefactored.tsx` uses `'raw_material_draft_new'`

Use these exact keys in the hook calls — do NOT change them, existing saved drafts
in users' browsers depend on these keys.

**In `src/pages/BOMRefactored.tsx`:**
- Remove the `useEffect` at line ~91 that calls `setInterval` writing to localStorage
- Remove the `useEffect` at line ~102 that reads from localStorage on mount
- Add imports and calls using the correct key:

```tsx
import { useAutoSave } from '../hooks/useAutoSave';
import { useDraftLoader } from '../hooks/useDraftLoader';

// Inside the component, after formData state declaration:
useAutoSave('bom_draft_new', formData);
useDraftLoader('bom_draft_new', (saved) => setFormData(prev => ({ ...prev, ...saved })));
```

**In `src/pages/RawMaterialRefactored.tsx`:**
- Remove the auto-save `setInterval` useEffect (line ~130)
- Remove the draft-loading useEffect (line ~140)
- Replace with:
```tsx
useAutoSave('raw_material_draft_new', formData);
useDraftLoader('raw_material_draft_new', (saved) => setFormData(prev => ({ ...prev, ...saved })));
```

**In `src/pages/PackagingRefactored.tsx` — SPECIAL CASE:**
This file has more complex draft loading that includes:
- A toast flag key `'packaging_draft_toast_shown'`
- A counter key `'pm_code_counters'`
- Conditional toast display on load

Do NOT apply `useDraftLoader` here. Only apply `useAutoSave`:
```tsx
useAutoSave('packaging_draft_new', formData);
```
Keep the existing draft-load `useEffect` exactly as-is since it has extra logic
(toast flag + counter restoration) that `useDraftLoader` does not handle.

---

## PHASE 4 — Service Layer for Mock Pages (API-Ready Architecture)

The pattern used here matches `auth.service.ts` and `role.service.ts` exactly.
When backend endpoints are ready, only the function body changes — zero component changes needed.

### Step 4.1 — Create `src/services/bom.service.ts`

```ts
// src/services/bom.service.ts
import type { ServiceResult } from '../types/api.types';

export interface BOMRecord {
  id: string;
  bomCode: string;
  bomSku: string;
  name: string;
  type: string;
  status: string;
  version: string;
  client: string;
  createdAt: string;
}

// MOCK — when backend ready, replace body with:
// return api.get<BOMRecord[]>('/api/v1/bom')
export async function fetchBOMs(): Promise<ServiceResult<BOMRecord[]>> {
  return { data: [], error: null, success: true };
}

// MOCK — replace with: return api.get<BOMRecord>(`/api/v1/bom/${id}`)
export async function fetchBOMById(_id: string): Promise<ServiceResult<BOMRecord>> {
  return { data: null, error: null, success: true };
}

// MOCK — replace with: return api.post<BOMRecord>('/api/v1/bom', payload)
export async function createBOM(_payload: Partial<BOMRecord>): Promise<ServiceResult<BOMRecord>> {
  return { data: null, error: null, success: true };
}

// MOCK — replace with: return api.put<BOMRecord>(`/api/v1/bom/${id}`, payload)
export async function updateBOM(_id: string, _payload: Partial<BOMRecord>): Promise<ServiceResult<BOMRecord>> {
  return { data: null, error: null, success: true };
}
```

---

### Step 4.2 — Create `src/services/bmr.service.ts`

```ts
// src/services/bmr.service.ts
import type { ServiceResult } from '../types/api.types';
import type { ProducingBatch, MaterialRequest } from '../types/bmr.types';

// MOCK — replace with: return api.get<ProducingBatch[]>('/api/v1/bmr')
export async function fetchBMRBatches(): Promise<ServiceResult<ProducingBatch[]>> {
  return { data: [], error: null, success: true };
}

// MOCK — replace with: return api.get<MaterialRequest[]>('/api/v1/bmr/material-requests')
export async function fetchMaterialRequests(): Promise<ServiceResult<MaterialRequest[]>> {
  return { data: [], error: null, success: true };
}
```

---

### Step 4.3 — Create `src/services/procurement.service.ts`

```ts
// src/services/procurement.service.ts
import type { ServiceResult } from '../types/api.types';

export interface ProcurementRequest {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
  status: string;
  requestedBy: string;
  requestDate: string;
  vendor?: string;
  estimatedCost?: number;
}

// MOCK — replace with: return api.get<ProcurementRequest[]>('/api/v1/procurement')
export async function fetchProcurementRequests(): Promise<ServiceResult<ProcurementRequest[]>> {
  return { data: [], error: null, success: true };
}

// MOCK — replace with: return api.post<ProcurementRequest>('/api/v1/procurement', payload)
export async function createProcurementRequest(
  _payload: Partial<ProcurementRequest>
): Promise<ServiceResult<ProcurementRequest>> {
  return { data: null, error: null, success: true };
}
```

---

## PHASE 5 — Modal Consolidation

### Step 5.1 — Add `size` prop to UnifiedModal in `src/components/ui/UnifiedComponents.tsx`

**Current state (verified):** `UnifiedModal` already has `footer` prop but is MISSING `size` prop.
The modal width is hardcoded as `max-w-4xl`. Add `size` before migrating any modal.

Change the `UnifiedModalProps` interface from:
```ts
export interface UnifiedModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}
```
To:
```ts
export interface UnifiedModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}
```

And update the modal container div to use `size`:
```tsx
// Replace the hardcoded max-w-4xl with a size map:
const sizeClass = {
  sm:   'max-w-md',
  md:   'max-w-2xl',
  lg:   'max-w-4xl',
  xl:   'max-w-6xl',
  full: 'max-w-[95vw]',
}[size ?? 'lg'];

// Then use: className={`bg-white rounded-xl shadow-lg w-full ${sizeClass} max-h-[90vh] overflow-auto`}
```

### Step 5.2 — Migrate each modal

For each of the files listed below, remove the outer overlay/container shell JSX
and replace with `<UnifiedModal>`. Keep ALL internal form state, handlers, and
body JSX completely unchanged.

**BMR modals** (`src/components/bmr/`):
- `BatchConfirmationModal.tsx`
- `MaterialRequestModal.tsx`
- `QCReviewModal.tsx`
- `ScheduleBMRModal.tsx`
- `SubmitBMRModal.tsx`
- `UpdateStockModal.tsx`

**Order management modals** (`src/components/ordermanagementcomp/`) — new since last plan:
- `SwapMaterialModal.tsx` (new file, 231 lines — added in latest commit, migrate immediately)
- `BatchPlannerModal.tsx`
- `ConsolidatedMRModal.tsx`
- `CpoDetailModal.tsx`
- `DelayImpactModal.tsx`
- `DraftSplitModal.tsx`
- `GRNWizardModal.tsx`
- `ItemDetailModal.tsx`

Pattern — remove this kind of shell:
```tsx
// REMOVE:
<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
  <div className="bg-white rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
    <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
      <h2 className="text-xl font-bold">Modal Title</h2>
      <button onClick={onClose}><X className="w-5 h-5" /></button>
    </div>
    {/* body */}
    <div className="p-6 border-t sticky bottom-0 bg-white flex justify-end gap-3">
      <button onClick={onClose}>Cancel</button>
      <button onClick={onConfirm}>Confirm</button>
    </div>
  </div>
</div>
```

Replace with:
```tsx
// ADD IMPORT:
import { UnifiedModal } from '../ui/UnifiedComponents';

// REPLACE SHELL WITH:
<UnifiedModal
  isOpen={isOpen}
  onClose={onClose}
  title="Modal Title"
  size="lg"
  footer={
    <div className="flex justify-end gap-3">
      <button onClick={onClose}>Cancel</button>
      <button onClick={onConfirm}>Confirm</button>
    </div>
  }
>
  {/* same body content, unchanged */}
</UnifiedModal>
```

---

## PHASE 6 — Split Large Pages

### Phase 6A — Split Procurement.tsx (5872 lines)

**CRITICAL: The URL `/procurement` and `moduleId="order-management"` must NOT change.**

### Step 6.1 — Create folder `src/pages/procurement/`

### Step 6.2 — Create `src/types/procurement.types.ts`
Extract all interfaces currently defined inline in `Procurement.tsx`
(e.g. `RequestStatus`, `QuoteStatus`, `Vendor`, `ProcurementItem`, etc.)
into this file and import them back into Procurement.tsx temporarily.

### Step 6.3 — Create `src/pages/procurement/ProcurementRequests.tsx`
Extract the "Requests" tab content, state, and handlers from `Procurement.tsx`.
```tsx
// src/pages/procurement/ProcurementRequests.tsx
export default function ProcurementRequests() {
  // all state and handlers for the requests tab
  // all JSX for the requests tab
}
```

### Step 6.4 — Create `src/pages/procurement/ProcurementVendors.tsx`
Extract the "Vendors" tab content.
```tsx
export default function ProcurementVendors() { ... }
```

### Step 6.5 — Create `src/pages/procurement/ProcurementReports.tsx`
Extract the "Reports" tab content.
```tsx
export default function ProcurementReports() { ... }
```

### Step 6.6 — Create `src/pages/procurement/index.tsx`
Thin shell that composes the three tab components. Keep the same tab bar UI as current.
```tsx
// src/pages/procurement/index.tsx
import React, { useState } from 'react';
import ProcurementRequests from './ProcurementRequests';
import ProcurementVendors from './ProcurementVendors';
import ProcurementReports from './ProcurementReports';

type Tab = 'requests' | 'vendors' | 'reports';

export default function Procurement() {
  const [activeTab, setActiveTab] = useState<Tab>('requests');
  return (
    <div>
      {/* Same tab navigation UI as original Procurement.tsx */}
      {activeTab === 'requests' && <ProcurementRequests />}
      {activeTab === 'vendors' && <ProcurementVendors />}
      {activeTab === 'reports' && <ProcurementReports />}
    </div>
  );
}
```

### Step 6A.7 — Update `src/App.tsx` — ONE LINE ONLY

```tsx
// BEFORE:
const Procurement = lazy(() => import('./pages/Procurement'))

// AFTER:
const Procurement = lazy(() => import('./pages/procurement/index'))
```

The routes `path="/procurement"` and `moduleId="order-management"` stay identical.

### Step 6A.8 — Delete `src/pages/Procurement.tsx` ONLY after verifying Step 6A.7 builds and works.

---

### Phase 6B — Split SalesAndPurchase.tsx (2001 lines)

**New since last plan version.** `SalesAndPurchase.tsx` has grown to 2001 lines.
It has `activeTab: 'sales' | 'purchase'` state and two large tab sections.

**CRITICAL: The URL `/sales-and-purchase` and `moduleId="sales-purchase"` must NOT change.**

#### Step 6B.1 — Create `src/types/salesPurchase.types.ts`
Extract inline interfaces from `SalesAndPurchase.tsx`:
- `OrderStatus` interface
- `Order` interface
- Any other inline types

#### Step 6B.2 — Create `src/pages/SalesOrders.tsx`
Extract the `activeTab === 'sales'` content, state, and handlers into this file.
```tsx
// src/pages/SalesOrders.tsx
export default function SalesOrders() {
  // state and handlers for the sales tab
}
```

#### Step 6B.3 — Create `src/pages/PurchaseOrdersPage.tsx`
Extract the `activeTab === 'purchase'` content.
```tsx
// src/pages/PurchaseOrdersPage.tsx
export default function PurchaseOrdersPage() {
  // state and handlers for the purchase tab
}
```

#### Step 6B.4 — Slim down `SalesAndPurchase.tsx`
Keep only the tab navigation and shared state in the original file.
Import and render `SalesOrders` and `PurchaseOrdersPage` based on `activeTab`.
The App.tsx import path and URL route stay unchanged.

---

## PHASE 7 — File Renames

**RULE: Only update the import in App.tsx. URL paths and moduleIds never change.**

### Rename procedure for each file:
1. Create new file at new path, copy content, update `export default function` name if desired
2. Update the ONE import line in `App.tsx`
3. Run build to verify zero errors
4. Delete the old file

| Current File | New File | App.tsx change |
|---|---|---|
| `src/pages/BOMRefactored.tsx` | `src/pages/BOMForm.tsx` | `import('./pages/BOMForm')` |
| `src/pages/PackagingRefactored.tsx` | `src/pages/PackagingForm.tsx` | `import('./pages/PackagingForm')` |
| `src/pages/RawMaterialRefactored.tsx` | `src/pages/RawMaterialForm.tsx` | `import('./pages/RawMaterialForm')` |
| `src/pages/BMRBPR.tsx` | `src/pages/BMRPage.tsx` | `import('./pages/BMRPage')` |
| `src/pages/GoodReceivingPage.tsx` | `src/pages/GoodReceiving.tsx` | `import('./pages/GoodReceiving')` |

---

## PHASE 8 — Folder Renames (Components Only)

These folders are NOT referenced in App.tsx routing directly (except one noted).
Update all internal cross-file imports after each rename.

### Step 8.1 — Rename `ordermanagementcomp` → `orders`
- Old: `src/components/ordermanagementcomp/`
- New: `src/components/orders/`
- Update all `import ... from '..../ordermanagementcomp/...'` across codebase
- Update this one App.tsx line:
  ```tsx
  // BEFORE:
  const PurchaseOrders = lazy(() => import('./components/ordermanagementcomp/PurchaseOrders'))
  // AFTER:
  const PurchaseOrders = lazy(() => import('./components/orders/PurchaseOrders'))
  ```
- Rename `index.ts` inside the folder accordingly

### Step 8.2 — Create `src/components/bmr/modals/` subfolder
Move all `*Modal.tsx` files from `src/components/bmr/` into `src/components/bmr/modals/`.
Update imports in `src/pages/BMRBPR.tsx` (or BMRPage.tsx after Phase 7).

### Step 8.3 — Move sidebar file
- Old: `src/components/sidebar/sidebar.tsx`
- New: `src/components/Sidebar.tsx`
- Update App.tsx:
  ```tsx
  // BEFORE:
  import Sidebar from "./components/sidebar/sidebar"
  // AFTER:
  import Sidebar from "./components/Sidebar"
  ```

---

## PHASE 9 — Sidebar Nav Externalization

### Step 9.1 — Read `src/components/sidebar/sidebar.tsx` fully before starting this phase.

### Step 9.2 — Create `src/constants/navigation.ts`

Extract all hardcoded nav item arrays from sidebar.tsx into a typed config.
Every `path`, `moduleId`, and `subModuleId` value must be copied exactly — do not change them.

```ts
// src/constants/navigation.ts

export interface NavItem {
  label: string;
  path: string;
  moduleId: string;
  subModuleId?: string;
  iconName?: string;
  children?: NavItem[];
}

// Mirror exact structure from sidebar.tsx — keep every path and moduleId identical
export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/',
    moduleId: 'dashboard',
  },
  // ... copy every nav item from sidebar.tsx
];
```

### Step 9.3 — Refactor `Sidebar.tsx` to render from `NAV_ITEMS`
Replace hardcoded JSX nav blocks with a `.map()` over `NAV_ITEMS`.
Keep all `usePermissions`, `hasModuleAccess`, `NavLink`, and `useLocation` logic exactly as-is.
Only the static nav item data moves out — the rendering and permission logic stays in the component.

---

## PHASE 10 — Data / Mocks Cleanup

### Step 10.1 — Create `src/mocks/` folder
Move all files from `src/data/` into `src/mocks/` with cleaner names:

| Old | New |
|---|---|
| `src/data/zohoItemsSeed.ts` | `src/mocks/zohoItems.mock.ts` |
| `src/data/zohoRawMaterialsSeed.ts` | `src/mocks/zohoRawMaterials.mock.ts` |
| `src/data/zohoClientsSeed.ts` | `src/mocks/zohoClients.mock.ts` |
| `src/data/zohoVendorsSeed.ts` | `src/mocks/zohoVendors.mock.ts` |
| `src/data/procurement-data.json` | `src/mocks/procurement-data.json` |

Update all imports of these files across the codebase.

---

## PHASE 11 — Dead File Audit

Before deleting any file, search the entire codebase for its name to confirm zero imports.

| File | Status | Action |
|---|---|---|
| `src/pages/UniversalSwap.tsx` | **Confirmed active** — Route `/universal-swap` uses this | Keep |
| `src/pages/UniversalSwapPage.tsx` | **Confirmed active** — Route `/universal-swap-page` uses this (495 lines, new file) | Keep |
| `src/pages/PackagingManagement.tsx` | Route `/packaging-management` uses this | Keep |
| `src/pages/Procurement.tsx` | Will be replaced by Phase 6A | Delete AFTER Phase 6A verified |

---

## EXECUTION CHECKLIST

```
Phase 1 — Type Deduplication
  [ ] 1.1 Create src/types/bmr.types.ts
  [ ] 1.2 Update 7 BMR files to import from bmr.types.ts (remove local duplicates)
  [ ] 1.3 Create src/constants/statusMaps.ts
  [ ] 1.4 Create src/constants/routes.ts

Phase 2 — New Shared Components
  [ ] 2.1 Create src/components/ui/StatusBadge.tsx
  [ ] 2.2 Create src/components/ui/StatCard.tsx
  [ ] 2.3 Create src/components/ui/DataTable.tsx
  [ ] 2.4 Update src/components/ui/index.ts with new exports

Phase 3 — Custom Hooks
  [ ] 3.1 Create src/hooks/useAutoSave.ts
  [ ] 3.2 Create src/hooks/useDraftLoader.ts
  [ ] 3.3 Create src/hooks/useSearchFilter.ts
  [ ] 3.4 Apply hooks in BOMRefactored.tsx
  [ ] 3.5 Apply hooks in PackagingRefactored.tsx
  [ ] 3.6 Apply hooks in RawMaterialRefactored.tsx

Phase 4 — Service Layer
  [ ] 4.1 Create src/services/bom.service.ts
  [ ] 4.2 Create src/services/bmr.service.ts
  [ ] 4.3 Create src/services/procurement.service.ts

Phase 5 — Modal Consolidation
  [ ] 5.1 Add size prop to UnifiedModal in UnifiedComponents.tsx
  [ ] 5.2 Migrate BMR: BatchConfirmationModal.tsx
  [ ] 5.3 Migrate BMR: MaterialRequestModal.tsx
  [ ] 5.4 Migrate BMR: QCReviewModal.tsx
  [ ] 5.5 Migrate BMR: ScheduleBMRModal.tsx
  [ ] 5.6 Migrate BMR: SubmitBMRModal.tsx
  [ ] 5.7 Migrate BMR: UpdateStockModal.tsx
  [ ] 5.8 Migrate orders: SwapMaterialModal.tsx (new file)
  [ ] 5.9 Migrate orders: BatchPlannerModal.tsx
  [ ] 5.10 Migrate orders: ConsolidatedMRModal.tsx
  [ ] 5.11 Migrate orders: CpoDetailModal.tsx
  [ ] 5.12 Migrate orders: DelayImpactModal.tsx
  [ ] 5.13 Migrate orders: DraftSplitModal.tsx
  [ ] 5.14 Migrate orders: GRNWizardModal.tsx
  [ ] 5.15 Migrate orders: ItemDetailModal.tsx

Phase 6A — Split Procurement.tsx (5872 lines)
  [ ] 6A.1 Create src/pages/procurement/ folder
  [ ] 6A.2 Create src/types/procurement.types.ts
  [ ] 6A.3 Create ProcurementRequests.tsx
  [ ] 6A.4 Create ProcurementVendors.tsx
  [ ] 6A.5 Create ProcurementReports.tsx
  [ ] 6A.6 Create procurement/index.tsx
  [ ] 6A.7 Update App.tsx import for Procurement (ONE LINE ONLY)
  [ ] 6A.8 Verify build passes, then delete src/pages/Procurement.tsx

Phase 6B — Split SalesAndPurchase.tsx (2001 lines)
  [ ] 6B.1 Create src/types/salesPurchase.types.ts
  [ ] 6B.2 Create src/pages/SalesOrders.tsx (sales tab content)
  [ ] 6B.3 Create src/pages/PurchaseOrdersPage.tsx (purchase tab content)
  [ ] 6B.4 Slim SalesAndPurchase.tsx to tab shell only

Phase 7 — File Renames
  [ ] 7.1 BOMRefactored.tsx → BOMForm.tsx + update App.tsx
  [ ] 7.2 PackagingRefactored.tsx → PackagingForm.tsx + update App.tsx
  [ ] 7.3 RawMaterialRefactored.tsx → RawMaterialForm.tsx + update App.tsx
  [ ] 7.4 BMRBPR.tsx → BMRPage.tsx + update App.tsx
  [ ] 7.5 GoodReceivingPage.tsx → GoodReceiving.tsx + update App.tsx

Phase 8 — Folder Renames
  [ ] 8.1 ordermanagementcomp/ → orders/ + update all imports + App.tsx
  [ ] 8.2 Create bmr/modals/ subfolder + update imports in BMRPage.tsx
  [ ] 8.3 sidebar/sidebar.tsx → Sidebar.tsx + update App.tsx

Phase 9 — Sidebar
  [ ] 9.1 Create src/constants/navigation.ts with NAV_ITEMS config
  [ ] 9.2 Refactor Sidebar.tsx to render from NAV_ITEMS (keep all permission logic)

Phase 10 — Data Cleanup
  [ ] 10.1 Create src/mocks/ folder
  [ ] 10.2 Move and rename all files from src/data/
  [ ] 10.3 Update all imports of moved files

Phase 11 — Dead File Audit
  [ ] 11.1 Search codebase for each candidate file before deleting
  [ ] 11.2 Delete only confirmed-unused files
```

---

## AFTER EVERY PHASE — MANDATORY VERIFICATION

Run these checks after completing each phase before moving to the next:

1. `npm run build` — must complete with zero TypeScript errors
2. Login page loads and auth works
3. Role Management page loads, lists roles from backend API
4. User Management page loads, lists staff from backend API
5. Sidebar shows correct modules based on logged-in user permissions
6. Click through every route in the sidebar — confirm all pages load
7. No red errors in browser DevTools console

---

## ABSOLUTE RESTRICTIONS — NEVER DO THESE

1. Do NOT change any `path="..."` string in App.tsx routes
2. Do NOT change any `moduleId` or `subModuleId` value in any ProtectedModuleRoute
3. Do NOT edit `src/hooks/usePermissions.ts`
4. Do NOT edit `src/context/AuthContext.tsx`
5. Do NOT edit `src/services/auth.service.ts`
6. Do NOT edit `src/services/role.service.ts`
7. Do NOT edit `src/services/user.service.ts`
8. Do NOT edit `src/lib/apiClient.ts`
9. Do NOT edit `src/lib/queryClient.ts`
10. Do NOT edit `src/components/ProtectedModuleRoute.tsx`
11. Do NOT edit anything inside `src/components/rolemanagementcomp/`
12. Do NOT delete any file without first confirming zero imports of it in the codebase
13. Do NOT change the export name of any page component without updating App.tsx to match
14. Do NOT touch `src/pages/Login.tsx`, `src/pages/UserManagement.tsx`, `src/pages/RoleManagement.tsx`
