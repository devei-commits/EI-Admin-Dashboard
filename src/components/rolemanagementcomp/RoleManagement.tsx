import React, { useState } from 'react';
import CreateRole from './CreateRole.tsx';
import ViewRoles from './ViewRoles.tsx';
import { Tabs } from '../ui';

const RoleManagement: React.FC = () => {
 const [activeTab, setActiveTab] = useState<'createRole' | 'viewRoles'>('createRole');

 return (
  <div className="w-full p-2 md:p-4">
   {/* Tab Selection */}
   <div className="mb-4 md:mb-6">
    <Tabs<'createRole' | 'viewRoles'>
     tabs={[
      { key: 'createRole', label: 'Create Role' },
      { key: 'viewRoles', label: 'View Roles' },
     ]}
     value={activeTab}
     onChange={setActiveTab}
    />
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