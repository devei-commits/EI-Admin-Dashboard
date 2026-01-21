import React from 'react';

interface Permission {
  moduleName: string;
  permissions: {
    full: boolean;
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    approve: boolean;
    others: boolean;
  };
}

interface RolePermissions {
  roleId: string;
  roleName: string;
  permissions: Permission[];
  globalSettings: {
    accessToAllParts: boolean;
    allowLogin: boolean;
    allowMultipleSessions: boolean;
    canChangePassword: boolean;
    enableAuditLog: boolean;
  };
}

interface PermissionsSummaryProps {
  roleId: string;
}

const PermissionsSummary: React.FC<PermissionsSummaryProps> = ({ roleId }) => {
  const getRolePermissions = (roleId: string): RolePermissions | null => {
    try {
      const storedPermissions = localStorage.getItem('eisthetic_role_permissions');
      if (storedPermissions) {
        const permissions: RolePermissions[] = JSON.parse(storedPermissions);
        return permissions.find(p => p.roleId === roleId) || null;
      }
    } catch (error) {
      console.error('Error loading role permissions:', error);
    }
    return null;
  };

  const rolePermissions = getRolePermissions(roleId);

  if (!rolePermissions) {
    return (
      <div className="text-xs text-gray-500">No permissions configured</div>
    );
  }

  // Count modules with any permissions
  const modulesWithPermissions = rolePermissions.permissions.filter(module => 
    Object.values(module.permissions).some(permission => permission === true)
  );

  // Count modules with full access
  const fullAccessModules = rolePermissions.permissions.filter(module => 
    module.permissions.full === true
  ).length;

  const totalModules = rolePermissions.permissions.length;
  const activeModules = modulesWithPermissions.length;

  return (
    <div className="text-xs space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-gray-600">Modules Access:</span>
        <span className="font-medium text-gray-800">
          {activeModules}/{totalModules}
        </span>
      </div>
      {fullAccessModules > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-gray-600">Full Access:</span>
          <span className="font-medium text-green-600">
            {fullAccessModules}
          </span>
        </div>
      )}
      {rolePermissions.globalSettings.accessToAllParts && (
        <div className="text-green-600 font-medium">All Parts Access</div>
      )}
    </div>
  );
};

export default PermissionsSummary;