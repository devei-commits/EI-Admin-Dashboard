import React, { useState, useEffect } from 'react';
import type { Role, RoleUser } from './ViewRoles';
import PermissionMatrix from './PermissionMatrix';
import { UnifiedButton, inputClassName, selectClassName, textareaClassName } from '../ui';
import {
  ModulePermission,
  GlobalSettings,
  DEFAULT_MODULE_PERMISSIONS,
  DEFAULT_GLOBAL_SETTINGS,
  createFullAccessPermissions,
} from './types/permissions.types';
import { parseApiPermissions, flattenPermissionsToGranted } from './types/permissionKeys';
import { getRoleById, updateRole as updateRoleApi } from '../../services/role.service';

interface EditRoleFullPageProps {
  role: Role;
  users?: RoleUser[];
  onClose: () => void;
  onSave: (updatedRole: Role, users: RoleUser[]) => void;
}

const EditRoleFullPage: React.FC<EditRoleFullPageProps> = ({ role, users, onClose, onSave }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [slideIn, setSlideIn] = useState(false);
  const [editedRole, setEditedRole] = useState<Role>({ ...role });
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'permissions' | 'users'>('settings');
  
  const [permissions, setPermissions] = useState<ModulePermission[]>(() => JSON.parse(JSON.stringify(DEFAULT_MODULE_PERMISSIONS)));
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(() => ({ ...DEFAULT_GLOBAL_SETTINGS }));
  const [roleCode, setRoleCode] = useState('');
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setPermissionsLoading(true);
    getRoleById(role.id)
      .then((r) => {
        if (cancelled) return;
        setRoleCode(r.role_code ?? '');
        const { modules: mods, globalSettings: gs } = parseApiPermissions(
          r.permissions,
          DEFAULT_MODULE_PERMISSIONS,
          DEFAULT_GLOBAL_SETTINGS
        );
        if (role.roleLevel === 'admin') {
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
          setPermissions(mods);
          setGlobalSettings(gs);
        }
      })
      .catch(() => { if (!cancelled) setPermissions(JSON.parse(JSON.stringify(DEFAULT_MODULE_PERMISSIONS))); })
      .finally(() => { if (!cancelled) setPermissionsLoading(false); });
    return () => { cancelled = true; };
  }, [role.id, role.roleLevel]);
  
  // Users assigned to this role (loaded from parent/localStorage or fallback to mock data)
  const [roleUsers, setRoleUsers] = useState<RoleUser[]>(() => {
    if (users && users.length > 0) {
      return users;
    }
    // Default sample users when none are stored yet
    return [
      {
        id: 'USR001',
        email: 'john.doe@eisthetic.com',
        password: 'SecurePass123!',
        name: 'John Doe',
        addedAt: '2024-01-15',
      },
      {
        id: 'USR002',
        email: 'jane.smith@eisthetic.com',
        password: 'JaneSecure456@',
        name: 'Jane Smith',
        addedAt: '2024-01-20',
      },
      {
        id: 'USR003',
        email: 'mike.wilson@eisthetic.com',
        password: 'MikePass789#',
        name: 'Mike Wilson',
        addedAt: '2024-02-01',
      },
    ];
  });

  const roleLevels = ['admin', 'manager', 'staff', 'client'];
  const statusOptions: ('active' | 'inactive')[] = ['active', 'inactive'];

  const roleHierarchy = {
    admin: ['Super Admin', 'Admin'],
    manager: ['BD Manager', 'R&D Manager', 'QA Manager'],
    staff: [
      'BD Staff', 'R&D Staff', 'QA Staff', 'Sales', 'Design',
      'Procurement', 'Manufacturing and Production', 'Logistics'
    ],
    client: ['Doctor', 'Customer']
  };

  useEffect(() => {
    // Trigger animation on mount
    setIsAnimating(true);
    setTimeout(() => setSlideIn(true), 50);
  }, []);

  const handleClose = () => {
    setSlideIn(false);
    setTimeout(() => {
      setIsAnimating(false);
      onClose();
    }, 300);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditedRole(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const togglePasswordVisibility = (userId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const handleAddUser = () => {
    if (!newUserEmail || !newUserName || !newUserPassword) {
      alert('Please fill in all fields to add a new user');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUserEmail)) {
      alert('Please enter a valid email address');
      return;
    }

    // Check if email already exists
    if (roleUsers.some(user => user.email.toLowerCase() === newUserEmail.toLowerCase())) {
      alert('This email is already assigned to this role');
      return;
    }

    const newUser: RoleUser = {
      id: `USR${String(Date.now()).slice(-6)}`,
      email: newUserEmail,
      password: newUserPassword,
      name: newUserName,
      addedAt: new Date().toISOString().split('T')[0]
    };

    setRoleUsers(prev => [...prev, newUser]);
    setNewUserEmail('');
    setNewUserName('');
    setNewUserPassword('');
    setShowNewPassword(false);
  };

  const handleRemoveUser = (userId: string) => {
    if (window.confirm('Are you sure you want to remove this user from this role?')) {
      setRoleUsers(prev => prev.filter(user => user.id !== userId));
    }
  };

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);
    try {
      const { granted, globalSettings: gs } = flattenPermissionsToGranted(permissions, globalSettings);
      await updateRoleApi(role.id, {
        role_code: roleCode || editedRole.roleName.toLowerCase().replace(/\s+/g, '_'),
        role_name: editedRole.roleName,
        description: editedRole.description || undefined,
        level: editedRole.roleLevel,
        status: editedRole.roleStatus,
        permissions: { granted, globalSettings: gs },
      });
      const dateTimeStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const updatedRole = { ...editedRole, roleUpdatedAt: dateTimeStr };
      onSave(updatedRole, roleUsers);
      handleClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  const getAvailableRoles = () => {
    if (editedRole.roleLevel) {
      return roleHierarchy[editedRole.roleLevel as keyof typeof roleHierarchy] || [];
    }
    return [];
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'admin':
        return 'bg-violet-50 text-violet-700 border border-violet-100';
      case 'manager':
        return 'bg-amber-50 text-amber-700 border border-amber-100';
      case 'staff':
        return 'bg-sky-50 text-sky-700 border border-sky-100';
      case 'client':
        return 'bg-gray-50 text-gray-600 border border-gray-200';
      default:
        return 'bg-gray-50 text-gray-600 border border-gray-200';
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex flex-col md:flex-row transition-all duration-300 ${isAnimating ? 'opacity-100' : 'opacity-0'}`}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-300"
        onClick={handleClose}
      />

      {/* Role Names Sidebar - Hidden on mobile, shown on md+ */}
      <div 
        className={`relative hidden md:block w-64 lg:w-72 bg-white shadow-xl transform transition-transform duration-300 ease-out ${
          slideIn ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="p-4 lg:p-5 border-b border-gray-100">
            <h3 className="text-base lg:text-lg font-semibold text-gray-800">Role Names</h3>
            <p className="text-xs lg:text-sm text-gray-500 mt-1">Select level to see available roles</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 lg:p-4">
            {Object.entries(roleHierarchy).map(([level, roles]) => (
              <div key={level} className="mb-4">
                <div className={`px-2 lg:px-3 py-1 lg:py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg mb-2 ${getLevelColor(level)}`}>
                  {level}
                </div>
                <div className="space-y-1">
                  {roles.map((roleName) => (
                    <button
                      key={roleName}
                      onClick={() => {
                        setEditedRole(prev => ({
                          ...prev,
                          roleLevel: level,
                          roleName: roleName
                        }));
                      }}
                      className={`w-full text-left px-2 lg:px-3 py-1.5 lg:py-2 rounded-lg text-xs lg:text-sm transition-all duration-200 ${
                        editedRole.roleName === roleName
                          ? 'bg-amber-100 text-amber-800 font-medium'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {roleName}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Edit Panel */}
      <div 
        className={`flex-1 bg-gray-50 transform transition-transform duration-300 ease-out overflow-hidden ${
          slideIn ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header - Responsive */}
          <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <button
                onClick={handleClose}
                className="p-1.5 sm:p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-800 truncate">Edit: {editedRole.roleName}</h2>
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Manage role settings and assigned users</p>
              </div>
            </div>
            <UnifiedButton
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              className="w-full sm:w-auto"
              disabled={saving}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              }
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </UnifiedButton>
            {saveError && <p className="text-red-600 text-sm mt-2">{saveError}</p>}
          </div>

          {/* Tab Navigation - Responsive scrollable */}
          <div className="bg-white border-b border-gray-200 px-4 sm:px-6 overflow-x-auto">
            <nav className="flex space-x-4 sm:space-x-8 min-w-max">
              <button
                onClick={() => setActiveTab('settings')}
                className={`py-3 sm:py-4 px-1 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'settings'
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="hidden sm:inline">Role </span>Settings
                </div>
              </button>
              <button
                onClick={() => setActiveTab('permissions')}
                className={`py-3 sm:py-4 px-1 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'permissions'
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Permissions
                </div>
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`py-3 sm:py-4 px-1 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'users'
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Users ({roleUsers.length})
                </div>
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-6xl mx-auto space-y-6">
              
              {/* Settings Tab */}
              {activeTab === 'settings' && (
              <>
              {/* Role Settings Card - Responsive */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Role Settings
                </h3>
                
                {/* Mobile: Role Name Selector (since sidebar is hidden) */}
                <div className="md:hidden mb-4 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                  <label className="block text-xs font-medium text-amber-700 mb-2">Quick Role Select</label>
                  <select
                    value={`${editedRole.roleLevel}|${editedRole.roleName}`}
                    onChange={(e) => {
                      const [level, name] = e.target.value.split('|');
                      setEditedRole(prev => ({
                        ...prev,
                        roleLevel: level,
                        roleName: name
                      }));
                    }}
                    className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    {Object.entries(roleHierarchy).map(([level, roles]) => (
                      <optgroup key={level} label={level.toUpperCase()}>
                        {roles.map((roleName) => (
                          <option key={roleName} value={`${level}|${roleName}`}>{roleName}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1.5 sm:mb-2">Role Level</label>
                    <select
                      name="roleLevel"
                      value={editedRole.roleLevel}
                      onChange={handleInputChange}
                      className={selectClassName}
                    >
                      {roleLevels.map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1.5 sm:mb-2">Role Name</label>
                    <select
                      name="roleName"
                      value={editedRole.roleName}
                      onChange={handleInputChange}
                      className={selectClassName}
                    >
                      <option value="">Select Role Name</option>
                      {getAvailableRoles().map((roleName) => (
                        <option key={roleName} value={roleName}>{roleName}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1.5 sm:mb-2">Status</label>
                    <select
                      name="roleStatus"
                      value={editedRole.roleStatus}
                      onChange={handleInputChange}
                      className={selectClassName}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1.5 sm:mb-2">Description</label>
                    <textarea
                      name="description"
                      value={editedRole.description}
                      onChange={handleInputChange}
                      rows={2}
                      className={textareaClassName}
                      placeholder="Enter role description..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-4 pt-4 border-t border-gray-100">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1.5 sm:mb-2">Created At</label>
                    <input
                      type="text"
                      value={editedRole.roleCreatedAt}
                      className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1.5 sm:mb-2">Updated At</label>
                    <input
                      type="text"
                      value={editedRole.roleUpdatedAt}
                      className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                      readOnly
                    />
                  </div>
                </div>
              </div>
              </>
              )}

              {/* Permissions Tab */}
              {activeTab === 'permissions' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                  <div className="p-4 sm:p-6 border-b border-gray-100">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800 flex items-center">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <span className="hidden sm:inline">Module Permissions for "{editedRole.roleName}"</span>
                      <span className="sm:hidden">Permissions</span>
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                      Configure access to each module<span className="hidden sm:inline">, sub-module, and column</span> for this role.
                    </p>
                  </div>
                  <div className="p-2 sm:p-4">
                    <PermissionMatrix
                      permissions={permissions}
                      globalSettings={globalSettings}
                      onPermissionChange={setPermissions}
                      onGlobalSettingChange={setGlobalSettings}
                      readOnly={false}
                    />
                  </div>
                </div>
              )}

              {/* Users Tab */}
              {activeTab === 'users' && (
              <>
              {/* Add New User Card - Responsive */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Add New User<span className="hidden sm:inline"> to Role</span>
                </h3>
                <p className="text-sm text-gray-500 mb-4">Only users added here can login with the "{editedRole.roleName}" role</p>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1.5 sm:mb-2">Full Name</label>
                    <input
                      type="text"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      className={inputClassName}
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1.5 sm:mb-2">Email ID</label>
                    <input
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      className={inputClassName}
                      placeholder="user@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1.5 sm:mb-2">Password</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        className={`${inputClassName} pr-10`}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showNewPassword ? (
                          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleAddUser}
                      className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium flex items-center justify-center space-x-2 text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Add User</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Users List Card - Responsive */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800 flex items-center">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span className="hidden sm:inline">Users with "{editedRole.roleName}" Role</span>
                    <span className="sm:hidden">Users</span>
                  </h3>
                  <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-blue-50 text-blue-700 rounded-full text-xs sm:text-sm font-medium">
                    {roleUsers.length}
                  </span>
                </div>
                
                {roleUsers.length === 0 ? (
                  <div className="text-center py-8 sm:py-10 text-gray-500">
                    <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-sm sm:text-base">No users assigned to this role yet</p>
                    <p className="text-xs sm:text-sm mt-1">Add users above to grant them access</p>
                  </div>
                ) : (
                  <>
                  {/* Mobile Card View */}
                  <div className="sm:hidden space-y-3">
                    {roleUsers.map((user) => (
                      <div key={user.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                              {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800 text-sm">{user.name}</p>
                              <p className="text-xs text-gray-500">{user.email}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveUser(user.id)}
                            className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        <p className="text-xs text-gray-400">Added: {user.addedAt}</p>
                      </div>
                    ))}
                  </div>
                  
                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">User</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Email ID</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Password</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Added On</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {roleUsers.map((user) => (
                          <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
                                  {user.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <span className="font-medium text-gray-800">{user.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-gray-600">
                              {user.email}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center space-x-2">
                                <span className="font-mono text-sm text-gray-600">
                                  {showPasswords[user.id] ? user.password : '••••••••••'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => togglePasswordVisibility(user.id)}
                                  className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                  title={showPasswords[user.id] ? 'Hide password' : 'Show password'}
                                >
                                  {showPasswords[user.id] ? (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  )}
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-gray-500">
                              {user.addedAt}
                            </td>
                            <td className="px-4 py-4">
                              <UnifiedButton
                                variant="danger"
                                size="sm"
                                onClick={() => handleRemoveUser(user.id)}
                              >
                                Remove
                              </UnifiedButton>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </>
                )}
              </div>

              {/* Info Card - Responsive */}
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 sm:p-4">
                <div className="flex items-start space-x-2 sm:space-x-3">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="font-medium text-amber-800 text-sm sm:text-base">Access Control Notice</h4>
                    <p className="text-xs sm:text-sm text-amber-700 mt-1">
                      Only users listed above can login with the "{editedRole.roleName}" role.
                      <span className="hidden sm:inline"> Users must use the exact email ID and password shown here to authenticate.</span>
                    </p>
                  </div>
                </div>
              </div>
              </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditRoleFullPage;
