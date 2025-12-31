import React, { useState } from 'react';
import RoleDetailPopup from './RoleDetailPopup.tsx';
import EditRolePopup from './EditRolePopup.tsx';

interface Role {
  id: string;
  roleName: string;
  roleLevel: string;
  roleStatus: 'active' | 'inactive';
  roleCreatedAt: string;
  roleUpdatedAt: string;
  description: string;
}

const ViewRoles: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isViewPopupOpen, setIsViewPopupOpen] = useState(false);
  const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);
  const [roles, setRoles] = useState<Role[]>([
    {
      id: 'ROLE001',
      roleName: 'super admin',
      roleLevel: 'admin',
      roleStatus: 'active',
      roleCreatedAt: '2024-01-10',
      roleUpdatedAt: '2024-02-15 10:30:00',
      description: 'Full system access with all administrative privileges'
    },
    {
      id: 'ROLE002',
      roleName: 'BD manager',
      roleLevel: 'manager',
      roleStatus: 'active',
      roleCreatedAt: '2024-01-12',
      roleUpdatedAt: '2024-02-20 14:20:00',
      description: 'Manages business development operations and team'
    },
    {
      id: 'ROLE003',
      roleName: 'QA staff',
      roleLevel: 'staff',
      roleStatus: 'active',
      roleCreatedAt: '2024-01-15',
      roleUpdatedAt: '2024-02-18 09:45:00',
      description: 'Quality assurance testing and validation'
    },
    {
      id: 'ROLE004',
      roleName: 'R&D manager',
      roleLevel: 'manager',
      roleStatus: 'active',
      roleCreatedAt: '2024-01-18',
      roleUpdatedAt: '2024-02-22 16:15:00',
      description: 'Research and development team leadership'
    },
    {
      id: 'ROLE005',
      roleName: 'Sales',
      roleLevel: 'staff',
      roleStatus: 'active',
      roleCreatedAt: '2024-01-20',
      roleUpdatedAt: '2024-02-25 11:30:00',
      description: 'Sales operations and customer relations'
    },
    {
      id: 'ROLE006',
      roleName: 'Doctor',
      roleLevel: 'client',
      roleStatus: 'active',
      roleCreatedAt: '2024-01-25',
      roleUpdatedAt: '2024-02-28 13:45:00',
      description: 'Medical professional client access'
    },
    {
      id: 'ROLE007',
      roleName: 'Design',
      roleLevel: 'staff',
      roleStatus: 'inactive',
      roleCreatedAt: '2024-02-01',
      roleUpdatedAt: '2024-02-26 08:20:00',
      description: 'Product and graphic design responsibilities'
    }
  ]);

  const handleViewRole = (role: Role) => {
    setSelectedRole(role);
    setIsViewPopupOpen(true);
  };

  const handleEditRole = (role: Role) => {
    setSelectedRole(role);
    setIsEditPopupOpen(true);
  };

  const handleDeleteRole = (roleId: string) => {
    if (window.confirm('Are you sure you want to delete this role?')) {
      setRoles(prevRoles => prevRoles.filter(role => role.id !== roleId));
      alert('Role deleted successfully!');
    }
  };

  const handleSaveRole = (updatedRole: Role) => {
    setRoles(prevRoles => 
      prevRoles.map(role => 
        role.id === updatedRole.id ? updatedRole : role
      )
    );
  };

  const handleCloseViewPopup = () => {
    setIsViewPopupOpen(false);
    setSelectedRole(null);
  };

  const handleCloseEditPopup = () => {
    setIsEditPopupOpen(false);
    setSelectedRole(null);
  };

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
    <div className="w-full">
      <h2 className="text-lg font-semibold text-gray-800 mb-5">View Roles</h2>
      
      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {roles.map((role) => (
          <div key={role.id} className="bg-gray-50/50 border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition-colors">
            <div className="flex justify-between items-start mb-3">
              <span className="font-semibold text-gray-800">{role.roleName}</span>
              <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(role.roleStatus)}`}>
                {role.roleStatus}
              </span>
            </div>
            <div className="space-y-2 text-sm mb-4">
              <p><span className="font-medium text-gray-400">Level:</span> <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getLevelColor(role.roleLevel)}`}>{role.roleLevel}</span></p>
              <p><span className="font-medium text-gray-400">Created:</span> <span className="text-gray-600">{role.roleCreatedAt}</span></p>
              <p><span className="font-medium text-gray-400">Updated:</span> <span className="text-gray-600">{role.roleUpdatedAt}</span></p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleViewRole(role)}
                className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium"
              >
                View
              </button>
              <button
                onClick={() => handleEditRole(role)}
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Edit
              </button>
              <button
                onClick={() => handleDeleteRole(role.id)}
                className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Role Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Role Level
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Role Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Created At
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Updated At
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {roles.map((role) => (
              <tr key={role.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-4 font-medium text-gray-800">
                  {role.roleName}
                </td>
                <td className="px-4 py-4">
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getLevelColor(role.roleLevel)}`}>
                    {role.roleLevel}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(role.roleStatus)}`}>
                    {role.roleStatus}
                  </span>
                </td>
                <td className="px-4 py-4 text-gray-500">
                  {role.roleCreatedAt}
                </td>
                <td className="px-4 py-4 text-gray-500">
                  {role.roleUpdatedAt}
                </td>
                <td className="px-4 py-4">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleViewRole(role)}
                      className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleEditRole(role)}
                      className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteRole(role.id)}
                      className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role Detail Popup */}
      {isViewPopupOpen && selectedRole && (
        <RoleDetailPopup
          role={selectedRole}
          onClose={handleCloseViewPopup}
        />
      )}

      {/* Edit Role Popup */}
      {isEditPopupOpen && selectedRole && (
        <EditRolePopup
          role={selectedRole}
          onClose={handleCloseEditPopup}
          onSave={handleSaveRole}
        />
      )}
    </div>
  );
};

export default ViewRoles;