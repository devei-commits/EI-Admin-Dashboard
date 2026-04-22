import React, { useEffect, useMemo, useState } from 'react';
import { UnifiedButton, UnifiedLabel, UnifiedCard } from '../ui';
import DepartmentPermissionMatrix from './DepartmentPermissionMatrix';
import {
 ModulePermission,
 GlobalSettings,
 DEFAULT_MODULE_PERMISSIONS,
 DEFAULT_GLOBAL_SETTINGS,
 createFullAccessPermissions,
} from './types/permissions.types';
import { flattenPermissionsToGranted } from './types/permissionKeys';
import { createRole as createRoleApi } from '../../services/role.service';

const ROLE_HIERARCHY: Record<string, string[]> = {
 admin: ['Super Admin', 'Admin'],
 manager: ['BD Manager', 'R&D Manager', 'QA Manager'],
 staff: [
  'BD Staff',
  'R&D Staff',
  'QA Staff',
  'Sales',
  'Design',
  'Procurement',
  'Manufacturing and Production',
  'Logistics',
 ],
 client: ['Doctor', 'Customer'],
};
const ROLE_LEVELS = Object.keys(ROLE_HIERARCHY);

const toRoleCode = (name: string): string =>
 name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

interface CreateRoleSummary {
 successes: string[];
 failures: Array<{ department: string; message: string }>;
}

const cloneDefaults = (): ModulePermission[] =>
 JSON.parse(JSON.stringify(DEFAULT_MODULE_PERMISSIONS)) as ModulePermission[];

const CreateRole: React.FC = () => {
 const [formData, setFormData] = useState({
  roleLevel: '',
  roleStatus: 'active' as 'active' | 'inactive',
  description: '',
 });

 const [activeStep, setActiveStep] = useState<'basic' | 'permissions'>('basic');

 // Per-department permission trees. Keyed by department name (role_name).
 const [permissionsByDept, setPermissionsByDept] = useState<Record<string, ModulePermission[]>>({});
 const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({ ...DEFAULT_GLOBAL_SETTINGS });
 // Which departments are included in the bulk save. Defaults to all selected.
 const [includedDepts, setIncludedDepts] = useState<Set<string>>(new Set());

 const departments = useMemo(
  () => (formData.roleLevel ? ROLE_HIERARCHY[formData.roleLevel] ?? [] : []),
  [formData.roleLevel]
 );

 // Re-seed per-department state whenever level changes. Admin gets full access; others get blank defaults.
 useEffect(() => {
  if (!formData.roleLevel) {
   setPermissionsByDept({});
   setIncludedDepts(new Set());
   setGlobalSettings({ ...DEFAULT_GLOBAL_SETTINGS });
   return;
  }
  const seed: Record<string, ModulePermission[]> = {};
  for (const dept of departments) {
   seed[dept] =
    formData.roleLevel === 'admin' ? createFullAccessPermissions() : cloneDefaults();
  }
  setPermissionsByDept(seed);
  setIncludedDepts(new Set(departments));
  if (formData.roleLevel === 'admin') {
   setGlobalSettings({
    ...DEFAULT_GLOBAL_SETTINGS,
    accessToAllModules: true,
    allowLogin: true,
    allowMultipleSessions: true,
    canChangePassword: true,
    enableAuditLog: true,
    canExportData: true,
    canImportData: true,
    canAccessReports: true,
    canAccessSettings: true,
   });
  } else {
   setGlobalSettings({ ...DEFAULT_GLOBAL_SETTINGS });
  }
 }, [formData.roleLevel, departments]);

 const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  const { name, value } = e.target;
  setFormData((prev) => ({ ...prev, [name]: value }));
 };

 const handleDeptPermissionsChange = (dept: string, next: ModulePermission[]) => {
  setPermissionsByDept((prev) => ({ ...prev, [dept]: next }));
 };

 const handleIncludeChange = (dept: string, include: boolean) => {
  setIncludedDepts((prev) => {
   const next = new Set(prev);
   if (include) next.add(dept);
   else next.delete(dept);
   return next;
  });
 };

 const [submitting, setSubmitting] = useState(false);
 const [submitError, setSubmitError] = useState<string | null>(null);
 const [lastResult, setLastResult] = useState<CreateRoleSummary | null>(null);

 const createRolesBulk = async () => {
  setSubmitError(null);
  setLastResult(null);
  if (!formData.roleLevel) {
   setSubmitError('Pick a Role Level first.');
   return;
  }
  const toCreate = departments.filter((d) => includedDepts.has(d));
  if (toCreate.length === 0) {
   setSubmitError('Select at least one department to save.');
   return;
  }
  setSubmitting(true);
  const result: CreateRoleSummary = { successes: [], failures: [] };
  for (const dept of toCreate) {
   const tree = permissionsByDept[dept] ?? cloneDefaults();
   const { granted, globalSettings: gs } = flattenPermissionsToGranted(tree, globalSettings);
   const roleCode = toRoleCode(dept);
   if (!roleCode) {
    result.failures.push({ department: dept, message: 'Invalid role code.' });
    continue;
   }
   try {
    await createRoleApi({
     role_code: roleCode,
     role_name: dept,
     description: formData.description || undefined,
     level: formData.roleLevel,
     status: formData.roleStatus,
     permissions: { granted, globalSettings: gs },
    });
    result.successes.push(dept);
   } catch (err) {
    result.failures.push({
     department: dept,
     message: err instanceof Error ? err.message : 'Request failed (role code may already exist).',
    });
   }
  }
  setSubmitting(false);
  setLastResult(result);
  if (result.successes.length > 0 && result.failures.length === 0) {
   setFormData({ roleLevel: '', roleStatus: 'active', description: '' });
   setActiveStep('basic');
  }
 };

 const isBasicInfoComplete = Boolean(formData.roleLevel);

 return (
  <div className="w-full max-w-7xl">
   <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-4 sm:mb-6 tracking-tight">
    Create Roles (bulk by level)
   </h2>

   {/* Step indicator */}
   <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-0 mb-6 sm:mb-8 p-4 bg-gray-50 rounded-xl sm:bg-transparent sm:p-0">
    <div className="flex items-center">
     <div
      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold text-sm sm:text-base ${
       activeStep === 'basic' ? 'bg-slate-800 text-white' : 'bg-emerald-500 text-white'
      }`}
     >
      {activeStep === 'permissions' ? (
       <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
       </svg>
      ) : (
       '1'
      )}
     </div>
     <span
      className={`ml-2 sm:ml-3 text-sm sm:text-base font-medium ${
       activeStep === 'basic' ? 'text-slate-800' : 'text-gray-600'
      }`}
     >
      Basic Information
     </span>
    </div>
    <div className="hidden sm:block flex-1 h-1 mx-4 bg-gray-200 rounded">
     <div
      className={`h-full bg-slate-800 rounded transition-all duration-300 ${
       activeStep === 'permissions' ? 'w-full' : 'w-0'
      }`}
     />
    </div>
    <div className="sm:hidden w-0.5 h-6 bg-gray-200 ml-4 -my-1">
     <div
      className={`w-full bg-slate-800 transition-all duration-300 ${
       activeStep === 'permissions' ? 'h-full' : 'h-0'
      }`}
     />
    </div>
    <div className="flex items-center">
     <div
      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold text-sm sm:text-base ${
       activeStep === 'permissions' ? 'bg-slate-800 text-white' : 'bg-gray-200 text-gray-500'
      }`}
     >
      2
     </div>
     <span
      className={`ml-2 sm:ml-3 text-sm sm:text-base font-medium ${
       activeStep === 'permissions' ? 'text-slate-800' : 'text-gray-400'
      }`}
     >
      Configure Permissions
     </span>
    </div>
   </div>

   <form onSubmit={(e) => e.preventDefault()}>
    {activeStep === 'basic' && (
     <UnifiedCard>
      <h3 className="text-sm sm:text-md font-semibold text-gray-800 mb-4 sm:mb-6 uppercase tracking-wider">
       Role Information
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
       <div>
        <UnifiedLabel>Role Level</UnifiedLabel>
        <select
         name="roleLevel"
         value={formData.roleLevel}
         onChange={handleInputChange}
         className="w-full px-4 sm:px-5 py-2.5 sm:py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 bg-gray-50/50 text-base"
         required
        >
         <option value="">Select Role Level</option>
         {ROLE_LEVELS.map((level) => (
          <option key={level} value={level}>
           {level.charAt(0).toUpperCase() + level.slice(1)}
          </option>
         ))}
        </select>
        <p className="mt-1 text-sm text-gray-500">
         {formData.roleLevel === 'admin' && 'Admin levels get full access by default — review and save.'}
         {formData.roleLevel === 'manager' && 'Managers see all manager-tier departments as rows.'}
         {formData.roleLevel === 'staff' && 'All staff departments will appear as rows in the permissions table.'}
         {formData.roleLevel === 'client' && 'External (client) roles with limited access by default.'}
        </p>
       </div>

       <div>
        <UnifiedLabel>Role Status</UnifiedLabel>
        <select
         name="roleStatus"
         value={formData.roleStatus}
         onChange={handleInputChange}
         className="w-full px-5 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 bg-gray-50/50"
         required
        >
         <option value="active">Active</option>
         <option value="inactive">Inactive</option>
        </select>
        <p className="mt-1 text-xs text-gray-500">Shared across every department you save in this batch.</p>
       </div>

       <div className="md:col-span-2">
        <UnifiedLabel>Description</UnifiedLabel>
        <textarea
         name="description"
         value={formData.description}
         onChange={handleInputChange}
         rows={3}
         className="w-full px-5 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 bg-gray-50/50 resize-none"
         placeholder="Shared description applied to every role created in this batch (optional)."
        />
       </div>
      </div>

      {formData.roleLevel && (
       <div className="mt-6 p-4 bg-gray-50 border border-gray-100 rounded-lg">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
         Departments that will appear as rows
        </p>
        <div className="flex flex-wrap gap-2">
         {departments.map((d) => (
          <span
           key={d}
           className="px-2.5 py-1 text-xs bg-white border border-gray-200 rounded-full text-gray-700"
          >
           {d}
          </span>
         ))}
        </div>
        <p className="mt-3 text-xs text-gray-500">
         One role will be created per department (role code auto-derived from the name). You can uncheck any row
         in Step 2 to skip it.
        </p>
       </div>
      )}

      <div className="mt-8 flex justify-end">
       <UnifiedButton
        type="button"
        variant="primary"
        size="lg"
        disabled={!isBasicInfoComplete}
        onClick={() => setActiveStep('permissions')}
       >
        Next: Configure Permissions
        <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
       </UnifiedButton>
      </div>
     </UnifiedCard>
    )}

    {activeStep === 'permissions' && (
     <div className="space-y-6">
      <div className="bg-gray-50 border border-gray-100 rounded-xl p-6">
       <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
         <h3 className="text-lg font-semibold text-gray-800">
          Configuring permissions for <span className="capitalize text-slate-800">{formData.roleLevel}</span> level
         </h3>
         <p className="text-sm text-gray-600 mt-1">
          {includedDepts.size} of {departments.length} department(s) selected • Status:{' '}
          <span className="font-medium">{formData.roleStatus}</span>
         </p>
        </div>
        <button
         type="button"
         onClick={() => setActiveStep('basic')}
         className="text-slate-800 hover:text-slate-900 font-medium flex items-center gap-2"
        >
         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
         </svg>
         Edit Role Info
        </button>
       </div>
      </div>

      <UnifiedCard className="!p-4 sm:!p-6">
       <DepartmentPermissionMatrix
        departments={departments}
        permissionsByDept={permissionsByDept}
        includedDepartments={includedDepts}
        onDeptPermissionsChange={handleDeptPermissionsChange}
        onIncludeChange={handleIncludeChange}
       />
      </UnifiedCard>

      {/* Global settings — applies to every saved role in this batch. */}
      <UnifiedCard className="!p-4 sm:!p-6">
       <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">
        Global Settings (applied to every role in this batch)
       </h4>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(
         [
          ['accessToAllModules', 'Access to All Modules'],
          ['allowLogin', 'Allow Login'],
          ['allowMultipleSessions', 'Allow Multiple Sessions'],
          ['canChangePassword', 'Can Change Password'],
          ['enableAuditLog', 'Enable Audit Log'],
          ['canExportData', 'Can Export Data'],
          ['canImportData', 'Can Import Data'],
          ['canAccessReports', 'Can Access Reports'],
          ['canAccessSettings', 'Can Access Settings'],
         ] as Array<[keyof GlobalSettings, string]>
        ).map(([key, label]) => (
         <label
          key={String(key)}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
         >
          <input
           type="checkbox"
           checked={Boolean(globalSettings[key])}
           onChange={() =>
            setGlobalSettings((prev) => ({ ...prev, [key]: !prev[key] } as GlobalSettings))
           }
           className="w-4 h-4 rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">{label}</span>
         </label>
        ))}
       </div>
       <div className="mt-4">
        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
         Session Timeout (minutes)
        </label>
        <input
         type="number"
         min={5}
         max={480}
         value={globalSettings.sessionTimeout}
         onChange={(e) =>
          setGlobalSettings((prev) => ({
           ...prev,
           sessionTimeout: parseInt(e.target.value, 10) || 30,
          }))
         }
         className="w-full max-w-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
        />
       </div>
      </UnifiedCard>

      {lastResult && (
       <div className="space-y-2">
        {lastResult.successes.length > 0 && (
         <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
          Created {lastResult.successes.length} role(s): {lastResult.successes.join(', ')}.
         </div>
        )}
        {lastResult.failures.length > 0 && (
         <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <p className="font-medium mb-1">{lastResult.failures.length} role(s) failed:</p>
          <ul className="list-disc pl-5">
           {lastResult.failures.map((f) => (
            <li key={f.department}>
             <span className="font-medium">{f.department}:</span> {f.message}
            </li>
           ))}
          </ul>
         </div>
        )}
       </div>
      )}

      <div className="flex justify-between pt-4">
       <button
        type="button"
        onClick={() => setActiveStep('basic')}
        className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium flex items-center gap-2"
       >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
       </button>

       <div className="flex items-center gap-3">
        {submitError && <p className="text-red-600 text-sm">{submitError}</p>}
        <UnifiedButton
         type="button"
         variant="primary"
         size="lg"
         disabled={submitting || includedDepts.size === 0}
         onClick={createRolesBulk}
        >
         <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
         </svg>
         {submitting
          ? 'Saving…'
          : `Save ${includedDepts.size} role${includedDepts.size === 1 ? '' : 's'}`}
        </UnifiedButton>
       </div>
      </div>
     </div>
    )}
   </form>
  </div>
 );
};

export default CreateRole;
