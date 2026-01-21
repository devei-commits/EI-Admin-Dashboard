import React from 'react';
import RolePermissionsDisplay from './RolePermissionsDisplay';

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
        return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
      case 'inactive':
        return 'bg-gray-100 text-gray-600 border border-gray-200';
      default:
        return 'bg-gray-100 text-gray-600 border border-gray-200';
    }
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
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center p-6 border-b-2 border-gray-200">
          <h3 className="text-2xl font-semibold text-gray-800 tracking-tight">Role Details</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Basic Role Information */}
          <div>
            <h4 className="text-lg font-semibold text-gray-800 mb-5 uppercase tracking-wider">Basic Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 bg-gray-50 p-6 rounded-lg border border-gray-200">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest letter-spacing">Role Name</p>
                <p className="text-gray-800 font-medium leading-relaxed">{role.roleName}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">Role Level</p>
                <span className={`inline-block px-3 py-1.5 text-xs font-medium rounded-full ${getLevelColor(role.roleLevel)} tracking-wider`}>
                  {role.roleLevel}
                </span>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">Status</p>
                <span className={`inline-block px-3 py-1.5 text-xs font-medium rounded-full ${getStatusColor(role.roleStatus)} tracking-wider`}>
                  {role.roleStatus}
                </span>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">Role ID</p>
                <p className="text-gray-700 text-sm font-mono leading-relaxed">{role.id}</p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">Description</p>
                <p className="text-gray-700 leading-relaxed tracking-wide">{role.description || 'No description available'}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">Created At</p>
                <p className="text-gray-700 text-sm leading-relaxed">{role.roleCreatedAt}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">Updated At</p>
                <p className="text-gray-700 text-sm leading-relaxed">{role.roleUpdatedAt}</p>
              </div>
            </div>
          </div>

          {/* Role Permissions */}
          <div>
            <h4 className="text-lg font-semibold text-gray-800 mb-5 uppercase tracking-wider">Permissions</h4>
            <RolePermissionsDisplay roleId={role.id} />
          </div>
        </div>

        <div className="p-6 border-t-2 border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium tracking-wider"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleDetailPopup;