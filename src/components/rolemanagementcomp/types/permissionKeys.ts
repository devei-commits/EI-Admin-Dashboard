/**
 * Permission state as a list of granted keys. Backend stores only this; frontend owns the module tree.
 * Key format: "{moduleId}.{subModuleId}.action.{action}" | "{moduleId}.{subModuleId}.column.{columnId}.view|edit"
 */

import type { ModulePermission, GlobalSettings } from './permissions.types';

const ACTION_KEYS = ['view', 'create', 'edit', 'delete', 'approve', 'export'] as const;

export function flattenPermissionsToGranted(
 modules: ModulePermission[],
 globalSettings: GlobalSettings
): { granted: string[]; globalSettings: GlobalSettings } {
 const granted: string[] = [];
 for (const mod of modules) {
  for (const sub of mod.subModules) {
   for (const action of ACTION_KEYS) {
    if (sub.actions[action]) {
     granted.push(`${mod.moduleId}.${sub.subModuleId}.action.${action}`);
    }
   }
   for (const col of sub.columns) {
    if (col.view) granted.push(`${mod.moduleId}.${sub.subModuleId}.column.${col.columnId}.view`);
    if (col.edit) granted.push(`${mod.moduleId}.${sub.subModuleId}.column.${col.columnId}.edit`);
   }
  }
 }
 return { granted, globalSettings };
}

export function grantedToPermissionsTree(
 granted: string[],
 moduleDefinitions: ModulePermission[],
 globalSettings: GlobalSettings
): { modules: ModulePermission[]; globalSettings: GlobalSettings } {
 const set = new Set(granted);
 const modules: ModulePermission[] = moduleDefinitions.map((mod) => ({
  ...mod,
  subModules: mod.subModules.map((sub) => {
   const actions = { view: false, create: false, edit: false, delete: false, approve: false, export: false };
   for (const a of ACTION_KEYS) {
    if (set.has(`${mod.moduleId}.${sub.subModuleId}.action.${a}`)) actions[a] = true;
   }
   const columns = sub.columns.map((col) => ({
    ...col,
    view: set.has(`${mod.moduleId}.${sub.subModuleId}.column.${col.columnId}.view`),
    edit: set.has(`${mod.moduleId}.${sub.subModuleId}.column.${col.columnId}.edit`),
   }));
   return { ...sub, actions, columns };
  }),
 }));
 return { modules, globalSettings };
}

/** Parse API permissions (granted + globalSettings) and optional legacy (modules + globalSettings) */
export function parseApiPermissions(
 permissions: { granted?: string[]; globalSettings?: GlobalSettings; modules?: ModulePermission[] } | null | undefined,
 moduleDefinitions: ModulePermission[],
 defaultGlobal: GlobalSettings
): { modules: ModulePermission[]; globalSettings: GlobalSettings } {
 if (!permissions) return { modules: moduleDefinitions, globalSettings: defaultGlobal };
 if (Array.isArray(permissions.granted)) {
  return grantedToPermissionsTree(
   permissions.granted,
   moduleDefinitions,
   permissions.globalSettings ?? defaultGlobal
  );
 }
 if (permissions.modules?.length) {
  return {
   modules: permissions.modules,
   globalSettings: permissions.globalSettings ?? defaultGlobal,
  };
 }
 return { modules: moduleDefinitions, globalSettings: permissions.globalSettings ?? defaultGlobal };
}
