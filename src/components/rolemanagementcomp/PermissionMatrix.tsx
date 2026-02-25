import React, { useState, useMemo, ReactNode } from 'react';
import {
 ModulePermission,
 SubModulePermission,
 GlobalSettings,
} from './types/permissions.types';


interface PermissionMatrixProps {
 selectedRoleId?: string;
 permissions: ModulePermission[];
 globalSettings: GlobalSettings;
 onPermissionChange: (permissions: ModulePermission[]) => void;
 onGlobalSettingChange: (settings: GlobalSettings) => void;
 readOnly?: boolean;
}

const PermissionMatrix: React.FC<PermissionMatrixProps> = ({
 permissions,
 globalSettings,
 onPermissionChange,
 onGlobalSettingChange,
 readOnly = false
}) => {
 const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
 const [expandedSubModules, setExpandedSubModules] = useState<Set<string>>(new Set());
 const [searchQuery, setSearchQuery] = useState('');
 const [filterType, setFilterType] = useState<'all' | 'enabled' | 'disabled'>('all');
 const [activeTab, setActiveTab] = useState<'modules' | 'global'>('modules');

 // Toggle module expansion
 const toggleModule = (moduleId: string) => {
  setExpandedModules(prev => {
   const next = new Set(prev);
   if (next.has(moduleId)) {
    next.delete(moduleId);
   } else {
    next.add(moduleId);
   }
   return next;
  });
 };

 // Toggle sub-module expansion
 const toggleSubModule = (subModuleId: string) => {
  setExpandedSubModules(prev => {
   const next = new Set(prev);
   if (next.has(subModuleId)) {
    next.delete(subModuleId);
   } else {
    next.add(subModuleId);
   }
   return next;
  });
 };

 // Handle sub-module action change
 const handleActionChange = (
  moduleId: string,
  subModuleId: string,
  action: keyof SubModulePermission['actions']
 ) => {
  if (readOnly) return;
  
  const updated = permissions.map(module => {
   if (module.moduleId !== moduleId) return module;
   
   return {
    ...module,
    subModules: module.subModules.map(sub => {
     if (sub.subModuleId !== subModuleId) return sub;
     
     const newValue = !sub.actions[action];
     
     // If enabling view, no special handling needed
     // If disabling view, disable all other actions too
     if (action === 'view' && !newValue) {
      return {
       ...sub,
       actions: {
        view: false,
        create: false,
        edit: false,
        delete: false,
        approve: false,
        export: false
       },
       columns: sub.columns.map(col => ({ ...col, view: false, edit: false }))
      };
     }
     
     // For other actions, require view to be enabled first
     if (action !== 'view' && newValue && !sub.actions.view) {
      return {
       ...sub,
       actions: {
        ...sub.actions,
        view: true,
        [action]: true
       }
      };
     }
     
     return {
      ...sub,
      actions: {
       ...sub.actions,
       [action]: newValue
      }
     };
    })
   };
  });
  
  onPermissionChange(updated);
 };

 // Handle column permission change
 const handleColumnChange = (
  moduleId: string,
  subModuleId: string,
  columnId: string,
  field: 'view' | 'edit'
 ) => {
  if (readOnly) return;
  
  const updated = permissions.map(module => {
   if (module.moduleId !== moduleId) return module;
   
   return {
    ...module,
    subModules: module.subModules.map(sub => {
     if (sub.subModuleId !== subModuleId) return sub;
     
     return {
      ...sub,
      columns: sub.columns.map(col => {
       if (col.columnId !== columnId) return col;
       
       const newValue = !col[field];
       
       // If enabling edit, also enable view
       if (field === 'edit' && newValue) {
        return { ...col, view: true, edit: true };
       }
       
       // If disabling view, also disable edit
       if (field === 'view' && !newValue) {
        return { ...col, view: false, edit: false };
       }
       
       return { ...col, [field]: newValue };
      })
     };
    })
   };
  });
  
  onPermissionChange(updated);
 };

 // Toggle all actions for a sub-module
 const toggleAllSubModuleActions = (moduleId: string, subModuleId: string, enable: boolean) => {
  if (readOnly) return;
  
  const updated = permissions.map(module => {
   if (module.moduleId !== moduleId) return module;
   
   return {
    ...module,
    subModules: module.subModules.map(sub => {
     if (sub.subModuleId !== subModuleId) return sub;
     
     return {
      ...sub,
      actions: {
       view: enable,
       create: enable,
       edit: enable,
       delete: enable,
       approve: enable,
       export: enable
      },
      columns: sub.columns.map(col => ({
       ...col,
       view: enable,
       edit: enable
      }))
     };
    })
   };
  });
  
  onPermissionChange(updated);
 };

 // Toggle all permissions for a module
 const toggleAllModulePermissions = (moduleId: string, enable: boolean) => {
  if (readOnly) return;
  
  const updated = permissions.map(module => {
   if (module.moduleId !== moduleId) return module;
   
   return {
    ...module,
    subModules: module.subModules.map(sub => ({
     ...sub,
     actions: {
      view: enable,
      create: enable,
      edit: enable,
      delete: enable,
      approve: enable,
      export: enable
     },
     columns: sub.columns.map(col => ({
      ...col,
      view: enable,
      edit: enable
     }))
    }))
   };
  });
  
  onPermissionChange(updated);
 };

 // Check if a module has any permissions enabled
 const hasAnyModulePermission = (module: ModulePermission): boolean => {
  return module.subModules.some(sub => 
   Object.values(sub.actions).some(v => v) ||
   sub.columns.some(col => col.view || col.edit)
  );
 };

 // Check if a sub-module has full access
 const hasFullSubModuleAccess = (sub: SubModulePermission): boolean => {
  return Object.values(sub.actions).every(v => v) &&
   sub.columns.every(col => col.view && col.edit);
 };

 // Count enabled permissions for a module
 const countModulePermissions = (module: ModulePermission): { enabled: number; total: number } => {
  let enabled = 0;
  let total = 0;
  
  module.subModules.forEach(sub => {
   total += 6; // 6 actions
   total += sub.columns.length * 2; // view + edit for each column
   
   enabled += Object.values(sub.actions).filter(v => v).length;
   enabled += sub.columns.filter(col => col.view).length;
   enabled += sub.columns.filter(col => col.edit).length;
  });
  
  return { enabled, total };
 };

 // Filter permissions based on search and filter type
 const filteredPermissions = useMemo(() => {
  return permissions.filter(module => {
   // Search filter
   if (searchQuery) {
    const query = searchQuery.toLowerCase();
    const matchesModule = module.moduleName.toLowerCase().includes(query);
    const matchesSubModule = module.subModules.some(
     sub => sub.subModuleName.toLowerCase().includes(query) ||
      sub.columns.some(col => col.columnName.toLowerCase().includes(query))
    );
    if (!matchesModule && !matchesSubModule) return false;
   }
   
   // Type filter
   if (filterType === 'enabled') {
    return hasAnyModulePermission(module);
   } else if (filterType === 'disabled') {
    return !hasAnyModulePermission(module);
   }
   
   return true;
  });
 }, [permissions, searchQuery, filterType]);

 // Get module icon
 const getModuleIcon = (icon: string): ReactNode => {
  const icons: Record<string, ReactNode> = {
   chart: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
   ),
   product: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
   ),
   order: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
   ),
   inventory: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
   ),
   contacts: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
   ),
   transaction: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
   ),
   treasury: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
   ),
   enquiry: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
   ),
   task: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
   ),
   users: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
   ),
   roles: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
   ),
   settings: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
   ),
   catalogue: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
   ),
   items: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
   ),
   ingredients: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
   ),
   coupon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
   ),
   discount: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
    </svg>
   ),
   appointments: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
   ),
   contact: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
   ),
   development: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
   ),
   samples: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
   ),
   packaging: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
   ),
   orderlist: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
   ),
  };
  
  return icons[icon] || icons.settings;
 };

 // Checkbox component
 const Checkbox: React.FC<{
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  indeterminate?: boolean;
 }> = ({ checked, onChange, disabled, indeterminate }) => (
  <div className="flex items-center justify-center">
   <input
    type="checkbox"
    checked={checked}
    ref={el => {
     if (el) el.indeterminate = indeterminate || false;
    }}
    onChange={onChange}
    disabled={disabled || readOnly}
    className={`w-5 h-5 rounded border-2 transition-all duration-200 cursor-pointer
     ${checked ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-gray-300'}
     ${disabled || readOnly ? 'opacity-50 cursor-not-allowed' : 'hover:border-amber-400'}
     focus:ring-2 focus:ring-slate-800 focus:ring-offset-1`}
   />
  </div>
 );

 // Action labels
 const actionLabels: Record<keyof SubModulePermission['actions'], string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  approve: 'Approve',
  export: 'Export'
 };

 return (
  <div className="w-full">
   {/* Tabs */}
   <div className="flex border-b border-gray-200 mb-6">
    <button
     onClick={() => setActiveTab('modules')}
     className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
      activeTab === 'modules'
       ? 'border-slate-800 text-slate-800'
       : 'border-transparent text-gray-500 hover:text-gray-700'
     }`}
    >
     Module Permissions
    </button>
    <button
     onClick={() => setActiveTab('global')}
     className={`px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
      activeTab === 'global'
       ? 'border-slate-800 text-slate-800'
       : 'border-transparent text-gray-500 hover:text-gray-700'
     }`}
    >
     Global Settings
    </button>
   </div>

   {activeTab === 'modules' && (
    <>
     {/* Search and Filter Bar - Responsive */}
     <div className="flex flex-col gap-3 mb-4 sm:mb-6">
      {/* Search Input */}
      <div className="relative">
       <input
        type="text"
        placeholder="Search modules..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full pl-10 pr-4 py-2.5 sm:py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 bg-gray-50/50 text-base"
       />
       <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
       </svg>
      </div>
      
      {/* Filter and Action Buttons - Scrollable on mobile */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
       <select
        value={filterType}
        onChange={(e) => setFilterType(e.target.value as typeof filterType)}
        className="px-3 sm:px-4 py-2 sm:py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 bg-gray-50/50 text-sm whitespace-nowrap flex-shrink-0"
       >
        <option value="all">All</option>
        <option value="enabled">Enabled</option>
        <option value="disabled">Disabled</option>
       </select>
       
       <button
        onClick={() => {
         setExpandedModules(new Set(permissions.map(m => m.moduleId)));
         setExpandedSubModules(new Set(
          permissions.flatMap(m => m.subModules.map(s => s.subModuleId))
         ));
        }}
        className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap flex-shrink-0"
       >
        <span className="hidden sm:inline">Expand All</span>
        <span className="sm:hidden">Expand</span>
       </button>
       
       <button
        onClick={() => {
         setExpandedModules(new Set());
         setExpandedSubModules(new Set());
        }}
        className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap flex-shrink-0"
       >
        <span className="hidden sm:inline">Collapse All</span>
        <span className="sm:hidden">Collapse</span>
       </button>
      </div>
     </div>

     {/* Legend - Compact on mobile */}
     <div className="flex flex-wrap gap-3 sm:gap-4 mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 rounded-lg text-xs sm:text-sm">
      <div className="flex items-center gap-1.5 sm:gap-2 text-gray-600">
       <div className="w-4 h-4 sm:w-5 sm:h-5 bg-slate-800 rounded"></div>
       <span>Enabled</span>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2 text-gray-600">
       <div className="w-4 h-4 sm:w-5 sm:h-5 bg-white border-2 border-gray-300 rounded"></div>
       <span>Disabled</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-600">
       <div className="w-5 h-5 bg-gray-200 border-2 border-amber-400 rounded"></div>
       <span>Partial</span>
      </div>
     </div>

     {/* Permissions Matrix */}
     <div className="space-y-4">
      {filteredPermissions.map((module) => {
       const stats = countModulePermissions(module);
       const isExpanded = expandedModules.has(module.moduleId);
       const hasPermissions = hasAnyModulePermission(module);
       
       return (
        <div
         key={module.moduleId}
         className={`border rounded-xl overflow-hidden transition-all duration-200 ${
          hasPermissions ? 'border-gray-200 bg-gray-50/30' : 'border-gray-200 bg-white'
         }`}
        >
         {/* Module Header - Responsive */}
         <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 cursor-pointer transition-colors gap-3 ${
           hasPermissions ? 'hover:bg-gray-50' : 'hover:bg-gray-50'
          }`}
          onClick={() => toggleModule(module.moduleId)}
         >
          <div className="flex items-center gap-2 sm:gap-3">
           <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 ${hasPermissions ? 'bg-gray-100 text-slate-800' : 'bg-gray-100 text-gray-500'}`}>
            {getModuleIcon(module.icon)}
           </div>
           <div className="min-w-0">
            <h3 className="font-semibold text-gray-800 text-sm sm:text-base truncate">{module.moduleName}</h3>
            <p className="text-xs sm:text-sm text-gray-500 truncate hidden sm:block">{module.description}</p>
           </div>
          </div>
          
          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4">
           {/* Progress - Always visible */}
           <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">
             {stats.enabled}/{stats.total}
            </span>
            <div className="w-16 sm:w-24 h-1.5 sm:h-2 bg-gray-200 rounded-full overflow-hidden">
             <div
              className="h-full bg-slate-800 transition-all duration-300"
              style={{ width: `${(stats.enabled / stats.total) * 100}%` }}
             />
            </div>
           </div>
           
           {/* Enable/Disable buttons - Hidden on mobile, shown in expanded view */}
           {!readOnly && (
            <div className="hidden md:flex gap-2" onClick={e => e.stopPropagation()}>
             <button
              onClick={() => toggleAllModulePermissions(module.moduleId, true)}
              className="px-2 sm:px-3 py-1 text-xs bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
             >
              Enable All
             </button>
             <button
              onClick={() => toggleAllModulePermissions(module.moduleId, false)}
              className="px-2 sm:px-3 py-1 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
             >
              Disable All
             </button>
            </div>
           )}
           
           <svg
            className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
           >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
           </svg>
          </div>
         </div>
         
         {/* Module Content */}
         {isExpanded && (
          <div className="border-t border-gray-200 divide-y divide-gray-100">
           {/* Mobile-only quick actions */}
           {!readOnly && (
            <div className="md:hidden flex gap-2 p-3 bg-gray-50" onClick={e => e.stopPropagation()}>
             <button
              onClick={() => toggleAllModulePermissions(module.moduleId, true)}
              className="flex-1 px-3 py-2 text-xs bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
             >
              Enable All
             </button>
             <button
              onClick={() => toggleAllModulePermissions(module.moduleId, false)}
              className="flex-1 px-3 py-2 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
             >
              Disable All
             </button>
            </div>
           )}
           {module.subModules.map((subModule) => {
            const isSubExpanded = expandedSubModules.has(subModule.subModuleId);
            const hasFullAccess = hasFullSubModuleAccess(subModule);
            const hasAnyAccess = Object.values(subModule.actions).some(v => v);
            
            return (
             <div key={subModule.subModuleId} className="bg-white">
              {/* Sub-Module Header - Responsive */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between px-3 sm:px-6 py-3 sm:py-4 gap-3">
               <div className="flex items-center gap-2 sm:gap-3">
                <button
                 onClick={() => toggleSubModule(subModule.subModuleId)}
                 className="p-1 rounded hover:bg-gray-100 transition-colors flex-shrink-0"
                >
                 <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${isSubExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                 >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                 </svg>
                </button>
                <span className="font-medium text-gray-700 text-sm sm:text-base">{subModule.subModuleName}</span>
                {hasFullAccess && (
                 <span className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs bg-emerald-100 text-emerald-700 rounded-full whitespace-nowrap">Full</span>
                )}
                {hasAnyAccess && !hasFullAccess && (
                 <span className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs bg-gray-100 text-slate-900 rounded-full whitespace-nowrap">Partial</span>
                )}
               </div>
               
               {/* Action Checkboxes - Responsive Grid */}
               <div className="flex items-center gap-2 sm:gap-4 lg:gap-6 overflow-x-auto pb-1 lg:pb-0">
                {(Object.entries(actionLabels) as [keyof SubModulePermission['actions'], string][]).map(([action, label]) => (
                 <div key={action} className="flex flex-col items-center gap-0.5 sm:gap-1 flex-shrink-0">
                  <span className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">{label}</span>
                  <Checkbox
                   checked={subModule.actions[action]}
                   onChange={() => handleActionChange(module.moduleId, subModule.subModuleId, action)}
                  />
                 </div>
                ))}
                
                {!readOnly && (
                 <div className="flex gap-1 ml-2 sm:ml-4 flex-shrink-0">
                  <button
                   onClick={() => toggleAllSubModuleActions(module.moduleId, subModule.subModuleId, true)}
                   className="p-1 sm:p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                   title="Enable All"
                  >
                   <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                   </svg>
                  </button>
                  <button
                   onClick={() => toggleAllSubModuleActions(module.moduleId, subModule.subModuleId, false)}
                   className="p-1 sm:p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                   title="Disable All"
                  >
                   <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                   </svg>
                  </button>
                 </div>
                )}
               </div>
              </div>
              
              {/* Column Permissions */}
              {isSubExpanded && subModule.columns.length > 0 && (
               <div className="px-6 pb-4">
                <div className="bg-gray-50 rounded-lg p-4">
                 <h5 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                  Column-Level Permissions
                 </h5>
                 
                 <div className="overflow-x-auto">
                  <table className="w-full">
                   <thead>
                    <tr className="border-b border-gray-200">
                     <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Column Name</th>
                     <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">View</th>
                     <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Edit</th>
                    </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                    {subModule.columns.map((column) => (
                     <tr key={column.columnId} className="hover:bg-white transition-colors">
                      <td className="py-2 px-3 text-sm text-gray-700">
                       {column.columnName}
                       {column.tooltip && (
                        <span className="ml-1 text-gray-400" title={column.tooltip}>ⓘ</span>
                       )}
                      </td>
                      <td className="py-2 px-3">
                       <Checkbox
                        checked={column.view}
                        onChange={() => handleColumnChange(module.moduleId, subModule.subModuleId, column.columnId, 'view')}
                       />
                      </td>
                      <td className="py-2 px-3">
                       <Checkbox
                        checked={column.edit}
                        onChange={() => handleColumnChange(module.moduleId, subModule.subModuleId, column.columnId, 'edit')}
                        disabled={!column.view}
                       />
                      </td>
                     </tr>
                    ))}
                   </tbody>
                  </table>
                 </div>
                </div>
               </div>
              )}
             </div>
            );
           })}
          </div>
         )}
        </div>
       );
      })}
     </div>
    </>
   )}

   {activeTab === 'global' && (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
     <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
      <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      Global Access Settings
     </h3>
     
     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Access Settings */}
      <div className="space-y-4">
       <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Access Control</h4>
       
       {[
        { key: 'accessToAllModules', label: 'Access to All Modules', desc: 'Grants full access to all modules regardless of individual permissions' },
        { key: 'allowLogin', label: 'Allow Login', desc: 'User can log into the system' },
        { key: 'allowMultipleSessions', label: 'Allow Multiple Sessions', desc: 'User can have multiple active sessions' },
        { key: 'canChangePassword', label: 'Can Change Password', desc: 'User can change their own password' },
       ].map(({ key, label, desc }) => (
        <label key={key} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
         <input
          type="checkbox"
          checked={globalSettings[key as keyof GlobalSettings] as boolean}
          onChange={() => onGlobalSettingChange({
           ...globalSettings,
           [key]: !globalSettings[key as keyof GlobalSettings]
          })}
          disabled={readOnly}
          className="w-5 h-5 mt-0.5 text-slate-700 rounded border-gray-300 focus:ring-slate-800"
         />
         <div>
          <span className="font-medium text-gray-800">{label}</span>
          <p className="text-sm text-gray-500">{desc}</p>
         </div>
        </label>
       ))}
      </div>
      
      {/* Feature Settings */}
      <div className="space-y-4">
       <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Feature Access</h4>
       
       {[
        { key: 'enableAuditLog', label: 'Enable Audit Log', desc: 'Track user activities in audit log' },
        { key: 'canExportData', label: 'Can Export Data', desc: 'User can export data to files' },
        { key: 'canImportData', label: 'Can Import Data', desc: 'User can import data from files' },
        { key: 'canAccessReports', label: 'Can Access Reports', desc: 'User can view and generate reports' },
        { key: 'canAccessSettings', label: 'Can Access Settings', desc: 'User can access system settings' },
       ].map(({ key, label, desc }) => (
        <label key={key} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
         <input
          type="checkbox"
          checked={globalSettings[key as keyof GlobalSettings] as boolean}
          onChange={() => onGlobalSettingChange({
           ...globalSettings,
           [key]: !globalSettings[key as keyof GlobalSettings]
          })}
          disabled={readOnly}
          className="w-5 h-5 mt-0.5 text-slate-700 rounded border-gray-300 focus:ring-slate-800"
         />
         <div>
          <span className="font-medium text-gray-800">{label}</span>
          <p className="text-sm text-gray-500">{desc}</p>
         </div>
        </label>
       ))}
      </div>
     </div>
     
     {/* Session Timeout */}
     <div className="mt-6 pt-6 border-t border-gray-200">
      <label className="block">
       <span className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Session Timeout (minutes)</span>
       <input
        type="number"
        min={5}
        max={480}
        value={globalSettings.sessionTimeout}
        onChange={(e) => onGlobalSettingChange({
         ...globalSettings,
         sessionTimeout: parseInt(e.target.value) || 30
        })}
        disabled={readOnly}
        className="mt-2 w-full max-w-xs px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 bg-gray-50/50"
       />
       <p className="mt-1 text-sm text-gray-500">Session will expire after this many minutes of inactivity (5-480 minutes)</p>
      </label>
     </div>
    </div>
   )}
  </div>
 );
};

export default PermissionMatrix;
