import React, { useState, useEffect, useCallback } from 'react';
import UserDetailPopup from './UserDetailPopup';
import EditUserPopup from './EditUserPopup';
import { UnifiedButton, UnifiedBadge, getStatusBadgeColor } from '../ui';
import { fetchStaffUsers, type StaffUserFromApi } from '../../services/user.service';
import { listRoles } from '../../services/role.service';

export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: string;
  roleId?: number;
  department: string;
  createdAt: string;
  lastLogin: string;
  lastUpdate: string;
  status: 'active' | 'deactive' | 'suspended';
}

function mapStaffUserToUser(r: StaffUserFromApi): User {
  const status = r.status === 'active' ? 'active' : r.status === 'inactive' ? 'deactive' : 'suspended';
  return {
    id: String(r.id ?? r.userid),
    name: r.display_name ?? '',
    email: r.email ?? '',
    mobile: r.mobile ?? '',
    role: r.role_name ?? '',
    roleId: r.role_id,
    department: r.department ?? '',
    createdAt: r.created_at ?? '',
    lastLogin: '',
    lastUpdate: '',
    status,
  };
}

interface RoleOption {
  role_id: number;
  role_name: string;
}

const ViewUsers: React.FC = () => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isViewPopupOpen, setIsViewPopupOpen] = useState(false);
  const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, rolesList] = await Promise.all([
        fetchStaffUsers(),
        listRoles(),
      ]);
      if (usersRes.success && usersRes.data) setUsers(usersRes.data.map(mapStaffUserToUser));
      if (rolesList?.length) setRoles(rolesList.map((r) => ({ role_id: r.role_id, role_name: r.role_name })));
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleViewUser = (user: User) => {
    setSelectedUser(user);
    setIsViewPopupOpen(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setIsEditPopupOpen(true);
  };

  const handleSaveUser = (updatedUser: User) => {
    setUsers(prevUsers =>
      prevUsers.map(user => (user.id === updatedUser.id ? updatedUser : user))
    );
  };

  const handleCloseViewPopup = () => {
    setIsViewPopupOpen(false);
    setSelectedUser(null);
  };
  const handleCloseEditPopup = () => {
    setIsEditPopupOpen(false);
    setSelectedUser(null);
  };

  if (loading) {
    return (
      <div className="w-full">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6 tracking-tight">View Users</h2>
        <p className="text-gray-500">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6 tracking-tight">View Users</h2>
      
      {/* Mobile Card View */}
      <div className="md:hidden space-y-5">
        {users.map((user) => (
          <div key={user.id} className="bg-gray-50/50 border border-gray-100 rounded-xl p-5 hover:bg-gray-50 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <span className="font-semibold text-gray-800 leading-relaxed">{user.name}</span>
              <UnifiedBadge variant={getStatusBadgeColor(user.status)}>
                {user.status}
              </UnifiedBadge>
            </div>
            <div className="space-y-3 text-sm mb-5">
              <p><span className="font-medium text-gray-600 tracking-wide">Email:</span> <span className="text-gray-700 leading-relaxed">{user.email}</span></p>
              <p><span className="font-medium text-gray-600 tracking-wide">Mobile:</span> <span className="text-gray-700 leading-relaxed">{user.mobile}</span></p>
              <p><span className="font-medium text-gray-600 tracking-wide">Role:</span> <span className="text-gray-700 leading-relaxed">{user.role}</span></p>
              <p><span className="font-medium text-gray-600 tracking-wide">Department:</span> <span className="text-gray-700 leading-relaxed">{user.department || '—'}</span></p>
            </div>
            <div className="flex flex-wrap gap-3">
              <UnifiedButton variant="primary" size="sm" onClick={() => handleViewUser(user)}>
                View
              </UnifiedButton>
              <UnifiedButton variant="secondary" size="sm" onClick={() => handleEditUser(user)}>
                Edit
              </UnifiedButton>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider leading-relaxed">
                Name
              </th>
              <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider leading-relaxed">
                Email
              </th>
              <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider leading-relaxed">
                Mobile
              </th>
              <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider leading-relaxed">
                Role
              </th>
              <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider leading-relaxed">
                Department
              </th>
              <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider leading-relaxed">
                Status
              </th>
              <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider leading-relaxed">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-4 font-medium text-gray-800 leading-relaxed">
                  {user.name}
                </td>
                <td className="px-5 py-4 text-gray-700 leading-relaxed">
                  {user.email}
                </td>
                <td className="px-5 py-4 text-gray-700 leading-relaxed">
                  {user.mobile}
                </td>
                <td className="px-5 py-4 text-gray-700 leading-relaxed">
                  {user.role}
                </td>
                <td className="px-5 py-4 text-gray-700 leading-relaxed">
                  {user.department || '—'}
                </td>
                <td className="px-5 py-4 leading-relaxed">
                  <UnifiedBadge variant={getStatusBadgeColor(user.status)}>
                    {user.status}
                  </UnifiedBadge>
                </td>
                <td className="px-5 py-4 leading-relaxed">
                  <div className="flex space-x-3">
                    <UnifiedButton variant="primary" size="sm" onClick={() => handleViewUser(user)}>
                      View
                    </UnifiedButton>
                    <UnifiedButton variant="secondary" size="sm" onClick={() => handleEditUser(user)}>
                      Edit
                    </UnifiedButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* User Detail Popup */}
      {isViewPopupOpen && selectedUser && (
        <UserDetailPopup
          user={selectedUser}
          onClose={handleCloseViewPopup}
        />
      )}

      {/* Edit User Popup */}
      {isEditPopupOpen && selectedUser && (
        <EditUserPopup
          user={selectedUser}
          roles={roles}
          onClose={handleCloseEditPopup}
          onSave={handleSaveUser}
        />
      )}
    </div>
  );
};

export default ViewUsers;