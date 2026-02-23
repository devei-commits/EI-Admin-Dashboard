/**
 * User Service
 * Backend: staff users GET /api/v1/users/getusers?staffOnly=true, PATCH /api/v1/users/:id/role
 */

import { api } from '../lib/apiClient';
import type {
  User,
  UserCreatePayload,
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
}

// ==================== User CRUD Operations ====================

/**
 * Fetch staff users only (internal team with staff_profiles). Backend: GET /api/v1/users/getusers?staffOnly=true
 */
export async function fetchStaffUsers(): Promise<ServiceResult<StaffUserFromApi[]>> {
  try {
    const list = await api.get<StaffUserFromApi[]>('/api/v1/users/getusers?staffOnly=true');
    return { data: list ?? [], error: null, success: true };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to fetch staff users',
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
  console.warn('[UserService] fetchUsers: Using placeholder implementation');
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
  
  console.warn('[UserService] fetchUserById: Using placeholder implementation');
  return {
    data: null,
    error: null,
    success: true,
  };
}

/**
 * Create a new user
 * @placeholder Returns mock data - replace with API call
 */
export async function createUser(
  _userData: UserCreatePayload
): Promise<ServiceResult<User>> {
  // TODO: Replace with actual API call
  // return apiClient.post<User>('/users', userData);
  
  console.warn('[UserService] createUser: Using placeholder implementation');
  return {
    data: null,
    error: null,
    success: true,
  };
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
      error: body?.error ?? (err instanceof Error ? err.message : 'Failed to update user'),
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
  const profileRes = await updateUserProfile(userId, {
    name: userData.fullName,
    email: userData.email,
    mobile: userData.phone,
    status: userData.status,
  });
  if (!profileRes.success) return { data: null, error: profileRes.error, success: false };
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
      error: (body && typeof body === 'object' && 'error' in body ? (body as { error?: string }).error : null) ?? (err instanceof Error ? err.message : 'Failed to delete user'),
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
  
  console.warn('[UserService] updateUserStatus: Using placeholder implementation');
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
      error: body?.error ?? (err instanceof Error ? err.message : 'Failed to update role'),
      success: false,
    };
  }
}

/**
 * Assign role to user (alias for updateUserRole)
 */
export async function assignUserRole(
  userId: string,
  role: UserRole
): Promise<ServiceResult<User>> {
  // Backend expects roleId (number). UserRole is string enum - would need role list to resolve.
  console.warn('[UserService] assignUserRole: Prefer updateUserRole(userId, { roleId, department })');
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
      error: err instanceof Error ? err.message : 'Failed to fetch roles',
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
      error: err instanceof Error ? err.message : 'Failed to fetch role',
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
  
  console.warn('[UserService] createRole: Using placeholder implementation');
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
  
  console.warn('[UserService] updateRole: Using placeholder implementation');
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
  
  console.warn('[UserService] deleteRole: Using placeholder implementation');
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
  
  console.warn('[UserService] fetchPermissions: Using placeholder implementation');
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
  
  console.warn('[UserService] updateRolePermissions: Using placeholder implementation');
  return {
    data: null,
    error: null,
    success: true,
  };
}
