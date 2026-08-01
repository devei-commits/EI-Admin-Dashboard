import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, Loader2, Search, X } from 'lucide-react';
import { inputClassName } from '../ui';
import { fetchStaffUsers, type StaffUserFromApi } from '../../services/user.service';
import type { GlobalSettings, ModulePermission } from './types/permissions.types';
import { loadPermissionsFromUserRole } from './loadPermissionsFromUserRole';

export interface ClonePermissionsFromUserProps {
 onApply: (modules: ModulePermission[], globalSettings: GlobalSettings) => void;
 disabled?: boolean;
}

function getUserId(u: StaffUserFromApi): string {
 return String(u.userid ?? u.id);
}

function getUserLabel(u: StaffUserFromApi): string {
 const id = getUserId(u);
 return u.display_name?.trim() || u.email || `User ${id}`;
}

const ClonePermissionsFromUser: React.FC<ClonePermissionsFromUserProps> = ({
 onApply,
 disabled = false,
}) => {
 const [staffUsers, setStaffUsers] = useState<StaffUserFromApi[]>([]);
 const [loadingUsers, setLoadingUsers] = useState(true);
 const [selectedUserId, setSelectedUserId] = useState('');
 const [userSearch, setUserSearch] = useState('');
 const [listOpen, setListOpen] = useState(false);
 const [importing, setImporting] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [lastImport, setLastImport] = useState<string | null>(null);

 useEffect(() => {
  let cancelled = false;
  setLoadingUsers(true);
  fetchStaffUsers()
   .then((res) => {
    if (cancelled) return;
    const rows = (res.success && res.data ? res.data : [])
     .filter((u) => u.role_id != null && u.role_id > 0)
     .sort((a, b) =>
      (a.display_name || a.email || '').localeCompare(b.display_name || b.email || '')
     );
    setStaffUsers(rows);
   })
   .catch(() => {
    if (!cancelled) setStaffUsers([]);
   })
   .finally(() => {
    if (!cancelled) setLoadingUsers(false);
   });
  return () => {
   cancelled = true;
  };
 }, []);

 const selectedUser = useMemo(
  () => staffUsers.find((u) => getUserId(u) === selectedUserId),
  [staffUsers, selectedUserId]
 );

 const searchQuery = userSearch.trim();
 const showResults = listOpen && searchQuery.length > 0;

 const filteredStaffUsers = useMemo(() => {
  const q = searchQuery.toLowerCase();
  if (!q) return [];
  return staffUsers.filter((u) => {
   const haystack = [
    u.display_name,
    u.email,
    u.role_name,
    u.usertype,
    u.department,
    getUserId(u),
   ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
   return haystack.includes(q);
  });
 }, [staffUsers, searchQuery]);

 const handleSearchChange = useCallback((value: string) => {
  setUserSearch(value);
  setListOpen(true);
  setError(null);
  setLastImport(null);
  if (!value.trim()) {
   setSelectedUserId('');
  } else if (selectedUserId) {
   const selected = staffUsers.find((u) => getUserId(u) === selectedUserId);
   if (selected && getUserLabel(selected).toLowerCase() !== value.trim().toLowerCase()) {
    setSelectedUserId('');
   }
  }
 }, [selectedUserId, staffUsers]);

 const handleSelectUser = useCallback(
  (u: StaffUserFromApi) => {
   setSelectedUserId(getUserId(u));
   setUserSearch(getUserLabel(u));
   setListOpen(false);
   setError(null);
   setLastImport(null);
  },
  []
 );

 const handleClearSelection = useCallback(() => {
  setSelectedUserId('');
  setUserSearch('');
  setListOpen(false);
  setError(null);
  setLastImport(null);
 }, []);

 const handleImport = useCallback(async () => {
  if (!selectedUser?.role_id) {
   setError('Select a user who has an assigned role.');
   return;
  }
  setImporting(true);
  setError(null);
  setLastImport(null);
  try {
   const label = getUserLabel(selectedUser);
   const loaded = await loadPermissionsFromUserRole(selectedUser.role_id, label);
   onApply(loaded.modules, loaded.globalSettings);
   setLastImport(
    `Copied permissions from ${loaded.sourceUserLabel} (role: ${loaded.sourceRoleName}). You can still edit below before saving.`
   );
  } catch (err) {
   setError(err instanceof Error ? err.message : 'Failed to load permissions from that user.');
  } finally {
   setImporting(false);
  }
 }, [selectedUser, onApply]);

 return (
  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/80 p-4">
   <div className="flex items-center gap-2 mb-3">
    <Copy className="w-4 h-4 text-slate-600" />
    <h4 className="text-sm font-semibold text-slate-800">Clone permissions from user</h4>
   </div>
   <p className="text-xs text-slate-600 mb-3">
    Type to search team members, pick one from the results, then import their role&apos;s
    permissions.
   </p>
   <div className="space-y-2">
    <div className="relative">
     <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
     <input
      type="search"
      value={userSearch}
      onChange={(e) => handleSearchChange(e.target.value)}
      onFocus={() => {
       if (searchQuery) setListOpen(true);
      }}
      disabled={disabled || loadingUsers}
      placeholder="Type name, email, or role to search…"
      aria-label="Type name, email, or role to search"
      className={`${inputClassName} pl-9 ${selectedUserId ? 'pr-9' : ''}`}
      autoComplete="off"
     />
     {selectedUserId && !disabled && !importing && (
      <button
       type="button"
       onClick={handleClearSelection}
       className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
       aria-label="Clear selection"
      >
       <X className="w-4 h-4" />
      </button>
     )}
    </div>

    {showResults && (
     <div
      className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden"
      role="listbox"
      aria-label="Team member search results"
     >
      {loadingUsers ? (
       <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading users…
       </div>
      ) : filteredStaffUsers.length === 0 ? (
       <p className="py-6 text-center text-sm text-slate-500">No users match &quot;{searchQuery}&quot;</p>
      ) : (
       <ul className="max-h-52 overflow-y-auto divide-y divide-slate-100">
        {filteredStaffUsers.map((u) => {
         const id = getUserId(u);
         const isSelected = selectedUserId === id;
         const name = getUserLabel(u);
         return (
          <li key={id}>
           <button
            type="button"
            role="option"
            aria-selected={isSelected}
            disabled={disabled || importing}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSelectUser(u)}
            className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-2 disabled:opacity-50 ${
             isSelected ? 'bg-slate-800 text-white' : 'text-slate-800 hover:bg-slate-50'
            }`}
           >
            <span className="flex-1 min-w-0">
             <span className="block font-medium truncate">{name}</span>
             {(u.email || u.role_name) && (
              <span
               className={`block text-xs truncate ${
                isSelected ? 'text-slate-300' : 'text-slate-500'
               }`}
              >
               {[u.email, u.role_name].filter(Boolean).join(' · ')}
              </span>
             )}
            </span>
            {isSelected && <Check className="w-4 h-4 shrink-0" aria-hidden />}
           </button>
          </li>
         );
        })}
       </ul>
      )}
     </div>
    )}

    {!showResults && !loadingUsers && !selectedUser && (
     <p className="text-xs text-slate-500">Start typing to see matching team members.</p>
    )}

    {selectedUser && !showResults && (
     <p className="text-xs text-slate-600 bg-white border border-slate-200 rounded-md px-2.5 py-1.5">
      Selected: <span className="font-medium">{getUserLabel(selectedUser)}</span>
      {selectedUser.role_name ? ` (${selectedUser.role_name})` : ''}
     </p>
    )}

    <button
     type="button"
     onClick={() => void handleImport()}
     disabled={disabled || !selectedUserId || importing || loadingUsers}
     className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
    >
     {importing ? (
      <>
       <Loader2 className="w-4 h-4 animate-spin" />
       Importing…
      </>
     ) : (
      <>
       <Copy className="w-4 h-4" />
       Import permissions
      </>
     )}
    </button>
   </div>
   {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
   {lastImport && (
    <p className="mt-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-2 py-1.5">
     {lastImport}
    </p>
   )}
  </div>
 );
};

export default ClonePermissionsFromUser;
