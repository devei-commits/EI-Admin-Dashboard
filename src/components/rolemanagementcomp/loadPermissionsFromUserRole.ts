import {
 DEFAULT_MODULE_PERMISSIONS,
 DEFAULT_GLOBAL_SETTINGS,
 createFullAccessPermissions,
 type ModulePermission,
 type GlobalSettings,
} from './types/permissions.types';
import { parseApiPermissions } from './types/permissionKeys';
import { getRoleById, type BackendRoleDetail } from '../../services/role.service';

function adminFullGlobalSettings(): GlobalSettings {
 return {
  ...DEFAULT_GLOBAL_SETTINGS,
  accessToAllModules: true,
  allowLogin: true,
  allowMultipleSessions: true,
  canChangePassword: true,
  enableAuditLog: true,
  canExportData: true,
  canImportData: true,
  canAccessReports: true,
  canAccessSettings: true,
 };
}

function isAdminRole(role: BackendRoleDetail): boolean {
 const level = String(role.level || '').toLowerCase();
 const name = String(role.role_name || '').toLowerCase();
 const code = String(role.role_code || '').toLowerCase();
 return (
  level === 'admin' ||
  name === 'super admin' ||
  name === 'admin' ||
  code === 'super_admin' ||
  code === 'admin'
 );
}

function cloneModules(modules: ModulePermission[]): ModulePermission[] {
 return JSON.parse(JSON.stringify(modules)) as ModulePermission[];
}

export interface LoadedPermissionsFromUser {
 modules: ModulePermission[];
 globalSettings: GlobalSettings;
 sourceUserLabel: string;
 sourceRoleName: string;
 sourceRoleId: number;
}

/**
 * Load permission matrix + global settings from a staff user's assigned role.
 */
export async function loadPermissionsFromUserRole(
 roleId: number,
 sourceUserLabel: string
): Promise<LoadedPermissionsFromUser> {
 const role = await getRoleById(roleId);

 if (isAdminRole(role)) {
  return {
   modules: cloneModules(createFullAccessPermissions()),
   globalSettings: adminFullGlobalSettings(),
   sourceUserLabel,
   sourceRoleName: role.role_name,
   sourceRoleId: role.role_id,
  };
 }

 const { modules, globalSettings } = parseApiPermissions(
  role.permissions,
  DEFAULT_MODULE_PERMISSIONS,
  DEFAULT_GLOBAL_SETTINGS
 );

 return {
  modules: cloneModules(modules),
  globalSettings: { ...globalSettings },
  sourceUserLabel,
  sourceRoleName: role.role_name,
  sourceRoleId: role.role_id,
 };
}
