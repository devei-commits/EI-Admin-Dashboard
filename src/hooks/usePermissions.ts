/**
 * Role-Based Permission Hook
 * Uses user.roleId from AuthContext (from backend /me). Loads permissions from GET /api/v1/roles/:roleId when not admin.
 */

import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/apiClient';
import { 
  RolePermissions, 
  GlobalSettings,
  DEFAULT_MODULE_PERMISSIONS,
  DEFAULT_GLOBAL_SETTINGS
} from '../components/rolemanagementcomp/types/permissions.types';
import { parseApiPermissions } from '../components/rolemanagementcomp/types/permissionKeys';

export interface PermissionCheck {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canExport: boolean;
}

export interface ColumnPermissionCheck {
  canView: boolean;
  canEdit: boolean;
}

export interface UsePermissionsReturn {
  // Check module access
  hasModuleAccess: (moduleId: string) => boolean;
  
  // Check sub-module permissions
  getSubModulePermissions: (moduleId: string, subModuleId: string) => PermissionCheck;
  
  // Check specific action
  canPerformAction: (moduleId: string, subModuleId: string, action: keyof PermissionCheck) => boolean;
  
  // Check column permissions
  getColumnPermission: (moduleId: string, subModuleId: string, columnId: string) => ColumnPermissionCheck;
  
  // Get all permissions for current user
  userPermissions: RolePermissions | null;
  
  // Global settings
  globalSettings: GlobalSettings;
  
  // Check if user is admin (full access)
  isAdmin: boolean;
  
  // Check if user has any permission for a module
  hasAnyPermission: (moduleId: string) => boolean;
  
  // Get visible modules for sidebar
  getVisibleModules: () => string[];
  
  // Loading state
  isLoading: boolean;
}

/** Backend GET /roles/:id response — permissions are minimal state only (granted[] + globalSettings) */
interface RoleApiResponse {
  role_id: number;
  role_code: string;
  role_name: string;
  permissions?: { granted?: string[]; globalSettings?: GlobalSettings; modules?: RolePermissions['modules'] };
}

function toRolePermissions(roleId: string, roleName: string, res: RoleApiResponse): RolePermissions {
  const { modules, globalSettings } = parseApiPermissions(
    res.permissions,
    DEFAULT_MODULE_PERMISSIONS,
    DEFAULT_GLOBAL_SETTINGS
  );
  return {
    roleId,
    roleName,
    modules,
    globalSettings,
    lastUpdated: new Date().toISOString(),
    updatedBy: 'api'
  };
}

export const usePermissions = (): UsePermissionsReturn => {
  const { user, isLoading: authLoading } = useAuth();
  const [rolePermissionsFromApi, setRolePermissionsFromApi] = useState<RolePermissions | null>(null);
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  const isAdminByRole = useMemo(() => {
    if (!user) return false;
    const name = (user.roleName ?? '').toLowerCase();
    const roleLevel = (user.roleLevel ?? '').toLowerCase();
    return (
      name === 'super admin' || name === 'super_admin' || name === 'superadmin' ||
      name === 'admin' ||
      roleLevel === 'admin'
    );
  }, [user]);

  useEffect(() => {
    if (!user || isAdminByRole || !user.roleId) {
      setRolePermissionsFromApi(null);
      return;
    }
    const roleId = String(user.roleId);
    setPermissionsLoading(true);
    api.get<RoleApiResponse>(`/api/v1/roles/${roleId}`)
      .then((res) => {
        setRolePermissionsFromApi(toRolePermissions(roleId, user.roleName || res.role_name, res));
      })
      .catch(() => setRolePermissionsFromApi(null))
      .finally(() => setPermissionsLoading(false));
  }, [user?.id, user?.roleId, user?.roleName, isAdminByRole]);

  const { userPermissions, globalSettings, isAdmin } = useMemo(() => {
    if (!user) {
      return {
        userPermissions: null as RolePermissions | null,
        globalSettings: DEFAULT_GLOBAL_SETTINGS,
        isAdmin: false
      };
    }

    // Backend /me returns allowedModules: only show sidebar items and allow API calls for those modules
    if (user.allowedModules && user.allowedModules.length > 0) {
      return {
        userPermissions: null as RolePermissions | null,
        globalSettings: DEFAULT_GLOBAL_SETTINGS,
        isAdmin: user.allowedModules.includes('*')
      };
    }

    if (isAdminByRole) {
      const fullAccessPermissions: RolePermissions = {
        roleId: String(user.roleId || 'super-admin'),
        roleName: user.roleName || 'Super Admin',
        modules: DEFAULT_MODULE_PERMISSIONS.map(module => ({
          ...module,
          subModules: module.subModules.map(sub => ({
            ...sub,
            actions: { view: true, create: true, edit: true, delete: true, approve: true, export: true },
            columns: sub.columns.map(col => ({ ...col, view: true, edit: true }))
          }))
        })),
        globalSettings: {
          ...DEFAULT_GLOBAL_SETTINGS,
          accessToAllModules: true,
          allowLogin: true,
          canExportData: true,
          canImportData: true,
          canAccessReports: true,
          canAccessSettings: true
        },
        lastUpdated: new Date().toISOString(),
        updatedBy: 'system'
      };
      return {
        userPermissions: fullAccessPermissions,
        globalSettings: fullAccessPermissions.globalSettings,
        isAdmin: true
      };
    }

    if (rolePermissionsFromApi) {
      return {
        userPermissions: rolePermissionsFromApi,
        globalSettings: rolePermissionsFromApi.globalSettings,
        isAdmin: rolePermissionsFromApi.globalSettings.accessToAllModules || false
      };
    }

    return {
      userPermissions: null,
      globalSettings: DEFAULT_GLOBAL_SETTINGS,
      isAdmin: false
    };
  }, [user, isAdminByRole, rolePermissionsFromApi]);

  // Check if user has access to a module (allowedModules from /me, or role permissions)
  const hasModuleAccess = (moduleId: string): boolean => {
    if (user?.allowedModules?.length) {
      return user.allowedModules!.includes('*') || user.allowedModules!.includes(moduleId);
    }
    if (isAdmin) return true;
    if (!userPermissions) return false;

    const module = userPermissions.modules.find(m => m.moduleId === moduleId);
    if (!module) return false;

    return module.subModules.some(sub => sub.actions.view);
  };

  // Get permissions for a specific sub-module
  const getSubModulePermissions = (moduleId: string, subModuleId: string): PermissionCheck => {
    const defaultPermission: PermissionCheck = {
      canView: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canApprove: false,
      canExport: false
    };

    if (isAdmin) {
      return {
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canApprove: true,
        canExport: true
      };
    }

    if (!userPermissions) return defaultPermission;

    const module = userPermissions.modules.find(m => m.moduleId === moduleId);
    if (!module) return defaultPermission;

    const subModule = module.subModules.find(s => s.subModuleId === subModuleId);
    if (!subModule) return defaultPermission;

    return {
      canView: subModule.actions.view,
      canCreate: subModule.actions.create,
      canEdit: subModule.actions.edit,
      canDelete: subModule.actions.delete,
      canApprove: subModule.actions.approve,
      canExport: subModule.actions.export
    };
  };

  // Check if user can perform a specific action
  const canPerformAction = (
    moduleId: string, 
    subModuleId: string, 
    action: keyof PermissionCheck
  ): boolean => {
    const permissions = getSubModulePermissions(moduleId, subModuleId);
    return permissions[action];
  };

  // Get column-level permissions
  const getColumnPermission = (
    moduleId: string, 
    subModuleId: string, 
    columnId: string
  ): ColumnPermissionCheck => {
    const defaultPermission: ColumnPermissionCheck = { canView: false, canEdit: false };

    if (isAdmin) {
      return { canView: true, canEdit: true };
    }

    if (!userPermissions) return defaultPermission;

    const module = userPermissions.modules.find(m => m.moduleId === moduleId);
    if (!module) return defaultPermission;

    const subModule = module.subModules.find(s => s.subModuleId === subModuleId);
    if (!subModule) return defaultPermission;

    const column = subModule.columns.find(c => c.columnId === columnId);
    if (!column) return defaultPermission;

    return {
      canView: column.view,
      canEdit: column.edit
    };
  };

  // Check if user has any permission in a module
  const hasAnyPermission = (moduleId: string): boolean => {
    if (isAdmin) return true;
    if (!userPermissions) return false;

    const module = userPermissions.modules.find(m => m.moduleId === moduleId);
    if (!module) return false;

    return module.subModules.some(sub => 
      sub.actions.view || 
      sub.actions.create || 
      sub.actions.edit || 
      sub.actions.delete ||
      sub.actions.approve ||
      sub.actions.export
    );
  };

  // Get list of visible module IDs for sidebar
  const getVisibleModules = (): string[] => {
    if (isAdmin) {
      return DEFAULT_MODULE_PERMISSIONS.map(m => m.moduleId);
    }

    if (!userPermissions) {
      // Default: only dashboard visible
      return ['dashboard'];
    }

    return userPermissions.modules
      .filter(module => module.subModules.some(sub => sub.actions.view))
      .map(m => m.moduleId);
  };

  return {
    hasModuleAccess,
    getSubModulePermissions,
    canPerformAction,
    getColumnPermission,
    userPermissions,
    globalSettings,
    isAdmin,
    hasAnyPermission,
    getVisibleModules,
    isLoading: authLoading || permissionsLoading
  };
};

// Module ID to Route mapping
export const MODULE_ROUTE_MAP: Record<string, string> = {
  'dashboard': '/',
  'pis': '/pis',
  'order-management': '/order-management',
  'order-list': '/order-list',
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

// Route to Module ID mapping (reverse)
export const ROUTE_MODULE_MAP: Record<string, string> = {
  '/': 'dashboard',
  '/pis': 'pis',
  '/order-management': 'order-management',
  '/order-list': 'order-list',
  '/good-receiving': 'order-management',
  '/order-hub': 'order-management',
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

export default usePermissions;
