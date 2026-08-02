import React, { useEffect, useMemo, useState } from 'react';
import {
 UnifiedButton,
 UnifiedLabel,
 UnifiedCard,
 inputClassName,
 selectClassName,
 textareaClassName,
} from '../ui';
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
import ClonePermissionsFromUser from './ClonePermissionsFromUser';

const ROLE_LEVELS = ['admin', 'manager', 'staff', 'client'] as const;

const toRoleCode = (name: string): string =>
 name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

const cloneDefaults = (): ModulePermission[] =>
 JSON.parse(JSON.stringify(DEFAULT_MODULE_PERMISSIONS)) as ModulePermission[];

const CreateRole: React.FC = () => {
 const [formData, setFormData] = useState({
  roleName: '',
  roleLevel: 'staff',
  roleStatus: 'active' as 'active' | 'inactive',
  description: '',
 });

 const [activeStep, setActiveStep] = useState<'basic' | 'permissions'>('basic');
 const [permissions, setPermissions] = useState<ModulePermission[]>(() => cloneDefaults());
 const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({ ...DEFAULT_GLOBAL_SETTINGS });

 const [submitting, setSubmitting] = useState(false);
 const [submitError, setSubmitError] = useState<string | null>(null);
 const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

 const roleCodePreview = useMemo(() => toRoleCode(formData.roleName), [formData.roleName]);

 const matrixKey = formData.roleName.trim() || 'New Role';

 useEffect(() => {
  if (formData.roleLevel === 'admin') {
   setPermissions(createFullAccessPermissions());
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
  } else if (activeStep === 'basic') {
   setPermissions(cloneDefaults());
   setGlobalSettings({ ...DEFAULT_GLOBAL_SETTINGS });
  }
 }, [formData.roleLevel, activeStep]);

 const handleInputChange = (
  e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
 ) => {
  const { name, value } = e.target;
  setFormData((prev) => ({ ...prev, [name]: value }));
 };

 const isBasicInfoComplete = Boolean(formData.roleName.trim()) && Boolean(formData.roleLevel);

 const resetForm = () => {
  setFormData({ roleName: '', roleLevel: 'staff', roleStatus: 'active', description: '' });
  setPermissions(cloneDefaults());
  setGlobalSettings({ ...DEFAULT_GLOBAL_SETTINGS });
  setActiveStep('basic');
  setSubmitError(null);
 };

 const createSingleRole = async () => {
  setSubmitError(null);
  setSubmitSuccess(null);

  const roleName = formData.roleName.trim();
  const roleCode = toRoleCode(roleName);
  if (!roleName) {
   setSubmitError('Role name is required.');
   return;
  }
  if (!roleCode) {
   setSubmitError('Role name must contain at least one letter or number.');
   return;
  }
  if (!formData.roleLevel) {
   setSubmitError('Role level is required.');
   return;
  }

  setSubmitting(true);
  try {
   const { granted, globalSettings: gs } = flattenPermissionsToGranted(permissions, globalSettings);
   await createRoleApi({
    role_code: roleCode,
    role_name: roleName,
    description: formData.description.trim() || undefined,
    level: formData.roleLevel,
    status: formData.roleStatus,
    permissions: { granted, globalSettings: gs },
   });
   setSubmitSuccess(`Role "${roleName}" created successfully.`);
   resetForm();
  } catch (err) {
   setSubmitError(
    err instanceof Error ? err.message : 'Failed to create role (code may already exist).'
   );
  } finally {
   setSubmitting(false);
  }
 };

 return (
  <div className="w-full max-w-7xl">
   <h2 className="text-xl sm:text-2xl font-semibold text-ink mb-2 tracking-tight">
    Create Role
   </h2>
   <p className="text-sm text-ink-2 mb-4 sm:mb-6">
    Enter a custom role name, then choose module permissions for that role.
   </p>

   <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-0 mb-6 sm:mb-8 p-4 bg-surface-2 rounded-xl sm:bg-transparent sm:p-0">
    <div className="flex items-center">
     <div
      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold text-sm sm:text-base ${
       activeStep === 'basic' ? 'bg-ink text-white' : 'bg-ok text-white'
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
       activeStep === 'basic' ? 'text-ink' : 'text-ink-2'
      }`}
     >
      Role Information
     </span>
    </div>
    <div className="hidden sm:block flex-1 h-1 mx-4 bg-surface-3 rounded">
     <div
      className={`h-full bg-ink rounded transition-all duration-300 ${
       activeStep === 'permissions' ? 'w-full' : 'w-0'
      }`}
     />
    </div>
    <div className="flex items-center">
     <div
      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold text-sm sm:text-base ${
       activeStep === 'permissions' ? 'bg-ink text-white' : 'bg-surface-3 text-ink-3'
      }`}
     >
      2
     </div>
     <span
      className={`ml-2 sm:ml-3 text-sm sm:text-base font-medium ${
       activeStep === 'permissions' ? 'text-ink' : 'text-ink-4'
      }`}
     >
      Permissions
     </span>
    </div>
   </div>

   <form onSubmit={(e) => e.preventDefault()}>
    {activeStep === 'basic' && (
     <UnifiedCard>
      <h3 className="text-sm sm:text-md font-semibold text-ink mb-4 sm:mb-6 uppercase tracking-wider">
       Role Information
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
       <div className="md:col-span-2">
        <UnifiedLabel>Role Name *</UnifiedLabel>
        <input
         type="text"
         name="roleName"
         value={formData.roleName}
         onChange={handleInputChange}
         className={inputClassName}
         placeholder="e.g. Warehouse Supervisor, BD Executive"
         required
         maxLength={120}
        />
        <p className="mt-1 text-xs text-ink-3">
         Display name shown in User Management and role lists.
        </p>
       </div>

       <div>
        <UnifiedLabel>Role Code</UnifiedLabel>
        <input
         type="text"
         value={roleCodePreview || '—'}
         readOnly
         className={`${inputClassName} bg-surface-2 text-ink-2 font-mono`}
        />
        <p className="mt-1 text-xs text-ink-3">Auto-generated from role name (used internally).</p>
       </div>

       <div>
        <UnifiedLabel>Role Level *</UnifiedLabel>
        <select
         name="roleLevel"
         value={formData.roleLevel}
         onChange={handleInputChange}
         className={selectClassName}
         required
        >
         {ROLE_LEVELS.map((level) => (
          <option key={level} value={level}>
           {level.charAt(0).toUpperCase() + level.slice(1)}
          </option>
         ))}
        </select>
       </div>

       <div>
        <UnifiedLabel>Status</UnifiedLabel>
        <select
         name="roleStatus"
         value={formData.roleStatus}
         onChange={handleInputChange}
         className={selectClassName}
         required
        >
         <option value="active">Active</option>
         <option value="inactive">Inactive</option>
        </select>
       </div>

       <div className="md:col-span-2">
        <UnifiedLabel>Description</UnifiedLabel>
        <textarea
         name="description"
         value={formData.description}
         onChange={handleInputChange}
         rows={3}
         className={textareaClassName}
         placeholder="Optional description for this role"
        />
       </div>
      </div>

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
      <div className="bg-surface-2 border border-hairline rounded-xl p-4 sm:p-6">
       <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
         <h3 className="text-lg font-semibold text-ink">
          Permissions for &ldquo;{formData.roleName.trim()}&rdquo;
         </h3>
         <p className="text-sm text-ink-2 mt-1">
          Level: <span className="capitalize font-medium">{formData.roleLevel}</span>
          {' · '}
          Code: <span className="font-mono text-xs">{roleCodePreview}</span>
         </p>
        </div>
        <button
         type="button"
         onClick={() => setActiveStep('basic')}
         className="text-ink hover:text-ink font-medium flex items-center gap-2 text-sm"
        >
         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
         </svg>
         Edit role info
        </button>
       </div>
      </div>

      <ClonePermissionsFromUser
       disabled={submitting}
       onApply={(modules, gs) => {
        setPermissions(modules);
        setGlobalSettings(gs);
       }}
      />

      <UnifiedCard className="!p-4 sm:!p-6">
       <DepartmentPermissionMatrix
        departments={[matrixKey]}
        permissionsByDept={{ [matrixKey]: permissions }}
        onDeptPermissionsChange={(_dept, next) => setPermissions(next)}
        showDepartmentColumn={false}
       />
      </UnifiedCard>

      <UnifiedCard className="!p-4 sm:!p-6">
       <h4 className="text-sm font-semibold text-ink-2 uppercase tracking-wider mb-3">
        Global Settings
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
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-2 cursor-pointer"
         >
          <input
           type="checkbox"
           checked={Boolean(globalSettings[key])}
           onChange={() =>
            setGlobalSettings((prev) => ({ ...prev, [key]: !prev[key] } as GlobalSettings))
           }
           className="w-4 h-4 rounded border-border"
          />
          <span className="text-sm text-ink-2">{label}</span>
         </label>
        ))}
       </div>
       <div className="mt-4">
        <label className="block text-xs font-semibold text-ink-2 uppercase tracking-wider mb-1">
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
         className="w-full max-w-xs px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-border"
        />
       </div>
      </UnifiedCard>

      {submitSuccess && (
       <div className="p-3 rounded-lg bg-ok-soft border border-ok text-ok text-sm">
        {submitSuccess}
       </div>
      )}

      <div className="flex justify-between pt-4">
       <button
        type="button"
        onClick={() => setActiveStep('basic')}
        className="px-6 py-3 text-ink-2 hover:text-ink font-medium flex items-center gap-2"
       >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
       </button>

       <div className="flex items-center gap-3">
        {submitError && <p className="text-err text-sm">{submitError}</p>}
        <UnifiedButton
         type="button"
         variant="primary"
         size="lg"
         disabled={submitting}
         onClick={createSingleRole}
        >
         <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
         </svg>
         {submitting ? 'Creating…' : 'Create Role'}
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