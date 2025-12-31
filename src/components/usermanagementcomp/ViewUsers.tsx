import React, { useState } from 'react';
import UserDetailPopup from './UserDetailPopup';
import EditUserPopup from './EditUserPopup';

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

const ViewUsers: React.FC = () => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isViewPopupOpen, setIsViewPopupOpen] = useState(false);
  const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([
    {
      id: 'USR001',
      name: 'John Smith',
      email: 'john.smith@company.com',
      mobile: '+1-555-0101',
      role: 'BD Manager',
      department: 'BD',
      createdAt: '2024-01-15',
      lastLogin: '2024-02-28 09:30:00',
      lastUpdate: '2024-02-27 14:22:00',
      status: 'active'
    },
    {
      id: 'USR002',
      name: 'Sarah Johnson',
      email: 'sarah.johnson@company.com',
      mobile: '+1-555-0102',
      role: 'QA Staff',
      department: 'QA',
      createdAt: '2024-01-20',
      lastLogin: '2024-02-28 08:15:00',
      lastUpdate: '2024-02-25 16:45:00',
      status: 'active'
    },
    {
      id: 'USR003',
      name: 'Michael Brown',
      email: 'michael.brown@company.com',
      mobile: '+1-555-0103',
      role: 'R&D Lead',
      department: 'R&D',
      createdAt: '2024-01-25',
      lastLogin: '2024-02-27 17:20:00',
      lastUpdate: '2024-02-26 10:30:00',
      status: 'suspended'
    },
    {
      id: 'USR004',
      name: 'Emily Davis',
      email: 'emily.davis@company.com',
      mobile: '+1-555-0104',
      role: 'Sales',
      department: 'Sales',
      createdAt: '2024-02-01',
      lastLogin: '2024-02-28 11:45:00',
      lastUpdate: '2024-02-28 11:50:00',
      status: 'active'
    },
    {
      id: 'USR005',
      name: 'David Wilson',
      email: 'david.wilson@company.com',
      mobile: '+1-555-0105',
      role: 'Admin',
      department: 'admin',
      createdAt: '2024-02-05',
      lastLogin: '2024-02-26 13:30:00',
      lastUpdate: '2024-02-24 09:15:00',
      status: 'deactive'
    },
    {
      id: 'USR006',
      name: 'Lisa Anderson',
      email: 'lisa.anderson@company.com',
      mobile: '+1-555-0106',
      role: 'Design',
      department: 'Design',
      createdAt: '2024-02-10',
      lastLogin: '2024-02-28 15:20:00',
      lastUpdate: '2024-02-28 15:25:00',
      status: 'active'
    }
  ]);

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
      prevUsers.map(user => 
        user.id === updatedUser.id ? updatedUser : user
      )
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
      case 'deactive':
        return 'bg-gray-100 text-gray-600 border border-gray-200';
      case 'suspended':
        return 'bg-amber-50 text-amber-700 border border-amber-100';
      default:
        return 'bg-gray-100 text-gray-600 border border-gray-200';
    }
  };

  return (
    <div className="w-full">
      <h2 className="text-lg font-semibold text-gray-800 mb-5">View Users</h2>
      
      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {users.map((user) => (
          <div key={user.id} className="bg-gray-50/50 border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition-colors">
            <div className="flex justify-between items-start mb-3">
              <span className="font-semibold text-gray-800">{user.name}</span>
              <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(user.status)}`}>
                {user.status}
              </span>
            </div>
            <div className="space-y-2 text-sm mb-4">
              <p><span className="font-medium text-gray-400">Email:</span> <span className="text-gray-600">{user.email}</span></p>
              <p><span className="font-medium text-gray-400">Mobile:</span> <span className="text-gray-600">{user.mobile}</span></p>
              <p><span className="font-medium text-gray-400">Role:</span> <span className="text-gray-600">{user.role}</span></p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleViewUser(user)}
                className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium"
              >
                View
              </button>
              <button
                onClick={() => handleEditUser(user)}
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Edit
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
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Mobile
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-4 font-medium text-gray-800">
                  {user.name}
                </td>
                <td className="px-4 py-4 text-gray-600">
                  {user.email}
                </td>
                <td className="px-4 py-4 text-gray-600">
                  {user.mobile}
                </td>
                <td className="px-4 py-4 text-gray-600">
                  {user.role}
                </td>
                <td className="px-4 py-4">
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(user.status)}`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleViewUser(user)}
                      className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleEditUser(user)}
                      className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                    >
                      Edit
                    </button>
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
          onClose={handleCloseEditPopup}
          onSave={handleSaveUser}
        />
      )}
    </div>
  );
};

export default ViewUsers;