/**
 * User and Role type definitions
 * Used across User Management and Role Management components
 */

// ==================== User Types ====================
export type UserStatus = 'Active' | 'Inactive' | 'Pending' | 'Suspended';

export type UserRole = 
  | 'SUPER_ADMIN' 
  | 'ADMIN' 
  | 'MANAGER' 
  | 'USER' 
  | 'VIEWER';

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  department?: string;
  phone?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

export interface UserCreatePayload {
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  department?: string;
  phone?: string;
  password: string;
}

export interface UserUpdatePayload {
  email?: string;
  fullName?: string;
  role?: UserRole;
  status?: UserStatus;
  department?: string;
  phone?: string;
}

// ==================== Role Types ====================
export interface Permission {
  id: string;
  name: string;
  description: string;
  module: string;
  actions: PermissionAction[];
}

export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'export';

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  userCount: number;
  createdAt: string;
  updatedAt: string;
  isSystem: boolean;
}

export interface RoleCreatePayload {
  name: string;
  description: string;
  permissions: string[];
}

export interface RoleUpdatePayload {
  name?: string;
  description?: string;
  permissions?: string[];
}

// ==================== Authentication Types ====================
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  role: UserRole | null;
  permissions: Permission[];
}

export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  expiresIn: number;
}
