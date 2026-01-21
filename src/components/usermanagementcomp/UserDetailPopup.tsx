import React from 'react';
import { UnifiedBadge, getStatusBadgeColor } from '../ui';

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
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center p-5 border-b border-gray-100">
          <h3 className="text-xl font-semibold text-gray-800">User Details</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">User Name</p>
              <p className="text-gray-800 font-medium">{user.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Email</p>
              <p className="text-gray-800">{user.email}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Mobile</p>
              <p className="text-gray-800">{user.mobile}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Department</p>
              <p className="text-gray-800">{user.department}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Role</p>
              <p className="text-gray-800">{user.role}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Status</p>
              <UnifiedBadge variant={getStatusBadgeColor(user.status)}>
                {user.status}
              </UnifiedBadge>
            </div>
          </div>
          
          <div className="pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Created At</p>
              <p className="text-gray-600 text-sm">{user.createdAt}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Last Login</p>
              <p className="text-gray-600 text-sm">{user.lastLogin}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Last Update</p>
              <p className="text-gray-600 text-sm">{user.lastUpdate}</p>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserDetailPopup;