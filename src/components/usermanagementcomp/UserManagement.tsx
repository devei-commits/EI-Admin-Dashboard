import React, { useState } from 'react';
import AddUser from './AddUser';
import ViewUsers from './ViewUsers';

const UserManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'addUser' | 'viewUsers'>('addUser');

  return (
    <div className="w-full p-3 md:p-6">
      {/* Tab Selection */}
      <div className="mb-6 md:mb-8">
        <div className="border-b-2 border-gray-200">
          <nav className="flex space-x-6 md:space-x-10 overflow-x-auto">
            <button
              onClick={() => setActiveTab('addUser')}
              className={`py-3 px-5 text-sm font-semibold border-b-2 uppercase tracking-wider transition-colors ${
                activeTab === 'addUser'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              Add User
            </button>
            <button
              onClick={() => setActiveTab('viewUsers')}
              className={`py-3 px-5 text-sm font-semibold border-b-2 uppercase tracking-wider transition-colors ${
                activeTab === 'viewUsers'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              View Users
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'addUser' && <AddUser />}
        {activeTab === 'viewUsers' && <ViewUsers />}
      </div>
    </div>
  );
};

export default UserManagement;