import React, { useState } from 'react';
import CreateRole from './CreateRole.tsx';
import ViewRoles from './ViewRoles.tsx';

const RoleManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'createRole' | 'viewRoles'>('createRole');

  return (
    <div className="w-full p-4">
      {/* Tab Selection */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('createRole')}
              className={`py-2 px-4 text-sm font-medium border-b-2 ${
                activeTab === 'createRole'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Create Role
            </button>
            <button
              onClick={() => setActiveTab('viewRoles')}
              className={`py-2 px-4 text-sm font-medium border-b-2 ${
                activeTab === 'viewRoles'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              View Roles
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === 'createRole' && <CreateRole />}
        {activeTab === 'viewRoles' && <ViewRoles />}
      </div>
    </div>
  );
};

export default RoleManagement;