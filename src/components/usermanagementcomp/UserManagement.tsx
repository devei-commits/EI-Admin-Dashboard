import React, { useState } from 'react';
import AddUser from './AddUser';
import ViewUsers from './ViewUsers';

const UserManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'addUser' | 'viewUsers'>('addUser');

  return (
    <div className="w-full p-2 md:p-4">
      {/* Tab Selection */}
      <div className="mb-4 md:mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-4 md:space-x-8 overflow-x-auto">
            <button
              onClick={() => setActiveTab('addUser')}
              className={`py-2 px-4 text-sm font-medium border-b-2 ${
                activeTab === 'addUser'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Add User
            </button>
            <button
              onClick={() => setActiveTab('viewUsers')}
              className={`py-2 px-4 text-sm font-medium border-b-2 ${
                activeTab === 'viewUsers'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              View Users
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === 'addUser' && <AddUser />}
        {activeTab === 'viewUsers' && <ViewUsers />}
      </div>
    </div>
  );
};

export default UserManagement;