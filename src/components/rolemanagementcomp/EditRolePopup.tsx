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
      [name]: value
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
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center p-5 border-b border-gray-100">
          <h3 className="text-xl font-semibold text-gray-800">Edit Role</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Role Level */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Role Level
              </label>
              <select
                name="roleLevel"
                value={editedRole.roleLevel}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50/50 transition-all"
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
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Role Name
              </label>
              <select
                name="roleName"
                value={editedRole.roleName}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50/50 transition-all"
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
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Role Status
              </label>
              <select
                name="roleStatus"
                value={editedRole.roleStatus}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50/50 transition-all"
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
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={editedRole.description}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50/50 transition-all resize-none"
                placeholder="Enter role description..."
              />
            </div>
          </div>

          {/* Read-only fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5 border-t border-gray-100">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Role Created At
              </label>
              <input
                type="text"
                value={editedRole.roleCreatedAt}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Role Updated At
              </label>
              <input
                type="text"
                value={editedRole.roleUpdatedAt}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                readOnly
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-5 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium"
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