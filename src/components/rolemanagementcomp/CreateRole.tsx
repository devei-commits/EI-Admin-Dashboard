import React, { useState } from 'react';
import { Role, loadRolesFromStorage, saveRolesToStorage } from './ViewRoles';

const CreateRole: React.FC = () => {
  const [formData, setFormData] = useState({
    roleName: '',
    roleLevel: '',
    roleStatus: 'active' as 'active' | 'inactive',
    description: ''
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
    
    // Save to localStorage
    const updatedRoles = [...existingRoles, newRole];
    saveRolesToStorage(updatedRoles);
    
    console.log('Role created:', newRole);
    
    // Reset form
    setFormData({
      roleName: '',
      roleLevel: '',
      roleStatus: 'active',
      description: ''
    });
    
    alert('Role created successfully! View it in the "View Roles" tab.');
  };

  const getAvailableRoles = () => {
    if (formData.roleLevel) {
      return roleHierarchy[formData.roleLevel as keyof typeof roleHierarchy] || [];
    }
    return [];
  };

  return (
    <div className="w-full max-w-2xl">
      <h2 className="text-lg font-semibold text-gray-800 mb-5">Create New Role</h2>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-5">
          {/* Role Level  */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Role Level
            </label>
            <select
              name="roleLevel"
              value={formData.roleLevel}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50/50 transition-all"
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
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Role Name
            </label>
            <select
              name="roleName"
              value={formData.roleName}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Role Status
            </label>
            <select
              name="roleStatus"
              value={formData.roleStatus}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50/50 transition-all"
              required
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Description */}
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50/50 transition-all resize-none"
              placeholder="Enter role description..."
            />
          </div>
        </div>

        <div className="mt-6 pt-4">
          <button
            type="submit"
            className="w-full md:w-auto px-6 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-all font-medium"
          >
            Create Role
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateRole;