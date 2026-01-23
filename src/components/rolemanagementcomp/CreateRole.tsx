import React, { useState } from 'react';
import { Role, loadRolesFromStorage, saveRolesToStorage } from './ViewRoles';
import { UnifiedButton, UnifiedLabel, UnifiedCard } from '../ui';
import PermissionMatrix from './PermissionMatrix';
import {
  ModulePermission,
  GlobalSettings,
  DEFAULT_MODULE_PERMISSIONS,
  DEFAULT_GLOBAL_SETTINGS,
  createFullAccessPermissions,
  saveRolePermission,
  RolePermissions,
} from './types/permissions.types';

const CreateRole: React.FC = () => {
  const [formData, setFormData] = useState({
    roleName: '',
    roleLevel: '',
    roleStatus: 'active' as 'active' | 'inactive',
    description: ''
  });

  // Deep clone default permissions for state
  const [permissions, setPermissions] = useState<ModulePermission[]>(
    JSON.parse(JSON.stringify(DEFAULT_MODULE_PERMISSIONS))
  );

  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    ...DEFAULT_GLOBAL_SETTINGS
  });

  const [activeStep, setActiveStep] = useState<'basic' | 'permissions'>('basic');

  const roleLevels = ['admin', 'manager', 'staff', 'client'];

  const roleHierarchy = {
    admin: ['Super Admin', 'Admin'],
    manager: ['BD Manager', 'R&D Manager', 'QA Manager'],
    staff: [
      'BD Staff', 'R&D Staff', 'QA Staff', 'Sales', 'Design', 
      'Procurement', 'Manufacturing and Production', 'Logistics'
    ],
    client: ['Doctor', 'Customer']
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Auto-set permissions based on role level
    if (name === 'roleLevel') {
      if (value === 'admin') {
        // Full access for admin roles
        setPermissions(createFullAccessPermissions());
        setGlobalSettings({
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
        });
      } else {
        // Reset to default for other levels
        setPermissions(JSON.parse(JSON.stringify(DEFAULT_MODULE_PERMISSIONS)));
        setGlobalSettings({ ...DEFAULT_GLOBAL_SETTINGS });
      }
    }
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

    // Save role permissions
    const rolePermissions: RolePermissions = {
      roleId: newId,
      roleName: formData.roleName,
      modules: permissions,
      globalSettings,
      lastUpdated: dateTimeStr,
      updatedBy: 'Admin'
    };

    // Save to localStorage
    const updatedRoles = [...existingRoles, newRole];
    saveRolesToStorage(updatedRoles);
    saveRolePermission(rolePermissions);
    
    // Reset form
    setFormData({
      roleName: '',
      roleLevel: '',
      roleStatus: 'active',
      description: ''
    });
    setPermissions(JSON.parse(JSON.stringify(DEFAULT_MODULE_PERMISSIONS)));
    setGlobalSettings({ ...DEFAULT_GLOBAL_SETTINGS });
    setActiveStep('basic');
    
    alert('Role created successfully with detailed permissions! View it in the "View Roles" tab.');
  };

  const getAvailableRoles = () => {
    if (formData.roleLevel) {
      return roleHierarchy[formData.roleLevel as keyof typeof roleHierarchy] || [];
    }
    return [];
  };

  const isBasicInfoComplete = formData.roleName && formData.roleLevel;

  return (
    <div className="w-full max-w-7xl">
      <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-4 sm:mb-6 tracking-tight">Create New Role</h2>
      
      {/* Step Indicator - Responsive */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-0 mb-6 sm:mb-8 p-4 bg-gray-50 rounded-xl sm:bg-transparent sm:p-0">
        {/* Step 1 */}
        <div className="flex items-center">
          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold text-sm sm:text-base ${
            activeStep === 'basic' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'
          }`}>
            {activeStep === 'permissions' ? (
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : '1'}
          </div>
          <span className={`ml-2 sm:ml-3 text-sm sm:text-base font-medium ${activeStep === 'basic' ? 'text-amber-600' : 'text-gray-600'}`}>
            Basic Information
          </span>
        </div>
        
        {/* Progress Line - Horizontal on desktop, Vertical on mobile */}
        <div className="hidden sm:block flex-1 h-1 mx-4 bg-gray-200 rounded">
          <div className={`h-full bg-amber-500 rounded transition-all duration-300 ${
            activeStep === 'permissions' ? 'w-full' : 'w-0'
          }`} />
        </div>

        {/* Mobile progress indicator */}
        <div className="sm:hidden w-0.5 h-6 bg-gray-200 ml-4 -my-1">
          <div className={`w-full bg-amber-500 transition-all duration-300 ${
            activeStep === 'permissions' ? 'h-full' : 'h-0'
          }`} />
        </div>
        
        {/* Step 2 */}
        <div className="flex items-center">
          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold text-sm sm:text-base ${
            activeStep === 'permissions' ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            2
          </div>
          <span className={`ml-2 sm:ml-3 text-sm sm:text-base font-medium ${activeStep === 'permissions' ? 'text-amber-600' : 'text-gray-400'}`}>
            Configure Permissions
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Step 1: Basic Information */}
        {activeStep === 'basic' && (
          <UnifiedCard>
            <h3 className="text-sm sm:text-md font-semibold text-gray-800 mb-4 sm:mb-6 uppercase tracking-wider">Role Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* Role Level */}
              <div>
                <UnifiedLabel>Role Level</UnifiedLabel>
                <select
                  name="roleLevel"
                  value={formData.roleLevel}
                  onChange={handleInputChange}
                  className="w-full px-4 sm:px-5 py-2.5 sm:py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50/50 transition-all leading-normal tracking-wide text-base"
                  required
                >
                  <option value="">Select Role Level</option>
                  {roleLevels.map((level) => (
                    <option key={level} value={level}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  {formData.roleLevel === 'admin' && 'Admin roles have full system access by default'}
                  {formData.roleLevel === 'manager' && 'Manager roles have team management capabilities'}
                  {formData.roleLevel === 'staff' && 'Staff roles have limited access based on permissions'}
                  {formData.roleLevel === 'client' && 'Client roles have external access only'}
                </p>
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

            {/* Info Notice */}
            {formData.roleLevel === 'admin' && (
              <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-medium text-amber-800">Admin Role Detected</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Admin roles are pre-configured with full system access. You can customize permissions in the next step.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 flex justify-end">
              <UnifiedButton
                type="button"
                variant="primary"
                size="lg"
                disabled={!isBasicInfoComplete}
                onClick={() => setActiveStep('permissions')}
              >
                Next: Configure Permissions
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </UnifiedButton>
            </div>
          </UnifiedCard>
        )}

        {/* Step 2: Permissions Configuration */}
        {activeStep === 'permissions' && (
          <div className="space-y-6">
            {/* Role Summary */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    Configuring Permissions for: <span className="text-amber-600">{formData.roleName}</span>
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Level: <span className="capitalize font-medium">{formData.roleLevel}</span> • 
                    Status: <span className="font-medium">{formData.roleStatus}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveStep('basic')}
                  className="text-amber-600 hover:text-amber-700 font-medium flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Edit Role Info
                </button>
              </div>
            </div>

            {/* Permission Matrix */}
            <UnifiedCard className="!p-6">
              <PermissionMatrix
                permissions={permissions}
                globalSettings={globalSettings}
                onPermissionChange={setPermissions}
                onGlobalSettingChange={setGlobalSettings}
              />
            </UnifiedCard>

            {/* Action Buttons */}
            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setActiveStep('basic')}
                className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              
              <UnifiedButton type="submit" variant="primary" size="lg">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Create Role with Permissions
              </UnifiedButton>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default CreateRole;