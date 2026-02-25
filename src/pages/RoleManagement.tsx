import { RoleManagement as RoleManagementComponent } from '../components/rolemanagementcomp';

const RoleManagementPage = () => {
 return (
  <div className="p-4 md:p-8 bg-gray-50/50 min-h-screen">
   <div className="mb-6">
    <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Role Management</h1>
    <p className="text-gray-500 mt-1">Manage user roles and permissions</p>
   </div>
   <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
    <RoleManagementComponent />
   </div>
  </div>
 )
}

export default RoleManagementPage