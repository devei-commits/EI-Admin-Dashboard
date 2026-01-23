import React, { useState } from 'react';
import { Role, loadRolesFromStorage, saveRolesToStorage } from './ViewRoles';
import { UnifiedButton, UnifiedLabel, UnifiedCard, getStatusBadgeColor, getRoleLevelBadgeColor } from '../ui';

// Define permission interface
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

const CreateRole: React.FC = () => {
  const [formData, setFormData] = useState({
    roleName: '',
    roleLevel: '',
    roleStatus: 'active' as 'active' | 'inactive',
    description: ''
  });

  // Initialize permissions for all modules
  const [permissions, setPermissions] = useState<Permission[]>([
    { moduleName: 'Dashboard', permissions: { full: false, view: false, create: false, edit: false, delete: false, approve: false, others: false } },
    { moduleName: 'Contacts', permissions: { full: false, view: false, create: false, edit: false, delete: false, approve: false, others: false } },
    { moduleName: 'Items', permissions: { full: false, view: false, create: false, edit: false, delete: false, approve: false, others: false } },
    { moduleName: 'Sales & Purchase', permissions: { full: false, view: false, create: false, edit: false, delete: false, approve: false, others: false } },
    { moduleName: 'Order Management', permissions: { full: false, view: false, create: false, edit: false, delete: false, approve: false, others: false } },
    { moduleName: 'Inventory', permissions: { full: false, view: false, create: false, edit: false, delete: false, approve: false, others: false } },
    { moduleName: 'Raw Material', permissions: { full: false, view: false, create: false, edit: false, delete: false, approve: false, others: false } },
    { moduleName: 'BOM', permissions: { full: false, view: false, create: false, edit: false, delete: false, approve: false, others: false } },
    { moduleName: 'Packaging', permissions: { full: false, view: false, create: false, edit: false, delete: false, approve: false, others: false } },
    { moduleName: 'Accountant', permissions: { full: false, view: false, create: false, edit: false, delete: false, approve: false, others: false } },
    { moduleName: 'Treasury', permissions: { full: false, view: false, create: false, edit: false, delete: false, approve: false, others: false } },
    { moduleName: 'User Management', permissions: { full: false, view: false, create: false, edit: false, delete: false, approve: false, others: false } },
    { moduleName: 'Role Management', permissions: { full: false, view: false, create: false, edit: false, delete: false, approve: false, others: false } },
    { moduleName: 'PIS', permissions: { full: false, view: false, create: false, edit: false, delete: false, approve: false, others: false } },
    { moduleName: 'Tasks', permissions: { full: false, view: false, create: false, edit: false, delete: false, approve: false, others: false } },
    { moduleName: 'Settings', permissions: { full: false, view: false, create: false, edit: false, delete: false, approve: false, others: false } },
    { moduleName: 'Documents', permissions: { full: false, view: false, create: false, edit: false, delete: false, approve: false, others: false } },
  ]);

  const [globalSettings, setGlobalSettings] = useState({
    accessToAllParts: false,
    allowLogin: true,
    allowMultipleSessions: false,
    canChangePassword: true,
    enableAuditLog: false,
  });

  const roleLevels = ['admin', 'manager', 'staff', 'client'];

  const roleHierarchy = {
    admin: ['super admin', 'admin'],
    manager: ['BD manager', 'R&D manager', 'QA manager'],
    staff: [
      'BD staff', 'R&D staff', 'QA staff', 'Sales', 'Design', 
      'Procurement', 'Manufacturing and Production', 'Logistics'
    ],
    client: ['Doctor', 'customer']
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle permission changes
  const handlePermissionChange = (moduleIndex: number, permissionType: keyof Permission['permissions']) => {
    setPermissions(prev => {
      const updated = [...prev];
      updated[moduleIndex] = {
        ...updated[moduleIndex],
        permissions: {
          ...updated[moduleIndex].permissions,
          [permissionType]: !updated[moduleIndex].permissions[permissionType]
        }
      };

      // If "full" is selected, enable all other permissions
      if (permissionType === 'full' && updated[moduleIndex].permissions.full) {
        updated[moduleIndex].permissions = {
          full: true,
          view: true,
          create: true,
          edit: true,
          delete: true,
          approve: true,
          others: true
        };
      }
      // If "full" is deselected, disable all other permissions
      else if (permissionType === 'full' && !updated[moduleIndex].permissions.full) {
        updated[moduleIndex].permissions = {
          full: false,
          view: false,
          create: false,
          edit: false,
          delete: false,
          approve: false,
          others: false
        };
      }
      // If any other permission is deselected, automatically deselect "full"
      else if (permissionType !== 'full' && !updated[moduleIndex].permissions[permissionType]) {
        updated[moduleIndex].permissions.full = false;
      }

      return updated;
    });
  };

  // Handle global settings changes
  const handleGlobalSettingChange = (setting: keyof typeof globalSettings) => {
    setGlobalSettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Load existing roles from localStorage
    const existingRoles = loadRolesFromStorage();
    
    // Check if role with same name already exists
    const roleExists = existingRoles.some(
      (role) => role.roleName.toLowerCase() === formData.roleName.toLowerCase()
    );
    
    if (roleExists) {
      alert('A role with this name already exists!');
      return;
    }
    
    // Generate new role ID
    const maxId = existingRoles.reduce((max, role) => {
      const num = parseInt(role.id.replace('ROLE', ''));
      return num > max ? num : max;
    }, 0);
    const newId = `ROLE${String(maxId + 1).padStart(3, '0')}`;
    
    // Create new role object
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const dateTimeStr = now.toISOString().replace('T', ' ').slice(0, 19);
    
    const newRole: Role = {
      id: newId,
      roleName: formData.roleName,
      roleLevel: formData.roleLevel,
      roleStatus: formData.roleStatus,
      roleCreatedAt: dateStr,
      roleUpdatedAt: dateTimeStr,
      description: formData.description || `${formData.roleName} role`
    };

    // Save role permissions separately
    const rolePermissions: RolePermissions = {
      roleId: newId,
      roleName: formData.roleName,
      permissions,
      globalSettings
    };

    // Save to localStorage
    const updatedRoles = [...existingRoles, newRole];
    saveRolesToStorage(updatedRoles);

    // Save role permissions
    const existingPermissions = JSON.parse(localStorage.getItem('eisthetic_role_permissions') || '[]');
    existingPermissions.push(rolePermissions);
    localStorage.setItem('eisthetic_role_permissions', JSON.stringify(existingPermissions));
    
    // Reset form
    setFormData({
      roleName: '',
      roleLevel: '',
      roleStatus: 'active',
      description: ''
    });

    // Reset permissions
    setPermissions(prevPermissions => prevPermissions.map(p => ({
      ...p,
      permissions: { full: false, view: false, create: false, edit: false, delete: false, approve: false, others: false }
    })));

    // Reset global settings
    setGlobalSettings({
      accessToAllParts: false,
      allowLogin: true,
      allowMultipleSessions: false,
      canChangePassword: true,
      enableAuditLog: false,
    });
    
    alert('Role created successfully with permissions! View it in the "View Roles" tab.');
  };

  const getAvailableRoles = () => {
    if (formData.roleLevel) {
      return roleHierarchy[formData.roleLevel as keyof typeof roleHierarchy] || [];
    }
    return [];
  };

  return (
    <div className="w-full max-w-6xl">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6 tracking-tight">Create New Role</h2>
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Role Information */}
        <UnifiedCard>
          <h3 className="text-md font-semibold text-gray-800 mb-6 uppercase tracking-wider">Role Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Role Level  */}
            <div>
              <UnifiedLabel>Role Level</UnifiedLabel>
              <select
                name="roleLevel"
                value={formData.roleLevel}
                onChange={handleInputChange}
                className="w-full px-5 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50/50 transition-all leading-normal tracking-wide"
                required
              >
                <option value="">Select Role Level</option>
                {roleLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>

            {/* Role Name */}
            <div>
              <UnifiedLabel>Role Name</UnifiedLabel>
              <select
                name="roleName"
                value={formData.roleName}
                onChange={handleInputChange}
                className="w-full px-5 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed leading-normal tracking-wide"
                required
                disabled={!formData.roleLevel}
              >
                <option value="">Select Role Name</option>
                {getAvailableRoles().map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            {/* Role Status */}
            <div>
              <UnifiedLabel>Role Status</UnifiedLabel>
              <select
                name="roleStatus"
                value={formData.roleStatus}
                onChange={handleInputChange}
                className="w-full px-5 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50/50 transition-all leading-normal tracking-wide"
                required
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <UnifiedLabel>Description</UnifiedLabel>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-5 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50/50 transition-all resize-none leading-relaxed tracking-wide"
                placeholder="Enter role description..."
              />
            </div>
          </div>
        </UnifiedCard>

        {/* Permissions Matrix */}
        <UnifiedCard>
          <h3 className="text-md font-semibold text-gray-800 mb-6 uppercase tracking-wider">Module Permissions</h3>
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
                {permissions.map((module, index) => (
                  <tr key={module.moduleName} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-5 font-medium text-gray-700 leading-relaxed">{module.moduleName}</td>
                    {Object.entries(module.permissions).map(([permissionType, value]) => (
                      <td key={permissionType} className="text-center py-4 px-5">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={() => handlePermissionChange(index, permissionType as keyof Permission['permissions'])}
                          className="w-5 h-5 text-amber-600 bg-gray-100 border-gray-300 rounded focus:ring-amber-500 focus:ring-2 cursor-pointer"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </UnifiedCard>

        {/* Global Settings */}
        <UnifiedCard>
          <h3 className="text-md font-semibold text-gray-800 mb-6 uppercase tracking-wider">Global Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {Object.entries(globalSettings).map(([setting, value]) => (
              <div key={setting} className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id={setting}
                  checked={value}
                  onChange={() => handleGlobalSettingChange(setting as keyof typeof globalSettings)}
                  className="w-5 h-5 text-amber-600 bg-gray-100 border-gray-300 rounded focus:ring-amber-500 focus:ring-2 cursor-pointer"
                />
                <label htmlFor={setting} className="text-sm text-gray-700 capitalize leading-relaxed tracking-wide">
                  {setting.replace(/([A-Z])/g, ' $1').toLowerCase()}
                </label>
              </div>
            ))}
          </div>
        </UnifiedCard>

        <div className="mt-8 pt-6">
          <UnifiedButton type="submit" variant="primary" size="lg">
            Create Role
          </UnifiedButton>
        </div>
      </form>
    </div>
  );
};

export default CreateRole;