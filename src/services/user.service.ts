/**
 * User Service
 * Backend: staff users GET /api/v1/users/getusers?staffOnly=true, PATCH /api/v1/users/:id/role
 */

import { api } from '../lib/apiClient';
import type {
 User,
 UserUpdatePayload,
 Role,
 RoleCreatePayload,
 RoleUpdatePayload,
 UserRole,
} from '../types/user.types';
import type {
 PaginatedResponse,
 QueryParams,
 ServiceResult,
} from '../types/api.types';

/** Backend staff user from getusers?staffOnly=true */
export interface StaffUserFromApi {
 userid: number;
 id?: number;
 display_name: string;
 email: string;
 mobile?: string;
 usertype?: string;
 status?: string;
 created_at?: string;
 role_id?: number;
 role_name?: string;
 department?: string;
 vendor_client_id?: number | null;
 vendor_client_code?: string | null;
 vendor_client_type?: string | null;
}

// ==================== User CRUD Operations ====================

/** Minimal user for approver/search dropdown */
export interface UserSearchHit {
  userid: number;
  display_name: string;
  email: string;
}

/**
 * Search staff users by name or email. Backend: GET /api/v1/users/search?q=...
 * Use for approver dropdown (e.g. Universal Swap). Any authenticated user can call.
 */
export async function searchUsers(q: string): Promise<ServiceResult<UserSearchHit[]>> {
  try {
    const query = typeof q === 'string' && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '?q=';
    const list = await api.get<UserSearchHit[]>(`/api/v1/users/search${query}`);
    return { data: list ?? [], error: null, success: true };
  } catch (err) {
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : 'Error', status: 500 } as any,
      success: false,
    };
  }
}

/**
 * Fetch staff users only (internal team with staff_profiles). Backend: GET /api/v1/users/getusers?staffOnly=true
 */
const PORTAL_USERTYPES = new Set(['customer', 'doctor']);

export async function fetchStaffUsers(): Promise<ServiceResult<StaffUserFromApi[]>> {
 try {
  const list = await api.get<StaffUserFromApi[]>('/api/v1/users/getusers?staffOnly=true');
  const rows = (list ?? []).filter(
    (row) => !PORTAL_USERTYPES.has(String(row.usertype || '').trim().toLowerCase()),
  );
  return { data: rows, error: null, success: true };
 } catch (err) {
  return {
   data: null,
   error: { message: err instanceof Error ? err.message : 'Error', status: 500 } as any,
   success: false,
  };
 }
}

/**
 * Fetch all users with optional filtering and pagination
 * @placeholder Returns mock data - replace with API call
 */
export async function fetchUsers(
 _params?: QueryParams
): Promise<ServiceResult<PaginatedResponse<User>>> {
 return {
  data: null,
  error: null,
  success: true,
 };
}

/**
 * Fetch a single user by ID
 * @placeholder Returns mock data - replace with API call
 */
export async function fetchUserById(
 _userId: string
): Promise<ServiceResult<User>> {
 // TODO: Replace with actual API call
 // return apiClient.get<User>(`/users/${userId}`);
 return {
  data: null,
  error: null,
  success: true,
 };
}

/**
 * Create a staff user. Backend: POST /api/v1/users/create
 * Body: firstName, lastName, email, mobile, password, roleId, department?, status?
 */
export async function createStaffUser(payload: {
 firstName: string;
 lastName: string;
 email: string;
 mobile: string;
 password: string;
 role: string;
 roleId: number;
 status?: string;
}): Promise<ServiceResult<StaffUserFromApi>> {
 try {
  const body = {
   firstName: payload.firstName.trim(),
   lastName: payload.lastName.trim(),
   email: payload.email.trim(),
   mobile: payload.mobile.trim(),
   password: payload.password,
  role: payload.role.trim(),
   roleId: payload.roleId,
   status: payload.status || 'active',
  };
  const res = await api.post<StaffUserFromApi>('/api/v1/users/create', body);
  return { data: res, error: null, success: true };
 } catch (err) {
  const body = err && typeof err === 'object' && 'body' in err ? (err as { body?: { error?: string } }).body : undefined;
  return {
   data: null,
   error: { message: body?.error ?? "Error", status: 500 } as any,
   success: false,
  };
 }
}

/**
 * Update user profile (name, email, mobile, status). Backend: PATCH /api/v1/users/:id
 */
export async function updateUserProfile(
 userId: string,
 payload: { display_name?: string; name?: string; email?: string; mobile?: string; status?: string }
): Promise<ServiceResult<StaffUserFromApi>> {
 try {
  const body = { ...payload };
  if (body.name !== undefined) body.display_name = body.name;
  const res = await api.patch<StaffUserFromApi>(`/api/v1/users/${userId}`, body);
  return { data: res, error: null, success: true };
 } catch (err) {
  const body = err && typeof err === 'object' && 'body' in err ? (err as { body?: { error?: string } }).body : undefined;
  return {
   data: null,
   error: { message: body?.error ?? "Error", status: 500 } as any,
   success: false,
  };
 }
}

/**
 * Update an existing user (alias: use updateUserProfile + updateUserRole as needed)
 */
export async function updateUser(
 _userId: string,
 _userData: UserUpdatePayload
): Promise<ServiceResult<User>> {
 const profileRes = await updateUserProfile(_userId, {
  name: _userData.fullName,
  email: _userData.email,
  mobile: _userData.phone,
  status: _userData.status,
 });
 if (!profileRes.success) return { data: null, error: profileRes.error as any, success: false };
 return { data: null, error: null, success: true };
}

/**
 * Delete a user. Backend: DELETE /api/v1/users/:id
 */
export async function deleteUser(userId: string): Promise<ServiceResult<void>> {
 try {
  await api.delete(`/api/v1/users/${userId}`);
  return { data: undefined, error: null, success: true };
 } catch (err) {
  const body = err && typeof err === 'object' && 'body' in err ? (err as { body?: { error?: string } }).body : undefined;
  return {
   data: null,
   error: ((body && typeof body === 'object' && 'error' in body ? (body as { error?: string }).error : null) ?? (err instanceof Error ? err.message : 'Failed to delete user')) as any,
   success: false,
  };
 }
}

/**
 * Update user status
 * @placeholder Returns mock data - replace with API call
 */
export async function updateUserStatus(
 _userId: string,
 _status: User['status']
): Promise<ServiceResult<User>> {
 // TODO: Replace with actual API call
 // return apiClient.patch<User>(`/users/${userId}/status`, { status });
 return {
  data: null,
  error: null,
  success: true,
 };
}

/**
 * Update user's role and department (staff_profiles). Backend: PATCH /api/v1/users/:id/role
 */
export async function updateUserRole(
 userId: string,
 payload: { roleId: number; department?: string }
): Promise<ServiceResult<{ id: number; role_id: number; role_name: string; department: string | null }>> {
 try {
  const res = await api.patch<{ id: number; role_id: number; role_name: string; department: string | null }>(
   `/api/v1/users/${userId}/role`,
   payload
  );
  return { data: res, error: null, success: true };
 } catch (err) {
  const body = err && typeof err === 'object' && 'body' in err ? (err as { body?: { error?: string } }).body : undefined;
  return {
   data: null,
   error: { message: body?.error ?? "Error", status: 500 } as any,
   success: false,
  };
 }
}

/**
 * Assign role to user (alias for updateUserRole)
 */
export async function assignUserRole(
 _userId: string,
 _role: UserRole
): Promise<ServiceResult<User>> {
 // Backend expects roleId (number). UserRole is string enum - would need role list to resolve.
 return {
  data: null,
  error: null,
  success: true,
 };
}

// ==================== Role CRUD Operations ====================

/**
 * Fetch all roles. Backend: GET /api/v1/roles
 */
export async function fetchRoles(): Promise<ServiceResult<Role[]>> {
 try {
  const list = await api.get<Array<{ role_id: number; role_code: string; role_name: string; description?: string; level: string; status: string; userCount: number; createdAt: string }>>('/api/v1/roles');
  const roles: Role[] = (list ?? []).map((r) => ({
   id: String(r.role_id),
   name: r.role_name,
   description: r.description ?? '',
   permissions: [],
   userCount: r.userCount ?? 0,
   createdAt: r.createdAt,
   updatedAt: r.createdAt,
   isSystem: false,
  }));
  return { data: roles, error: null, success: true };
 } catch (err) {
  return {
   data: null,
   error: { message: err instanceof Error ? err.message : 'Error', status: 500 } as any,
   success: false,
  };
 }
}

/**
 * Fetch a single role by ID. Backend: GET /api/v1/roles/:id
 */
export async function fetchRoleById(roleId: string): Promise<ServiceResult<Role>> {
 try {
  const r = await api.get<{ role_id: number; role_name: string; description?: string; permissions?: Role['permissions'] }>(`/api/v1/roles/${roleId}`);
  const role: Role = {
   id: String(r.role_id),
   name: r.role_name,
   description: r.description ?? '',
   permissions: r.permissions ?? [],
   userCount: 0,
   createdAt: '',
   updatedAt: '',
   isSystem: false,
  };
  return { data: role, error: null, success: true };
 } catch (err) {
  return {
   data: null,
   error: { message: err instanceof Error ? err.message : 'Error', status: 500 } as any,
   success: false,
  };
 }
}

/**
 * Create a new role
 * @placeholder Returns mock data - replace with API call
 */
export async function createRole(
 _roleData: RoleCreatePayload
): Promise<ServiceResult<Role>> {
 // TODO: Replace with actual API call
 // return apiClient.post<Role>('/roles', roleData);
 return {
  data: null,
  error: null,
  success: true,
 };
}

/**
 * Update an existing role
 * @placeholder Returns mock data - replace with API call
 */
export async function updateRole(
 _roleId: string,
 _roleData: RoleUpdatePayload
): Promise<ServiceResult<Role>> {
 // TODO: Replace with actual API call
 // return apiClient.put<Role>(`/roles/${roleId}`, roleData);
 return {
  data: null,
  error: null,
  success: true,
 };
}

/**
 * Delete a role
 * @placeholder Returns mock data - replace with API call
 */
export async function deleteRole(
 _roleId: string
): Promise<ServiceResult<void>> {
 // TODO: Replace with actual API call
 // return apiClient.delete(`/roles/${roleId}`);
 return {
  data: null,
  error: null,
  success: true,
 };
}

// ==================== Permission Operations ====================

/**
 * Fetch all available permissions
 * @placeholder Returns mock data - replace with API call
 */
export async function fetchPermissions(): Promise<ServiceResult<Role['permissions']>> {
 // TODO: Replace with actual API call
 // return apiClient.get<Permission[]>('/permissions');
 return {
  data: null,
  error: null,
  success: true,
 };
}

/**
 * Update role permissions
 * @placeholder Returns mock data - replace with API call
 */
export async function updateRolePermissions(
 _roleId: string,
 _permissions: string[]
): Promise<ServiceResult<Role>> {
 // TODO: Replace with actual API call
 // return apiClient.patch<Role>(`/roles/${roleId}/permissions`, { permissions });
 return {
  data: null,
  error: null,
  success: true,
 };
}
