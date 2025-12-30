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
    <div className="w-full">
      <h2 className="text-xl font-bold mb-4">View Roles</h2>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left font-medium">
                Role Name
              </th>
              <th className="border border-gray-300 px-4 py-2 text-left font-medium">
                Role Level
              </th>
              <th className="border border-gray-300 px-4 py-2 text-left font-medium">
                Role Status
              </th>
              <th className="border border-gray-300 px-4 py-2 text-left font-medium">
                Created At
              </th>
              <th className="border border-gray-300 px-4 py-2 text-left font-medium">
                Updated At
              </th>
              <th className="border border-gray-300 px-4 py-2 text-left font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">
                  {role.roleName}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${getLevelColor(role.roleLevel)}`}>
                    {role.roleLevel}
                  </span>
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(role.roleStatus)}`}>
                    {role.roleStatus}
                  </span>
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {role.roleCreatedAt}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {role.roleUpdatedAt}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleViewRole(role)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleEditRole(role)}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteRole(role.id)}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
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