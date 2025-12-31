import { RoleManagement as RoleManagementComponent } from '../components/rolemanagementcomp';

const RoleManagementPage = () => {
  return (
    <div className="p-3 md:p-4 bg-white rounded shadow min-h-screen">
      <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Role Management</h1>
      <RoleManagementComponent />
    </div>
  )
}

export default RoleManagementPage