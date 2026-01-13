import React, { useState, useEffect } from 'react';

interface Role {
  id: string;
  roleName: string;
  roleLevel: string;
  roleStatus: 'active' | 'inactive';
  roleCreatedAt: string;
  roleUpdatedAt: string;
  description: string;
}

interface RoleUser {
  id: string;
  email: string;
  password: string;
  name: string;
  addedAt: string;
}

interface EditRoleFullPageProps {
  role: Role;
  onClose: () => void;
  onSave: (updatedRole: Role, users: RoleUser[]) => void;
}

const EditRoleFullPage: React.FC<EditRoleFullPageProps> = ({ role, onClose, onSave }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [slideIn, setSlideIn] = useState(false);
  const [editedRole, setEditedRole] = useState<Role>({ ...role });
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Mock users data for this role - in production, this would come from an API
  const [roleUsers, setRoleUsers] = useState<RoleUser[]>([
    {
      id: 'USR001',
      email: 'john.doe@eisthetic.com',
      password: 'SecurePass123!',
      name: 'John Doe',
      addedAt: '2024-01-15'
    },
    {
      id: 'USR002',
      email: 'jane.smith@eisthetic.com',
      password: 'JaneSecure456@',
      name: 'Jane Smith',
      addedAt: '2024-01-20'
    },
    {
      id: 'USR003',
      email: 'mike.wilson@eisthetic.com',
      password: 'MikePass789#',
      name: 'Mike Wilson',
      addedAt: '2024-02-01'
    }
  ]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedRole = {
      ...editedRole,
      roleUpdatedAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
    };
    onSave(updatedRole, roleUsers);
    handleClose();
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
    <div className={`fixed inset-0 z-50 flex transition-all duration-300 ${isAnimating ? 'opacity-100' : 'opacity-0'}`}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-300"
        onClick={handleClose}
      />

      {/* Role Names Sidebar - Slides to Left */}
      <div 
        className={`relative w-72 bg-white shadow-xl transform transition-transform duration-300 ease-out ${
          slideIn ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="p-5 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800">Role Names</h3>
            <p className="text-sm text-gray-500 mt-1">Select level to see available roles</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {Object.entries(roleHierarchy).map(([level, roles]) => (
              <div key={level} className="mb-4">
                <div className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg mb-2 ${getLevelColor(level)}`}>
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
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
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

      {/* Main Edit Panel - Slides from Right */}
      <div 
        className={`flex-1 bg-gray-50 transform transition-transform duration-300 ease-out overflow-hidden ${
          slideIn ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleClose}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h2 className="text-xl font-semibold text-gray-800">Edit Role: {editedRole.roleName}</h2>
                <p className="text-sm text-gray-500">Manage role settings and assigned users</p>
              </div>
            </div>
            <button
              onClick={handleSubmit}
              className="px-5 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Save Changes</span>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Role Settings Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Role Settings
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Role Level</label>
                    <select
                      name="roleLevel"
                      value={editedRole.roleLevel}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50/50 transition-all"
                    >
                      {roleLevels.map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Role Name</label>
                    <select
                      name="roleName"
                      value={editedRole.roleName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50/50 transition-all"
                    >
                      <option value="">Select Role Name</option>
                      {getAvailableRoles().map((roleName) => (
                        <option key={roleName} value={roleName}>{roleName}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Status</label>
                    <select
                      name="roleStatus"
                      value={editedRole.roleStatus}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50/50 transition-all"
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Description</label>
                    <textarea
                      name="description"
                      value={editedRole.description}
                      onChange={handleInputChange}
                      rows={2}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50/50 transition-all resize-none"
                      placeholder="Enter role description..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Created At</label>
                    <input
                      type="text"
                      value={editedRole.roleCreatedAt}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Updated At</label>
                    <input
                      type="text"
                      value={editedRole.roleUpdatedAt}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                      readOnly
                    />
                  </div>
                </div>
              </div>

              {/* Add New User Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Add New User to Role
                </h3>
                <p className="text-sm text-gray-500 mb-4">Only users added here can login with the "{editedRole.roleName}" role</p>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Full Name</label>
                    <input
                      type="text"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50/50 transition-all"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Email ID</label>
                    <input
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50/50 transition-all"
                      placeholder="user@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Password</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50/50 transition-all"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showNewPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      className="w-full px-4 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium flex items-center justify-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Add User</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Users List Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Users with "{editedRole.roleName}" Role
                  </h3>
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                    {roleUsers.length} Users
                  </span>
                </div>
                
                {roleUsers.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p>No users assigned to this role yet</p>
                    <p className="text-sm mt-1">Add users above to grant them access with this role</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
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
                              <button
                                type="button"
                                onClick={() => handleRemoveUser(user.id)}
                                className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Info Card */}
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="font-medium text-amber-800">Access Control Notice</h4>
                    <p className="text-sm text-amber-700 mt-1">
                      Only users listed above can login with the "{editedRole.roleName}" role. 
                      Users must use the exact email ID and password shown here to authenticate.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditRoleFullPage;
