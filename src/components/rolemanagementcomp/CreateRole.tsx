import React, { useState } from 'react';

const CreateRole: React.FC = () => {
  const [formData, setFormData] = useState({
    roleName: '',
    roleLevel: '',
    roleStatus: 'active',
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
    console.log('Role data:', formData);
    // Reset form
    setFormData({
      roleName: '',
      roleLevel: '',
      roleStatus: 'Active',
      description: ''
    });
    alert('Role created successfully!');
  };

  const getAvailableRoles = () => {
    if (formData.roleLevel) {
      return roleHierarchy[formData.roleLevel as keyof typeof roleHierarchy] || [];
    }
    return [];
  };

  return (
    <div className="w-full max-w-2xl">
      <h2 className="text-xl font-bold mb-4">Create New Role</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Role Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role Level
            </label>
            <select
              name="roleLevel"
              value={formData.roleLevel}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role Name
            </label>
            <select
              name="roleName"
              value={formData.roleName}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role Status
            </label>
            <select
              name="roleStatus"
              value={formData.roleStatus}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Description */}
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter role description..."
            />
          </div>
        </div>

        {/* Role Hierarchy Display */}
        {formData.roleLevel && (
          <div className="mt-6 p-4 bg-gray-50 rounded-md">
            <h3 className="font-medium text-gray-800 mb-2">Available roles in {formData.roleLevel} level:</h3>
            <div className="flex flex-wrap gap-2">
              {getAvailableRoles().map((role) => (
                <span
                  key={role}
                  className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  {role}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6">
          <button
            type="submit"
            className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Create Role
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateRole;