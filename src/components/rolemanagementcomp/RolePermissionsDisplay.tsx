import React from 'react';
import { UnifiedBadge, getPermissionBadgeColor } from '../ui';

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

interface RolePermissionsDisplayProps {
  roleId: string;
}

const RolePermissionsDisplay: React.FC<RolePermissionsDisplayProps> = ({ roleId }) => {
  // Load role permissions from localStorage
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
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5 mt-4">
        <p className="text-yellow-700 text-sm leading-relaxed tracking-wide">No permissions configured for this role.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Module Permissions */}
      <div>
        <h4 className="text-md font-semibold text-gray-800 mb-5 uppercase tracking-wider">Module Permissions</h4>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider text-sm">Module</th>
                <th className="text-center py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider text-sm min-w-16">Full</th>
                <th className="text-center py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider text-sm min-w-16">View</th>
                <th className="text-center py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider text-sm min-w-16">Create</th>
                <th className="text-center py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider text-sm min-w-16">Edit</th>
                <th className="text-center py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider text-sm min-w-16">Delete</th>
                <th className="text-center py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider text-sm min-w-16">Approve</th>
                <th className="text-center py-4 px-5 font-semibold text-gray-700 uppercase tracking-wider text-sm min-w-16">Others</th>
              </tr>
            </thead>
            <tbody>
              {rolePermissions.permissions.map((module, index) => (
                <tr key={module.moduleName} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                  <td className="py-4 px-5 font-medium text-gray-800 leading-relaxed">{module.moduleName}</td>
                  {Object.entries(module.permissions).map(([permissionType, value]) => (
                    <td key={permissionType} className="text-center py-4 px-5 leading-relaxed">
                      {getPermissionBadge(value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Global Settings */}
      <div>
        <h4 className="text-md font-semibold text-gray-800 mb-5 uppercase tracking-wider">Global Settings</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-gray-50 p-6 rounded-lg border border-gray-200">
          {Object.entries(rolePermissions.globalSettings).map(([setting, value]) => (
            <div key={setting} className="flex items-center space-x-3">
              <UnifiedBadge variant={getPermissionBadgeColor(value)}>
                {value ? '✓' : '✗'}
              </UnifiedBadge>
              <span className="text-sm text-gray-700 capitalize leading-relaxed tracking-wide">
                {setting.replace(/([A-Z])/g, ' $1').toLowerCase()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RolePermissionsDisplay;