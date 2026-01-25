/**
 * Role-Based Permission Hook
 * Use this hook to check if the current user has permission to access modules/actions
 */

import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ModulePermission, 
  RolePermissions, 
  GlobalSettings,
  loadRolePermissionsFromStorage,
  DEFAULT_MODULE_PERMISSIONS,
  DEFAULT_GLOBAL_SETTINGS
} from '../components/rolemanagementcomp/types/permissions.types';

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

// Local storage key for user-role mapping
const USER_ROLE_MAPPING_KEY = 'eisthetic_user_role_mapping';

// Get user's assigned role ID
const getUserRoleId = (userId: string): string | null => {
  try {
    const mapping = localStorage.getItem(USER_ROLE_MAPPING_KEY);
    if (mapping) {
      const parsed = JSON.parse(mapping);
      return parsed[userId] || null;
    }
    return null;
  } catch {
    return null;
  }
};

export const usePermissions = (): UsePermissionsReturn => {
  const { user, isLoading: authLoading } = useAuth();

  const { userPermissions, globalSettings, isAdmin } = useMemo(() => {
    if (!user) {
      return {
        userPermissions: null,
        globalSettings: DEFAULT_GLOBAL_SETTINGS,
        isAdmin: false
      };
    }

    // Check if user is super admin (using roleName from AuthUser)
    const isSuperAdmin = user.roleName === 'Super Admin' || user.roleName === 'SUPER_ADMIN' || user.roleName === 'Admin';
    
    if (isSuperAdmin) {
      // Super admin has full access
      const fullAccessPermissions: RolePermissions = {
        roleId: 'super-admin',
        roleName: 'Super Admin',
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

    // Get user's role ID
    const roleId = getUserRoleId(user.id || user.email || '');
    
    if (!roleId) {
      // No role assigned - return minimal permissions (view dashboard only)
      return {
        userPermissions: null,
        globalSettings: DEFAULT_GLOBAL_SETTINGS,
        isAdmin: false
      };
    }

    // Load role permissions
    const allPermissions = loadRolePermissionsFromStorage();
    const rolePerms = allPermissions.find(p => p.roleId === roleId);

    return {
      userPermissions: rolePerms || null,
      globalSettings: rolePerms?.globalSettings || DEFAULT_GLOBAL_SETTINGS,
      isAdmin: rolePerms?.globalSettings.accessToAllModules || false
    };
  }, [user]);

  // Check if user has access to a module (at least one view permission)
  const hasModuleAccess = (moduleId: string): boolean => {
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
    isLoading: authLoading
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
