import React, { useState, useEffect } from 'react';
import { UnifiedBadge, getPermissionBadgeColor } from '../ui';
import { getRoleById, getModuleDefinitions } from '../../services/role.service';
import { parseApiPermissions } from './types/permissionKeys';
import type { ModulePermission, GlobalSettings } from './types/permissions.types';
import { DEFAULT_GLOBAL_SETTINGS } from './types/permissions.types';
import DepartmentPermissionMatrix from './DepartmentPermissionMatrix';

interface RolePermissionsDisplayProps {
 roleId: string;
 /** Optional label used as the single department row header. Defaults to "Role". */
 roleName?: string;
}

const RolePermissionsDisplay: React.FC<RolePermissionsDisplayProps> = ({ roleId, roleName }) => {
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [modules, setModules] = useState<ModulePermission[]>([]);
 const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(DEFAULT_GLOBAL_SETTINGS);
 const [resolvedRoleName, setResolvedRoleName] = useState<string>(roleName ?? 'Role');

 useEffect(() => {
  let cancelled = false;
  setLoading(true);
  setError(null);
  Promise.all([getRoleById(roleId), getModuleDefinitions()])
   .then(([role, defs]) => {
    if (cancelled) return;
    const { modules: mods, globalSettings: gs } = parseApiPermissions(
     role.permissions,
     defs.modules,
     defs.globalSettings ?? DEFAULT_GLOBAL_SETTINGS
    );
    setModules(mods);
    setGlobalSettings(gs);
    if (!roleName && role.role_name) setResolvedRoleName(role.role_name);
   })
   .catch((err) => {
    if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load permissions');
   })
   .finally(() => {
    if (!cancelled) setLoading(false);
   });
  return () => {
   cancelled = true;
  };
 }, [roleId, roleName]);

 if (loading) {
  return (
   <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 mt-4">
    <p className="text-gray-600 text-sm">Loading permissions…</p>
   </div>
  );
 }

 if (error) {
  return (
   <div className="bg-red-50 border border-red-200 rounded-lg p-5 mt-4">
    <p className="text-red-700 text-sm">{error}</p>
   </div>
  );
 }

 const hasAnyGranted = modules.some((m) =>
  m.subModules.some(
   (s) => Object.values(s.actions).some(Boolean) || s.columns.some((c) => c.view || c.edit)
  )
 );

 if (!hasAnyGranted && !Object.values(globalSettings).some((v) => v === true || (typeof v === 'number' && v > 0))) {
  return (
   <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5 mt-4">
    <p className="text-yellow-700 text-sm leading-relaxed tracking-wide">
     No permissions configured for this role.
    </p>
   </div>
  );
 }

 return (
  <div className="space-y-8">
   <div>
    <h4 className="text-md font-semibold text-gray-800 mb-3 uppercase tracking-wider">
     Module Permissions
    </h4>
    <DepartmentPermissionMatrix
     departments={[resolvedRoleName]}
     permissionsByDept={{ [resolvedRoleName]: modules }}
     onDeptPermissionsChange={() => {}}
     readOnly
    />
   </div>

   <div>
    <h4 className="text-md font-semibold text-gray-800 mb-5 uppercase tracking-wider">
     Global Settings
    </h4>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-gray-50 p-6 rounded-lg border border-gray-200">
     {Object.entries(globalSettings).map(([key, value]) => (
      <div key={key} className="flex items-center space-x-3">
       <UnifiedBadge variant={getPermissionBadgeColor(!!value)}>
        {typeof value === 'number' ? value : value ? 'Yes' : 'No'}
       </UnifiedBadge>
       <span className="text-sm text-gray-700 capitalize leading-relaxed tracking-wide">
        {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
       </span>
      </div>
     ))}
    </div>
   </div>
  </div>
 );
};

export default RolePermissionsDisplay;
