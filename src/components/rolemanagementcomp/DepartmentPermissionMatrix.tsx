import React, { useMemo, useState } from 'react';
import type { ModulePermission, SubModulePermission } from './types/permissions.types';

type ActionKey = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export';

const ACTION_KEYS: ActionKey[] = ['view', 'create', 'edit', 'delete', 'approve', 'export'];
const ACTION_LABELS: Record<ActionKey, string> = {
 view: 'View',
 create: 'Create',
 edit: 'Edit',
 delete: 'Delete',
 approve: 'Approve',
 export: 'Export',
};

export interface DepartmentPermissionMatrixProps {
 /** Row labels — departments (role names) for the chosen role level. */
 departments: string[];
 /** Per-department module permission tree. Every department in `departments` MUST have an entry. */
 permissionsByDept: Record<string, ModulePermission[]>;
 /** When provided, enables the "Include this department in save" checkbox column (bulk-create mode). */
 includedDepartments?: Set<string>;
 /** Fire when any action checkbox for a department/module is toggled. */
 onDeptPermissionsChange: (department: string, updated: ModulePermission[]) => void;
 /** Fire when the include checkbox for a department is toggled. Required when `includedDepartments` is provided. */
 onIncludeChange?: (department: string, include: boolean) => void;
 /** Read-only view (ViewRoles popup). Hides bulk actions; disables checkboxes. */
 readOnly?: boolean;
 /** Show the department column. Defaults to true. Set false for single-role Edit when department = role name. */
 showDepartmentColumn?: boolean;
}

/**
 * Compute aggregate state for (module, dept, action):
 *  - 'all'      : every sub-module has this action enabled
 *  - 'none'     : no sub-module has this action enabled
 *  - 'partial'  : some but not all (renders as indeterminate)
 */
function moduleActionState(mod: ModulePermission, action: ActionKey): 'all' | 'none' | 'partial' {
 if (!mod.subModules.length) return 'none';
 let on = 0;
 for (const sub of mod.subModules) {
  if (sub.actions[action]) on += 1;
 }
 if (on === 0) return 'none';
 if (on === mod.subModules.length) return 'all';
 return 'partial';
}

/** Apply an action toggle to every sub-module of a given module in a deep-cloned copy. */
function applyModuleAction(
 modules: ModulePermission[],
 moduleId: string,
 action: ActionKey,
 enable: boolean
): ModulePermission[] {
 return modules.map((mod) => {
  if (mod.moduleId !== moduleId) return mod;
  return {
   ...mod,
   subModules: mod.subModules.map<SubModulePermission>((sub) => {
    // Cascade rules kept in line with the previous PermissionMatrix:
    //  - enabling any non-view action implies view
    //  - disabling view disables all other actions
    const nextActions = { ...sub.actions, [action]: enable };
    if (enable && action !== 'view') nextActions.view = true;
    if (!enable && action === 'view') {
     nextActions.create = false;
     nextActions.edit = false;
     nextActions.delete = false;
     nextActions.approve = false;
     nextActions.export = false;
    }
    // Column-level mirrors for view/edit so downstream consumers that still read column
    // permissions remain consistent.
    const nextColumns = sub.columns.map((col) => {
     let view = col.view;
     let edit = col.edit;
     if (action === 'view') {
      view = enable;
      if (!enable) edit = false;
     }
     if (action === 'edit') {
      edit = enable;
      if (enable) view = true;
     }
     return { ...col, view, edit };
    });
    return { ...sub, actions: nextActions, columns: nextColumns };
   }),
  };
 });
}

/** Flip EVERY action for a whole module on/off (used by the "Full access on this module" toggle). */
function applyModuleFullAccess(
 modules: ModulePermission[],
 moduleId: string,
 enable: boolean
): ModulePermission[] {
 return modules.map((mod) => {
  if (mod.moduleId !== moduleId) return mod;
  return {
   ...mod,
   subModules: mod.subModules.map<SubModulePermission>((sub) => ({
    ...sub,
    actions: {
     view: enable,
     create: enable,
     edit: enable,
     delete: enable,
     approve: enable,
     export: enable,
    },
    columns: sub.columns.map((c) => ({ ...c, view: enable, edit: enable })),
   })),
  };
 });
}

function applySubModuleAction(
 modules: ModulePermission[],
 moduleId: string,
 subModuleId: string,
 action: ActionKey,
 enable: boolean
): ModulePermission[] {
 return modules.map((mod) => {
  if (mod.moduleId !== moduleId) return mod;
  return {
   ...mod,
   subModules: mod.subModules.map((sub) => {
    if (sub.subModuleId !== subModuleId) return sub;
    const nextActions = { ...sub.actions, [action]: enable };
    if (enable && action !== 'view') nextActions.view = true;
    if (!enable && action === 'view') {
     nextActions.create = false;
     nextActions.edit = false;
     nextActions.delete = false;
     nextActions.approve = false;
     nextActions.export = false;
    }
    const nextColumns = sub.columns.map((col) => {
      let view = col.view;
      let edit = col.edit;
      if (action === 'view') {
        view = enable;
        if (!enable) edit = false;
      }
      if (action === 'edit') {
        edit = enable;
        if (enable) view = true;
      }
      return { ...col, view, edit };
    });
    return { ...sub, actions: nextActions, columns: nextColumns };
   }),
  };
 });
}

function applyColumnPermission(
 modules: ModulePermission[],
 moduleId: string,
 subModuleId: string,
 columnId: string,
 mode: 'view' | 'edit',
 enable: boolean
): ModulePermission[] {
 return modules.map((mod) => {
  if (mod.moduleId !== moduleId) return mod;
  return {
   ...mod,
   subModules: mod.subModules.map((sub) => {
    if (sub.subModuleId !== subModuleId) return sub;
    const nextColumns = sub.columns.map((col) => {
      if (col.columnId !== columnId) return col;
      let view = col.view;
      let edit = col.edit;
      if (mode === 'view') {
        view = enable;
        if (!enable) edit = false;
      } else {
        edit = enable;
        if (enable) view = true;
      }
      return { ...col, view, edit };
    });
    const hasAnyView = nextColumns.some((c) => c.view);
    const hasAnyEdit = nextColumns.some((c) => c.edit);
    const nextActions = { ...sub.actions };
    nextActions.view = nextActions.view || hasAnyView;
    nextActions.edit = nextActions.edit || hasAnyEdit;
    return { ...sub, columns: nextColumns, actions: nextActions };
   }),
  };
 });
}

/** Flip ALL modules / all actions for a department (row-level "Full access" shortcut). */
function applyAllModulesFullAccess(modules: ModulePermission[], enable: boolean): ModulePermission[] {
 return modules.map((mod) => ({
  ...mod,
  subModules: mod.subModules.map<SubModulePermission>((sub) => ({
   ...sub,
   actions: {
    view: enable,
    create: enable,
    edit: enable,
    delete: enable,
    approve: enable,
    export: enable,
   },
   columns: sub.columns.map((c) => ({ ...c, view: enable, edit: enable })),
  })),
 }));
}

/** True iff this department has every action on every sub-module of every module. */
function isDepartmentFullyGranted(modules: ModulePermission[]): boolean {
 return modules.every((m) =>
  m.subModules.every((s) => ACTION_KEYS.every((a) => s.actions[a]))
 );
}

const TriStateCheckbox: React.FC<{
 state: 'all' | 'none' | 'partial';
 onChange: (enable: boolean) => void;
 disabled?: boolean;
 title?: string;
}> = ({ state, onChange, disabled, title }) => {
 const checked = state === 'all';
 return (
  <input
   type="checkbox"
   checked={checked}
   ref={(el) => {
    if (el) el.indeterminate = state === 'partial';
   }}
   onChange={() => onChange(state !== 'all')}
   disabled={disabled}
   title={title}
   className={`w-4 h-4 rounded border-2 transition-all cursor-pointer
    ${checked ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-gray-300'}
    ${state === 'partial' ? 'border-amber-400' : ''}
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-amber-400'}
    focus:ring-2 focus:ring-slate-800 focus:ring-offset-1`}
  />
 );
};

const DepartmentPermissionMatrix: React.FC<DepartmentPermissionMatrixProps> = ({
 departments,
 permissionsByDept,
 includedDepartments,
 onDeptPermissionsChange,
 onIncludeChange,
 readOnly = false,
 showDepartmentColumn = true,
}) => {
 // Module tabs come from the first department's tree (all departments share the same module shape).
 const firstDept = departments[0];
 const modules: ModulePermission[] = useMemo(() => {
  if (!firstDept) return [];
  return permissionsByDept[firstDept] ?? [];
 }, [firstDept, permissionsByDept]);

 const [activeModuleId, setActiveModuleId] = useState<string>(() => modules[0]?.moduleId ?? '');

 const activeModuleIdSafe = useMemo(() => {
  if (modules.some((m) => m.moduleId === activeModuleId)) return activeModuleId;
  return modules[0]?.moduleId ?? '';
 }, [activeModuleId, modules]);

 const showInclude = !!includedDepartments && !readOnly;

 const isDeptIncluded = (dept: string): boolean =>
  includedDepartments ? includedDepartments.has(dept) : true;

 const activeModuleForDept = (dept: string): ModulePermission | undefined => {
  const tree = permissionsByDept[dept];
  if (!tree) return undefined;
  return tree.find((m) => m.moduleId === activeModuleIdSafe);
 };

 const handleAction = (dept: string, action: ActionKey, enable: boolean) => {
  if (readOnly) return;
  const tree = permissionsByDept[dept];
  if (!tree) return;
  onDeptPermissionsChange(dept, applyModuleAction(tree, activeModuleIdSafe, action, enable));
 };

 const handleModuleFull = (dept: string, enable: boolean) => {
  if (readOnly) return;
  const tree = permissionsByDept[dept];
  if (!tree) return;
  onDeptPermissionsChange(dept, applyModuleFullAccess(tree, activeModuleIdSafe, enable));
 };

 const handleDeptFullAllModules = (dept: string, enable: boolean) => {
  if (readOnly) return;
  const tree = permissionsByDept[dept];
  if (!tree) return;
  onDeptPermissionsChange(dept, applyAllModulesFullAccess(tree, enable));
 };

 const handleSubModuleAction = (dept: string, subModuleId: string, action: ActionKey, enable: boolean) => {
  if (readOnly) return;
  const tree = permissionsByDept[dept];
  if (!tree) return;
  onDeptPermissionsChange(
   dept,
   applySubModuleAction(tree, activeModuleIdSafe, subModuleId, action, enable)
  );
 };

 const handleColumnToggle = (
  dept: string,
  subModuleId: string,
  columnId: string,
  mode: 'view' | 'edit',
  enable: boolean
 ) => {
  if (readOnly) return;
  const tree = permissionsByDept[dept];
  if (!tree) return;
  onDeptPermissionsChange(
   dept,
   applyColumnPermission(tree, activeModuleIdSafe, subModuleId, columnId, mode, enable)
  );
 };

 const handleApplyActiveModuleToAll = (action: ActionKey | 'full', enable: boolean) => {
  if (readOnly) return;
  for (const dept of departments) {
   if (includedDepartments && !includedDepartments.has(dept)) continue;
   const tree = permissionsByDept[dept];
   if (!tree) continue;
   const next =
    action === 'full'
     ? applyModuleFullAccess(tree, activeModuleIdSafe, enable)
     : applyModuleAction(tree, activeModuleIdSafe, action, enable);
   onDeptPermissionsChange(dept, next);
  }
 };

 if (!modules.length) {
  return (
   <div className="p-6 text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-lg">
    No modules available for this role level.
   </div>
  );
 }

 return (
  <div className="w-full">
   {/* Module tab strip */}
   <div className="border-b border-gray-200 mb-4 overflow-x-auto">
    <nav className="flex gap-1 min-w-max" role="tablist">
     {modules.map((m) => {
      const isActive = m.moduleId === activeModuleIdSafe;
      return (
       <button
        key={m.moduleId}
        type="button"
        role="tab"
        aria-selected={isActive}
        onClick={() => setActiveModuleId(m.moduleId)}
        className={`px-3 py-2 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
         isActive
          ? 'border-slate-800 text-slate-800'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }`}
       >
        {m.moduleName}
       </button>
      );
     })}
    </nav>
   </div>

   {/* Active module description */}
   {(() => {
    const active = modules.find((m) => m.moduleId === activeModuleIdSafe);
    return active ? (
     <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div>
       <h3 className="text-sm font-semibold text-gray-800">{active.moduleName}</h3>
       <p className="text-xs text-gray-500">{active.description}</p>
      </div>
      {!readOnly && (
       <div className="flex flex-wrap items-center gap-2">
        <button
         type="button"
         onClick={() => handleApplyActiveModuleToAll('full', true)}
         className="px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100"
        >
         Grant all actions to every department
        </button>
        <button
         type="button"
         onClick={() => handleApplyActiveModuleToAll('full', false)}
         className="px-3 py-1.5 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100"
        >
         Revoke this module for every department
        </button>
       </div>
      )}
     </div>
    ) : null;
   })()}

   {/* Department × Action table */}
   <div className="overflow-x-auto border border-gray-200 rounded-lg">
    <table className="w-full text-sm">
     <thead className="bg-gray-50">
      <tr>
       {showInclude && (
        <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-12">Include</th>
       )}
       {showDepartmentColumn && (
        <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Department</th>
       )}
       {ACTION_KEYS.map((a) => (
        <th
         key={a}
         className="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-20"
        >
         {ACTION_LABELS[a]}
        </th>
       ))}
       <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-28">
        Full (this module)
       </th>
       {!readOnly && (
        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-32">
         Full (all modules)
        </th>
       )}
      </tr>
     </thead>
     <tbody className="divide-y divide-gray-100 bg-white">
      {departments.map((dept) => {
       const included = isDeptIncluded(dept);
       const deptTree = permissionsByDept[dept];
       const activeMod = activeModuleForDept(dept);
       const fullAllModules = deptTree ? isDepartmentFullyGranted(deptTree) : false;
       const fullModuleState = activeMod
        ? ACTION_KEYS.every((a) => moduleActionState(activeMod, a) === 'all')
          ? 'all'
          : ACTION_KEYS.every((a) => moduleActionState(activeMod, a) === 'none')
          ? 'none'
          : ('partial' as const)
        : 'none';
       const rowMuted = showInclude && !included;
       const spanCols = (showInclude ? 1 : 0) + (showDepartmentColumn ? 1 : 0) + ACTION_KEYS.length + 1 + (!readOnly ? 1 : 0);
       return (
        <React.Fragment key={dept}>
         <tr
          className={`transition-colors ${rowMuted ? 'bg-gray-50/60 text-gray-400' : 'hover:bg-gray-50/50'}`}
         >
         {showInclude && (
          <td className="px-3 py-2">
           <input
            type="checkbox"
            checked={included}
            onChange={(e) => onIncludeChange?.(dept, e.target.checked)}
            disabled={readOnly}
            className="w-4 h-4 rounded border-2 border-gray-300"
            aria-label={`Include ${dept} in save`}
           />
          </td>
         )}
         {showDepartmentColumn && (
          <td className="px-3 py-2 font-medium whitespace-nowrap">{dept}</td>
         )}
         {ACTION_KEYS.map((a) => {
          const state = activeMod ? moduleActionState(activeMod, a) : 'none';
          return (
           <td key={a} className="px-3 py-2 text-center">
            <TriStateCheckbox
             state={state}
             onChange={(enable) => handleAction(dept, a, enable)}
             disabled={readOnly || rowMuted}
             title={`${dept} — ${ACTION_LABELS[a]} on ${activeMod?.moduleName ?? ''}`}
            />
           </td>
          );
         })}
         <td className="px-3 py-2 text-center">
          <TriStateCheckbox
           state={fullModuleState}
           onChange={(enable) => handleModuleFull(dept, enable)}
           disabled={readOnly || rowMuted}
           title={`Grant all 6 actions on ${activeMod?.moduleName ?? ''} for ${dept}`}
          />
         </td>
         {!readOnly && (
          <td className="px-3 py-2 text-center">
           <input
            type="checkbox"
            checked={fullAllModules}
            onChange={(e) => handleDeptFullAllModules(dept, e.target.checked)}
            disabled={rowMuted}
            className="w-4 h-4 rounded border-2 border-gray-300"
            title={`Grant every action on every module for ${dept}`}
            aria-label={`Full access to all modules for ${dept}`}
           />
          </td>
         )}
         </tr>
         {/* Granular submodule + step controls for active module */}
         <tr className={rowMuted ? 'bg-gray-50/30' : 'bg-white'}>
          <td colSpan={spanCols} className="px-3 py-3 border-t border-dashed border-gray-100">
           {activeMod ? (
            <div className="space-y-3">
             <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Submodule and Step Controls ({activeMod.moduleName}) - {dept}
             </div>
             {activeMod.subModules.map((sub) => (
              <div key={sub.subModuleId} className="rounded-lg border border-gray-100 p-3">
               <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-gray-700">{sub.subModuleName}</div>
                <div className="flex flex-wrap items-center gap-3 text-[11px]">
                 {ACTION_KEYS.map((a) => (
                  <label key={`${sub.subModuleId}-${a}`} className="inline-flex items-center gap-1 text-gray-600">
                   <input
                    type="checkbox"
                    checked={!!sub.actions[a]}
                    onChange={(e) => handleSubModuleAction(dept, sub.subModuleId, a, e.target.checked)}
                    disabled={readOnly || rowMuted}
                    className="w-3.5 h-3.5 rounded border border-gray-300"
                   />
                   {ACTION_LABELS[a]}
                  </label>
                 ))}
                </div>
               </div>
               {sub.columns.length > 0 && (
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                 {sub.columns.map((col) => (
                  <div key={col.columnId} className="flex items-center justify-between rounded bg-gray-50 px-2 py-1.5 text-[11px]">
                   <span className="text-gray-700 mr-2">{col.columnName}</span>
                   <span className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1 text-gray-600">
                     <input
                      type="checkbox"
                      checked={!!col.view}
                      onChange={(e) =>
                       handleColumnToggle(dept, sub.subModuleId, col.columnId, 'view', e.target.checked)
                      }
                      disabled={readOnly || rowMuted}
                      className="w-3.5 h-3.5 rounded border border-gray-300"
                     />
                     View
                    </label>
                    <label className="inline-flex items-center gap-1 text-gray-600">
                     <input
                      type="checkbox"
                      checked={!!col.edit}
                      onChange={(e) =>
                       handleColumnToggle(dept, sub.subModuleId, col.columnId, 'edit', e.target.checked)
                      }
                      disabled={readOnly || rowMuted}
                      className="w-3.5 h-3.5 rounded border border-gray-300"
                     />
                     Edit
                    </label>
                   </span>
                  </div>
                 ))}
                </div>
               )}
              </div>
             ))}
            </div>
           ) : (
            <span className="text-xs text-gray-500">No submodules found for active module.</span>
           )}
          </td>
         </tr>
        </React.Fragment>
       );
      })}
     </tbody>
    </table>
   </div>

   {!readOnly && (
    <p className="mt-2 text-[11px] text-gray-500">
     Tick a cell to grant that action on <span className="font-medium">{modules.find((m) => m.moduleId === activeModuleIdSafe)?.moduleName ?? 'the module'}</span> for that department.
     "Full (this module)" grants all six actions on the active module; "Full (all modules)" grants everything everywhere for that row.
    </p>
   )}
  </div>
 );
};

export default DepartmentPermissionMatrix;
