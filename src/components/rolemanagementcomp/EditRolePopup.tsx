import React, { useState } from 'react';

interface Role {
  id: string;
  roleName: string;
  roleLevel: string;
  roleStatus: 'active' | 'inactive';
  roleCreatedAt: string;
  roleUpdatedAt: string;
  description: string;
}

interface EditRolePopupProps {
  role: Role;
  onClose: () => void;
  onSave: (updatedRole: Role) => void;
}

const EditRolePopup: React.FC<EditRolePopupProps> = ({ role, onClose, onSave }) => {
  const [editedRole, setEditedRole] = useState<Role>({ ...role });

  const roleLevels = ['admin', 'manager', 'staff', 'client'];
  const statusOptions: ('active' | 'inactive')[] = ['active', 'inactive'];

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
    setEditedRole(prev => ({ 
      ...prev, 
      [name]: value,
      // Reset role name if level changes
      ...(name === 'roleLevel' && { roleName: '' })
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Update the last update timestamp
    const updatedRole = {
      ...editedRole,
      roleUpdatedAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
    };
    onSave(updatedRole);
    onClose();
  };

  const getAvailableRoles = () => {
    if (editedRole.roleLevel) {
      return roleHierarchy[editedRole.roleLevel as keyof typeof roleHierarchy] || [];
    }
    return [];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-90vh overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Edit Role</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Role Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role Level
              </label>
              <select
                name="roleLevel"
                value={editedRole.roleLevel}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
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
                value={editedRole.roleName}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Role Name</option>
                {getAvailableRoles().map((roleName) => (
                  <option key={roleName} value={roleName}>
                    {roleName}
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
                value={editedRole.roleStatus}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={editedRole.description}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter role description..."
              />
            </div>
          </div>

          {/* Read-only fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role Created At
              </label>
              <input
                type="text"
                value={editedRole.roleCreatedAt}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role Updated At
              </label>
              <input
                type="text"
                value={editedRole.roleUpdatedAt}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                readOnly
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditRolePopup;