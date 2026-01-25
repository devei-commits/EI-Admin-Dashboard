/**
 * Permission-Protected Route Component
 * Wraps routes to enforce role-based access control
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions, ROUTE_MODULE_MAP } from '../hooks/usePermissions';

interface ProtectedModuleRouteProps {
  children: React.ReactNode;
  moduleId?: string;
  subModuleId?: string;
  requiredAction?: 'canView' | 'canCreate' | 'canEdit' | 'canDelete' | 'canApprove' | 'canExport';
  fallbackPath?: string;
}

/**
 * ProtectedModuleRoute - Wraps a route to check module permissions
 * 
 * Usage:
 * <ProtectedModuleRoute moduleId="user-management">
 *   <UserManagement />
 * </ProtectedModuleRoute>
 */
export const ProtectedModuleRoute: React.FC<ProtectedModuleRouteProps> = ({
  children,
  moduleId,
  subModuleId,
  requiredAction = 'canView',
  fallbackPath = '/'
}) => {
  const location = useLocation();
  const { hasModuleAccess, canPerformAction, isLoading, isAdmin } = usePermissions();

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Admin has full access
  if (isAdmin) {
    return <>{children}</>;
  }

  // Determine module ID from route if not provided
  const effectiveModuleId = moduleId || ROUTE_MODULE_MAP[location.pathname] || '';

  // Check if user has access
  let hasAccess = false;

  if (subModuleId) {
    // Check specific sub-module and action
    hasAccess = canPerformAction(effectiveModuleId, subModuleId, requiredAction);
  } else {
    // Check general module access
    hasAccess = hasModuleAccess(effectiveModuleId);
  }

  if (!hasAccess) {
    // Redirect to fallback with access denied state
    return (
      <Navigate 
        to={fallbackPath} 
        state={{ 
          accessDenied: true, 
          attemptedPath: location.pathname,
          message: `You don't have permission to access this page.`
        }} 
        replace 
      />
    );
  }

  return <>{children}</>;
};

/**
 * AccessDenied - Display when user doesn't have permission
 */
export const AccessDenied: React.FC<{ message?: string }> = ({ 
  message = "You don't have permission to access this resource." 
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
        <p className="text-red-600 text-sm">{message}</p>
        <p className="text-gray-500 text-xs mt-4">
          Contact your administrator if you believe this is an error.
        </p>
      </div>
    </div>
  );
};

/**
 * PermissionGate - Conditionally render content based on permissions
 * 
 * Usage:
 * <PermissionGate moduleId="user-management" action="canCreate">
 *   <button>Add User</button>
 * </PermissionGate>
 */
interface PermissionGateProps {
  children: React.ReactNode;
  moduleId: string;
  subModuleId?: string;
  action?: 'canView' | 'canCreate' | 'canEdit' | 'canDelete' | 'canApprove' | 'canExport';
  fallback?: React.ReactNode;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  children,
  moduleId,
  subModuleId,
  action = 'canView',
  fallback = null
}) => {
  const { hasModuleAccess, canPerformAction, isAdmin } = usePermissions();

  // Admin has full access
  if (isAdmin) {
    return <>{children}</>;
  }

  // Check permissions
  let hasPermission = false;

  if (subModuleId) {
    hasPermission = canPerformAction(moduleId, subModuleId, action);
  } else {
    hasPermission = hasModuleAccess(moduleId);
  }

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

/**
 * ColumnGate - Conditionally render columns based on column permissions
 * 
 * Usage:
 * <ColumnGate moduleId="user-management" subModuleId="users" columnId="email" action="canEdit">
 *   <input type="email" />
 * </ColumnGate>
 */
interface ColumnGateProps {
  children: React.ReactNode;
  moduleId: string;
  subModuleId: string;
  columnId: string;
  action?: 'canView' | 'canEdit';
  fallback?: React.ReactNode;
}

export const ColumnGate: React.FC<ColumnGateProps> = ({
  children,
  moduleId,
  subModuleId,
  columnId,
  action = 'canView',
  fallback = null
}) => {
  const { getColumnPermission, isAdmin } = usePermissions();

  // Admin has full access
  if (isAdmin) {
    return <>{children}</>;
  }

  const permission = getColumnPermission(moduleId, subModuleId, columnId);
  
  if (!permission[action]) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

/**
 * useActionPermissions - Hook to get action permissions for UI buttons
 */
export const useActionPermissions = (moduleId: string, subModuleId?: string) => {
  const { getSubModulePermissions, hasModuleAccess, isAdmin } = usePermissions();

  if (isAdmin) {
    return {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canApprove: true,
      canExport: true,
      hasAccess: true
    };
  }

  if (subModuleId) {
    const perms = getSubModulePermissions(moduleId, subModuleId);
    return {
      ...perms,
      hasAccess: perms.canView
    };
  }

  return {
    canView: hasModuleAccess(moduleId),
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canApprove: false,
    canExport: false,
    hasAccess: hasModuleAccess(moduleId)
  };
};

export default ProtectedModuleRoute;
