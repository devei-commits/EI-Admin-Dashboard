import React from 'react';

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

interface UserDetailPopupProps {
  user: User;
  onClose: () => void;
}

const UserDetailPopup: React.FC<UserDetailPopupProps> = ({ user, onClose }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'deactive':
        return 'bg-red-100 text-red-800';
      case 'suspended':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-90vh overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">User Details</h3>
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
                  User Name
                </td>
                <td className="border border-gray-300 px-4 py-3">
                  {user.name}
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-3 font-medium bg-gray-50">
                  Email
                </td>
                <td className="border border-gray-300 px-4 py-3">
                  {user.email}
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-3 font-medium bg-gray-50">
                  Mobile
                </td>
                <td className="border border-gray-300 px-4 py-3">
                  {user.mobile}
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-3 font-medium bg-gray-50">
                  Department
                </td>
                <td className="border border-gray-300 px-4 py-3">
                  {user.department}
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-3 font-medium bg-gray-50">
                  Role
                </td>
                <td className="border border-gray-300 px-4 py-3">
                  {user.role}
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-3 font-medium bg-gray-50">
                  Created At
                </td>
                <td className="border border-gray-300 px-4 py-3">
                  {user.createdAt}
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-3 font-medium bg-gray-50">
                  Last Login
                </td>
                <td className="border border-gray-300 px-4 py-3">
                  {user.lastLogin}
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-3 font-medium bg-gray-50">
                  Last Update
                </td>
                <td className="border border-gray-300 px-4 py-3">
                  {user.lastUpdate}
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-3 font-medium bg-gray-50">
                  Status
                </td>
                <td className="border border-gray-300 px-4 py-3">
                  <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(user.status)}`}>
                    {user.status}
                  </span>
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

export default UserDetailPopup;