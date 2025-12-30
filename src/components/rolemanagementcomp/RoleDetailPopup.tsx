import React from 'react';

interface Role {
  id: string;
  roleName: string;
  roleLevel: string;
  roleStatus: 'active' | 'inactive';
  roleCreatedAt: string;
  roleUpdatedAt: string;
  description: string;
}

interface RoleDetailPopupProps {
  role: Role;
  onClose: () => void;
}

const RoleDetailPopup: React.FC<RoleDetailPopupProps> = ({ role, onClose }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'manager':
        return 'bg-blue-100 text-blue-800';
      case 'staff':
        return 'bg-yellow-100 text-yellow-800';
      case 'client':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-90vh overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Role Details</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300">
            <tbody>
              <tr>
                <td className="border border-gray-300 px-4 py-3 font-medium bg-gray-50">
                  Role Name
                </td>
                <td className="border border-gray-300 px-4 py-3">
                  {role.roleName}
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-3 font-medium bg-gray-50">
                  Role Level
                </td>
                <td className="border border-gray-300 px-4 py-3">
                  <span className={`px-3 py-1 text-sm rounded-full ${getLevelColor(role.roleLevel)}`}>
                    {role.roleLevel}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-3 font-medium bg-gray-50">
                  Role Status
                </td>
                <td className="border border-gray-300 px-4 py-3">
                  <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(role.roleStatus)}`}>
                    {role.roleStatus}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-3 font-medium bg-gray-50">
                  Role Created At
                </td>
                <td className="border border-gray-300 px-4 py-3">
                  {role.roleCreatedAt}
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-3 font-medium bg-gray-50">
                  Role Updated At
                </td>
                <td className="border border-gray-300 px-4 py-3">
                  {role.roleUpdatedAt}
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-3 font-medium bg-gray-50">
                  Description
                </td>
                <td className="border border-gray-300 px-4 py-3">
                  {role.description || 'No description available'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleDetailPopup;