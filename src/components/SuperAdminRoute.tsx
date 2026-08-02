/**
 * Super-Admin-Only Route Guard
 * Stricter than ProtectedModuleRoute (whose `isAdmin` also allows regular
 * admins). Used for Quotations, which is super_admin only. The backend
 * (authorizeRoles('super_admin')) is the real enforcement; this is UX +
 * defense-in-depth so non-super-admins never see the page.
 */
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** True only for the super_admin role (matches backend usertype). */
export function isSuperAdmin(roleName?: string | null): boolean {
  return (roleName ?? '').toLowerCase().replace(/[\s_]+/g, '') === 'superadmin';
}

export const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-2">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-border border-t-slate-800 rounded-full animate-spin"></div>
          <p className="text-ink-3 font-medium">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin(user?.roleName)) {
    return (
      <Navigate
        to="/"
        state={{ accessDenied: true, attemptedPath: location.pathname, message: 'Quotations is available to Super Admins only.' }}
        replace
      />
    );
  }

  return <>{children}</>;
};

export default SuperAdminRoute;
