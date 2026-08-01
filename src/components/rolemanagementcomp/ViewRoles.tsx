import React, { useState, useEffect, useCallback, useMemo } from 'react';
import RoleDetailPopup from './RoleDetailPopup.tsx';
import EditRoleFullPage from './EditRoleFullPage.tsx';
import { UnifiedButton, UnifiedBadge, ConfirmDialog, getStatusBadgeColor, getRoleLevelBadgeColor } from '../ui';
import { listRoles, deleteRole as deleteRoleApi } from '../../services/role.service';
import { SortableTableTh, type SortDirection } from '../ui/SortableTableTh';

type RoleSortColumn =
  | 'roleName'
  | 'roleLevel'
  | 'roleStatus'
  | 'permissionsSet'
  | 'createdAt'
  | 'updatedAt';

function parseRoleDate(value: string): number {
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function sortValueForRole(role: Role, column: RoleSortColumn): string | number {
  switch (column) {
    case 'roleName':
      return role.roleName.toLowerCase();
    case 'roleLevel':
      return role.roleLevel.toLowerCase();
    case 'roleStatus':
      return role.roleStatus;
    case 'permissionsSet':
      return role.permissionsSet ? 1 : 0;
    case 'createdAt':
      return parseRoleDate(role.roleCreatedAt);
    case 'updatedAt':
      return parseRoleDate(role.roleUpdatedAt);
    default:
      return '';
  }
}

export interface Role {
 id: string;
 roleName: string;
 roleLevel: string;
 roleStatus: 'active' | 'inactive';
 roleCreatedAt: string;
 roleUpdatedAt: string;
 description: string;
 /** True when the role has permissions stored in the backend (granted keys). */
 permissionsSet?: boolean;
}

export interface RoleUser {
 id: string;
 email: string;
 password: string;
 name: string;
 addedAt: string;
}

// Local storage key for role users (optional; users can be loaded from API per role)
const ROLE_USERS_STORAGE_KEY = 'eisthetic_role_users';

type RoleUsersMap = {
 [roleId: string]: RoleUser[];
};

// Default roles data
const defaultRoles: Role[] = [
  {
   id: 'ROLE001',
   roleName: 'Super Admin',
   roleLevel: 'admin',
   roleStatus: 'active',
   roleCreatedAt: '2024-01-10',
   roleUpdatedAt: '2024-02-15 10:30:00',
   description: 'Full system access with all administrative privileges'
  },
  {
   id: 'ROLE002',
   roleName: 'Admin',
   roleLevel: 'admin',
   roleStatus: 'active',
   roleCreatedAt: '2024-01-12',
   roleUpdatedAt: '2024-02-20 14:20:00',
   description: 'Administrative access with system management capabilities'
  },
  {
   id: 'ROLE003',
   roleName: 'BD Manager',
   roleLevel: 'manager',
   roleStatus: 'active',
   roleCreatedAt: '2024-01-15',
   roleUpdatedAt: '2024-02-18 09:45:00',
   description: 'Manages business development operations and team'
  },
  {
   id: 'ROLE004',
   roleName: 'QA Manager',
   roleLevel: 'manager',
   roleStatus: 'active',
   roleCreatedAt: '2024-01-18',
   roleUpdatedAt: '2024-02-22 16:15:00',
   description: 'Oversees quality assurance processes and team management'
  },
  {
   id: 'ROLE005',
   roleName: 'R&D Lead',
   roleLevel: 'manager',
   roleStatus: 'active',
   roleCreatedAt: '2024-01-20',
   roleUpdatedAt: '2024-02-25 11:30:00',
   description: 'Leads research and development initiatives and team'
  },
  {
   id: 'ROLE006',
   roleName: 'Procurement',
   roleLevel: 'staff',
   roleStatus: 'active',
   roleCreatedAt: '2024-01-22',
   roleUpdatedAt: '2024-02-20 10:15:00',
   description: 'Handles procurement and vendor management operations'
  },
  {
   id: 'ROLE007',
   roleName: 'Manufacturing and Production',
   roleLevel: 'staff',
   roleStatus: 'active',
   roleCreatedAt: '2024-01-24',
   roleUpdatedAt: '2024-02-22 14:30:00',
   description: 'Manages manufacturing and production processes'
  },
  {
   id: 'ROLE008',
   roleName: 'Sales',
   roleLevel: 'staff',
   roleStatus: 'active',
   roleCreatedAt: '2024-01-26',
   roleUpdatedAt: '2024-02-24 11:45:00',
   description: 'Sales operations and customer relations'
  },
  {
   id: 'ROLE009',
   roleName: 'Logistics',
   roleLevel: 'staff',
   roleStatus: 'active',
   roleCreatedAt: '2024-01-28',
   roleUpdatedAt: '2024-02-26 09:20:00',
   description: 'Manages logistics, shipping, and supply chain operations'
  },
  {
   id: 'ROLE010',
   roleName: 'Design',
   roleLevel: 'staff',
   roleStatus: 'active',
   roleCreatedAt: '2024-02-01',
   roleUpdatedAt: '2024-02-28 13:30:00',
   description: 'Product and graphic design responsibilities'
  },
  {
   id: 'ROLE011',
   roleName: 'R&D Staff',
   roleLevel: 'staff',
   roleStatus: 'active',
   roleCreatedAt: '2024-02-03',
   roleUpdatedAt: '2024-02-25 15:10:00',
   description: 'Research and development team member'
  },
  {
   id: 'ROLE012',
   roleName: 'QA Staff',
   roleLevel: 'staff',
   roleStatus: 'active',
   roleCreatedAt: '2024-02-05',
   roleUpdatedAt: '2024-02-27 10:25:00',
   description: 'Quality assurance testing and validation'
  },
  {
   id: 'ROLE013',
   roleName: 'BD Staff',
   roleLevel: 'staff',
   roleStatus: 'active',
   roleCreatedAt: '2024-02-07',
   roleUpdatedAt: '2024-02-28 16:40:00',
   description: 'Business development support and operations'
  },
  {
   id: 'ROLE014',
   roleName: 'Doctor',
   roleLevel: 'client',
   roleStatus: 'active',
   roleCreatedAt: '2024-02-10',
   roleUpdatedAt: '2024-02-28 12:15:00',
   description: 'Medical professional client access'
  },
  {
   id: 'ROLE015',
   roleName: 'Customer',
   roleLevel: 'client',
   roleStatus: 'active',
   roleCreatedAt: '2024-02-12',
   roleUpdatedAt: '2024-02-28 14:50:00',
   description: 'Customer client access to platform services'
  }
 ];

// Helper functions for role users localStorage
export const loadRoleUsersMapFromStorage = (): RoleUsersMap => {
 try {
  const stored = localStorage.getItem(ROLE_USERS_STORAGE_KEY);
  if (stored) {
   return JSON.parse(stored) as RoleUsersMap;
  }
 } catch (error) {
 }
 return {};
};

export const saveRoleUsersMapToStorage = (roleUsersMap: RoleUsersMap): void => {
 try {
  localStorage.setItem(ROLE_USERS_STORAGE_KEY, JSON.stringify(roleUsersMap));
 } catch (error) {
 }
};

function mapApiRoleToRole(r: { role_id: number; role_name: string; description?: string | null; level: string; status: string; userCount?: number; permissionsSet?: boolean; createdAt?: string }): Role {
 return {
  id: String(r.role_id),
  roleName: r.role_name,
  roleLevel: r.level,
  roleStatus: (r.status === 'active' ? 'active' : 'inactive') as Role['roleStatus'],
  roleCreatedAt: r.createdAt ?? '',
  roleUpdatedAt: r.createdAt ?? '',
  description: r.description ?? '',
  permissionsSet: r.permissionsSet ?? false,
 };
}

const ViewRoles: React.FC = () => {
 const [selectedRole, setSelectedRole] = useState<Role | null>(null);
 const [isViewPopupOpen, setIsViewPopupOpen] = useState(false);
 const [isEditFullPageOpen, setIsEditFullPageOpen] = useState(false);
 const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);
 const [roles, setRoles] = useState<Role[]>([]);
 const [rolesLoading, setRolesLoading] = useState(true);
 const [sortColumn, setSortColumn] = useState<RoleSortColumn | null>(null);
 const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
 const [roleUsersMap, setRoleUsersMap] = useState<RoleUsersMap>(() => loadRoleUsersMapFromStorage());

 const sortedRoles = useMemo(() => {
  if (!sortColumn) return roles;
  const rows = [...roles];
  rows.sort((a, b) => {
   const av = sortValueForRole(a, sortColumn);
   const bv = sortValueForRole(b, sortColumn);
   let cmp: number;
   if (typeof av === 'number' && typeof bv === 'number') {
    cmp = av - bv;
   } else {
    cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
   }
   if (cmp === 0) cmp = a.roleName.localeCompare(b.roleName, undefined, { numeric: true, sensitivity: 'base' });
   return sortDirection === 'asc' ? cmp : -cmp;
  });
  return rows;
 }, [roles, sortColumn, sortDirection]);

 const toggleRoleSort = (column: RoleSortColumn) => {
  if (sortColumn === column) {
   setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
   return;
  }
  setSortColumn(column);
  setSortDirection('asc');
 };

 const loadRoles = useCallback(async () => {
  setRolesLoading(true);
  try {
   const list = await listRoles();
   setRoles(list.map(mapApiRoleToRole));
  } catch {
   setRoles(defaultRoles);
  } finally {
   setRolesLoading(false);
  }
 }, []);

 useEffect(() => {
  loadRoles();
 }, [loadRoles]);

 useEffect(() => {
  saveRoleUsersMapToStorage(roleUsersMap);
 }, [roleUsersMap]);

 const handleViewRole = (role: Role) => {
  setSelectedRole(role);
  setIsViewPopupOpen(true);
 };

 const handleEditRole = (role: Role) => {
  setSelectedRole(role);
  setIsEditFullPageOpen(true);
 };

 const handleDeleteRole = (roleId: string) => {
  setDeleteRoleId(roleId);
 };

 const confirmDeleteRole = async () => {
  if (!deleteRoleId) return;
  try {
   await deleteRoleApi(deleteRoleId);
   setRoles(prevRoles => prevRoles.filter(role => role.id !== deleteRoleId));
   setRoleUsersMap(prev => {
    const { [deleteRoleId]: _removed, ...rest } = prev;
    return rest;
   });
  } catch {
   // keep dialog open or toast error
  }
  setDeleteRoleId(null);
 };

 const handleSaveRole = (updatedRole: Role, users?: RoleUser[]) => {
  setRoles(prevRoles =>
   prevRoles.map(role =>
    role.id === updatedRole.id ? updatedRole : role
   )
  );
  if (users) {
   setRoleUsersMap(prev => ({ ...prev, [updatedRole.id]: users }));
  }
  // Refetch list so "Permissions Set" and other server state stay in sync
  loadRoles();
 };

 const handleCloseViewPopup = () => {
  setIsViewPopupOpen(false);
  setSelectedRole(null);
 };

 const handleCloseEditFullPage = () => {
  setIsEditFullPageOpen(false);
  setSelectedRole(null);
 };

 if (rolesLoading) {
  return (
   <div className="w-full">
    <h2 className="text-2xl font-semibold text-gray-800 mb-6 tracking-tight">View Roles</h2>
    <p className="text-gray-500">Loading roles...</p>
   </div>
  );
 }

 return (
  <div className="w-full">
   <h2 className="text-2xl font-semibold text-gray-800 mb-6 tracking-tight">View Roles</h2>
   
   {/* Mobile Card View */}
   <div className="md:hidden space-y-4">
    {sortedRoles.map((role) => (
     <div key={role.id} className="bg-gray-50/50 border border-gray-100 rounded-xl p-5 hover:bg-gray-50 transition-colors">
      <div className="flex justify-between items-start mb-4">
       <span className="font-semibold text-gray-800 leading-relaxed">{role.roleName}</span>
       <UnifiedBadge variant={getStatusBadgeColor(role.roleStatus)}>
        {role.roleStatus}
       </UnifiedBadge>
      </div>
      <div className="space-y-3 text-sm mb-5">
       <p className="flex items-center gap-2"><span className="font-medium text-gray-600 tracking-wide">Level:</span> <UnifiedBadge variant={getRoleLevelBadgeColor(role.roleLevel)}>{role.roleLevel}</UnifiedBadge></p>
       <div className="space-y-1.5">
        <p className="font-medium text-gray-600 uppercase tracking-wide">Permissions Set:</p>
        <UnifiedBadge variant={role.permissionsSet ? 'success' : 'outline'}>
         {role.permissionsSet ? 'Yes' : 'Not set'}
        </UnifiedBadge>
       </div>
       <p><span className="font-medium text-gray-600 tracking-wide">Created:</span> <span className="text-gray-700 leading-relaxed">{role.roleCreatedAt}</span></p>
       <p><span className="font-medium text-gray-600 tracking-wide">Updated:</span> <span className="text-gray-700 leading-relaxed">{role.roleUpdatedAt}</span></p>
      </div>
      <div className="flex flex-wrap gap-3">
       <UnifiedButton variant="primary" size="sm" onClick={() => handleViewRole(role)}>
        View
       </UnifiedButton>
       <UnifiedButton variant="secondary" size="sm" onClick={() => handleEditRole(role)}>
        Edit
       </UnifiedButton>
       <UnifiedButton variant="danger" size="sm" onClick={() => handleDeleteRole(role.id)}>
        Delete
       </UnifiedButton>
      </div>
     </div>
    ))}
   </div>

   {/* Desktop Table View */}
   <div className="hidden md:block overflow-x-auto">
    <table className="w-full">
     <thead>
      <tr className="border-b-2 border-gray-200 bg-gray-50">
       <SortableTableTh label="Role Name" column="roleName" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleRoleSort} />
       <SortableTableTh label="Role Level" column="roleLevel" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleRoleSort} />
       <SortableTableTh label="Role Status" column="roleStatus" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleRoleSort} />
       <SortableTableTh label="Permissions Set" column="permissionsSet" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleRoleSort} />
       <SortableTableTh label="Created At" column="createdAt" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleRoleSort} />
       <SortableTableTh label="Updated At" column="updatedAt" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleRoleSort} />
       <th scope="col" className="px-5 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider leading-relaxed">
        Actions
       </th>
      </tr>
     </thead>
     <tbody className="divide-y divide-gray-100">
      {sortedRoles.map((role) => (
       <tr key={role.id} className="hover:bg-gray-50/50 transition-colors">
        <td className="px-5 py-4 font-medium text-gray-800 leading-relaxed">
         {role.roleName}
        </td>
        <td className="px-5 py-4 leading-relaxed">
         <UnifiedBadge variant={getRoleLevelBadgeColor(role.roleLevel)}>
          {role.roleLevel}
         </UnifiedBadge>
        </td>
        <td className="px-5 py-4 leading-relaxed">
         <UnifiedBadge variant={getStatusBadgeColor(role.roleStatus)}>
          {role.roleStatus}
         </UnifiedBadge>
        </td>
        <td className="px-5 py-4 leading-relaxed">
         <UnifiedBadge variant={role.permissionsSet ? 'success' : 'outline'}>
          {role.permissionsSet ? 'Yes' : 'Not set'}
         </UnifiedBadge>
        </td>
        <td className="px-5 py-4 text-gray-700 leading-relaxed">
         {role.roleCreatedAt}
        </td>
        <td className="px-5 py-4 text-gray-700 leading-relaxed">
         {role.roleUpdatedAt}
        </td>
        <td className="px-5 py-4 leading-relaxed">
         <div className="flex space-x-3">
          <UnifiedButton variant="primary" size="sm" onClick={() => handleViewRole(role)}>
           View
          </UnifiedButton>
          <UnifiedButton variant="secondary" size="sm" onClick={() => handleEditRole(role)}>
           Edit
          </UnifiedButton>
          <UnifiedButton variant="danger" size="sm" onClick={() => handleDeleteRole(role.id)}>
           Delete
          </UnifiedButton>
         </div>
        </td>
       </tr>
      ))}
     </tbody>
    </table>
   </div>

   {/* Role Detail Popup */}
   {isViewPopupOpen && selectedRole && (
    <RoleDetailPopup
     role={selectedRole}
     onClose={handleCloseViewPopup}
    />
   )}

   {/* Edit Role Full Page */}
   {isEditFullPageOpen && selectedRole && (
    <EditRoleFullPage
     role={selectedRole}
     users={roleUsersMap[selectedRole.id] || []}
     onClose={handleCloseEditFullPage}
     onSave={handleSaveRole}
    />
   )}

   {/* Delete Confirmation Dialog */}
   <ConfirmDialog
    isOpen={!!deleteRoleId}
    onClose={() => setDeleteRoleId(null)}
    onConfirm={confirmDeleteRole}
    title="Delete Role"
    message="Are you sure you want to delete this role? This action cannot be undone."
    confirmText="Delete"
    variant="danger"
   />
  </div>
 );
};

export default ViewRoles;