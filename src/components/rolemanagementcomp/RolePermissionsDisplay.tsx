import React, { useState, useEffect } from 'react';
import { UnifiedBadge, getPermissionBadgeColor } from '../ui';
import { getRoleById, getModuleDefinitions } from '../../services/role.service';
import { parseApiPermissions } from './types/permissionKeys';
import type { ModulePermission, GlobalSettings } from './types/permissions.types';
import { DEFAULT_GLOBAL_SETTINGS } from './types/permissions.types';

const ACTION_KEYS = ['view', 'create', 'edit', 'delete', 'approve', 'export'] as const;

interface RolePermissionsDisplayProps {
 roleId: string;
}

const RolePermissionsDisplay: React.FC<RolePermissionsDisplayProps> = ({ roleId }) => {
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [modules, setModules] = useState<ModulePermission[]>([]);
 const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(DEFAULT_GLOBAL_SETTINGS);

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
   })
   .catch((err) => {
    if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load permissions');
   })
   .finally(() => {
    if (!cancelled) setLoading(false);
   });
  return () => { cancelled = true; };
 }, [roleId]);

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
   (s) =>
    Object.values(s.actions).some(Boolean) ||
    s.columns.some((c) => c.view || c.edit)
  )
 );

 if (!hasAnyGranted && !Object.values(globalSettings).some((v) => v === true || (typeof v === 'number' && v > 0))) {
  return (
   <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5 mt-4">
    <p className="text-yellow-700 text-sm leading-relaxed tracking-wide">No permissions configured for this role.</p>
   </div>
  );
 }

 return (
  <div className="space-y-8">
   {/* Module & submodule permissions */}
   <div>
    <h4 className="text-md font-semibold text-gray-800 mb-5 uppercase tracking-wider">Module Permissions</h4>
    <div className="space-y-6">
     {modules.map((mod) => {
      const subWithPerms = mod.subModules.filter(
       (s) =>
        Object.values(s.actions).some(Boolean) ||
        s.columns.some((c) => c.view || c.edit)
      );
      if (subWithPerms.length === 0) return null;
      return (
       <div key={mod.moduleId} className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-100 px-4 py-3 font-medium text-gray-800">
         {mod.moduleName}
        </div>
        <div className="divide-y divide-gray-100">
         {subWithPerms.map((sub) => (
          <div key={sub.subModuleId} className="px-4 py-3">
           <div className="text-sm font-medium text-gray-700 mb-2">{sub.subModuleName}</div>
           <div className="flex flex-wrap gap-2 mb-2">
            {ACTION_KEYS.map((action) => (
             sub.actions[action] && (
              <UnifiedBadge key={action} variant={getPermissionBadgeColor(true)}>
               {action}
              </UnifiedBadge>
             )
            ))}
           </div>
           {sub.columns.some((c) => c.view || c.edit) && (
            <div className="text-xs text-gray-600 mt-2">
             <span className="font-medium">Columns: </span>
             {sub.columns
              .filter((c) => c.view || c.edit)
              .map((c) => `${c.columnName} (${[c.view && 'view', c.edit && 'edit'].filter(Boolean).join(', ')})`)
              .join('; ')}
            </div>
           )}
          </div>
         ))}
        </div>
       </div>
      );
     })}
    </div>
   </div>

   {/* Global Settings */}
   <div>
    <h4 className="text-md font-semibold text-gray-800 mb-5 uppercase tracking-wider">Global Settings</h4>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-gray-50 p-6 rounded-lg border border-gray-200">
     {Object.entries(globalSettings).map(([key, value]) => (
      <div key={key} className="flex items-center space-x-3">
       <UnifiedBadge variant={getPermissionBadgeColor(!!value)}>
        {typeof value === 'number' ? value : value ? '✓' : '✗'}
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
