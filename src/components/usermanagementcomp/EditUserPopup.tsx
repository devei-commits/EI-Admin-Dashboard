import React, { useState } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: string;
  department: string;
  createdAt: string;
  lastLogin: string;
  lastUpdate: string;
  status: 'active' | 'deactive' | 'suspended';
}

interface EditUserPopupProps {
  user: User;
  onClose: () => void;
  onSave: (updatedUser: User) => void;
}

const EditUserPopup: React.FC<EditUserPopupProps> = ({ user, onClose, onSave }) => {
  const [editedUser, setEditedUser] = useState<User>({ ...user });

  const departments = [
    'BD', 'QA', 'R&D', 'Sales', 'Packaging', 'Design', 'Procurement', 
    'Manufacturing and production', 'logistic', 'admin', 'client'
  ];

  const userRoles = [
    'BD Manager', 'BD Staff', 'QA Staff', 'QA Manager', 'R&D Lead', 'R&D Staff',
    'Sales', 'Design', 'Procurement', 'Manufacturing and Production', 'Logistics',
    'Admin', 'Super Admin', 'Doctor', 'Customer'
  ];

  const statusOptions: ('active' | 'deactive' | 'suspended')[] = ['active', 'deactive', 'suspended'];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditedUser(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Update the last update timestamp
    const updatedUser = {
      ...editedUser,
      lastUpdate: new Date().toISOString().slice(0, 19).replace('T', ' ')
    };
    onSave(updatedUser);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center p-5 border-b border-gray-100">
          <h3 className="text-xl font-semibold text-gray-800">Edit User</h3>
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
            {/* User Name */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                User Name
              </label>
              <input
                type="text"
                name="name"
                value={editedUser.name}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50/50 transition-all"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={editedUser.email}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50/50 transition-all"
                required
              />
            </div>

            {/* Mobile */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Mobile
              </label>
              <input
                type="tel"
                name="mobile"
                value={editedUser.mobile}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50/50 transition-all"
                required
              />
            </div>

            {/* Department */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Department
              </label>
              <select
                name="department"
                value={editedUser.department}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50/50 transition-all"
                required
              >
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Role
              </label>
              <select
                name="role"
                value={editedUser.role}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50/50 transition-all"
                required
              >
                {userRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Status
              </label>
              <select
                name="status"
                value={editedUser.status}
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
          </div>

          {/* Read-only fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5 border-t border-gray-100">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Created At
              </label>
              <input
                type="text"
                value={editedUser.createdAt}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Last Login
              </label>
              <input
                type="text"
                value={editedUser.lastLogin}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Last Update
              </label>
              <input
                type="text"
                value={editedUser.lastUpdate}
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

export default EditUserPopup;