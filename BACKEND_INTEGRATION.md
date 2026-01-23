# Backend Integration Guide

This document outlines the service abstraction layer and type system created for future backend integration.

## Architecture Overview

The codebase has been refactored to follow a clean architecture pattern with:

1. **Shared Types** (`src/types/`) - Centralized TypeScript interfaces
2. **Service Layer** (`src/services/`) - Backend abstraction with placeholder implementations
3. **Reusable Hooks** (`src/hooks/`) - Stateless, reusable UI logic

## Directory Structure

```
src/
├── types/
│   ├── index.ts          # Central export for all types
│   ├── order.types.ts    # Order, OrderHub, BOM, GoodReceiving types
│   ├── user.types.ts     # User, Role, Permission, Auth types
│   ├── common.types.ts   # UI components, forms, tables, pagination
│   └── api.types.ts      # API response/request, pagination, errors
├── services/
│   ├── index.ts          # Central export for all services
│   ├── order.service.ts  # Order CRUD, status updates, BOM, filters
│   ├── user.service.ts   # User CRUD, role management, permissions
│   ├── master.service.ts # Raw materials, packaging, vendors, clients
│   └── auth.service.ts   # Authentication, sessions, password management
└── hooks/
    ├── index.ts          # Central export for all hooks
    ├── useDebounce.ts    # Value debouncing for search/filter
    ├── useOutsideClick.ts # Click outside detection for dropdowns
    ├── usePagination.ts  # Client-side pagination logic
    ├── useFilter.ts      # Filtering, searching, sorting
    ├── useModal.ts       # Modal open/close state management
    └── useToggle.ts      # Boolean toggle and multi-select
```

## Service Layer Integration

### Current State
All service functions are **placeholder implementations** that:
- Log warnings to console
- Return empty `ServiceResult<T>` objects
- Include TODO comments for actual API implementation

### Integration Steps

1. **Configure API Client**
   Create `src/lib/apiClient.ts`:
   ```typescript
   import axios from 'axios';

   export const apiClient = axios.create({
     baseURL: process.env.VITE_API_URL,
     headers: { 'Content-Type': 'application/json' }
   });

   // Add auth interceptor
   apiClient.interceptors.request.use(config => {
     const token = localStorage.getItem('accessToken');
     if (token) config.headers.Authorization = `Bearer ${token}`;
     return config;
   });
   ```

2. **Replace Service Placeholders**
   Each service function has a TODO comment showing the expected API call:
   ```typescript
   // Current placeholder:
   export async function fetchOrders(params?: QueryParams): Promise<ServiceResult<PaginatedResponse<Order>>> {
     // TODO: Replace with actual API call
     // return apiClient.get<PaginatedResponse<Order>>('/orders', { params });
     console.warn('[OrderService] fetchOrders: Using placeholder implementation');
     return { data: null, error: null, isSuccess: true };
   }

   // After integration:
   export async function fetchOrders(params?: QueryParams): Promise<ServiceResult<PaginatedResponse<Order>>> {
     try {
       const response = await apiClient.get<PaginatedResponse<Order>>('/orders', { params });
       return { data: response.data, error: null, isSuccess: true };
     } catch (error) {
       return { data: null, error: parseError(error), isSuccess: false };
     }
   }
   ```

3. **Connect React Query**
   Use the existing React Query setup in `src/lib/queryClient.ts`:
   ```typescript
   import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
   import { fetchOrders, updateOrderStatus } from '@/services';

   // In your component:
   const { data, isLoading, error } = useQuery({
     queryKey: ['orders', filters],
     queryFn: () => fetchOrders(filters)
   });
   ```

## Type System

### Core Types by Module

#### Order Types (`order.types.ts`)
- `Order` - Full order entity
- `OrderHubItem` - Order Hub dashboard item
- `OrderReview` - Order stage review data
- `BOMItem` - Bill of Materials item
- `GoodReceivingRecord` - Goods receiving entry
- `AuditLog` - Order change history

#### User Types (`user.types.ts`)
- `User` - User profile
- `Role` - Role with permissions
- `Permission` - Individual permission
- `AuthState` - Current auth state
- `LoginCredentials` - Login payload

#### API Types (`api.types.ts`)
- `ServiceResult<T>` - Unified service response
- `PaginatedResponse<T>` - Paginated list response
- `QueryParams` - Common query parameters
- `ApiError` - Standardized error object

### Type Usage Example
```typescript
import type { Order, OrderStatus } from '@/types';
import type { ServiceResult, PaginatedResponse } from '@/types/api.types';

async function getActiveOrders(): Promise<Order[]> {
  const result: ServiceResult<PaginatedResponse<Order>> = await fetchOrders({
    filters: { status: 'Processing' }
  });
  
  if (result.isSuccess && result.data) {
    return result.data.items;
  }
  return [];
}
```

## Hooks Usage

### useDebounce
```typescript
const [searchQuery, setSearchQuery] = useState('');
const debouncedQuery = useDebounce(searchQuery, 300);

useEffect(() => {
  // Fetch only when debounced value changes
  fetchResults(debouncedQuery);
}, [debouncedQuery]);
```

### usePagination
```typescript
const { 
  paginatedItems, 
  currentPage, 
  totalPages, 
  goToPage, 
  nextPage, 
  previousPage 
} = usePagination(items, { initialPageSize: 10 });
```

### useFilter
```typescript
const { 
  filteredItems, 
  searchQuery, 
  setSearchQuery, 
  setFilter, 
  toggleSort 
} = useFilter(orders, {
  searchFields: ['orderCode', 'customer'],
  initialSort: { field: 'createdAt', direction: 'desc' }
});
```

### useModal
```typescript
const editModal = useModal<User>();

// Open modal with data
<button onClick={() => editModal.openWith(user)}>Edit</button>

// Use modal state
{editModal.isOpen && <Modal onClose={editModal.close} user={editModal.data} />}
```

## API Endpoints Reference

When implementing the backend, use these endpoint conventions:

### Orders
- `GET /orders` - List orders (paginated)
- `GET /orders/:id` - Get single order
- `POST /orders` - Create order
- `PUT /orders/:id` - Update order
- `DELETE /orders/:id` - Delete order
- `PATCH /orders/:id/status` - Update status
- `GET /orders/:id/audit-logs` - Get history

### Users
- `GET /users` - List users
- `GET /users/:id` - Get user
- `POST /users` - Create user
- `PUT /users/:id` - Update user
- `PATCH /users/:id/status` - Update status
- `PATCH /users/:id/role` - Assign role

### Roles
- `GET /roles` - List roles
- `POST /roles` - Create role
- `PUT /roles/:id` - Update role
- `PATCH /roles/:id/permissions` - Update permissions

### Authentication
- `POST /auth/login` - Login
- `POST /auth/logout` - Logout
- `POST /auth/refresh` - Refresh token
- `GET /auth/me` - Get current user
- `POST /auth/password-reset/request` - Request reset
- `POST /auth/password-reset/confirm` - Confirm reset
- `POST /auth/change-password` - Change password

### Master Data
- `GET /raw-materials` - List raw materials
- `GET /packaging` - List packaging items
- `GET /vendors` - List vendors
- `GET /clients` - List clients
- `GET /items` - List items
- `GET /active-ingredients` - List active ingredients

## Migration Notes

### What Changed
1. Types moved from inline definitions to `src/types/`
2. Service layer created with typed interfaces
3. Hooks extracted from components to `src/hooks/`
4. Unused imports and dead code removed
5. Components refactored to use external SortButton components

### What Remained
- All UI output unchanged
- All page behavior unchanged
- All routing unchanged
- No new dependencies added

## Next Steps

1. Create actual backend API (Node.js/Express, .NET, etc.)
2. Replace placeholder service implementations
3. Add authentication middleware
4. Implement real-time updates with WebSockets (optional)
5. Add comprehensive error handling
6. Set up environment-specific configurations
