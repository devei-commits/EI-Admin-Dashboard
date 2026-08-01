import { RoleManagement as RoleManagementComponent } from '../components/rolemanagementcomp';

const RoleManagementPage = () => {
 return (
  <div className="p-4 md:p-8 bg-surface-2/50 min-h-screen">
   <div className="mb-6">
    <h1 className="text-2xl md:text-3xl font-bold text-ink">Role Management</h1>
    <p className="text-ink-3 mt-1">Manage user roles and permissions</p>
   </div>
   <div className="bg-surface rounded-xl shadow-sm border border-hairline p-4 md:p-6">
    <RoleManagementComponent />
   </div>
  </div>
 )
}

export default RoleManagementPage