/**
 * Role Service — Backend RBAC API
 * GET/POST/PUT/DELETE /api/v1/roles, GET /api/v1/roles/module-definitions
 */

import { api } from '../lib/apiClient';
import type { ModulePermission, GlobalSettings } from '../components/rolemanagementcomp/types/permissions.types';

export interface BackendRoleListItem {
  role_id: number;
  role_code: string;
  role_name: string;
  description: string | null;
  level: string;
  status: string;
  userCount: number;
  /** True when this role has at least one granted permission key stored. */
  permissionsSet: boolean;
  createdAt: string;
}

/** Backend stores only minimal state: granted keys + globalSettings. Module tree lives in frontend. */
export interface BackendRoleDetail {
  role_id: number;
  role_code: string;
  role_name: string;
  description: string | null;
  level: string;
  status: string;
  created_at: string;
  updated_at: string;
  permissions?: {
    granted: string[];
    globalSettings?: GlobalSettings;
  };
}

export interface ModuleDefinitionsResponse {
  modules: ModulePermission[];
  globalSettings: GlobalSettings;
}

/** Minimal state only: list of granted permission keys + optional globalSettings. */
export interface CreateRolePayload {
  role_code: string;
  role_name: string;
  description?: string;
  level: string;
  status?: string;
  permissions?: { granted: string[]; globalSettings?: GlobalSettings };
}

export async function listRoles(): Promise<BackendRoleListItem[]> {
  return api.get<BackendRoleListItem[]>('/api/v1/roles');
}

export async function getRoleById(roleId: string | number): Promise<BackendRoleDetail> {
  return api.get<BackendRoleDetail>(`/api/v1/roles/${roleId}`);
}

export async function getModuleDefinitions(): Promise<ModuleDefinitionsResponse> {
  return api.get<ModuleDefinitionsResponse>('/api/v1/roles/module-definitions');
}

export async function createRole(payload: CreateRolePayload): Promise<BackendRoleDetail> {
  return api.post<BackendRoleDetail>('/api/v1/roles', payload);
}

export async function updateRole(roleId: string | number, payload: CreateRolePayload): Promise<BackendRoleDetail> {
  return api.put<BackendRoleDetail>(`/api/v1/roles/${roleId}`, payload);
}

export async function deleteRole(roleId: string | number): Promise<void> {
  return api.delete(`/api/v1/roles/${roleId}`);
}
