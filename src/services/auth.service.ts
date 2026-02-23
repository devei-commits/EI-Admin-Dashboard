/**
 * Auth Service
 * Backend: POST /api/v1/users/login, GET /api/v1/users/me, GET /api/v1/users/logout
 */

import { api, setAuthToken, clearAuthToken } from '../lib/apiClient';
import type {
  AuthState,
  LoginCredentials,
  AuthResponse,
  User,
} from '../types/user.types';
import type { ServiceResult } from '../types/api.types';

// ==================== Type Definitions ====================

export interface TokenPayload {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface PasswordResetPayload {
  email: string;
}

export interface PasswordChangePayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface SessionInfo {
  sessionId: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  ipAddress?: string;
  userAgent?: string;
}

/** Backend login response */
interface LoginResponse {
  success: boolean;
  token?: string;
  skipOtp?: boolean;
  userid?: number;
  otp?: unknown;
}

/** Backend /me response (staff gets roleId, roleName, roleLevel, department) */
interface MeResponse {
  userid: number;
  fname?: string;
  lname?: string;
  display_name?: string;
  email: string;
  mobile?: string;
  usertype?: string;
  status?: string;
  roleId?: number;
  roleName?: string;
  roleLevel?: string;
  department?: string;
  addresses?: unknown[];
}

// ==================== Authentication Operations ====================

/**
 * Login with email and password. Backend returns token directly for staff (skip OTP).
 */
export async function login(
  credentials: LoginCredentials
): Promise<ServiceResult<AuthResponse>> {
  try {
    const res = await api.post<LoginResponse>('/api/v1/users/login', {
      email: credentials.username,
      password: credentials.password,
    }, { skipAuth: true });
    if (!res.token) {
      return { data: null, error: 'Login requires OTP verification.', success: false };
    }
    setAuthToken(res.token);
    const meResult = await getCurrentUser();
    if (!meResult.success || !meResult.data) {
      clearAuthToken();
      return { data: null, error: meResult.error || 'Failed to load user', success: false };
    }
    return {
      data: {
        user: meResult.data,
        token: res.token,
        refreshToken: '',
        expiresIn: 7 * 24 * 60 * 60,
      },
      error: null,
      success: true,
    };
  } catch (err: unknown) {
    const message = err && typeof err === 'object' && 'body' in err
      ? (err as { body?: { error?: string } }).body?.error
      : err instanceof Error ? err.message : 'Login failed';
    return { data: null, error: String(message), success: false };
  }
}

/**
 * Logout: clear cookie on backend and clear local token.
 */
export async function logout(): Promise<ServiceResult<void>> {
  try {
    await api.get('/api/v1/users/logout');
  } catch {
    // ignore
  }
  clearAuthToken();
  return { data: null, error: null, success: true };
}

/**
 * Refresh access token using refresh token cookie (GET /api/v1/users/token).
 */
export async function refreshToken(
  _refreshToken: string
): Promise<ServiceResult<TokenPayload>> {
  try {
    const res = await api.get<{ token: string }>('/api/v1/users/token');
    if (res?.token) setAuthToken(res.token);
    return {
      data: { accessToken: res?.token ?? '', expiresIn: 7 * 24 * 60 * 60 },
      error: null,
      success: true,
    };
  } catch {
    return { data: null, error: 'Refresh failed', success: false };
  }
}

/**
 * Get current user (GET /api/v1/users/me). Staff get roleId, roleName, roleLevel, department.
 */
export async function getCurrentUser(): Promise<ServiceResult<User>> {
  try {
    const me = await api.get<MeResponse>('/api/v1/users/me');
    const user: User = {
      id: String(me.userid),
      username: me.email,
      email: me.email,
      fullName: me.display_name ?? ([me.fname, me.lname].filter(Boolean).join(' ') || me.email),
      role: (me.roleName as User['role']) ?? 'VIEWER',
      status: (me.status === 'active' ? 'Active' : me.status === 'inactive' ? 'Inactive' : 'Pending') as User['status'],
      department: me.department,
      phone: me.mobile,
      createdAt: '',
      updatedAt: '',
      roleId: me.roleId,
      roleName: me.roleName,
      roleLevel: me.roleLevel,
    };
    return { data: user, error: null, success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load user';
    return { data: null, error: String(message), success: false };
  }
}

/**
 * Update current user profile
 * @placeholder Returns mock data - replace with API call
 */
export async function updateProfile(
  _data: Partial<User>
): Promise<ServiceResult<User>> {
  // TODO: Replace with actual API call
  // return apiClient.put<User>('/auth/profile', data);
  
  console.warn('[AuthService] updateProfile: Using placeholder implementation');
  return {
    data: null,
    error: null,
    success: true,
  };
}

// ==================== Password Operations ====================

/**
 * Request password reset email
 * @placeholder Returns mock data - replace with API call
 */
export async function requestPasswordReset(
  _payload: PasswordResetPayload
): Promise<ServiceResult<void>> {
  // TODO: Replace with actual API call
  // return apiClient.post('/auth/password-reset/request', payload);
  
  console.warn('[AuthService] requestPasswordReset: Using placeholder implementation');
  return {
    data: null,
    error: null,
    success: true,
  };
}

/**
 * Reset password with token
 * @placeholder Returns mock data - replace with API call
 */
export async function resetPassword(
  _token: string,
  _newPassword: string
): Promise<ServiceResult<void>> {
  // TODO: Replace with actual API call
  // return apiClient.post('/auth/password-reset/confirm', { token, newPassword });
  
  console.warn('[AuthService] resetPassword: Using placeholder implementation');
  return {
    data: null,
    error: null,
    success: true,
  };
}

/**
 * Change password for logged-in user
 * @placeholder Returns mock data - replace with API call
 */
export async function changePassword(
  _payload: PasswordChangePayload
): Promise<ServiceResult<void>> {
  // TODO: Replace with actual API call
  // return apiClient.post('/auth/change-password', payload);
  
  console.warn('[AuthService] changePassword: Using placeholder implementation');
  return {
    data: null,
    error: null,
    success: true,
  };
}

// ==================== Session Management ====================

/**
 * Get all active sessions for current user
 * @placeholder Returns mock data - replace with API call
 */
export async function getActiveSessions(): Promise<ServiceResult<SessionInfo[]>> {
  // TODO: Replace with actual API call
  // return apiClient.get<SessionInfo[]>('/auth/sessions');
  
  console.warn('[AuthService] getActiveSessions: Using placeholder implementation');
  return {
    data: null,
    error: null,
    success: true,
  };
}

/**
 * Revoke a specific session
 * @placeholder Returns mock data - replace with API call
 */
export async function revokeSession(
  _sessionId: string
): Promise<ServiceResult<void>> {
  // TODO: Replace with actual API call
  // return apiClient.delete(`/auth/sessions/${sessionId}`);
  
  console.warn('[AuthService] revokeSession: Using placeholder implementation');
  return {
    data: null,
    error: null,
    success: true,
  };
}

/**
 * Revoke all sessions except current
 * @placeholder Returns mock data - replace with API call
 */
export async function revokeAllSessions(): Promise<ServiceResult<void>> {
  // TODO: Replace with actual API call
  // return apiClient.delete('/auth/sessions/all');
  
  console.warn('[AuthService] revokeAllSessions: Using placeholder implementation');
  return {
    data: null,
    error: null,
    success: true,
  };
}

// ==================== Token Utilities ====================

/**
 * Check if access token is valid and not expired
 * @placeholder Returns mock data - replace with API call
 */
export async function validateToken(
  _token: string
): Promise<ServiceResult<{ valid: boolean; expiresAt?: string }>> {
  // TODO: Replace with actual API call
  // return apiClient.post('/auth/validate', { token });
  
  console.warn('[AuthService] validateToken: Using placeholder implementation');
  return {
    data: { valid: true },
    error: null,
    success: true,
  };
}

/**
 * Get current auth state from local storage/session
 * This is a client-side only operation
 */
export function getStoredAuthState(): AuthState | null {
  // TODO: Implement actual storage retrieval
  // const stored = localStorage.getItem('authState');
  // return stored ? JSON.parse(stored) : null;
  
  console.warn('[AuthService] getStoredAuthState: Using placeholder implementation');
  return null;
}

/**
 * Store auth state to local storage/session
 * This is a client-side only operation
 */
export function storeAuthState(_state: AuthState): void {
  // TODO: Implement actual storage
  // localStorage.setItem('authState', JSON.stringify(state));
  
  console.warn('[AuthService] storeAuthState: Using placeholder implementation');
}

/**
 * Clear stored auth state
 * This is a client-side only operation
 */
export function clearStoredAuthState(): void {
  // TODO: Implement actual storage clearing
  // localStorage.removeItem('authState');
  
  console.warn('[AuthService] clearStoredAuthState: Using placeholder implementation');
}
