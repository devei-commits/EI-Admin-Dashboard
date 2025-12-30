import React, { useState } from 'react';
import UserDetailPopup from './UserDetailPopup';

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
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  const mockUsers: User[] = [
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
  ];

  const handleViewUser = (user: User) => {
    setSelectedUser(user);
    setIsPopupOpen(true);
  };

  const handleClosePopup = () => {
    setIsPopupOpen(false);
    setSelectedUser(null);
  };

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
    <div className="w-full">
      <h2 className="text-xl font-bold mb-4">View Users</h2>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left font-medium">
                Name
              </th>
              <th className="border border-gray-300 px-4 py-2 text-left font-medium">
                Email
              </th>
              <th className="border border-gray-300 px-4 py-2 text-left font-medium">
                Mobile
              </th>
              <th className="border border-gray-300 px-4 py-2 text-left font-medium">
                Role
              </th>
              <th className="border border-gray-300 px-4 py-2 text-left font-medium">
                Status
              </th>
              <th className="border border-gray-300 px-4 py-2 text-left font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {mockUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">
                  {user.name}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {user.email}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {user.mobile}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {user.role}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(user.status)}`}>
                    {user.status}
                  </span>
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleViewUser(user)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      View
                    </button>
                    <button
                      onClick={() => console.log('Edit user:', user.id)}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
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
      {isPopupOpen && selectedUser && (
        <UserDetailPopup
          user={selectedUser}
          onClose={handleClosePopup}
        />
      )}
    </div>
  );
};

export default ViewUsers;